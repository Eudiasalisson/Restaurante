import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Search, Package, ArrowUpCircle, ArrowDownCircle, History, ImageIcon, CalendarDays, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProdutoEstoque {
  id: string;
  nome: string;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  imagem_url: string | null;
  preco_venda: number;
  categorias: { nome: string } | null;
}

interface Movimentacao {
  id: string;
  tipo: string;
  quantidade: number;
  motivo: string | null;
  created_at: string;
}

export default function Inventario() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [search, setSearch] = useState('');
  const [movModal, setMovModal] = useState<{ tipo: 'entrada' | 'saida'; produto: ProdutoEstoque } | null>(null);
  const [movQtd, setMovQtd] = useState(1);
  const [movMotivo, setMovMotivo] = useState('');
  const [movLoading, setMovLoading] = useState(false);

  // History modal
  const [histProduto, setHistProduto] = useState<ProdutoEstoque | null>(null);
  const [historico, setHistorico] = useState<Movimentacao[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Last movements cache per product
  const [lastMovements, setLastMovements] = useState<Record<string, { ultima_entrada: string | null; ultima_saida: string | null }>>({});

  const fetchProdutos = useCallback(async () => {
    const { data } = await supabase
      .from('produtos')
      .select('id, nome, estoque_atual, estoque_minimo, imagem_url, preco_venda, categorias(nome)')
      .eq('controle_estoque', true)
      .eq('ativo', true)
      .order('nome');
    if (data) setProdutos(data as any[]);
  }, []);

  const fetchLastMovements = useCallback(async () => {
    const { data: entradas } = await supabase
      .from('estoque_movimentacoes')
      .select('produto_id, created_at')
      .eq('tipo', 'entrada')
      .order('created_at', { ascending: false });

    const { data: saidas } = await supabase
      .from('estoque_movimentacoes')
      .select('produto_id, created_at')
      .eq('tipo', 'saida')
      .order('created_at', { ascending: false });

    const map: Record<string, { ultima_entrada: string | null; ultima_saida: string | null }> = {};

    entradas?.forEach(e => {
      if (!map[e.produto_id]) map[e.produto_id] = { ultima_entrada: null, ultima_saida: null };
      if (!map[e.produto_id].ultima_entrada) map[e.produto_id].ultima_entrada = e.created_at;
    });

    saidas?.forEach(s => {
      if (!map[s.produto_id]) map[s.produto_id] = { ultima_entrada: null, ultima_saida: null };
      if (!map[s.produto_id].ultima_saida) map[s.produto_id].ultima_saida = s.created_at;
    });

    setLastMovements(map);
  }, []);

  useEffect(() => {
    fetchProdutos();
    fetchLastMovements();
  }, [fetchProdutos, fetchLastMovements]);

  const handleMovimentar = async () => {
    if (!movModal || movQtd < 1) return;
    setMovLoading(true);
    try {
      const { produto, tipo } = movModal;

      // Fetch current stock from DB to avoid stale state
      const { data: freshProd } = await supabase
        .from('produtos')
        .select('estoque_atual')
        .eq('id', produto.id)
        .single();

      const currentStock = freshProd?.estoque_atual || 0;
      const novoEstoque = tipo === 'entrada'
        ? currentStock + movQtd
        : Math.max(0, currentStock - movQtd);

      // Use RPC to update stock atomically (skips trigger to avoid duplicate movements)
      const { error: rpcError } = await supabase.rpc('update_stock', {
        p_produto_id: produto.id,
        p_novo_estoque: novoEstoque,
        p_tipo: tipo,
        p_quantidade: movQtd,
        p_motivo: movMotivo || `Movimentação manual (${tipo})`,
        p_usuario_id: user?.id || null,
      });
      if (rpcError) throw rpcError;

      toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${movQtd} un. registrada`);
      setMovModal(null);
      setMovQtd(1);
      setMovMotivo('');
      fetchProdutos();
      fetchLastMovements();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao registrar movimentação');
    } finally {
      setMovLoading(false);
    }
  };

  const openHistorico = async (produto: ProdutoEstoque) => {
    setHistProduto(produto);
    setHistLoading(true);
    const { data } = await supabase
      .from('estoque_movimentacoes')
      .select('*')
      .eq('produto_id', produto.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistorico((data as Movimentacao[]) || []);
    setHistLoading(false);
  };

  const filteredProdutos = produtos.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  const produtosEstoqueBaixo = useMemo(() => {
    return produtos.filter(p => {
      const estoque = p.estoque_atual || 0;
      const minimo = p.estoque_minimo ?? 1;
      return estoque < minimo;
    });
  }, [produtos]);

  const todosPag = usePagination(filteredProdutos);
  const baixoPag = usePagination(produtosEstoqueBaixo);

  const renderEstoqueTable = (list: ProdutoEstoque[], showMinimo = false, paginationProps?: {
    page: number; totalPages: number; totalItems: number; pageSize: number;
    onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void;
  }) => (
    <Card className="glass overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-12"></TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-center">Estoque</TableHead>
            {showMinimo && <TableHead className="text-center">Mínimo</TableHead>}
            <TableHead className="text-center">Última Entrada</TableHead>
            <TableHead className="text-center">Última Saída</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 && (
            <TableRow>
              <TableCell colSpan={showMinimo ? 8 : 7} className="text-center text-muted-foreground py-12">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {showMinimo ? 'Nenhum produto com estoque baixo. Tudo em ordem!' : 'Nenhum produto encontrado.'}
              </TableCell>
            </TableRow>
          )}
          {list.map((p, i) => {
            const mov = lastMovements[p.id];
            const estoque = p.estoque_atual || 0;
            const minimo = p.estoque_minimo ?? 1;
            const estoqueBaixo = estoque < minimo;
            return (
              <motion.tr
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="border-border hover:bg-secondary/30"
              >
                <TableCell>
                  {p.imagem_url ? (
                    <img src={p.imagem_url} alt={p.nome} className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium text-foreground">{p.nome}</TableCell>
                <TableCell className="text-muted-foreground">{p.categorias?.nome || '-'}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={estoqueBaixo ? 'destructive' : 'secondary'} className="font-bold">
                    {estoque}
                  </Badge>
                </TableCell>
                {showMinimo && (
                  <TableCell className="text-center">
                    <span className="text-sm text-muted-foreground">{minimo}</span>
                  </TableCell>
                )}
                <TableCell className="text-center text-xs text-muted-foreground">
                  {mov?.ultima_entrada
                    ? format(new Date(mov.ultima_entrada), 'dd/MM/yy HH:mm', { locale: ptBR })
                    : '-'}
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {mov?.ultima_saida
                    ? format(new Date(mov.ultima_saida), 'dd/MM/yy HH:mm', { locale: ptBR })
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="outline" className="gap-1 text-success border-success/30 hover:bg-success/10"
                      onClick={() => { setMovModal({ tipo: 'entrada', produto: p }); setMovQtd(1); setMovMotivo(''); }}>
                      <ArrowUpCircle className="h-3.5 w-3.5" /> Entrada
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => { setMovModal({ tipo: 'saida', produto: p }); setMovQtd(1); setMovMotivo(''); }}>
                      <ArrowDownCircle className="h-3.5 w-3.5" /> Saída
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openHistorico(p)}>
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </motion.tr>
            );
          })}
        </TableBody>
      </Table>
      {paginationProps && (
        <TablePagination
          page={paginationProps.page}
          totalPages={paginationProps.totalPages}
          totalItems={paginationProps.totalItems}
          pageSize={paginationProps.pageSize}
          onPageChange={paginationProps.onPageChange}
          onPageSizeChange={paginationProps.onPageSizeChange}
        />
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Inventário</h1>
          <p className="text-muted-foreground text-sm">{produtos.length} produtos com controle de estoque</p>
        </div>
        {produtosEstoqueBaixo.length > 0 && (
          <Badge variant="destructive" className="gap-1 text-sm px-3 py-1">
            <AlertTriangle className="h-3.5 w-3.5" /> {produtosEstoqueBaixo.length} com estoque baixo
          </Badge>
        )}
      </div>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList>
          <TabsTrigger value="todos">Todos ({produtos.length})</TabsTrigger>
          <TabsTrigger value="estoque-baixo" className="gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Estoque Baixo ({produtosEstoqueBaixo.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          {renderEstoqueTable(todosPag.paginatedItems, false, {
            page: todosPag.page, totalPages: todosPag.totalPages, totalItems: todosPag.totalItems,
            pageSize: todosPag.pageSize, onPageChange: todosPag.setPage, onPageSizeChange: todosPag.setPageSize,
          })}
        </TabsContent>

        <TabsContent value="estoque-baixo" className="mt-4 space-y-4">
          {produtosEstoqueBaixo.length > 0 && (
            <Card className="glass border-destructive/30">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {produtosEstoqueBaixo.length} produto(s) com estoque abaixo do mínimo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estes produtos precisam de reposição urgente.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {renderEstoqueTable(baixoPag.paginatedItems, true, {
            page: baixoPag.page, totalPages: baixoPag.totalPages, totalItems: baixoPag.totalItems,
            pageSize: baixoPag.pageSize, onPageChange: baixoPag.setPage, onPageSizeChange: baixoPag.setPageSize,
          })}
        </TabsContent>
      </Tabs>

      {/* Movement Modal */}
      <Dialog open={!!movModal} onOpenChange={o => { if (!o) setMovModal(null); }}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              {movModal?.tipo === 'entrada'
                ? <><ArrowUpCircle className="h-5 w-5 text-success" /> Entrada de Estoque</>
                : <><ArrowDownCircle className="h-5 w-5 text-destructive" /> Saída de Estoque</>}
            </DialogTitle>
          </DialogHeader>
          {movModal && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-secondary flex items-center gap-3">
                {movModal.produto.imagem_url ? (
                  <img src={movModal.produto.imagem_url} alt={movModal.produto.nome} className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">{movModal.produto.nome}</p>
                  <p className="text-xs text-muted-foreground">Estoque atual: {movModal.produto.estoque_atual || 0} | Mínimo: {movModal.produto.estoque_minimo ?? 1}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={movQtd} onChange={e => setMovQtd(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Input placeholder="Ex: Compra fornecedor, Quebra, Validade..." value={movMotivo} onChange={e => setMovMotivo(e.target.value)} />
              </div>
              <div className="p-3 rounded-md bg-secondary flex justify-between text-sm">
                <span className="text-muted-foreground">Novo estoque (estimado):</span>
                <span className="font-bold text-foreground">
                  {movModal.tipo === 'entrada'
                    ? (movModal.produto.estoque_atual || 0) + movQtd
                    : Math.max(0, (movModal.produto.estoque_atual || 0) - movQtd)}
                </span>
              </div>
              <Button className="w-full" onClick={handleMovimentar} disabled={movLoading}>
                {movLoading ? 'Registrando...' : `Registrar ${movModal.tipo === 'entrada' ? 'Entrada' : 'Saída'}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={!!histProduto} onOpenChange={o => { if (!o) setHistProduto(null); }}>
        <DialogContent className="glass max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico — {histProduto?.nome}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {histLoading ? (
              <div className="text-center text-muted-foreground py-8">Carregando...</div>
            ) : historico.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Nenhuma movimentação registrada.</div>
            ) : (
              <div className="space-y-2">
                {historico.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 text-sm">
                    <div className="flex items-center gap-2">
                      {m.tipo === 'entrada'
                        ? <ArrowUpCircle className="h-4 w-4 text-success flex-shrink-0" />
                        : <ArrowDownCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                      <div>
                        <span className="font-medium text-foreground">
                          {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade} un.
                        </span>
                        {m.motivo && <p className="text-xs text-muted-foreground">{m.motivo}</p>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
