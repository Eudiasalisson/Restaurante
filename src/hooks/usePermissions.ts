import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ModulePermissions {
  pode_visualizar: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
}

const fullAccess: ModulePermissions = {
  pode_visualizar: true,
  pode_criar: true,
  pode_editar: true,
  pode_excluir: true,
};

export function usePermissions(modulo: string): ModulePermissions & { loading: boolean } {
  const { user, profile } = useAuth();
  const [perms, setPerms] = useState<ModulePermissions>(fullAccess);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Admin has full access
    if (profile?.role === 'admin') {
      setPerms(fullAccess);
      setLoading(false);
      return;
    }

    supabase
      .from('permissoes_usuario')
      .select('pode_visualizar, pode_criar, pode_editar, pode_excluir')
      .eq('usuario_id', user.id)
      .eq('modulo', modulo)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPerms({
            pode_visualizar: data.pode_visualizar,
            pode_criar: data.pode_criar,
            pode_editar: data.pode_editar,
            pode_excluir: data.pode_excluir,
          });
        } else {
          setPerms({ pode_visualizar: false, pode_criar: false, pode_editar: false, pode_excluir: false });
        }
        setLoading(false);
      });
  }, [user, profile, modulo]);

  return { ...perms, loading };
}
