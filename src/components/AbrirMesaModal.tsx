import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Plus, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface Mesa {
  id: string;
  numero: number;
}

interface Cliente {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
  cargo: string | null;
}

interface AbrirMesaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mesa: Mesa | null;
  onSuccess: () => void;
}

export function AbrirMesaModal({ open, onOpenChange, mesa, onSuccess }: AbrirMesaModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Client search
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);

  // Novo cliente form
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', cpf: '', email: '' });

  // Funcionarios
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState('');

  // Pessoas
  const [pessoas, setPessoas] = useState(1);

  const [loading, setLoading] = useState(false);

  // Fetch funcionarios on open
  useEffect(() => {
    if (open) {
      supabase.from('funcionarios').select('id, nome, cargo').eq('ativo', true).order('nome')
        .then(({ data }) => { if (data) setFuncionarios(data); });
      // Reset state
      setClienteSearch('');
      setClienteResults([]);
      setSelectedCliente(null);
      setShowNovoCliente(false);
      setNovoCliente({ nome: '', telefone: '', cpf: '', email: '' });
      setSelectedFuncionarioId('');
      setPessoas(1);
    }
  }, [open]);

  // Search clients in real-time
  const searchClientes = useCallback(async (query: string) => {
    if (query.length < 2) { setClienteResults([]); return; }
    const { data } = await supabase.from('clientes')
      .select('id, nome, cpf, telefone')
      .or(`nome.ilike.%${query}%,cpf.ilike.%${query}%,telefone.ilike.%${query}%`)
      .limit(8);
    if (data) setClienteResults(data);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => searchClientes(clienteSearch), 300);
    return () => clearTimeout(timeout);
  }, [clienteSearch, searchClientes]);

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

  const handleAbrirMesa = async () => {
    if (!mesa) return;
    // Cliente e funcionário são opcionais
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
        toast.error('Não é possível abrir mesa com o caixa fechado. Abra o caixa primeiro.');
        setLoading(false);
        return;
      }

      // Create comanda
      const { data: comanda, error } = await supabase.from('comandas').insert({
        mesa_id: mesa.id,
        cliente_id: selectedCliente?.id || null,
        funcionario_id: selectedFuncionarioId || null,
        pessoas,
        status: 'aberta' as const,
      }).select('id').single();

      const clienteNome = selectedCliente?.nome || 'Consumidor Final';

      if (error || !comanda) throw error;

      // Update mesa status
      await supabase.from('mesas').update({ status: 'ocupada' as const }).eq('id', mesa.id);

      // Log history
      await supabase.from('comanda_historico').insert({
        comanda_id: comanda.id,
        acao: 'abertura',
        descricao: `Mesa ${mesa.numero} aberta com ${pessoas} pessoa(s)`,
        usuario_id: user?.id || null,
      });

      toast.success(`Mesa ${mesa.numero} aberta!`);
      onOpenChange(false);
      onSuccess();
      navigate(`/comanda/${comanda.id}`);
    } catch {
      toast.error('Erro ao abrir mesa');
    } finally {
      setLoading(false);
    }
  };

  if (!mesa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Abrir Mesa {mesa.numero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Client search */}
          {!showNovoCliente && (
            <div className="space-y-2">
              <Label>Cliente</Label>
              {selectedCliente ? (
                <div className="flex items-center justify-between p-3 rounded-md bg-secondary">
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedCliente.nome}</p>
                    <p className="text-xs text-muted-foreground">{selectedCliente.telefone || selectedCliente.cpf || ''}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedCliente(null)}>Trocar</Button>
                </div>
              ) : (
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
                    <div className="border border-border rounded-md max-h-40 overflow-auto">
                      {clienteResults.map(c => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-secondary text-sm transition-colors"
                          onClick={() => { setSelectedCliente(c); setClienteSearch(''); setClienteResults([]); }}
                        >
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

          {/* New client sub-form */}
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

          {/* Waiter select */}
          <div className="space-y-2">
            <Label>Garçom / Vendedor</Label>
            <Select value={selectedFuncionarioId} onValueChange={setSelectedFuncionarioId}>
              <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
              <SelectContent>
                {funcionarios.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome} {f.cargo && `(${f.cargo})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Number of people */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Users className="h-3 w-3" /> Número de Pessoas</Label>
            <Input type="number" min={1} max={50} value={pessoas} onChange={e => setPessoas(parseInt(e.target.value) || 1)} />
          </div>

          {/* Submit */}
          <Button className="w-full" onClick={handleAbrirMesa} disabled={loading}>
            {loading ? 'Abrindo...' : `Abrir Mesa ${mesa.numero}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
