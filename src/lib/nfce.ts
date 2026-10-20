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

// Baixa o .zip com os XMLs de NFC-e autorizadas/canceladas do período (para
// entrega mensal ao contador). A Notaas não tem exportação em lote — a function
// busca XML nota a nota usando os dados já salvos no nosso banco.
export async function exportarXmlsMes(fromIso: string, toIso: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exportar-xmls-mes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token}`,
    },
    body: JSON.stringify({ from: fromIso, to: toIso }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao exportar os XMLs do período');
  }
  const blob = await resp.blob();
  const disposition = resp.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const fileName = match?.[1] || `xmls-${fromIso.slice(0, 7)}.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Gera o Sintegra do período (registros 10/11/50/54/75/90) e baixa um .zip com
// o .txt, o DUVIDAS-SINTEGRA.md (pontos a confirmar com o contador) e um
// _resumo.txt de conferência própria.
export async function gerarSintegraMes(fromIso: string, toIso: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-sintegra-mes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token}`,
    },
    body: JSON.stringify({ from: fromIso, to: toIso }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao gerar o Sintegra do período');
  }
  const blob = await resp.blob();
  const disposition = resp.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const fileName = match?.[1] || `sintegra-${fromIso.slice(0, 7)}.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Baixa o relatório de vendas (.xlsx) do período, com 3 abas: todas as vendas,
// vendas sem nota autorizada e notas emitidas sem venda correspondente — para
// o contador conferir vendas x notas no fechamento mensal.
export async function baixarRelatorioVendasMes(fromIso: string, toIso: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/relatorio-vendas-mes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token}`,
    },
    body: JSON.stringify({ from: fromIso, to: toIso }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ao gerar o relatório de vendas do período');
  }
  const blob = await resp.blob();
  const disposition = resp.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const fileName = match?.[1] || `vendas-${fromIso.slice(0, 7)}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
