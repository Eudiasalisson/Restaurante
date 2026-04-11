import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Plus, Trash2, SendHorizonal, Clock, Users, User, ChefHat, ArrowLeft, DollarSign, Printer, History, ImageIcon, Receipt, CreditCard, Banknote, QrCode, XCircle, AlertTriangle, UserPlus, Pencil
} from 'lucide-react';
import { EditarPrecoItem } from '@/components/EditarPrecoItem';
import { EditarQtdItem } from '@/components/EditarQtdItem';
import { gerarCupomCozinha } from '@/components/comanda/CupomPDF';
import { deductStock, restoreStock, adjustStockForQtyChange, restoreStockForCancellation } from '@/lib/stockUtils';
import { gerarCupomComanda } from '@/components/comanda/CupomComandaPDF';
import { CupomCozinhaPreview } from '@/components/comanda/CupomCozinhaPreview';
import { CupomComandaPreview } from '@/components/comanda/CupomComandaPreview';
import { ComandaHistorico } from '@/components/comanda/ComandaHistorico';
import { PagamentoModal } from '@/components/PagamentoModal';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';
import { useEmpresa } from '@/hooks/useEmpresa';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ComandaData {
  id: string;
  numero: number | null;
  mesa_id: string | null;
  cliente_id: string | null;
  funcionario_id: string | null;
  funcionario_consumo_id: string | null;
  pessoas: number | null;
  status: string | null;
  opened_at: string | null;
  taxa_servico_ativa: boolean | null;
  taxa_servico_valor: number | null;
  desconto: number | null;
  acrescimo: number | null;
  mesas: { numero: number } | null;
  clientes: { nome: string } | null;
  funcionarios: { nome: string } | null;
}

interface FuncionarioConsumo {
  id: string;
  nome: string;
}

interface ComandaItem {
  id: string;
  produto_id: string;
  quantidade: number;
  observacao: string | null;
  status: 'pendente' | 'enviado_cozinha' | 'entregue' | 'cancelado' | null;
  preco_unitario: number;
  added_at: string | null;
  produtos: { nome: string } | null;
}

interface Produto {
  id: string;
  codigo: number | null;
  nome: string;
  preco_venda: number;
  preco_promocional: number | null;
  promocao_ativa: boolean | null;
  imagem_url: string | null;
  categoria_id: string | null;
  enviar_cozinha: boolean | null;
  categorias: { nome: string } | null;
}

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

const itemStatusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-warning/20 text-warning border-warning/30' },
  enviado_cozinha: { label: 'Na Cozinha', className: 'bg-primary/20 text-primary border-primary/30' },
  entregue: { label: 'Entregue', className: 'bg-success/20 text-success border-success/30' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive/20 text-destructive border-destructive/30' },
};

const formaLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  pix: 'PIX',
  consumo_funcionario: 'Consumo Funcionário',
  outro: 'Outro',
};

const formaIcons: Record<string, React.ReactNode> = {
  dinheiro: <Banknote className="h-3.5 w-3.5" />,
  cartao_credito: <CreditCard className="h-3.5 w-3.5" />,
  cartao_debito: <CreditCard className="h-3.5 w-3.5" />,
  pix: <QrCode className="h-3.5 w-3.5" />,
  consumo_funcionario: <User className="h-3.5 w-3.5" />,
  outro: <CreditCard className="h-3.5 w-3.5" />,
};

export default function ComandaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { empresa } = useEmpresa();

  const [comanda, setComanda] = useState<ComandaData | null>(null);
  const [itens, setItens] = useState<ComandaItem[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [funcConsumo, setFuncConsumo] = useState<FuncionarioConsumo | null>(null);

  // Product catalog
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSearch, setProdutoSearch] = useState('');

  // Add item modal
  const [addItemModal, setAddItemModal] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [addQtd, setAddQtd] = useState(1);
  const [addObs, setAddObs] = useState('');
  const [addPreco, setAddPreco] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [pagamentoModal, setPagamentoModal] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [previewType, setPreviewType] = useState<'cozinha' | 'comanda' | null>(null);

  // Cancel modal
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelFuncId, setCancelFuncId] = useState('');
  const [cancelRefNumber, setCancelRefNumber] = useState('');
  const [confirmString, setConfirmString] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  // Remove item modal
  const [removeItemModal, setRemoveItemModal] = useState(false);
  const [removeItem, setRemoveItem] = useState<ComandaItem | null>(null);
  const [removeMotivo, setRemoveMotivo] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);

  // Cliente update
  const [clienteModal, setClienteModal] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<any[]>([]);
  const [clienteLoading, setClienteLoading] = useState(false);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', cpf: '', email: '' });

  const fetchComanda = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('comandas')
      .select('*, mesas(numero), clientes(nome), funcionarios!comandas_funcionario_id_fkey(nome)')
      .eq('id', id)
      .single();
    if (data) {
      setComanda(data as any);
      if ((data as any).funcionario_consumo_id) {
        const { data: func } = await supabase
          .from('funcionarios')
          .select('id, nome')
          .eq('id', (data as any).funcionario_consumo_id)
          .single();
        if (func) setFuncConsumo(func as FuncionarioConsumo);
      } else {
        setFuncConsumo(null);
      }
    }
  }, [id]);

  const fetchItens = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('comanda_itens')
      .select('*, produtos(nome, descricao, enviar_cozinha)')
      .eq('comanda_id', id)
      .order('added_at', { ascending: true });
    if (data) setItens(data as any[]);
  }, [id]);

  const fetchPagamentos = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('comanda_id', id)
      .order('created_at');
    if (data) setPagamentos(data as Pagamento[]);
  }, [id]);

  const handleUpdateCliente = async (clienteId: string | null) => {
    if (!id) return;
    setClienteLoading(true);
    try {
      const { error } = await supabase.from('comandas').update({ cliente_id: clienteId }).eq('id', id);
      if (error) throw error;
      
      const newClienteNome = clienteResults.find(c => c.id === clienteId)?.nome || (clienteId === null ? 'Removido' : 'Novo');
      await supabase.from('comanda_historico').insert({
        comanda_id: id,
        acao: 'editar_comanda',
        descricao: `Cliente alterado para: ${newClienteNome}`,
        usuario_id: user?.id || null,
      });

      toast.success('Cliente atualizado!');
      setClienteModal(false);
      fetchComanda();
    } catch {
      toast.error('Erro ao atualizar cliente');
    } finally {
      setClienteLoading(false);
    }
  };

  const searchClientes = useCallback(async (query: string) => {
    if (query.length < 2) { setClienteResults([]); return; }
    const { data } = await supabase.from('clientes')
      .select('id, nome, cpf, telefone')
      .or(`nome.ilike.%${query}%,cpf.ilike.%${query}%,telefone.ilike.%${query}%`)
      .limit(8);
    if (data) setClienteResults(data);
  }, []);

  useEffect(() => {
    if (!clienteModal) return;
    const timeout = setTimeout(() => searchClientes(clienteSearch), 300);
    return () => clearTimeout(timeout);
  }, [clienteSearch, searchClientes, clienteModal]);

  const handleCriarCliente = async () => {
    if (clienteLoading) return;
    if (!novoCliente.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    setClienteLoading(true);
    try {
      const { data, error } = await supabase.from('clientes').insert({
        nome: novoCliente.nome.trim(),
        telefone: novoCliente.telefone || null,
        cpf: novoCliente.cpf || null,
        email: novoCliente.email || null,
      }).select('id, nome').single();
      
      if (error) throw error;
      await handleUpdateCliente(data.id);
      setShowNovoCliente(false);
      setNovoCliente({ nome: '', telefone: '', cpf: '', email: '' });
    } catch {
      toast.error('Erro ao criar cliente');
    } finally {
      setClienteLoading(false);
    }
  };

  const fetchProdutos = useCallback(async () => {
    const { data: prods } = await supabase.from('produtos').select('id, nome, preco_venda, preco_promocional, promocao_ativa, imagem_url, categoria_id, enviar_cozinha, categorias(nome)').eq('ativo', true).order('nome');
    if (prods) setProdutos(prods as any[]);
  }, []);

  const fetchFuncionarios = useCallback(async () => {
    const { data } = await supabase.from('funcionarios').select('id, nome, cargo').eq('ativo', true).order('nome');
    if (data) setFuncionarios(data);
  }, []);

  useEffect(() => { fetchComanda(); fetchItens(); fetchProdutos(); fetchPagamentos(); fetchFuncionarios(); }, [fetchComanda, fetchItens, fetchProdutos, fetchPagamentos, fetchFuncionarios]);

  // Filter products - single list, no category tabs
  const filteredProdutos = useMemo(() => {
    return produtos.filter(p => {
      const searchLower = produtoSearch.toLowerCase();
      return !produtoSearch || p.nome.toLowerCase().includes(searchLower) || (p.codigo && String(p.codigo).includes(produtoSearch));
    });
  }, [produtos, produtoSearch]);

  const handleSelectProduto = (p: Produto) => {
    setSelectedProduto(p);
    setAddQtd(1);
    setAddObs('');
    const preco = (p.promocao_ativa && p.preco_promocional) ? p.preco_promocional : p.preco_venda;
    setAddPreco(preco.toFixed(2));
    setAddItemModal(true);
  };

  const handleAddItem = async () => {
    if (!selectedProduto || !id) return;
    const precoOriginal = (selectedProduto.promocao_ativa && selectedProduto.preco_promocional)
      ? selectedProduto.preco_promocional : selectedProduto.preco_venda;
    const precoFinal = parseFloat(addPreco);
    if (isNaN(precoFinal) || precoFinal <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    setAddLoading(true);
    try {
      const { error } = await supabase.from('comanda_itens').insert({
        comanda_id: id,
        produto_id: selectedProduto.id,
        quantidade: addQtd,
        observacao: addObs || null,
        preco_unitario: precoFinal,
        status: 'pendente' as const,
      });
      if (error) throw error;
      const precoDesc = precoFinal !== precoOriginal ? ` (preço: R$ ${precoFinal.toFixed(2)})` : '';
      await supabase.from('comanda_historico').insert({
        comanda_id: id,
        acao: 'adicionar_item',
        descricao: `${addQtd}x ${selectedProduto.nome}${precoDesc}${addObs ? ` (${addObs})` : ''}`,
        usuario_id: user?.id || null,
      });
      toast.success(`${addQtd}x ${selectedProduto.nome} adicionado!`);
      setAddItemModal(false);
      fetchItens();
    } catch {
      toast.error('Erro ao adicionar item');
    } finally {
      setAddLoading(false);
    }
  };

  const openRemoveItemModal = (item: ComandaItem) => {
    setRemoveItem(item);
    setRemoveMotivo('');
    setRemoveItemModal(true);
  };

  const handleRemoveItem = async () => {
    if (!removeItem) return;
    if (!removeMotivo.trim()) { toast.error('Informe o motivo da remoção'); return; }
    setRemoveLoading(true);
    try {
      await supabase.from('comanda_itens').update({ status: 'cancelado' as const }).eq('id', removeItem.id);
      // Restore stock if item was already deducted
      if (removeItem.status && ['enviado_cozinha', 'entregue'].includes(removeItem.status)) {
        await restoreStock(
          [{ produto_id: removeItem.produto_id, quantidade: removeItem.quantidade }],
          user?.id || null,
          `Estorno (item removido: ${removeItem.produtos?.nome} — ${removeMotivo})`
        );
      }
      await supabase.from('comanda_historico').insert({
        comanda_id: id!,
        acao: 'cancelar_item',
        descricao: `Cancelado: ${removeItem.quantidade}x ${removeItem.produtos?.nome} — Motivo: ${removeMotivo}`,
        usuario_id: user?.id || null,
      });
      toast.success('Item removido');
      setRemoveItemModal(false);
      fetchItens();
    } catch {
      toast.error('Erro ao remover item');
    } finally {
      setRemoveLoading(false);
    }
  };


  const handleCancelarComanda = async () => {
    if (!cancelMotivo.trim()) { toast.error('Informe o motivo do cancelamento'); return; }
    if (!cancelFuncId) { toast.error('Selecione o funcionário responsável'); return; }

    const numConfirm = comanda?.numero ? String(comanda.numero) : '';
    if (cancelRefNumber !== numConfirm) {
      toast.error(`Para confirmar, digite o número ${numConfirm}`);
      return;
    }

    if (confirmString !== 'EUCONFIRMO') {
      toast.error('Para confirmar, digite EUCONFIRMO');
      return;
    }

    setCancelLoading(true);
    try {
      // Restore stock for items that were already deducted
      const activeItems = itens.filter(i => i.status !== 'cancelado');
      await restoreStockForCancellation(
        activeItems.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade, status: i.status })),
        user?.id || null
      );

      // If closed, we need to adjust cash (delete payments)
      if (comanda?.status === 'fechada') {
        const { error: payError } = await supabase
          .from('pagamentos')
          .delete()
          .eq('comanda_id', id!);
        
        if (payError) throw payError;
      }

      await supabase.from('comandas').update({
        status: 'cancelada' as const,
        closed_at: new Date().toISOString(),
      }).eq('id', id!);

      if (comanda?.mesa_id) {
        await supabase.from('mesas').update({ status: 'aberta' as const }).eq('id', comanda.mesa_id);
      }

      const funcNome = funcionarios.find(f => f.id === cancelFuncId)?.nome || '';
      await supabase.from('comanda_historico').insert({
        comanda_id: id!,
        acao: 'cancelamento',
        descricao: `Comanda cancelada por ${funcNome}. Motivo: ${cancelMotivo}`,
        usuario_id: user?.id || null,
      });

      toast.success('Comanda cancelada');
      setCancelModal(false);
      fetchComanda();
      fetchPagamentos();
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao cancelar comanda');
    } finally {
      setCancelLoading(false);
    }
  };

  const activeItens = useMemo(() => itens.filter(i => i.status !== 'cancelado'), [itens]);
  const subtotal = useMemo(() => activeItens.reduce((sum, i) => sum + i.preco_unitario * i.quantidade, 0), [activeItens]);
  const taxaServico = comanda?.taxa_servico_ativa ? subtotal * ((comanda.taxa_servico_valor || 10) / 100) : 0;
  const total = subtotal + taxaServico - (comanda?.desconto || 0) + (comanda?.acrescimo || 0);
  const pendentesCount = itens.filter(i => i.status === 'pendente').length;
  const totalPago = useMemo(() => pagamentos.reduce((s, p) => s + p.valor, 0), [pagamentos]);
  const saldoRestante = Math.max(0, total - totalPago);
  const isReadOnly = comanda?.status === 'fechada' || comanda?.status === 'cancelada';

  const statusBadgeConfig: Record<string, { label: string; className: string }> = {
    aberta: { label: 'Aberta', className: 'bg-success/20 text-success border-success/30' },
    fechada: { label: 'Fechada', className: 'bg-muted text-muted-foreground border-muted' },
    cancelada: { label: 'Cancelada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  };

  if (!comanda) {
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif text-foreground">
              Comanda — Mesa {comanda.mesas?.numero || '?'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {comanda.opened_at && format(new Date(comanda.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {funcConsumo && (
            <Badge className="bg-accent/20 text-accent border-accent/30">
              <User className="h-3 w-3 mr-1" /> Consumo: {funcConsumo.nome}
            </Badge>
          )}
          <Badge className={statusBadgeConfig[comanda.status || 'aberta']?.className}>
            {statusBadgeConfig[comanda.status || 'aberta']?.label}
          </Badge>
          {(comanda.status === 'aberta' || (comanda.status === 'fechada' && profile?.role === 'admin')) && (
            <Button size="sm" variant="destructive" onClick={() => { setCancelMotivo(''); setCancelFuncId(''); setCancelRefNumber(''); setConfirmString(''); setCancelModal(true); }}>
              <XCircle className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass cursor-pointer hover:border-primary/40 transition-colors" onClick={() => !isReadOnly && setClienteModal(true)}>
          <CardContent className="pt-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase">Cliente</p>
              <p className="text-sm font-medium text-foreground truncate">{comanda.clientes?.nome || 'Não informado'}</p>
            </div>
            {!isReadOnly && <Pencil className="h-3 w-3 text-muted-foreground" />}
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-4 flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-accent" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Garçom</p>
              <p className="text-sm font-medium text-foreground truncate">{comanda.funcionarios?.nome || 'Não informado'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Pessoas</p>
              <p className="text-sm font-medium text-foreground">{comanda.pessoas || 1}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Tempo</p>
              <p className="text-sm font-medium text-foreground">
                {comanda.opened_at ? formatDistanceToNow(new Date(comanda.opened_at), { locale: ptBR }) : '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="comanda" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="comanda" className="flex-1">Comanda</TabsTrigger>
          <TabsTrigger value="historico" className="flex-1">
            <History className="h-4 w-4 mr-1" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comanda" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Product catalog + Items */}
            <div className="lg:col-span-2 space-y-6">
              {/* Product Catalog - single list, no category tabs */}
              {!isReadOnly && (
              <Card className="glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-serif">Adicionar Produto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9 h-11 text-sm"
                      placeholder="Buscar por nome ou código..."
                      value={produtoSearch}
                      onChange={e => setProdutoSearch(e.target.value)}
                    />
                  </div>

                  <ScrollArea className="h-[280px]">
                    {filteredProdutos.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto encontrado.</p>
                    )}
                    <div className="space-y-1">
                      {filteredProdutos.map(p => {
                        const preco = (p.promocao_ativa && p.preco_promocional) ? p.preco_promocional : p.preco_venda;
                        return (
                          <button
                            key={p.id}
                            className="flex items-center gap-3 w-full p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all text-left cursor-pointer"
                            onClick={() => handleSelectProduto(p)}
                          >
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{p.codigo}</span>
                            <span className="text-xs font-medium text-foreground leading-tight flex-1 line-clamp-1">{p.nome}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {p.promocao_ativa && p.preco_promocional && (
                                <span className="text-[10px] line-through text-muted-foreground">R$ {p.preco_venda.toFixed(2)}</span>
                              )}
                              <span className="text-xs font-bold text-primary">R$ {preco.toFixed(2)}</span>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              )}

              {/* Items table */}
              <Card className="glass overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-serif">Itens da Comanda</CardTitle>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          // Update pending items to enviado_cozinha
                          const pendentes = itens.filter(i => i.status === 'pendente');
                          if (pendentes.length > 0) {
                            const produtoMap = new Map(produtos.map(p => [p.id, p]));
                            const paraCozinha = pendentes.filter(i => {
                              const prod = produtoMap.get(i.produto_id);
                              return prod?.enviar_cozinha !== false;
                            });
                            const semCozinha = pendentes.filter(i => {
                              const prod = produtoMap.get(i.produto_id);
                              return prod?.enviar_cozinha === false;
                            });
                            const ids = pendentes.map(i => i.id);
                            await supabase.from('comanda_itens').update({ status: 'enviado_cozinha' as const }).in('id', ids);
                            if (semCozinha.length > 0) {
                              const semIds = semCozinha.map(i => i.id);
                              await supabase.from('comanda_itens').update({ status: 'entregue' as const }).in('id', semIds);
                            }
                            const nomes = pendentes.map(i => `${i.quantidade}x ${i.produtos?.nome}`).join(', ');
                            await supabase.from('comanda_historico').insert({
                              comanda_id: id!,
                              acao: 'enviar_cozinha',
                              descricao: `Enviado para cozinha: ${nomes}`,
                              usuario_id: user?.id || null,
                            });
                            // Deduct stock for items with controle_estoque
                            await deductStock(
                              pendentes.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
                              user?.id || null
                            );
                            await fetchItens();
                          }
                          // Generate and show PDF
                          const { data: updatedItens } = await supabase
                            .from('comanda_itens')
                            .select('*, produtos(nome, descricao, enviar_cozinha)')
                            .eq('comanda_id', id!)
                            .order('added_at', { ascending: true });
                          const cozinhaItens = (updatedItens as any[] || itens).filter(
                            (i: any) => i.produtos?.enviar_cozinha !== false
                          );
                          const blob = await gerarCupomCozinha({
                            mesaNumero: comanda.mesas?.numero ?? null,
                            garcomNome: comanda.funcionarios?.nome ?? null,
                            clienteNome: comanda.clientes?.nome ?? null,
                            openedAt: comanda.opened_at,
                            itens: cozinhaItens,
                            empresa: empresa || undefined,
                          });
                          setPdfBlob(blob);
                          setPdfTitle('Cupom Cozinha');
                          setPdfFileName(`cupom-cozinha-${Date.now()}.pdf`);
                          setPreviewType('cozinha');
                          if (pendentes.length > 0) {
                            toast.success(`${pendentes.length} item(ns) enviado(s) para cozinha!`);
                          }
                        }}
                      >
                        <SendHorizonal className="h-4 w-4 mr-1" /> Enviar Cozinha
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const blob = await gerarCupomComanda({
                          mesaNumero: comanda.mesas?.numero ?? null,
                          garcomNome: comanda.funcionarios?.nome ?? null,
                          clienteNome: comanda.clientes?.nome ?? null,
                          openedAt: comanda.opened_at,
                          itens: activeItens,
                          subtotal,
                          taxaServicoAtiva: comanda.taxa_servico_ativa ?? false,
                          taxaServicoValor: comanda.taxa_servico_valor ?? 10,
                          taxaServico,
                          desconto: comanda.desconto ?? 0,
                          acrescimo: comanda.acrescimo ?? 0,
                          total,
                          pagamentos,
                          empresa: empresa || undefined,
                        });
                        setPdfBlob(blob);
                        setPdfTitle('Cupom Comanda');
                        setPdfFileName(`cupom-comanda-${Date.now()}.pdf`);
                        setPreviewType('comanda');
                      }}
                    >
                      <Receipt className="h-4 w-4 mr-1" /> Imprimir Comanda
                    </Button>
                  </div>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead>Obs</TableHead>
                      <TableHead className="text-right">Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum item adicionado. Selecione um produto acima.
                        </TableCell>
                      </TableRow>
                    )}
                    {itens.map(item => {
                      const sc = itemStatusConfig[item.status || 'pendente'];
                      const canDelete = !isReadOnly && item.status !== 'cancelado';
                      const canEdit = !isReadOnly && item.status !== 'cancelado';
                      return (
                        <TableRow key={item.id} className={`border-border ${item.status === 'cancelado' ? 'opacity-40' : ''}`}>
                          <TableCell className="font-medium">{item.produtos?.nome}</TableCell>
                          <TableCell className="text-center">
                            <EditarQtdItem
                              qtdAtual={item.quantidade}
                              disabled={!canEdit}
                              onSave={async (novaQtd) => {
                                await supabase.from('comanda_itens').update({ quantidade: novaQtd }).eq('id', item.id);
                                await adjustStockForQtyChange(item.produto_id, item.quantidade, novaQtd, item.status, user?.id || null);
                                await supabase.from('comanda_historico').insert({
                                  comanda_id: id!, acao: 'editar_item',
                                  descricao: `Qtd alterada: ${item.produtos?.nome} de ${item.quantidade} para ${novaQtd}`,
                                  usuario_id: user?.id || null,
                                });
                                toast.success('Quantidade atualizada');
                                fetchItens();
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate">{item.observacao || '-'}</TableCell>
                          <TableCell className="text-right">
                            <EditarPrecoItem
                              precoAtual={item.preco_unitario}
                              disabled={!canEdit}
                              onSave={async (novoPreco) => {
                                await supabase.from('comanda_itens').update({ preco_unitario: novoPreco }).eq('id', item.id);
                                await supabase.from('comanda_historico').insert({
                                  comanda_id: id!, acao: 'editar_item',
                                  descricao: `Preço alterado: ${item.produtos?.nome} de R$ ${item.preco_unitario.toFixed(2)} para R$ ${novoPreco.toFixed(2)}`,
                                  usuario_id: user?.id || null,
                                });
                                toast.success('Preço atualizado');
                                fetchItens();
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">R$ {(item.preco_unitario * item.quantidade).toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={sc.className}>{sc.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {canDelete && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openRemoveItemModal(item)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Right column: Totals + Payment + Payment History */}
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="glass glow-gold sticky top-4">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {comanda.taxa_servico_ativa && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Taxa de serviço ({comanda.taxa_servico_valor}%)</span>
                        <span className="text-foreground">R$ {taxaServico.toFixed(2)}</span>
                      </div>
                    )}
                    {(comanda.desconto || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Desconto</span>
                        <span className="text-success">- R$ {Number(comanda.desconto).toFixed(2)}</span>
                      </div>
                    )}
                    {(comanda.acrescimo || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Acréscimo</span>
                        <span className="text-foreground">+ R$ {Number(comanda.acrescimo).toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="text-gradient-gold">R$ {total.toFixed(2)}</span>
                    </div>

                    {totalPago > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pago</span>
                        <span className="text-success">R$ {totalPago.toFixed(2)}</span>
                      </div>
                    )}
                    {saldoRestante > 0.01 && totalPago > 0 && (
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Restante</span>
                        <span className="text-primary">R$ {saldoRestante.toFixed(2)}</span>
                      </div>
                    )}

                    {!isReadOnly && (
                    <Button
                      className="w-full mt-2"
                      onClick={() => setPagamentoModal(true)}
                    >
                      <DollarSign className="h-4 w-4 mr-1" /> Registrar Pagamento
                    </Button>
                    )}

                    {/* Payment History */}
                    {pagamentos.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Pagamentos Realizados</p>
                          <div className="space-y-1.5">
                            {pagamentos.map(p => (
                              <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50 text-xs">
                                <div className="flex items-center gap-1.5">
                                  {formaIcons[p.forma]}
                                  <span className="text-foreground">{formaLabels[p.forma] || p.forma}</span>
                                  {p.created_at && (
                                    <span className="text-muted-foreground">
                                      {format(new Date(p.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium text-success">R$ {p.valor.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <ComandaHistorico comandaId={id!} />
        </TabsContent>
      </Tabs>

      {/* Add Item Modal */}
      <Dialog open={addItemModal} onOpenChange={setAddItemModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Adicionar Item</DialogTitle>
          </DialogHeader>
          {selectedProduto && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-secondary flex items-center gap-3">
                {selectedProduto.imagem_url ? (
                  <img src={selectedProduto.imagem_url} alt={selectedProduto.nome} className="h-14 w-14 rounded-md object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">{selectedProduto.nome}</p>
                  <p className="text-sm text-primary font-bold">
                    R$ {((selectedProduto.promocao_ativa && selectedProduto.preco_promocional) ? selectedProduto.preco_promocional : selectedProduto.preco_venda).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={addQtd} onChange={e => setAddQtd(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Preço Unitário</Label>
                <CurrencyInput value={addPreco} onValueChange={v => setAddPreco(v)} />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input placeholder="Ex: sem wasabi, molho à parte..." value={addObs} onChange={e => setAddObs(e.target.value)} />
              </div>
              <div className="flex justify-between items-center p-3 rounded-md bg-secondary">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-bold text-foreground">
                  R$ {((parseFloat(addPreco) || 0) * addQtd).toFixed(2)}
                </span>
              </div>
              <Button className="w-full" onClick={handleAddItem} disabled={addLoading}>
                <Plus className="h-4 w-4 mr-1" /> {addLoading ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={cancelModal} onOpenChange={setCancelModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">Cancelar Comanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p><strong>Atenção:</strong> Esta operação não é reversível. O estoque será estornado e os pagamentos vinculados serão excluídos do caixa.</p>
            </div>
            
            <div className="space-y-2">
              <Label>Motivo do cancelamento *</Label>
              <Textarea placeholder="Informe o motivo..." value={cancelMotivo} onChange={e => setCancelMotivo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Funcionário responsável *</Label>
              <Select value={cancelFuncId} onValueChange={setCancelFuncId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {funcionarios.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome} {f.cargo && `(${f.cargo})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label className="text-xs">Confirme o número da comanda (digite <strong>{comanda?.numero}</strong>):</Label>
                <Input placeholder={String(comanda?.numero)} value={cancelRefNumber} onChange={e => setCancelRefNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Digite <strong>EUCONFIRMO</strong> para finalizar:</Label>
                <Input placeholder="EUCONFIRMO" value={confirmString} onChange={e => setConfirmString(e.target.value.toUpperCase())} />
              </div>
            </div>

            <Button variant="destructive" className="w-full" onClick={handleCancelarComanda} disabled={cancelLoading}>
              {cancelLoading ? 'Cancelando...' : 'Confirmar Cancelamento Irreversível'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Item Modal */}
      <Dialog open={removeItemModal} onOpenChange={setRemoveItemModal}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">Remover Item</DialogTitle>
          </DialogHeader>
          {removeItem && (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Deseja remover <strong>{removeItem.quantidade}x {removeItem.produtos?.nome}</strong>?
              </p>
              <div className="space-y-2">
                <Label>Motivo da remoção *</Label>
                <Textarea placeholder="Informe o motivo..." value={removeMotivo} onChange={e => setRemoveMotivo(e.target.value)} />
              </div>
              <Button variant="destructive" className="w-full" onClick={handleRemoveItem} disabled={removeLoading}>
                {removeLoading ? 'Removendo...' : 'Confirmar Remoção'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PagamentoModal
        open={pagamentoModal}
        onOpenChange={setPagamentoModal}
        comandaId={id!}
        mesaId={comanda.mesa_id}
        subtotal={subtotal}
        taxaServicoAtiva={comanda.taxa_servico_ativa ?? true}
        taxaServicoValor={comanda.taxa_servico_valor ?? 10}
        desconto={comanda.desconto ?? 0}
        acrescimo={comanda.acrescimo ?? 0}
        onUpdated={() => { fetchComanda(); fetchPagamentos(); }}
        clienteId={comanda.cliente_id}
      />
      <PdfPreviewModal
        open={!!pdfBlob}
        onOpenChange={(open) => { if (!open) { setPdfBlob(null); setPreviewType(null); } }}
        pdfBlob={pdfBlob}
        title={pdfTitle}
        fileName={pdfFileName}
      >
        {previewType === 'cozinha' && (
          <CupomCozinhaPreview
            mesaNumero={comanda.mesas?.numero ?? null}
            garcomNome={comanda.funcionarios?.nome ?? null}
            clienteNome={comanda.clientes?.nome ?? null}
            openedAt={comanda.opened_at}
            itens={itens.filter((i: any) => (i.produtos as any)?.enviar_cozinha !== false)}
            empresa={empresa || undefined}
          />
        )}
        {previewType === 'comanda' && (
          <CupomComandaPreview
            mesaNumero={comanda.mesas?.numero ?? null}
            garcomNome={comanda.funcionarios?.nome ?? null}
            clienteNome={comanda.clientes?.nome ?? null}
            openedAt={comanda.opened_at}
            itens={activeItens}
            subtotal={subtotal}
            taxaServicoAtiva={comanda.taxa_servico_ativa ?? false}
            taxaServicoValor={comanda.taxa_servico_valor ?? 10}
            taxaServico={taxaServico}
            desconto={comanda.desconto ?? 0}
            acrescimo={comanda.acrescimo ?? 0}
            total={total}
            pagamentos={pagamentos}
            empresa={empresa || undefined}
          />
        )}
      </PdfPreviewModal>

      <Dialog open={clienteModal} onOpenChange={setClienteModal}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Alterar Cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {!showNovoCliente ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por nome, CPF ou telefone..."
                    value={clienteSearch}
                    onChange={e => setClienteSearch(e.target.value)}
                  />
                </div>

                {clienteResults.length > 0 && (
                  <div className="border border-border rounded-md max-h-48 overflow-auto">
                    {clienteResults.map(c => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-secondary text-sm transition-colors border-b border-border last:border-0"
                        onClick={() => handleUpdateCliente(c.id)}
                      >
                        <span className="font-medium text-foreground block">{c.nome}</span>
                        {(c.telefone || c.cpf) && (
                          <span className="text-[10px] text-muted-foreground">
                            {c.telefone}{c.telefone && c.cpf ? ' • ' : ''}{c.cpf}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleUpdateCliente(null)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remover Cliente
                  </Button>
                  <Button className="flex-1" onClick={() => setShowNovoCliente(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Novo Cliente
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <Input placeholder="Nome *" value={novoCliente.nome} onChange={e => setNovoCliente(f => ({ ...f, nome: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Telefone" value={novoCliente.telefone} onChange={e => setNovoCliente(f => ({ ...f, telefone: e.target.value }))} />
                  <Input placeholder="CPF" value={novoCliente.cpf} onChange={e => setNovoCliente(f => ({ ...f, cpf: e.target.value }))} />
                </div>
                <Input placeholder="E-mail" value={novoCliente.email} onChange={e => setNovoCliente(f => ({ ...f, email: e.target.value }))} />
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setShowNovoCliente(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleCriarCliente} disabled={clienteLoading}>
                    {clienteLoading ? 'Salvando...' : 'Cadastrar e Selecionar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
