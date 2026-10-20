import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { corsHeaders } from "../_shared/notaas.ts";

// Gera um .xlsx com as vendas (comandas fechadas + entregas entregues) do
// período, cruzadas com as notas fiscais emitidas, para o contador conferir
// vendas x notas no fechamento mensal. Fonte: nosso próprio banco (não a
// Notaas) — por isso não tem rate limit nem depende de retry de rede.

const FORMA_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao_credito: "C. Crédito",
  cartao_debito: "C. Débito",
  pix: "PIX",
  consumo_funcionario: "Consumo Funcionário",
  outro: "Outro",
};

const STATUS_NOTA_LABEL: Record<string, string> = {
  issued: "Emitida",
  processing: "Processando na Sefaz",
  error: "Rejeitada / Erro",
  cancelled: "Cancelada",
};

const PRIORIDADE_STATUS: Record<string, number> = {
  issued: 4,
  cancelled: 3,
  processing: 2,
  error: 1,
};

type Nota = {
  id: string;
  comanda_id: string | null;
  entrega_id: string | null;
  status: string;
  numero: string | null;
  chave_acesso: string | null;
  valor_total: number | null;
  created_at: string;
};

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

// Supabase-js manda .in() como query string — com muitos ids isso pode passar
// do limite de tamanho da URL. Quebra em lotes.
async function fetchInChunks<T>(
  ids: string[],
  chunkSize: number,
  build: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const { data, error } = await build(chunk);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
  }
  return out;
}

function escolherMelhorNota(notas: Nota[]): Nota | null {
  let melhor: Nota | null = null;
  for (const n of notas) {
    if (!melhor) { melhor = n; continue; }
    const pN = PRIORIDADE_STATUS[n.status] ?? 0;
    const pMelhor = PRIORIDADE_STATUS[melhor.status] ?? 0;
    if (pN > pMelhor || (pN === pMelhor && n.created_at > melhor.created_at)) melhor = n;
  }
  return melhor;
}

function aoz(v: string | number | null | undefined): string | number {
  return v === null || v === undefined ? "" : v;
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
    const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Não autenticado", 401);
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) return jsonError("Não autenticado", 401);
    const { data: callerProfile } = await supabaseAdmin.from("usuarios").select("ativo").eq("id", caller.id).single();
    if (!callerProfile?.ativo) return jsonError("Usuário inativo", 403);

    const { from, to } = await req.json();
    if (!from || !to) return jsonError("Informe from e to (ISO 8601)", 400);

    // 1) Vendas do período: comandas fechadas (por closed_at) + entregas entregues (por opened_at).
    const comandas = await fetchAll<{ id: string; numero: number; closed_at: string }>((f, t) =>
      supabaseAdmin.from("comandas").select("id, numero, closed_at").eq("status", "fechada")
        .gte("closed_at", from).lt("closed_at", to).order("closed_at", { ascending: true }).range(f, t));

    const entregas = await fetchAll<{ id: string; numero: number; opened_at: string }>((f, t) =>
      supabaseAdmin.from("entregas").select("id, numero, opened_at").eq("status", "entregue")
        .gte("opened_at", from).lt("opened_at", to).order("opened_at", { ascending: true }).range(f, t));

    const comandaIds = comandas.map((c) => c.id);
    const entregaIds = entregas.map((e) => e.id);

    // 2) Pagamentos das vendas acima (pode haver mais de um por venda — pagamento dividido).
    const pagamentosComanda = await fetchInChunks<{ comanda_id: string; forma: string; valor: number }>(
      comandaIds, 150,
      (chunk) => supabaseAdmin.from("pagamentos").select("comanda_id, forma, valor").in("comanda_id", chunk),
    );
    const pagamentosEntrega = await fetchInChunks<{ entrega_id: string; forma: string; valor: number }>(
      entregaIds, 150,
      (chunk) => supabaseAdmin.from("pagamentos").select("entrega_id, forma, valor").in("entrega_id", chunk),
    );

    const pagamentosPorComanda = new Map<string, { valor: number; formas: Set<string> }>();
    for (const p of pagamentosComanda) {
      const acc = pagamentosPorComanda.get(p.comanda_id) || { valor: 0, formas: new Set<string>() };
      acc.valor += Number(p.valor) || 0;
      if (p.forma) acc.formas.add(p.forma);
      pagamentosPorComanda.set(p.comanda_id, acc);
    }
    const pagamentosPorEntrega = new Map<string, { valor: number; formas: Set<string> }>();
    for (const p of pagamentosEntrega) {
      const acc = pagamentosPorEntrega.get(p.entrega_id) || { valor: 0, formas: new Set<string>() };
      acc.valor += Number(p.valor) || 0;
      if (p.forma) acc.formas.add(p.forma);
      pagamentosPorEntrega.set(p.entrega_id, acc);
    }

    // 3) Notas fiscais ligadas a essas vendas (pelo id da venda, não pela data da nota —
    // a nota pode ter sido emitida um pouco depois do fechamento da comanda/entrega).
    const notasDeComandas = await fetchInChunks<Nota>(comandaIds, 150, (chunk) =>
      supabaseAdmin.from("notas_fiscais").select("id, comanda_id, entrega_id, status, numero, chave_acesso, valor_total, created_at").in("comanda_id", chunk));
    const notasDeEntregas = await fetchInChunks<Nota>(entregaIds, 150, (chunk) =>
      supabaseAdmin.from("notas_fiscais").select("id, comanda_id, entrega_id, status, numero, chave_acesso, valor_total, created_at").in("entrega_id", chunk));

    const notasPorComanda = new Map<string, Nota[]>();
    for (const n of notasDeComandas) {
      if (!n.comanda_id) continue;
      const arr = notasPorComanda.get(n.comanda_id) || [];
      arr.push(n);
      notasPorComanda.set(n.comanda_id, arr);
    }
    const notasPorEntrega = new Map<string, Nota[]>();
    for (const n of notasDeEntregas) {
      if (!n.entrega_id) continue;
      const arr = notasPorEntrega.get(n.entrega_id) || [];
      arr.push(n);
      notasPorEntrega.set(n.entrega_id, arr);
    }

    // 4) Linhas da aba 1 (todas as vendas do período).
    type Linha = {
      dataHora: string; numeroVenda: string; valor: number; formaPagamento: string;
      numeroNfce: string; chaveAcesso: string; statusNota: string; statusNotaRaw: string | null;
    };
    const linhasVendas: Linha[] = [];

    for (const c of comandas) {
      const pag = pagamentosPorComanda.get(c.id);
      const nota = escolherMelhorNota(notasPorComanda.get(c.id) || []);
      linhasVendas.push({
        dataHora: c.closed_at,
        numeroVenda: `Comanda #${c.numero}`,
        valor: pag?.valor ?? 0,
        formaPagamento: pag ? [...pag.formas].map((f) => FORMA_LABEL[f] || f).join(" + ") || "—" : "—",
        numeroNfce: nota?.numero || "",
        chaveAcesso: nota?.chave_acesso || "",
        statusNota: nota ? (STATUS_NOTA_LABEL[nota.status] || nota.status) : "Sem nota emitida",
        statusNotaRaw: nota?.status ?? null,
      });
    }
    for (const e of entregas) {
      const pag = pagamentosPorEntrega.get(e.id);
      const nota = escolherMelhorNota(notasPorEntrega.get(e.id) || []);
      linhasVendas.push({
        dataHora: e.opened_at,
        numeroVenda: `Entrega #${e.numero}`,
        valor: pag?.valor ?? 0,
        formaPagamento: pag ? [...pag.formas].map((f) => FORMA_LABEL[f] || f).join(" + ") || "—" : "—",
        numeroNfce: nota?.numero || "",
        chaveAcesso: nota?.chave_acesso || "",
        statusNota: nota ? (STATUS_NOTA_LABEL[nota.status] || nota.status) : "Sem nota emitida",
        statusNotaRaw: nota?.status ?? null,
      });
    }
    linhasVendas.sort((a, b) => a.dataHora.localeCompare(b.dataHora));

    // 5) Aba 2: vendas sem nota emitida, ou com nota pendente/rejeitada.
    const linhasSemNota = linhasVendas.filter(
      (l) => l.statusNotaRaw === null || l.statusNotaRaw === "error" || l.statusNotaRaw === "processing",
    );

    // 6) Aba 3: notas emitidas no período cuja venda não está no conjunto acima
    // (ex.: comanda/entrega cancelada ou ainda aberta na hora da nota).
    const vendaIdsNoPeriodo = new Set([...comandaIds, ...entregaIds]);
    const notasEmitidasPeriodo = await fetchAll<Nota>((f, t) =>
      supabaseAdmin.from("notas_fiscais").select("id, comanda_id, entrega_id, status, numero, chave_acesso, valor_total, created_at")
        .eq("status", "issued").gte("created_at", from).lt("created_at", to).order("created_at", { ascending: true }).range(f, t));

    const notasOrfas = notasEmitidasPeriodo.filter((n) => {
      const vendaId = n.comanda_id || n.entrega_id;
      return !vendaId || !vendaIdsNoPeriodo.has(vendaId);
    });

    // Para exibir algo útil na aba 3, busca o número/status atual da venda (se existir).
    const orfaComandaIds = [...new Set(notasOrfas.map((n) => n.comanda_id).filter((x): x is string => !!x))];
    const orfaEntregaIds = [...new Set(notasOrfas.map((n) => n.entrega_id).filter((x): x is string => !!x))];
    const comandasOrfas = await fetchInChunks<{ id: string; numero: number; status: string }>(orfaComandaIds, 150, (chunk) =>
      supabaseAdmin.from("comandas").select("id, numero, status").in("id", chunk));
    const entregasOrfas = await fetchInChunks<{ id: string; numero: number; status: string }>(orfaEntregaIds, 150, (chunk) =>
      supabaseAdmin.from("entregas").select("id, numero, status").in("id", chunk));
    const comandaOrfaMap = new Map(comandasOrfas.map((c) => [c.id, c]));
    const entregaOrfaMap = new Map(entregasOrfas.map((e) => [e.id, e]));

    const linhasNotasSemVenda = notasOrfas.map((n) => {
      let descricaoVenda = "— (venda não encontrada)";
      if (n.comanda_id) {
        const c = comandaOrfaMap.get(n.comanda_id);
        descricaoVenda = c ? `Comanda #${c.numero} (status: ${c.status})` : "Comanda não encontrada";
      } else if (n.entrega_id) {
        const e = entregaOrfaMap.get(n.entrega_id);
        descricaoVenda = e ? `Entrega #${e.numero} (status: ${e.status})` : "Entrega não encontrada";
      }
      return {
        dataHora: n.created_at,
        numeroVenda: descricaoVenda,
        valor: Number(n.valor_total) || 0,
        formaPagamento: "—",
        numeroNfce: n.numero || "",
        chaveAcesso: n.chave_acesso || "",
        statusNota: STATUS_NOTA_LABEL[n.status] || n.status,
        statusNotaRaw: n.status,
      };
    });

    // 7) Totais / conferência.
    const totalVendas = linhasVendas.reduce((s, l) => s + l.valor, 0);
    // Soma o valor_total das notas "issued" (tanto as ligadas a vendas quanto as órfãs).
    const totalIssuedVendas = [...notasPorComanda.values(), ...notasPorEntrega.values()]
      .flat()
      .filter((n) => n.status === "issued");
    const idsIssuedJaContados = new Set(totalIssuedVendas.map((n) => n.id));
    const somaIssuedVendas = totalIssuedVendas.reduce((s, n) => s + (Number(n.valor_total) || 0), 0);
    const somaIssuedOrfas = notasOrfas.filter((n) => !idsIssuedJaContados.has(n.id)).reduce((s, n) => s + (Number(n.valor_total) || 0), 0);
    const totalNotasAutorizadas = somaIssuedVendas + somaIssuedOrfas;
    const diferenca = totalVendas - totalNotasAutorizadas;

    // 8) Monta o workbook.
    const wb = XLSX.utils.book_new();
    const colunas = ["Data/Hora", "Número da venda", "Valor (R$)", "Forma de pagamento", "Número da NFC-e", "Chave de acesso", "Status da nota"];

    const linhasParaAoa = (linhas: typeof linhasVendas) => [
      colunas,
      ...linhas.map((l) => [
        new Date(l.dataHora).toLocaleString("pt-BR"),
        l.numeroVenda,
        Number(l.valor.toFixed(2)),
        l.formaPagamento,
        aoz(l.numeroNfce),
        aoz(l.chaveAcesso),
        l.statusNota,
      ]),
    ];

    const aoaVendas = linhasParaAoa(linhasVendas);
    aoaVendas.push([]);
    aoaVendas.push(["", "Total de vendas no período", Number(totalVendas.toFixed(2)), "", "", "", ""]);
    aoaVendas.push(["", "Total de notas autorizadas (emitidas)", Number(totalNotasAutorizadas.toFixed(2)), "", "", "", ""]);
    aoaVendas.push(["", diferenca === 0 ? "Diferença (confere)" : "⚠ DIVERGÊNCIA — diferença", Number(diferenca.toFixed(2)), "", "", "", ""]);
    const wsVendas = XLSX.utils.aoa_to_sheet(aoaVendas);
    wsVendas["!cols"] = [{ wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 46 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsVendas, "Vendas do período");

    const aoaSemNota = linhasParaAoa(linhasSemNota);
    aoaSemNota.push([]);
    aoaSemNota.push(["", "Total sem nota autorizada", Number(linhasSemNota.reduce((s, l) => s + l.valor, 0).toFixed(2)), "", "", "", ""]);
    const wsSemNota = XLSX.utils.aoa_to_sheet(aoaSemNota);
    wsSemNota["!cols"] = wsVendas["!cols"];
    XLSX.utils.book_append_sheet(wb, wsSemNota, "Vendas sem nota");

    const aoaOrfas = linhasParaAoa(linhasNotasSemVenda);
    aoaOrfas.push([]);
    aoaOrfas.push(["", "Total de notas sem venda", Number(linhasNotasSemVenda.reduce((s, l) => s + l.valor, 0).toFixed(2)), "", "", "", ""]);
    const wsOrfas = XLSX.utils.aoa_to_sheet(aoaOrfas);
    wsOrfas["!cols"] = wsVendas["!cols"];
    XLSX.utils.book_append_sheet(wb, wsOrfas, "Notas sem venda");

    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    console.log("relatorio-vendas-mes", JSON.stringify({
      from, to,
      vendas: linhasVendas.length, semNota: linhasSemNota.length, notasSemVenda: linhasNotasSemVenda.length,
      totalVendas, totalNotasAutorizadas, diferenca,
    }));

    const competencia = String(from).slice(0, 7);
    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="vendas-${competencia}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    return jsonError((error as Error).message, 500);
  }
});
