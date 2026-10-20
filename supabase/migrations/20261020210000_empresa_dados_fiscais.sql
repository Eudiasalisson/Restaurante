-- Dados cadastrais fiscais da empresa, necessários para gerar o arquivo Sintegra
-- (registros 10/11) e outras obrigações acessórias. Não existiam antes porque a
-- emissão de NFC-e usa só o cadastro de emitente da própria Notaas; esses campos
-- são para uso local (relatórios/arquivos que nosso sistema gera, não a Notaas).
-- Idempotente: pode ser reaplicada com segurança (ADD COLUMN IF NOT EXISTS).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  -- Código de Regime Tributário: '1' Simples Nacional, '2' Simples excesso de
  -- sublimite, '3' Regime Normal. Texto (não numérico) pelo mesmo motivo de
  -- ncm/cfop/cst_csosn em produtos: é um código de layout fiscal, não uma
  -- quantidade, e evita problemas com zero à esquerda.
  ADD COLUMN IF NOT EXISTS crt TEXT,
  ADD COLUMN IF NOT EXISTS codigo_municipio TEXT,
  ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
  ADD COLUMN IF NOT EXISTS endereco_uf TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
