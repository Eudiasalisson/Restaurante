import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  cargo: string | null;
  ativo: boolean;
}

const emptyForm = { nome: '', cpf: '', telefone: '', cargo: '' };

export default function Funcionarios() {
  const [items, setItems] = useState<Funcionario[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [form, setForm] = useState(emptyForm);
  const navigate = useNavigate();

  const fetch = async () => {
    const { data } = await supabase.from('funcionarios').select('*').order('nome');
    if (data) setItems(data as Funcionario[]);
  };

  useEffect(() => { fetch(); }, []);

  const filtered = items.filter(f => f.nome.toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(filtered);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (f: Funcionario) => {
    setEditing(f);
    setForm({ nome: f.nome, cpf: f.cpf || '', telefone: f.telefone || '', cargo: f.cargo || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    const payload = { nome: form.nome.trim(), cpf: form.cpf || null, telefone: form.telefone || null, cargo: form.cargo || null };
    if (editing) {
      const { error } = await supabase.from('funcionarios').update(payload).eq('id', editing.id);
      if (error) toast.error('Erro ao atualizar');
      else { toast.success('Atualizado!'); setDialogOpen(false); fetch(); }
    } else {
      const { error } = await supabase.from('funcionarios').insert(payload);
      if (error) toast.error('Erro ao adicionar');
      else { toast.success('Adicionado!'); setDialogOpen(false); fetch(); }
    }
  };

  const toggleAtivo = async (f: Funcionario) => {
    await supabase.from('funcionarios').update({ ativo: !f.ativo }).eq('id', f.id);
    toast.success(f.ativo ? 'Desativado' : 'Ativado');
    fetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Funcionários</h1>
          <p className="text-sm text-muted-foreground">{items.length} cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle className="font-serif">{editing ? 'Editar' : 'Novo'} Funcionário</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Garçom, Cozinheiro" /></div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Salvar' : 'Adicionar'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map(f => (
                <TableRow key={f.id} className="border-border">
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{f.cpf || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{f.telefone || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{f.cargo || '-'}</TableCell>
                  <TableCell>
                    <Switch checked={f.ativo} onCheckedChange={() => toggleAtivo(f)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/funcionario/${f.id}`)} title="Conta Interna">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedItems.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum encontrado</TableCell></TableRow>
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
    </div>
  );
}
