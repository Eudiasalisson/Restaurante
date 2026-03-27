
-- Add numero column to comandas with auto-increment sequence
CREATE SEQUENCE IF NOT EXISTS comandas_numero_seq START 1;
ALTER TABLE public.comandas ADD COLUMN numero integer DEFAULT nextval('comandas_numero_seq');

-- Update existing comandas to have sequential numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY opened_at) as rn
  FROM public.comandas
)
UPDATE public.comandas c SET numero = n.rn FROM numbered n WHERE c.id = n.id;

-- Create permissions table
CREATE TABLE public.permissoes_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  pode_visualizar boolean NOT NULL DEFAULT false,
  pode_criar boolean NOT NULL DEFAULT false,
  pode_editar boolean NOT NULL DEFAULT false,
  pode_excluir boolean NOT NULL DEFAULT false,
  UNIQUE(usuario_id, modulo)
);

ALTER TABLE public.permissoes_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_permissoes" ON public.permissoes_usuario FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "user_select_own_permissoes" ON public.permissoes_usuario FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());
