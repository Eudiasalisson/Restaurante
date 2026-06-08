-- Recria a FK de entregas.endereco_id com ON DELETE SET NULL
-- Assim, ao remover um endereço vinculado a uma entrega, o campo fica NULL
-- em vez de bloquear a operação com erro 409.

ALTER TABLE public.entregas
  DROP CONSTRAINT IF EXISTS entregas_endereco_id_fkey;

ALTER TABLE public.entregas
  ADD CONSTRAINT entregas_endereco_id_fkey
  FOREIGN KEY (endereco_id)
  REFERENCES public.enderecos_cliente(id)
  ON DELETE SET NULL;
