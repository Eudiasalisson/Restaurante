import { useEffect, useState } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Clock, Users, Search, Eye, CalendarIcon, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, startOfYear, startOfWeek, endOfDay, startOfDay, isEqual } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Comanda {
  id: string;
  numero: number | null;
  mesa_id: string | null;
  cliente_id: string | null;
  pessoas: number;
  status: 'aberta' | 'fechada' | 'cancelada';
  opened_at: string;
  closed_at: string | null;
  mesas?: { numero: number } | null;
  clientes?: { nome: string } | null;
}

interface ComandaComValor extends Comanda {
  totalValor: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  aberta: { label: 'Aberta', className: 'bg-success/20 text-success border-success/30' },
  fechada: { label: 'Fechada', className: 'bg-muted text-muted-foreground border-muted' },
  cancelada: { label: 'Cancelada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
};

export default function Comandas() {
  const [abertas, setAbertas] = useState<Comanda[]>([]);
  const [historico, setHistorico] = useState<ComandaComValor[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const navigate = useNavigate();

  const fetchAbertas = async () => {
    const { data } = await supabase
      .from('comandas')
      .select('*, mesas(numero), clientes(nome)')
      .eq('status', 'aberta')
      .order('opened_at', { ascending: false });
    if (data) setAbertas(data as any[]);
  };

  const fetchHistorico = async () => {
    const from = startOfDay(dateFrom).toISOString();
    const to = endOfDay(dateTo).toISOString();
    const { data } = await supabase
      .from('comandas')
      .select('*, mesas(numero), clientes(nome)')
      .in('status', ['fechada', 'cancelada'])
      .gte('opened_at', from)
      .lte('opened_at', to)
      .order('closed_at', { ascending: false })
      .limit(100);
    if (data) {
      // Fetch totals for each comanda
      const ids = data.map((c: any) => c.id);
      const { data: itensData } = await supabase
        .from('comanda_itens')
        .select('comanda_id, preco_unitario, quantidade, status')
        .in('comanda_id', ids)
        .neq('status', 'cancelado');
      
      const totaisMap: Record<string, number> = {};
      (itensData || []).forEach((i: any) => {
        totaisMap[i.comanda_id] = (totaisMap[i.comanda_id] || 0) + i.preco_unitario * i.quantidade;
      });

      setHistorico(data.map((c: any) => ({ ...c, totalValor: totaisMap[c.id] || 0 })));
    }
  };

  useEffect(() => { fetchAbertas(); }, []);
  useEffect(() => { fetchHistorico(); }, [dateFrom, dateTo]);

  const filteredHistorico = historico.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    const mesa = c.mesas ? `mesa ${c.mesas.numero}` : '';
    const cliente = c.clientes?.nome || '';
    const numero = c.numero ? `#${c.numero}` : '';
    return mesa.toLowerCase().includes(s) || cliente.toLowerCase().includes(s) || c.id.includes(s) || numero.includes(s);
  });

  const { paginatedItems: paginatedHistorico, page: histPage, pageSize: histPageSize, totalPages: histTotalPages, totalItems: histTotalItems, setPage: setHistPage, setPageSize: setHistPageSize } = usePagination(filteredHistorico);

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
      <div>
        <h1 className="text-2xl font-serif text-foreground">Comandas</h1>
        <p className="text-sm text-muted-foreground">{abertas.length} abertas</p>
      </div>

      <Tabs defaultValue="abertas" className="w-full">
        <TabsList>
          <TabsTrigger value="abertas" className="text-xs">Abertas ({abertas.length})</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
        </TabsList>

        {/* ABERTAS */}
        <TabsContent value="abertas" className="mt-4">
          {abertas.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma comanda aberta no momento.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {abertas.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card
                    className="glass glow-red hover:border-primary/40 transition-all cursor-pointer"
                    onClick={() => navigate(`/comanda/${c.id}`)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {c.numero && (
                            <Badge variant="outline" className="font-mono text-xs">
                              #{c.numero}
                            </Badge>
                          )}
                          <span className="text-base font-medium text-foreground">
                            {c.mesas ? `Mesa ${c.mesas.numero}` : 'Sem mesa'}
                          </span>
                        </div>
                        <Badge className={statusConfig.aberta.className}>Aberta</Badge>
                      </div>
                      {c.clientes && <p className="text-xs text-muted-foreground">{c.clientes.nome}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.pessoas} pessoas</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(c.opened_at), 'HH:mm')}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nº, mesa, cliente ou ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <DatePicker date={dateFrom} onChange={setDateFrom} label="De" />
            <span className="text-muted-foreground text-xs">até</span>
            <DatePicker date={dateTo} onChange={setDateTo} label="Até" />
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDateFrom(new Date()); setDateTo(new Date()); }}>Hoje</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDateFrom(startOfWeek(new Date(), { locale: ptBR })); setDateTo(new Date()); }}>Semana</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDateFrom(startOfMonth(new Date())); setDateTo(new Date()); }}>Mês</Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDateFrom(startOfYear(new Date())); setDateTo(new Date()); }}>Ano</Button>
            </div>
          </div>
          <Badge className="bg-success/15 text-success border border-success/30 text-xs font-medium px-3 py-1">
            <CalendarIcon className="h-3 w-3 mr-1.5" />
            Exibindo: {format(dateFrom, "dd/MM/yyyy")} até {format(dateTo, "dd/MM/yyyy")}
            {isEqual(startOfDay(dateFrom), startOfDay(dateTo)) && ' (Hoje)'}
          </Badge>

          {filteredHistorico.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma comanda finalizada ou cancelada no período.
              </CardContent>
            </Card>
          ) : (
            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-20">Nº</TableHead>
                    <TableHead>Mesa</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead>Fechamento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistorico.map(c => (
                    <TableRow key={c.id} className="border-border">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.numero ? `#${c.numero}` : '—'}
                      </TableCell>
                      <TableCell className="font-medium">{c.mesas ? `Mesa ${c.mesas.numero}` : '—'}</TableCell>
                      <TableCell>{c.clientes?.nome || '—'}</TableCell>
                      <TableCell><Badge className={statusConfig[c.status].className}>{statusConfig[c.status].label}</Badge></TableCell>
                      <TableCell className="text-right font-medium">
                        {c.totalValor === 0 && c.status === 'fechada' ? (
                          <span className="flex items-center justify-end gap-1 text-warning">
                            <AlertTriangle className="h-4 w-4" /> R$ 0,00
                          </span>
                        ) : (
                          `R$ ${c.totalValor.toFixed(2)}`
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(c.opened_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell className="text-xs">{c.closed_at ? format(new Date(c.closed_at), 'dd/MM/yyyy HH:mm') : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/comanda/${c.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={histPage}
                totalPages={histTotalPages}
                totalItems={histTotalItems}
                pageSize={histPageSize}
                onPageChange={setHistPage}
                onPageSizeChange={setHistPageSize}
              />
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
