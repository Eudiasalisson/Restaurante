import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { CalendarIcon, Package, Info } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [date, setDate] = useState<Date>(new Date());
  const [itens, setItens] = useState<ProdutoVendido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const from = startOfDay(date).toISOString();
      const to = endOfDay(date).toISOString();

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
  }, [date]);

  const totalQtd = useMemo(() => itens.reduce((s, i) => s + i.quantidade, 0), [itens]);
  const totalValor = useMemo(() => itens.reduce((s, i) => s + i.valorTotal, 0), [itens]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Produtos Vendidos no Dia
          </h1>
          <p className="text-sm text-muted-foreground">{totalQtd} itens vendidos — R$ {totalValor.toFixed(2)}</p>
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
          Lista todos os produtos vendidos na data selecionada, agrupados individualmente com quantidade, valor unitário, valor total, comanda/delivery de origem, mesa e cliente associado.
        </AlertDescription>
      </Alert>

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
              {itens.map((item, i) => (
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
                <TableCell>Total</TableCell>
                <TableCell className="text-center">{totalQtd}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right text-primary">R$ {totalValor.toFixed(2)}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
