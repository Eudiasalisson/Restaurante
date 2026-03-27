import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface EmpresaData {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  endereco: string | null;
  logo_url: string | null;
  taxa_servico_padrao: number | null;
}

let cachedEmpresa: EmpresaData | null = null;

export function useEmpresa() {
  const [empresa, setEmpresa] = useState<EmpresaData | null>(cachedEmpresa);
  const [loading, setLoading] = useState(!cachedEmpresa);

  useEffect(() => {
    if (cachedEmpresa) return;
    supabase.from('empresas').select('*').limit(1).single().then(({ data }) => {
      if (data) {
        cachedEmpresa = data as EmpresaData;
        setEmpresa(cachedEmpresa);
      }
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    const { data } = await supabase.from('empresas').select('*').limit(1).single();
    if (data) {
      cachedEmpresa = data as EmpresaData;
      setEmpresa(cachedEmpresa);
    }
  };

  return { empresa, loading, refresh };
}
