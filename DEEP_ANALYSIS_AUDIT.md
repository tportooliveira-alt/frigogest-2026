# 📊 ANALISE PROFUNDA: Auditoria FrigoGest v3.5.2 (Produção)

Este documento contém o diagnóstico técnico completo dos erros encontrados durante a auditoria de Março/2026. Salve este arquivo para referência em outras sessões.

---

## 🔍 1. Diagnóstico de Bugs Críticos

### 🛠️ Bug A: Estorno de Venda não devolve Itens ao Estoque
**Sintoma:** Ao estornar uma venda (especialmente carcaças inteiras), os itens permanecem com status `VENDIDO` em vez de voltarem para `DISPONIVEL`.

**Causa Raiz (`App.tsx` L567-577):**
O sistema tenta identificar os itens de estoque usando `sale.stock_ids_originais` ou `sale.id_completo`. 
```typescript
// L1306 (App.tsx)
const idCompleto = isCarcacaInteira 
  ? `${groupItems[0].id_lote}-${groupItems[0].sequencia}-INTEIRO` 
  : groupItems[0].id_completo;
```
Na venda de carcaça inteira, o `id_completo` termina em `-INTEIRO`. Esse ID **NÃO EXISTE** na coleção `stock_items` (onde os IDs são `...-BANDA_A` ou `...-BANDA_B`). Se o campo `stock_ids_originais` falhar ou for sanitizado incorretamente, o `updateDoc` falha silenciosamente ou tenta atualizar um documento inexistente.

---

### 🛠️ Bug B: Compra à Vista sem Saída no Fluxo de Caixa
**Sintoma:** Criar um lote com pagamento "À Vista" gera o lote e o estoque, mas o saldo do caixa não diminui.

**Causa Raiz (`App.tsx` L488-549):**
O objeto `batch` é clonado e sanitizado em `addBatch`. 
1. Na L501, o campo `forma_pagamento` é deletado (`delete cleanBatch.forma_pagamento`).
2. Embora a transação seja tentada na L527, há uma redundância perigosa com a função `registerBatchFinancial` (L882).
3. **Race Condition:** `addBatch` chama `fetchData()` na L544. Como o Firestore é assíncrono e o State do React não atualiza na hora, quando `registerBatchFinancial` roda logo em seguida (em `Batches.tsx` L454), o guard de duplicatas (`existingTx`) pode falhar por ler um estado antigo, resultando em erro de gravação ou pulo da transação.

---

## 📝 2. Plano de Correção (Implementation Plan)

### Ações em `App.tsx`:
1. **Refatorar `estornoSale`**:
   - Forçar a busca pelos itens reais via query se o `stock_ids_originais` for inválido.
   - Adicionar Verificação Anti-Orfão: se o ID terminar em `-INTEIRO`, buscar automaticamente as bandas A e B vinculadas.

2. **Refatorar `addBatch`**:
   - Unificar a lógica financeira. Somente `addBatch` deve ser responsável pela transação inicial de compra para evitar conflitos de ID e estado com `registerBatchFinancial`.
   - Garantir que `totalCost` (L525) inclua Frete e Gastos Extras SEMPRE.

3. **Refatorar `registerBatchFinancial`**:
   - Tornar a função puramente de "Ajuste/Prazo".
   - Adicionar `await` real em todas as chamadas de transação para garantir ordem cronológica no Firebase.

### Ações em `Expedition.tsx`:
- Garantir que `onConfirmSale` envie explicitamente a lista de IDs de estoque originais, evitando a dependência do ID formatado `-INTEIRO` para operações de banco de dados.

---

## 🚀 3. Instruções para Próxima Sessão
Para aplicar estas correções em uma nova seção, use as ferramentas de edição (como `replace_file_content`) nos blocos identificados acima. 

**Prioridade 1:** Consertar o Estorno (para não perder o controle do que voltou pro gancho).
**Prioridade 2:** Consertar a Saída de Caixa (para o saldo bater com a conta bancária/gaveta).

---
*Relatório gerado por Antigravity AI em 04/03/2026.*
