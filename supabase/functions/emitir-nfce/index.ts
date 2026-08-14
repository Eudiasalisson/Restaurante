import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  NOTAAS_BASE_URL,
  notaasHeaders,
  validarItensFiscais,
  montarPayloadNfce,
  ComandaItemFiscal,
} from "../_shared/notaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) return json({ error: "Não autenticado" }, 401);

    const { data: callerProfile } = await supabaseAdmin.from("usuarios").select("ativo").eq("id", caller.id).single();
    if (!callerProfile?.ativo) return json({ error: "Usuário inativo" }, 403);

    const { comanda_id, entrega_id, identificar_cliente } = await req.json();
    if (!comanda_id && !entrega_id) return json({ error: "Informe comanda_id ou entrega_id" }, 400);

    // Bloqueia emissão duplicada: se já existe uma nota em andamento ou emitida, retorna ela.
    let existingQuery = supabaseAdmin.from("notas_fiscais").select("*").in("status", ["queued", "processing", "issued"]);
    existingQuery = comanda_id ? existingQuery.eq("comanda_id", comanda_id) : existingQuery.eq("entrega_id", entrega_id);
    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) return json({ notaFiscal: existing, message: "Já existe uma NFC-e emitida ou em processamento para esta venda." }, 200);

    // Carrega itens + dados fiscais do produto
    const itensTable = comanda_id ? "comanda_itens" : "entrega_itens";
    const refColumn = comanda_id ? "comanda_id" : "entrega_id";
    const refId = comanda_id || entrega_id;

    const { data: itensRaw, error: itensError } = await supabaseAdmin
      .from(itensTable)
      .select("quantidade, preco_unitario, produtos(nome, ncm, cfop, cst_csosn, unidade, aliquota_icms)")
      .eq(refColumn, refId)
      .neq("status", "cancelado");
    if (itensError) return json({ error: "Erro ao buscar itens da venda" }, 500);
    if (!itensRaw || itensRaw.length === 0) return json({ error: "Venda sem itens ativos" }, 400);

    const itens: ComandaItemFiscal[] = itensRaw.map((i: any) => ({
      nome: i.produtos?.nome || "Item",
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
      ncm: i.produtos?.ncm ?? null,
      cfop: i.produtos?.cfop ?? null,
      cst_csosn: i.produtos?.cst_csosn ?? null,
      unidade: i.produtos?.unidade ?? null,
      aliquota_icms: i.produtos?.aliquota_icms ?? null,
    }));

    const validationError = validarItensFiscais(itens);
    if (validationError) return json({ error: validationError }, 422);

    const { data: pagamentos } = await supabaseAdmin
      .from("pagamentos")
      .select("forma, valor")
      .eq(refColumn, refId);

    const totalItens = itens.reduce((sum, item) => sum + item.preco_unitario * item.quantidade, 0);
    const totalPagamentos = (pagamentos || []).reduce((sum, p) => sum + p.valor, 0);
    if (totalPagamentos < totalItens - 0.01) {
      return json({ error: "A venda ainda não está totalmente paga. Registre o pagamento antes de emitir a NFC-e." }, 422);
    }

    // CPF do cliente: só é buscado/enviado quando o operador pediu emissão identificada.
    // Na emissão anônima, o dest nunca é preenchido, mesmo que o cliente vinculado já tenha CPF.
    let clienteCpf: string | null = null;
    let clienteNome: string | null = null;
    if (identificar_cliente) {
      const refTable = comanda_id ? "comandas" : "entregas";
      const { data: venda } = await supabaseAdmin.from(refTable).select("cliente_id").eq("id", refId).single();
      if (venda?.cliente_id) {
        const { data: cliente } = await supabaseAdmin.from("clientes").select("nome, cpf").eq("id", venda.cliente_id).single();
        if (cliente?.cpf) { clienteCpf = cliente.cpf.replace(/\D/g, ""); clienteNome = cliente.nome; }
      }
      if (!clienteCpf) {
        return json({ error: "Cliente sem CPF cadastrado para emissão identificada." }, 422);
      }
    }

    const { data: empresa } = await supabaseAdmin.from("empresas").select("nfce_ambiente").limit(1).single();

    const { data: notaFiscal, error: insertError } = await supabaseAdmin
      .from("notas_fiscais")
      .insert({
        comanda_id: comanda_id || null,
        entrega_id: entrega_id || null,
        ambiente: empresa?.nfce_ambiente || "homologacao",
        status: "queued",
        criada_por: caller.id,
        valor_total: Number(totalItens.toFixed(2)),
      })
      .select("*")
      .single();
    if (insertError || !notaFiscal) return json({ error: "Erro ao registrar a nota fiscal" }, 500);

    const payload = montarPayloadNfce({
      itens,
      pagamentos: pagamentos || [],
      clienteCpf,
      clienteNome,
      ambiente: notaFiscal.ambiente,
    });

    try {
      const resp = await fetch(`${NOTAAS_BASE_URL}/nfe/emitir`, {
        method: "POST",
        headers: notaasHeaders({ "Idempotency-Key": notaFiscal.id }),
        body: JSON.stringify(payload),
      });
      const rawText = await resp.text();
      let respBody: any = {};
      try { respBody = rawText ? JSON.parse(rawText) : {}; } catch { /* corpo não é JSON */ }
      console.log("Notaas /nfe/emitir response", resp.status, rawText);

      if (!resp.ok) {
        const erro_mensagem = respBody?.error?.message || respBody?.message || rawText || `Erro ${resp.status} na Notaas`;
        await supabaseAdmin.from("notas_fiscais").update({ status: "error", erro_mensagem }).eq("id", notaFiscal.id);
        return json({ error: erro_mensagem }, 502);
      }

      const invoiceId = respBody.invoiceId || respBody.id;
      const { data: updated } = await supabaseAdmin
        .from("notas_fiscais")
        .update({ status: "processing", invoice_id: invoiceId })
        .eq("id", notaFiscal.id)
        .select("*")
        .single();

      return json({ notaFiscal: updated });
    } catch (fetchError: unknown) {
      const erro_mensagem = `Falha de comunicação com a Notaas: ${(fetchError as Error).message}`;
      await supabaseAdmin.from("notas_fiscais").update({ status: "error", erro_mensagem }).eq("id", notaFiscal.id);
      return json({ error: erro_mensagem }, 502);
    }
  } catch (error: unknown) {
    return json({ error: (error as Error).message }, 500);
  }
});
