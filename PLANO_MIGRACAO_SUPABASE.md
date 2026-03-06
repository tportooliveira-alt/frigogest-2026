# PLANO DE IMPLEMENTAÇÃO: Correções Firebase + Migração Supabase
# FrigoGest v3.0.0 → v4.0.0
# Gerado: 06/03/2026

---

## PARTE 1 — BUGS CRÍTICOS NO FIREBASE (Corrigir ANTES da migração)

### BUG #1 — CRÍTICO: Estorno de Venda não devolve carcaças ao estoque
**Arquivo:** `App.tsx` | Função: `estornoSale()` | Linhas: ~590-630

**Problema:**
Quando a venda tem `id_completo` terminando em `-INTEIRO`, o código tenta
converter para `-BANDA_A` e `-BANDA_B`. Mas a query usa:
```typescript
where('__name__', '==', stockId)   // 'stockId' aqui é o ID JÁ expandido
```
Se o documento existe com `id_completo = "LOTE-X-1-BANDA_A"` mas o campo
`stock_ids_originais` da venda ainda guarda `"LOTE-X-1-INTEIRO"`, a expansão
gera os IDs corretos mas a busca por `__name__` pode falhar se o Document ID
do Firestore for diferente do `id_completo`.

**Causa secundária:** O campo `stock_ids_originais` pode não ter sido gravado
corretamente em `Expedition.tsx` ao montar a venda de carcaça inteira.

**Correção:**
Em `estornoSale()`, remover a dependência de `__name__` e usar sempre o campo
`id_completo`:
```typescript
// SUBSTITUIR: where('__name__', '==', stockId)
// POR:        where('id_completo', '==', stockId)
const q = query(
  collection(db, 'stock_items'),
  where('id_completo', '==', stockId),
  limit(1)
);
```
E garantir que `Expedition.tsx` → `onConfirmSale()` sempre grave `stock_ids_originais`
com os IDs reais de banda (BANDA_A / BANDA_B), nunca o ID virtual INTEIRO.

---

### BUG #2 — CRÍTICO: ID customizado de Payable é perdido no Firestore
**Arquivo:** `App.tsx` | Função: `handleAddPayable()` | Linhas: ~406-420

**Problema:**
```typescript
const docRef = await addDoc(collection(db, 'payables'), newPayable);
// addDoc IGNORA o campo 'id' dentro de newPayable
// Cria documento com ID AUTOMÁTICO do Firestore (ex: "aB3xKp9...")
const payableWithId = { ...newPayable, id: docRef.id };
// Agora id = "aB3xKp9..." (Firestore auto), NÃO o "PAY-LOTE-XYZ" desejado
await setDoc(docRef, payableWithId);
```
Quando depois o sistema chama `updateDoc(doc(db, 'payables', updatedPayable.id))`,
usa o ID que está no campo `id` do objeto, mas o documento REAL no Firestore
está em `/payables/aB3xKp9...`. Resultado: cria DUPLICATAS em vez de atualizar.

**Correção:**
Usar `setDoc` com ID determinístico desde o início, nunca `addDoc` para payables:
```typescript
const handleAddPayable = async (newPayable: Payable) => {
  const docId = newPayable.id || doc(collection(db, 'payables')).id;
  const payableWithId = { ...newPayable, id: docId };
  await setDoc(doc(db, 'payables', docId), payableWithId);  // ID customizado
  setData(prev => ({ ...prev, payables: [...prev.payables, payableWithId] }));
};
```

---

### BUG #3 — ALTO: Race Condition na compra à vista (Caixa não registra saída)
**Arquivo:** `App.tsx` | Funções: `addBatch()` + `registerBatchFinancial()` | Linhas: ~498-1065

**Problema:**
1. `addBatch()` tenta gravar `TR-LOTE-{id}` se `forma_pagamento === 'VISTA'`
2. Chama `fetchData()` (assíncrono, não aguarda o React atualizar o state)
3. `Batches.tsx` chama `registerBatchFinancial()` logo depois
4. `registerBatchFinancial()` faz `data.transactions.find(t => t.id === txId)` — mas
   `data.transactions` ainda é o estado ANTIGO (React não atualizou)
5. Guard de duplicata falha → ou duplica a transação ou pula ela

**Correção:**
Unificar: `addBatch()` NÃO deve tentar gravar transação.
Somente `registerBatchFinancial()` é responsável pelo financeiro.
Mas `registerBatchFinancial()` deve consultar o Firestore DIRETAMENTE,
não o estado React:
```typescript
// Verificar diretamente no Firestore (não no state):
const txSnap = await getDocs(
  query(collection(db, 'transactions'), where('id', '==', txId), limit(1))
);
if (!txSnap.empty) {
  console.log('Transação já existe, ignorando.');
  return;
}
```

---

### BUG #4 — MÉDIO: cleanAllFinancialData usa nome errado de coleção
**Arquivo:** `App.tsx` | Função: `cleanAllFinancialData()` | Linha: ~866

**Problema:**
```typescript
const collections = ['batches', 'sales', 'stock', 'transactions', ...];
//                                               ^^^^^ ERRADO
// Coleção real é 'stock_items', não 'stock'
```
A limpeza de sistema não limpa o estoque pois usa o nome errado.

**Correção:**
```typescript
const collections = ['batches', 'sales', 'stock_items', 'transactions', ...];
```

---

### BUG #5 — SEGURANÇA: Senha em texto plano no localStorage
**Arquivo:** `components/Login.tsx` | Linhas: ~49-55

**Problema:**
```typescript
localStorage.setItem('fg_saved_password', password); // TEXTO PLANO!
```

**Correção para Firebase (curto prazo):** Remover o salvamento da senha.
Usar apenas `fg_saved_email`. A autenticação do Firebase já persiste a sessão.

**Correção Supabase (migração):** Supabase persiste sessão automaticamente via
`@supabase/supabase-js`. Remover toda lógica de localStorage de credenciais.

---

## PARTE 2 — MAPA DE MIGRAÇÃO FIREBASE → SUPABASE

### 2.1 Arquivo novo: `supabaseClient.ts`
Substitui `firebaseClient.ts` completamente.

```typescript
// supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase não configurado. Verifique as variáveis de ambiente.');
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default supabase;
```

### 2.2 Variáveis de Ambiente
**Remover de `.env`:**
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

**Adicionar em `.env`:**
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx...
```

### 2.3 Tabelas SQL no Supabase (criar via Dashboard ou migration)
```sql
-- clients
CREATE TABLE clients (
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

-- suppliers
CREATE TABLE suppliers (
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

-- batches
CREATE TABLE batches (
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
  prazo_dias INTEGER DEFAULT 30
);

-- stock_items
CREATE TABLE stock_items (
  id_completo TEXT PRIMARY KEY,
  id_lote TEXT REFERENCES batches(id_lote),
  sequencia INTEGER,
  tipo INTEGER,  -- 1=INTEIRO, 2=BANDA_A, 3=BANDA_B
  peso_entrada NUMERIC,
  peso_animal_entrada NUMERIC,
  status TEXT DEFAULT 'DISPONIVEL',
  data_entrada DATE,
  gordura INTEGER,
  conformacao TEXT,
  marmoreio NUMERIC,
  anomalias_detectadas TEXT[]
);

-- sales
CREATE TABLE sales (
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
  stock_ids_originais TEXT[],
  metodo_pagamento TEXT
);

-- transactions
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  data DATE,
  descricao TEXT,
  tipo TEXT,          -- 'ENTRADA' | 'SAIDA'
  categoria TEXT,
  valor NUMERIC,
  referencia_id TEXT,
  metodo_pagamento TEXT
);

-- payables
CREATE TABLE payables (
  id TEXT PRIMARY KEY,
  descricao TEXT,
  categoria TEXT,
  valor NUMERIC,
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

-- scheduled_orders
CREATE TABLE scheduled_orders (
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

-- daily_reports
CREATE TABLE daily_reports (
  id TEXT PRIMARY KEY,
  date DATE,
  timestamp TIMESTAMP,
  user_id TEXT,
  user_name TEXT,
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

-- audit_logs
CREATE TABLE audit_logs (
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

-- agent_memories
CREATE TABLE agent_memories (
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
```

### 2.4 Equivalência de Operações CRUD

| Operação | Firebase | Supabase |
|----------|----------|---------|
| Buscar todos | `getDocs(collection(db,'x'))` | `supabase.from('x').select('*')` |
| Buscar com filtro | `getDocs(query(..., where('f','==','v')))` | `supabase.from('x').select('*').eq('f','v')` |
| Inserir | `addDoc(collection(db,'x'), data)` | `supabase.from('x').insert(data)` |
| Inserir/Atualizar (upsert) | `setDoc(doc(db,'x',id), data)` | `supabase.from('x').upsert({id,...data})` |
| Atualizar parcial | `updateDoc(doc(db,'x',id), data)` | `supabase.from('x').update(data).eq('id',id)` |
| Deletar | `deleteDoc(doc(db,'x',id))` | `supabase.from('x').delete().eq('id',id)` |
| Buscar por doc ID | `where('__name__','==',id)` | `.eq('id_completo', id)` (campo PK) |
| Ordenar | `orderBy('campo','desc')` | `.order('campo',{ascending:false})` |
| Limitar | `limit(n)` | `.limit(n)` |
| Realtime | `onSnapshot(collection(db,'x'), cb)` | Ver seção 2.5 |
| Batch atômico | `writeBatch(db)` → `batch.commit()` | Ver seção 2.6 |

### 2.5 Realtime (Substituição do onSnapshot)
```typescript
// FIREBASE (remover):
const unsubscribeClients = onSnapshot(collection(db, 'clients'), debouncedFetch);

// SUPABASE (substituir por):
const channel = supabase
  .channel('db-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, debouncedFetch)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, debouncedFetch)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, debouncedFetch)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, debouncedFetch)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, debouncedFetch)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'payables' }, debouncedFetch)
  .subscribe();

// Cleanup:
return () => { supabase.removeChannel(channel); };
```

### 2.6 Batch Atômico (writeBatch → RPC PostgreSQL)
Firebase `writeBatch` tem limite de 500 operações e é atomico.
Supabase usa funções PostgreSQL para atomicidade:

```sql
-- Criar função no Supabase SQL Editor:
CREATE OR REPLACE FUNCTION estorno_venda(
  p_sale_id TEXT,
  p_stock_ids TEXT[],
  p_estorno_transactions JSONB
) RETURNS void AS $$
BEGIN
  -- 1. Marcar venda como ESTORNADO
  UPDATE sales SET status_pagamento='ESTORNADO', valor_pago=0
  WHERE id_venda = p_sale_id;

  -- 2. Devolver itens ao estoque
  UPDATE stock_items SET status='DISPONIVEL'
  WHERE id_completo = ANY(p_stock_ids);

  -- 3. Inserir transações de estorno
  INSERT INTO transactions
  SELECT * FROM jsonb_populate_recordset(null::transactions, p_estorno_transactions);
END;
$$ LANGUAGE plpgsql;
```

### 2.7 Autenticação Firebase → Supabase

**Login.tsx - ANTES (Firebase):**
```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseClient';
await signInWithEmailAndPassword(auth, email, password);
```

**Login.tsx - DEPOIS (Supabase):**
```typescript
import { supabase } from '../supabaseClient';
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
```

**App.tsx - Auth State Change - ANTES:**
```typescript
const unsubscribe = onAuthStateChanged(auth, (user) => {
  setSession(user ? { user } : null);
});
return () => unsubscribe();
```

**App.tsx - Auth State Change - DEPOIS:**
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session);
});
return () => subscription.unsubscribe();
```

**SignOut - ANTES:**
```typescript
import { signOut } from 'firebase/auth';
await signOut(auth);
```

**SignOut - DEPOIS:**
```typescript
await supabase.auth.signOut();
```

**User object - ANTES:**
```typescript
session.user.uid      // Firebase UID
session.user.email
session.user.displayName
```

**User object - DEPOIS:**
```typescript
session.user.id       // Supabase UUID
session.user.email
session.user.user_metadata?.full_name
```

---

## PARTE 3 — ARQUIVOS A MODIFICAR (por prioridade)

### FASE A — Correções Firebase (sem mudar de banco) — URGENTE

| # | Arquivo | O que mudar |
|---|---------|-------------|
| 1 | `App.tsx` | `cleanAllFinancialData()`: `'stock'` → `'stock_items'` (BUG#4) |
| 2 | `App.tsx` | `handleAddPayable()`: usar `setDoc` com ID determinístico (BUG#2) |
| 3 | `App.tsx` | `estornoSale()`: substituir `where('__name__','==',id)` por `where('id_completo','==',id)` (BUG#1) |
| 4 | `App.tsx` | `registerBatchFinancial()`: verificar duplicata via Firestore query, não state React (BUG#3) |
| 5 | `App.tsx` | `addBatch()`: REMOVER a gravação de transação à vista (concentrar em `registerBatchFinancial`) |
| 6 | `components/Login.tsx` | Remover `localStorage.setItem('fg_saved_password', password)` (BUG#5) |

### FASE B — Migração Supabase

| # | Arquivo | Ação |
|---|---------|------|
| 1 | `package.json` | Adicionar `@supabase/supabase-js`, remover `firebase` |
| 2 | `.env` | Trocar vars Firebase por Supabase |
| 3 | `supabaseClient.ts` | Criar (novo arquivo) |
| 4 | `App.tsx` | Substituir todos os imports e operações Firebase por Supabase |
| 5 | `components/Login.tsx` | Substituir Firebase Auth por Supabase Auth |
| 6 | `utils/audit.ts` | Substituir Firebase por Supabase |
| 7 | `services/agentMemoryService.ts` | Substituir Firebase por Supabase |
| 8 | `components/SystemReset.tsx` | Substituir Firebase por Supabase |
| 9 | `components/CollaboratorReport.tsx` | Substituir Firebase por Supabase |
| 10 | `components/MeetingChat.tsx` | Substituir Firebase por Supabase |
| 11 | `components/SalesAgent.tsx` | Substituir Firebase por Supabase |
| 12 | `components/VirtualAssistant.tsx` | Substituir Firebase por Supabase |
| 13 | `firebaseClient.ts` | Deletar após migração completa |
| 14 | `firebase.json` | Deletar após migração completa |

### FASE C — Deploy

| # | Tarefa |
|---|--------|
| 1 | Criar projeto no Supabase |
| 2 | Executar o SQL de criação das 11 tabelas |
| 3 | Habilitar Realtime nas tabelas necessárias (Supabase Dashboard) |
| 4 | Configurar Row Level Security (RLS) — básico: auth.uid() is not null |
| 5 | Migrar dados existentes do Firestore → CSV → importar no Supabase |
| 6 | Deploy no Vercel ou manter Firebase Hosting (apenas hosting, sem Firestore) |
| 7 | Atualizar `firebase.json` para remover Firestore rules |

---

## PARTE 4 — RISCOS E PONTOS DE ATENÇÃO

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `writeBatch` limite 500 ops | Alto | Usar RPC PostgreSQL para estornos complexos |
| Dados já corrompidos no Firestore (payables com ID errado) | Alto | Rodar script de limpeza antes de migrar |
| Realtime Supabase requer projeto Pro para > 200 conexões | Médio | Plano Free cobre uso interno de frigorífico |
| `stock_ids_originais` é array → Firebase guarda bem, Supabase usa `TEXT[]` | Baixo | Mapeado corretamente no SQL acima |
| `onde` (`__name__`) não existe no Supabase | Alto | Substituir por `.eq('campo_pk', valor)` em todo o código |

---

## PARTE 5 — ORDEM DE EXECUÇÃO RECOMENDADA

```
SEMANA 1: FASE A (Corrigir bugs Firebase)
├── Dia 1: BUG#4 + BUG#5 (simples, 30min)
├── Dia 2: BUG#2 — handleAddPayable com setDoc determinístico
├── Dia 3: BUG#1 — estornoSale com where('id_completo')
└── Dia 4-5: BUG#3 — unificar lógica addBatch + registerBatchFinancial

SEMANA 2: Preparar Supabase
├── Criar projeto + rodar SQL das tabelas
├── Migrar dados Firestore → Supabase
└── Criar supabaseClient.ts

SEMANA 3: FASE B (Migrar código)
├── App.tsx (maior esforço — ~400 linhas de Firebase)
├── Login.tsx + audit.ts + agentMemoryService.ts
└── Demais componentes (6 arquivos menores)

SEMANA 4: Testes + Deploy
├── Testar fluxo completo (compra lote → abate → venda → recebimento → estorno)
├── Testar fluxo de caixa (saldo bate com realidade)
└── Deploy + monitorar por 1 semana
```

---
*Plano gerado com base em leitura completa do código em 06/03/2026*
