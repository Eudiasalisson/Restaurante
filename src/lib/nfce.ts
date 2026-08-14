import { supabase } from '@/integrations/supabase/client';

export type NotaFiscalStatus = 'queued' | 'processing' | 'issued' | 'error' | 'cancelled';

export const NOTA_FISCAL_STATUS_CONFIG: Record<NotaFiscalStatus, { label: string; className: string }> = {
  queued: { label: 'Na fila', className: 'bg-warning/20 text-warning border-warning/30' },
  processing: { label: 'Processando na Sefaz', className: 'bg-primary/20 text-primary border-primary/30' },
  issued: { label: 'Emitida', className: 'bg-success/20 text-success border-success/30' },
  error: { label: 'Rejeitada / Erro', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  cancelled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground border-muted' },
};

// Baixa o PDF do DANFE via function (a URL da Notaas exige o header x-api-key,
// que só a function pode enviar) e abre numa nova aba do navegador.
export async function baixarDanfe(notaFiscalId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baixar-danfe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token}`,
    },
    body: JSON.stringify({ nota_fiscal_id: notaFiscalId }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao baixar o DANFE');
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
