import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Truck, Clock, Plus, DoorOpen, Landmark, Package, ChefHat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovaEntregaModal } from '@/components/NovaEntregaModal';

interface Entrega {
  id: string;
  status: 'aberta' | 'em_preparo' | 'saiu_entrega' | 'entregue' | 'cancelada';
  opened_at: string;
  clientes: { nome: string } | null;
}

const entregaStatusConfig: Record<string, { label: string; className: string }> = {
  aberta: { label: 'Aberta', className: 'bg-warning/20 text-warning border-warning/30' },
  em_preparo: { label: 'Em Preparo', className: 'bg-accent/20 text-accent border-accent/30' },
  saiu_entrega: { label: 'Saiu p/ Entrega', className: 'bg-primary/20 text-primary border-primary/30' },
  entregue: { label: 'Entregue', className: 'bg-success/20 text-success border-success/30' },
  cancelada: { label: 'Cancelada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
};

export default function DashboardDelivery() {
  const navigate = useNavigate();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [novaEntregaModal, setNovaEntregaModal] = useState(false);
  const [caixaAberto, setCaixaAberto] = useState<boolean | null>(null);

  const fetchAll = async () => {
    const [entregasRes, caixaRes] = await Promise.all([
      supabase.from('entregas').select('*, clientes(nome)').in('status', ['aberta', 'em_preparo', 'saiu_entrega']).order('opened_at', { ascending: false }),
      supabase.from('caixas').select('id').eq('status', 'aberto').limit(1).maybeSingle(),
    ]);
    if (entregasRes.data) setEntregas(entregasRes.data as any[]);
    setCaixaAberto(!!caixaRes.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const abertasCount = entregas.filter(e => e.status === 'aberta').length;
  const emPreparoCount = entregas.filter(e => e.status === 'em_preparo').length;
  const saiuCount = entregas.filter(e => e.status === 'saiu_entrega').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-serif text-foreground">Dashboard Delivery</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos pedidos de entrega</p>
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
                <p className="text-xs text-muted-foreground">Não é possível criar pedidos delivery. Abra o caixa para iniciar as operações.</p>
              </div>
              <Button size="sm" variant="outline" className="border-warning/30 text-warning hover:bg-warning/10" onClick={() => navigate('/caixa')}>
                <DoorOpen className="h-4 w-4 mr-1" /> Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando</CardTitle>
              <Package className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{abertasCount}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Em Preparo</CardTitle>
              <ChefHat className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{emPreparoCount}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saiu p/ Entrega</CardTitle>
              <Truck className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{saiuCount}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delivery List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif text-foreground flex items-center gap-2">
            <Truck className="h-5 w-5 text-accent" /> Pedidos em Aberto
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

      <NovaEntregaModal open={novaEntregaModal} onOpenChange={setNovaEntregaModal} onSuccess={fetchAll} />
    </div>
  );
}
