import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, DollarSign, User, Wallet, Receipt, CreditCard, MinusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  cargo: string | null;
  ativo: boolean;
}

interface ComandaConsumo {
  id: string;
  numero: number | null;
  opened_at: string | null;
  closed_at: string | null;
  status: string | null;
  mesas: { numero: number } | null;
}

interface EntregaConsumo {
  id: string;
  numero: number | null;
  opened_at: string | null;
  status: string | null;
}

interface ComandaPagamento {
  comanda_id: string | null;
  entrega_id: string | null;
  valor: number;
  forma: string;
}

interface FuncPagamento {
  id: string;
  valor: number;
  forma: string;
  descricao: string | null;
  created_at: string;
}

export default function FuncionarioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [comandas, setComandas] = useState<ComandaConsumo[]>([]);
  const [entregas, setEntregas] = useState<EntregaConsumo[]>([]);
  const [comandaPagamentos, setComandaPagamentos] = useState<ComandaPagamento[]>([]);
  const [pagamentos, setPagamentos] = useState<FuncPagamento[]>([]);
  const [pagModal, setPagModal] = useState(false);
  const [pagValor, setPagValor] = useState('');
  const [pagForma, setPagForma] = useState('dinheiro');
  const [pagDesc, setPagDesc] = useState('');
  const [loading, setLoading] = useState(false);

  // Despesa modal
  const [despesaModal, setDespesaModal] = useState(false);
  const [despesaValor, setDespesaValor] = useState('');
  const [despesaMotivo, setDespesaMotivo] = useState('');
  const [despesaLoading, setDespesaLoading] = useState(false);

  const fetchFuncionario = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('funcionarios').select('*').eq('id', id).single();
    if (data) setFuncionario(data as any);
  }, [id]);

  const fetchComandas = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('comandas')
      .select('id, numero, opened_at, closed_at, status, mesas(numero)')
      .eq('funcionario_consumo_id', id)
      .order('opened_at', { ascending: false });
    if (data) setComandas(data as any[]);
  }, [id]);

  const fetchEntregas = useCallback(async () => {
    if (!id) return;
    const { data } = await (supabase
      .from('entregas')
      .select('id, numero, opened_at, status') as any)
      .eq('funcionario_consumo_id', id)
      .order('opened_at', { ascending: false });
    if (data) setEntregas(data as any[]);
  }, [id]);

  const fetchComandaPagamentos = useCallback(async () => {
    if (!id) return;
    // Get comanda payments
    const { data: cmds } = await supabase
      .from('comandas')
      .select('id')
      .eq('funcionario_consumo_id', id);
    const cmdIds = (cmds || []).map(c => c.id);
    
    // Get entrega payments
    const { data: ents } = await (supabase
      .from('entregas')
      .select('id') as any)
      .eq('funcionario_consumo_id', id);
    const entIds = (ents || []).map((e: any) => e.id);

    let allPagamentos: ComandaPagamento[] = [];
    
    if (cmdIds.length > 0) {
      const { data } = await supabase
        .from('pagamentos')
        .select('comanda_id, entrega_id, valor, forma')
        .in('comanda_id', cmdIds)
        .eq('forma', 'consumo_funcionario' as any);
      if (data) allPagamentos = [...allPagamentos, ...data as ComandaPagamento[]];
    }
    
    if (entIds.length > 0) {
      const { data } = await supabase
        .from('pagamentos')
        .select('comanda_id, entrega_id, valor, forma')
        .in('entrega_id', entIds)
        .eq('forma', 'consumo_funcionario' as any);
      if (data) allPagamentos = [...allPagamentos, ...data as ComandaPagamento[]];
    }
    
    setComandaPagamentos(allPagamentos);
  }, [id]);

  const fetchPagamentos = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('funcionario_pagamentos')
      .select('*')
      .eq('funcionario_id', id)
      .order('created_at', { ascending: false });
    if (data) setPagamentos(data as FuncPagamento[]);
  }, [id]);

  useEffect(() => {
    fetchFuncionario();
    fetchComandas();
    fetchEntregas();
    fetchComandaPagamentos();
    fetchPagamentos();
  }, [fetchFuncionario, fetchComandas, fetchEntregas, fetchComandaPagamentos, fetchPagamentos]);

  const comandaTotais = useMemo(() => {
    const map: Record<string, number> = {};
    comandaPagamentos.forEach(p => {
      if (p.comanda_id) map[p.comanda_id] = (map[p.comanda_id] || 0) + p.valor;
      if (p.entrega_id) map[p.entrega_id] = (map[p.entrega_id] || 0) + p.valor;
    });
    return map;
  }, [comandaPagamentos]);

  const totalConsumo = useMemo(() => comandaPagamentos.reduce((s, p) => s + p.valor, 0), [comandaPagamentos]);
  
  // Separate despesas (negative forma = 'despesa') from payments
  const despesas = useMemo(() => pagamentos.filter(p => p.forma === 'despesa'), [pagamentos]);
  const pagamentosReais = useMemo(() => pagamentos.filter(p => p.forma !== 'despesa'), [pagamentos]);
  const totalDespesas = useMemo(() => despesas.reduce((s, p) => s + p.valor, 0), [despesas]);
  const totalPago = useMemo(() => pagamentosReais.reduce((s, p) => s + p.valor, 0), [pagamentosReais]);
  const saldoDevedor = Math.max(0, totalConsumo + totalDespesas - totalPago);

  const handleRegistrarPagamento = async () => {
    const valor = parseFloat(pagValor);
    if (!valor || valor <= 0) { toast.error('Informe um valor válido'); return; }
    if (valor > saldoDevedor + 0.01) { toast.error('Valor maior que o saldo devedor'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.from('funcionario_pagamentos').insert({
        funcionario_id: id!,
        valor,
        forma: pagForma,
        descricao: pagDesc || null,
      });
      if (error) throw error;

      const { data: caixaAberto } = await supabase
        .from('caixas')
        .select('id')
        .eq('status', 'aberto')
        .limit(1)
        .maybeSingle();

      if (caixaAberto) {
        await supabase.from('caixa_movimentacoes').insert({
          caixa_id: caixaAberto.id,
          tipo: 'suprimento',
          valor,
          descricao: `Pgto conta funcionário: ${funcionario?.nome || ''} (${pagForma})`,
          usuario_id: user?.id || null,
        });
      }

      toast.success(`Pagamento de R$ ${valor.toFixed(2)} registrado!`);
      setPagModal(false);
      setPagValor('');
      setPagDesc('');
      fetchPagamentos();
    } catch {
      toast.error('Erro ao registrar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const handleLancarDespesa = async () => {
    const valor = parseFloat(despesaValor);
    if (!valor || valor <= 0) { toast.error('Informe um valor válido'); return; }
    if (!despesaMotivo.trim()) { toast.error('Informe o motivo da despesa'); return; }

    setDespesaLoading(true);
    try {
      const { error } = await supabase.from('funcionario_pagamentos').insert({
        funcionario_id: id!,
        valor,
        forma: 'despesa',
        descricao: despesaMotivo.trim(),
      });
      if (error) throw error;

      toast.success(`Despesa de R$ ${valor.toFixed(2)} lançada!`);
      setDespesaModal(false);
      setDespesaValor('');
      setDespesaMotivo('');
      fetchPagamentos();
    } catch {
      toast.error('Erro ao lançar despesa');
    } finally {
      setDespesaLoading(false);
    }
  };

  // Running balance for history
  const historicoCompleto = useMemo(() => {
    let saldo = totalConsumo + totalDespesas;
    const sorted = [...pagamentosReais].reverse();
    const result = sorted.map(p => {
      saldo -= p.valor;
      return { ...p, saldoApos: Math.max(0, saldo), tipo: 'Pagamento' as const };
    });
    return result.reverse();
  }, [pagamentosReais, totalConsumo, totalDespesas]);

  if (!funcionario) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl font-serif text-gradient-gold animate-pulse">桜</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/funcionarios')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif text-foreground">{funcionario.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {funcionario.cargo || 'Sem cargo'} {!funcionario.ativo && '(Inativo)'}
            </p>
          </div>
        </div>
        <Badge className={funcionario.ativo ? 'bg-success/20 text-success border-success/30' : 'bg-muted text-muted-foreground'}>
          {funcionario.ativo ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Receipt className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total Consumido</p>
              <p className="text-lg font-bold text-foreground">R$ {totalConsumo.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <MinusCircle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Despesas</p>
              <p className="text-lg font-bold text-warning">R$ {totalDespesas.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CreditCard className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total Pago</p>
              <p className="text-lg font-bold text-success">R$ {totalPago.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass glow-red">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Saldo Devedor</p>
              <p className={`text-lg font-bold ${saldoDevedor > 0 ? 'text-destructive' : 'text-success'}`}>
                R$ {saldoDevedor.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {saldoDevedor > 0 && (
          <Button onClick={() => setPagModal(true)}>
            <DollarSign className="h-4 w-4 mr-1" /> Registrar Pagamento
          </Button>
        )}
        <Button variant="outline" onClick={() => { setDespesaValor(''); setDespesaMotivo(''); setDespesaModal(true); }}>
          <MinusCircle className="h-4 w-4 mr-1" /> Lançar Despesa
        </Button>
      </div>

      <Tabs defaultValue="comandas" className="w-full">
        <TabsList>
          <TabsTrigger value="comandas" className="text-xs">Comandas ({comandas.length})</TabsTrigger>
          <TabsTrigger value="entregas" className="text-xs">Deliveries ({entregas.length})</TabsTrigger>
          <TabsTrigger value="pagamentos" className="text-xs">Pagamentos ({pagamentosReais.length})</TabsTrigger>
          <TabsTrigger value="despesas" className="text-xs">Despesas ({despesas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="comandas" className="mt-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Nº</TableHead>
                    <TableHead>Mesa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor Consumo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comandas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma comanda de consumo registrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {comandas.map(c => (
                    <TableRow key={c.id} className="border-border">
                      <TableCell className="font-mono text-xs">{c.numero ? `#${c.numero}` : '—'}</TableCell>
                      <TableCell>{c.mesas ? `Mesa ${c.mesas.numero}` : '—'}</TableCell>
                      <TableCell className="text-xs">
                        {c.opened_at ? format(new Date(c.opened_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          c.status === 'aberta' ? 'bg-success/20 text-success border-success/30' :
                          c.status === 'fechada' ? 'bg-muted text-muted-foreground' :
                          'bg-destructive/20 text-destructive border-destructive/30'
                        }>
                          {c.status === 'aberta' ? 'Aberta' : c.status === 'fechada' ? 'Fechada' : 'Cancelada'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {(comandaTotais[c.id] || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/comanda/${c.id}`)}>
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="entregas" className="mt-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor Consumo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entregas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum delivery de consumo registrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {entregas.map(e => (
                    <TableRow key={e.id} className="border-border">
                      <TableCell className="font-mono text-xs">{e.numero ? `D#${e.numero}` : '—'}</TableCell>
                      <TableCell className="text-xs">
                        {e.opened_at ? format(new Date(e.opened_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          e.status === 'entregue' ? 'bg-success/20 text-success border-success/30' :
                          e.status === 'cancelada' ? 'bg-destructive/20 text-destructive border-destructive/30' :
                          'bg-warning/20 text-warning border-warning/30'
                        }>
                          {e.status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {(comandaTotais[e.id] || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/entrega/${e.id}`)}>
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor Pago</TableHead>
                    <TableHead className="text-right">Saldo Restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentosReais.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum pagamento registrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {historicoCompleto.map(p => (
                    <TableRow key={p.id} className="border-border">
                      <TableCell className="text-xs">
                        {format(new Date(p.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="capitalize">{p.forma.replace('_', ' ')}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{p.descricao || '—'}</TableCell>
                      <TableCell className="text-right font-medium text-success">
                        R$ {p.valor.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {p.saldoApos.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="despesas" className="mt-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="glass overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Nenhuma despesa lançada.
                      </TableCell>
                    </TableRow>
                  )}
                  {despesas.map(d => (
                    <TableRow key={d.id} className="border-border">
                      <TableCell className="text-xs">
                        {format(new Date(d.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">{d.descricao || '—'}</TableCell>
                      <TableCell className="text-right font-medium text-warning">
                        R$ {d.valor.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Payment Modal */}
      <Dialog open={pagModal} onOpenChange={setPagModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-secondary flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Saldo Devedor</span>
              <span className="font-bold text-destructive">R$ {saldoDevedor.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <CurrencyInput
                placeholder={saldoDevedor.toFixed(2).replace('.', ',')}
                value={pagValor}
                onValueChange={v => setPagValor(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={pagForma} onValueChange={setPagForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                  <SelectItem value="pix">📱 PIX</SelectItem>
                  <SelectItem value="cartao_credito">💳 Cartão Crédito</SelectItem>
                  <SelectItem value="cartao_debito">💳 Cartão Débito</SelectItem>
                  <SelectItem value="desconto_folha">📋 Desconto em Folha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Pagamento parcial ref. mês..."
                value={pagDesc}
                onChange={e => setPagDesc(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleRegistrarPagamento} disabled={loading}>
              {loading ? 'Registrando...' : 'Confirmar Pagamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Despesa Modal */}
      <Dialog open={despesaModal} onOpenChange={setDespesaModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Lançar Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <CurrencyInput
                value={despesaValor}
                onValueChange={v => setDespesaValor(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo / Descrição *</Label>
              <Textarea
                placeholder="Ex: Vale, adiantamento, desconto..."
                value={despesaMotivo}
                onChange={e => setDespesaMotivo(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleLancarDespesa} disabled={despesaLoading}>
              {despesaLoading ? 'Lançando...' : 'Confirmar Despesa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
