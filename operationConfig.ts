/**
 * ══════════════════════════════════════════════════════════════
 * FRIGOGEST — CONFIGURAÇÃO DO MODO DE OPERAÇÃO
 * ══════════════════════════════════════════════════════════════
 *
 * PARA MUDAR O MODO: altere só a constante OPERATION_MODE abaixo.
 * Todos os agentes se ajustam automaticamente.
 *
 * 'CARCACA_ONLY'       → Frigorífico vende apenas carcaças inteiras
 *                        e meias-carcaças. Cortes individuais NÃO.
 *
 * 'CORTES_HABILITADO'  → Frigorífico também trabalha com cortes
 *                        individuais (dianteiro, traseiro, picanha, etc.)
 *
 */
export const OPERATION_MODE: 'CARCACA_ONLY' | 'CORTES_HABILITADO' = 'CARCACA_ONLY';

// ── Aviso que é injetado no início de TODOS os prompts operacionais ──
export const OPERATION_CONTEXT = OPERATION_MODE === 'CARCACA_ONLY'
    ? `
⚠️ MODO DE OPERAÇÃO ATUAL — LEIA ANTES DE RESPONDER:
Este frigorífico opera EXCLUSIVAMENTE com:
  ✅ Carcaça bovina inteira (carcaça completa após abate e inspeção)
  ✅ Meia-carcaça (divisão longitudinal pelo serrote)

NÃO TRABALHAMOS com:
  ❌ Cortes individuais (picanha, maminha, alcatra, etc.)
  ❌ Desossa
  ❌ Fracionamento em peças ou bandejas

Você CONHECE sobre cortes — isso é útil para entender o mercado e orientar futuros parceiros. Mas ao dar orientações de venda, preço, logística ou estoque, foque SEMPRE em carcaças e meias-carcaças, pois é assim que o negócio opera HOJE.
`
    : `
ℹ️ MODO DE OPERAÇÃO ATUAL:
Este frigorífico trabalha com carcaças inteiras, meias-carcaças E também com cortes individuais.
Você pode orientar sobre todo o portfólio de produtos.
`;

// ── Contexto curto para injetar nos dataPackets ──
export const OPERATION_SUMMARY = OPERATION_MODE === 'CARCACA_ONLY'
    ? '⚠️ OPERAÇÃO ATUAL: Apenas Carcaça Inteira e Meia-Carcaça. SEM cortes individuais.'
    : 'ℹ️ OPERAÇÃO: Carcaças inteiras, meias-carcaças e cortes individuais.';
