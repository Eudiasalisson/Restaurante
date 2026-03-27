import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, ExternalLink, Share2 } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  garcom: 'Garçom',
  caixa: 'Caixa',
  cozinha: 'Cozinha',
};

export function Topbar() {
  const { profile, signOut } = useAuth();
  const [cardapioAberto, setCardapioAberto] = useState<boolean | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const cardapioUrl = `${window.location.origin}/cardapio`;

  useEffect(() => {
    supabase.from('empresas').select('id, cardapio_status').limit(1).single().then(({ data }) => {
      if (data) {
        setEmpresaId(data.id);
        setCardapioAberto(data.cardapio_status === 'aberto');
      }
    });
  }, []);

  const toggleCardapioStatus = async () => {
    if (!empresaId) return;
    const novoStatus = !cardapioAberto;
    setCardapioAberto(novoStatus);
    const { error } = await supabase.from('empresas').update({ cardapio_status: novoStatus ? 'aberto' : 'fechado' }).eq('id', empresaId);
    if (error) {
      setCardapioAberto(!novoStatus);
      toast.error('Erro ao alterar status');
    } else {
      toast.success(novoStatus ? 'Cardápio aberto!' : 'Cardápio fechado!');
    }
  };

  const copyCardapioLink = async () => {
    try {
      await navigator.clipboard.writeText(cardapioUrl);
      toast.success('Link do cardápio copiado!');
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 glass">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      </div>
      <div className="flex items-center gap-2">
        {/* User section */}
        {profile && (
          <>
            <Badge variant="outline" className="border-primary/30 text-primary text-xs">
              {roleLabels[profile.role] || profile.role}
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:inline">{profile.email}</span>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
