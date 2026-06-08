import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfDay, startOfDay, subDays, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Eye, BarChart3, PieChart as PieChartIcon, TrendingUp, Truck, Grid3X3, Package, Users, ArrowUpDown, Info, ChevronsUpDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid
} from 'recharts';
import jsPDF from 'jspdf';

const COLORS = [
  'hsl(220, 70%, 55%)',
  'hsl(142, 71%, 45%)',
  'hsl(43, 90%, 50%)',
  'hsl(280, 60%, 60%)',
  'hsl(0, 72%, 55%)',
  'hsl(190, 80%, 48%)',
  'hsl(30, 85%, 55%)',
  'hsl(320, 65%, 55%)',
  'hsl(160, 60%, 42%)',
  'hsl(260, 55%, 65%)',
  'hsl(10, 80%, 58%)',
  'hsl(200, 75%, 52%)',
];

export default function Relatorios() {
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [comandas, setComandas] = useState<any[]>([]);
  const [entregas, setEntregas] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [comandaItens, setComandaItens] = useState<any[]>([]);
  const [entregaItens, setEntregaItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [produtos, setProdutos] = useState<any[]>([]);
  const [selectedProduto, setSelectedProduto] = useState<string>('');
  const [produtoHistorico, setProdutoHistorico] = useState<any[]>([]);
  const [loadingProduto, setLoadingProduto] = useState(false);
  const [produtoComboOpen, setProdutoComboOpen] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState('');

  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [clienteHistorico, setClienteHistorico] = useState<any[]>([]);
  const [loadingCliente, setLoadingCliente] = useState(false);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewContent, setPreviewContent] = useState<React.ReactNode>(null);

  const fetchData = async () => {
    setLoading(true);
    const from = startOfDay(dateFrom).toISOString();
    const to = endOfDay(dateTo).toISOString();

    const [comandasRes, entregasRes, pagRes, ciRes, eiRes, produtosRes, clientesRes] = await Promise.all([
      supabase.from('comandas').select('*').gte('opened_at', from).lte('opened_at', to),
      supabase.from('entregas').select('*, enderecos_cliente(bairro)').gte('opened_at', from).lte('opened_at', to),
      supabase.from('pagamentos').select('*').gte('created_at', from).lte('created_at', to),
      supabase.from('comanda_itens').select('*, produtos(nome), comandas!inner(opened_at)').neq('status', 'cancelado'),
      supabase.from('entrega_itens').select('*, produtos(nome), entregas!inner(opened_at)').neq('status', 'cancelado'),
      supabase.from('produtos').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('clientes').select('id, nome').order('nome'),
    ]);

    setComandas(comandasRes.data || []);
    setEntregas(entregasRes.data || []);
    setPagamentos(pagRes.data || []);
    setProdutos(produtosRes.data || []);
    setClientes(clientesRes.data || []);

    const filterByDate = (items: any[]) =>
      items.filter(i => {
        const d = i.comandas?.opened_at || i.entregas?.opened_at;
        return d && d >= from && d <= to;
      });

    setComandaItens(filterByDate(ciRes.data || []));
    setEntregaItens(filterByDate(eiRes.data || []));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [dateFrom, dateTo]);

  // Fetch product sales history
  useEffect(() => {
    if (!selectedProduto) { setProdutoHistorico([]); return; }
    const fetchProdutoHistory = async () => {
      setLoadingProduto(true);
      const from = startOfDay(dateFrom).toISOString();
      const to = endOfDay(dateTo).toISOString();

      const [ciRes, eiRes] = await Promise.all([
        supabase.from('comanda_itens')
          .select('quantidade, preco_unitario, added_at, comandas!inner(id, opened_at, mesa_id, cliente_id, mesas(numero), clientes(nome))')
          .eq('produto_id', selectedProduto).neq('status', 'cancelado')
          .gte('added_at', from).lte('added_at', to)
          .order('added_at', { ascending: false }),
        supabase.from('entrega_itens')
          .select('quantidade, preco_unitario, entregas!inner(id, opened_at, cliente_id, clientes(nome))')
          .eq('produto_id', selectedProduto).neq('status', 'cancelado')
          .gte('entregas.opened_at', from).lte('entregas.opened_at', to)
          .order('entregas(opened_at)', { ascending: false }),
      ]);

      const results: any[] = [];
      (ciRes.data || []).forEach((item: any) => {
        results.push({ tipo: 'Mesa', mesa: item.comandas?.mesas?.numero ? `Mesa ${item.comandas.mesas.numero}` : '—', cliente: item.comandas?.clientes?.nome || '—', quantidade: item.quantidade, valor: item.preco_unitario * item.quantidade, data: item.added_at });
      });
      (eiRes.data || []).forEach((item: any) => {
        results.push({ tipo: 'Delivery', mesa: '—', cliente: item.entregas?.clientes?.nome || '—', quantidade: item.quantidade, valor: item.preco_unitario * item.quantidade, data: item.entregas?.opened_at });
      });
      results.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setProdutoHistorico(results);
      setLoadingProduto(false);
    };
    fetchProdutoHistory();
  }, [selectedProduto, dateFrom, dateTo]);

  // Fetch client consumption history
  useEffect(() => {
    if (!selectedCliente) { setClienteHistorico([]); return; }
    const fetchClienteHistory = async () => {
      setLoadingCliente(true);
      const from = startOfDay(dateFrom).toISOString();
      const to = endOfDay(dateTo).toISOString();

      const [ciRes, eiRes] = await Promise.all([
        supabase.from('comanda_itens')
          .select('quantidade, preco_unitario, added_at, produtos(nome), comandas!inner(id, opened_at, numero, mesa_id, cliente_id, mesas(numero))')
          .eq('comandas.cliente_id', selectedCliente).neq('status', 'cancelado')
          .gte('added_at', from).lte('added_at', to)
          .order('added_at', { ascending: false }),
        supabase.from('entrega_itens')
          .select('quantidade, preco_unitario, produtos(nome), entregas!inner(id, numero, opened_at, cliente_id)')
          .eq('entregas.cliente_id', selectedCliente).neq('status', 'cancelado')
          .gte('entregas.opened_at', from).lte('entregas.opened_at', to),
      ]);

      const results: any[] = [];
      (ciRes.data || []).forEach((item: any) => {
        const comNum = item.comandas?.numero ? `#${item.comandas.numero}` : '—';
        results.push({ tipo: 'Mesa', comanda: comNum, produto: item.produtos?.nome || '?', quantidade: item.quantidade, valor: item.preco_unitario * item.quantidade, preco_unitario: item.preco_unitario, data: item.added_at });
      });
      (eiRes.data || []).forEach((item: any) => {
        const delNum = item.entregas?.numero ? `D#${item.entregas.numero}` : 'Delivery';
        results.push({ tipo: 'Delivery', comanda: delNum, produto: item.produtos?.nome || '?', quantidade: item.quantidade, valor: item.preco_unitario * item.quantidade, preco_unitario: item.preco_unitario, data: item.entregas?.opened_at });
      });
      results.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setClienteHistorico(results);
      setLoadingCliente(false);
    };
    fetchClienteHistory();
  }, [selectedCliente, dateFrom, dateTo]);

  // ===== COMPUTED DATA =====
  const vendasData = useMemo(() => {
    const totalFaturado = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
    const numComandas = comandas.filter(c => c.status === 'fechada').length;
    const numEntregas = entregas.filter(e => e.status === 'entregue').length;
    const totalOps = numComandas + numEntregas;
    const ticketMedio = totalOps > 0 ? totalFaturado / totalOps : 0;
    const dailyMap: Record<string, number> = {};
    pagamentos.forEach(p => { const day = format(new Date(p.created_at), 'dd/MM'); dailyMap[day] = (dailyMap[day] || 0) + Number(p.valor); });
    const dailyChart = Object.entries(dailyMap).map(([dia, valor]) => ({ dia, valor }));
    return { totalFaturado, numComandas, numEntregas, ticketMedio, dailyChart };
  }, [pagamentos, comandas, entregas]);

  const produtosRanking = useMemo(() => {
    const map: Record<string, { nome: string; qtd: number; valor: number }> = {};
    [...comandaItens, ...entregaItens].forEach(item => {
      const nome = item.produtos?.nome || '?';
      if (!map[nome]) map[nome] = { nome, qtd: 0, valor: 0 };
      map[nome].qtd += item.quantidade;
      map[nome].valor += item.preco_unitario * item.quantidade;
    });
    return Object.values(map).sort((a, b) => b.qtd - a.qtd).slice(0, 15);
  }, [comandaItens, entregaItens]);

  const formasPagamento = useMemo(() => {
    const labels: Record<string, string> = { dinheiro: 'Dinheiro', cartao_credito: 'C. Crédito', cartao_debito: 'C. Débito', pix: 'PIX', outro: 'Outro' };
    const map: Record<string, number> = {};
    pagamentos.forEach(p => { const label = labels[p.forma] || p.forma; map[label] = (map[label] || 0) + Number(p.valor); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [pagamentos]);

  const ocupacaoMesas = useMemo(() => {
    const fechadas = comandas.filter(c => c.status === 'fechada' && c.opened_at && c.closed_at);
    if (fechadas.length === 0) return { mediaMinutos: 0, total: 0 };
    const totalMinutos = fechadas.reduce((s, c) => s + differenceInMinutes(new Date(c.closed_at), new Date(c.opened_at)), 0);
    return { mediaMinutos: Math.round(totalMinutos / fechadas.length), total: fechadas.length };
  }, [comandas]);

  const deliveryData = useMemo(() => {
    const entregues = entregas.filter(e => e.status === 'entregue');
    const totalValor = entregaItens.reduce((s, i) => s + i.preco_unitario * i.quantidade, 0);
    const bairroMap: Record<string, number> = {};
    entregas.forEach(e => { const bairro = e.enderecos_cliente?.bairro || 'Não informado'; bairroMap[bairro] = (bairroMap[bairro] || 0) + 1; });
    const bairros = Object.entries(bairroMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    return { total: entregas.length, entregues: entregues.length, totalValor, bairros };
  }, [entregas, entregaItens]);

  // Saída de produtos: all active products with their sales count
  const saidaProdutos = useMemo(() => {
    const salesMap: Record<string, { qtd: number; valor: number }> = {};
    [...comandaItens, ...entregaItens].forEach(item => {
      const pid = item.produto_id;
      if (!salesMap[pid]) salesMap[pid] = { qtd: 0, valor: 0 };
      salesMap[pid].qtd += item.quantidade;
      salesMap[pid].valor += item.preco_unitario * item.quantidade;
    });
    return produtos.map(p => ({
      id: p.id,
      nome: p.nome,
      qtd: salesMap[p.id]?.qtd || 0,
      valor: salesMap[p.id]?.valor || 0,
    })).sort((a, b) => b.qtd - a.qtd);
  }, [produtos, comandaItens, entregaItens]);

  const periodoStr = `${format(dateFrom, 'dd/MM/yyyy')} a ${format(dateTo, 'dd/MM/yyyy')}`;
  const selectedProdutoNome = produtos.find(p => p.id === selectedProduto)?.nome || '';
  const selectedClienteNome = clientes.find(c => c.id === selectedCliente)?.nome || '';

  // ===== A4 PDF GENERATOR =====
  const generateA4PDF = (title: string, content: string[]): Blob => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 14;
    let y = 20;
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y); y += 10;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${periodoStr}`, margin, y); y += 10;

    content.forEach(line => {
      if (y > 275) { doc.addPage(); y = 20; }
      if (line.startsWith('##')) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(line.replace('## ', ''), margin, y); y += 7;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      } else {
        doc.text(line, margin, y); y += 5;
      }
    });

    doc.setFontSize(7);
    doc.text(`Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, 287);
    return doc.output('blob');
  };

  // ===== PREVIEW OPENERS =====
  const openPreview = (title: string, fileName: string, blob: Blob, content: React.ReactNode) => {
    setPreviewTitle(title);
    setPreviewFileName(fileName);
    setPreviewBlob(blob);
    setPreviewContent(content);
    setPreviewOpen(true);
  };

  const openVendasPreview = () => {
    const lines = [
      '## Resumo', `Total Faturado: R$ ${vendasData.totalFaturado.toFixed(2)}`, `Ticket Médio: R$ ${vendasData.ticketMedio.toFixed(2)}`,
      `Comandas Fechadas: ${vendasData.numComandas}`, `Entregas Finalizadas: ${vendasData.numEntregas}`,
      '', '## Faturamento Diário', ...vendasData.dailyChart.map(d => `${d.dia}: R$ ${d.valor.toFixed(2)}`),
    ];
    openPreview('Relatório de Vendas', 'relatorio-vendas.pdf', generateA4PDF('Relatório de Vendas', lines),
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">RELATÓRIO DE VENDAS</h2>
          <p className="text-muted-foreground">Período: {periodoStr}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded bg-secondary/50"><p className="text-[10px] text-muted-foreground uppercase">Total Faturado</p><p className="font-bold text-primary">R$ {vendasData.totalFaturado.toFixed(2)}</p></div>
          <div className="p-3 rounded bg-secondary/50"><p className="text-[10px] text-muted-foreground uppercase">Ticket Médio</p><p className="font-bold">R$ {vendasData.ticketMedio.toFixed(2)}</p></div>
          <div className="p-3 rounded bg-secondary/50"><p className="text-[10px] text-muted-foreground uppercase">Comandas</p><p className="font-bold">{vendasData.numComandas}</p></div>
          <div className="p-3 rounded bg-secondary/50"><p className="text-[10px] text-muted-foreground uppercase">Entregas</p><p className="font-bold">{vendasData.numEntregas}</p></div>
        </div>
        {vendasData.dailyChart.length > 0 && (
          <div>
            <p className="font-semibold mb-2">Faturamento Diário</p>
            <table className="w-full text-sm"><tbody>
              {vendasData.dailyChart.map(d => (
                <tr key={d.dia} className="border-b border-border/50"><td className="py-1">{d.dia}</td><td className="py-1 text-right font-medium">R$ {d.valor.toFixed(2)}</td></tr>
              ))}
            </tbody></table>
          </div>
        )}
      </div>
    );
  };

  const openProdutosPreview = () => {
    const lines = ['## Ranking', ...produtosRanking.map((p, i) => `${i + 1}. ${p.nome} — ${p.qtd} un — R$ ${p.valor.toFixed(2)}`)];
    openPreview('Produtos Mais Vendidos', 'produtos-ranking.pdf', generateA4PDF('Produtos Mais Vendidos', lines),
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">PRODUTOS MAIS VENDIDOS</h2>
          <p className="text-muted-foreground">Período: {periodoStr}</p>
        </div>
        <table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="pb-2 text-left">#</th><th className="pb-2 text-left">Produto</th><th className="pb-2 text-right">Qtd</th><th className="pb-2 text-right">Valor</th></tr></thead>
        <tbody>{produtosRanking.map((p, i) => (
          <tr key={p.nome} className="border-b border-border/50"><td className="py-1">{i+1}</td><td className="py-1">{p.nome}</td><td className="py-1 text-right">{p.qtd}</td><td className="py-1 text-right font-medium">R$ {p.valor.toFixed(2)}</td></tr>
        ))}</tbody></table>
      </div>
    );
  };

  const openPagamentosPreview = () => {
    const lines = ['## Distribuição', ...formasPagamento.map(f => `${f.name}: R$ ${f.value.toFixed(2)}`)];
    openPreview('Formas de Pagamento', 'formas-pagamento.pdf', generateA4PDF('Formas de Pagamento', lines),
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">FORMAS DE PAGAMENTO</h2>
          <p className="text-muted-foreground">Período: {periodoStr}</p>
        </div>
        <table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="pb-2 text-left">Forma</th><th className="pb-2 text-right">Valor</th></tr></thead>
        <tbody>{formasPagamento.map(f => (
          <tr key={f.name} className="border-b border-border/50"><td className="py-1">{f.name}</td><td className="py-1 text-right font-medium">R$ {f.value.toFixed(2)}</td></tr>
        ))}</tbody></table>
      </div>
    );
  };

  const openMesasPreview = () => {
    const lines = ['## Resumo', `Comandas fechadas no período: ${ocupacaoMesas.total}`, `Tempo médio de ocupação: ${ocupacaoMesas.mediaMinutos} minutos`];
    openPreview('Ocupação de Mesas', 'ocupacao-mesas.pdf', generateA4PDF('Ocupação de Mesas', lines),
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">OCUPAÇÃO DE MESAS</h2>
          <p className="text-muted-foreground">Período: {periodoStr}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Comandas Fechadas</p><p className="text-2xl font-bold">{ocupacaoMesas.total}</p></div>
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Tempo Médio</p><p className="text-2xl font-bold">{Math.floor(ocupacaoMesas.mediaMinutos/60)}h{String(ocupacaoMesas.mediaMinutos%60).padStart(2,'0')}min</p></div>
        </div>
      </div>
    );
  };

  const openDeliveryPreview = () => {
    const lines = ['## Resumo', `Total de pedidos: ${deliveryData.total}`, `Pedidos entregues: ${deliveryData.entregues}`, `Valor total: R$ ${deliveryData.totalValor.toFixed(2)}`, '', '## Bairros Mais Atendidos', ...deliveryData.bairros.map((b, i) => `${i+1}. ${b.name}: ${b.value} pedidos`)];
    openPreview('Relatório de Delivery', 'relatorio-delivery.pdf', generateA4PDF('Relatório de Delivery', lines),
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">RELATÓRIO DE DELIVERY</h2>
          <p className="text-muted-foreground">Período: {periodoStr}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Pedidos</p><p className="text-xl font-bold">{deliveryData.total}</p></div>
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Entregues</p><p className="text-xl font-bold text-success">{deliveryData.entregues}</p></div>
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Valor Total</p><p className="text-xl font-bold text-primary">R$ {deliveryData.totalValor.toFixed(2)}</p></div>
        </div>
        {deliveryData.bairros.length > 0 && (
          <div><p className="font-semibold mb-2">Bairros Mais Atendidos</p>
          <table className="w-full text-sm"><tbody>{deliveryData.bairros.map((b, i) => (
            <tr key={b.name} className="border-b border-border/50"><td className="py-1">{i+1}. {b.name}</td><td className="py-1 text-right">{b.value} pedidos</td></tr>
          ))}</tbody></table></div>
        )}
      </div>
    );
  };

  const openProdutoHistPreview = () => {
    const lines = [`## ${selectedProdutoNome}`, `Total de vendas no período: ${produtoHistorico.length}`, `Quantidade total: ${produtoHistorico.reduce((s,r)=>s+r.quantidade,0)} un`, `Valor total: R$ ${produtoHistorico.reduce((s,r)=>s+r.valor,0).toFixed(2)}`, '', '## Detalhamento', ...produtoHistorico.map(r => `${format(new Date(r.data), 'dd/MM/yyyy HH:mm')} | ${r.tipo} | ${r.mesa} | ${r.cliente} | ${r.quantidade}x | R$ ${r.valor.toFixed(2)}`)];
    openPreview(`Histórico — ${selectedProdutoNome}`, 'historico-produto.pdf', generateA4PDF(`Histórico de Vendas — ${selectedProdutoNome}`, lines),
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">HISTÓRICO DE VENDAS</h2>
          <p className="font-medium">{selectedProdutoNome}</p>
          <p className="text-muted-foreground">Período: {periodoStr}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Vendas</p><p className="font-bold">{produtoHistorico.length}</p></div>
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Qtd</p><p className="font-bold">{produtoHistorico.reduce((s,r)=>s+r.quantidade,0)}</p></div>
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Valor</p><p className="font-bold text-primary">R$ {produtoHistorico.reduce((s,r)=>s+r.valor,0).toFixed(2)}</p></div>
        </div>
        <table className="w-full text-xs"><thead><tr className="border-b border-border"><th className="pb-1 text-left">Data</th><th className="pb-1">Tipo</th><th className="pb-1">Mesa</th><th className="pb-1">Cliente</th><th className="pb-1 text-right">Qtd</th><th className="pb-1 text-right">Valor</th></tr></thead>
        <tbody>{produtoHistorico.map((r,i) => (
          <tr key={i} className="border-b border-border/50"><td className="py-1">{format(new Date(r.data),'dd/MM HH:mm')}</td><td className="py-1">{r.tipo}</td><td className="py-1">{r.mesa}</td><td className="py-1">{r.cliente}</td><td className="py-1 text-right">{r.quantidade}</td><td className="py-1 text-right font-medium">R$ {r.valor.toFixed(2)}</td></tr>
        ))}</tbody></table>
      </div>
    );
  };

  const openClienteHistPreview = () => {
    const lines = [`## ${selectedClienteNome}`, `Itens consumidos no período: ${clienteHistorico.length}`, `Valor total: R$ ${clienteHistorico.reduce((s,r)=>s+r.valor,0).toFixed(2)}`, '', '## Detalhamento', ...clienteHistorico.map(r => `${format(new Date(r.data),'dd/MM/yyyy HH:mm')} | ${r.tipo} | ${r.comanda} | ${r.produto} | ${r.quantidade}x R$ ${r.preco_unitario.toFixed(2)} = R$ ${r.valor.toFixed(2)}`)];
    openPreview(`Histórico — ${selectedClienteNome}`, 'historico-cliente.pdf', generateA4PDF(`Histórico de Consumo — ${selectedClienteNome}`, lines),
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">HISTÓRICO DE CONSUMO</h2>
          <p className="font-medium">{selectedClienteNome}</p>
          <p className="text-muted-foreground">Período: {periodoStr}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Itens</p><p className="font-bold">{clienteHistorico.length}</p></div>
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Qtd</p><p className="font-bold">{clienteHistorico.reduce((s,r)=>s+r.quantidade,0)}</p></div>
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Valor</p><p className="font-bold text-primary">R$ {clienteHistorico.reduce((s,r)=>s+r.valor,0).toFixed(2)}</p></div>
        </div>
        <table className="w-full text-xs"><thead><tr className="border-b border-border"><th className="pb-1 text-left">Data</th><th className="pb-1">Tipo</th><th className="pb-1">Comanda</th><th className="pb-1">Produto</th><th className="pb-1 text-right">Qtd</th><th className="pb-1 text-right">Unit.</th><th className="pb-1 text-right">Total</th></tr></thead>
        <tbody>{clienteHistorico.map((r,i) => (
          <tr key={i} className="border-b border-border/50"><td className="py-1">{format(new Date(r.data),'dd/MM HH:mm')}</td><td className="py-1">{r.tipo}</td><td className="py-1">{r.comanda}</td><td className="py-1">{r.produto}</td><td className="py-1 text-right">{r.quantidade}</td><td className="py-1 text-right">R$ {r.preco_unitario.toFixed(2)}</td><td className="py-1 text-right font-medium">R$ {r.valor.toFixed(2)}</td></tr>
        ))}</tbody></table>
      </div>
    );
  };

  const openSaidaProdutosPreview = () => {
    const maisSaida = saidaProdutos.filter(p => p.qtd > 0);
    const menosSaida = saidaProdutos.filter(p => p.qtd === 0);
    const lines = [
      '## Produtos com Maior Saída',
      ...maisSaida.map((p, i) => `${i + 1}. ${p.nome} — ${p.qtd} un — R$ ${p.valor.toFixed(2)}`),
      '', '## Produtos sem Saída',
      ...(menosSaida.length > 0 ? menosSaida.map(p => `• ${p.nome}`) : ['Todos os produtos tiveram saída no período.']),
    ];
    openPreview('Saída de Produtos', 'saida-produtos.pdf', generateA4PDF('Relatório de Saída de Produtos', lines),
      <div className="space-y-4 text-sm">
        <div className="text-center border-b border-border pb-3">
          <h2 className="text-lg font-bold">SAÍDA DE PRODUTOS</h2>
          <p className="text-muted-foreground">Período: {periodoStr}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Produtos Ativos</p><p className="text-xl font-bold">{saidaProdutos.length}</p></div>
          <div className="p-3 rounded bg-secondary/50 text-center"><p className="text-[10px] text-muted-foreground uppercase">Sem Saída</p><p className="text-xl font-bold text-destructive">{menosSaida.length}</p></div>
        </div>
        <p className="font-semibold">Maior Saída</p>
        <table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="pb-2 text-left">#</th><th className="pb-2 text-left">Produto</th><th className="pb-2 text-right">Qtd</th><th className="pb-2 text-right">Valor</th></tr></thead>
        <tbody>{maisSaida.map((p, i) => (
          <tr key={p.id} className="border-b border-border/50"><td className="py-1">{i+1}</td><td className="py-1">{p.nome}</td><td className="py-1 text-right">{p.qtd}</td><td className="py-1 text-right font-medium">R$ {p.valor.toFixed(2)}</td></tr>
        ))}</tbody></table>
        {menosSaida.length > 0 && (
          <>
            <p className="font-semibold text-destructive">Sem Saída no Período</p>
            <ul className="list-disc list-inside text-muted-foreground">
              {menosSaida.map(p => <li key={p.id}>{p.nome}</li>)}
            </ul>
          </>
        )}
      </div>
    );
  };
  const DatePicker = ({ date, onChange, label }: { date: Date; onChange: (d: Date) => void; label: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-xs", !date && "text-muted-foreground")}>
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
          <h1 className="text-2xl font-serif text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise de desempenho</p>
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div>
        </div>
      ) : (
        <Tabs defaultValue="vendas" className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="vendas" className="text-xs"><TrendingUp className="h-3.5 w-3.5 mr-1" />Vendas</TabsTrigger>
            <TabsTrigger value="saida" className="text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1" />Saída Produtos</TabsTrigger>
            <TabsTrigger value="pagamentos" className="text-xs"><PieChartIcon className="h-3.5 w-3.5 mr-1" />Pagamentos</TabsTrigger>
            <TabsTrigger value="mesas" className="text-xs"><Grid3X3 className="h-3.5 w-3.5 mr-1" />Mesas</TabsTrigger>
            <TabsTrigger value="delivery" className="text-xs"><Truck className="h-3.5 w-3.5 mr-1" />Delivery</TabsTrigger>
            <TabsTrigger value="hist-produto" className="text-xs"><Package className="h-3.5 w-3.5 mr-1" />Hist. Produto</TabsTrigger>
            <TabsTrigger value="hist-cliente" className="text-xs"><Users className="h-3.5 w-3.5 mr-1" />Hist. Cliente</TabsTrigger>
            <TabsTrigger value="produtos" className="text-xs"><BarChart3 className="h-3.5 w-3.5 mr-1" />Produtos</TabsTrigger>
          </TabsList>

          {/* VENDAS */}
          <TabsContent value="vendas" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Visão geral do faturamento no período selecionado, com total faturado, ticket médio, quantidade de comandas e entregas finalizadas, e gráfico de faturamento diário.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openVendasPreview}><Eye className="h-4 w-4 mr-1" /> Visualizar / PDF</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Faturado', value: `R$ ${vendasData.totalFaturado.toFixed(2)}`, gold: true },
                { label: 'Ticket Médio', value: `R$ ${vendasData.ticketMedio.toFixed(2)}` },
                { label: 'Comandas', value: vendasData.numComandas },
                { label: 'Entregas', value: vendasData.numEntregas },
              ].map(item => (
                <Card key={item.label} className="glass">
                  <CardContent className="pt-4 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                    <p className={`text-xl font-bold ${item.gold ? 'text-gradient-gold' : 'text-foreground'}`}>{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {vendasData.dailyChart.length > 0 && (
              <Card className="glass">
                <CardHeader><CardTitle className="text-sm font-serif">Faturamento Diário</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={vendasData.dailyChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
                      <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'hsl(0,0%,55%)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(0,0%,55%)' }} />
                      <Tooltip contentStyle={{ background: 'hsl(0,0%,10%)', border: '1px solid hsl(0,0%,18%)', borderRadius: 8, color: 'hsl(40,10%,90%)' }} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Valor']} />
                      <Bar dataKey="valor" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PRODUTOS */}
          <TabsContent value="produtos" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Ranking dos produtos mais vendidos no período, ordenados por quantidade, com gráfico visual e tabela detalhada.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openProdutosPreview}><Eye className="h-4 w-4 mr-1" /> Visualizar / PDF</Button>
            </div>
            {produtosRanking.length > 0 && (
              <Card className="glass">
                <CardHeader><CardTitle className="text-sm font-serif">Top Produtos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, produtosRanking.length * 32)}>
                    <BarChart data={produtosRanking} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(0,0%,55%)' }} />
                      <YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 10, fill: 'hsl(40,10%,90%)' }} />
                      <Tooltip contentStyle={{ background: 'hsl(0,0%,10%)', border: '1px solid hsl(0,0%,18%)', borderRadius: 8, color: 'hsl(40,10%,90%)' }} />
                      <Bar dataKey="qtd" name="Quantidade" fill="hsl(43,74%,49%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader><TableRow className="border-border hover:bg-transparent">
                  <TableHead>#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>{produtosRanking.map((p, i) => (
                  <TableRow key={p.nome} className="border-border">
                    <TableCell className="font-medium">{i + 1}</TableCell><TableCell>{p.nome}</TableCell>
                    <TableCell className="text-right">{p.qtd}</TableCell><TableCell className="text-right text-primary font-medium">R$ {p.valor.toFixed(2)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* PAGAMENTOS */}
          <TabsContent value="pagamentos" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Distribuição dos pagamentos por forma (dinheiro, cartão, PIX, etc.) com gráfico de pizza mostrando a proporção de cada método utilizado no período.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openPagamentosPreview}><Eye className="h-4 w-4 mr-1" /> Visualizar / PDF</Button>
            </div>
            {formasPagamento.length > 0 && (
              <>
                <Card className="glass">
                  <CardHeader><CardTitle className="text-sm font-serif">Formas de Pagamento</CardTitle></CardHeader>
                  <CardContent className="flex justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={formasPagamento} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {formasPagamento.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(40,10%,90%)' }} />
                        <Tooltip contentStyle={{ background: 'hsl(0,0%,10%)', border: '1px solid hsl(0,0%,18%)', borderRadius: 8, color: 'hsl(40,10%,90%)' }} formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex justify-between items-center">
                  <span className="font-semibold text-sm">Valor Total no Período</span>
                  <span className="text-xl font-bold text-primary">R$ {formasPagamento.reduce((s, f) => s + f.value, 0).toFixed(2)}</span>
                </div>
              </>
            )}
          </TabsContent>

          {/* MESAS */}
          <TabsContent value="mesas" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Análise de ocupação das mesas no período, com total de comandas fechadas e tempo médio de permanência dos clientes.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openMesasPreview}><Eye className="h-4 w-4 mr-1" /> Visualizar / PDF</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass"><CardContent className="pt-6 text-center space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase">Comandas Fechadas</p>
                <p className="text-4xl font-bold text-foreground">{ocupacaoMesas.total}</p>
              </CardContent></Card>
              <Card className="glass"><CardContent className="pt-6 text-center space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase">Tempo Médio de Ocupação</p>
                <p className="text-4xl font-bold text-gradient-gold">
                  {Math.floor(ocupacaoMesas.mediaMinutos / 60)}h{String(ocupacaoMesas.mediaMinutos % 60).padStart(2, '0')}min
                </p>
              </CardContent></Card>
            </div>
          </TabsContent>

          {/* DELIVERY */}
          <TabsContent value="delivery" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Panorama completo das entregas no período, incluindo total de pedidos, entregas finalizadas, valor total e ranking dos bairros mais atendidos.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openDeliveryPreview}><Eye className="h-4 w-4 mr-1" /> Visualizar / PDF</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Pedidos</p><p className="text-2xl font-bold text-foreground">{deliveryData.total}</p></CardContent></Card>
              <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Entregues</p><p className="text-2xl font-bold text-success">{deliveryData.entregues}</p></CardContent></Card>
              <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Valor Total</p><p className="text-2xl font-bold text-gradient-gold">R$ {deliveryData.totalValor.toFixed(2)}</p></CardContent></Card>
            </div>
            {deliveryData.bairros.length > 0 && (
              <Card className="glass">
                <CardHeader><CardTitle className="text-sm font-serif">Bairros Mais Atendidos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, deliveryData.bairros.length * 32)}>
                    <BarChart data={deliveryData.bairros} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(0,0%,55%)' }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: 'hsl(40,10%,90%)' }} />
                      <Tooltip contentStyle={{ background: 'hsl(0,0%,10%)', border: '1px solid hsl(0,0%,18%)', borderRadius: 8, color: 'hsl(40,10%,90%)' }} />
                      <Bar dataKey="value" name="Pedidos" fill="hsl(142,71%,45%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* HISTÓRICO POR PRODUTO */}
          <TabsContent value="hist-produto" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Histórico detalhado de vendas de um produto específico no período, mostrando cada venda com data, tipo (mesa/delivery), cliente, quantidade e valor.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-center gap-3">
              <Popover open={produtoComboOpen} onOpenChange={open => { setProdutoComboOpen(open); if (!open) setProdutoSearch(''); }}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[280px] justify-between font-normal" role="combobox">
                    <span className="truncate">{selectedProduto ? produtos.find(p => p.id === selectedProduto)?.nome : 'Selecione um produto...'}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-2" align="start">
                  <input
                    placeholder="Pesquisar produto..."
                    value={produtoSearch}
                    onChange={e => setProdutoSearch(e.target.value)}
                    className="w-full mb-2 h-8 px-3 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                  <ScrollArea className="h-56">
                    {produtos.filter(p => p.nome.toLowerCase().includes(produtoSearch.toLowerCase())).length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-2">Nenhum produto encontrado.</p>
                    ) : produtos.filter(p => p.nome.toLowerCase().includes(produtoSearch.toLowerCase())).map(p => (
                      <div
                        key={p.id}
                        className={cn('cursor-pointer px-2 py-1.5 text-sm rounded hover:bg-accent', p.id === selectedProduto && 'bg-accent')}
                        onClick={() => { setSelectedProduto(p.id); setProdutoComboOpen(false); setProdutoSearch(''); }}
                      >
                        {p.nome}
                      </div>
                    ))}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {selectedProduto && produtoHistorico.length > 0 && (
                <Button size="sm" variant="outline" onClick={openProdutoHistPreview}><Eye className="h-4 w-4 mr-1" /> Visualizar / PDF</Button>
              )}
            </div>
            {!selectedProduto && <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">Selecione um produto para visualizar o histórico de vendas.</CardContent></Card>}
            {selectedProduto && loadingProduto && <div className="flex justify-center py-8"><div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div></div>}
            {selectedProduto && !loadingProduto && produtoHistorico.length === 0 && <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">Nenhuma venda encontrada no período para este produto.</CardContent></Card>}
            {selectedProduto && !loadingProduto && produtoHistorico.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Vendas</p><p className="text-2xl font-bold text-foreground">{produtoHistorico.length}</p></CardContent></Card>
                  <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Qtd Total</p><p className="text-2xl font-bold text-foreground">{produtoHistorico.reduce((s, r) => s + r.quantidade, 0)}</p></CardContent></Card>
                  <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Valor Total</p><p className="text-2xl font-bold text-gradient-gold">R$ {produtoHistorico.reduce((s, r) => s + r.valor, 0).toFixed(2)}</p></CardContent></Card>
                </div>
                <Card className="glass overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="border-border hover:bg-transparent">
                      <TableHead>Data/Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Mesa</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Valor</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{produtoHistorico.map((r, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="text-xs">{format(new Date(r.data), 'dd/MM/yyyy HH:mm')}</TableCell><TableCell className="text-xs">{r.tipo}</TableCell><TableCell>{r.mesa}</TableCell><TableCell>{r.cliente}</TableCell><TableCell className="text-right">{r.quantidade}</TableCell><TableCell className="text-right text-primary font-medium">R$ {r.valor.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </Card>
              </>
            )}
          </TabsContent>

          {/* HISTÓRICO POR CLIENTE */}
          <TabsContent value="hist-cliente" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Histórico de consumo de um cliente específico no período, detalhando cada item consumido com data, produto, quantidade, valor unitário e total.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
              {selectedCliente && clienteHistorico.length > 0 && (
                <Button size="sm" variant="outline" onClick={openClienteHistPreview}><Eye className="h-4 w-4 mr-1" /> Visualizar / PDF</Button>
              )}
            </div>
            {!selectedCliente && <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">Selecione um cliente para visualizar o histórico de consumo.</CardContent></Card>}
            {selectedCliente && loadingCliente && <div className="flex justify-center py-8"><div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div></div>}
            {selectedCliente && !loadingCliente && clienteHistorico.length === 0 && <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">Nenhum consumo encontrado no período para este cliente.</CardContent></Card>}
            {selectedCliente && !loadingCliente && clienteHistorico.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Itens</p><p className="text-2xl font-bold text-foreground">{clienteHistorico.length}</p></CardContent></Card>
                  <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Qtd Total</p><p className="text-2xl font-bold text-foreground">{clienteHistorico.reduce((s, r) => s + r.quantidade, 0)}</p></CardContent></Card>
                  <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Valor Total</p><p className="text-2xl font-bold text-gradient-gold">R$ {clienteHistorico.reduce((s, r) => s + r.valor, 0).toFixed(2)}</p></CardContent></Card>
                </div>
                <Card className="glass overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="border-border hover:bg-transparent">
                      <TableHead>Data/Hora</TableHead><TableHead>Tipo</TableHead><TableHead>Comanda</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Unit.</TableHead><TableHead className="text-right">Total</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{clienteHistorico.map((r, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="text-xs">{format(new Date(r.data), 'dd/MM/yyyy HH:mm')}</TableCell><TableCell className="text-xs">{r.tipo}</TableCell><TableCell>{r.comanda}</TableCell><TableCell>{r.produto}</TableCell><TableCell className="text-right">{r.quantidade}</TableCell><TableCell className="text-right">R$ {r.preco_unitario.toFixed(2)}</TableCell><TableCell className="text-right text-primary font-medium">R$ {r.valor.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </Card>
              </>
            )}
          </TabsContent>

          {/* SAÍDA DE PRODUTOS */}
          <TabsContent value="saida" className="mt-4 space-y-4">
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-xs text-muted-foreground">
                Ranking de saída de todos os produtos ativos no período, destacando os mais vendidos e identificando produtos que não tiveram nenhuma venda.
              </AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={openSaidaProdutosPreview}><Eye className="h-4 w-4 mr-1" /> Visualizar / PDF</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Produtos Ativos</p><p className="text-2xl font-bold text-foreground">{saidaProdutos.length}</p></CardContent></Card>
              <Card className="glass"><CardContent className="pt-4 text-center"><p className="text-[10px] text-muted-foreground uppercase">Sem Saída no Período</p><p className="text-2xl font-bold text-destructive">{saidaProdutos.filter(p => p.qtd === 0).length}</p></CardContent></Card>
            </div>
            {saidaProdutos.length > 0 && (
              <Card className="glass overflow-hidden">
                <CardHeader><CardTitle className="text-sm font-serif">Ranking de Saída</CardTitle></CardHeader>
                <Table>
                  <TableHeader><TableRow className="border-border hover:bg-transparent">
                    <TableHead>#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Qtd Vendida</TableHead><TableHead className="text-right">Valor Total</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{saidaProdutos.map((p, i) => (
                    <TableRow key={p.id} className={`border-border ${p.qtd === 0 ? 'opacity-50' : ''}`}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>{p.nome}</TableCell>
                      <TableCell className={`text-right font-medium ${p.qtd === 0 ? 'text-destructive' : ''}`}>{p.qtd}</TableCell>
                      <TableCell className="text-right text-primary font-medium">R$ {p.valor.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </Card>
            )}
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
