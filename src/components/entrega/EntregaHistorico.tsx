import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock } from 'lucide-react';

interface HistoricoItem {
  id: string;
  acao: string;
  descricao: string | null;
  created_at: string | null;
  usuario_id: string | null;
}

const acaoLabels: Record<string, { label: string; className: string }> = {
  abertura: { label: 'Abertura', className: 'bg-success/20 text-success border-success/30' },
  adicionar_item: { label: 'Item Adicionado', className: 'bg-primary/20 text-primary border-primary/30' },
  cancelar_item: { label: 'Item Cancelado', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  enviar_cozinha: { label: 'Enviado Cozinha', className: 'bg-accent/20 text-accent border-accent/30' },
  pagamento: { label: 'Pagamento', className: 'bg-success/20 text-success border-success/30' },
  status_change: { label: 'Status', className: 'bg-warning/20 text-warning border-warning/30' },
  fechamento: { label: 'Fechamento', className: 'bg-muted text-muted-foreground border-muted' },
};

export function EntregaHistorico({ entregaId }: { entregaId: string }) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  useEffect(() => {
    supabase.from('entrega_historico')
      .select('*')
      .eq('entrega_id', entregaId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setHistorico(data as any[]); });
  }, [entregaId]);

  if (historico.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Nenhum evento registrado ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {historico.map(h => {
        const config = acaoLabels[h.acao] || { label: h.acao, className: 'bg-secondary text-foreground border-border' };
        return (
          <Card key={h.id} className="glass">
            <CardContent className="py-3 flex items-start gap-3">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={config.className}>{config.label}</Badge>
                  {h.created_at && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {h.descricao && <p className="text-sm text-foreground mt-1">{h.descricao}</p>}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
