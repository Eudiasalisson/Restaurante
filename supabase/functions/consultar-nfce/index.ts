import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, NOTAAS_BASE_URL, notaasHeaders } from "../_shared/notaas.ts";

// Fallback manual para o webhook: consulta o status atual na Notaas e atualiza o registro local.
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

    const { nota_fiscal_id } = await req.json();
    if (!nota_fiscal_id) return json({ error: "Informe nota_fiscal_id" }, 400);

    const { data: notaFiscal } = await supabaseAdmin.from("notas_fiscais").select("*").eq("id", nota_fiscal_id).single();
    if (!notaFiscal) return json({ error: "NFC-e não encontrada" }, 404);
    if (!notaFiscal.invoice_id) return json({ notaFiscal });

    const resp = await fetch(`${NOTAAS_BASE_URL}/nfe/invoices/${notaFiscal.invoice_id}/status`, {
      headers: notaasHeaders(),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) return json({ error: body?.error?.message || "Erro ao consultar status na Notaas" }, 502);

    const statusMap: Record<string, string> = {
      issued: "issued", queued: "queued", processing: "processing", error: "error", cancelled: "cancelled",
    };
    const novoStatus = statusMap[body.status] || notaFiscal.status;

    const { data: updated } = await supabaseAdmin
      .from("notas_fiscais")
      .update({
        status: novoStatus,
        numero: body.nNf ?? notaFiscal.numero,
        chave_acesso: body.chaveAcesso ?? notaFiscal.chave_acesso,
        protocolo: body.nProt ?? notaFiscal.protocolo,
        cstat: body.cStat ?? notaFiscal.cstat,
        xmotivo: body.xMotivo ?? notaFiscal.xmotivo,
        pdf_url: body.pdfUrl ?? notaFiscal.pdf_url,
        xml_url: body.xmlUrl ?? notaFiscal.xml_url,
        erro_mensagem: novoStatus === "error" ? (body.xMotivo || notaFiscal.erro_mensagem) : notaFiscal.erro_mensagem,
      })
      .eq("id", nota_fiscal_id)
      .select("*")
      .single();

    return json({ notaFiscal: updated });
  } catch (error: unknown) {
    return json({ error: (error as Error).message }, 500);
  }
});
