import { useEffect, useState } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Plus, Clock, Eye, User, Search, CalendarIcon, MessageCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format, formatDistanceToNow, startOfMonth, startOfYear, startOfWeek, endOfDay, startOfDay, isEqual } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovaEntregaModal } from '@/components/NovaEntregaModal';

interface Entrega {
  id: string;
  numero: number | null;
  status: string;
  opened_at: string | null;
  taxa_entrega: number | null;
  clientes: { nome: string; whatsapp: string | null } | null;
  funcionarios: { nome: string } | null;
  enderecos_cliente: { logradouro: string | null; bairro: string | null } | null;
}

interface EntregaComValor extends Entrega {
  totalValor: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  aberta: { label: 'Aberta', className: 'bg-warning/20 text-warning border-warning/30' },
  em_preparo: { label: 'Em Preparo', className: 'bg-accent/20 text-accent border-accent/30' },
  saiu_entrega: { label: 'Saiu p/ Entrega', className: 'bg-primary/20 text-primary border-primary/30' },
  entregue: { label: 'Entregue', className: 'bg-success/20 text-success border-success/30' },
  cancelada: { label: 'Cancelada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
};

export default function Entregas() {
  const navigate = useNavigate();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [historico, setHistorico] = useState<EntregaComValor[]>([]);
  const [novaEntregaModal, setNovaEntregaModal] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());

  const fetchEntregas = async () => {
    const { data } = await supabase.from('entregas')
      .select('*, clientes(nome, whatsapp), funcionarios!funcionario_id(nome), enderecos_cliente(logradouro, bairro)')
      .in('status', ['aberta', 'em_preparo', 'saiu_entrega'])
      .order('opened_at', { ascending: false });
    if (data) setEntregas(data as any);
  };

  const fetchHistorico = async () => {
    const from = startOfDay(dateFrom).toISOString();
    const to = endOfDay(dateTo).toISOString();
    const { data } = await supabase.from('entregas')
      .select('*, clientes(nome, whatsapp), funcionarios!funcionario_id(nome), enderecos_cliente(logradouro, bairro)')
      .in('status', ['entregue', 'cancelada'])
      .gte('opened_at', from)
      .lte('opened_at', to)
      .order('opened_at', { ascending: false })
      .limit(100);
    if (data) {
      const ids = data.map((e: any) => e.id);
      const { data: itensData } = await supabase
        .from('entrega_itens')
        .select('entrega_id, preco_unitario, quantidade, status')
        .in('entrega_id', ids)
        .neq('status', 'cancelado');
      
      const totaisMap: Record<string, number> = {};
      (itensData || []).forEach((i: any) => {
        totaisMap[i.entrega_id] = (totaisMap[i.entrega_id] || 0) + i.preco_unitario * i.quantidade;
      });

      setHistorico(data.map((e: any) => ({ ...e, totalValor: totaisMap[e.id] || 0 })));
    }
  };

  useEffect(() => { fetchEntregas(); }, []);
  useEffect(() => { fetchHistorico(); }, [dateFrom, dateTo]);

  const filteredHistorico = historico.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    const cliente = e.clientes?.nome || '';
    const endereco = [e.enderecos_cliente?.logradouro, e.enderecos_cliente?.bairro].filter(Boolean).join(' ');
    const numStr = e.numero ? `#${e.numero}` : '';
    return cliente.toLowerCase().includes(s) || endereco.toLowerCase().includes(s) || e.id.includes(s) || numStr.includes(s);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-accent" /> Entregas
          </h1>
          <p className="text-sm text-muted-foreground">{entregas.length} em andamento</p>
        </div>
        <Button onClick={() => setNovaEntregaModal(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Pedido Delivery
        </Button>
      </div>

      <Tabs defaultValue="ativas" className="w-full">
        <TabsList>
          <TabsTrigger value="ativas" className="text-xs">Em Andamento ({entregas.length})</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
        </TabsList>

        {/* ATIVAS */}
        <TabsContent value="ativas" className="mt-4">
          {entregas.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum pedido de delivery em aberto. Clique em "Novo Pedido Delivery" para criar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entregas.map((entrega, i) => {
                const config = statusConfig[entrega.status] || statusConfig.aberta;
                return (
                  <motion.div key={entrega.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="glass hover:border-accent/30 transition-colors cursor-pointer" onClick={() => navigate(`/entrega/${entrega.id}`)}>
                      <CardContent className="pt-5 space-y-3">
                        <div className="flex items-start justify-between">
                        <div>
                            <p className="font-medium text-foreground text-sm flex items-center gap-1">
                              {entrega.numero && <span className="text-xs text-muted-foreground font-mono">#{entrega.numero}</span>}
                              <User className="h-3 w-3" /> {entrega.clientes?.nome || 'Sem cliente'}
                              {entrega.clientes?.whatsapp && (
                                <a
                                  href={`https://wa.me/${entrega.clientes.whatsapp.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors"
                                  title="WhatsApp"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <MessageCircle className="h-3 w-3" />
                                </a>
                              )}
                            </p>
                            {entrega.enderecos_cliente && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {[entrega.enderecos_cliente.logradouro, entrega.enderecos_cliente.bairro].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                          <Badge className={config.className}>{config.label}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {entrega.opened_at ? formatDistanceToNow(new Date(entrega.opened_at), { locale: ptBR, addSuffix: true }) : '-'}
                          </span>
                          {entrega.funcionarios && <span>{entrega.funcionarios.nome}</span>}
                        </div>
                        <Button size="sm" className="w-full text-xs" variant="outline">
                          <Eye className="h-3 w-3 mr-1" /> Ver Pedido
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, endereço ou ID..."
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
                Nenhum pedido finalizado ou cancelado no período.
              </CardContent>
            </Card>
          ) : (
            <Card className="glass overflow-hidden">
              <Table>
                 <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistorico.map(e => {
                    const config = statusConfig[e.status] || statusConfig.entregue;
                    return (
                      <TableRow key={e.id} className="border-border">
                        <TableCell className="font-mono text-xs font-medium">#{e.numero || '—'}</TableCell>
                        <TableCell className="font-medium">{e.clientes?.nome || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {[e.enderecos_cliente?.logradouro, e.enderecos_cliente?.bairro].filter(Boolean).join(', ') || '—'}
                        </TableCell>
                        <TableCell><Badge className={config.className}>{config.label}</Badge></TableCell>
                        <TableCell className="text-right font-medium">
                          {e.totalValor === 0 && e.status === 'entregue' ? (
                            <span className="flex items-center justify-end gap-1 text-warning">
                              <AlertTriangle className="h-4 w-4" /> R$ 0,00
                            </span>
                          ) : (
                            `R$ ${e.totalValor.toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{e.opened_at ? format(new Date(e.opened_at), 'dd/MM/yyyy HH:mm') : '—'}</TableCell>
                        <TableCell className="text-xs">{e.funcionarios?.nome || '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/entrega/${e.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      <NovaEntregaModal open={novaEntregaModal} onOpenChange={setNovaEntregaModal} onSuccess={fetchEntregas} />
    </div>
  );
}
