import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Grid3X3, Truck, DollarSign, Users, Clock, Eye, DoorOpen, Plus, AlertTriangle, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AbrirMesaModal } from '@/components/AbrirMesaModal';
import { NovaEntregaModal } from '@/components/NovaEntregaModal';

interface Mesa {
  id: string;
  numero: number;
  capacidade: number;
  status: 'aberta' | 'ocupada' | 'reservada' | 'fechada';
}

interface ComandaAberta {
  id: string;
  mesa_id: string | null;
  cliente_id: string | null;
  opened_at: string;
  clientes: { nome: string } | null;
}

interface Entrega {
  id: string;
  status: 'aberta' | 'em_preparo' | 'saiu_entrega' | 'entregue' | 'cancelada';
  opened_at: string;
  clientes: { nome: string } | null;
}

const mesaStatusConfig: Record<string, { label: string; badge: string; border: string }> = {
  aberta: { label: 'Livre', badge: 'bg-success/20 text-success border-success/30', border: 'border-success/20' },
  ocupada: { label: 'Ocupada', badge: 'bg-primary/20 text-primary border-primary/30', border: 'border-primary/30' },
  reservada: { label: 'Reservada', badge: 'bg-warning/20 text-warning border-warning/30', border: 'border-warning/20' },
  fechada: { label: 'Fechada', badge: 'bg-muted text-muted-foreground border-muted', border: 'border-muted' },
};

const entregaStatusConfig: Record<string, { label: string; className: string }> = {
  aberta: { label: 'Aberta', className: 'bg-warning/20 text-warning border-warning/30' },
  em_preparo: { label: 'Em Preparo', className: 'bg-accent/20 text-accent border-accent/30' },
  saiu_entrega: { label: 'Saiu p/ Entrega', className: 'bg-primary/20 text-primary border-primary/30' },
  entregue: { label: 'Entregue', className: 'bg-success/20 text-success border-success/30' },
  cancelada: { label: 'Cancelada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [comandasAbertas, setComandasAbertas] = useState<ComandaAberta[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [totalComandas, setTotalComandas] = useState(0);
  const [abrirMesaModal, setAbrirMesaModal] = useState(false);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [novaEntregaModal, setNovaEntregaModal] = useState(false);
  const [ultimaComandaPorMesa, setUltimaComandaPorMesa] = useState<Map<string, { numero: number | null; closed_at: string }>>(new Map());
  const [ultimoItemPorComanda, setUltimoItemPorComanda] = useState<Map<string, string>>(new Map());
  const [caixaAberto, setCaixaAberto] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const [mesasRes, comandasRes, entregasRes, totalRes, ultimasRes, caixaRes] = await Promise.all([
        supabase.from('mesas').select('*').order('numero'),
        supabase.from('comandas').select('*, clientes(nome)').eq('status', 'aberta'),
        supabase.from('entregas').select('*, clientes(nome)').in('status', ['aberta', 'em_preparo', 'saiu_entrega']).order('opened_at', { ascending: false }),
        supabase.from('comandas').select('id', { count: 'exact', head: true }).eq('status', 'aberta'),
        supabase.from('comandas').select('mesa_id, numero, closed_at').not('mesa_id', 'is', null).not('closed_at', 'is', null).in('status', ['fechada', 'cancelada']).order('closed_at', { ascending: false }),
        supabase.from('caixas').select('id').eq('status', 'aberto').limit(1).maybeSingle(),
      ]);
      if (mesasRes.data) setMesas(mesasRes.data as Mesa[]);
      if (comandasRes.data) setComandasAbertas(comandasRes.data as any[]);
      if (entregasRes.data) setEntregas(entregasRes.data as any[]);
      setTotalComandas(totalRes.count || 0);
      setCaixaAberto(!!caixaRes.data);
      if (ultimasRes.data) {
        const map = new Map<string, { numero: number | null; closed_at: string }>();
        for (const c of ultimasRes.data) {
          if (c.mesa_id && !map.has(c.mesa_id)) map.set(c.mesa_id, { numero: c.numero, closed_at: c.closed_at! });
        }
        setUltimaComandaPorMesa(map);
      }
      // Fetch last item added_at per open comanda
      if (comandasRes.data && comandasRes.data.length > 0) {
        const comandaIds = (comandasRes.data as any[]).map((c: any) => c.id);
        const { data: itensData } = await supabase
          .from('comanda_itens')
          .select('comanda_id, added_at')
          .in('comanda_id', comandaIds)
          .order('added_at', { ascending: false });
        if (itensData) {
          const map = new Map<string, string>();
          for (const item of itensData) {
            if (!map.has(item.comanda_id) && item.added_at) {
              map.set(item.comanda_id, item.added_at);
            }
          }
          setUltimoItemPorComanda(map);
        }
      }
    };
    fetchAll();
  }, []);

  // Map mesa_id -> comanda for occupied tables
  const comandaPorMesa = useMemo(() => {
    const map = new Map<string, ComandaAberta>();
    comandasAbertas.forEach(c => {
      if (c.mesa_id) map.set(c.mesa_id, c);
    });
    return map;
  }, [comandasAbertas]);

  const mesasOcupadas = mesas.filter(m => m.status === 'ocupada').length;
  const deliveryAbertos = entregas.length;

  const handleAbrirMesaClick = (mesa: Mesa) => {
    setMesaSelecionada(mesa);
    setAbrirMesaModal(true);
  };

  const refreshData = async () => {
    const [mesasRes, comandasRes, entregasRes, totalRes, ultimasRes, caixaRes] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('comandas').select('*, clientes(nome)').eq('status', 'aberta'),
      supabase.from('entregas').select('*, clientes(nome)').in('status', ['aberta', 'em_preparo', 'saiu_entrega']).order('opened_at', { ascending: false }),
      supabase.from('comandas').select('id', { count: 'exact', head: true }).eq('status', 'aberta'),
      supabase.from('comandas').select('mesa_id, numero, closed_at').not('mesa_id', 'is', null).not('closed_at', 'is', null).in('status', ['fechada', 'cancelada']).order('closed_at', { ascending: false }),
      supabase.from('caixas').select('id').eq('status', 'aberto').limit(1).maybeSingle(),
    ]);
    if (mesasRes.data) setMesas(mesasRes.data as Mesa[]);
    if (comandasRes.data) setComandasAbertas(comandasRes.data as any[]);
    if (entregasRes.data) setEntregas(entregasRes.data as any[]);
    setTotalComandas(totalRes.count || 0);
    setCaixaAberto(!!caixaRes.data);
    if (ultimasRes.data) {
      const map = new Map<string, { numero: number | null; closed_at: string }>();
      for (const c of ultimasRes.data) {
        if (c.mesa_id && !map.has(c.mesa_id)) map.set(c.mesa_id, { numero: c.numero, closed_at: c.closed_at! });
      }
      setUltimaComandaPorMesa(map);
    }
    if (comandasRes.data && comandasRes.data.length > 0) {
      const comandaIds = (comandasRes.data as any[]).map((c: any) => c.id);
      const { data: itensData } = await supabase
        .from('comanda_itens')
        .select('comanda_id, added_at')
        .in('comanda_id', comandaIds)
        .order('added_at', { ascending: false });
      if (itensData) {
        const map = new Map<string, string>();
        for (const item of itensData) {
          if (!map.has(item.comanda_id) && item.added_at) {
            map.set(item.comanda_id, item.added_at);
          }
        }
        setUltimoItemPorComanda(map);
      }
    }
  };

  const summaryCards = [
    { title: 'Mesas Ocupadas', value: `${mesasOcupadas} / ${mesas.length}`, icon: Grid3X3, color: 'text-primary' },
    { title: 'Delivery em Aberto', value: deliveryAbertos, icon: Truck, color: 'text-accent' },
    { title: 'Comandas Abertas', value: totalComandas, icon: DollarSign, color: 'text-gold' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do restaurante</p>
      </div>

      {caixaAberto === false && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning/20">
                <Landmark className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Caixa fechado</p>
                <p className="text-xs text-muted-foreground">Não é possível abrir mesas ou criar pedidos delivery. Abra o caixa para iniciar as operações.</p>
              </div>
              <Button size="sm" variant="outline" className="border-warning/30 text-warning hover:bg-warning/10" onClick={() => navigate('/caixa')}>
                <DoorOpen className="h-4 w-4 mr-1" /> Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{card.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Mesas Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-serif text-foreground flex items-center gap-2">
          <Grid3X3 className="h-5 w-5 text-primary" /> Mesas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {mesas.map((mesa, i) => {
            const config = mesaStatusConfig[mesa.status];
            const comanda = comandaPorMesa.get(mesa.id);
            const tempoAberta = comanda
              ? formatDistanceToNow(new Date(comanda.opened_at), { locale: ptBR, addSuffix: false })
              : null;
            const ultima = mesa.status === 'aberta' ? ultimaComandaPorMesa.get(mesa.id) : null;
            const isIdle = (() => {
              if (mesa.status !== 'ocupada' || !comanda) return false;
              const lastItemAt = ultimoItemPorComanda.get(comanda.id);
              const refTime = lastItemAt || comanda.opened_at;
              if (!refTime) return false;
              return (Date.now() - new Date(refTime).getTime()) > 30 * 60 * 1000;
            })();

            return (
              <motion.div
                key={mesa.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className={`glass transition-all hover:scale-[1.02] ${mesa.status === 'ocupada' ? 'glow-red' : ''} ${config.border}`}>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="text-2xl font-serif font-bold text-foreground">{mesa.numero}</div>
                        {isIdle && (
                          <span title="30+ min sem consumo">
                            <AlertTriangle className="h-4 w-4 text-warning animate-pulse" />
                          </span>
                        )}
                      </div>
                      <Badge className={config.badge}>{config.label}</Badge>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {mesa.capacidade} lugares
                    </div>

                    {mesa.status === 'aberta' && ultima && (
                      <div className="space-y-0.5 pt-1 border-t border-border">
                        <p className="text-[10px] text-muted-foreground">
                          Última: Comanda #{ultima.numero || '—'}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {format(new Date(ultima.closed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    )}

                    {mesa.status === 'ocupada' && comanda && (
                      <div className="space-y-1 pt-1 border-t border-border">
                        {comanda.clientes && (
                          <p className="text-xs text-foreground font-medium truncate">{comanda.clientes.nome}</p>
                        )}
                        {tempoAberta && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {tempoAberta}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="pt-1">
                      {mesa.status === 'aberta' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs border-success/30 text-success hover:bg-success/10 hover:text-success"
                          onClick={() => handleAbrirMesaClick(mesa)}
                        >
                          <DoorOpen className="h-3 w-3 mr-1" /> Abrir Mesa
                        </Button>
                      )}
                      {mesa.status === 'ocupada' && (
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => {
                            const c = comandaPorMesa.get(mesa.id);
                            if (c) navigate(`/comanda/${c.id}`);
                            else navigate('/comandas');
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Ver Comanda
                        </Button>
                      )}
                      {mesa.status === 'reservada' && (
                        <Button size="sm" variant="outline" className="w-full text-xs border-warning/30 text-warning hover:bg-warning/10 hover:text-warning" disabled>
                          Reservada
                        </Button>
                      )}
                      {mesa.status === 'fechada' && (
                        <Button size="sm" variant="outline" className="w-full text-xs" disabled>
                          Fechada
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Delivery Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif text-foreground flex items-center gap-2">
            <Truck className="h-5 w-5 text-accent" /> Delivery
          </h2>
          <Button size="sm" onClick={() => setNovaEntregaModal(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Pedido
          </Button>
        </div>

        {entregas.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Nenhum pedido de delivery em aberto no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entregas.map((entrega, i) => {
              const config = entregaStatusConfig[entrega.status];
              return (
                <motion.div key={entrega.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="glass hover:border-accent/30 transition-colors cursor-pointer" onClick={() => navigate(`/entrega/${entrega.id}`)}>
                    <CardContent className="pt-5 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {entrega.clientes?.nome || 'Cliente não informado'}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(entrega.opened_at), { locale: ptBR, addSuffix: true })}
                          </p>
                        </div>
                        <Badge className={config.className}>{config.label}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AbrirMesaModal
        open={abrirMesaModal}
        onOpenChange={setAbrirMesaModal}
        mesa={mesaSelecionada}
        onSuccess={refreshData}
      />
      <NovaEntregaModal
        open={novaEntregaModal}
        onOpenChange={setNovaEntregaModal}
        onSuccess={refreshData}
      />
    </div>
  );
}
