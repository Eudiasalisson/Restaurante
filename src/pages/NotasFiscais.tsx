import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';
import { baixarDanfe, NotaFiscalStatus, NOTA_FISCAL_STATUS_CONFIG } from '@/lib/nfce';
import { toast } from 'sonner';
import { CalendarIcon, FileText, ExternalLink, Eye, Loader2, Search, AlertTriangle } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';

interface NotaFiscalRow {
  id: string;
  status: NotaFiscalStatus;
  ambiente: string;
  chave_acesso: string | null;
  valor_total: number | null;
  created_at: string;
  comanda_id: string | null;
  entrega_id: string | null;
  comandas: { numero: number | null; mesas: { numero: number } | null; clientes: { nome: string } | null } | null;
  entregas: { numero: number | null; clientes: { nome: string } | null } | null;
}

export default function NotasFiscais() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [statusFiltro, setStatusFiltro] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [notas, setNotas] = useState<NotaFiscalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [baixando, setBaixando] = useState<string | null>(null);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    const from = startOfDay(dateFrom).toISOString();
    const to = endOfDay(dateTo).toISOString();
    let query = supabase
      .from('notas_fiscais')
      .select('*, comandas(numero, mesas(numero), clientes(nome)), entregas(numero, clientes(nome))')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .limit(500);
    if (statusFiltro !== 'all') query = query.eq('status', statusFiltro as NotaFiscalStatus);
    const { data } = await query;
    setNotas((data as any[]) || []);
    setLoading(false);
  }, [dateFrom, dateTo, statusFiltro]);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  const notasFiltradas = useMemo(() => {
    if (!search.trim()) return notas;
    const s = search.toLowerCase();
    return notas.filter(n => {
      const cliente = n.comandas?.clientes?.nome || n.entregas?.clientes?.nome || '';
      return (n.chave_acesso || '').includes(s.replace(/\D/g, '')) || cliente.toLowerCase().includes(s);
    });
  }, [notas, search]);

  const { paginatedItems, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(notasFiltradas);

  const totalEmitido = useMemo(
    () => notas.filter(n => n.status === 'issued').reduce((s, n) => s + (n.valor_total || 0), 0),
    [notas]
  );

  const handleVerDanfe = async (notaId: string) => {
    setBaixando(notaId);
    try {
      await baixarDanfe(notaId);
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao abrir o DANFE');
    } finally {
      setBaixando(null);
    }
  };

  const DatePicker = ({ date, onChange, label }: { date: Date; onChange: (d: Date) => void; label: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal text-xs", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {date ? format(date, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={d => d && onChange(d)} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Notas Fiscais (NFC-e)
          </h1>
          <p className="text-sm text-muted-foreground">
            {notas.filter(n => n.status === 'issued').length} emitidas — R$ {totalEmitido.toFixed(2)} no período
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou chave de acesso..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(NOTA_FISCAL_STATUS_CONFIG).map(([value, cfg]) => (
              <SelectItem key={value} value={value}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePicker date={dateFrom} onChange={setDateFrom} label="De" />
        <span className="text-muted-foreground text-xs">até</span>
        <DatePicker date={dateTo} onChange={setDateTo} label="Até" />
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDateFrom(startOfDay(new Date())); setDateTo(new Date()); }}>Hoje</Button>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDateFrom(subDays(new Date(), 7)); setDateTo(new Date()); }}>7 dias</Button>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDateFrom(startOfMonth(new Date())); setDateTo(new Date()); }}>Mês</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div>
        </div>
      ) : notasFiltradas.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma NFC-e encontrada no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Chave de acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map(n => {
                const origem = n.comandas
                  ? `${n.comandas.numero ? `#${n.comandas.numero} — ` : ''}${n.comandas.mesas ? `Mesa ${n.comandas.mesas.numero}` : 'Comanda'}`
                  : n.entregas
                    ? `Delivery ${n.entregas.numero ? `#${n.entregas.numero}` : ''}`
                    : '—';
                const cliente = n.comandas?.clientes?.nome || n.entregas?.clientes?.nome || '—';
                return (
                  <TableRow key={n.id} className="border-border">
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(n.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                    <TableCell className="text-sm">{origem}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cliente}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge className={NOTA_FISCAL_STATUS_CONFIG[n.status].className}>{NOTA_FISCAL_STATUS_CONFIG[n.status].label}</Badge>
                        {n.ambiente === 'homologacao' && (
                          <span className="text-[10px] text-warning flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> teste
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {n.valor_total != null ? `R$ ${n.valor_total.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground break-all max-w-[180px]">
                      {n.chave_acesso || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {n.status === 'issued' && (
                          <Button size="sm" variant="ghost" onClick={() => handleVerDanfe(n.id)} disabled={baixando === n.id} title="Ver DANFE">
                            {baixando === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(n.comanda_id ? `/comanda/${n.comanda_id}` : `/entrega/${n.entrega_id}`)}
                          title="Ver venda"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}
    </div>
  );
}
