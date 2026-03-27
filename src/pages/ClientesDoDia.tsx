import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, isEqual } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Users, Eye, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';

interface ClienteDoDia {
  clienteId: string;
  clienteNome: string;
  data: string;
  tipo: 'Mesa' | 'Delivery';
  numero: string;
  hora: string;
  produtos: string;
  valorTotal: number;
  linkId: string;
  linkType: 'comanda' | 'entrega';
}

export default function ClientesDoDia() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [registros, setRegistros] = useState<ClienteDoDia[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const from = startOfDay(dateFrom).toISOString();
    const to = endOfDay(dateTo).toISOString();

    const [comandasRes, entregasRes] = await Promise.all([
      supabase.from('comandas')
        .select('id, numero, opened_at, cliente_id, clientes(nome)')
        .gte('opened_at', from).lte('opened_at', to)
        .not('cliente_id', 'is', null)
        .order('opened_at', { ascending: false }),
      supabase.from('entregas')
        .select('id, numero, opened_at, cliente_id, clientes(nome)')
        .gte('opened_at', from).lte('opened_at', to)
        .not('cliente_id', 'is', null)
        .order('opened_at', { ascending: false }),
    ]);

    const comandaIds = (comandasRes.data || []).map((c: any) => c.id);
    const entregaIds = (entregasRes.data || []).map((e: any) => e.id);

    const [ciRes, eiRes] = await Promise.all([
      comandaIds.length > 0
        ? supabase.from('comanda_itens').select('comanda_id, produto_id, quantidade, preco_unitario, produtos(nome)').in('comanda_id', comandaIds).neq('status', 'cancelado')
        : { data: [] },
      entregaIds.length > 0
        ? supabase.from('entrega_itens').select('entrega_id, produto_id, quantidade, preco_unitario, produtos(nome)').in('entrega_id', entregaIds).neq('status', 'cancelado')
        : { data: [] },
    ]);

    // Group items by comanda/entrega
    const comandaItensMap: Record<string, { produtos: string[]; total: number }> = {};
    (ciRes.data || []).forEach((i: any) => {
      if (!comandaItensMap[i.comanda_id]) comandaItensMap[i.comanda_id] = { produtos: [], total: 0 };
      comandaItensMap[i.comanda_id].produtos.push(`${i.quantidade}x ${i.produtos?.nome || '?'}`);
      comandaItensMap[i.comanda_id].total += i.preco_unitario * i.quantidade;
    });

    const entregaItensMap: Record<string, { produtos: string[]; total: number }> = {};
    (eiRes.data || []).forEach((i: any) => {
      if (!entregaItensMap[i.entrega_id]) entregaItensMap[i.entrega_id] = { produtos: [], total: 0 };
      entregaItensMap[i.entrega_id].produtos.push(`${i.quantidade}x ${i.produtos?.nome || '?'}`);
      entregaItensMap[i.entrega_id].total += i.preco_unitario * i.quantidade;
    });

    const results: ClienteDoDia[] = [];

    (comandasRes.data || []).forEach((c: any) => {
      const itens = comandaItensMap[c.id];
      results.push({
        clienteId: c.cliente_id,
        clienteNome: c.clientes?.nome || '—',
        data: c.opened_at ? format(new Date(c.opened_at), 'dd/MM/yyyy') : '—',
        tipo: 'Mesa',
        numero: c.numero ? `#${c.numero}` : '—',
        hora: c.opened_at ? format(new Date(c.opened_at), 'HH:mm') : '—',
        produtos: itens?.produtos.join(', ') || '—',
        valorTotal: itens?.total || 0,
        linkId: c.id,
        linkType: 'comanda',
      });
    });

    (entregasRes.data || []).forEach((e: any) => {
      const itens = entregaItensMap[e.id];
      results.push({
        clienteId: e.cliente_id,
        clienteNome: e.clientes?.nome || '—',
        data: e.opened_at ? format(new Date(e.opened_at), 'dd/MM/yyyy') : '—',
        tipo: 'Delivery',
        numero: e.numero ? `D#${e.numero}` : '—',
        hora: e.opened_at ? format(new Date(e.opened_at), 'HH:mm') : '—',
        produtos: itens?.produtos.join(', ') || '—',
        valorTotal: itens?.total || 0,
        linkId: e.id,
        linkType: 'entrega',
      });
    });

    results.sort((a, b) => {
      const da = `${a.data} ${a.hora}`;
      const db = `${b.data} ${b.hora}`;
      return db.localeCompare(da);
    });

    setRegistros(results);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

  const { paginatedItems, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(registros);

  const totalValor = registros.reduce((s, r) => s + r.valorTotal, 0);
  const clientesUnicos = new Set(registros.map(r => r.clienteId)).size;

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
            <Users className="h-6 w-6 text-accent" /> Clientes do Dia
          </h1>
          <p className="text-sm text-muted-foreground">{clientesUnicos} clientes · {registros.length} pedidos</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker date={dateFrom} onChange={setDateFrom} label="De" />
          <span className="text-muted-foreground text-xs">até</span>
          <DatePicker date={dateTo} onChange={setDateTo} label="Até" />
          <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDateFrom(new Date()); setDateTo(new Date()); }}>Hoje</Button>
        </div>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs text-muted-foreground">
          Lista os clientes que realizaram compras no período selecionado, mostrando data, tipo (Mesa/Delivery), número da comanda ou delivery, horário, produtos consumidos e valor total. Clique no ícone de ação para visualizar os detalhes do pedido.
        </AlertDescription>
      </Alert>

      <Badge className="bg-success/15 text-success border border-success/30 text-xs font-medium px-3 py-1">
        <CalendarIcon className="h-3 w-3 mr-1.5" />
        Exibindo: {format(dateFrom, "dd/MM/yyyy")} até {format(dateTo, "dd/MM/yyyy")}
        {isEqual(startOfDay(dateFrom), startOfDay(dateTo)) && ' (Hoje)'}
      </Badge>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Clientes Únicos</p><p className="text-2xl font-bold text-foreground">{clientesUnicos}</p></CardContent></Card>
        <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Total Pedidos</p><p className="text-2xl font-bold text-foreground">{registros.length}</p></CardContent></Card>
        <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Valor Total</p><p className="text-2xl font-bold text-primary">R$ {totalValor.toFixed(2)}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div></div>
      ) : registros.length === 0 ? (
        <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">Nenhum cliente encontrado no período selecionado.</CardContent></Card>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="glass overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead className="max-w-[300px]">Produtos</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((r, i) => (
                  <TableRow key={`${r.linkId}-${i}`} className="border-border">
                    <TableCell className="font-medium">{r.clienteNome}</TableCell>
                    <TableCell className="text-xs">{r.data}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.tipo === 'Delivery' ? 'border-accent/30 text-accent' : 'border-primary/30 text-primary'}>
                        {r.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">{r.numero}</TableCell>
                    <TableCell className="text-xs">{r.hora}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{r.produtos}</TableCell>
                    <TableCell className="text-right font-medium">R$ {r.valorTotal.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => navigate(r.linkType === 'comanda' ? `/comanda/${r.linkId}` : `/entrega/${r.linkId}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
        </motion.div>
      )}
    </div>
  );
}
