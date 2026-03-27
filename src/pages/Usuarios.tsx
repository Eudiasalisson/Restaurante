import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, Pencil, Shield, UserPlus, Eye, EyeOff, Key } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Usuario {
  id: string;
  email: string;
  role: 'admin' | 'garcom' | 'caixa' | 'cozinha';
  ativo: boolean;
  funcionario_id: string | null;
  funcionarios?: { nome: string } | null;
}

interface Funcionario { id: string; nome: string; }

interface Permissao {
  modulo: string;
  pode_visualizar: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
}

const roleLabels: Record<string, string> = { admin: 'Admin', garcom: 'Garçom', caixa: 'Caixa', cozinha: 'Cozinha' };

const MODULOS_GROUPS = [
  {
    label: 'Principal',
    modulos: [
      { key: 'dashboard_mesa', label: 'Dashboard Mesa' },
      { key: 'dashboard_delivery', label: 'Dashboard Delivery' },
      { key: 'caixa', label: 'Caixa' },
    ],
  },
  {
    label: 'Cadastros',
    modulos: [
      { key: 'mesas', label: 'Mesas' },
      { key: 'clientes', label: 'Clientes' },
      { key: 'produtos', label: 'Produtos' },
      { key: 'categorias', label: 'Categorias' },
    ],
  },
  {
    label: 'Gestão',
    modulos: [
      { key: 'comandas', label: 'Comandas' },
      { key: 'entregas', label: 'Entregas' },
      { key: 'inventario', label: 'Inventário' },
      { key: 'relatorios', label: 'Relatórios' },
      { key: 'relatorio_caixa', label: 'Rel. Caixa' },
    ],
  },
  {
    label: 'Administração',
    modulos: [
      { key: 'funcionarios', label: 'Funcionários' },
      { key: 'usuarios', label: 'Usuários' },
      { key: 'configuracoes', label: 'Configurações' },
    ],
  },
];

const MODULOS = MODULOS_GROUPS.flatMap(g => g.modulos);

const allPerms = { pode_visualizar: true, pode_criar: true, pode_editar: true, pode_excluir: true };
const noPerms = { pode_visualizar: false, pode_criar: false, pode_editar: false, pode_excluir: false };

function getDefaultPermissions(role: string): Permissao[] {
  if (role === 'admin') {
    return MODULOS.map(m => ({ modulo: m.key, ...allPerms }));
  }
  // Principal + Cadastros + configuracoes
  const allowedKeys = new Set([
    'dashboard_mesa', 'dashboard_delivery', 'caixa',
    'mesas', 'clientes', 'produtos', 'categorias',
    'configuracoes',
  ]);
  return MODULOS.map(m => ({
    modulo: m.key,
    ...(allowedKeys.has(m.key) ? allPerms : noPerms),
  }));
}

export default function Usuarios() {
  const { user } = useAuth();
  const [items, setItems] = useState<Usuario[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [search, setSearch] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm] = useState({ funcionario_id: '', role: 'garcom' as string });

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'garcom', funcionario_id: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Permissions dialog
  const [permOpen, setPermOpen] = useState(false);
  const [permUser, setPermUser] = useState<Usuario | null>(null);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  
  // Change password dialog
  const [passOpen, setPassOpen] = useState(false);
  const [passUser, setPassUser] = useState<Usuario | null>(null);
  const [newPass, setNewPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: u }, { data: f }] = await Promise.all([
      supabase.from('usuarios').select('*, funcionarios(nome)').order('email'),
      supabase.from('funcionarios').select('id, nome').eq('ativo', true).order('nome'),
    ]);
    if (u) setItems(u as any[]);
    if (f) setFuncionarios(f as Funcionario[]);
  }, []);

  useEffect(() => {
    fetchData();
    // Get current user role
    if (user) {
      supabase.from('usuarios').select('role').eq('id', user.id).single()
        .then(({ data }) => { if (data) setCurrentUserRole(data.role); });
    }
  }, [fetchData, user]);

  const isAdmin = currentUserRole === 'admin';
  const filtered = items.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));
  const { paginatedItems, page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination(filtered);

  const openEdit = (u: Usuario) => {
    setEditing(u);
    setForm({ funcionario_id: u.funcionario_id || '', role: u.role });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    const { error } = await supabase.from('usuarios').update({
      funcionario_id: form.funcionario_id || null,
      role: form.role as any,
    }).eq('id', editing.id);
    if (error) toast.error('Erro ao atualizar');
    else { toast.success('Atualizado!'); setDialogOpen(false); fetchData(); }
  };

  const toggleAtivo = async (u: Usuario) => {
    await supabase.from('usuarios').update({ ativo: !u.ativo }).eq('id', u.id);
    toast.success(u.ativo ? 'Desativado' : 'Ativado');
    fetchData();
  };

  // Create user
  const handleCreate = async () => {
    if (!createForm.email || !createForm.password) {
      toast.error('Email e senha são obrigatórios');
      return;
    }
    if (createForm.password.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setCreateLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-user', {
        body: {
          email: createForm.email,
          password: createForm.password,
          role: createForm.role,
          funcionario_id: createForm.funcionario_id || null,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Usuário criado com sucesso!');
      setCreateOpen(false);
      setCreateForm({ email: '', password: '', role: 'garcom', funcionario_id: '' });
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar usuário');
    } finally {
      setCreateLoading(false);
    }
  };

  // Permissions
  const openPermissions = async (u: Usuario) => {
    setPermUser(u);
    setPermOpen(true);
    setPermLoading(true);

    const { data } = await supabase
      .from('permissoes_usuario')
      .select('modulo, pode_visualizar, pode_criar, pode_editar, pode_excluir')
      .eq('usuario_id', u.id);

    // Build full permissions list with defaults
    const existingMap = new Map((data || []).map(p => [p.modulo, p]));
    const fullPerms = MODULOS.map(m => ({
      modulo: m.key,
      pode_visualizar: existingMap.get(m.key)?.pode_visualizar ?? false,
      pode_criar: existingMap.get(m.key)?.pode_criar ?? false,
      pode_editar: existingMap.get(m.key)?.pode_editar ?? false,
      pode_excluir: existingMap.get(m.key)?.pode_excluir ?? false,
    }));
    setPermissoes(fullPerms);
    setPermLoading(false);
  };

  const updatePerm = (modulo: string, field: keyof Permissao, value: boolean) => {
    setPermissoes(prev => prev.map(p =>
      p.modulo === modulo ? { ...p, [field]: value } : p
    ));
  };

  const toggleAllForModule = (modulo: string) => {
    setPermissoes(prev => prev.map(p => {
      if (p.modulo !== modulo) return p;
      const allTrue = p.pode_visualizar && p.pode_criar && p.pode_editar && p.pode_excluir;
      return { ...p, pode_visualizar: !allTrue, pode_criar: !allTrue, pode_editar: !allTrue, pode_excluir: !allTrue };
    }));
  };

  const savePermissions = async () => {
    if (!permUser) return;
    setPermLoading(true);

    // Delete existing and insert new
    await supabase.from('permissoes_usuario').delete().eq('usuario_id', permUser.id);

    const toInsert = permissoes
      .filter(p => p.pode_visualizar || p.pode_criar || p.pode_editar || p.pode_excluir)
      .map(p => ({
        usuario_id: permUser.id,
        modulo: p.modulo,
        pode_visualizar: p.pode_visualizar,
        pode_criar: p.pode_criar,
        pode_editar: p.pode_editar,
        pode_excluir: p.pode_excluir,
      }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from('permissoes_usuario').insert(toInsert);
      if (error) { toast.error('Erro ao salvar permissões'); setPermLoading(false); return; }
    }

    toast.success('Permissões salvas!');
    setPermOpen(false);
    setPermLoading(false);
  };

  const handleUpdatePass = async () => {
    if (!passUser || !newPass) return;
    if (newPass.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    setPassLoading(true);
    const { error } = await supabase.rpc('admin_update_user_password', {
      target_user_id: passUser.id,
      new_password: newPass
    });
    if (error) toast.error('Erro ao atualizar: ' + error.message);
    else {
      toast.success('Senha atualizada com sucesso!');
      setPassOpen(false);
      setNewPass('');
    }
    setPassLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">{items.length} cadastrados</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setCreateOpen(true); setCreateForm({ email: '', password: '', role: 'garcom', funcionario_id: '' }); }}>
            <UserPlus className="h-4 w-4 mr-1" /> Novo Usuário
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Email</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map(u => (
                <TableRow key={u.id} className="border-border">
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.funcionarios?.nome || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{roleLabels[u.role]}</Badge></TableCell>
                  <TableCell>
                    <Switch checked={u.ativo ?? true} onCheckedChange={() => toggleAtivo(u)} disabled={!isAdmin} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openPermissions(u)} title="Permissões">
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setPassUser(u); setPassOpen(true); }} title="Trocar Senha">
                            <Key className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle className="font-serif">Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário vinculado</Label>
              <Select value={form.funcionario_id} onValueChange={v => setForm(f => ({ ...f, funcionario_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="garcom">Garçom</SelectItem>
                  <SelectItem value="caixa">Caixa</SelectItem>
                  <SelectItem value="cozinha">Cozinha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle className="font-serif flex items-center gap-2"><UserPlus className="h-5 w-5" /> Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="email@exemplo.com" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={createForm.role} onValueChange={v => setCreateForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="garcom">Garçom</SelectItem>
                  <SelectItem value="caixa">Caixa</SelectItem>
                  <SelectItem value="cozinha">Cozinha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Funcionário vinculado (opcional)</Label>
              <Select value={createForm.funcionario_id} onValueChange={v => setCreateForm(f => ({ ...f, funcionario_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={createLoading}>
              {createLoading ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="glass max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Shield className="h-5 w-5" /> Permissões — {permUser?.email}
            </DialogTitle>
          </DialogHeader>
          {permLoading ? (
            <div className="text-center text-muted-foreground py-8">Carregando...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end mb-2">
                <Button variant="secondary" size="sm" onClick={() => {
                  if (permUser) setPermissoes(getDefaultPermissions(permUser.role));
                }}>
                  Carregar Padrão ({permUser ? roleLabels[permUser.role] : ''})
                </Button>
              </div>
              <ScrollArea className="max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead>Módulo</TableHead>
                      <TableHead className="text-center w-20">Ver</TableHead>
                      <TableHead className="text-center w-20">Criar</TableHead>
                      <TableHead className="text-center w-20">Editar</TableHead>
                      <TableHead className="text-center w-20">Excluir</TableHead>
                      <TableHead className="text-center w-20">Todos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULOS_GROUPS.map(group => (
                      <>
                        <TableRow key={`group-${group.label}`} className="border-border bg-muted/40">
                          <TableCell colSpan={6} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1.5">
                            {group.label}
                          </TableCell>
                        </TableRow>
                        {group.modulos.map(mod => {
                          const p = permissoes.find(pm => pm.modulo === mod.key);
                          if (!p) return null;
                          const allChecked = p.pode_visualizar && p.pode_criar && p.pode_editar && p.pode_excluir;
                          return (
                            <TableRow key={p.modulo} className="border-border">
                              <TableCell className="font-medium pl-6">{mod.label}</TableCell>
                              <TableCell className="text-center">
                                <Checkbox checked={p.pode_visualizar} onCheckedChange={v => updatePerm(p.modulo, 'pode_visualizar', !!v)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox checked={p.pode_criar} onCheckedChange={v => updatePerm(p.modulo, 'pode_criar', !!v)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox checked={p.pode_editar} onCheckedChange={v => updatePerm(p.modulo, 'pode_editar', !!v)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox checked={p.pode_excluir} onCheckedChange={v => updatePerm(p.modulo, 'pode_excluir', !!v)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox checked={allChecked} onCheckedChange={() => toggleAllForModule(p.modulo)} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPermOpen(false)}>Cancelar</Button>
                <Button onClick={savePermissions} disabled={permLoading}>Salvar Permissões</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Password Dialog */}
      <Dialog open={passOpen} onOpenChange={setPassOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle className="font-serif flex items-center gap-2"><Key className="h-5 w-5" /> Trocar Senha — {passUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={handleUpdatePass} className="w-full" disabled={passLoading}>
              {passLoading ? 'Atualizando...' : 'Confirmar Nova Senha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
