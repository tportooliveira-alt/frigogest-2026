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

-- ═══════════════════════════════════════════════════════════════
-- FRIGOGEST 2026 — MIGRATION FASE 2: PREÇOS DE MERCADO
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS market_prices (
  id           BIGSERIAL PRIMARY KEY,
  arroba_sp    NUMERIC NOT NULL,         -- R$/@ SP
  arroba_ba    NUMERIC NOT NULL,         -- R$/@ Feira de Santana BA
  arroba_vdc   NUMERIC,                    -- R$/@ VDC / Sudoeste BA (principal!)
  arroba_kg_carcaca NUMERIC,            -- arroba_ba / 15
  arroba_data  TEXT,                    -- data de referência (dd/mm/aaaa)
  arroba_fonte TEXT DEFAULT 'SUPABASE_MANUAL',
  arroba_variacao NUMERIC DEFAULT 0,
  dolar        NUMERIC,
  dolar_data   TEXT,
  dolar_fonte  TEXT DEFAULT 'FALLBACK',
  selic        NUMERIC,
  selic_data   TEXT,
  selic_fonte  TEXT DEFAULT 'FALLBACK',
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_por TEXT DEFAULT 'DONO',
  erros        TEXT[] DEFAULT '{}'
);

-- Seed com valor inicial para não ficar vazio
INSERT INTO market_prices (arroba_sp, arroba_ba, arroba_kg_carcaca, arroba_data, arroba_fonte, atualizado_por)
VALUES (362.00, 335.00, 22.33, '06/03/2026', 'SUPABASE_MANUAL', 'SISTEMA')
ON CONFLICT DO NOTHING;

-- Índice para buscar o mais recente rapidamente
CREATE INDEX IF NOT EXISTS idx_market_prices_atualizado
  ON market_prices (atualizado_em DESC);

-- Verificar
SELECT id, arroba_sp, arroba_ba, arroba_fonte, atualizado_em, atualizado_por
FROM market_prices
ORDER BY atualizado_em DESC
LIMIT 3;
