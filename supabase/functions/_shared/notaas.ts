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

export function montarPayloadNfce(params: {
  itens: ComandaItemFiscal[];
  pagamentos: { forma: string; valor: number }[];
  clienteCpf?: string | null;
  clienteNome?: string | null;
  ambiente?: string | null;
}) {
  const items = params.itens.map((item) => ({
    descricao: item.nome,
    ncm: item.ncm,
    cfop: item.cfop,
    quantidade: item.quantidade,
    valorUnitario: item.preco_unitario,
    valorTotal: Number((item.preco_unitario * item.quantidade).toFixed(2)),
    unidade: item.unidade || "UN",
    cst: item.cst_csosn || undefined,
    aliquotaIcms: item.aliquota_icms ?? undefined,
  }));

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
    naturezaOperacao: "Venda de mercadoria",
    tipoOperacao: 1,
    finalidade: 1,
    consumidorFinal: 1,
    presencaComprador: 1,
    items,
    pagamentos,
  };

  if (params.clienteCpf && /^\d{11}$/.test(params.clienteCpf)) {
    payload.dest = {
      cpf: params.clienteCpf,
      nome: params.clienteNome || undefined,
    };
  }

  return payload;
}
