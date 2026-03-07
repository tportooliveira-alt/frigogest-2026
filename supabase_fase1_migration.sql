-- ═══════════════════════════════════════════════════════════════════════
-- FRIGOGEST 2026 — MIGRATION FASE 1
-- Execute no Supabase SQL Editor: https://supabase.com/dashboard/project/fgzbkvgaxnwlufhndoqp/sql
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. TABELA SALES — campos que os agentes usam ──────────────────────

-- Camila (NPS): sabe exatamente quando disparar a pesquisa pós-entrega
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS entrega_confirmada_em TIMESTAMPTZ;

-- Isabela e Marcos: aprendem qual abordagem funciona de verdade
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS resultado_campanha TEXT
  CHECK (resultado_campanha IN ('COMPROU', 'RESPONDEU', 'IGNOROU', 'NUMERO_ERRADO'));

-- ── 2. TABELA CLIENTS — campos que os agentes usam ────────────────────

-- Isabela: usa preço real nas copies (não inventa nem usa preço padrão)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS preco_negociado_kg NUMERIC;

-- Isabela/Marcos: campo whatsapp pode não existir em instalações antigas
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- ── 3. ÍNDICES — performance nas queries dos agentes ─────────────────

-- Camila: busca vendas sem NPS disparado (entrega confirmada, NPS não enviado)
CREATE INDEX IF NOT EXISTS idx_sales_entrega_confirmada
  ON sales (entrega_confirmada_em)
  WHERE entrega_confirmada_em IS NOT NULL;

-- Isabela/Marcos: busca vendas com resultado de campanha para análise de conversão
CREATE INDEX IF NOT EXISTS idx_sales_resultado_campanha
  ON sales (resultado_campanha)
  WHERE resultado_campanha IS NOT NULL;

-- Busca por cliente nas vendas (RFM, histórico)
CREATE INDEX IF NOT EXISTS idx_sales_id_cliente
  ON sales (id_cliente);

-- Busca por data para os agentes que filtram por recência
CREATE INDEX IF NOT EXISTS idx_sales_data_venda
  ON sales (data_venda DESC);

-- ── 4. VERIFICAR — confirmar que tudo foi criado ──────────────────────

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('sales', 'clients')
  AND column_name IN (
    'entrega_confirmada_em',
    'resultado_campanha',
    'preco_negociado_kg',
    'whatsapp'
  )
ORDER BY table_name, column_name;
