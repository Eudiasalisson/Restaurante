import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Users, Plus, Pencil, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Mesa {
  id: string;
  numero: number;
  capacidade: number;
  status: 'aberta' | 'ocupada' | 'reservada' | 'fechada';
}

interface UltimaComanda {
  numero: number | null;
  closed_at: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  aberta: { label: 'Livre', className: 'bg-success/20 text-success border-success/30' },
  ocupada: { label: 'Ocupada', className: 'bg-primary/20 text-primary border-primary/30' },
  reservada: { label: 'Reservada', className: 'bg-warning/20 text-warning border-warning/30' },
  fechada: { label: 'Fechada', className: 'bg-muted text-muted-foreground border-muted' },
};

export default function Mesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Mesa | null>(null);
  const [form, setForm] = useState({ numero: '', capacidade: '4' });
  const [ultimaComandaPorMesa, setUltimaComandaPorMesa] = useState<Map<string, UltimaComanda>>(new Map());

  const fetchMesas = async () => {
    const { data } = await supabase.from('mesas').select('*').order('numero');
    if (data) setMesas(data as Mesa[]);
  };

  const fetchUltimasComandas = async () => {
    const { data } = await supabase
      .from('comandas')
      .select('mesa_id, numero, closed_at')
      .not('mesa_id', 'is', null)
      .not('closed_at', 'is', null)
      .in('status', ['fechada', 'cancelada'])
      .order('closed_at', { ascending: false });

    if (data) {
      const map = new Map<string, UltimaComanda>();
      for (const c of data) {
        if (c.mesa_id && !map.has(c.mesa_id)) {
          map.set(c.mesa_id, { numero: c.numero, closed_at: c.closed_at! });
        }
      }
      setUltimaComandaPorMesa(map);
    }
  };

  useEffect(() => { fetchMesas(); fetchUltimasComandas(); }, []);

  const openNew = () => { setEditing(null); setForm({ numero: '', capacidade: '4' }); setDialogOpen(true); };
  const openEdit = (m: Mesa) => {
    setEditing(m);
    setForm({ numero: String(m.numero), capacidade: String(m.capacidade) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.numero) { toast.error('Número é obrigatório'); return; }
    const payload = { numero: parseInt(form.numero), capacidade: parseInt(form.capacidade) || 4 };
    if (editing) {
      const { error } = await supabase.from('mesas').update(payload).eq('id', editing.id);
      if (error) toast.error('Erro ao atualizar');
      else { toast.success('Atualizada!'); setDialogOpen(false); fetchMesas(); }
    } else {
      const { error } = await supabase.from('mesas').insert({ ...payload, status: 'aberta' as const });
      if (error) toast.error('Erro ao adicionar');
      else { toast.success('Mesa adicionada!'); setDialogOpen(false); fetchMesas(); }
    }
  };

  const handleDelete = async (m: Mesa) => {
    if (m.status === 'ocupada') { toast.error('Não é possível remover mesa ocupada'); return; }
    await supabase.from('mesas').delete().eq('id', m.id);
    toast.success('Mesa removida');
    fetchMesas();
  };

  const toggleStatus = async (mesa: Mesa) => {
    if (mesa.status === 'ocupada') {
      const { data: comandas } = await supabase
        .from('comandas')
        .select('id, status')
        .eq('mesa_id', mesa.id)
        .eq('status', 'aberta');
      if (comandas && comandas.length > 0) {
        toast.error('Não é possível fechar a mesa. A comanda precisa ser paga ou cancelada primeiro.');
        return;
      }
    }
    const next = mesa.status === 'aberta' ? 'ocupada' : 'aberta';
    await supabase.from('mesas').update({ status: next }).eq('id', mesa.id);
    toast.success(`Mesa ${mesa.numero} agora está ${next === 'aberta' ? 'livre' : 'ocupada'}`);
    fetchMesas();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Mesas</h1>
          <p className="text-sm text-muted-foreground">{mesas.length} mesas</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Mesa</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {mesas.map((mesa, i) => {
          const config = statusConfig[mesa.status];
          const ultima = mesa.status === 'aberta' ? ultimaComandaPorMesa.get(mesa.id) : null;
          return (
            <motion.div key={mesa.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
              <Card className={`glass transition-all hover:scale-[1.02] ${mesa.status === 'ocupada' ? 'glow-red' : ''}`}>
                <CardContent className="pt-6 text-center space-y-3">
                  <div className="text-3xl font-serif font-bold text-foreground cursor-pointer" onClick={() => toggleStatus(mesa)}>
                    {mesa.numero}
                  </div>
                  <Badge className={config.className}>{config.label}</Badge>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {mesa.capacidade} lugares
                  </div>
                  {ultima && (
                    <div className="space-y-0.5 pt-1 border-t border-border">
                      <p className="text-[10px] text-muted-foreground">
                        Última: Comanda #{ultima.numero || '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {format(new Date(ultima.closed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(mesa)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(mesa)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle className="font-serif">{editing ? 'Editar' : 'Nova'} Mesa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Número *</Label><Input type="number" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Capacidade</Label><Input type="number" value={form.capacidade} onChange={e => setForm(f => ({ ...f, capacidade: e.target.value }))} /></div>
            <Button onClick={handleSave} className="w-full">{editing ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
