import jsPDF from 'jspdf';
import { pdfSep, addLogoPdf } from '@/lib/pdfUtils';
import { formatPhone } from '@/lib/formatPhone';

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

interface ComprovanteEntregaParams {
  clienteNome: string | null;
  clienteTelefone: string | null;
  clienteWhatsapp: string | null;
  enderecoStr: string | null;
  funcionarioNome: string | null;
  openedAt: string | null;
  itens: { quantidade: number; produtos: { nome: string } | null; observacao: string | null; preco_unitario: number; status?: string | null }[];
  subtotal: number;
  taxaEntrega: number;
  total: number;
  pagamentos: { forma: string; valor: number }[];
  totalPago: number;
  empresa?: EmpresaInfo;
  formaPagamento?: string | null;
  numeroPedido?: number | null;
}

export async function gerarComprovanteEntrega(params: ComprovanteEntregaParams): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: [80, 300] });
  const w = 80;
  const margin = 3;
  const contentW = w - margin * 2;
  let y = 8;
  const lh = 4.5;
  const isPago = params.totalPago >= params.total;
  const activeItens = params.itens.filter((i: any) => i.status !== 'cancelado');
  const telefoneDestaque = params.clienteWhatsapp || params.clienteTelefone;

  if (params.empresa?.logo_url) {
    y = await addLogoPdf(doc, params.empresa.logo_url, y, w);
  }

  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(params.empresa?.nome || 'COMPROVANTE DE ENTREGA', w / 2, y, { align: 'center' }); y += 5;

  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  if (params.empresa?.endereco) {
    const lines = doc.splitTextToSize(params.empresa.endereco, contentW);
    lines.forEach((line: string) => { doc.text(line, w / 2, y, { align: 'center' }); y += 3; });
  }
  if (params.empresa?.telefone) { doc.text(`Tel: ${params.empresa.telefone}`, w / 2, y, { align: 'center' }); y += 3; }
  if (params.empresa?.cnpj) { doc.text(`CNPJ: ${params.empresa.cnpj}`, w / 2, y, { align: 'center' }); y += 3; }

  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  const titulo = params.numeroPedido ? `COMPROVANTE DE ENTREGA #D${params.numeroPedido}` : 'COMPROVANTE DE ENTREGA';
  doc.text(titulo, w / 2, y, { align: 'center' }); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  y = pdfSep(doc, y, w, lh);

  if (params.clienteNome) { doc.setFont('helvetica', 'bold'); doc.text(`Cliente: ${params.clienteNome}`, margin, y); doc.setFont('helvetica', 'normal'); y += lh; }

  if (telefoneDestaque) {
    y += 1;
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.rect(margin, y - 3.5, contentW, 7);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`Tel: ${formatPhone(telefoneDestaque)}`, w / 2, y + 1, { align: 'center' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); y += 6;
  }

  if (params.clienteTelefone && params.clienteWhatsapp && params.clienteTelefone !== params.clienteWhatsapp) {
    doc.text(`Tel: ${formatPhone(params.clienteTelefone)}`, margin, y); y += lh;
  }

  y = pdfSep(doc, y, w, lh);

  if (params.enderecoStr) {
    doc.setFont('helvetica', 'bold'); doc.text('ENDERECO:', margin, y); y += lh;
    const addrText = params.enderecoStr.toUpperCase();
    const boxPaddingX = 3;
    const boxPaddingY = 2;
    const textAreaW = contentW - boxPaddingX * 2;
    let addressFontSize = 10;
    doc.setFontSize(addressFontSize);
    let addrLines = doc.splitTextToSize(addrText, textAreaW) as string[];

    while (addrLines.length > 4 && addressFontSize > 7) {
      addressFontSize -= 0.5;
      doc.setFontSize(addressFontSize);
      addrLines = doc.splitTextToSize(addrText, textAreaW) as string[];
    }

    const addressLineHeight = addressFontSize >= 9.5 ? 4.8 : addressFontSize >= 8.5 ? 4.3 : 4;
    const boxH = addrLines.length * addressLineHeight + boxPaddingY * 2;
    y += 1;
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.rect(margin, y - 3.5, contentW, boxH);
    doc.setFontSize(addressFontSize); doc.setFont('helvetica', 'bold');
    let textY = y - 3.5 + boxPaddingY + addressLineHeight * 0.7;
    addrLines.forEach((line: string) => {
      doc.text(line.trim(), margin + boxPaddingX, textY);
      textY += addressLineHeight;
    });
    y = y - 3.5 + boxH + 2;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    y = pdfSep(doc, y, w, lh);
  }

  if (params.formaPagamento) {
    doc.setFont('helvetica', 'bold'); doc.text('FORMA DE PAGAMENTO:', margin, y); y += lh; doc.setFont('helvetica', 'normal');
    doc.text(formaLabels[params.formaPagamento] || params.formaPagamento, margin, y); y += lh;

    const isDinheiro = params.formaPagamento === 'dinheiro';
    const isCartao = params.formaPagamento === 'cartao_credito' || params.formaPagamento === 'cartao_debito';

    if (isDinheiro && params.total > 0) {
      y += 1;
      doc.setDrawColor(0); doc.setLineWidth(0.5);
      doc.rect(margin, y - 3.5, contentW, 10);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('DINHEIRO', w / 2, y + 0.5, { align: 'center' });
      doc.setFontSize(9);
      doc.text(`Troco para: R$ ${params.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, w / 2, y + 4.5, { align: 'center' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); y += 10;
    }

    if (isCartao) {
      y += 1;
      doc.setDrawColor(0); doc.setLineWidth(0.5);
      doc.rect(margin, y - 3.5, contentW, 8);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.text('LEVAR MAQUININHA DE CARTAO', w / 2, y + 1.5, { align: 'center' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); y += 8;
    }

    y = pdfSep(doc, y, w, lh);
  }

  doc.setFont('helvetica', 'bold'); doc.text(`ITENS (${activeItens.length})`, margin, y); y += lh; doc.setFont('helvetica', 'normal');

  const valueW = 22;
  const nameMaxW = contentW - valueW;
  activeItens.forEach(item => {
    const itemTotal = item.preco_unitario * item.quantidade;
    const nome = `${item.quantidade}x ${item.produtos?.nome || '?'}`;
    const nomeLines = doc.splitTextToSize(nome, nameMaxW);
    nomeLines.forEach((line: string, li: number) => {
      doc.text(line, margin, y);
      if (li === 0) {
        doc.text(itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), w - margin, y, { align: 'right' });
      }
      y += lh;
    });
  });

  y = pdfSep(doc, y, w, lh);

  doc.text('Subtotal:', margin, y); doc.text(`R$ ${params.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, w - margin, y, { align: 'right' }); y += lh;
  if (params.taxaEntrega > 0) { doc.text('Taxa entrega:', margin, y); doc.text(`R$ ${params.taxaEntrega.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, w - margin, y, { align: 'right' }); y += lh; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('TOTAL:', margin, y); doc.text(`R$ ${params.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, w - margin, y, { align: 'right' }); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);

  y = pdfSep(doc, y, w, lh);

  doc.setFont('helvetica', 'bold'); doc.text('PAGAMENTO:', margin, y); y += lh; doc.setFont('helvetica', 'normal');

  if (params.pagamentos.length > 0) {
    params.pagamentos.forEach(pg => { doc.text(formaLabels[pg.forma] || pg.forma, margin, y); doc.text(`R$ ${pg.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, w - margin, y, { align: 'right' }); y += lh; });
  } else { doc.text('Nenhum pagamento registrado', margin, y); y += lh; }

  y += 2;
  doc.setLineWidth(0.5);
  doc.rect(margin, y - 3.5, contentW, 8);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  const statusText = isPago ? 'PAGO' : `PENDENTE - R$ ${(params.total - params.totalPago).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  doc.text(statusText, w / 2, y + 1.5, { align: 'center' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); y += 8;

  y = pdfSep(doc, y, w, lh);

  if (params.funcionarioNome) { doc.text(`Responsavel: ${params.funcionarioNome}`, w / 2, y, { align: 'center' }); y += lh; }
  const now = new Date();
  doc.text(`${now.toLocaleDateString('pt-BR')} as ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, w / 2, y, { align: 'center' });

  return doc.output('blob');
}
