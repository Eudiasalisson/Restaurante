-- Integração de emissão de NFC-e via Notaas (https://docs.notaas.com.br)
-- Idempotente: pode ser reaplicada com segurança (ADD COLUMN IF NOT EXISTS / CREATE ... IF NOT EXISTS).

-- Dados fiscais por produto (necessários para montar cada item da NFC-e)
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ncm TEXT,
  ADD COLUMN IF NOT EXISTS cfop TEXT DEFAULT '5102',
  ADD COLUMN IF NOT EXISTS cst_csosn TEXT,
  ADD COLUMN IF NOT EXISTS unidade TEXT DEFAULT 'UN',
  ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC;

-- Ambiente ativo da integração (homologação = testes sem valor fiscal, produção = notas reais)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS nfce_ambiente TEXT NOT NULL DEFAULT 'homologacao';

DO $$ BEGIN
  CREATE TYPE public.nota_fiscal_status AS ENUM ('queued', 'processing', 'issued', 'error', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL,
  entrega_id UUID REFERENCES public.entregas(id) ON DELETE SET NULL,
  ambiente TEXT NOT NULL DEFAULT 'homologacao',
  status public.nota_fiscal_status NOT NULL DEFAULT 'queued',
  invoice_id TEXT,
  numero TEXT,
  chave_acesso TEXT,
  protocolo TEXT,
  cstat TEXT,
  xmotivo TEXT,
  pdf_url TEXT,
  xml_url TEXT,
  motivo_cancelamento TEXT,
  erro_mensagem TEXT,
  criada_por UUID REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notas_fiscais_ref_check CHECK (comanda_id IS NOT NULL OR entrega_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_comanda ON public.notas_fiscais(comanda_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_entrega ON public.notas_fiscais(entrega_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_invoice_id ON public.notas_fiscais(invoice_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notas_fiscais_updated_at ON public.notas_fiscais;
CREATE TRIGGER trg_notas_fiscais_updated_at
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_select_notas_fiscais" ON public.notas_fiscais FOR SELECT TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_all_notas_fiscais" ON public.notas_fiscais FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
