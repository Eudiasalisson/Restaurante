
-- Add consumo_funcionario to forma_pagamento enum
ALTER TYPE public.forma_pagamento ADD VALUE IF NOT EXISTS 'consumo_funcionario';

-- Add funcionario_consumo_id to comandas (tracks which employee consumed)
ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS funcionario_consumo_id uuid REFERENCES public.funcionarios(id);

-- Create funcionario_pagamentos table for employee debt payments
CREATE TABLE public.funcionario_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  forma text NOT NULL,
  descricao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.funcionario_pagamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "auth_all_func_pagamentos" ON public.funcionario_pagamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select_func_pagamentos" ON public.funcionario_pagamentos FOR SELECT TO authenticated USING (true);
