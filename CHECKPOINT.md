# 📍 CHECKPOINT — FrigoGest 2026
**Última sessão:** 18/03/2026
**Último commit:** 905d84c
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
- S2-01/02/03: Campos frete, romaneio IA e peso real de saída já existiam
- S2-05: Painel de lucro estimado em tempo real na expedição
- S2-06: Campo de observações por venda
- S2-07: Seleção de transportadora na expedição
- S2-08: Alerta quando preço de venda está abaixo do custo real

### Sprint 3 — Módulos IA (100% ✅)
- S3-01: ai/services/llmCascade.ts — cascata Groq → Gemini → Claude Haiku
- S3-02: ai/components/AIChat.tsx — chat com 17 agentes + contexto real
- S3-03: ai/services/autoTriggerService.ts — 8 sentinelas AIOS determinísticos
- S3-04: ai/services/agentMemoryService.ts — memória dos agentes no Supabase
- S3-05: ai/components/AIAgents.tsx — painel de agentes com consulta individual
- S3-06: ai/components/AIOSPanel.tsx — painel de alertas com dismiss e navegação
- S3-07: agentPrompts/index.ts — prompts externalizados dos 17 agentes
- S3-09: ai/components/AIMeetingRoom.tsx — 5 agentes em paralelo (Promise.allSettled)
- Extra: ai/components/SalesAgent.tsx — agente Marcos (Comercial)

---

## 🔜 PRÓXIMO: Sprint 4 — Financeiro Avançado

### Tarefas em ordem:
| ID | Tarefa | Arquivo | Horas |
|----|--------|---------|-------|
| S4-01 | Projeção de fluxo 30/60/90 dias (A Receber + A Pagar futuros) | Financial.tsx | 4h |
| S4-02 | DRE comparativo mês atual vs mês anterior com variação % | Financial.tsx | 3h |
| S4-03 | Centro de custo por lote: receita, CMV e lucro de cada lote | Financial.tsx | 4h |
| S4-04 | Recebimento com múltiplos métodos (PIX + Dinheiro na mesma baixa) | Financial.tsx + App.tsx | 3h |
| S4-05 | Payable de frete vinculado à transportadora (não fornecedor) | App.tsx + Financial.tsx | 2h |
| S4-06 | Notificação push de vencimento (service worker) | App.tsx | 3h |
| S4-07 | Exportação DRE como PDF profissional com logo | Financial.tsx | 2h |

### Contexto para o Sprint 4:
- Financial.tsx tem ~1.700 linhas — edições cirúrgicas com Python replace
- O DRE já usa regime de competência correto (fix de 18/03)
- profitTotals.cgs já calcula CMV correto via custo_real_kg
- Para projeção: usar sales.data_vencimento (A Receber) e payables.data_vencimento (A Pagar)
- Para DRE comparativo: filtrar transactions por mes atual e mes anterior separadamente
- Centro de custo por lote: agrupar sales por id_lote (3 primeiros segmentos do id_completo)

---

## 📋 Sprints Futuros

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
- Chaves API: VITE_GROQ_API_KEY, VITE_AI_API_KEY (Gemini), VITE_ANTHROPIC_KEY (Haiku)
- agent_memory table: criar no Supabase se quiser memória persistente dos agentes
