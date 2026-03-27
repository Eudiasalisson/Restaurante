import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TablePagination } from '@/components/TablePagination';
import { usePagination } from '@/hooks/usePagination';
import { cn } from '@/lib/utils';
import { CalendarIcon, ShoppingBag, Info } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

interface VendaDia {
  tipo: 'Comanda' | 'Delivery';
  numero: number | null;
  cliente: string;
  valorTotal: number;
  horario: string;
}

export default function VendasDoDia() {
  const [date, setDate] = useState<Date>(new Date());
  const [vendas, setVendas] = useState<VendaDia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const from = startOfDay(date).toISOString();
      const to = endOfDay(date).toISOString();

      const [comandasRes, entregasRes] = await Promise.all([
        supabase.from('comandas')
          .select('id, numero, opened_at, status, cliente_id, clientes(nome)')
          .in('status', ['fechada', 'aberta'])
          .gte('opened_at', from)
          .lte('opened_at', to)
          .order('opened_at', { ascending: false }),
        supabase.from('entregas')
          .select('id, numero, opened_at, status, cliente_id, clientes(nome)')
          .in('status', ['aberta', 'em_preparo', 'saiu_entrega', 'entregue'])
          .gte('opened_at', from)
          .lte('opened_at', to)
          .order('opened_at', { ascending: false }),
      ]);

      const comandaIds = (comandasRes.data || []).map(c => c.id);
      const entregaIds = (entregasRes.data || []).map(e => e.id);

      // Fetch items for all
      let comandaItens: any[] = [];
      let entregaItens: any[] = [];

      const batchSize = 50;
      for (let i = 0; i < comandaIds.length; i += batchSize) {
        const batch = comandaIds.slice(i, i + batchSize);
        const { data } = await supabase.from('comanda_itens').select('comanda_id, quantidade, preco_unitario').in('comanda_id', batch).neq('status', 'cancelado');
        if (data) comandaItens.push(...data);
      }
      for (let i = 0; i < entregaIds.length; i += batchSize) {
        const batch = entregaIds.slice(i, i + batchSize);
        const { data } = await supabase.from('entrega_itens').select('entrega_id, quantidade, preco_unitario').in('entrega_id', batch).neq('status', 'cancelado');
        if (data) entregaItens.push(...data);
      }

      // Sum items per comanda/entrega
      const comandaTotals: Record<string, number> = {};
      comandaItens.forEach(i => { comandaTotals[i.comanda_id] = (comandaTotals[i.comanda_id] || 0) + i.quantidade * Number(i.preco_unitario); });
      const entregaTotals: Record<string, number> = {};
      entregaItens.forEach(i => { entregaTotals[i.entrega_id] = (entregaTotals[i.entrega_id] || 0) + i.quantidade * Number(i.preco_unitario); });

      const results: VendaDia[] = [];

      (comandasRes.data || []).forEach((c: any) => {
        results.push({
          tipo: 'Comanda',
          numero: c.numero,
          cliente: c.clientes?.nome || '—',
          valorTotal: comandaTotals[c.id] || 0,
          horario: c.opened_at,
        });
      });

      (entregasRes.data || []).forEach((e: any) => {
        results.push({
          tipo: 'Delivery',
          numero: e.numero,
          cliente: e.clientes?.nome || '—',
          valorTotal: entregaTotals[e.id] || 0,
          horario: e.opened_at,
        });
      });

      results.sort((a, b) => new Date(b.horario).getTime() - new Date(a.horario).getTime());
      setVendas(results);
      setLoading(false);
    };
    fetchData();
  }, [date]);

  const totalComandas = vendas.filter(v => v.tipo === 'Comanda').length;
  const totalEntregas = vendas.filter(v => v.tipo === 'Delivery').length;
  const totalValor = useMemo(() => vendas.reduce((s, v) => s + v.valorTotal, 0), [vendas]);
  const valorComandas = useMemo(() => vendas.filter(v => v.tipo === 'Comanda').reduce((s, v) => s + v.valorTotal, 0), [vendas]);
  const valorEntregas = useMemo(() => vendas.filter(v => v.tipo === 'Delivery').reduce((s, v) => s + v.valorTotal, 0), [vendas]);

  const pagination = usePagination(vendas, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" /> Vendas do Dia
          </h1>
          <p className="text-sm text-muted-foreground">
            {vendas.length} pedidos — R$ {totalValor.toFixed(2)}
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={date} onSelect={d => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs text-muted-foreground">
          Listagem de todas as comandas e entregas do dia selecionado, com tipo, número, cliente e valor total de cada pedido.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Total Pedidos</p>
                <p className="text-xl font-bold text-foreground">{vendas.length}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Comandas</p>
                <p className="text-xl font-bold text-foreground">{totalComandas}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Entregas</p>
                <p className="text-xl font-bold text-foreground">{totalEntregas}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">V. Comandas</p>
                <p className="text-xl font-bold text-foreground">R$ {valorComandas.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">V. Entregas</p>
                <p className="text-xl font-bold text-gradient-gold">R$ {valorEntregas.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          {vendas.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum pedido encontrado nesta data.
              </CardContent>
            </Card>
          ) : (
            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Horário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((v, i) => (
                    <TableRow key={`${v.tipo}-${v.numero}-${i}`} className="border-border">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {v.horario ? format(new Date(v.horario), 'HH:mm') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.tipo === 'Comanda' ? 'default' : 'secondary'} className="text-xs">
                          {v.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {v.tipo === 'Comanda' ? `#${v.numero}` : `D#${v.numero}`}
                      </TableCell>
                      <TableCell>{v.cliente}</TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        R$ {v.valorTotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-border font-bold bg-secondary/30">
                    <TableCell colSpan={4}>Total</TableCell>
                    <TableCell className="text-right text-primary">R$ {totalValor.toFixed(2)}</TableCell>
                  </TableRow>
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
          )}
        </>
      )}
    </div>
  );
}
