// Helpers compartilhados pelas edge functions que integram com a API da Notaas
// (https://docs.notaas.com.br) para emissão de NFC-e.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const NOTAAS_BASE_URL = Deno.env.get("NOTAAS_BASE_URL") || "https://platform.notaas.com.br/api/v1";

export function notaasHeaders(extra?: Record<string, string>) {
  const apiKey = Deno.env.get("NOTAAS_API_KEY");
  if (!apiKey) throw new Error("NOTAAS_API_KEY não configurada nos secrets da função");
  return {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
    ...extra,
  };
}

// Mapeamento forma_pagamento (enum do banco) -> tipoPagamento da Notaas.
// dinheiro=01, cartao_credito=03, cartao_debito=04, pix=17. "consumo_funcionario" e "outro"
// não têm um código fiscal 1:1 óbvio — usamos "99" (Outros) como padrão seguro; confirme
// com o contador se algum desses casos deveria ser tratado de outra forma.
export const TIPO_PAGAMENTO_MAP: Record<string, string> = {
  dinheiro: "01",
  cartao_credito: "03",
  cartao_debito: "04",
  pix: "17",
  consumo_funcionario: "99",
  outro: "99",
};

export interface ComandaItemFiscal {
  nome: string;
  quantidade: number;
  preco_unitario: number;
  ncm: string | null;
  cfop: string | null;
  cst_csosn: string | null;
  unidade: string | null;
  aliquota_icms: number | null;
}

export function validarItensFiscais(itens: ComandaItemFiscal[]): string | null {
  for (const item of itens) {
    if (!item.ncm || !item.cfop) {
      return `Produto "${item.nome}" está sem NCM/CFOP cadastrado. Preencha os dados fiscais em Produtos antes de emitir a NFC-e.`;
    }
  }
  return null;
}

// O schema XML da NF-e só aceita caracteres Latin-1 (U+0020–U+00FF) em textos como
// xProd/xNome. Travessão "–", aspas curvas, reticências etc. (comuns em nomes de
// produtos) fazem a Sefaz rejeitar com "Falha no schema XML". Troca por equivalentes
// ASCII e descarta o que sobrar fora do intervalo. Limite de 120 caracteres do xProd.
export function sanitizarTextoFiscal(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .replace(/[^ -ÿ]/g, "")
    .trim()
    .slice(0, 120);
}

// Busca o XML de uma invoice na Notaas, com retry — usada tanto pela exportação
// mensal de XMLs quanto pelo gerador do Sintegra (ambos leem nota a nota, já
// que a Notaas não tem endpoint de listagem/exportação em lote).
export async function fetchXmlComRetry(
  invoiceId: string,
  type?: "cancel",
): Promise<{ ok: true; xml: string } | { ok: false; error: string }> {
  const url = `${NOTAAS_BASE_URL}/nfe/invoices/${invoiceId}/xml${type ? `?type=${type}` : ""}`;
  let lastError = "";
  const maxTentativas = 5;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const resp = await fetch(url, { headers: notaasHeaders() });
      if (resp.ok) {
        const xml = await resp.text();
        return { ok: true, xml };
      }
      lastError = `HTTP ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 200)}`;
      // 429 é a própria Notaas pedindo pra esperar — respeita Retry-After quando
      // vier, senão recua de forma bem mais generosa que os outros erros (que são
      // falhas transitórias normais, não um limite sendo estourado de propósito).
      if (resp.status === 429 && tentativa < maxTentativas) {
        const retryAfterHeader = resp.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
        await new Promise((r) => setTimeout(r, Number.isFinite(retryAfterMs) ? retryAfterMs : 3000 * tentativa));
        continue;
      }
    } catch (e) {
      lastError = (e as Error).message;
    }
    if (tentativa < maxTentativas) await new Promise((r) => setTimeout(r, 500 * tentativa));
  }
  return { ok: false, error: lastError };
}

export function montarPayloadNfce(params: {
  itens: ComandaItemFiscal[];
  pagamentos: { forma: string; valor: number }[];
  clienteCpf?: string | null;
  clienteNome?: string | null;
  ambiente?: string | null;
}) {
  const items = params.itens.map((item) => {
    // Regime Normal (CRT 2/3) usa CST de 2 dígitos; Simples Nacional / MEI (CRT 1/4)
    // usa CSOSN de 3 dígitos — a Notaas exige campos separados (`cst` x `csosn`).
    const codigoTributario = item.cst_csosn?.replace(/\D/g, "") || undefined;
    const csosn = codigoTributario?.length === 3 ? codigoTributario : undefined;
    const cst = codigoTributario?.length === 2 ? codigoTributario : undefined;

    return {
      descricao: sanitizarTextoFiscal(item.nome) || "ITEM",
      ncm: item.ncm,
      cfop: item.cfop,
      quantidade: item.quantidade,
      valorUnitario: item.preco_unitario,
      valorTotal: Number((item.preco_unitario * item.quantidade).toFixed(2)),
      unidade: item.unidade || "UN",
      cst,
      csosn,
      aliquotaIcms: item.aliquota_icms ?? undefined,
    };
  });

  // Exigência da Sefaz: em homologação, a descrição do 1º item precisa ser
  // exatamente este texto fixo, senão a nota é rejeitada (não tem efeito em produção).
  if (params.ambiente !== "producao" && items.length > 0) {
    items[0].descricao = "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";
  }

  // A Sefaz rejeita a nota se a soma dos pagamentos for maior que o total dos itens
  // (ex: cliente pagou em dinheiro com valor maior e recebeu troco). O troco é uma
  // questão de caixa, não deve inflar o valor de pagamento declarado na nota fiscal —
  // por isso cada pagamento é limitado ao saldo que ainda falta cobrir, e o excedente
  // (troco) é descartado do payload.
  const totalItens = items.reduce((sum, item) => sum + item.valorTotal, 0);
  let saldo = totalItens;
  const pagamentos = params.pagamentos
    .map((p) => {
      const valor = Number(Math.min(Math.max(p.valor, 0), saldo).toFixed(2));
      saldo = Number((saldo - valor).toFixed(2));
      return { tipoPagamento: TIPO_PAGAMENTO_MAP[p.forma] || "99", valor };
    })
    .filter((p) => p.valor > 0);

  const payload: Record<string, unknown> = {
    modelo: 65,
    naturezaOperacao: "Venda a consumidor",
    consumidorFinal: 1,
    presencaComprador: 1,
  };

  // dest antes de items, com apenas cpf + nome — formato idêntico ao exemplo
  // "cartão" do playground da Notaas para NFC-e. A Notaas descarta o bloco
  // inteiro se dest.nome faltar (mín. 2 caracteres), fazendo a nota sair como
  // "consumidor não identificado"; por isso só monta dest com CPF de 11
  // dígitos E nome válido — caso contrário emite anônima de propósito.
  const nomeDest = sanitizarTextoFiscal(params.clienteNome ?? "");
  if (params.clienteCpf && /^\d{11}$/.test(params.clienteCpf) && nomeDest.length >= 2) {
    payload.dest = {
      cpf: params.clienteCpf,
      nome: nomeDest,
    };
  }

  payload.items = items;
  payload.pagamentos = pagamentos;

  return payload;
}
