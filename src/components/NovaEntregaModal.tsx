import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Plus, UserPlus, MapPin, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const formasPagamento = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartão Crédito' },
  { value: 'cartao_debito', label: 'Cartão Débito' },
  { value: 'pix', label: 'PIX' },
  { value: 'outro', label: 'Outro' },
];

interface Cliente {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
}

interface Endereco {
  id: string;
  label: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  principal: boolean | null;
}

interface Funcionario {
  id: string;
  nome: string;
  cargo: string | null;
}

interface NovaEntregaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovaEntregaModal({ open, onOpenChange, onSuccess }: NovaEntregaModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', cpf: '', email: '' });

  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [selectedEnderecoId, setSelectedEnderecoId] = useState('');
  const [showNovoEndereco, setShowNovoEndereco] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState({ label: '', logradouro: '', numero: '', bairro: '', cidade: '', cep: '' });

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState('');
  const [taxaEntrega, setTaxaEntrega] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from('funcionarios').select('id, nome, cargo').eq('ativo', true).order('nome')
        .then(({ data }) => { if (data) setFuncionarios(data); });
      setClienteSearch(''); setClienteResults([]); setSelectedCliente(null);
      setShowNovoCliente(false); setNovoCliente({ nome: '', telefone: '', cpf: '', email: '' });
      setEnderecos([]); setSelectedEnderecoId(''); setShowNovoEndereco(false);
      setNovoEndereco({ label: '', logradouro: '', numero: '', bairro: '', cidade: '', cep: '' });
      setSelectedFuncionarioId(''); setTaxaEntrega(0); setFormaPagamento('');
    }
  }, [open]);

  const searchClientes = useCallback(async (query: string) => {
    if (query.length < 2) { setClienteResults([]); return; }
    const phoneDigits = query.replace(/\D/g, '');
    const isPhoneSearch = phoneDigits.length >= 2 && phoneDigits.length === query.replace(/\s/g, '').length;
    
    let results: Cliente[] = [];
    if (isPhoneSearch) {
      // Search by phone digits
      const { data } = await supabase.from('clientes')
        .select('id, nome, cpf, telefone')
        .or(`telefone.ilike.%${phoneDigits}%,telefone.ilike.%${query}%`)
        .limit(8);
      if (data) results = data;
    } else {
      const { data } = await supabase.from('clientes')
        .select('id, nome, cpf, telefone')
        .or(`nome.ilike.%${query}%,cpf.ilike.%${query}%,telefone.ilike.%${query}%`)
        .limit(8);
      if (data) results = data;
    }
    setClienteResults(results);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => searchClientes(clienteSearch), 300);
    return () => clearTimeout(timeout);
  }, [clienteSearch, searchClientes]);

  // Fetch addresses when client selected
  useEffect(() => {
    if (!selectedCliente) { setEnderecos([]); setSelectedEnderecoId(''); return; }
    supabase.from('enderecos_cliente')
      .select('id, label, logradouro, numero, bairro, cidade, principal')
      .eq('cliente_id', selectedCliente.id)
      .order('principal', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setEnderecos(data);
          const principal = data.find(e => e.principal);
          if (principal) setSelectedEnderecoId(principal.id);
          else if (data.length > 0) setSelectedEnderecoId(data[0].id);
        }
      });
  }, [selectedCliente]);

  const handleCriarCliente = async () => {
    if (!novoCliente.nome.trim()) { toast.error('Nome é obrigatório'); return; }

    // Verificar duplicidade de nome
    const { data: existingNome } = await supabase
      .from('clientes').select('id').ilike('nome', novoCliente.nome.trim()).limit(1);
    if (existingNome && existingNome.length > 0) {
      toast.error('Já existe um cliente com este nome');
      return;
    }

    // Verificar duplicidade de telefone
    if (novoCliente.telefone.trim()) {
      const phoneDigits = novoCliente.telefone.replace(/\D/g, '');
      if (phoneDigits) {
        const { data: allClientes } = await supabase.from('clientes').select('id, telefone');
        const telDuplicate = allClientes?.find(c => c.telefone?.replace(/\D/g, '') === phoneDigits);
        if (telDuplicate) {
          toast.error('Já existe um cliente com este telefone');
          return;
        }
      }
    }

    const { data, error } = await supabase.from('clientes').insert({
      nome: novoCliente.nome.trim(),
      telefone: novoCliente.telefone || null,
      cpf: novoCliente.cpf || null,
      email: novoCliente.email || null,
    }).select('id, nome, cpf, telefone').single();
    if (error) { toast.error('Erro ao criar cliente'); return; }
    toast.success('Cliente criado!');
    setSelectedCliente(data);
    setShowNovoCliente(false);
    setClienteSearch('');
  };

  const handleCriarEndereco = async () => {
    if (!selectedCliente || !novoEndereco.logradouro.trim()) { toast.error('Logradouro é obrigatório'); return; }
    const { data, error } = await supabase.from('enderecos_cliente').insert({
      cliente_id: selectedCliente.id,
      label: novoEndereco.label || null,
      logradouro: novoEndereco.logradouro,
      numero: novoEndereco.numero || null,
      bairro: novoEndereco.bairro || null,
      cidade: novoEndereco.cidade || null,
      cep: novoEndereco.cep || null,
    }).select('id, label, logradouro, numero, bairro, cidade, principal').single();
    if (error) { toast.error('Erro ao salvar endereço'); return; }
    toast.success('Endereço adicionado!');
    setEnderecos(prev => [...prev, data]);
    setSelectedEnderecoId(data.id);
    setShowNovoEndereco(false);
    setNovoEndereco({ label: '', logradouro: '', numero: '', bairro: '', cidade: '', cep: '' });
  };

  const formatEndereco = (e: Endereco) => {
    const parts = [e.logradouro, e.numero, e.bairro, e.cidade].filter(Boolean);
    return e.label ? `${e.label}: ${parts.join(', ')}` : parts.join(', ') || 'Endereço sem detalhes';
  };

  const handleCriarEntrega = async () => {
    if (!selectedCliente) { toast.error('Selecione um cliente'); return; }
    if (!selectedEnderecoId) { toast.error('Selecione um endereço de entrega'); return; }
    if (!selectedFuncionarioId) { toast.error('Selecione o funcionário responsável'); return; }
    setLoading(true);
    try {
      // Check if caixa is open
      const { data: caixaAberto } = await supabase
        .from('caixas')
        .select('id')
        .eq('status', 'aberto')
        .limit(1)
        .maybeSingle();
      if (!caixaAberto) {
        toast.error('Não é possível criar delivery com o caixa fechado. Abra o caixa primeiro.');
        setLoading(false);
        return;
      }

      const { data: entrega, error } = await supabase.from('entregas').insert({
        cliente_id: selectedCliente.id,
        endereco_id: selectedEnderecoId,
        funcionario_id: selectedFuncionarioId || null,
        taxa_entrega: taxaEntrega,
        status: 'aberta' as const,
        forma_pagamento: formaPagamento || null,
      } as any).select('id').single();
      if (error || !entrega) throw error;

      await supabase.from('entrega_historico').insert({
        entrega_id: entrega.id,
        acao: 'abertura',
        descricao: `Pedido delivery aberto para ${selectedCliente.nome}`,
        usuario_id: user?.id || null,
      });

      toast.success('Pedido delivery criado!');
      onOpenChange(false);
      onSuccess();
      navigate(`/entrega/${entrega.id}`);
    } catch {
      toast.error('Erro ao criar pedido delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Truck className="h-5 w-5 text-accent" /> Novo Pedido Delivery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Client search */}
          {!showNovoCliente && (
            <div className="space-y-2">
              <Label>Cliente *</Label>
              {selectedCliente ? (
                <div className="flex items-center justify-between p-3 rounded-md bg-secondary">
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedCliente.nome}</p>
                    <p className="text-xs text-muted-foreground">{selectedCliente.telefone || selectedCliente.cpf || ''}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedCliente(null); setEnderecos([]); setSelectedEnderecoId(''); }}>Trocar</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input className="pl-9" placeholder="Buscar por nome, CPF ou telefone..." value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} />
                  </div>
                  {clienteResults.length > 0 && (
                    <div className="border border-border rounded-md max-h-40 overflow-auto">
                      {clienteResults.map(c => (
                        <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-secondary text-sm transition-colors" onClick={() => { setSelectedCliente(c); setClienteSearch(''); setClienteResults([]); }}>
                          <span className="font-medium text-foreground">{c.nome}</span>
                          {c.telefone && <span className="text-muted-foreground ml-2">• {c.telefone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setShowNovoCliente(true)}>
                    <UserPlus className="h-3 w-3 mr-1" /> Novo Cliente
                  </Button>
                </>
              )}
            </div>
          )}

          {showNovoCliente && (
            <div className="space-y-3 p-3 border border-border rounded-md">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Novo Cliente</Label>
                <Button size="sm" variant="ghost" onClick={() => setShowNovoCliente(false)}>Cancelar</Button>
              </div>
              <Input placeholder="Nome *" value={novoCliente.nome} onChange={e => setNovoCliente(f => ({ ...f, nome: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Telefone" value={novoCliente.telefone} onChange={e => setNovoCliente(f => ({ ...f, telefone: e.target.value }))} />
                <Input placeholder="CPF" value={novoCliente.cpf} onChange={e => setNovoCliente(f => ({ ...f, cpf: e.target.value }))} />
              </div>
              <Input placeholder="E-mail" value={novoCliente.email} onChange={e => setNovoCliente(f => ({ ...f, email: e.target.value }))} />
              <Button size="sm" className="w-full" onClick={handleCriarCliente}>
                <Plus className="h-3 w-3 mr-1" /> Cadastrar e Selecionar
              </Button>
            </div>
          )}

          {/* Address selection */}
          {selectedCliente && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Endereço de Entrega *</Label>
              {enderecos.length > 0 && !showNovoEndereco && (
                <Select value={selectedEnderecoId} onValueChange={setSelectedEnderecoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o endereço" /></SelectTrigger>
                  <SelectContent>
                    {enderecos.map(e => (
                      <SelectItem key={e.id} value={e.id}>{formatEndereco(e)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {enderecos.length === 0 && !showNovoEndereco && (
                <p className="text-xs text-muted-foreground">Nenhum endereço cadastrado para este cliente.</p>
              )}
              {!showNovoEndereco && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => setShowNovoEndereco(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Novo Endereço
                </Button>
              )}
              {showNovoEndereco && (
                <div className="space-y-2 p-3 border border-border rounded-md">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Novo Endereço</Label>
                    <Button size="sm" variant="ghost" onClick={() => setShowNovoEndereco(false)}>Cancelar</Button>
                  </div>
                  <Input placeholder="Rótulo (ex: Casa, Trabalho)" value={novoEndereco.label} onChange={e => setNovoEndereco(f => ({ ...f, label: e.target.value }))} />
                  <Input placeholder="Logradouro *" value={novoEndereco.logradouro} onChange={e => setNovoEndereco(f => ({ ...f, logradouro: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Número" value={novoEndereco.numero} onChange={e => setNovoEndereco(f => ({ ...f, numero: e.target.value }))} />
                    <Input placeholder="CEP" value={novoEndereco.cep} onChange={e => setNovoEndereco(f => ({ ...f, cep: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Bairro" value={novoEndereco.bairro} onChange={e => setNovoEndereco(f => ({ ...f, bairro: e.target.value }))} />
                    <Input placeholder="Cidade" value={novoEndereco.cidade} onChange={e => setNovoEndereco(f => ({ ...f, cidade: e.target.value }))} />
                  </div>
                  <Button size="sm" className="w-full" onClick={handleCriarEndereco}>
                    <Plus className="h-3 w-3 mr-1" /> Salvar Endereço
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Driver / Funcionario */}
          <div className="space-y-2">
            <Label>Entregador / Responsável *</Label>
            <Select value={selectedFuncionarioId} onValueChange={setSelectedFuncionarioId}>
              <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
              <SelectContent>
                {funcionarios.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome} {f.cargo && `(${f.cargo})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delivery fee */}
          <div className="space-y-2">
            <Label>Taxa de Entrega (R$)</Label>
            <CurrencyInput value={String(taxaEntrega)} onValueChange={v => setTaxaEntrega(parseFloat(v) || 0)} />
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
              <SelectContent>
                {formasPagamento.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleCriarEntrega} disabled={loading}>
            <Truck className="h-4 w-4 mr-1" /> {loading ? 'Criando...' : 'Criar Pedido Delivery'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
