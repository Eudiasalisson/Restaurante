
-- Enums
CREATE TYPE public.user_role AS ENUM ('admin', 'garcom', 'caixa', 'cozinha');
CREATE TYPE public.mesa_status AS ENUM ('aberta', 'ocupada', 'reservada', 'fechada');
CREATE TYPE public.comanda_status AS ENUM ('aberta', 'fechada', 'cancelada');
CREATE TYPE public.comanda_item_status AS ENUM ('pendente', 'enviado_cozinha', 'entregue', 'cancelado');
CREATE TYPE public.forma_pagamento AS ENUM ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'outro');
CREATE TYPE public.entrega_status AS ENUM ('aberta', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelada');

-- Tables (no policies yet)
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  logo_url TEXT,
  telefone TEXT,
  endereco TEXT,
  cnpj TEXT,
  taxa_servico_padrao NUMERIC DEFAULT 10
);

CREATE TABLE public.funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  cargo TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  funcionario_id UUID REFERENCES public.funcionarios(id),
  email TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'garcom',
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id),
  preco_venda NUMERIC NOT NULL DEFAULT 0,
  preco_custo NUMERIC DEFAULT 0,
  preco_promocional NUMERIC,
  promocao_ativa BOOLEAN DEFAULT false,
  controle_estoque BOOLEAN DEFAULT false,
  estoque_atual INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  descricao TEXT,
  imagem_url TEXT
);

CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.enderecos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  label TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  principal BOOLEAN DEFAULT false
);

CREATE TABLE public.mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL UNIQUE,
  capacidade INTEGER DEFAULT 4,
  status public.mesa_status DEFAULT 'aberta'
);

CREATE TABLE public.comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id UUID REFERENCES public.mesas(id),
  cliente_id UUID REFERENCES public.clientes(id),
  funcionario_id UUID REFERENCES public.funcionarios(id),
  pessoas INTEGER DEFAULT 1,
  status public.comanda_status DEFAULT 'aberta',
  taxa_servico_ativa BOOLEAN DEFAULT true,
  taxa_servico_valor NUMERIC DEFAULT 10,
  desconto NUMERIC DEFAULT 0,
  acrescimo NUMERIC DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE public.comanda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE CASCADE NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  observacao TEXT,
  status public.comanda_item_status DEFAULT 'pendente',
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.comanda_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE CASCADE NOT NULL,
  acao TEXT NOT NULL,
  descricao TEXT,
  usuario_id UUID REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE CASCADE NOT NULL,
  forma public.forma_pagamento NOT NULL,
  valor NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id),
  endereco_id UUID REFERENCES public.enderecos_cliente(id),
  funcionario_id UUID REFERENCES public.funcionarios(id),
  status public.entrega_status DEFAULT 'aberta',
  taxa_entrega NUMERIC DEFAULT 0,
  opened_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.entrega_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id UUID REFERENCES public.entregas(id) ON DELETE CASCADE NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  observacao TEXT,
  status public.comanda_item_status DEFAULT 'pendente',
  preco_unitario NUMERIC NOT NULL DEFAULT 0
);

-- Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = _user_id AND role = _role
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enderecos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrega_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "auth_select_empresas" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_empresas" ON public.empresas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth_select_funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_funcionarios" ON public.funcionarios FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_select_own" ON public.usuarios FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "admin_select_all_usuarios" ON public.usuarios FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_all_usuarios" ON public.usuarios FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth_select_categorias" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_categorias" ON public.categorias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth_select_produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_produtos" ON public.produtos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "auth_select_clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_enderecos" ON public.enderecos_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_enderecos" ON public.enderecos_cliente FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_mesas" ON public.mesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_mesas" ON public.mesas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_comandas" ON public.comandas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_comandas" ON public.comandas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_comanda_itens" ON public.comanda_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_comanda_itens" ON public.comanda_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_historico" ON public.comanda_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_historico" ON public.comanda_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_pagamentos" ON public.pagamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_pagamentos" ON public.pagamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_entregas" ON public.entregas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_entregas" ON public.entregas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_select_entrega_itens" ON public.entrega_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_entrega_itens" ON public.entrega_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger to create usuario on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, role)
  VALUES (NEW.id, NEW.email, 'garcom');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Default data
INSERT INTO public.empresas (nome, taxa_servico_padrao) VALUES ('Restaurante Sakura', 10);
INSERT INTO public.mesas (numero, capacidade, status) VALUES
  (1, 2, 'aberta'), (2, 4, 'aberta'), (3, 4, 'aberta'), (4, 6, 'aberta'),
  (5, 2, 'aberta'), (6, 4, 'aberta'), (7, 8, 'aberta'), (8, 4, 'aberta');
INSERT INTO public.categorias (nome) VALUES
  ('Sushi'), ('Sashimi'), ('Temaki'), ('Hot Roll'), ('Pratos Quentes'), ('Bebidas'), ('Sobremesas');
