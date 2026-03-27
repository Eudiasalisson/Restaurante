import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Grid3X3, DollarSign, Users, Clock, Eye, DoorOpen, AlertTriangle, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AbrirMesaModal } from '@/components/AbrirMesaModal';

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

const mesaStatusConfig: Record<string, { label: string; badge: string; border: string }> = {
  aberta: { label: 'Livre', badge: 'bg-success/20 text-success border-success/30', border: 'border-success/20' },
  ocupada: { label: 'Ocupada', badge: 'bg-primary/20 text-primary border-primary/30', border: 'border-primary/30' },
  reservada: { label: 'Reservada', badge: 'bg-warning/20 text-warning border-warning/30', border: 'border-warning/20' },
  fechada: { label: 'Fechada', badge: 'bg-muted text-muted-foreground border-muted', border: 'border-muted' },
};

export default function DashboardMesa() {
  const navigate = useNavigate();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [comandasAbertas, setComandasAbertas] = useState<ComandaAberta[]>([]);
  const [totalComandas, setTotalComandas] = useState(0);
  const [abrirMesaModal, setAbrirMesaModal] = useState(false);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [ultimaComandaPorMesa, setUltimaComandaPorMesa] = useState<Map<string, { numero: number | null; closed_at: string }>>(new Map());
  const [ultimoItemPorComanda, setUltimoItemPorComanda] = useState<Map<string, string>>(new Map());
  const [caixaAberto, setCaixaAberto] = useState<boolean | null>(null);

  const fetchAll = async () => {
    const [mesasRes, comandasRes, totalRes, ultimasRes, caixaRes] = await Promise.all([
      supabase.from('mesas').select('*').order('numero'),
      supabase.from('comandas').select('*, clientes(nome)').eq('status', 'aberta'),
      supabase.from('comandas').select('id', { count: 'exact', head: true }).eq('status', 'aberta'),
      supabase.from('comandas').select('mesa_id, numero, closed_at').not('mesa_id', 'is', null).not('closed_at', 'is', null).in('status', ['fechada', 'cancelada']).order('closed_at', { ascending: false }),
      supabase.from('caixas').select('id').eq('status', 'aberto').limit(1).maybeSingle(),
    ]);
    if (mesasRes.data) setMesas(mesasRes.data as Mesa[]);
    if (comandasRes.data) setComandasAbertas(comandasRes.data as any[]);
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

  useEffect(() => { fetchAll(); }, []);

  const comandaPorMesa = useMemo(() => {
    const map = new Map<string, ComandaAberta>();
    comandasAbertas.forEach(c => { if (c.mesa_id) map.set(c.mesa_id, c); });
    return map;
  }, [comandasAbertas]);

  const mesasOcupadas = mesas.filter(m => m.status === 'ocupada').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Dashboard Mesas</h1>
        <p className="text-sm text-muted-foreground">Visão geral das mesas e comandas</p>
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
                <p className="text-xs text-muted-foreground">Não é possível abrir mesas. Abra o caixa para iniciar as operações.</p>
              </div>
              <Button size="sm" variant="outline" className="border-warning/30 text-warning hover:bg-warning/10" onClick={() => navigate('/caixa')}>
                <DoorOpen className="h-4 w-4 mr-1" /> Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mesas Ocupadas</CardTitle>
              <Grid3X3 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{mesasOcupadas} / {mesas.length}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Comandas Abertas</CardTitle>
              <DollarSign className="h-5 w-5 text-gold" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalComandas}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Mesas Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-serif text-foreground flex items-center gap-2">
          <Grid3X3 className="h-5 w-5 text-primary" /> Mesas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {mesas.map((mesa, i) => {
            const config = mesaStatusConfig[mesa.status];
            const comanda = comandaPorMesa.get(mesa.id);
            const tempoAberta = comanda ? formatDistanceToNow(new Date(comanda.opened_at), { locale: ptBR, addSuffix: false }) : null;
            const ultima = mesa.status === 'aberta' ? ultimaComandaPorMesa.get(mesa.id) : null;
            const isIdle = (() => {
              if (mesa.status !== 'ocupada' || !comanda) return false;
              const lastItemAt = ultimoItemPorComanda.get(comanda.id);
              const refTime = lastItemAt || comanda.opened_at;
              if (!refTime) return false;
              return (Date.now() - new Date(refTime).getTime()) > 30 * 60 * 1000;
            })();

            return (
              <motion.div key={mesa.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
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
                        <p className="text-[10px] text-muted-foreground">Última: Comanda #{ultima.numero || '—'}</p>
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
                        <Button size="sm" variant="outline" className="w-full text-xs border-success/30 text-success hover:bg-success/10 hover:text-success" onClick={() => { setMesaSelecionada(mesa); setAbrirMesaModal(true); }}>
                          <DoorOpen className="h-3 w-3 mr-1" /> Abrir Mesa
                        </Button>
                      )}
                      {mesa.status === 'ocupada' && (
                        <Button size="sm" className="w-full text-xs" onClick={() => { const c = comandaPorMesa.get(mesa.id); if (c) navigate(`/comanda/${c.id}`); else navigate('/comandas'); }}>
                          <Eye className="h-3 w-3 mr-1" /> Ver Comanda
                        </Button>
                      )}
                      {mesa.status === 'reservada' && (
                        <Button size="sm" variant="outline" className="w-full text-xs border-warning/30 text-warning hover:bg-warning/10 hover:text-warning" disabled>Reservada</Button>
                      )}
                      {mesa.status === 'fechada' && (
                        <Button size="sm" variant="outline" className="w-full text-xs" disabled>Fechada</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AbrirMesaModal open={abrirMesaModal} onOpenChange={setAbrirMesaModal} mesa={mesaSelecionada} onSuccess={fetchAll} />
    </div>
  );
}
