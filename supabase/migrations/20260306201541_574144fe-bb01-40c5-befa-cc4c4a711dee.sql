ALTER TABLE public.produtos ADD COLUMN exibir_cardapio boolean DEFAULT true;

UPDATE public.produtos SET exibir_cardapio = true WHERE exibir_cardapio IS NULL;