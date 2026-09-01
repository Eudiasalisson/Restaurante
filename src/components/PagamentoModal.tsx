import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { CreditCard, Banknote, QrCode, CheckCircle2, User, Search } from 'lucide-react';
import { deductStockForClosing } from '@/lib/stockUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Pagamento {
  id: string;
  forma: string;
  valor: number;
  created_at: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
  cargo: string | null;
}

const formaLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  pix: 'PIX',
  consumo_funcionario: 'Consumo Funcionário',
  outro: 'Outro',
};

const formaIcons: Record<string, React.ReactNode> = {
  dinheiro: <Banknote className="h-4 w-4" />,
  cartao_credito: <CreditCard className="h-4 w-4" />,
  cartao_debito: <CreditCard className="h-4 w-4" />,
  pix: <QrCode className="h-4 w-4" />,
  consumo_funcionario: <User className="h-4 w-4" />,
  outro: <CreditCard className="h-4 w-4" />,
};

interface PagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comandaId: string;
  mesaId: string | null;
  subtotal: number;
  taxaServicoAtiva: boolean;
  taxaServicoValor: number;
  desconto: number;
  acrescimo: number;
  onUpdated: () => void;
  isEntrega?: boolean;
  entregaId?: string;
  clienteId?: string | null;
}

export function PagamentoModal({
  open, onOpenChange, comandaId, mesaId,
  subtotal: initialSubtotal,
  taxaServicoAtiva: initialTaxaAtiva,
  taxaServicoValor: initialTaxaValor,
  desconto: initialDesconto,
  acrescimo: initialAcrescimo,
  onUpdated,
  isEntrega,
  entregaId,
  clienteId,
}: PagamentoModalProps) {
  const { user } = useAuth();

  const [taxaAtiva, setTaxaAtiva] = useState(initialTaxaAtiva);
  const [acrescimo, setAcrescimo] = useState(initialAcrescimo);
  const [desconto, setDesconto] = useState(initialDesconto);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [valorRecebido, setValorRecebido] = useState('');
  const [forma, setForma] = useState<string>('pix');
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  // Consumo Funcionário
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcSearch, setFuncSearch] = useState('');
  const [selectedFuncId, setSelectedFuncId] = useState<string>('');

  useEffect(() => {
    if (open) {
      setTaxaAtiva(initialTaxaAtiva);
      setAcrescimo(initialAcrescimo);
      setDesconto(initialDesconto);
      setValorRecebido('');
      setForma('pix');
      setSelectedFuncId('');
      setFuncSearch('');
      fetchPagamentos();
      fetchFuncionarios();
    }
  }, [open, initialTaxaAtiva, initialAcrescimo, initialDesconto]);

  const fetchPagamentos = async () => {
    let query = supabase.from('pagamentos').select('*').order('created_at');
    if (isEntrega && entregaId) {
      query = query.eq('entrega_id', entregaId);
    } else {
      query = query.eq('comanda_id', comandaId);
    }
    const { data } = await query;
    if (data) setPagamentos(data as Pagamento[]);
  };

  const fetchFuncionarios = async () => {
    const { data } = await supabase.from('funcionarios').select('id, nome, cargo').eq('ativo', true).order('nome');
    if (data) setFuncionarios(data);
  };

  const filteredFuncionarios = useMemo(() => {
    if (!funcSearch) return funcionarios;
    return funcionarios.filter(f => f.nome.toLowerCase().includes(funcSearch.toLowerCase()));
  }, [funcionarios, funcSearch]);

  const taxaServico = taxaAtiva ? initialSubtotal * ((initialTaxaValor || 10) / 100) : 0;
  const total = initialSubtotal + taxaServico - desconto + acrescimo;
  const totalPago = useMemo(() => pagamentos.reduce((s, p) => s + p.valor, 0), [pagamentos]);
  const saldoRestante = Math.max(0, total - totalPago);
  const comandaPaga = saldoRestante <= 0.01;

  const saveFinancials = async () => {
    if (isEntrega) return;
    await supabase.from('comandas').update({
      taxa_servico_ativa: taxaAtiva,
      desconto,
      acrescimo,
    }).eq('id', comandaId);
  };

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => saveFinancials(), 500);
    return () => clearTimeout(timeout);
  }, [taxaAtiva, desconto, acrescimo]);

  const handleRegistrarPagamento = async () => {
    const valor = parseFloat(valorRecebido);
    if (!valor || valor <= 0) { toast.error('Informe um valor válido'); return; }
    if (!forma) { toast.error('Selecione a forma de pagamento'); return; }
    if (forma === 'consumo_funcionario' && !selectedFuncId) {
      toast.error('Selecione o funcionário');
      return;
    }

    setLoading(true);
    try {
      const insertData: any = { forma: forma as any, valor };
      if (isEntrega && entregaId) {
        insertData.entrega_id = entregaId;
      } else {
        insertData.comanda_id = comandaId;
      }
      const { error } = await supabase.from('pagamentos').insert(insertData);
      if (error) throw error;

      // If consumo_funcionario, link the employee to the comanda/entrega
      if (forma === 'consumo_funcionario' && selectedFuncId) {
        if (isEntrega && entregaId) {
          await supabase.from('entregas').update({
            funcionario_consumo_id: selectedFuncId,
          } as any).eq('id', entregaId);
        } else {
          await supabase.from('comandas').update({
            funcionario_consumo_id: selectedFuncId,
          }).eq('id', comandaId);
        }
      }

      const funcNome = forma === 'consumo_funcionario'
        ? funcionarios.find(f => f.id === selectedFuncId)?.nome || ''
        : '';
      const descLabel = forma === 'consumo_funcionario'
        ? `Consumo Funcionário (${funcNome}) — R$ ${valor.toFixed(2)}`
        : `Pagamento de R$ ${valor.toFixed(2)} via ${formaLabels[forma]}`;

      if (isEntrega && entregaId) {
        await supabase.from('entrega_historico').insert({
          entrega_id: entregaId,
          acao: 'pagamento',
          descricao: descLabel,
          usuario_id: user?.id || null,
        });
      } else {
        await supabase.from('comanda_historico').insert({
          comanda_id: comandaId,
          acao: 'pagamento',
          descricao: descLabel,
          usuario_id: user?.id || null,
        });
      }

      toast.success(`Pagamento de R$ ${valor.toFixed(2)} registrado!`);
      setValorRecebido('');
      setSelectedFuncId('');
      fetchPagamentos();
      onUpdated();
    } catch {
      toast.error('Erro ao registrar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const handleFecharComanda = async () => {
    if (!comandaPaga) {
      toast.error('Não é possível fechar a comanda sem que o total esteja pago. Registre os pagamentos necessários.');
      return;
    }
    setClosing(true);
    try {
      // Deduct stock for any pending items not yet sent to kitchen
      if (isEntrega && entregaId) {
        const { data: entregaItens } = await supabase
          .from('entrega_itens')
          .select('produto_id, quantidade, status')
          .eq('entrega_id', entregaId)
          .neq('status', 'cancelado');
        if (entregaItens) {
          await deductStockForClosing(
            entregaItens.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade, status: i.status })),
            user?.id || null
          );
        }

        await supabase.from('entregas').update({ status: 'entregue' as const }).eq('id', entregaId);
        await supabase.from('entrega_historico').insert({
          entrega_id: entregaId,
          acao: 'fechamento',
          descricao: `Pedido finalizado. Total: R$ ${total.toFixed(2)}`,
          usuario_id: user?.id || null,
        });
        toast.success('Pedido delivery finalizado!');
      } else {
        // --- LOGIC FOR CONSUMIDOR FINAL ---
        let finalClienteId = clienteId;

        if (!finalClienteId) {
          // 1. Tentar encontrar "Consumidor Final"
          const { data: existing } = await supabase
            .from('clientes')
            .select('id')
            .ilike('nome', 'Consumidor Final')
            .maybeSingle();

          if (existing) {
            finalClienteId = existing.id;
          } else {
            // 2. Criar se não existir
            const { data: created } = await supabase
              .from('clientes')
              .insert({ nome: 'Consumidor Final' })
              .select('id')
              .single();
            if (created) finalClienteId = created.id;
          }
        }

        const { data: comandaItens } = await supabase
          .from('comanda_itens')
          .select('produto_id, quantidade, status')
          .eq('comanda_id', comandaId)
          .neq('status', 'cancelado');
        if (comandaItens) {
          await deductStockForClosing(
            comandaItens.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade, status: i.status })),
            user?.id || null
          );
        }

        await supabase.from('comandas').update({
          status: 'fechada' as const,
          closed_at: new Date().toISOString(),
          taxa_servico_ativa: taxaAtiva,
          desconto,
          acrescimo,
          cliente_id: finalClienteId, // Garantindo o vínculo aqui
        }).eq('id', comandaId);

        if (mesaId) {
          await supabase.from('mesas').update({ status: 'aberta' as const }).eq('id', mesaId);
        }

        await supabase.from('comanda_historico').insert({
          comanda_id: comandaId,
          acao: 'fechamento',
          descricao: `Comanda fechada. Total: R$ ${total.toFixed(2)}${!clienteId ? ' (Vínculado ao Consumidor Final)' : ''}`,
          usuario_id: user?.id || null,
        });
        toast.success('Comanda fechada com sucesso!');
      }

      // Fica na tela da comanda/entrega (não volta para a listagem) para que o
      // operador possa emitir a NFC-e logo após o fechamento.
      onUpdated();
      onOpenChange(false);
    } catch {
      toast.error(isEntrega ? 'Erro ao finalizar pedido' : 'Erro ao fechar comanda');
    } finally {
      setClosing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Pagamento da Comanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Financial summary */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal dos itens</span>
              <span className="text-foreground font-medium">R$ {initialSubtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={taxaAtiva} onCheckedChange={setTaxaAtiva} id="taxa-toggle" />
                <Label htmlFor="taxa-toggle" className="text-sm text-muted-foreground">
                  Taxa de serviço ({initialTaxaValor || 10}%)
                </Label>
              </div>
              <span className="text-sm text-foreground">R$ {taxaServico.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Acréscimo (R$)</Label>
                <CurrencyInput
                  value={String(acrescimo)}
                  onValueChange={v => setAcrescimo(parseFloat(v) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Desconto (R$)</Label>
                <CurrencyInput
                  value={String(desconto)}
                  onValueChange={v => setDesconto(parseFloat(v) || 0)}
                />
              </div>
            </div>

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span className="text-foreground">Total</span>
              <span className="text-gradient-gold">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment history */}
          {pagamentos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">Pagamentos Realizados</Label>
              <div className="space-y-1">
                {pagamentos.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-secondary text-sm">
                    <div className="flex items-center gap-2">
                      {formaIcons[p.forma]}
                      <span className="text-foreground">{formaLabels[p.forma] || p.forma}</span>
                      {p.created_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(p.created_at), 'HH:mm', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-success">R$ {p.valor.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-medium pt-1">
                <span className="text-muted-foreground">Total pago</span>
                <span className="text-success">R$ {totalPago.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Remaining balance */}
          <div className="flex justify-between items-center p-3 rounded-md bg-secondary">
            <span className="text-sm font-medium text-muted-foreground">Saldo Restante</span>
            <span className={`text-lg font-bold ${comandaPaga ? 'text-success' : 'text-primary'}`}>
              R$ {saldoRestante.toFixed(2)}
            </span>
          </div>

          {/* Payment form */}
          {!comandaPaga && (
            <div className="space-y-3 p-3 border border-border rounded-md">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Valor Recebido (R$)</Label>
                <CurrencyInput
                  placeholder={saldoRestante.toFixed(2).replace('.', ',')}
                  value={valorRecebido}
                  onValueChange={v => setValorRecebido(v)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Forma de Pagamento</Label>
                <Select value={forma} onValueChange={(v) => { setForma(v); setSelectedFuncId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                    <SelectItem value="cartao_credito">💳 Cartão Crédito</SelectItem>
                    <SelectItem value="cartao_debito">💳 Cartão Débito</SelectItem>
                    <SelectItem value="pix">📱 PIX</SelectItem>
                    <SelectItem value="consumo_funcionario">👤 Consumo Funcionário</SelectItem>
                    <SelectItem value="outro">🔄 Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Employee selector for consumo_funcionario */}
              {forma === 'consumo_funcionario' && (
                <div className="space-y-2 p-3 rounded-md bg-secondary/50 border border-border">
                  <Label className="text-xs text-muted-foreground">Selecionar Funcionário</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-9 h-9 text-sm"
                      placeholder="Buscar funcionário..."
                      value={funcSearch}
                      onChange={e => setFuncSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {filteredFuncionarios.map(f => (
                      <button
                        key={f.id}
                        className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                          selectedFuncId === f.id
                            ? 'bg-primary/20 border border-primary/40 text-foreground'
                            : 'hover:bg-secondary text-foreground'
                        }`}
                        onClick={() => setSelectedFuncId(f.id)}
                      >
                        <span className="font-medium">{f.nome}</span>
                        {f.cargo && <span className="text-xs text-muted-foreground ml-2">{f.cargo}</span>}
                      </button>
                    ))}
                    {filteredFuncionarios.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Nenhum encontrado</p>
                    )}
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={handleRegistrarPagamento} disabled={loading}>
                {loading ? 'Registrando...' : 'Registrar Pagamento'}
              </Button>
            </div>
          )}

          {/* Close comanda button */}
          {comandaPaga && (
            <Button
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleFecharComanda}
              disabled={closing}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {closing ? 'Fechando...' : 'Fechar Comanda'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
