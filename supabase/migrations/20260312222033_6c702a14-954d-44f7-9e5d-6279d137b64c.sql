
-- Add numero sequence for entregas (like comandas)
CREATE SEQUENCE IF NOT EXISTS entregas_numero_seq START WITH 1;

-- Add numero column to entregas
ALTER TABLE public.entregas ADD COLUMN numero integer DEFAULT nextval('entregas_numero_seq'::regclass);

-- Backfill existing entregas with sequential numbers based on opened_at
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY opened_at ASC) AS rn
  FROM public.entregas
)
UPDATE public.entregas e
SET numero = n.rn
FROM numbered n
WHERE e.id = n.id;

-- Update sequence to next value
SELECT setval('entregas_numero_seq', COALESCE((SELECT MAX(numero) FROM public.entregas), 0) + 1);
