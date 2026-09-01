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
  // A aba tem que ser aberta de forma síncrona, ainda dentro do gesto de clique.
  // Se abrir só depois do await do fetch, o navegador bloqueia como popup e
  // "não acontece nada". Abrimos em branco agora e redirecionamos ao ter o PDF.
  const janela = window.open('', '_blank');

  try {
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
    // Garante o tipo application/pdf mesmo que a resposta venha sem ele — sem
    // isso o navegador tende a baixar o arquivo em vez de exibir na aba.
    const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);

    if (janela && !janela.closed) {
      janela.location.href = url;
    } else {
      // Popup bloqueado: um link com target=_blank costuma ser permitido
      // pelos bloqueadores (ao contrário de window.open). Sem `download`,
      // o navegador abre o PDF numa nova aba em vez de salvar.
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    janela?.close();
    throw e;
  }
}
