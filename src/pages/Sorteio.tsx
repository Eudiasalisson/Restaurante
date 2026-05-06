import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Gift, Info, Trophy, Search, Phone, MapPin, Star } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/TablePagination';

interface ClienteParticipante {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  valor_total: number;
}

interface Ganhador extends ClienteParticipante {
  endereco_completo: string;
}

export default function Sorteio() {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);

  const [dateFrom, setDateFrom] = useState(format(thirtyDaysAgo, 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(today, 'yyyy-MM-dd'));
  const [valorMinimo, setValorMinimo] = useState('');
  const [participantes, setParticipantes] = useState<ClienteParticipante[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFiltered, setHasFiltered] = useState(false);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [ganhador, setGanhador] = useState<Ganhador | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const pagination = usePagination(participantes, 20);

  const canFilter = Boolean(dateFrom && dateTo && valorMinimo && parseFloat(valorMinimo) > 0);
  const canSortear = hasFiltered && participantes.length > 0 && countdown === null;

  const fetchData = async () => {
    setLoading(true);
    setHasFiltered(false);
    setParticipantes([]);

    const from = startOfDay(new Date(dateFrom + 'T12:00:00')).toISOString();
    const to = endOfDay(new Date(dateTo + 'T12:00:00')).toISOString();
    const minVal = parseFloat(valorMinimo) || 0;

    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, telefone, whatsapp')
      .not('nome', 'ilike', 'consumidor final');

    if (!clientes || clientes.length === 0) {
      setHasFiltered(true);
      setLoading(false);
      return;
    }

    const { data: comandas } = await supabase
      .from('comandas')
      .select('id, cliente_id, status')
      .not('cliente_id', 'is', null)
      .gte('opened_at', from)
      .lte('opened_at', to);

    const { data: entregas } = await supabase
      .from('entregas')
      .select('id, cliente_id, status')
      .not('cliente_id', 'is', null)
      .gte('opened_at', from)
      .lte('opened_at', to);

    const comandaIds = (comandas || []).filter(c => c.status === 'fechada').map(c => c.id);
    const entregaIds = (entregas || []).filter(e => e.status === 'entregue').map(e => e.id);

    let comandaItens: { comanda_id: string; quantidade: number; preco_unitario: number }[] = [];
    let entregaItens: { entrega_id: string; quantidade: number; preco_unitario: number }[] = [];

    if (comandaIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < comandaIds.length; i += batchSize) {
        const batch = comandaIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from('comanda_itens')
          .select('comanda_id, quantidade, preco_unitario')
          .in('comanda_id', batch)
          .neq('status', 'cancelado');
        if (data) comandaItens.push(...data);
      }
    }

    if (entregaIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < entregaIds.length; i += batchSize) {
        const batch = entregaIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from('entrega_itens')
          .select('entrega_id, quantidade, preco_unitario')
          .in('entrega_id', batch)
          .neq('status', 'cancelado');
        if (data) entregaItens.push(...data);
      }
    }

    const comandaClienteMap: Record<string, string> = {};
    (comandas || []).forEach(c => { if (c.cliente_id) comandaClienteMap[c.id] = c.cliente_id; });
    const entregaClienteMap: Record<string, string> = {};
    (entregas || []).forEach(e => { if (e.cliente_id) entregaClienteMap[e.id] = e.cliente_id; });

    const clienteMap: Record<string, ClienteParticipante> = {};
    clientes.forEach(c => {
      clienteMap[c.id] = { id: c.id, nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, valor_total: 0 };
    });

    comandaItens.forEach(item => {
      const clienteId = comandaClienteMap[item.comanda_id];
      if (clienteId && clienteMap[clienteId]) {
        clienteMap[clienteId].valor_total += item.quantidade * Number(item.preco_unitario);
      }
    });

    entregaItens.forEach(item => {
      const clienteId = entregaClienteMap[item.entrega_id];
      if (clienteId && clienteMap[clienteId]) {
        clienteMap[clienteId].valor_total += item.quantidade * Number(item.preco_unitario);
      }
    });

    const result = Object.values(clienteMap)
      .filter(c => c.valor_total >= minVal)
      .sort((a, b) => b.valor_total - a.valor_total);

    setParticipantes(result);
    setHasFiltered(true);
    setLoading(false);
  };

  const realizarSorteio = async () => {
    const idx = Math.floor(Math.random() * participantes.length);
    const vencedor = participantes[idx];

    const { data: enderecos } = await supabase
      .from('enderecos_cliente')
      .select('logradouro, numero, complemento, bairro, cidade, uf')
      .eq('cliente_id', vencedor.id)
      .order('principal', { ascending: false })
      .limit(1);

    let enderecoCompleto = 'Sem endereço cadastrado';
    if (enderecos && enderecos.length > 0) {
      const e = enderecos[0];
      const parts = [e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf].filter(Boolean);
      enderecoCompleto = parts.join(', ');
    }

    const ganhadorFinal: Ganhador = { ...vencedor, endereco_completo: enderecoCompleto };

    setCountdown(5);
    let count = 5;
    const interval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count === 0) {
        clearInterval(interval);
        setCountdown(null);
        setGanhador(ganhadorFinal);
        setModalOpen(true);
      }
    }, 1000);
  };

  const contato = ganhador?.whatsapp || ganhador?.telefone;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Sorteio</h1>
        <p className="text-sm text-muted-foreground">Sorteie um cliente entre os participantes da promoção</p>
      </div>

      <Card className="glass">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setHasFiltered(false); }}
              />
            </div>
            <div className="space-y-1">
              <Label>Data final</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setHasFiltered(false); }}
              />
            </div>
            <div className="space-y-1">
              <Label>Valor mínimo (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 100,00"
                value={valorMinimo}
                onChange={e => { setValorMinimo(e.target.value); setHasFiltered(false); }}
              />
            </div>
            <Button onClick={fetchData} disabled={loading || !canFilter}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Buscando...' : 'Filtrar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-xs text-muted-foreground">
          Defina o período e o valor mínimo de consumo para listar os participantes elegíveis. Apenas clientes com comandas finalizadas ou entregas entregues são considerados.
        </AlertDescription>
      </Alert>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 gap-6">
          <p className="text-white text-3xl font-serif tracking-widest uppercase">Sorteando...</p>
          <div
            key={countdown}
            className="text-[10rem] font-bold text-primary leading-none animate-ping"
            style={{ animationDuration: '0.8s', animationIterationCount: 1 }}
          >
            {countdown}
          </div>
        </div>
      )}

      {hasFiltered && !loading && (
        <>
          {participantes.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum cliente encontrado com consumo igual ou superior a R$ {parseFloat(valorMinimo || '0').toFixed(2)} no período selecionado.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card className="glass">
                  <CardContent className="pt-4 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Participantes</p>
                    <p className="text-xl font-bold text-foreground">{participantes.length}</p>
                  </CardContent>
                </Card>
                <Card className="glass">
                  <CardContent className="pt-4 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Valor mínimo</p>
                    <p className="text-xl font-bold text-gradient-gold">
                      R$ {parseFloat(valorMinimo).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button
                  size="lg"
                  onClick={realizarSorteio}
                  disabled={!canSortear}
                  className="gap-2"
                >
                  <Gift className="h-5 w-5" />
                  Realizar Sorteio
                </Button>
              </div>

              <Card className="glass overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Total Consumido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedItems.map((c, pageIndex) => {
                      const realIndex = (pagination.page - 1) * pagination.pageSize + pageIndex;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-center">
                            {realIndex === 0 ? (
                              <Trophy className="h-4 w-4 text-yellow-500 inline" />
                            ) : (
                              <span className="text-sm text-muted-foreground">{realIndex + 1}</span>
                            )}
                          </TableCell>
                          <TableCell className={realIndex === 0 ? 'font-bold' : ''}>{c.nome}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.whatsapp || c.telefone || '—'}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${realIndex === 0 ? 'text-primary' : ''}`}>
                            R$ {c.valor_total.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <TablePagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </Card>
            </>
          )}
        </>
      )}

      {/* Winner modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif text-center flex flex-col items-center gap-3 pb-2">
              <div className="relative">
                <Trophy className="h-16 w-16 text-yellow-500" />
                <Star className="h-5 w-5 text-yellow-400 absolute -top-1 -right-1 fill-yellow-400" />
              </div>
              Ganhador do Sorteio!
            </DialogTitle>
          </DialogHeader>

          {ganhador && (
            <div className="space-y-4 pt-2">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{ganhador.nome}</p>
                <p className="text-sm text-primary font-medium mt-1">
                  Consumo no período: R$ {ganhador.valor_total.toFixed(2)}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                {contato && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{contato}</span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="font-medium">{ganhador.endereco_completo}</span>
                </div>
              </div>

              <Button onClick={() => setModalOpen(false)} className="w-full mt-2">
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
