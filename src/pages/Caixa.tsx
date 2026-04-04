import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Landmark, DoorOpen, DoorClosed, ArrowDownCircle, ArrowUpCircle, Clock, DollarSign, FileText, Calendar, CreditCard, Banknote, QrCode, User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface CaixaData {
  id: string;
  aberto_por: string | null;
  fechado_por: string | null;
  valor_abertura: number;
  valor_fechamento: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  observacao_abertura: string | null;
  observacao_fechamento: string | null;
}

interface Movimentacao {
  id: string;
  caixa_id: string;
  tipo: string;
  valor: number;
  descricao: string;
  usuario_id: string | null;
  created_at: string;
}

const formaLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  pix: 'PIX',
  outro: 'Outro',
};

const formaIcons: Record<string, React.ReactNode> = {
  dinheiro: <Banknote className="h-3.5 w-3.5 text-success" />,
  cartao_credito: <CreditCard className="h-3.5 w-3.5 text-accent" />,
  cartao_debito: <CreditCard className="h-3.5 w-3.5 text-accent" />,
  pix: <QrCode className="h-3.5 w-3.5 text-primary" />,
  outro: <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />,
};

export default function Caixa() {
  const { user, profile } = useAuth();
  const [caixaAberto, setCaixaAberto] = useState<CaixaData | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [historico, setHistorico] = useState<CaixaData[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [abrirModal, setAbrirModal] = useState(false);
  const [fecharModal, setFecharModal] = useState(false);
  const [movModal, setMovModal] = useState<'sangria' | 'suprimento' | null>(null);
  const [detalheModal, setDetalheModal] = useState<CaixaData | null>(null);
  const [detalheMovs, setDetalheMovs] = useState<Movimentacao[]>([]);

  // Form states
  const [valorAbertura, setValorAbertura] = useState('');
  const [obsAbertura, setObsAbertura] = useState('');
  const [valorFechamento, setValorFechamento] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');
  const [movValor, setMovValor] = useState('');
  const [movDescricao, setMovDescricao] = useState('');

  const fetchCaixaAberto = useCallback(async () => {
    const { data } = await supabase
      .from('caixas')
      .select('*')
      .eq('status', 'aberto')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCaixaAberto(data as CaixaData | null);
    return data;
  }, []);

  const fetchMovimentacoes = useCallback(async (caixaId: string) => {
    const { data } = await supabase
      .from('caixa_movimentacoes')
      .select('*')
      .eq('caixa_id', caixaId)
      .order('created_at', { ascending: true });
    if (data) setMovimentacoes(data as Movimentacao[]);
  }, []);

  const fetchHistorico = useCallback(async () => {
    const { data } = await supabase
      .from('caixas')
      .select('*')
      .eq('status', 'fechado')
      .order('opened_at', { ascending: false })
      .limit(30);
    if (data) setHistorico(data as CaixaData[]);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const cx = await fetchCaixaAberto();
      if (cx) await fetchMovimentacoes(cx.id);
      await fetchHistorico();
      setLoading(false);
    };
    init();
  }, [fetchCaixaAberto, fetchMovimentacoes, fetchHistorico]);

  // Calculate totals
  const totalSangrias = useMemo(() => movimentacoes.filter(m => m.tipo === 'sangria').reduce((s, m) => s + m.valor, 0), [movimentacoes]);
  const totalSuprimentos = useMemo(() => movimentacoes.filter(m => m.tipo === 'suprimento').reduce((s, m) => s + m.valor, 0), [movimentacoes]);

  // Fetch pagamentos do período do caixa aberto
  const [totalVendas, setTotalVendas] = useState(0);
  const [vendasPorForma, setVendasPorForma] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!caixaAberto) { 
      setTotalVendas(0); 
      setVendasPorForma({});
      return; 
    }
    supabase
      .from('pagamentos')
      .select('valor, forma')
      .gte('created_at', caixaAberto.opened_at)
      .then(({ data }) => {
        if (data) {
          // Exclude consumo_funcionario from caixa revenue
          const filtrado = data.filter((p: any) => p.forma !== 'consumo_funcionario');
          setTotalVendas(filtrado.reduce((s: number, p: any) => s + p.valor, 0));

          const porForma = filtrado.reduce((acc: Record<string, number>, p: any) => {
            acc[p.forma] = (acc[p.forma] || 0) + p.valor;
            return acc;
          }, {});
          setVendasPorForma(porForma);
        }
      });
  }, [caixaAberto, movimentacoes]);

  const saldoEsperado = useMemo(() => {
    if (!caixaAberto) return 0;
    return caixaAberto.valor_abertura + totalVendas + totalSuprimentos - totalSangrias;
  }, [caixaAberto, totalVendas, totalSuprimentos, totalSangrias]);

  const handleAbrirCaixa = async () => {
    const valor = parseFloat(valorAbertura);
    if (isNaN(valor) || valor < 0) { toast.error('Informe um valor válido'); return; }
    const { error } = await supabase.from('caixas').insert({
      aberto_por: user?.id || null,
      valor_abertura: valor,
      observacao_abertura: obsAbertura || null,
    });
    if (error) { toast.error('Erro ao abrir caixa'); return; }
    toast.success('Caixa aberto com sucesso!');
    setAbrirModal(false);
    setValorAbertura('');
    setObsAbertura('');
    const cx = await fetchCaixaAberto();
    if (cx) await fetchMovimentacoes(cx.id);
  };

  const handleFecharCaixa = async () => {
    if (!caixaAberto) return;
    const valor = parseFloat(valorFechamento);
    if (isNaN(valor) || valor < 0) { toast.error('Informe o valor em caixa'); return; }

    // Check for open comandas and deliveries
    const [{ count: comandasAbertas }, { count: entregasPendentes }] = await Promise.all([
      supabase.from('comandas').select('id', { count: 'exact', head: true }).eq('status', 'aberta'),
      supabase.from('entregas').select('id', { count: 'exact', head: true }).in('status', ['aberta', 'em_preparo', 'saiu_entrega']),
    ]);
    const pendencias: string[] = [];
    if (comandasAbertas && comandasAbertas > 0) pendencias.push(`${comandasAbertas} comanda(s) aberta(s)`);
    if (entregasPendentes && entregasPendentes > 0) pendencias.push(`${entregasPendentes} entrega(s) pendente(s)`);
    if (pendencias.length > 0) {
      toast.error(`Não é possível fechar o caixa. Existem: ${pendencias.join(' e ')}.`);
      return;
    }

    const { error } = await supabase.from('caixas').update({
      status: 'fechado',
      fechado_por: user?.id || null,
      valor_fechamento: valor,
      closed_at: new Date().toISOString(),
      observacao_fechamento: obsFechamento || null,
    }).eq('id', caixaAberto.id);
    if (error) { toast.error('Erro ao fechar caixa'); return; }
    toast.success('Caixa fechado com sucesso!');
    setFecharModal(false);
    setValorFechamento('');
    setObsFechamento('');
    setCaixaAberto(null);
    setMovimentacoes([]);
    fetchHistorico();
  };

  const handleMovimentacao = async () => {
    if (!caixaAberto || !movModal) return;
    const valor = parseFloat(movValor);
    if (isNaN(valor) || valor <= 0) { toast.error('Informe um valor válido'); return; }
    if (!movDescricao.trim()) { toast.error('Informe uma descrição'); return; }
    const { error } = await supabase.from('caixa_movimentacoes').insert({
      caixa_id: caixaAberto.id,
      tipo: movModal,
      valor,
      descricao: movDescricao.trim(),
      usuario_id: user?.id || null,
    });
    if (error) { toast.error('Erro ao registrar movimentação'); return; }
    toast.success(`${movModal === 'sangria' ? 'Sangria' : 'Suprimento'} registrado!`);
    setMovModal(null);
    setMovValor('');
    setMovDescricao('');
    fetchMovimentacoes(caixaAberto.id);
  };

  const [detalheVendasForma, setDetalheVendasForma] = useState<Record<string, number>>({});
  const handleVerDetalhe = async (cx: CaixaData) => {
    setDetalheModal(cx);
    const { data: movs } = await supabase
      .from('caixa_movimentacoes')
      .select('*')
      .eq('caixa_id', cx.id)
      .order('created_at');
    setDetalheMovs((movs as Movimentacao[]) || []);

    const query = supabase
      .from('pagamentos')
      .select('valor, forma')
      .gte('created_at', cx.opened_at);
    
    if (cx.closed_at) {
      query.lte('created_at', cx.closed_at);
    }

    const { data: pgs } = await query;
    if (pgs) {
      const filtrado = pgs.filter((p: any) => p.forma !== 'consumo_funcionario');
      const porForma = filtrado.reduce((acc: Record<string, number>, p: any) => {
        acc[p.forma] = (acc[p.forma] || 0) + p.valor;
        return acc;
      }, {});
      setDetalheVendasForma(porForma);
    } else {
      setDetalheVendasForma({});
    }
  };

  const exportarPDF = (cx: CaixaData, movs: Movimentacao[], vendasForma: Record<string, number> = {}) => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 300] });
    const w = 80;
    let y = 8;
    const lh = 4.5;
    const sep = () => { doc.text('─'.repeat(30), w / 2, y, { align: 'center' }); y += lh; };

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('FECHAMENTO DE CAIXA', w / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    sep();

    doc.text(`Abertura: ${format(new Date(cx.opened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 4, y); y += lh;
    if (cx.closed_at) { doc.text(`Fechamento: ${format(new Date(cx.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 4, y); y += lh; }
    if (cx.observacao_abertura) { doc.text(`Obs abertura: ${cx.observacao_abertura}`, 4, y); y += lh; }
    sep();

    doc.text(`Valor abertura:`, 4, y); doc.text(`R$ ${cx.valor_abertura.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
    sep();

    const tVendas = Object.values(vendasForma).reduce((s, v) => s + v, 0);
    if (tVendas > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('RECEBIMENTOS', 4, y); y += lh;
      doc.setFont('helvetica', 'normal');
      Object.entries(vendasForma).forEach(([forma, valor]) => {
        doc.text(formaLabels[forma] || forma, 4, y);
        doc.text(`R$ ${valor.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
      });
      doc.text(`Total vendas:`, 4, y); doc.text(`R$ ${tVendas.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
      sep();
    }

    const sangrias = movs.filter(m => m.tipo === 'sangria');
    const suprimentos = movs.filter(m => m.tipo === 'suprimento');
    const tSangrias = sangrias.reduce((s, m) => s + m.valor, 0);
    const tSuprimentos = suprimentos.reduce((s, m) => s + m.valor, 0);

    if (sangrias.length > 0) {
      sep();
      doc.setFont('helvetica', 'bold');
      doc.text('SANGRIAS', 4, y); y += lh;
      doc.setFont('helvetica', 'normal');
      sangrias.forEach(m => {
        doc.text(m.descricao.substring(0, 24), 4, y);
        doc.text(`- R$ ${m.valor.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
        doc.setFontSize(7);
        doc.text(format(new Date(m.created_at), 'dd/MM HH:mm'), 4, y); y += lh;
        doc.setFontSize(8);
      });
      doc.text(`Total sangrias:`, 4, y); doc.text(`R$ ${tSangrias.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
    }

    if (suprimentos.length > 0) {
      sep();
      doc.setFont('helvetica', 'bold');
      doc.text('SUPRIMENTOS', 4, y); y += lh;
      doc.setFont('helvetica', 'normal');
      suprimentos.forEach(m => {
        doc.text(m.descricao.substring(0, 24), 4, y);
        doc.text(`+ R$ ${m.valor.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
        doc.setFontSize(7);
        doc.text(format(new Date(m.created_at), 'dd/MM HH:mm'), 4, y); y += lh;
        doc.setFontSize(8);
      });
      doc.text(`Total suprimentos:`, 4, y); doc.text(`R$ ${tSuprimentos.toFixed(2)}`, w - 4, y, { align: 'right' }); y += lh;
    }

    sep();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    if (cx.valor_fechamento != null) {
      doc.text('Valor em caixa:', 4, y); doc.text(`R$ ${cx.valor_fechamento.toFixed(2)}`, w - 4, y, { align: 'right' }); y += 6;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (cx.observacao_fechamento) { doc.text(`Obs: ${cx.observacao_fechamento}`, 4, y); y += lh; }

    sep();
    doc.text(`Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, w / 2, y, { align: 'center' });

    const blob = doc.output('blob');
    window.open(URL.createObjectURL(blob), '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-accent" /> Caixa
          </h1>
          <p className="text-sm text-muted-foreground">Controle diário de caixa</p>
        </div>
        {!caixaAberto && (
          <Button onClick={() => setAbrirModal(true)}>
            <DoorOpen className="h-4 w-4 mr-1" /> Abrir Caixa
          </Button>
        )}
      </div>

      {/* Caixa Aberto */}
      {caixaAberto && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass glow-gold">
            <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-serif">Caixa Aberto</CardTitle>
                <Badge className="bg-success/20 text-success border-success/30">Aberto</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setMovModal('suprimento')}>
                  <ArrowUpCircle className="h-4 w-4 mr-1" /> Suprimento
                </Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setMovModal('sangria')}>
                  <ArrowDownCircle className="h-4 w-4 mr-1" /> Sangria
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setFecharModal(true)}>
                  <DoorClosed className="h-4 w-4 mr-1" /> Fechar Caixa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Abertura</p>
                  <p className="text-sm font-bold text-foreground">R$ {caixaAberto.valor_abertura.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Vendas</p>
                  <p className="text-sm font-bold text-success">R$ {totalVendas.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Suprimentos</p>
                  <p className="text-sm font-bold text-accent">R$ {totalSuprimentos.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Sangrias</p>
                  <p className="text-sm font-bold text-destructive">R$ {totalSangrias.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-[10px] text-muted-foreground uppercase">Saldo Esperado</p>
                  <p className="text-sm font-bold text-primary">R$ {saldoEsperado.toFixed(2)}</p>
                </div>
              </div>

              {Object.keys(vendasPorForma).length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Separator className="flex-1 opacity-30" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">Recebimentos</span>
                    <Separator className="flex-1 opacity-30" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.entries(vendasPorForma).map(([forma, valor]) => (
                      <div key={forma} className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 hover:border-border transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="p-1 rounded bg-secondary/50">
                            {formaIcons[forma] || <DollarSign className="h-3 w-3" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase truncate font-medium">
                            {formaLabels[forma] || forma}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-foreground">R$ {valor.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Clock className="h-3.5 w-3.5" />
                Aberto {format(new Date(caixaAberto.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — {formatDistanceToNow(new Date(caixaAberto.opened_at), { locale: ptBR })}
              </div>

              {/* Movimentações */}
              {movimentacoes.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Movimentações</p>
                  <div className="max-h-60 overflow-y-auto space-y-1.5">
                    {movimentacoes.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50 text-xs">
                        <div className="flex items-center gap-2">
                          {m.tipo === 'sangria' ? (
                            <ArrowDownCircle className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <ArrowUpCircle className="h-3.5 w-3.5 text-success" />
                          )}
                          <div>
                            <span className="font-medium text-foreground">{m.descricao}</span>
                            <span className="text-muted-foreground ml-2">
                              {format(new Date(m.created_at), 'HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <span className={`font-medium ${m.tipo === 'sangria' ? 'text-destructive' : 'text-success'}`}>
                          {m.tipo === 'sangria' ? '-' : '+'} R$ {m.valor.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!caixaAberto && (
        <Card className="glass">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Landmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum caixa aberto</p>
            <p className="text-sm">Abra o caixa para iniciar as operações do dia.</p>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <Card className="glass overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-serif flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Histórico de Caixas
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Abertura</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead className="text-right">Vlr Abertura</TableHead>
                <TableHead className="text-right">Vlr Fechamento</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map(cx => (
                <TableRow key={cx.id} className="border-border">
                  <TableCell className="text-sm">{format(new Date(cx.opened_at), 'dd/MM/yy HH:mm')}</TableCell>
                  <TableCell className="text-sm">{cx.closed_at ? format(new Date(cx.closed_at), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                  <TableCell className="text-right text-sm">R$ {cx.valor_abertura.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm">{cx.valor_fechamento != null ? `R$ ${cx.valor_fechamento.toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-muted text-muted-foreground">Fechado</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => handleVerDetalhe(cx)}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal Abrir Caixa */}
      <Dialog open={abrirModal} onOpenChange={setAbrirModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Abrir Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor de Abertura (R$)</Label>
              <CurrencyInput value={valorAbertura} onValueChange={v => setValorAbertura(v)} />
            </div>
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea placeholder="Observação sobre a abertura..." value={obsAbertura} onChange={e => setObsAbertura(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbrirModal(false)}>Cancelar</Button>
            <Button onClick={handleAbrirCaixa}><DoorOpen className="h-4 w-4 mr-1" /> Abrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Fechar Caixa */}
      <Dialog open={fecharModal} onOpenChange={setFecharModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Fechar Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-secondary/50 space-y-1 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-1 mb-1">
                <span className="text-muted-foreground uppercase text-[10px] font-bold">Resumo Esperado</span>
                <span className="font-bold text-primary">R$ {saldoEsperado.toFixed(2)}</span>
              </div>
              <div className="space-y-0.5 mt-2">
                <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Abertura</span><span>R$ {caixaAberto?.valor_abertura.toFixed(2)}</span></div>
                {Object.entries(vendasPorForma).map(([forma, valor]) => (
                  <div key={forma} className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      {formaIcons[forma] || <DollarSign className="h-2.5 w-2.5" />}
                      {formaLabels[forma] || forma}
                    </span>
                    <span className="font-medium">R$ {valor.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Suprimentos (+)</span><span className="text-success">R$ {totalSuprimentos.toFixed(2)}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">Sangrias (-)</span><span className="text-destructive">R$ {totalSangrias.toFixed(2)}</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor em Caixa (contagem real) (R$)</Label>
              <CurrencyInput value={valorFechamento} onValueChange={v => setValorFechamento(v)} />
            </div>
            {valorFechamento && !isNaN(parseFloat(valorFechamento)) && (
              <div className="p-3 rounded-lg bg-secondary/50 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diferença</span>
                  <span className={`font-bold ${parseFloat(valorFechamento) - saldoEsperado >= 0 ? 'text-success' : 'text-destructive'}`}>
                    R$ {(parseFloat(valorFechamento) - saldoEsperado).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea placeholder="Observação sobre o fechamento..." value={obsFechamento} onChange={e => setObsFechamento(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFecharModal(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleFecharCaixa}><DoorClosed className="h-4 w-4 mr-1" /> Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Sangria / Suprimento */}
      <Dialog open={movModal !== null} onOpenChange={() => setMovModal(null)}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {movModal === 'sangria' ? 'Registrar Sangria' : 'Registrar Suprimento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <CurrencyInput value={movValor} onValueChange={v => setMovValor(v)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea placeholder={movModal === 'sangria' ? 'Ex: Pagamento fornecedor, troco...' : 'Ex: Reforço de troco, depósito...'} value={movDescricao} onChange={e => setMovDescricao(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovModal(null)}>Cancelar</Button>
            <Button onClick={handleMovimentacao}>
              {movModal === 'sangria' ? <ArrowDownCircle className="h-4 w-4 mr-1" /> : <ArrowUpCircle className="h-4 w-4 mr-1" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhe do Caixa Fechado */}
      <Dialog open={detalheModal !== null} onOpenChange={() => setDetalheModal(null)}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Detalhes do Caixa</DialogTitle>
          </DialogHeader>
          {detalheModal && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Abertura</p>
                  <p className="font-medium">{format(new Date(detalheModal.opened_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
                <div className="p-2 rounded bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Fechamento</p>
                  <p className="font-medium">{detalheModal.closed_at ? format(new Date(detalheModal.closed_at), "dd/MM/yyyy HH:mm") : '-'}</p>
                </div>
                <div className="p-2 rounded bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Vlr Abertura</p>
                  <p className="font-medium">R$ {detalheModal.valor_abertura.toFixed(2)}</p>
                </div>
                <div className="p-2 rounded bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Vlr Fechamento</p>
                  <p className="font-medium">{detalheModal.valor_fechamento != null ? `R$ ${detalheModal.valor_fechamento.toFixed(2)}` : '-'}</p>
                </div>
              </div>

              {Object.keys(detalheVendasForma).length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Recebimentos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(detalheVendasForma).map(([forma, valor]) => (
                      <div key={forma} className="flex justify-between p-2 rounded bg-secondary/30 text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                          {formaIcons[forma] || <DollarSign className="h-3 w-3" />}
                          {formaLabels[forma] || forma}
                        </span>
                        <span className="font-medium whitespace-nowrap ml-1">R$ {valor.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="col-span-2 flex justify-between p-2 rounded bg-secondary/30 text-xs border-t border-border/50">
                      <span className="font-bold">Total Vendas</span>
                      <span className="font-bold text-success">R$ {Object.values(detalheVendasForma).reduce((s, v) => s + v, 0).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}

              {detalheModal.observacao_abertura && <p className="text-muted-foreground">Obs abertura: {detalheModal.observacao_abertura}</p>}
              {detalheModal.observacao_fechamento && <p className="text-muted-foreground">Obs fechamento: {detalheModal.observacao_fechamento}</p>}
              {detalheMovs.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Movimentações</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {detalheMovs.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded bg-secondary/50 text-xs">
                        <div className="flex items-center gap-2">
                          {m.tipo === 'sangria' ? <ArrowDownCircle className="h-3 w-3 text-destructive" /> : <ArrowUpCircle className="h-3 w-3 text-success" />}
                          <span>{m.descricao}</span>
                          <span className="text-muted-foreground">{format(new Date(m.created_at), 'HH:mm')}</span>
                        </div>
                        <span className={m.tipo === 'sangria' ? 'text-destructive' : 'text-success'}>
                          {m.tipo === 'sangria' ? '-' : '+'} R$ {m.valor.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Button className="w-full" variant="outline" onClick={() => exportarPDF(detalheModal, detalheMovs, detalheVendasForma)}>
                <FileText className="h-4 w-4 mr-1" /> Exportar PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
