import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Upload, ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';

interface Categoria { id: string; nome: string; }

interface Produto {
  id: string;
  codigo: number | null;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  preco_venda: number;
  preco_custo: number | null;
  preco_promocional: number | null;
  promocao_ativa: boolean;
  controle_estoque: boolean;
  estoque_atual: number | null;
  ativo: boolean;
  imagem_url: string | null;
  categorias?: { nome: string } | null;
}

const emptyForm = {
  nome: '', descricao: '', categoria_id: '', preco_venda: '', preco_custo: '',
  preco_promocional: '', promocao_ativa: false, controle_estoque: false, estoque_atual: '',
  estoque_minimo: '1', enviar_cozinha: true, exibir_cardapio: true,
  mais_pedido: false, novidade: false,
};

export default function Produtos() {
  const perms = usePermissions('produtos');
  const [items, setItems] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Produto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('produtos').select('*, categorias(nome)').order('nome'),
      supabase.from('categorias').select('id, nome').eq('ativo', true).order('nome'),
    ]);
    if (prods) setItems(prods as any[]);
    if (cats) setCategorias(cats as Categoria[]);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || (p.codigo && String(p.codigo).includes(search));
    const matchCat = filterCat === 'all' || p.categoria_id === filterCat;
    return matchSearch && matchCat;
  });

  const { paginatedItems, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(filtered);

  const openNew = () => { setEditing(null); setForm(emptyForm); setImageFile(null); setDialogOpen(true); };
  const openEdit = (p: Produto) => {
    setEditing(p);
    setForm({
      nome: p.nome, descricao: p.descricao || '', categoria_id: p.categoria_id || '',
      preco_venda: String(p.preco_venda), preco_custo: p.preco_custo ? String(p.preco_custo) : '',
      preco_promocional: p.preco_promocional ? String(p.preco_promocional) : '',
      promocao_ativa: p.promocao_ativa ?? false, controle_estoque: p.controle_estoque ?? false,
      estoque_atual: p.estoque_atual != null ? String(p.estoque_atual) : '',
      estoque_minimo: (p as any).estoque_minimo != null ? String((p as any).estoque_minimo) : '1',
      enviar_cozinha: (p as any).enviar_cozinha ?? true,
      exibir_cardapio: (p as any).exibir_cardapio ?? true,
      mais_pedido: (p as any).mais_pedido ?? false,
      novidade: (p as any).novidade ?? false,
    });
    setImageFile(null);
    setDialogOpen(true);
  };

  const uploadImage = async (produtoId: string): Promise<string | null> => {
    if (!imageFile) return editing?.imagem_url || null;
    const ext = imageFile.name.split('.').pop();
    const path = `produtos/${produtoId}.${ext}`;
    const { error } = await supabase.storage.from('images').upload(path, imageFile, { upsert: true });
    if (error) { toast.error('Erro no upload da imagem'); return null; }
    const { data } = supabase.storage.from('images').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.preco_venda) { toast.error('Nome e preço são obrigatórios'); return; }
    if (editing && !perms.pode_editar) { toast.error('Você não tem permissão para editar produtos'); return; }
    if (!editing && !perms.pode_criar) { toast.error('Você não tem permissão para criar produtos'); return; }
    setUploading(true);
    const payload: any = {
      nome: form.nome.trim(), descricao: form.descricao || null,
      categoria_id: form.categoria_id || null, preco_venda: parseFloat(form.preco_venda),
      preco_custo: form.preco_custo ? parseFloat(form.preco_custo) : null,
      preco_promocional: form.preco_promocional ? parseFloat(form.preco_promocional) : null,
      promocao_ativa: form.promocao_ativa, controle_estoque: form.controle_estoque,
      estoque_minimo: form.estoque_minimo ? parseInt(form.estoque_minimo) : 1,
      enviar_cozinha: form.enviar_cozinha,
      exibir_cardapio: form.exibir_cardapio,
      mais_pedido: form.mais_pedido,
      novidade: form.novidade,
    };

    // Only include estoque_atual if creating new product OR user explicitly changed the value
    if (!editing) {
      payload.estoque_atual = form.estoque_atual ? parseInt(form.estoque_atual) : 0;
    } else {
      const originalEstoque = editing.estoque_atual != null ? String(editing.estoque_atual) : '';
      if (form.estoque_atual !== originalEstoque) {
        payload.estoque_atual = form.estoque_atual ? parseInt(form.estoque_atual) : 0;
      }
    }

    if (editing) {
      const imgUrl = await uploadImage(editing.id);
      if (imgUrl) payload.imagem_url = imgUrl;
      const { error } = await supabase.from('produtos').update(payload).eq('id', editing.id);
      if (error) toast.error('Erro ao atualizar');
      else { toast.success('Atualizado!'); setDialogOpen(false); fetchData(); }
    } else {
      const { data, error } = await supabase.from('produtos').insert(payload).select('id').single();
      if (error || !data) { toast.error('Erro ao adicionar'); }
      else {
        const imgUrl = await uploadImage(data.id);
        if (imgUrl) await supabase.from('produtos').update({ imagem_url: imgUrl }).eq('id', data.id);
        toast.success('Adicionado!'); setDialogOpen(false); fetchData();
      }
    }
    setUploading(false);
  };

  const toggleAtivo = async (p: Produto) => {
    await supabase.from('produtos').update({ ativo: !p.ativo }).eq('id', p.id);
    toast.success(p.ativo ? 'Desativado' : 'Ativado');
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('produtos').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir. O produto pode estar vinculado a comandas ou entregas.');
    } else {
      toast.success('Produto excluído!');
      fetchData();
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground">{items.length} cadastrados</p>
        </div>
        {perms.pode_criar ? (
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        ) : (
          <Button size="sm" disabled title="Sem permissão para criar produtos"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Promo</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map(p => (
                <TableRow key={p.id} className="border-border">
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} className="text-destructive hover:text-destructive" disabled={!perms.pode_excluir} title={!perms.pode_excluir ? 'Sem permissão para excluir' : 'Excluir'}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo ?? '-'}</TableCell>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.categorias?.nome || '-'}</TableCell>
                  <TableCell>R$ {Number(p.preco_venda).toFixed(2)}</TableCell>
                  <TableCell>
                    {p.promocao_ativa && p.preco_promocional ? (
                      <Badge className="bg-success/20 text-success border-success/30">R$ {Number(p.preco_promocional).toFixed(2)}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{p.controle_estoque ? p.estoque_atual : '-'}</TableCell>
                  <TableCell><Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} disabled={!perms.pode_editar} title={!perms.pode_editar ? 'Sem permissão para editar' : 'Editar'}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedItems.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum encontrado</TableCell></TableRow>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">{editing ? 'Editar' : 'Novo'} Produto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.categoria_id} onValueChange={v => setForm(f => ({ ...f, categoria_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Preço Venda *</Label><CurrencyInput value={form.preco_venda} onValueChange={v => setForm(f => ({ ...f, preco_venda: v }))} /></div>
              <div className="space-y-2"><Label>Preço Custo</Label><CurrencyInput value={form.preco_custo} onValueChange={v => setForm(f => ({ ...f, preco_custo: v }))} /></div>
              <div className="space-y-2"><Label>Preço Promo</Label><CurrencyInput value={form.preco_promocional} onValueChange={v => setForm(f => ({ ...f, preco_promocional: v }))} /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2"><Switch checked={form.promocao_ativa} onCheckedChange={v => setForm(f => ({ ...f, promocao_ativa: v }))} /><Label className="text-xs">Promoção ativa</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.controle_estoque} onCheckedChange={v => setForm(f => ({ ...f, controle_estoque: v }))} /><Label className="text-xs">Controle estoque</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.enviar_cozinha} onCheckedChange={v => setForm(f => ({ ...f, enviar_cozinha: v }))} /><Label className="text-xs">Enviar p/ Cozinha</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.exibir_cardapio} onCheckedChange={v => setForm(f => ({ ...f, exibir_cardapio: v }))} /><Label className="text-xs">Exibir no Cardápio</Label></div>
            </div>
            {form.controle_estoque && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Estoque atual</Label><Input type="number" value={form.estoque_atual} onChange={e => setForm(f => ({ ...f, estoque_atual: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Estoque mínimo</Label><Input type="number" min={0} value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} /></div>
              </div>
            )}
            <Button onClick={handleSave} disabled={uploading || (editing ? !perms.pode_editar : !perms.pode_criar)} className="w-full">
              {uploading ? 'Salvando...' : editing ? (perms.pode_editar ? 'Salvar' : 'Sem permissão para editar') : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
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
