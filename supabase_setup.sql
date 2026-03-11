-- ============================================================
-- FRIGOGEST 2026 — SETUP COMPLETO SUPABASE
-- Rodar no: Supabase Dashboard → SQL Editor → Run All
-- ============================================================

-- ======== TABELAS PRINCIPAIS ========

CREATE TABLE IF NOT EXISTS clients (
  id_ferro TEXT PRIMARY KEY,
  nome_social TEXT NOT NULL,
  whatsapp TEXT,
  limite_credito NUMERIC DEFAULT 0,
  saldo_devedor NUMERIC DEFAULT 0,
  cpf_cnpj TEXT,
  cep TEXT,
  telefone_residencial TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ATIVO',
  perfil_compra TEXT,
  padrao_gordura TEXT,
  objecoes_frequentes TEXT,
  preferencias TEXT,
  frequencia_ideal_dias INTEGER,
  mimo_recebido_data DATE
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  nome_fantasia TEXT NOT NULL,
  cpf_cnpj TEXT,
  inscricao_estadual TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  dados_bancarios TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'ATIVO',
  raca_predominante TEXT,
  regiao TEXT
);

CREATE TABLE IF NOT EXISTS batches (
  id_lote TEXT PRIMARY KEY,
  fornecedor TEXT,
  data_recebimento DATE,
  peso_total_romaneio NUMERIC,
  valor_compra_total NUMERIC,
  frete NUMERIC DEFAULT 0,
  gastos_extras NUMERIC DEFAULT 0,
  custo_real_kg NUMERIC,
  url_romaneio TEXT,
  status TEXT DEFAULT 'ABERTO',
  valor_entrada NUMERIC DEFAULT 0,
  raca TEXT,
  qtd_cabecas INTEGER,
  qtd_mortos INTEGER DEFAULT 0,
  peso_vivo_medio NUMERIC,
  peso_gancho NUMERIC,
  rendimento_real NUMERIC,
  toalete_kg NUMERIC,
  preco_arroba NUMERIC,
  traceability_hash TEXT,
  vision_audit_status TEXT DEFAULT 'PENDENTE',
  esg_score NUMERIC DEFAULT 0,
  forma_pagamento TEXT DEFAULT 'OUTROS',
  prazo_dias INTEGER DEFAULT 30,
  forma_pagamento_frete TEXT DEFAULT 'VISTA',
  prazo_dias_frete INTEGER DEFAULT 30
);

CREATE TABLE IF NOT EXISTS stock_items (
  id_completo TEXT PRIMARY KEY,
  id_lote TEXT REFERENCES batches(id_lote) ON DELETE CASCADE,
  sequencia INTEGER,
  tipo INTEGER,
  peso_entrada NUMERIC,
  peso_saida NUMERIC,
  peso_animal_entrada NUMERIC,
  status TEXT DEFAULT 'DISPONIVEL',
  data_entrada DATE,
  gordura INTEGER,
  conformacao TEXT,
  marmoreio NUMERIC,
  anomalias_detectadas TEXT[]
);

CREATE TABLE IF NOT EXISTS sales (
  id_venda TEXT PRIMARY KEY,
  id_cliente TEXT,
  nome_cliente TEXT,
  id_completo TEXT,
  peso_real_saida NUMERIC,
  preco_venda_kg NUMERIC,
  data_venda DATE,
  quebra_kg NUMERIC DEFAULT 0,
  lucro_liquido_unitario NUMERIC DEFAULT 0,
  custo_extras_total NUMERIC DEFAULT 0,
  prazo_dias INTEGER DEFAULT 0,
  data_vencimento DATE,
  forma_pagamento TEXT,
  status_pagamento TEXT DEFAULT 'PENDENTE',
  valor_pago NUMERIC DEFAULT 0,
  tipo_venda TEXT,
  stock_ids_originais TEXT[],
  metodo_pagamento TEXT,
  referencia_id TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  data DATE,
  descricao TEXT,
  tipo TEXT,
  categoria TEXT,
  valor NUMERIC,
  referencia_id TEXT,
  metodo_pagamento TEXT
);

CREATE TABLE IF NOT EXISTS payables (
  id TEXT PRIMARY KEY,
  descricao TEXT,
  categoria TEXT,
  valor NUMERIC,
  valor_total NUMERIC,
  valor_pago NUMERIC DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'PENDENTE',
  fornecedor_id TEXT,
  id_lote TEXT,
  observacoes TEXT,
  recorrente BOOLEAN DEFAULT FALSE,
  beneficiario TEXT
);

CREATE TABLE IF NOT EXISTS scheduled_orders (
  id TEXT PRIMARY KEY,
  id_cliente TEXT,
  nome_cliente TEXT,
  data_entrega DATE,
  hora_entrega TEXT,
  itens TEXT,
  status TEXT DEFAULT 'ABERTO',
  data_criacao TIMESTAMP,
  alerta_madrugada BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS daily_reports (
  id TEXT PRIMARY KEY,
  date DATE,
  timestamp TIMESTAMP,
  "userId" TEXT,
  "userName" TEXT,
  intensity TEXT,
  sentiment TEXT,
  notes TEXT,
  type TEXT,
  extra_movement BOOLEAN DEFAULT FALSE,
  technical_issues BOOLEAN DEFAULT FALSE,
  audio_url TEXT,
  client_complaint_audio_url TEXT,
  video_url TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT NOW(),
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  action TEXT,
  entity TEXT,
  details TEXT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  summary TEXT,
  key_insights TEXT[],
  alerts_found INTEGER DEFAULT 0,
  actions_recommended TEXT[],
  provider TEXT,
  context TEXT
);

-- ======== CHAT DE REUNIÃO ========

CREATE TABLE IF NOT EXISTS meeting_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  text TEXT NOT NULL,
  sender_name TEXT,
  sender_role TEXT,
  sender_color TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_presence (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  name TEXT,
  role TEXT,
  color TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- ======== LEADS (ASSISTENTE VIRTUAL) ========

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT,
  nome TEXT,
  whatsapp TEXT,
  localizacao TEXT,
  tipo_gado TEXT,
  reserva_item TEXT,
  reserva_quantidade TEXT,
  arroba_estimada TEXT,
  tem_video BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'novo',
  mensagem TEXT
);

-- ======== ÍNDICES DE PERFORMANCE ========

CREATE INDEX IF NOT EXISTS idx_stock_items_id_lote ON stock_items(id_lote);
CREATE INDEX IF NOT EXISTS idx_stock_items_status ON stock_items(status);
CREATE INDEX IF NOT EXISTS idx_sales_id_cliente ON sales(id_cliente);
CREATE INDEX IF NOT EXISTS idx_sales_status_pagamento ON sales(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_transactions_referencia_id ON transactions(referencia_id);
CREATE INDEX IF NOT EXISTS idx_transactions_categoria ON transactions(categoria);
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_id_lote ON payables(id_lote);
CREATE INDEX IF NOT EXISTS idx_meeting_messages_room_id ON meeting_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_presence_room_id ON meeting_presence(room_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent_id ON agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ======== ROW LEVEL SECURITY (RLS) ========
-- Política básica: apenas usuários autenticados acessam

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Políticas: acesso total para usuários autenticados
CREATE POLICY "auth_all" ON clients        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON suppliers      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON batches        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON stock_items    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON sales          FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON transactions   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON payables       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON scheduled_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON daily_reports  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON audit_logs     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON agent_memories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON meeting_messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_all" ON meeting_presence FOR ALL USING (auth.role() = 'authenticated');
-- leads: permite inserção anônima (via VirtualAssistant público)
CREATE POLICY "anon_insert" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_select" ON leads FOR SELECT USING (auth.role() = 'authenticated');

-- ======== REALTIME ========
-- Habilitar Realtime nas tabelas principais
-- (Fazer também pelo Dashboard: Database → Replication → Tables)

ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE batches;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE payables;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_presence;

-- ======== STORAGE: bucket 'reports' ========
-- Criar via Dashboard: Storage → New Bucket → "reports" → Public: false
-- OU via SQL (requer extensão storage):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false)
-- ON CONFLICT DO NOTHING;

-- ======== FIM ========
-- Após rodar este script:
-- 1. Criar usuário em Authentication → Users → Invite User
-- 2. Criar bucket "reports" em Storage (para CollaboratorReport)
-- 3. Testar login no app
