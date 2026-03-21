-- FrigoGest 2026 — Sprint 5 Migration
-- Rodar no Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS temperature_log (
  id TEXT PRIMARY KEY,
  camara TEXT NOT NULL,
  temperatura NUMERIC(5,2) NOT NULL,
  umidade NUMERIC(5,2),
  registrado_em TIMESTAMPTZ DEFAULT NOW(),
  operador TEXT,
  obs TEXT
);

CREATE INDEX IF NOT EXISTS idx_temp_log_data ON temperature_log(registrado_em DESC);
