
-- Allow anonymous (public) read access for cardápio digital
CREATE POLICY "anon_select_produtos" ON public.produtos
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select_categorias" ON public.categorias
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select_empresas" ON public.empresas
  FOR SELECT TO anon USING (true);
