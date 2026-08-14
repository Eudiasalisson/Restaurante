import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/notaas.ts";

// Endpoint público chamado pela Notaas (não usa o Supabase Auth — precisa ser
// implantado com verificação de JWT desativada: `supabase functions deploy
// notaas-webhook --no-verify-jwt`, ou desative "Verify JWT" nas configurações
// da função no painel do Supabase). A autenticidade é garantida pela
// assinatura HMAC-SHA256 no header X-Notaas-Signature.
// Configure esta URL como webhook de NF-e/NFC-e no painel da Notaas.

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const rawBody = await req.text();

    const webhookSecret = Deno.env.get("NOTAAS_WEBHOOK_SECRET");
    if (webhookSecret) {
      const signature = req.headers.get("X-Notaas-Signature") || "";
      const expected = await hmacHex(webhookSecret, rawBody);
      if (!signature || !timingSafeEqual(signature, expected)) {
        return json({ error: "Assinatura inválida" }, 401);
      }
    }

    const payload = JSON.parse(rawBody);
    const event: string = payload.event || "";
    const data = payload.data || {};
    const invoiceId: string | undefined = data.invoiceId;
    if (!invoiceId) return json({ error: "Payload sem invoiceId" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: notaFiscal } = await supabaseAdmin
      .from("notas_fiscais")
      .select("id")
      .eq("invoice_id", invoiceId)
      .maybeSingle();
    if (!notaFiscal) return json({ error: "NFC-e não encontrada para este invoiceId" }, 404);

    let status: string | null = null;
    if (event.endsWith(".issued")) status = "issued";
    else if (event.endsWith(".error")) status = "error";
    else if (event.endsWith(".cancelled")) status = "cancelled";

    await supabaseAdmin
      .from("notas_fiscais")
      .update({
        ...(status ? { status } : {}),
        chave_acesso: data.chaveAcesso ?? undefined,
        protocolo: data.nProt ?? undefined,
        cstat: data.cStat ?? undefined,
        xmotivo: data.xMotivo ?? undefined,
        pdf_url: data.pdfUrl ?? undefined,
        xml_url: data.xmlUrl ?? undefined,
        erro_mensagem: status === "error" ? (data.xMotivo || "Rejeitada pela Sefaz") : undefined,
      })
      .eq("id", notaFiscal.id);

    return json({ ok: true });
  } catch (error: unknown) {
    return json({ error: (error as Error).message }, 500);
  }
});
