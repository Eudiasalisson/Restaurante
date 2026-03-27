import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';

interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

const emptyForm = { nome: '', descricao: '' };

export default function Categorias() {
  const [items, setItems] = useState<Categoria[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);

  const fetch = async () => {
    const { data } = await supabase.from('categorias').select('*').order('nome');
    if (data) setItems(data as Categoria[]);
  };

  useEffect(() => { fetch(); }, []);

  const filtered = items.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(filtered);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: Categoria) => {
    setEditing(c);
    setForm({ nome: c.nome, descricao: c.descricao || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    const payload = { nome: form.nome.trim(), descricao: form.descricao || null };
    if (editing) {
      const { error } = await supabase.from('categorias').update(payload).eq('id', editing.id);
      if (error) toast.error('Erro ao atualizar');
      else { toast.success('Atualizado!'); setDialogOpen(false); fetch(); }
    } else {
      const { error } = await supabase.from('categorias').insert(payload);
      if (error) toast.error('Erro ao adicionar');
      else { toast.success('Adicionado!'); setDialogOpen(false); fetch(); }
    }
  };

  const toggleAtivo = async (c: Categoria) => {
    await supabase.from('categorias').update({ ativo: !c.ativo }).eq('id', c.id);
    toast.success(c.ativo ? 'Desativada' : 'Ativada');
    fetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('categorias').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir. A categoria pode estar vinculada a produtos.');
    } else {
      toast.success('Categoria excluída!');
      fetch();
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Categorias</h1>
          <p className="text-sm text-muted-foreground">{items.length} cadastradas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle className="font-serif">{editing ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
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
                <TableHead className="w-12"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map(c => (
                <TableRow key={c.id} className="border-border">
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.descricao || '-'}</TableCell>
                  <TableCell><Switch checked={c.ativo} onCheckedChange={() => toggleAtivo(c)} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedItems.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma encontrada</TableCell></TableRow>
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
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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
