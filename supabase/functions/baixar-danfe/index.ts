import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, NOTAAS_BASE_URL, notaasHeaders } from "../_shared/notaas.ts";

// Proxy autenticado para o PDF do DANFE: a URL da Notaas exige o header x-api-key,
// que o navegador não consegue enviar num link direto. Esta function busca o PDF
// no servidor (com a chave) e devolve os bytes prontos para o navegador.
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

    const { nota_fiscal_id } = await req.json();
    if (!nota_fiscal_id) return jsonError("Informe nota_fiscal_id", 400);

    const { data: notaFiscal } = await supabaseAdmin
      .from("notas_fiscais")
      .select("invoice_id")
      .eq("id", nota_fiscal_id)
      .single();
    if (!notaFiscal?.invoice_id) return jsonError("NFC-e sem invoice_id associado", 404);

    const resp = await fetch(`${NOTAAS_BASE_URL}/nfe/invoices/${notaFiscal.invoice_id}/danfe`, {
      headers: notaasHeaders(),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return jsonError(text || `Erro ${resp.status} ao baixar o DANFE`, 502);
    }

    const pdfBuffer = await resp.arrayBuffer();
    return new Response(pdfBuffer, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/pdf" },
    });
  } catch (error: unknown) {
    return jsonError((error as Error).message, 500);
  }
});
