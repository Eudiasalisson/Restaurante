import jsPDF from 'jspdf';
import { pdfSep, addLogoPdf } from '@/lib/pdfUtils';

interface EmpresaInfo {
  nome?: string;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  logo_url?: string | null;
}

interface CupomComandaParams {
  mesaNumero: number | null;
  garcomNome: string | null;
  clienteNome: string | null;
  openedAt: string | null;
  itens: { quantidade: number; produtos: { nome: string } | null; observacao: string | null; preco_unitario: number }[];
  subtotal: number;
  taxaServicoAtiva: boolean;
  taxaServicoValor: number;
  taxaServico: number;
  desconto: number;
  acrescimo: number;
  total: number;
  pagamentos: { forma: string; valor: number; created_at: string | null }[];
  empresa?: EmpresaInfo;
}

const formaLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'C. Crédito', cartao_debito: 'C. Débito', pix: 'PIX', outro: 'Outro',
};

export async function gerarCupomComanda(params: CupomComandaParams): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [80, 300] });
  const w = 80;
  let y = 8;
  const lh = 4.5;

  if (params.empresa?.logo_url) {
    y = await addLogoPdf(doc, params.empresa.logo_url, y, w);
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(params.empresa?.nome || 'COMANDA', w / 2, y, { align: 'center' }); y += 5;

  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  if (params.empresa?.endereco) {
    const lines = doc.splitTextToSize(params.empresa.endereco, w - 8);
    lines.forEach((line: string) => { doc.text(line, w / 2, y, { align: 'center' }); y += 3; });
  }
  if (params.empresa?.telefone) { doc.text(`Tel: ${params.empresa.telefone}`, w / 2, y, { align: 'center' }); y += 3; }
  if (params.empresa?.cnpj) { doc.text(`CNPJ: ${params.empresa.cnpj}`, w / 2, y, { align: 'center' }); y += 3; }

  doc.setFontSize(8);
  doc.text('COMANDA', w / 2, y, { align: 'center' }); y += 4;
  y = pdfSep(doc, y, w, lh);

  if (params.mesaNumero != null) { doc.text(`Mesa: ${params.mesaNumero}`, 4, y); y += lh; }
  if (params.clienteNome) { doc.text(`Cliente: ${params.clienteNome}`, 4, y); y += lh; }
  if (params.garcomNome) { doc.text(`Garcom: ${params.garcomNome}`, 4, y); y += lh; }
  if (params.openedAt) {
    const d = new Date(params.openedAt);
    doc.text(`Abertura: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 4, y); y += lh;
  }

  y = pdfSep(doc, y, w, lh);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('Qtd', 4, y); doc.text('Item', 14, y); doc.text('Valor', w - 4, y, { align: 'right' }); y += lh;
  doc.setFont('helvetica', 'normal');

  const nameMaxW = w - 30; // space for qty + value columns
  params.itens.forEach(item => {
    const itemTotal = item.preco_unitario * item.quantidade;
    doc.text(`${item.quantidade}x`, 4, y);
    const nome = item.produtos?.nome || '?';
    const nomeLines = doc.splitTextToSize(nome, nameMaxW);
    nomeLines.forEach((line: string, li: number) => {
      doc.text(line, 14, y);
      if (li === 0) {
        doc.text(`${itemTotal.toFixed(2)}`, w - 4, y, { align: 'right' });
      }
      y += lh;
    });
    if (item.observacao) {
      doc.setFontSize(7);
      const obsLines = doc.splitTextToSize(`OBS: ${item.observacao}`, w - 12);
      obsLines.forEach((line: string) => { doc.text(line, 14, y); y += lh; });
      doc.setFontSize(8);
    }
  });

  y = pdfSep(doc, y, w, lh);

  doc.text(`Subtotal:`, 4, y); doc.text(`R$ ${params.subtotal.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
  if (params.taxaServicoAtiva) { doc.text(`Taxa servico (${params.taxaServicoValor}%):`, 4, y); doc.text(`R$ ${params.taxaServico.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh; }
  if (params.desconto > 0) { doc.text(`Desconto:`, 4, y); doc.text(`- R$ ${params.desconto.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh; }
  if (params.acrescimo > 0) { doc.text(`Acrescimo:`, 4, y); doc.text(`+ R$ ${params.acrescimo.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh; }

  y = pdfSep(doc, y, w, lh);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('TOTAL:', 4, y); doc.text(`R$ ${params.total.toFixed(2)}`, w - 4, y, { align: 'right' }); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);

  if (params.pagamentos.length > 0) {
    y = pdfSep(doc, y, w, lh);
    doc.setFont('helvetica', 'bold'); doc.text('PAGAMENTOS', 4, y); y += lh; doc.setFont('helvetica', 'normal');
    const totalPago = params.pagamentos.reduce((s, p) => s + p.valor, 0);
    params.pagamentos.forEach(p => { doc.text(formaLabels[p.forma] || p.forma, 4, y); doc.text(`R$ ${p.valor.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh; });
    doc.text(`Total pago:`, 4, y); doc.text(`R$ ${totalPago.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
    const restante = Math.max(0, params.total - totalPago);
    if (restante > 0.01) { doc.setFont('helvetica', 'bold'); doc.text(`Restante:`, 4, y); doc.text(`R$ ${restante.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh; doc.setFont('helvetica', 'normal'); }
  }

  y = pdfSep(doc, y, w, lh);

  const now = new Date();
  doc.text(`Impresso em ${now.toLocaleDateString('pt-BR')} as ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, w / 2, y, { align: 'center' }); y += lh + 2;
  doc.text('Obrigado pela preferencia!', w / 2, y, { align: 'center' });

  return doc.output('blob');
}
