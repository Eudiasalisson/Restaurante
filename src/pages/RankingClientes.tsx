import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';
import { TablePagination } from '@/components/TablePagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { usePagination } from '@/hooks/usePagination';
import { format, startOfWeek, startOfMonth, startOfYear, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Trophy, Medal, Award, Users, Info, CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

type PeriodFilter = 'all' | 'week' | 'month' | 'year' | 'custom';

interface ClienteRanking {
  id: string;
  nome: string;
  qtd_comandas: number;
  qtd_entregas: number;
  valor_comandas: number;
  valor_entregas: number;
  valor_total: number;
}

export default function RankingClientes() {
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<ClienteRanking[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date>(new Date());
  const [customDateTo, setCustomDateTo] = useState<Date>(new Date());

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewContent, setPreviewContent] = useState<React.ReactNode>(null);

  const pagination = usePagination(ranking, 20);

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'week': return 'Semana Atual';
      case 'month': return 'Mês Atual';
      case 'year': return 'Ano Atual';
      case 'custom': return `${format(customDateFrom, 'dd/MM/yyyy')} a ${format(customDateTo, 'dd/MM/yyyy')}`;
      default: return 'Todo Período';
    }
  }, [period, customDateFrom, customDateTo]);

  const fetchData = async () => {
    setLoading(true);

    let fromDate: string | null = null;
    let toDate: string | null = null;
    const now = new Date();
    if (period === 'week') fromDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    else if (period === 'month') fromDate = startOfMonth(now).toISOString();
    else if (period === 'year') fromDate = startOfYear(now).toISOString();
    else if (period === 'custom') {
      fromDate = startOfDay(customDateFrom).toISOString();
      toDate = endOfDay(customDateTo).toISOString();
    }

    // Fetch clients
    const { data: clientes } = await supabase.from('clientes').select('id, nome');
    if (!clientes || clientes.length === 0) { setRanking([]); setLoading(false); return; }

    // Fetch comandas with items
    let comandasQuery = supabase.from('comandas').select('id, cliente_id, status').not('cliente_id', 'is', null);
    if (fromDate) comandasQuery = comandasQuery.gte('opened_at', fromDate);
    if (toDate) comandasQuery = comandasQuery.lte('opened_at', toDate);
    const { data: comandas } = await comandasQuery;

    // Fetch entregas with items
    let entregasQuery = supabase.from('entregas').select('id, cliente_id, status').not('cliente_id', 'is', null);
    if (fromDate) entregasQuery = entregasQuery.gte('opened_at', fromDate);
    if (toDate) entregasQuery = entregasQuery.lte('opened_at', toDate);
    const { data: entregas } = await entregasQuery;

    // Get all comanda IDs and entrega IDs
    const comandaIds = (comandas || []).filter(c => c.status === 'fechada').map(c => c.id);
    const entregaIds = (entregas || []).filter(e => e.status === 'entregue').map(e => e.id);

    // Fetch items
    let comandaItens: any[] = [];
    let entregaItens: any[] = [];

    if (comandaIds.length > 0) {
      // Fetch in batches to avoid URL length limits
      const batchSize = 50;
      for (let i = 0; i < comandaIds.length; i += batchSize) {
        const batch = comandaIds.slice(i, i + batchSize);
        const { data } = await supabase.from('comanda_itens').select('comanda_id, quantidade, preco_unitario').in('comanda_id', batch).neq('status', 'cancelado');
        if (data) comandaItens.push(...data);
      }
    }

    if (entregaIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < entregaIds.length; i += batchSize) {
        const batch = entregaIds.slice(i, i + batchSize);
        const { data } = await supabase.from('entrega_itens').select('entrega_id, quantidade, preco_unitario').in('entrega_id', batch).neq('status', 'cancelado');
        if (data) entregaItens.push(...data);
      }
    }

    // Map comanda_id -> cliente_id
    const comandaClienteMap: Record<string, string> = {};
    (comandas || []).forEach(c => { if (c.cliente_id) comandaClienteMap[c.id] = c.cliente_id; });
    const entregaClienteMap: Record<string, string> = {};
    (entregas || []).forEach(e => { if (e.cliente_id) entregaClienteMap[e.id] = e.cliente_id; });

    // Build ranking
    const clienteMap: Record<string, ClienteRanking> = {};
    clientes.forEach(c => {
      clienteMap[c.id] = { id: c.id, nome: c.nome, qtd_comandas: 0, qtd_entregas: 0, valor_comandas: 0, valor_entregas: 0, valor_total: 0 };
    });

    // Count unique comandas per client
    const comandasByClient: Record<string, Set<string>> = {};
    const entregasByClient: Record<string, Set<string>> = {};

    comandaItens.forEach(item => {
      const clienteId = comandaClienteMap[item.comanda_id];
      if (clienteId && clienteMap[clienteId]) {
        clienteMap[clienteId].valor_comandas += item.quantidade * Number(item.preco_unitario);
        if (!comandasByClient[clienteId]) comandasByClient[clienteId] = new Set();
        comandasByClient[clienteId].add(item.comanda_id);
      }
    });

    entregaItens.forEach(item => {
      const clienteId = entregaClienteMap[item.entrega_id];
      if (clienteId && clienteMap[clienteId]) {
        clienteMap[clienteId].valor_entregas += item.quantidade * Number(item.preco_unitario);
        if (!entregasByClient[clienteId]) entregasByClient[clienteId] = new Set();
        entregasByClient[clienteId].add(item.entrega_id);
      }
    });

    Object.keys(clienteMap).forEach(id => {
      clienteMap[id].qtd_comandas = comandasByClient[id]?.size || 0;
      clienteMap[id].qtd_entregas = entregasByClient[id]?.size || 0;
      clienteMap[id].valor_total = clienteMap[id].valor_comandas + clienteMap[id].valor_entregas;
    });

    const sorted = Object.values(clienteMap)
      .filter(c => c.valor_total > 0)
      .sort((a, b) => b.valor_total - a.valor_total);

    setRanking(sorted);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [period, customDateFrom, customDateTo]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-700" />;
    return <span className="text-sm text-muted-foreground font-medium w-5 text-center inline-block">{index + 1}</span>;
  };

  const getRankRowClass = (index: number) => {
    if (index === 0) return 'bg-yellow-500/10 border-yellow-500/30';
    if (index === 1) return 'bg-gray-400/10 border-gray-400/30';
    if (index === 2) return 'bg-amber-700/10 border-amber-700/30';
    return 'border-border';
  };

  const generatePDF = (): Blob => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 14;
    let y = 20;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Ranking de Clientes', margin, y); y += 8;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${periodLabel}`, margin, y); y += 4;
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, y); y += 10;

    // Header
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('#', margin, y);
    doc.text('Cliente', margin + 8, y);
    doc.text('Cmd', margin + 75, y, { align: 'right' });
    doc.text('Ent', margin + 88, y, { align: 'right' });
    doc.text('V. Comandas', margin + 120, y, { align: 'right' });
    doc.text('V. Entregas', margin + 150, y, { align: 'right' });
    doc.text('Total', margin + 180, y, { align: 'right' });
    y += 3; doc.setDrawColor(150); doc.line(margin, y, margin + 180, y); y += 4;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    ranking.forEach((c, i) => {
      if (y > 275) { doc.addPage(); y = 20; }
      const isBold = i < 3;
      if (isBold) doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}`, margin, y);
      doc.text(c.nome.substring(0, 35), margin + 8, y);
      doc.text(`${c.qtd_comandas}`, margin + 75, y, { align: 'right' });
      doc.text(`${c.qtd_entregas}`, margin + 88, y, { align: 'right' });
      doc.text(`R$ ${c.valor_comandas.toFixed(2)}`, margin + 120, y, { align: 'right' });
      doc.text(`R$ ${c.valor_entregas.toFixed(2)}`, margin + 150, y, { align: 'right' });
      doc.text(`R$ ${c.valor_total.toFixed(2)}`, margin + 180, y, { align: 'right' });
      if (isBold) doc.setFont('helvetica', 'normal');
      y += 5;
    });

    doc.setFontSize(7);
    doc.text(`Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, 287);
    return doc.output('blob');
  };

  const openPreview = () => {
    const blob = generatePDF();
    setPreviewBlob(blob);
    setPreviewContent(
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">RANKING DE CLIENTES</h2>
          <p className="text-muted-foreground">{periodLabel}</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left">#</th>
              <th className="pb-2 text-left">Cliente</th>
              <th className="pb-2 text-right">Cmd</th>
              <th className="pb-2 text-right">Ent</th>
              <th className="pb-2 text-right">V. Comandas</th>
              <th className="pb-2 text-right">V. Entregas</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((c, i) => (
              <tr key={c.id} className={`border-b border-border/50 ${i < 3 ? 'font-bold' : ''}`}>
                <td className="py-1">{i + 1}</td>
                <td className="py-1">{c.nome}</td>
                <td className="py-1 text-right">{c.qtd_comandas}</td>
                <td className="py-1 text-right">{c.qtd_entregas}</td>
                <td className="py-1 text-right">R$ {c.valor_comandas.toFixed(2)}</td>
                <td className="py-1 text-right">R$ {c.valor_entregas.toFixed(2)}</td>
                <td className="py-1 text-right">R$ {c.valor_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    setPreviewOpen(true);
  };

  const totalGeral = ranking.reduce((s, c) => s + c.valor_total, 0);
  const totalComandas = ranking.reduce((s, c) => s + c.qtd_comandas, 0);
  const totalEntregas = ranking.reduce((s, c) => s + c.qtd_entregas, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Ranking de Clientes</h1>
          <p className="text-sm text-muted-foreground">Clientes ordenados por valor de consumo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'week', 'month', 'year', 'custom'] as PeriodFilter[]).map(p => (
            <Button key={p} size="sm" variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)} className="text-xs">
              {p === 'all' ? 'Todo Período' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : p === 'year' ? 'Ano' : 'Personalizado'}
            </Button>
          ))}
          {period === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('text-xs w-[120px] justify-start font-normal', !customDateFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {format(customDateFrom, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customDateFrom} onSelect={d => d && setCustomDateFrom(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('text-xs w-[120px] justify-start font-normal', !customDateTo && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                    {format(customDateTo, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customDateTo} onSelect={d => d && setCustomDateTo(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs text-muted-foreground">
          Ranking de clientes ordenado pelo valor total de consumo (comandas + entregas finalizadas). Os três primeiros colocados recebem destaque especial.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div>
        </div>
      ) : ranking.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum cliente com consumo encontrado no período.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Clientes</p>
                <p className="text-xl font-bold text-foreground">{ranking.length}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Total Comandas</p>
                <p className="text-xl font-bold text-foreground">{totalComandas}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Total Entregas</p>
                <p className="text-xl font-bold text-foreground">{totalEntregas}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Faturamento Total</p>
                <p className="text-xl font-bold text-gradient-gold">R$ {totalGeral.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={openPreview}>
              <Eye className="h-4 w-4 mr-1" /> Visualizar / PDF
            </Button>
          </div>

          <Card className="glass overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Comandas</TableHead>
                  <TableHead className="text-right">Entregas</TableHead>
                  <TableHead className="text-right">V. Comandas</TableHead>
                  <TableHead className="text-right">V. Entregas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((c, pageIndex) => {
                  const realIndex = (pagination.page - 1) * pagination.pageSize + pageIndex;
                  return (
                    <TableRow key={c.id} className={getRankRowClass(realIndex)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center justify-center">{getRankIcon(realIndex)}</div>
                      </TableCell>
                      <TableCell className={realIndex < 3 ? 'font-bold' : ''}>{c.nome}</TableCell>
                      <TableCell className="text-right">{c.qtd_comandas}</TableCell>
                      <TableCell className="text-right">{c.qtd_entregas}</TableCell>
                      <TableCell className="text-right">R$ {c.valor_comandas.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {c.valor_entregas.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-bold ${realIndex < 3 ? 'text-primary' : ''}`}>
                        R$ {c.valor_total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </Card>
        </>
      )}

      <PdfPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        pdfBlob={previewBlob}
        title="Ranking de Clientes"
        fileName="ranking-clientes.pdf"
        size="a4"
      >
        {previewContent}
      </PdfPreviewModal>
    </div>
  );
}
