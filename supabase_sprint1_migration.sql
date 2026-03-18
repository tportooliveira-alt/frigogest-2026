-- ============================================================
-- FRIGOGEST 2026 — SPRINT 1 MIGRATION
-- Rodar no: Supabase Dashboard → SQL Editor → Run All
-- ============================================================

-- ── S1-01: Colunas de pagamento de frete na tabela batches ──
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS forma_pagamento_frete TEXT DEFAULT 'VISTA'
    CHECK (forma_pagamento_frete IN ('VISTA', 'PRAZO', 'OUTROS')),
  ADD COLUMN IF NOT EXISTS prazo_dias_frete INTEGER DEFAULT 15;

-- Confirmar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'batches'
  AND column_name IN ('forma_pagamento', 'prazo_dias', 'forma_pagamento_frete', 'prazo_dias_frete')
ORDER BY column_name;

-- ── S1-06: Índices para queries mais frequentes ──

-- stock_items: busca por lote (muito frequente)
CREATE INDEX IF NOT EXISTS idx_stock_items_id_lote
  ON stock_items(id_lote);

-- stock_items: busca por status (DISPONIVEL, VENDIDO)
CREATE INDEX IF NOT EXISTS idx_stock_items_status
  ON stock_items(status);

-- sales: busca por cliente
CREATE INDEX IF NOT EXISTS idx_sales_id_cliente
  ON sales(id_cliente);

-- sales: busca por status de pagamento
CREATE INDEX IF NOT EXISTS idx_sales_status_pagamento
  ON sales(status_pagamento);

-- sales: busca por data de venda (ordenação)
CREATE INDEX IF NOT EXISTS idx_sales_data_venda
  ON sales(data_venda DESC);

-- transactions: busca por referencia_id (estorno, recebimento)
CREATE INDEX IF NOT EXISTS idx_transactions_referencia_id
  ON transactions(referencia_id);

-- transactions: busca por tipo (ENTRADA/SAIDA)
CREATE INDEX IF NOT EXISTS idx_transactions_tipo
  ON transactions(tipo);

-- payables: busca por id_lote
CREATE INDEX IF NOT EXISTS idx_payables_id_lote
  ON payables(id_lote);

-- payables: busca por status
CREATE INDEX IF NOT EXISTS idx_payables_status
  ON payables(status);

-- payables: busca por data de vencimento (alertas)
CREATE INDEX IF NOT EXISTS idx_payables_data_vencimento
  ON payables(data_vencimento);

-- batches: busca por status
CREATE INDEX IF NOT EXISTS idx_batches_status
  ON batches(status);

-- Confirmar índices criados
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
