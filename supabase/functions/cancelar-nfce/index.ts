import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, NOTAAS_BASE_URL, notaasHeaders } from "../_shared/notaas.ts";

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

    const { nota_fiscal_id, motivo } = await req.json();
    if (!nota_fiscal_id) return json({ error: "Informe nota_fiscal_id" }, 400);
    if (!motivo || motivo.trim().length < 15) {
      return json({ error: "Informe um motivo de cancelamento com pelo menos 15 caracteres" }, 400);
    }

    const { data: notaFiscal } = await supabaseAdmin.from("notas_fiscais").select("*").eq("id", nota_fiscal_id).single();
    if (!notaFiscal) return json({ error: "NFC-e não encontrada" }, 404);
    if (notaFiscal.status !== "issued") return json({ error: "Apenas uma NFC-e emitida pode ser cancelada" }, 400);

    const resp = await fetch(`${NOTAAS_BASE_URL}/nfe/cancelar`, {
      method: "POST",
      headers: notaasHeaders(),
      body: JSON.stringify({ invoiceId: notaFiscal.invoice_id, motivo }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) return json({ error: body?.error?.message || "Erro ao cancelar a NFC-e na Notaas" }, 502);

    const { data: updated } = await supabaseAdmin
      .from("notas_fiscais")
      .update({ status: "cancelled", motivo_cancelamento: motivo })
      .eq("id", nota_fiscal_id)
      .select("*")
      .single();

    return json({ notaFiscal: updated });
  } catch (error: unknown) {
    return json({ error: (error as Error).message }, 500);
  }
});
