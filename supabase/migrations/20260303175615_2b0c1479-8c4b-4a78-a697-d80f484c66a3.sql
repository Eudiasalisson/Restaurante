
-- Caixa (cash register) tables
CREATE TABLE public.caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aberto_por uuid REFERENCES public.usuarios(id),
  fechado_por uuid REFERENCES public.usuarios(id),
  valor_abertura numeric NOT NULL DEFAULT 0,
  valor_fechamento numeric,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  observacao_abertura text,
  observacao_fechamento text
);

ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_caixas" ON public.caixas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select_caixas" ON public.caixas FOR SELECT TO authenticated USING (true);

-- Movimentações do caixa (sangrias e suprimentos)
CREATE TABLE public.caixa_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id uuid REFERENCES public.caixas(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('sangria', 'suprimento')),
  valor numeric NOT NULL,
  descricao text NOT NULL,
  usuario_id uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_caixa_mov" ON public.caixa_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select_caixa_mov" ON public.caixa_movimentacoes FOR SELECT TO authenticated USING (true);
