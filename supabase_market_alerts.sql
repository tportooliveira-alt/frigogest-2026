-- ═══════════════════════════════════════════════════════════════
-- FrigoGest — Tabelas: market_alerts + system_config
-- Rodar no Supabase SQL Editor do projeto
-- ═══════════════════════════════════════════════════════════════

-- 1. ALERTAS DE MERCADO (substitui localStorage)
CREATE TABLE IF NOT EXISTS market_alerts (
    id          TEXT PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity    TEXT NOT NULL CHECK (severity IN ('CRITICO','ALTO','MEDIO','INFO')),
    category    TEXT NOT NULL,
    titulo      TEXT NOT NULL,
    mensagem    TEXT NOT NULL,
    emoji       TEXT,
    acao        TEXT,
    valor       NUMERIC,
    limiar      NUMERIC,
    lida        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index para queries rápidas
CREATE INDEX IF NOT EXISTS idx_market_alerts_lida ON market_alerts(lida);
CREATE INDEX IF NOT EXISTS idx_market_alerts_timestamp ON market_alerts(timestamp DESC);

-- RLS — só usuários autenticados
ALTER TABLE market_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only_market_alerts" ON market_alerts
    FOR ALL USING (auth.role() = 'authenticated');

-- 2. CONFIGURAÇÕES DO SISTEMA (substitui localStorage para configs)
CREATE TABLE IF NOT EXISTS system_config (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only_system_config" ON system_config
    FOR ALL USING (auth.role() = 'authenticated');

-- Config padrão de alertas
INSERT INTO system_config (key, value) VALUES (
    'alert_config',
    '{
        "cepeaMarcos": [330, 340, 350, 355, 360, 370, 380],
        "dolarMax": 6.00,
        "dolarMin": 5.30,
        "margemMinima": 18,
        "variacaoDiariaAlerta": 1.5,
        "estoqueParadoDias": 7,
        "pushEnabled": true,
        "somEnabled": true
    }'
) ON CONFLICT (key) DO NOTHING;
