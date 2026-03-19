# 📍 CHECKPOINT — FrigoGest 2026
**Última sessão:** 19/03/2026
**Último commit:** fabf1f9
**Branch:** main
**Deploy:** gestfri.web.app

---

## ✅ SPRINTS CONCLUÍDOS
- Sprint 1 — Fundação (100%) ✅
- Sprint 2 — Entrada de Lote + Vendas (100%) ✅
- Sprint 3 — Módulos IA (100%) ✅
- Sprint 4 — Financeiro Avançado (100%) ✅
  - S4-01: Aba Projeção 30/60/90 dias
  - S4-02: DRE comparativo mês atual vs anterior
  - S4-03: Aba Por Lote — centro de custo por lote
  - S4-04: Split de recebimento (2 métodos na mesma baixa)
  - S4-05: Payable de frete vincula transportadora
  - S4-06: Notificação push de vencimento (browser)
  - S4-07: Exportação DRE como PDF com logo

---

## 🔜 PRÓXIMO: Sprint 5 — Operações

| ID | Tarefa | Arquivo | Horas |
|----|--------|---------|-------|
| S5-01 | Monitor de Temperatura manual (°C + umidade + alertas coloridos) | components/TemperatureMonitor.tsx (novo) + Sidebar.tsx | 3h |
| S5-02 | Rendimento real automático ao fechar lote (peso_gancho / peso_vivo) | Batches.tsx + App.tsx | 2h |
| S5-03 | FIFO visual: ordenar estoque por data_entrada, vermelho ≥7 dias | Stock.tsx | 2h |
| S5-04 | GTA digital no cadastro do lote (número GTA, veículo, transportador) | Batches.tsx + types.ts | 3h |
| S5-05 | Drip Loss calculado: campo de peso atual da peça no estoque | Stock.tsx + types.ts | 3h |
| S5-06 | Paginação no fetchData (200 registros + botão carregar mais) | App.tsx | 3h |
| S5-07 | PWA offline: service worker para entrada de lote sem internet | vite.config.ts | 4h |

### Contexto para o Sprint 5:
- Stock.tsx (727 linhas): aba de estoque com lista de peças. FIFO = ordenar por data_entrada ASC
- Batches.tsx (1.837 linhas): formulário de lote. Campos GTA já existem em GTAManager separado — integrar
- types.ts: adicionar campos drip_loss_atual e gta_numero no StockItem e Batch
- Para S5-06: fetchData carrega tudo sem limite — adicionar .range(0, 199) e flag hasMore
- Para PWA: instalar vite-plugin-pwa, configurar cache das telas de Batches e Expedition

---

## 📋 Sprint 6 — Analytics (próximo após S5)
Rentabilidade por raça, curva ABC fornecedores, relatório semanal auto,
precificação dinâmica, CEPEA vs custo pago, reativação clientes, score fornecedor.

---

## 🔑 Referências rápidas
- Supabase: fgzbkvgaxnwlufhndoqp
- GitHub: github.com/tportooliveira-alt/frigogest-2026
- App: https://gestfri.web.app
