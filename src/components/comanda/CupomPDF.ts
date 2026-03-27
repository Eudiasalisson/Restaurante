import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addLogoPdf } from '@/lib/pdfUtils';

interface EmpresaInfo {
  nome?: string;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  logo_url?: string | null;
}

interface CupomData {
  mesaNumero: number | null;
  garcomNome: string | null;
  clienteNome?: string | null;
  openedAt: string | null;
  itens: Array<{
    quantidade: number;
    produtos: { nome: string; descricao?: string | null } | null;
    observacao: string | null;
    status: string | null;
  }>;
  empresa?: EmpresaInfo;
}

export async function gerarCupomCozinha(data: CupomData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const w = 80;
  let y = 8;

  if (data.empresa?.logo_url) {
    y = await addLogoPdf(doc, data.empresa.logo_url, y, w);
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.empresa?.nome || 'Restaurante', w / 2, y, { align: 'center' });
  y += 5;

  if (data.empresa?.endereco) {
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.empresa.endereco, w - 8);
    lines.forEach((line: string) => { doc.text(line, w / 2, y, { align: 'center' }); y += 3; });
  }
  if (data.empresa?.telefone) {
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`Tel: ${data.empresa.telefone}`, w / 2, y, { align: 'center' }); y += 3;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('CUPOM - COZINHA', w / 2, y, { align: 'center' });
  y += 5;

  doc.setLineWidth(0.3);
  doc.line(4, y, w - 4, y);
  y += 5;

  doc.setFontSize(9);
  doc.text(`Mesa: ${data.mesaNumero ?? '?'}`, 4, y); y += 4;
  if (data.clienteNome) { doc.text(`Cliente: ${data.clienteNome}`, 4, y); y += 4; }
  doc.text(`Garcom: ${data.garcomNome || '-'}`, 4, y); y += 4;
  if (data.openedAt) {
    doc.text(`Abertura: ${format(new Date(data.openedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 4, y); y += 4;
  }

  y += 1;
  doc.line(4, y, w - 4, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Qtd', 4, y);
  doc.text('Item', 16, y);
  y += 4;
  doc.setFont('helvetica', 'normal');

  const activeItens = data.itens.filter(i => i.status !== 'cancelado');
  const maxNameWidth = w - 20;

  for (let idx = 0; idx < activeItens.length; idx++) {
    const item = activeItens[idx];
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.quantidade}x`, 4, y);
    const nome = item.produtos?.nome || '-';
    const nomeLines = doc.splitTextToSize(nome, maxNameWidth);
    nomeLines.forEach((line: string, li: number) => {
      doc.text(line, 16, y);
      if (li < nomeLines.length - 1) y += 4;
    });
    y += 4;
    if (item.produtos?.descricao) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      const descLines = doc.splitTextToSize(item.produtos.descricao, maxNameWidth);
      descLines.forEach((line: string) => { doc.text(line, 16, y); y += 3; });
      doc.setFont('helvetica', 'normal');
    }
    if (item.observacao) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      const obsLines = doc.splitTextToSize(`Obs: ${item.observacao}`, maxNameWidth);
      obsLines.forEach((line: string) => { doc.text(line, 16, y); y += 3; });
      doc.setFont('helvetica', 'normal');
      y += 0.5;
    }
    if (idx < activeItens.length - 1) {
      y += 1;
      doc.setLineDashPattern([1, 1], 0);
      doc.setLineWidth(0.2);
      doc.line(6, y, w - 6, y);
      doc.setLineDashPattern([], 0);
      y += 2.5;
    }
  }

  y += 3;
  doc.line(4, y, w - 4, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(`Enviado em ${format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}`, w / 2, y, { align: 'center' });

  return doc.output('blob');
}
