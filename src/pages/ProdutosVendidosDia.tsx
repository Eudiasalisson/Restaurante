import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CalendarIcon, Package, Info, Search } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';

interface ProdutoVendido {
  produto: string;
  quantidade: number;
  valorTotal: number;
  valorUnitario: number;
  comanda: string;
  mesa: string;
  cliente: string;
}

export default function ProdutosVendidosDia() {
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [itens, setItens] = useState<ProdutoVendido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const from = startOfDay(dateFrom).toISOString();
      const to = endOfDay(dateTo).toISOString();

      const [ciRes, eiRes] = await Promise.all([
        supabase.from('comanda_itens')
          .select('quantidade, preco_unitario, produtos(nome), comandas!inner(numero, opened_at, mesa_id, cliente_id, mesas(numero), clientes(nome))')
          .neq('status', 'cancelado')
          .gte('added_at', from)
          .lte('added_at', to),
        supabase.from('entrega_itens')
          .select('quantidade, preco_unitario, produtos(nome), entregas!inner(numero, opened_at, cliente_id, clientes(nome))')
          .neq('status', 'cancelado')
          .gte('entregas.opened_at', from)
          .lte('entregas.opened_at', to),
      ]);

      const results: ProdutoVendido[] = [];
      (ciRes.data || []).forEach((item: any) => {
        results.push({
          produto: item.produtos?.nome || '?',
          quantidade: item.quantidade,
          valorUnitario: item.preco_unitario,
          valorTotal: item.preco_unitario * item.quantidade,
          comanda: item.comandas?.numero ? `#${item.comandas.numero}` : '—',
          mesa: item.comandas?.mesas?.numero ? `Mesa ${item.comandas.mesas.numero}` : '—',
          cliente: item.comandas?.clientes?.nome || '—',
        });
      });
      (eiRes.data || []).forEach((item: any) => {
        results.push({
          produto: item.produtos?.nome || '?',
          quantidade: item.quantidade,
          valorUnitario: item.preco_unitario,
          valorTotal: item.preco_unitario * item.quantidade,
          comanda: item.entregas?.numero ? `D#${item.entregas.numero}` : 'Delivery',
          mesa: '—',
          cliente: item.entregas?.clientes?.nome || '—',
        });
      });

      // Sort by quantity desc
      results.sort((a, b) => b.quantidade - a.quantidade);
      setItens(results);
      setLoading(false);
    };
    fetchData();
  }, [dateFrom, dateTo]);

  const totalQtd = useMemo(() => itens.reduce((s, i) => s + i.quantidade, 0), [itens]);
  const totalValor = useMemo(() => itens.reduce((s, i) => s + i.valorTotal, 0), [itens]);

  const itensFiltrados = useMemo(() => {
    if (!search.trim()) return itens;
    const s = search.toLowerCase();
    return itens.filter(i => i.produto.toLowerCase().includes(s));
  }, [itens, search]);

  const { paginatedItems, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(itensFiltrados);

  const DatePicker = ({ date, onChange, label }: { date: Date; onChange: (d: Date) => void; label: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal text-xs", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {date ? format(date, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar mode="single" selected={date} onSelect={d => d && onChange(d)} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Produtos Vendidos no Dia
          </h1>
          <p className="text-sm text-muted-foreground">{totalQtd} itens vendidos — R$ {totalValor.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePicker date={dateFrom} onChange={setDateFrom} label="De" />
          <span className="text-muted-foreground text-xs">até</span>
          <DatePicker date={dateTo} onChange={setDateTo} label="Até" />
          <Button size="sm" variant="outline" onClick={() => { setDateFrom(startOfDay(new Date())); setDateTo(new Date()); }} className="text-xs">Hoje</Button>
          <Button size="sm" variant="outline" onClick={() => { setDateFrom(subDays(new Date(), 7)); setDateTo(new Date()); }} className="text-xs">7 dias</Button>
          <Button size="sm" variant="outline" onClick={() => { setDateFrom(startOfMonth(new Date())); setDateTo(new Date()); }} className="text-xs">Mês</Button>
          <Button size="sm" variant="outline" onClick={() => { setDateFrom(new Date('2010-01-01')); setDateTo(new Date()); }} className="text-xs">Todo período</Button>
        </div>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs text-muted-foreground">
          Lista todos os produtos vendidos na data selecionada, agrupados individualmente com quantidade, valor unitário, valor total, comanda/delivery de origem, mesa e cliente associado.
        </AlertDescription>
      </Alert>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar produto na listagem..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div>
        </div>
      ) : itens.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum produto vendido nesta data.
          </CardContent>
        </Card>
      ) : itensFiltrados.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum produto encontrado para "{search}" no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Qtd</TableHead>
                <TableHead className="text-right">Unit.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Comanda</TableHead>
                <TableHead>Mesa</TableHead>
                <TableHead>Cliente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell className="font-medium">{item.produto}</TableCell>
                  <TableCell className="text-center">{item.quantidade}</TableCell>
                  <TableCell className="text-right">R$ {item.valorUnitario.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium text-primary">R$ {item.valorTotal.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.comanda}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.mesa}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.cliente}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-border font-bold bg-secondary/30">
                <TableCell>Total do período</TableCell>
                <TableCell className="text-center">{totalQtd}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right text-primary">R$ {totalValor.toFixed(2)}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
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
