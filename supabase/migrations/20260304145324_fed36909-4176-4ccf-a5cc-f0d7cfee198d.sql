
CREATE TABLE public.estoque_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade integer NOT NULL,
  motivo text,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_estoque_mov" ON public.estoque_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select_estoque_mov" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (true);
