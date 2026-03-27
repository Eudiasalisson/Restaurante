import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History } from 'lucide-react';

interface HistoricoItem {
  id: string;
  acao: string;
  descricao: string | null;
  created_at: string | null;
  usuario_id: string | null;
}

const acaoLabels: Record<string, { label: string; className: string }> = {
  adicionar_item: { label: 'Item Adicionado', className: 'bg-success/20 text-success border-success/30' },
  cancelar_item: { label: 'Item Cancelado', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  enviar_cozinha: { label: 'Enviado Cozinha', className: 'bg-primary/20 text-primary border-primary/30' },
  pagamento: { label: 'Pagamento', className: 'bg-accent/20 text-accent-foreground border-accent/30' },
  fechar_comanda: { label: 'Comanda Fechada', className: 'bg-muted text-muted-foreground border-border' },
};

export function ComandaHistorico({ comandaId }: { comandaId: string }) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('comanda_historico')
      .select('*')
      .eq('comanda_id', comandaId)
      .order('created_at', { ascending: false });
    if (data) setHistorico(data);
  }, [comandaId]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-serif flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico da Comanda
        </CardTitle>
      </CardHeader>
      <CardContent>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado.</p>
        ) : (
          <div className="space-y-3">
            {historico.map(h => {
              const config = acaoLabels[h.acao] || { label: h.acao, className: 'bg-secondary text-secondary-foreground border-border' };
              return (
                <div key={h.id} className="flex items-start gap-3 p-3 rounded-md bg-secondary/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={config.className}>{config.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {h.created_at && format(new Date(h.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>
                    {h.descricao && (
                      <p className="text-sm text-foreground">{h.descricao}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
