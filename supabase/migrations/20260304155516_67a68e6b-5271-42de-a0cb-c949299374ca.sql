
-- Add auto-increment numeric code to produtos
CREATE SEQUENCE IF NOT EXISTS produtos_codigo_seq START 1;

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS codigo integer UNIQUE DEFAULT nextval('produtos_codigo_seq');

-- Backfill existing products that have NULL codigo
UPDATE public.produtos SET codigo = nextval('produtos_codigo_seq') WHERE codigo IS NULL;
