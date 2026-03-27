
-- Add mais_pedido and novidade flags to produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS mais_pedido boolean DEFAULT false;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS novidade boolean DEFAULT false;

-- Add cardapio digital settings to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cardapio_status text DEFAULT 'aberto';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS whatsapp_pedidos text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS chave_pix text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS valor_minimo_pedido numeric DEFAULT 0;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS tempo_medio_entrega text DEFAULT '40-60 min';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS slogan text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS mensagem_conclusao text;
