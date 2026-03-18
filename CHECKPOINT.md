# 📍 CHECKPOINT — FrigoGest 2026
**Última sessão:** 18/03/2026
**Último commit:** 27c3c58
**Branch:** main
**Deploy:** gestfri.web.app (CI/CD automático via GitHub Actions)

---

## ✅ SPRINTS CONCLUÍDOS

### Sprint 1 — Fundação (100% ✅)
- S1-01: Migration SQL — colunas forma_pagamento_frete e prazo_dias_frete no banco
- S1-02: Bug timezone em estornos — 5x new Date().toISOString() → todayBR()
- S1-03: cleanupOrphans movida para fora do fetchData (só roda no login)
- S1-04: custo_real_kg recalcula automaticamente ao editar lote
- S1-05: Validação de peça duplicada na pesagem do lote
- S1-06: 11 índices PostgreSQL criados no Supabase

### Sprint 2 — Entrada de Lote + Vendas (100% ✅)
- S2-01: Campos frete PRAZO/VISTA já existiam na UI — funcionam após S1-01
- S2-02: Romaneio IA já importava pesos automaticamente
- S2-03: Peso real de saída (itemWeights) já existia e funcionava
- S2-05: Painel de lucro estimado em tempo real na expedição
- S2-06: Campo de observações por venda (corte especial, horário, etc)
- S2-07: Seleção de transportadora na expedição (suppliers categoria TRANSPORTADORA)
- S2-08: Alerta quando preço de venda está abaixo do custo real

---

## 🔜 PRÓXIMO: Sprint 3 — Reconstrução dos Módulos IA

### Tarefas em ordem:
| ID | Tarefa | Arquivo | Horas |
|----|--------|---------|-------|
| S3-01 | llmCascade.ts: cascata Groq → Gemini → Haiku | services/llmCascade.ts (novo) | 3h |
| S3-02 | AIChat.tsx: chat com contexto do sistema | components/AIChat.tsx (novo) | 4h |
| S3-03 | autoTriggerService.ts: sentinelas AIOS | services/autoTriggerService.ts (novo) | 3h |
| S3-04 | agentMemoryService.ts: memória no Supabase | services/agentMemoryService.ts (novo) | 2h |
| S3-05 | AIAgents.tsx: painel de agentes | components/AIAgents.tsx (novo) | 4h |
| S3-06 | AIOSPanel.tsx: painel de alertas | components/AIOSPanel.tsx (novo) | 2h |
| S3-07 | Externalizar prompts 17 agentes em agentPrompts/ | pasta nova | 3h |
| S3-08 | Streaming no AIChat (SSE) | AIChat.tsx | 2h |
| S3-09 | AIMeetingRoom.tsx: reunião multi-agente paralela | components/AIMeetingRoom.tsx (novo) | 4h |

### Contexto crítico para o Sprint 3:
- App.tsx linhas 25-44: imports apontam para /ai/components/ e /ai/services/ que NÃO existem no repo
- Todos os módulos precisam ser criados do zero nessa pasta
- Começar sempre pelo llmCascade.ts (base de tudo) antes de qualquer componente
- LLMs: VITE_GROQ_API_KEY (Groq), VITE_AI_API_KEY (Gemini), VITE_ANTHROPIC_KEY (Claude)
- orchestratorService.ts já existe e está correto — só precisa do llmCascade que ele importa
- agentMemoryService é importado pelo orchestratorService — criar antes do AIAgents

---

## 📋 Sprints Futuros

### Sprint 4 — Financeiro Avançado
Projeção de fluxo de caixa 30/60/90 dias, DRE comparativo mês a mês,
centro de custo por lote, recebimento multi-método, frete vinculado
à transportadora, notificação de vencimento, exportação DRE PDF.

### Sprint 5 — Operações
Monitor de temperatura, rendimento real automático, FIFO visual,
GTA integrado ao lote, Drip Loss por peça, paginação fetchData, PWA offline.

### Sprint 6 — Analytics
Rentabilidade por raça, curva ABC fornecedores, relatório semanal auto,
precificação dinâmica, CEPEA vs custo pago, reativação clientes, score fornecedor.

---

## 🔑 Referências rápidas
- Supabase Project: fgzbkvgaxnwlufhndoqp
- GitHub: github.com/tportooliveira-alt/frigogest-2026
- App: https://gestfri.web.app
