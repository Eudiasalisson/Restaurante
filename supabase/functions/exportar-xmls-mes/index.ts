import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";
import { corsHeaders, NOTAAS_BASE_URL, notaasHeaders } from "../_shared/notaas.ts";

// Exporta, para um período, um .zip com os XMLs de todas as NFC-e autorizadas e
// canceladas. A Notaas não oferece exportação em lote (confirmado com o suporte
// deles) — só GET /nfe/invoices/{id}/xml, nota a nota. Por isso percorremos as
// notas registradas no nosso banco (já temos invoice_id, status e datas) e
// buscamos cada XML individualmente, com retry.
//
// "Inutilizadas": não geramos essa pasta. A Notaas não expõe esse conceito pela
// API (a numeração é 100% gerida por eles) e nosso banco não tem esse status.
// Ver DUVIDAS-SINTEGRA.md.

async function fetchXmlComRetry(
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

function sanitizeFileName(s: string): string {
  return s.replace(/[^\w.-]+/g, "-");
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

    const { data: notas, error: notasError } = await supabaseAdmin
      .from("notas_fiscais")
      .select("id, numero, chave_acesso, invoice_id, status, comanda_id, entrega_id, created_at")
      .gte("created_at", from)
      .lt("created_at", to)
      .in("status", ["issued", "cancelled"])
      .order("created_at", { ascending: true });
    if (notasError) return jsonError(`Erro ao buscar notas: ${notasError.message}`, 500);

    const { count: rejeitadasCount } = await supabaseAdmin
      .from("notas_fiscais")
      .select("id", { count: "exact", head: true })
      .gte("created_at", from)
      .lt("created_at", to)
      .eq("status", "error");

    const autorizadas = (notas || []).filter((n) => n.status === "issued");
    const canceladas = (notas || []).filter((n) => n.status === "cancelled");

    const files: Record<string, Uint8Array> = {};
    const falhas: string[] = [];
    const nomeArquivo = (n: any) => sanitizeFileName(`${n.numero || n.id}-${n.chave_acesso || n.invoice_id}`);

    for (const n of autorizadas) {
      if (!n.invoice_id) { falhas.push(`[autorizada] ${nomeArquivo(n)}: sem invoice_id`); continue; }
      const r = await fetchXmlComRetry(n.invoice_id);
      if (r.ok) files[`autorizadas/${nomeArquivo(n)}.xml`] = strToU8(r.xml);
      else falhas.push(`[autorizada] ${nomeArquivo(n)}: ${r.error}`);
      await new Promise((res) => setTimeout(res, 120));
    }

    for (const n of canceladas) {
      if (!n.invoice_id) { falhas.push(`[cancelada] ${nomeArquivo(n)}: sem invoice_id`); continue; }
      const emissao = await fetchXmlComRetry(n.invoice_id);
      if (emissao.ok) files[`canceladas/${nomeArquivo(n)}.xml`] = strToU8(emissao.xml);
      else falhas.push(`[cancelada/emissao] ${nomeArquivo(n)}: ${emissao.error}`);
      await new Promise((res) => setTimeout(res, 120));

      const cancelamento = await fetchXmlComRetry(n.invoice_id, "cancel");
      if (cancelamento.ok) files[`canceladas/${nomeArquivo(n)}-evento-cancelamento.xml`] = strToU8(cancelamento.xml);
      else falhas.push(`[cancelada/evento] ${nomeArquivo(n)}: ${cancelamento.error}`);
      await new Promise((res) => setTimeout(res, 120));
    }

    const resumoLinhas = [
      `Exportação de XMLs — período ${from} a ${to}`,
      `Gerado em ${new Date().toISOString()}`,
      "",
      `Autorizadas: ${autorizadas.length}`,
      `Canceladas: ${canceladas.length} (pasta canceladas/ traz emissão + evento de cancelamento, quando disponíveis)`,
      `Inutilizadas: não aplicável nesta exportação — ver DUVIDAS-SINTEGRA.md`,
      `Rejeitadas/erro no período (fora do zip, nunca foram documento fiscal válido): ${rejeitadasCount ?? 0}`,
      "",
      falhas.length > 0 ? `FALHAS (${falhas.length}):` : "Sem falhas no download.",
      ...falhas,
    ];
    files["_resumo.txt"] = strToU8(resumoLinhas.join("\n"));

    const zipped = zipSync(files, { level: 6 });

    console.log("exportar-xmls-mes", JSON.stringify({
      from, to, autorizadas: autorizadas.length, canceladas: canceladas.length,
      rejeitadas: rejeitadasCount ?? 0, falhas: falhas.length,
    }));

    const competencia = String(from).slice(0, 7);
    return new Response(zipped, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="xmls-${competencia}.zip"`,
      },
    });
  } catch (error: unknown) {
    return jsonError((error as Error).message, 500);
  }
});
