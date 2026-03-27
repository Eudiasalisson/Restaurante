import jsPDF from 'jspdf';
import { pdfSep, addLogoPdf } from '@/lib/pdfUtils';

const formaLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'C. Credito', cartao_debito: 'C. Debito', pix: 'PIX', outro: 'Outro',
};

interface EmpresaInfo {
  nome?: string;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  logo_url?: string | null;
}

interface CupomEntregaParams {
  clienteNome: string | null;
  enderecoStr: string | null;
  funcionarioNome: string | null;
  openedAt: string | null;
  itens: { quantidade: number; produtos: { nome: string } | null; observacao: string | null }[];
  empresa?: EmpresaInfo;
  formaPagamento?: string | null;
  total?: number;
  numeroPedido?: number | null;
}

export async function gerarCupomEntrega(params: CupomEntregaParams): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const w = 80;
  let y = 8;
  const lh = 4.5;

  if (params.empresa?.logo_url) {
    y = await addLogoPdf(doc, params.empresa.logo_url, y, w);
  }

  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(params.empresa?.nome || 'PEDIDO DELIVERY', w / 2, y, { align: 'center' }); y += 5;

  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  if (params.empresa?.endereco) {
    const lines = doc.splitTextToSize(params.empresa.endereco, w - 8);
    lines.forEach((line: string) => { doc.text(line, w / 2, y, { align: 'center' }); y += 3; });
  }
  if (params.empresa?.telefone) { doc.text(`Tel: ${params.empresa.telefone}`, w / 2, y, { align: 'center' }); y += 3; }

  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  const titulo = params.numeroPedido ? `PEDIDO DELIVERY #D${params.numeroPedido}` : 'PEDIDO DELIVERY';
  doc.text(titulo, w / 2, y, { align: 'center' }); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);

  y = pdfSep(doc, y, w, lh);

  if (params.clienteNome) { doc.text(`Cliente: ${params.clienteNome}`, 4, y); y += lh; }
  if (params.openedAt) {
    const d = new Date(params.openedAt);
    doc.text(`Aberto: ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 4, y); y += lh;
  }

  if (params.enderecoStr) {
    y = pdfSep(doc, y, w, lh);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('ENDERECO:', 4, y); y += lh;
    const addrText = params.enderecoStr.toUpperCase();
    const addrLines = doc.splitTextToSize(addrText, w - 10);
    addrLines.forEach((line: string) => { doc.text(line, 4, y); y += lh; });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  }

  y = pdfSep(doc, y, w, lh);

  doc.setFont('helvetica', 'bold'); doc.text('ITENS', 4, y); y += lh; doc.setFont('helvetica', 'normal');

  const activeItens = params.itens.filter((i: any) => i.status !== 'cancelado');
  const maxNameWidth = w - 10;
  activeItens.forEach(item => {
    const text = `${item.quantidade}x ${item.produtos?.nome || '?'}`;
    const lines = doc.splitTextToSize(text, maxNameWidth);
    lines.forEach((line: string) => { doc.text(line, 4, y); y += lh; });
    if (item.observacao) {
      doc.setFontSize(7);
      const obsLines = doc.splitTextToSize(`   OBS: ${item.observacao}`, maxNameWidth);
      obsLines.forEach((line: string) => { doc.text(line, 4, y); y += lh; });
      doc.setFontSize(8);
    }
  });

  y = pdfSep(doc, y, w, lh);
  const now = new Date();
  doc.text(`Impresso em ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, w / 2, y, { align: 'center' });

  return doc.output('blob');
}
