
-- Create entrega_historico table for delivery event logging
CREATE TABLE public.entrega_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entrega_id uuid NOT NULL REFERENCES public.entregas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.usuarios(id),
  acao text NOT NULL,
  descricao text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.entrega_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_entrega_historico" ON public.entrega_historico FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "auth_select_entrega_historico" ON public.entrega_historico FOR SELECT USING (true);

-- Add entrega_id to pagamentos table so deliveries can have payments too
ALTER TABLE public.pagamentos ALTER COLUMN comanda_id DROP NOT NULL;
ALTER TABLE public.pagamentos ADD COLUMN entrega_id uuid REFERENCES public.entregas(id);
