import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, MapPin, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';
import { PhoneInput } from '@/components/ui/phone-input';
import { formatPhone } from '@/lib/formatPhone';

interface Cliente {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  whatsapp: string | null;
}

interface Endereco {
  id: string;
  cliente_id: string;
  label: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  principal: boolean;
}

const emptyForm = { nome: '', email: '', telefone: '', cpf: '', whatsapp: '' };
const emptyEnd = { label: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' };

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Endereços
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [endForm, setEndForm] = useState(emptyEnd);
  const [addingEnd, setAddingEnd] = useState(false);
  const [editingEnd, setEditingEnd] = useState<Endereco | null>(null);

  const [enderecosMap, setEnderecosMap] = useState<Record<string, Endereco | null>>({});

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nome');
    if (data) {
      setClientes(data as Cliente[]);
      // Fetch principal addresses
      const { data: ends } = await supabase.from('enderecos_cliente').select('*').eq('principal', true);
      const map: Record<string, Endereco | null> = {};
      (ends || []).forEach((e: any) => { map[e.cliente_id] = e as Endereco; });
      setEnderecosMap(map);
    }
  };

  useEffect(() => { fetchClientes(); }, []);

  const filtered = clientes.filter(c => {
    const s = search.toLowerCase();
    const phoneDigits = search.replace(/\D/g, '');
    return c.nome.toLowerCase().includes(s) || 
      (phoneDigits.length >= 2 && c.telefone?.replace(/\D/g, '').includes(phoneDigits));
  });
  const { paginatedItems, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(filtered);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Cliente) => {
    setEditing(c);
    setForm({ nome: c.nome, email: c.email || '', telefone: c.telefone || '', cpf: c.cpf || '', whatsapp: c.whatsapp || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.telefone.trim()) { toast.error('Telefone é obrigatório'); return; }
    
    setSaving(true);
    try {
      const excludeId = editing?.id || '00000000-0000-0000-0000-000000000000';

      // Verificar duplicidade de nome
      const { data: existingNome } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nome', form.nome.trim())
        .neq('id', excludeId)
        .limit(1);
      
      if (existingNome && existingNome.length > 0) {
        toast.error('Já existe um cliente com este nome');
        setSaving(false);
        return;
      }

      // Verificar duplicidade de telefone
      const telefoneDigits = form.telefone.replace(/\D/g, '');
      const { data: allClientes } = await supabase
        .from('clientes')
        .select('id, telefone, whatsapp, email')
        .neq('id', excludeId);
      
      const telDuplicate = allClientes?.find(c => c.telefone?.replace(/\D/g, '') === telefoneDigits);
      if (telDuplicate) {
        toast.error('Já existe um cliente com este telefone');
        setSaving(false);
        return;
      }

      // Verificar duplicidade de whatsapp
      if (form.whatsapp.trim()) {
        const whatsDigits = form.whatsapp.replace(/\D/g, '');
        const whatsDuplicate = allClientes?.find(c => c.whatsapp?.replace(/\D/g, '') === whatsDigits);
        if (whatsDuplicate) {
          toast.error('Já existe um cliente com este WhatsApp');
          setSaving(false);
          return;
        }
      }

      // Verificar duplicidade de email
      if (form.email.trim()) {
        const emailDuplicate = allClientes?.find(c => c.email?.toLowerCase() === form.email.trim().toLowerCase());
        if (emailDuplicate) {
          toast.error('Já existe um cliente com este e-mail');
          setSaving(false);
          return;
        }
      }

      const payload = {
        nome: form.nome.trim(), 
        email: form.email || null,
        telefone: form.telefone || null, 
        cpf: form.cpf || null, 
        whatsapp: form.whatsapp || null,
      };
      
      if (editing) {
        const { error } = await supabase.from('clientes').update(payload).eq('id', editing.id);
        if (error) toast.error('Erro ao atualizar');
        else { toast.success('Atualizado!'); setDialogOpen(false); fetchClientes(); }
      } else {
        const { error } = await supabase.from('clientes').insert(payload);
        if (error) toast.error('Erro ao adicionar');
        else { toast.success('Adicionado!'); setDialogOpen(false); fetchClientes(); }
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', deleteId);
      if (error) {
        toast.error('Não é possível excluir: cliente vinculado a comandas ou entregas');
      } else {
        toast.success('Cliente excluído');
        fetchClientes();
      }
    } catch {
      toast.error('Erro ao excluir');
    } finally {
      setDeleteId(null);
    }
  };

  // Endereços management
  const openEnderecos = async (c: Cliente) => {
    setSelectedCliente(c);
    const { data } = await supabase.from('enderecos_cliente').select('*').eq('cliente_id', c.id).order('principal', { ascending: false });
    setEnderecos((data || []) as Endereco[]);
    setAddingEnd(false);
    setEditingEnd(null);
    setEndDialogOpen(true);
  };

  const handleSaveEnd = async () => {
    if (!selectedCliente || !endForm.logradouro.trim()) { toast.error('Logradouro é obrigatório'); return; }
    
    if (editingEnd) {
      // Update existing
      const { error } = await supabase.from('enderecos_cliente').update({
        label: endForm.label || null, 
        logradouro: endForm.logradouro, 
        numero: endForm.numero || null,
        complemento: endForm.complemento || null, 
        bairro: endForm.bairro || null,
        cidade: endForm.cidade || null, 
        uf: endForm.uf || null, 
        cep: endForm.cep || null,
      }).eq('id', editingEnd.id);
      if (error) toast.error('Erro ao atualizar');
      else { toast.success('Endereço atualizado!'); setEditingEnd(null); setEndForm(emptyEnd); openEnderecos(selectedCliente); }
    } else {
      // Insert new
      const { error } = await supabase.from('enderecos_cliente').insert({
        cliente_id: selectedCliente.id,
        label: endForm.label || null, 
        logradouro: endForm.logradouro, 
        numero: endForm.numero || null,
        complemento: endForm.complemento || null, 
        bairro: endForm.bairro || null,
        cidade: endForm.cidade || null, 
        uf: endForm.uf || null, 
        cep: endForm.cep || null,
      });
      if (error) toast.error('Erro');
      else { toast.success('Endereço adicionado!'); setAddingEnd(false); setEndForm(emptyEnd); openEnderecos(selectedCliente); }
    }
  };

  const startEditEnd = (e: Endereco) => {
    setEditingEnd(e);
    setAddingEnd(false);
    setEndForm({
      label: e.label || '',
      logradouro: e.logradouro || '',
      numero: e.numero || '',
      complemento: e.complemento || '',
      bairro: e.bairro || '',
      cidade: e.cidade || '',
      uf: e.uf || '',
      cep: e.cep || '',
    });
  };

  const setPrincipal = async (endId: string) => {
    if (!selectedCliente) return;
    await supabase.from('enderecos_cliente').update({ principal: false }).eq('cliente_id', selectedCliente.id);
    await supabase.from('enderecos_cliente').update({ principal: true }).eq('id', endId);
    toast.success('Definido como principal');
    openEnderecos(selectedCliente);
  };

  const removeEnd = async (endId: string) => {
    const { error } = await supabase.from('enderecos_cliente').delete().eq('id', endId);
    if (error) {
      toast.error('Não foi possível remover o endereço. Ele pode estar vinculado a uma entrega.');
      return;
    }
    toast.success('Removido');
    if (selectedCliente) openEnderecos(selectedCliente);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clientes.length} cadastrados</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Endereço Principal</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map(c => {
                const end = enderecosMap[c.id];
                const endStr = end
                  ? [end.logradouro, end.numero ? `nº ${end.numero}` : null, end.bairro].filter(Boolean).join(', ')
                  : '-';
                return (
                  <TableRow key={c.id} className="border-border">
                    <TableCell className="py-1.5">
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium py-1.5">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground py-1.5">{formatPhone(c.telefone) || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm py-1.5">{endStr}</TableCell>
                    <TableCell className="flex gap-1 py-1.5">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEnderecos(c)}><MapPin className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginatedItems.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum encontrado</TableCell></TableRow>
              )}
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
      </motion.div>

      {/* Cliente Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle className="font-serif">{editing ? 'Editar' : 'Novo'} Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>E-mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Telefone *</Label><PhoneInput value={form.telefone} onValueChange={v => setForm(f => ({ ...f, telefone: v }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} /></div>
              <div className="space-y-2"><Label>WhatsApp</Label><PhoneInput value={form.whatsapp} onValueChange={v => setForm(f => ({ ...f, whatsapp: v }))} /></div>
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saving}>{saving ? 'Salvando...' : (editing ? 'Salvar' : 'Adicionar')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Endereços Dialog */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="glass max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Endereços — {selectedCliente?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {enderecos.map(e => (
              <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2">
                    {e.label && <Badge variant="outline" className="text-xs">{e.label}</Badge>}
                    {e.principal && <Badge className="bg-primary/20 text-primary text-xs"><Star className="h-3 w-3 mr-1" />Principal</Badge>}
                  </div>
                  <p className="mt-1 text-foreground">{e.logradouro}{e.numero ? `, ${e.numero}` : ''}{e.complemento ? ` - ${e.complemento}` : ''}</p>
                  <p className="text-muted-foreground">{[e.bairro, e.cidade, e.uf].filter(Boolean).join(', ')}{e.cep ? ` — ${e.cep}` : ''}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEditEnd(e)} title="Editar endereço"><Pencil className="h-4 w-4" /></Button>
                  {!e.principal && <Button variant="ghost" size="icon" onClick={() => setPrincipal(e.id)} title="Definir como principal"><Star className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" onClick={() => removeEnd(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {enderecos.length === 0 && !addingEnd && !editingEnd && <p className="text-center text-muted-foreground text-sm py-4">Nenhum endereço cadastrado</p>}

            {(addingEnd || editingEnd) ? (
              <div className="space-y-3 p-3 rounded-lg border border-border">
                <div className="text-sm font-medium text-foreground mb-2">{editingEnd ? 'Editar Endereço' : 'Novo Endereço'}</div>
                <div className="space-y-2"><Label>Rótulo</Label><Input placeholder="Ex: Casa, Trabalho" value={endForm.label} onChange={e => setEndForm(f => ({ ...f, label: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-2"><Label>Logradouro *</Label><Input value={endForm.logradouro} onChange={e => setEndForm(f => ({ ...f, logradouro: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Número</Label><Input value={endForm.numero} onChange={e => setEndForm(f => ({ ...f, numero: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>Complemento</Label><Input value={endForm.complemento} onChange={e => setEndForm(f => ({ ...f, complemento: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2"><Label>Bairro</Label><Input value={endForm.bairro} onChange={e => setEndForm(f => ({ ...f, bairro: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Cidade</Label><Input value={endForm.cidade} onChange={e => setEndForm(f => ({ ...f, cidade: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={endForm.uf} onChange={e => setEndForm(f => ({ ...f, uf: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>CEP</Label><Input value={endForm.cep} onChange={e => setEndForm(f => ({ ...f, cep: e.target.value }))} /></div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveEnd} className="flex-1">{editingEnd ? 'Atualizar' : 'Salvar'}</Button>
                  <Button variant="outline" onClick={() => { setAddingEnd(false); setEditingEnd(null); setEndForm(emptyEnd); }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => { setEndForm(emptyEnd); setAddingEnd(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Endereço
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Se o cliente estiver vinculado a comandas ou entregas, a exclusão será bloqueada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
