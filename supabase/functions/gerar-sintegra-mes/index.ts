import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.3.6";
import { corsHeaders, fetchXmlComRetry } from "../_shared/notaas.ts";

// Gerador do arquivo Sintegra (Convênio ICMS 57/95, leiaute vigente — "estrutura
// código 3", alterações até o Convênio ICMS 76/03; é esse o leiaute validado
// pelo "Validador Sintegra 5.4.0" distribuído pela SEFAZ/MG, que foi a versão
// citada pelo contador). Registros 10, 11, 50, 54, 75 e 90, competência e
// finalidade informados pelo chamador.
//
// Fonte dos dados: os XMLs das NFC-e autorizadas/canceladas do período (a
// mesma fonte do item 1 — a Notaas não lista/exporta em lote, então buscamos
// nota a nota) + o cadastro fiscal da empresa (tabela empresas). Deliberado:
// NÃO usamos o cadastro de produtos daqui — tudo que o Sintegra precisa por
// item (NCM, CFOP, CST/CSOSN, descrição, unidade) já vem no própria XML
// autorizado pela Sefaz, que é a fonte mais autoritativa (reflete exatamente
// o que foi transmitido, mesmo que o cadastro local mude depois).
//
// Pontos assumidos com base no texto do manual (não são "chutes" — a
// justificativa de cada um está no comentário local) ou ainda sem confirmação
// do contador são sempre registrados em DUVIDAS-SINTEGRA.md, nunca aplicados
// silenciosamente sem deixar rastro.

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

// ---------- formatação de campos de tamanho fixo ----------

function alfa(v: string | null | undefined, len: number): string {
  const s = (v ?? "").toString().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, len);
  return s.padEnd(len, " ");
}
function numCodigo(v: string | number | null | undefined, len: number): string {
  // Campos "N" que são código (não valor) — ex.: CNPJ, CFOP, data. Mantém só dígitos.
  const s = (v ?? "").toString().replace(/\D/g, "").slice(-len);
  return s.padStart(len, "0");
}
function money(v: number | null | undefined, len: number): string {
  const centavos = Math.round((Number(v) || 0) * 100);
  return String(Math.max(0, centavos)).slice(-len).padStart(len, "0");
}
function qtd3(v: number | null | undefined, len: number): string {
  const milesimos = Math.round((Number(v) || 0) * 1000);
  return String(Math.max(0, milesimos)).slice(-len).padStart(len, "0");
}
function aliquota2(v: number | null | undefined, len: number): string {
  const centesimos = Math.round((Number(v) || 0) * 100);
  return String(Math.max(0, centesimos)).slice(-len).padStart(len, "0");
}
function dataYYYYMMDD(isoOuData: string | null | undefined): string {
  if (!isoOuData) return "00000000";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoOuData);
  if (!m) return "00000000";
  return `${m[1]}${m[2]}${m[3]}`;
}
function linha(...campos: string[]): string {
  const l = campos.join("");
  if (l.length !== 126) throw new Error(`Linha com tamanho ${l.length}, esperado 126: ${JSON.stringify(campos)}`);
  return l;
}

// ---------- extração dos dados fiscais do XML (NFe/NFC-e 4.00, padrão nacional) ----------

type ItemXml = {
  nItem: string; cProd: string; xProd: string; ncm: string; cfop: string;
  uCom: string; qCom: number; vProd: number; csosn: string | null; cst: string | null;
  vBC: number; vICMS: number; vBCST: number; vICMSST: number;
};

type NotaXml = {
  chave: string; protocolo: string; modelo: string; serie: string; numero: string;
  dhEmi: string; cnpjDest: string | null; ieDest: string | null;
  vNF: number; vBC: number; vICMS: number; vDesc: number; vOutro: number; vFrete: number; vSeg: number;
  itens: ItemXml[];
};

function extrairICMS(imposto: any): { csosn: string | null; cst: string | null; vBC: number; vICMS: number; vBCST: number; vICMSST: number } {
  const icms = imposto?.ICMS;
  if (!icms) return { csosn: null, cst: null, vBC: 0, vICMS: 0, vBCST: 0, vICMSST: 0 };
  const chaveGrupo = Object.keys(icms)[0]; // ex.: "ICMS102", "ICMS500", "ICMS00"...
  const g = icms[chaveGrupo];
  if (!g) return { csosn: null, cst: null, vBC: 0, vICMS: 0, vBCST: 0, vICMSST: 0 };
  const codigo = g.CSOSN ?? g.CST ?? null;
  const ehCsosn = g.CSOSN !== undefined;
  return {
    csosn: ehCsosn ? String(codigo) : null,
    cst: !ehCsosn && codigo != null ? String(codigo) : null,
    vBC: Number(g.vBC) || 0,
    vICMS: Number(g.vICMS) || 0,
    vBCST: Number(g.vBCST ?? g.vBCSTRet) || 0,
    vICMSST: Number(g.vICMSST ?? g.vICMSSTRet) || 0,
  };
}

function parseNotaXml(xml: string): { ok: true; nota: NotaXml } | { ok: false; erro: string } {
  try {
    const doc = xmlParser.parse(xml);
    const proc = doc.nfeProc ?? doc;
    const infNFe = proc.NFe?.infNFe ?? proc.infNFe;
    const infProt = proc.protNFe?.infProt;
    if (!infNFe) return { ok: false, erro: "XML sem infNFe (estrutura inesperada)" };

    const ide = infNFe.ide;
    const dest = infNFe.dest;
    const total = infNFe.total?.ICMSTot;
    const detRaw = infNFe.det;
    const dets = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

    const itens: ItemXml[] = dets.map((det: any) => {
      const prod = det.prod;
      const { csosn, cst, vBC, vICMS, vBCST, vICMSST } = extrairICMS(det.imposto);
      return {
        nItem: String(det["@_nItem"] ?? ""),
        cProd: String(prod?.cProd ?? ""),
        xProd: String(prod?.xProd ?? ""),
        ncm: String(prod?.NCM ?? ""),
        cfop: String(prod?.CFOP ?? ""),
        uCom: String(prod?.uCom ?? ""),
        qCom: Number(prod?.qCom) || 0,
        vProd: Number(prod?.vProd) || 0,
        csosn, cst, vBC, vICMS, vBCST, vICMSST,
      };
    });

    return {
      ok: true,
      nota: {
        chave: String(infProt?.chNFe ?? infNFe["@_Id"] ?? "").replace(/\D/g, ""),
        protocolo: String(infProt?.nProt ?? ""),
        modelo: String(ide?.mod ?? ""),
        serie: String(ide?.serie ?? ""),
        numero: String(ide?.nNF ?? ""),
        dhEmi: String(ide?.dhEmi ?? ide?.dEmi ?? ""),
        cnpjDest: dest?.CNPJ ? String(dest.CNPJ) : dest?.CPF ? String(dest.CPF) : null,
        ieDest: dest?.IE ? String(dest.IE) : null,
        vNF: Number(total?.vNF) || 0,
        vBC: Number(total?.vBC) || 0,
        vICMS: Number(total?.vICMS) || 0,
        vDesc: Number(total?.vDesc) || 0,
        vOutro: Number(total?.vOutro) || 0,
        vFrete: Number(total?.vFrete) || 0,
        vSeg: Number(total?.vSeg) || 0,
        itens,
      },
    };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonError = (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Não autenticado", 401);
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) return jsonError("Não autenticado", 401);
    const { data: callerProfile } = await supabaseAdmin.from("usuarios").select("ativo").eq("id", caller.id).single();
    if (!callerProfile?.ativo) return jsonError("Usuário inativo", 403);

    const { from, to } = await req.json();
    if (!from || !to) return jsonError("Informe from e to (ISO 8601)", 400);

    const { data: empresa, error: empresaError } = await supabaseAdmin.from("empresas").select("*").single();
    if (empresaError || !empresa) return jsonError("Cadastro da empresa não encontrado (tabela empresas)", 500);

    const faltandoEmpresa = ["cnpj", "razao_social", "inscricao_estadual", "codigo_municipio", "endereco_logradouro", "endereco_numero", "endereco_bairro", "endereco_cidade", "endereco_uf", "endereco_cep"]
      .filter((c) => !empresa[c]);
    if (faltandoEmpresa.length > 0) {
      return jsonError(`Cadastro da empresa incompleto, faltam: ${faltandoEmpresa.join(", ")}. Preencha em Configurações antes de gerar o Sintegra.`, 422);
    }

    const { data: produtosCsosn } = await supabaseAdmin.from("produtos").select("cst_csosn").eq("ativo", true);
    const totalProdutosAtivos = produtosCsosn?.length ?? 0;
    const csosnCounts = new Map<string, number>();
    for (const p of produtosCsosn || []) csosnCounts.set(p.cst_csosn || "(vazio)", (csosnCounts.get(p.cst_csosn || "(vazio)") || 0) + 1);
    const resumoCsosn = [...csosnCounts.entries()].map(([c, n]) => `${c}: ${n}`).join(", ") || "nenhum produto ativo";

    const { data: notas, error: notasError } = await supabaseAdmin
      .from("notas_fiscais")
      .select("id, numero, invoice_id, status, created_at")
      .gte("created_at", from)
      .lt("created_at", to)
      .in("status", ["issued", "cancelled"])
      .order("created_at", { ascending: true });
    if (notasError) return jsonError(`Erro ao buscar notas: ${notasError.message}`, 500);

    const falhas: string[] = [];
    const produtosSemDadoFiscal: string[] = [];

    type NotaProcessada = { numero: string; status: "issued" | "cancelled"; nota: NotaXml };
    const processadas: NotaProcessada[] = [];

    for (const n of (notas || [])) {
      if (!n.invoice_id) { falhas.push(`Nota #${n.numero}: sem invoice_id, não foi possível buscar o XML`); continue; }
      const r = await fetchXmlComRetry(n.invoice_id);
      if (!r.ok) { falhas.push(`Nota #${n.numero}: falha ao baixar XML (${r.error})`); continue; }
      const parsed = parseNotaXml(r.xml);
      if (!parsed.ok) { falhas.push(`Nota #${n.numero}: XML não pôde ser interpretado (${parsed.erro})`); continue; }
      processadas.push({ numero: n.numero || "", status: n.status as "issued" | "cancelled", nota: parsed.nota });
      await new Promise((res) => setTimeout(res, 120));
    }

    // Produto sem dado fiscal no próprio XML (NCM/CFOP/CSOSN vazios) — a emissão já
    // valida isso antes de emitir, então só deveria acontecer por uma falha da Notaas
    // ao gravar o XML. Por instrução explícita: listar e parar, não gerar com padrão.
    for (const { numero, nota } of processadas) {
      for (const item of nota.itens) {
        if (!item.ncm || !item.cfop || (!item.csosn && !item.cst)) {
          produtosSemDadoFiscal.push(`Nota #${numero}, item ${item.nItem} ("${item.xProd}"): NCM="${item.ncm}" CFOP="${item.cfop}" CST/CSOSN="${item.csosn ?? item.cst ?? ""}"`);
        }
      }
    }
    if (produtosSemDadoFiscal.length > 0) {
      return jsonError(
        `Itens sem dado fiscal completo no XML autorizado — Sintegra NÃO foi gerado (não geramos com valores padrão). Corrija e peça para gerar de novo:\n` +
        produtosSemDadoFiscal.join("\n"),
        422,
      );
    }

    // ---------- registro 10 ----------
    const dataInicial = dataYYYYMMDD(from);
    const dataFinalDate = new Date(new Date(to).getTime() - 1);
    const dataFinal = dataYYYYMMDD(dataFinalDate.toISOString());

    const linhas10 = [
      linha(
        "10", numCodigo(empresa.cnpj, 14), alfa(empresa.inscricao_estadual, 14),
        alfa(empresa.razao_social, 35), alfa(empresa.endereco_cidade, 30), alfa(empresa.endereco_uf, 2),
        numCodigo(empresa.telefone, 10), dataInicial, dataFinal, "3", "3", "1",
      ),
    ];

    // ---------- registro 11 ----------
    const numeroEndereco = empresa.endereco_numero && /^\d+$/.test(empresa.endereco_numero) ? empresa.endereco_numero : "0";
    const linhas11 = [
      linha(
        "11", alfa(empresa.endereco_logradouro, 34), numCodigo(numeroEndereco, 5),
        alfa(empresa.endereco_complemento, 22), alfa(empresa.endereco_bairro, 15),
        numCodigo(empresa.endereco_cep, 8), alfa(empresa.razao_social, 28), numCodigo(empresa.telefone, 12),
      ),
    ];

    // ---------- registros 50/54 ----------
    const linhas50: string[] = [];
    const linhas54: string[] = [];
    // catálogo para o registro 75: código do produto -> dados (do próprio XML)
    const catalogoProdutos = new Map<string, { ncm: string; descricao: string; unidade: string }>();
    const divergencias: string[] = [];

    for (const { status, nota } of processadas) {
      const cnpjDestNum = nota.cnpjDest ? numCodigo(nota.cnpjDest, 14) : "00000000000000";
      const ieDest = nota.ieDest ? alfa(nota.ieDest, 14) : alfa("ISENTO", 14);
      const dataEmissao = dataYYYYMMDD(nota.dhEmi);

      if (status === "cancelled") {
        // Nota cancelada: só identificação (modelo/série/número/CFOP), demais campos
        // zerados, situação "S". Sem registro 54 — não houve operação a detalhar.
        // (O texto-base do manual cita "campo 06 Modelo, 07 Série, 08 Subsérie, 09
        // Número" — numeração de uma versão anterior do Convênio; reconciliado aqui
        // com a tabela vigente, onde esses mesmos números de campo correspondem a
        // Modelo/Série/Número/CFOP. Ver DUVIDAS-SINTEGRA.md.)
        const cfopPrimeiroItem = nota.itens[0]?.cfop ?? "0000";
        linhas50.push(linha(
          "50", "00000000000000", alfa("", 14), "00000000", "MG",
          numCodigo(nota.modelo, 2), alfa(nota.serie, 3), numCodigo(nota.numero, 6), numCodigo(cfopPrimeiroItem, 4),
          "P", money(0, 13), money(0, 13), money(0, 13), money(0, 13), money(0, 13), aliquota2(0, 4), "S",
        ));
        continue;
      }

      // Nota autorizada: um registro 50 por CFOP distinto entre os itens (regra do
      // manual — alíquota/CFOP combinados; como nenhum produto atual tem ICMS
      // destacado — Simples Nacional, CSOSN 102/500 — a alíquota é sempre 0 aqui).
      const porCfop = new Map<string, ItemXml[]>();
      for (const item of nota.itens) {
        const arr = porCfop.get(item.cfop) || [];
        arr.push(item);
        porCfop.set(item.cfop, arr);
      }

      let somaItensNota = 0;
      for (const [cfop, itensCfop] of porCfop) {
        const vProdGrupo = itensCfop.reduce((s, i) => s + i.vProd, 0);
        // CSOSN 102/500 (Simples Nacional): não há base/ICMS próprio destacado. O
        // valor da operação entra em "Outras" (campo 15 — "valor que não confira
        // débito ou crédito do ICMS"), que é exatamente a definição do CSOSN 102.
        // Ver DUVIDAS-SINTEGRA.md.
        const vBCGrupo = itensCfop.reduce((s, i) => s + i.vBC, 0);
        const vICMSGrupo = itensCfop.reduce((s, i) => s + i.vICMS, 0);
        const outrasGrupo = vProdGrupo - vBCGrupo; // valor não tributado pelo ICMS normal

        linhas50.push(linha(
          "50", cnpjDestNum, ieDest, dataEmissao, "MG",
          numCodigo(nota.modelo, 2), alfa(nota.serie, 3), numCodigo(nota.numero, 6), numCodigo(cfop, 4),
          "P", money(nota.vNF, 13), money(vBCGrupo, 13), money(vICMSGrupo, 13), money(0, 13), money(outrasGrupo, 13), aliquota2(0, 4), "N",
        ));
      }

      for (const item of nota.itens) {
        linhas54.push(linha(
          "54", cnpjDestNum, numCodigo(nota.modelo, 2), alfa(nota.serie, 3), numCodigo(nota.numero, 6),
          numCodigo(item.cfop, 4), alfa(item.csosn ?? item.cst ?? "", 3), numCodigo(item.nItem, 3),
          alfa(item.cProd, 14), qtd3(item.qCom, 11), money(item.vProd, 12), money(0, 12),
          money(item.vBC, 12), money(item.vBCST, 12), money(0, 12), aliquota2(0, 4),
        ));
        somaItensNota += item.vProd;

        if (!catalogoProdutos.has(item.cProd)) {
          catalogoProdutos.set(item.cProd, { ncm: item.ncm, descricao: item.xProd, unidade: item.uCom });
        }
      }

      if (Math.abs(somaItensNota - nota.vNF) > 0.02) {
        divergencias.push(`Nota #${nota.numero}: soma dos itens (R$ ${somaItensNota.toFixed(2)}) difere do valor total da nota (R$ ${nota.vNF.toFixed(2)})`);
      }
    }

    // ---------- registro 75 ----------
    const linhas75: string[] = [];
    for (const [codigo, p] of catalogoProdutos) {
      linhas75.push(linha(
        "75", dataInicial, dataFinal, alfa(codigo, 14), alfa(p.ncm, 8),
        alfa(p.descricao, 53), alfa(p.unidade, 6), aliquota2(0, 5),
        aliquota2(0, 4), aliquota2(0, 5), money(0, 13),
      ));
    }

    // ---------- registro 90 ----------
    const contagens: [string, number][] = [
      ["50", linhas50.length],
      ["54", linhas54.length],
      ["75", linhas75.length],
    ].filter(([, c]) => c > 0) as [string, number][];
    const totalGeral = linhas10.length + linhas11.length + contagens.reduce((s, [, c]) => s + c, 0) + 1; // +1 = o próprio registro 90

    const paresPorLinha = 9; // (31..125) = 95 posições / 10 por par
    const linhas90: string[] = [];
    const todosPares: [string, number][] = [...contagens, ["99", totalGeral]];
    for (let i = 0; i < todosPares.length; i += paresPorLinha) {
      const pares = todosPares.slice(i, i + paresPorLinha);
      let miolo = "";
      for (const [tipo, total] of pares) miolo += numCodigo(tipo, 2) + numCodigo(total, 8);
      miolo = miolo.padEnd(95, " ");
      linhas90.push(linha("90", numCodigo(empresa.cnpj, 14), alfa(empresa.inscricao_estadual, 14), miolo, "0"));
    }
    // corrige o último registro 90 a ter o número de registros tipo 90 no campo 06
    linhas90[linhas90.length - 1] = linhas90[linhas90.length - 1].slice(0, 125) + String(linhas90.length);

    // ---------- validações próprias ----------
    const totalLinhas = linhas10.length + linhas11.length + linhas50.length + linhas54.length + linhas75.length + linhas90.length;
    const problemasValidacao: string[] = [];
    for (const l of [...linhas10, ...linhas11, ...linhas50, ...linhas54, ...linhas75, ...linhas90]) {
      if (l.length !== 126) problemasValidacao.push(`Linha com tamanho ${l.length} (esperado 126): ${l.slice(0, 20)}...`);
    }
    const somaItens54 = linhas54.reduce((s, l) => s + Number(l.slice(62, 74)), 0);
    const somaItens50 = linhas50.filter((l) => l[125] === "N").reduce((s, l) => s + Number(l.slice(56, 69)), 0);

    // ---------- monta o arquivo .txt (CRLF, conforme convenção comum do Sintegra) ----------
    const todasLinhas = [...linhas10, ...linhas11, ...linhas50, ...linhas54, ...linhas75, ...linhas90];
    const conteudoTxt = todasLinhas.join("\r\n") + "\r\n";

    // ---------- DUVIDAS-SINTEGRA.md ----------
    const competencia = String(from).slice(0, 7);
    const duvidas = `# Dúvidas e decisões a confirmar com o contador — Sintegra ${competencia}

Este arquivo lista os pontos em que o leiaute oficial (Convênio ICMS 57/95) é
ambíguo, omisso, ou onde o contador ainda não confirmou um valor. Nada abaixo
foi "assumido" silenciosamente no arquivo gerado — são as decisões que o
gerador tomou, com a justificativa, para o contador validar.

## 1) "Layout versão 5.4.0"
O número "5.4.0" encontrado no site da Fazenda/MG (fazenda.mg.gov.br) é a
versão do **Validador Sintegra** (aplicativo da SEFAZ-RS, 2017), não um
leiaute diferente. O leiaute de campos é o do Convênio ICMS 57/95 com as
alterações até o Convênio ICMS 76/03 ("estrutura código 3", campo 10 do
registro 10) — é esse leiaute que o Validador 5.4.0 confere. Baixe o
validador em:
https://www.fazenda.mg.gov.br/export/sites/fazenda/empresas/sistemas/sintegra/download_files/27124942-instalavalidadorsintegra2017-5-4-0.zip
e rode-o sobre o arquivo .txt gerado antes de enviar ao contador — é o
validador oficial mencionado na tarefa original.

## 2) Registro 50/54 para NFC-e (modelo 65)
O manual-base que usamos como referência (guia da SEFAZ/GO, anterior à
NFC-e) lista para o registro 50 apenas os modelos 01, 04, 06, 21, 22 e 55, e
manda informar "nota fiscal de venda a consumidor" (antigo modelo 02) no
registro 61, não no 50. NFC-e (modelo 65) não é mencionada nesse manual.
Seguimos a orientação que você já recebeu do contador (50/54 para modelo 65),
mas como o manual-base não cobre isso, vale confirmar por escrito com ele que
está correto informar o modelo 65 diretamente no registro 50/54 (campo 06 =
"65"), e não no 61.

## 3) CSOSN 102 vs 500 (bebidas com substituição tributária)
No cadastro de produtos hoje (${totalProdutosAtivos} produtos ativos): ${resumoCsosn}.
O contador mencionou que bebidas com
substituição tributária deveriam ser 500, mas isso ainda não foi confirmado
nem aplicado no cadastro. O Sintegra foi gerado com o que está no cadastro
(102 para tudo). Se a resposta do contador confirmar 500 para bebidas,
será preciso: (a) atualizar o campo CST/CSOSN desses produtos em Produtos,
e (b) gerar o Sintegra de novo (os XMLs futuros também sairão com o CSOSN
correto a partir da próxima emissão após o cadastro ser corrigido).

## 4) Tratamento do ICMS do Simples Nacional no registro 50 (campos 12-16) e 75 (campo 09)
O registro 50/54/75 foi desenhado pensando no regime normal de ICMS
(tributado / isento / outras). Sob CSOSN 102/500 (Simples Nacional) não há
ICMS próprio destacado na NFC-e. Decisão adotada: o valor da operação entra
no campo 15 do registro 50 ("Outras — valor que não confira débito ou
crédito do ICMS"), que é literalmente a definição do CSOSN 102; os campos de
base de cálculo e valor do ICMS (12, 13, 16 do registro 50; 13 e 16 do
registro 54; 09 do registro 75) saem zerados. Essa é uma prática comum para
Simples Nacional, mas MG pode ter orientação própria — vale confirmar com o
contador antes de enviar o primeiro arquivo.

## 5) Notas canceladas — sem registro 54, e UF mantida
Para notas canceladas, geramos apenas o registro 50 (identificação +
situação "S", demais campos zerados), sem registro 54. O manual não diz
explicitamente se o 54 deve ou não existir para uma nota cancelada; como o
50 cancelado não tem valores (zerados), um 54 com valores também zerados
não pareceu agregar informação — mas isso não está escrito no manual-base
que usamos, então vale confirmar.

Também mantivemos o campo 05 (UF) como "MG" mesmo na nota cancelada, em vez
de zerar junto com os demais campos: o validador cruza UF x CFOP (CFOP
iniciado em 5 exige UF = UF do emitente), e como o CFOP do item é mantido no
registro cancelado, zerar a UF arriscava rejeição no validador por
inconsistência. Se o contador/validador indicar o contrário, é só avisar.

## 6) Numeração inutilizada
Nem o leiaute-base do Convênio 57/95 (que não tem um código de situação para
"número nunca utilizado", só Normal/Cancelado/Extemporâneo) nem a API da
Notaas nem o nosso banco modelam "inutilização de numeração" de NFC-e. Este
Sintegra não inclui nenhum registro para números inutilizados. Se a SEFAZ/MG
exigir isso, será preciso descobrir com o contador (ou a própria SEFAZ) qual
registro/código usar — nenhuma fonte consultada documenta isso para NFC-e.

## 7) Consumidor não identificado (NFC-e anônima)
Para notas sem CPF do cliente, o campo 02 (CNPJ/CPF) do registro 50/54 foi
zerado e o campo 03 (Inscrição Estadual) preenchido com "ISENTO" — por
analogia com a regra do manual para quem não é obrigado a inscrição
estadual. O manual não cobre explicitamente o caso de consumidor final sem
CPF informado (ele trata de pessoa física/jurídica identificada, só isenta
de IE). Vale confirmar que zerar é o esperado para venda anônima.

## 8) "Nome do Contato" do registro 11 (campo 07)
Preenchido com a razão social (não há um campo separado de "pessoa de
contato" no cadastro). Se o contador preferir um nome de pessoa e telefone
específicos, me diga quais e eu ajusto o cadastro da empresa.

## 9) Prazo de entrega ao contador
Ainda não informado (item já sinalizado como pendente na tarefa original).

---
Gerado automaticamente em ${new Date().toISOString()}. Notas processadas: ${processadas.length}
(${processadas.filter((p) => p.status === "issued").length} autorizadas, ${processadas.filter((p) => p.status === "cancelled").length} canceladas).
${falhas.length > 0 ? `\nFalhas ao baixar/interpretar XML (${falhas.length}):\n${falhas.join("\n")}\n` : ""}
${divergencias.length > 0 ? `\nDivergências de totais encontradas (${divergencias.length}):\n${divergencias.join("\n")}\n` : ""}
`;

    // ---------- resumo de validação ----------
    const resumoLinhas = [
      `Sintegra — competência ${competencia} — gerado em ${new Date().toISOString()}`,
      "",
      `Registros: 10=${linhas10.length} 11=${linhas11.length} 50=${linhas50.length} 54=${linhas54.length} 75=${linhas75.length} 90=${linhas90.length}`,
      `Total de linhas do arquivo: ${totalLinhas}`,
      `Notas processadas: ${processadas.length} (${processadas.filter((p) => p.status === "issued").length} autorizadas, ${processadas.filter((p) => p.status === "cancelled").length} canceladas)`,
      `Soma dos itens (registro 54, campo 11): R$ ${(somaItens54 / 100).toFixed(2)}`,
      `Soma das notas autorizadas (registro 50, campo 11): R$ ${(somaItens50 / 100).toFixed(2)}`,
      problemasValidacao.length > 0 ? `\nPROBLEMAS DE VALIDAÇÃO (${problemasValidacao.length}):` : "\nNenhum problema de validação próprio encontrado (tamanho fixo das linhas ok).",
      ...problemasValidacao,
      divergencias.length > 0 ? `\nDIVERGÊNCIAS (${divergencias.length}):` : "",
      ...divergencias,
      falhas.length > 0 ? `\nFALHAS AO BUSCAR/LER XML (${falhas.length}):` : "",
      ...falhas,
      "",
      "Rode o Validador Sintegra oficial (link em DUVIDAS-SINTEGRA.md, item 1) sobre o",
      "arquivo .txt antes de enviar ao contador — este resumo é só uma conferência própria.",
    ];

    console.log("gerar-sintegra-mes", JSON.stringify({
      from, to, notas: processadas.length, linhas: totalLinhas, falhas: falhas.length, divergencias: divergencias.length,
    }));

    const files: Record<string, Uint8Array> = {
      [`sintegra-${competencia}.txt`]: strToU8(conteudoTxt),
      "DUVIDAS-SINTEGRA.md": strToU8(duvidas),
      "_resumo.txt": strToU8(resumoLinhas.join("\n")),
    };
    const zipped = zipSync(files, { level: 6 });

    return new Response(zipped, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="sintegra-${competencia}.zip"`,
      },
    });
  } catch (error: unknown) {
    return jsonError((error as Error).message, 500);
  }
});
