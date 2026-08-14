ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC;
