import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Download, Landmark, ArrowDownCircle, ArrowUpCircle, Receipt, List, Eye, Info } from 'lucide-react';
import jsPDF from 'jspdf';

const formaLabel: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'C. Crédito',
  cartao_debito: 'C. Débito',
  pix: 'PIX',
  outro: 'Outro',
};

export default function RelatorioCaixa() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [caixas, setCaixas] = useState<any[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewContent, setPreviewContent] = useState<React.ReactNode>(null);

  const fetchData = async () => {
    setLoading(true);
    const from = startOfDay(selectedDate).toISOString();
    const to = endOfDay(selectedDate).toISOString();

    const [cxRes, movRes, pagRes] = await Promise.all([
      supabase.from('caixas').select('*').gte('opened_at', from).lte('opened_at', to).order('opened_at'),
      supabase.from('caixa_movimentacoes').select('*, caixas!inner(opened_at)').gte('caixas.opened_at', from).lte('caixas.opened_at', to).order('created_at'),
      supabase.from('pagamentos').select('*, comandas(numero), entregas(numero)').gte('created_at', from).lte('created_at', to).order('created_at'),
    ]);

    setCaixas(cxRes.data || []);
    setMovimentacoes(movRes.data || []);
    setPagamentos(pagRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  const fluxoDiario = useMemo(() => {
    return caixas.map(cx => {
      const cxMovs = movimentacoes.filter(m => m.caixa_id === cx.id);
      const cxSangrias = cxMovs.filter(m => m.tipo === 'sangria');
      const cxSuprimentos = cxMovs.filter(m => m.tipo === 'suprimento');
      const tSangrias = cxSangrias.reduce((s, m) => s + Number(m.valor), 0);
      const tSuprimentos = cxSuprimentos.reduce((s, m) => s + Number(m.valor), 0);

      const cxPagamentos = pagamentos.filter(p => {
        const pDate = new Date(p.created_at);
        const openDate = new Date(cx.opened_at);
        const closeDate = cx.closed_at ? new Date(cx.closed_at) : new Date();
        return pDate >= openDate && pDate <= closeDate;
      });

      const cxFormaMap: Record<string, number> = {};
      cxPagamentos.forEach(p => { cxFormaMap[p.forma] = (cxFormaMap[p.forma] || 0) + Number(p.valor); });
      const totalCxRecebimentos = cxPagamentos.reduce((s, p) => s + Number(p.valor), 0);
      const saldoDia = cx.valor_abertura + totalCxRecebimentos + tSuprimentos - tSangrias;

      return { ...cx, sangrias: cxSangrias, suprimentos: cxSuprimentos, totalSangrias: tSangrias, totalSuprimentos: tSuprimentos, formaMap: cxFormaMap, totalRecebimentos: totalCxRecebimentos, saldoDia };
    });
  }, [caixas, movimentacoes, pagamentos]);

  const resumoRecebimentos = useMemo(() => {
    const formaMap: Record<string, number> = {};
    pagamentos.forEach(p => { formaMap[p.forma] = (formaMap[p.forma] || 0) + Number(p.valor); });
    const total = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
    return { formaMap, total };
  }, [pagamentos]);

  const DatePicker = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal text-xs")}>
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selectedDate} onSelect={d => d && setSelectedDate(d)} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );

  // ===== PDF GENERATORS (A4) =====
  const generateFluxoPDF = (): Blob => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const w = 210;
    let y = 20;
    const lh = 6;
    const margin = 14;

    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('FLUXO DIÁRIO DE CAIXA', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR }), margin, y); y += 10;

    fluxoDiario.forEach((cx, idx) => {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(`Caixa ${idx + 1} — ${cx.status === 'aberto' ? 'ABERTO' : 'FECHADO'}`, margin, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`Abertura: ${format(new Date(cx.opened_at), 'dd/MM/yyyy HH:mm')}`, margin, y);
      doc.text(`Fundo de caixa: R$ ${Number(cx.valor_abertura).toFixed(2)}`, w / 2, y); y += lh;
      if (cx.closed_at) { doc.text(`Fechamento: ${format(new Date(cx.closed_at), 'dd/MM/yyyy HH:mm')}`, margin, y); y += lh; }

      if (cx.sangrias.length > 0) {
        y += 2; doc.setFont('helvetica', 'bold'); doc.text('Sangrias:', margin, y); y += 5; doc.setFont('helvetica', 'normal');
        cx.sangrias.forEach((m: any) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(`  ${format(new Date(m.created_at), 'HH:mm')} — ${m.descricao}`, margin, y);
          doc.text(`-R$ ${Number(m.valor).toFixed(2)}`, w - margin, y, { align: 'right' }); y += 5;
        });
        doc.setFont('helvetica', 'bold');
        doc.text('Total sangrias:', margin + 4, y); doc.text(`R$ ${cx.totalSangrias.toFixed(2)}`, w - margin, y, { align: 'right' }); y += lh;
        doc.setFont('helvetica', 'normal');
      }

      if (cx.suprimentos.length > 0) {
        y += 2; doc.setFont('helvetica', 'bold'); doc.text('Suprimentos:', margin, y); y += 5; doc.setFont('helvetica', 'normal');
        cx.suprimentos.forEach((m: any) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(`  ${format(new Date(m.created_at), 'HH:mm')} — ${m.descricao}`, margin, y);
          doc.text(`+R$ ${Number(m.valor).toFixed(2)}`, w - margin, y, { align: 'right' }); y += 5;
        });
        doc.setFont('helvetica', 'bold');
        doc.text('Total suprimentos:', margin + 4, y); doc.text(`R$ ${cx.totalSuprimentos.toFixed(2)}`, w - margin, y, { align: 'right' }); y += lh;
        doc.setFont('helvetica', 'normal');
      }

      y += 2; doc.setFont('helvetica', 'bold'); doc.text('Recebimentos por forma de pagamento:', margin, y); y += 5; doc.setFont('helvetica', 'normal');
      Object.entries(cx.formaMap).forEach(([forma, valor]) => {
        doc.text(`  ${formaLabel[forma] || forma}`, margin, y);
        doc.text(`R$ ${(valor as number).toFixed(2)}`, w - margin, y, { align: 'right' }); y += 5;
      });
      doc.setFont('helvetica', 'bold');
      doc.text('Total recebimentos:', margin + 4, y); doc.text(`R$ ${cx.totalRecebimentos.toFixed(2)}`, w - margin, y, { align: 'right' }); y += lh;

      doc.setFontSize(11);
      doc.text('Saldo do dia:', margin, y); doc.text(`R$ ${cx.saldoDia.toFixed(2)}`, w - margin, y, { align: 'right' }); y += lh;
      if (cx.valor_fechamento != null) {
        doc.setFontSize(9);
        doc.text('Valor em caixa:', margin + 4, y); doc.text(`R$ ${Number(cx.valor_fechamento).toFixed(2)}`, w - margin, y, { align: 'right' }); y += 5;
        const diff = Number(cx.valor_fechamento) - cx.saldoDia;
        doc.text('Diferença:', margin + 4, y); doc.text(`R$ ${diff.toFixed(2)}`, w - margin, y, { align: 'right' }); y += lh;
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.setDrawColor(200); doc.line(margin, y, w - margin, y); y += 6;
    });

    if (fluxoDiario.length === 0) { doc.text('Nenhum caixa encontrado nesta data.', margin, y); }

    doc.setFontSize(7); doc.text(`Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, 287);
    return doc.output('blob');
  };

  const generateResumoPDF = (): Blob => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const w = 210; const margin = 14; let y = 20;

    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('RECEBIMENTOS DIÁRIOS — RESUMO', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR }), margin, y); y += 12;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Forma de Pagamento', margin, y); doc.text('Qtd', 120, y, { align: 'center' }); doc.text('Total', w - margin, y, { align: 'right' }); y += 3;
    doc.setDrawColor(100); doc.line(margin, y, w - margin, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);

    Object.entries(resumoRecebimentos.formaMap).forEach(([forma, valor]) => {
      const qtd = pagamentos.filter(p => p.forma === forma).length;
      doc.text(formaLabel[forma] || forma, margin, y);
      doc.text(String(qtd), 120, y, { align: 'center' });
      doc.text(`R$ ${(valor as number).toFixed(2)}`, w - margin, y, { align: 'right' }); y += 6;
    });

    doc.setDrawColor(100); doc.line(margin, y, w - margin, y); y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('TOTAL GERAL:', margin, y); doc.text(`R$ ${resumoRecebimentos.total.toFixed(2)}`, w - margin, y, { align: 'right' });

    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, 287);
    return doc.output('blob');
  };

  const getNumeroRef = (p: any): string => {
    if (p.comanda_id && p.comandas?.numero) return `#${p.comandas.numero}`;
    if (p.entrega_id && p.entregas?.numero) return `D#${p.entregas.numero}`;
    if (p.entrega_id) return 'Delivery';
    return '—';
  };

  const generateDetalhadoPDF = (): Blob => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const w = 210; const margin = 14; let y = 20;

    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('RECEBIMENTOS DIÁRIOS — DETALHADO', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`${format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })} — ${pagamentos.length} registros`, margin, y); y += 12;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Hora', margin, y); doc.text('Forma', 45, y); doc.text('Origem', 95, y); doc.text('Nº', 130, y); doc.text('Valor', w - margin, y, { align: 'right' }); y += 3;
    doc.setDrawColor(100); doc.line(margin, y, w - margin, y); y += 5;
    doc.setFont('helvetica', 'normal');

    pagamentos.forEach(p => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(format(new Date(p.created_at), 'HH:mm'), margin, y);
      doc.text(formaLabel[p.forma] || p.forma, 45, y);
      doc.text(p.comanda_id ? 'Comanda' : p.entrega_id ? 'Entrega' : '—', 95, y);
      doc.text(getNumeroRef(p), 130, y);
      doc.text(`R$ ${Number(p.valor).toFixed(2)}`, w - margin, y, { align: 'right' }); y += 5;
    });

    doc.setDrawColor(100); doc.line(margin, y, w - margin, y); y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('TOTAL:', margin, y); doc.text(`R$ ${resumoRecebimentos.total.toFixed(2)}`, w - margin, y, { align: 'right' });

    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, 287);
    return doc.output('blob');
  };

  // ===== PREVIEW BUILDERS =====
  const openFluxoPreview = () => {
    setPreviewTitle('Fluxo Diário de Caixa');
    setPreviewFileName(`fluxo-diario-${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
    setPreviewBlob(generateFluxoPDF());
    setPreviewContent(
      <div className="space-y-6 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">FLUXO DIÁRIO DE CAIXA</h2>
          <p className="text-muted-foreground">{format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}</p>
        </div>
        {fluxoDiario.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Nenhum caixa encontrado nesta data.</p>
        ) : fluxoDiario.map((cx, idx) => (
          <div key={cx.id} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold">Caixa {idx + 1}</span>
              <Badge variant={cx.status === 'aberto' ? 'default' : 'secondary'}>{cx.status === 'aberto' ? 'Aberto' : 'Fechado'}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Abertura:</span> {format(new Date(cx.opened_at), 'dd/MM/yyyy HH:mm')}</div>
              <div><span className="text-muted-foreground">Fechamento:</span> {cx.closed_at ? format(new Date(cx.closed_at), 'dd/MM/yyyy HH:mm') : '—'}</div>
              <div><span className="text-muted-foreground">Fundo de caixa:</span> <strong>R$ {Number(cx.valor_abertura).toFixed(2)}</strong></div>
            </div>

            {cx.sangrias.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-destructive mb-1">Sangrias</p>
                {cx.sangrias.map((m: any) => (
                  <div key={m.id} className="flex justify-between text-xs pl-2">
                    <span>{format(new Date(m.created_at), 'HH:mm')} — {m.descricao}</span>
                    <span className="text-destructive">-R$ {Number(m.valor).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold mt-1 pl-2">
                  <span>Total sangrias</span><span>R$ {cx.totalSangrias.toFixed(2)}</span>
                </div>
              </div>
            )}

            {cx.suprimentos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-success mb-1">Suprimentos</p>
                {cx.suprimentos.map((m: any) => (
                  <div key={m.id} className="flex justify-between text-xs pl-2">
                    <span>{format(new Date(m.created_at), 'HH:mm')} — {m.descricao}</span>
                    <span className="text-success">+R$ {Number(m.valor).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold mt-1 pl-2">
                  <span>Total suprimentos</span><span>R$ {cx.totalSuprimentos.toFixed(2)}</span>
                </div>
              </div>
            )}

            <Separator />
            <div>
              <p className="text-xs font-semibold mb-1">Recebimentos por Forma de Pagamento</p>
              {Object.entries(cx.formaMap).map(([forma, valor]) => (
                <div key={forma} className="flex justify-between text-xs pl-2">
                  <span>{formaLabel[forma] || forma}</span><span>R$ {(valor as number).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-bold mt-1 pl-2">
                <span>Total recebimentos</span><span>R$ {cx.totalRecebimentos.toFixed(2)}</span>
              </div>
            </div>

            <Separator />
            <div className="flex justify-between font-bold">
              <span>Saldo do dia</span><span className="text-primary">R$ {cx.saldoDia.toFixed(2)}</span>
            </div>
            {cx.valor_fechamento != null && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Valor em caixa: <strong>R$ {Number(cx.valor_fechamento).toFixed(2)}</strong></div>
                <div>Diferença: <strong className={Number(cx.valor_fechamento) - cx.saldoDia >= 0 ? 'text-success' : 'text-destructive'}>R$ {(Number(cx.valor_fechamento) - cx.saldoDia).toFixed(2)}</strong></div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
    setPreviewOpen(true);
  };

  const openResumoPreview = () => {
    setPreviewTitle('Recebimentos Diários — Resumo');
    setPreviewFileName(`recebimentos-resumo-${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
    setPreviewBlob(generateResumoPDF());
    setPreviewContent(
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">RECEBIMENTOS DIÁRIOS — RESUMO</h2>
          <p className="text-muted-foreground">{format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}</p>
        </div>
        {pagamentos.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Nenhum recebimento nesta data.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left">
                <th className="pb-2">Forma</th><th className="pb-2 text-center">Qtd</th><th className="pb-2 text-right">Total</th>
              </tr></thead>
              <tbody>
                {Object.entries(resumoRecebimentos.formaMap).map(([forma, valor]) => (
                  <tr key={forma} className="border-b border-border/50">
                    <td className="py-1.5">{formaLabel[forma] || forma}</td>
                    <td className="py-1.5 text-center">{pagamentos.filter(p => p.forma === forma).length}</td>
                    <td className="py-1.5 text-right font-medium">R$ {(valor as number).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/20 font-bold">
              <span>Total Geral</span><span className="text-lg text-primary">R$ {resumoRecebimentos.total.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    );
    setPreviewOpen(true);
  };

  const openDetalhadoPreview = () => {
    setPreviewTitle('Recebimentos Diários — Detalhado');
    setPreviewFileName(`recebimentos-detalhado-${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
    setPreviewBlob(generateDetalhadoPDF());
    setPreviewContent(
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">RECEBIMENTOS DIÁRIOS — DETALHADO</h2>
          <p className="text-muted-foreground">{format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })} — {pagamentos.length} registros</p>
        </div>
        {pagamentos.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Nenhum recebimento nesta data.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left">
                <th className="pb-2">Hora</th><th className="pb-2">Forma</th><th className="pb-2">Origem</th><th className="pb-2">Nº</th><th className="pb-2 text-right">Valor</th>
              </tr></thead>
              <tbody>
                {pagamentos.map(p => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-1.5">{format(new Date(p.created_at), 'HH:mm')}</td>
                    <td className="py-1.5">{formaLabel[p.forma] || p.forma}</td>
                    <td className="py-1.5 text-muted-foreground">{p.comanda_id ? 'Comanda' : p.entrega_id ? 'Entrega' : '—'}</td>
                    <td className="py-1.5 text-muted-foreground">{getNumeroRef(p)}</td>
                    <td className="py-1.5 text-right font-medium">R$ {Number(p.valor).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/20 font-bold">
              <span>Total ({pagamentos.length} recebimentos)</span><span className="text-lg text-primary">R$ {resumoRecebimentos.total.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    );
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-accent" /> Relatórios de Caixa
          </h1>
          <p className="text-sm text-muted-foreground">Análise financeira diária</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Data:</span>
          <DatePicker />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div>
        </div>
      ) : (
        <Tabs defaultValue="fluxo" className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="fluxo" className="text-xs"><Landmark className="h-3.5 w-3.5 mr-1" />Fluxo Diário</TabsTrigger>
            <TabsTrigger value="resumo" className="text-xs"><Receipt className="h-3.5 w-3.5 mr-1" />Recebimentos Resumo</TabsTrigger>
            <TabsTrigger value="detalhado" className="text-xs"><List className="h-3.5 w-3.5 mr-1" />Recebimentos Detalhado</TabsTrigger>
          </TabsList>

          {/* FLUXO DIÁRIO */}
          <TabsContent value="fluxo" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Exibe o fluxo financeiro completo do caixa na data selecionada, incluindo fundo de abertura, sangrias, suprimentos, recebimentos por forma de pagamento e saldo final.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openFluxoPreview}>
                <Eye className="h-4 w-4 mr-1" /> Visualizar / PDF
              </Button>
            </div>

            {fluxoDiario.length === 0 ? (
              <Card className="glass">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum caixa encontrado nesta data.</p>
                </CardContent>
              </Card>
            ) : (
              fluxoDiario.map((cx, idx) => (
                <Card key={cx.id} className="glass">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-serif">Caixa {idx + 1}</CardTitle>
                      <Badge variant={cx.status === 'aberto' ? 'default' : 'secondary'}>
                        {cx.status === 'aberto' ? 'Aberto' : 'Fechado'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-secondary/50">
                        <p className="text-[10px] text-muted-foreground uppercase">Abertura</p>
                        <p className="text-xs font-medium">{format(new Date(cx.opened_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-secondary/50">
                        <p className="text-[10px] text-muted-foreground uppercase">Fechamento</p>
                        <p className="text-xs font-medium">{cx.closed_at ? format(new Date(cx.closed_at), "dd/MM/yyyy HH:mm") : '—'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-secondary/50">
                        <p className="text-[10px] text-muted-foreground uppercase">Fundo de Caixa</p>
                        <p className="text-sm font-bold">R$ {Number(cx.valor_abertura).toFixed(2)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-[10px] text-muted-foreground uppercase">Total Sangrias</p>
                        <p className="text-sm font-bold text-destructive">R$ {cx.totalSangrias.toFixed(2)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-[10px] text-muted-foreground uppercase">Total Suprimentos</p>
                        <p className="text-sm font-bold text-success">R$ {cx.totalSuprimentos.toFixed(2)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-[10px] text-muted-foreground uppercase">Saldo do Dia</p>
                        <p className="text-sm font-bold text-primary">R$ {cx.saldoDia.toFixed(2)}</p>
                      </div>
                    </div>

                    {cx.sangrias.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                          <ArrowDownCircle className="h-3.5 w-3.5 text-destructive" /> Sangrias
                        </p>
                        <div className="space-y-1">
                          {cx.sangrias.map((m: any) => (
                            <div key={m.id} className="flex justify-between text-xs p-2 rounded bg-secondary/40">
                              <div>
                                <span className="font-medium">{m.descricao}</span>
                                <span className="text-muted-foreground ml-2">{format(new Date(m.created_at), 'HH:mm')}</span>
                              </div>
                              <span className="text-destructive font-medium">-R$ {Number(m.valor).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cx.suprimentos.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                          <ArrowUpCircle className="h-3.5 w-3.5 text-success" /> Suprimentos
                        </p>
                        <div className="space-y-1">
                          {cx.suprimentos.map((m: any) => (
                            <div key={m.id} className="flex justify-between text-xs p-2 rounded bg-secondary/40">
                              <div>
                                <span className="font-medium">{m.descricao}</span>
                                <span className="text-muted-foreground ml-2">{format(new Date(m.created_at), 'HH:mm')}</span>
                              </div>
                              <span className="text-success font-medium">+R$ {Number(m.valor).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Recebimentos por Forma de Pagamento</p>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-xs">Forma</TableHead>
                            <TableHead className="text-xs text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(cx.formaMap).map(([forma, valor]) => (
                            <TableRow key={forma} className="border-border">
                              <TableCell className="text-xs py-2">{formaLabel[forma] || forma}</TableCell>
                              <TableCell className="text-xs text-right py-2 font-medium">R$ {(valor as number).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-border bg-secondary/30">
                            <TableCell className="text-xs py-2 font-bold">Subtotal Recebimentos</TableCell>
                            <TableCell className="text-xs text-right py-2 font-bold">R$ {cx.totalRecebimentos.toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                        <p className="text-[10px] text-muted-foreground uppercase">Total Geral do Dia</p>
                        <p className="text-lg font-bold text-accent">R$ {cx.saldoDia.toFixed(2)}</p>
                      </div>
                      {cx.valor_fechamento != null && (
                        <>
                          <div className="p-3 rounded-lg bg-secondary/50">
                            <p className="text-[10px] text-muted-foreground uppercase">Valor em Caixa</p>
                            <p className="text-sm font-bold">R$ {Number(cx.valor_fechamento).toFixed(2)}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/50">
                            <p className="text-[10px] text-muted-foreground uppercase">Diferença</p>
                            <p className={`text-sm font-bold ${Number(cx.valor_fechamento) - cx.saldoDia >= 0 ? 'text-success' : 'text-destructive'}`}>
                              R$ {(Number(cx.valor_fechamento) - cx.saldoDia).toFixed(2)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* RESUMO RECEBIMENTOS */}
          <TabsContent value="resumo" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Apresenta um resumo consolidado dos recebimentos do dia, agrupados por forma de pagamento (dinheiro, cartão, PIX, etc.) com quantidade e valor total de cada uma.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openResumoPreview}>
                <Eye className="h-4 w-4 mr-1" /> Visualizar / PDF
              </Button>
            </div>

            <Card className="glass">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif">Resumo de Recebimentos — {format(selectedDate, "dd/MM/yyyy")}</CardTitle>
              </CardHeader>
              <CardContent>
                {pagamentos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum recebimento nesta data.</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead>Forma de Pagamento</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(resumoRecebimentos.formaMap).map(([forma, valor]) => {
                          const qtd = pagamentos.filter(p => p.forma === forma).length;
                          return (
                            <TableRow key={forma} className="border-border">
                              <TableCell>{formaLabel[forma] || forma}</TableCell>
                              <TableCell className="text-right font-medium">R$ {(valor as number).toFixed(2)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{qtd}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20 flex justify-between items-center">
                      <span className="font-semibold">Total Geral</span>
                      <span className="text-xl font-bold text-primary">R$ {resumoRecebimentos.total.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DETALHADO */}
          <TabsContent value="detalhado" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Lista todos os recebimentos do dia em ordem cronológica, detalhando horário, forma de pagamento, origem (comanda ou delivery), número de referência e valor de cada transação.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openDetalhadoPreview}>
                <Eye className="h-4 w-4 mr-1" /> Visualizar / PDF
              </Button>
            </div>

            <Card className="glass overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif">
                  Recebimentos Detalhados — {format(selectedDate, "dd/MM/yyyy")}
                  {pagamentos.length > 0 && <Badge variant="secondary" className="ml-2">{pagamentos.length} registros</Badge>}
                </CardTitle>
              </CardHeader>
              {pagamentos.length === 0 ? (
                <CardContent>
                  <p className="text-center text-muted-foreground py-8">Nenhum recebimento nesta data.</p>
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Hora</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Nº</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentos.map(p => (
                      <TableRow key={p.id} className="border-border">
                        <TableCell className="text-sm">{format(new Date(p.created_at), 'HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{formaLabel[p.forma] || p.forma}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.comanda_id ? 'Comanda' : p.entrega_id ? 'Entrega' : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getNumeroRef(p)}</TableCell>
                        <TableCell className="text-right font-medium">R$ {Number(p.valor).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-border bg-secondary/30">
                      <TableCell colSpan={4} className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">R$ {resumoRecebimentos.total.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <PdfPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        pdfBlob={previewBlob}
        title={previewTitle}
        fileName={previewFileName}
        size="a4"
      >
        {previewContent}
      </PdfPreviewModal>
    </div>
  );
}
