/**
 * ═══════════════════════════════════════════════════════════════
 * AUTO TRIGGER SERVICE (AIOS) — FrigoGest 2026
 * ═══════════════════════════════════════════════════════════════
 * Sentinelas que analisam dados do sistema e disparam alertas
 * automáticos baseados em thresholds reais do negócio.
 * Roda após cada fetchData — sem LLM, 100% determinístico.
 * ═══════════════════════════════════════════════════════════════
 */

import { Batch, StockItem, Sale, Client, Transaction, Payable } from '../../types';

export type TriggerSeverity = 'INFO' | 'ALERTA' | 'CRITICO' | 'BLOQUEIO';

export interface AutoTriggerResult {
  triggerId: string;
  severity: TriggerSeverity;
  title: string;
  message: string;
  navigateTo?: string; // rota para navegar ao clicar
  value?: number;
}

interface TriggerInput {
  batches: Batch[];
  stock: StockItem[];
  sales: Sale[];
  clients: Client[];
  transactions: Transaction[];
  payables: Payable[];
  scheduledOrders: any[];
}

// ── Helper ──────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];
const daysBetween = (a: string, b: string) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

// ── Triggers ────────────────────────────────────────────────────
export const runAutoTriggers = (data: TriggerInput): AutoTriggerResult[] => {
  const results: AutoTriggerResult[] = [];
  const now = today();

  // ── T1: Estoque crítico (8+ dias sem vender) ──────────────────
  const criticalStock = data.stock.filter(s =>
    s.status === 'DISPONIVEL' &&
    daysBetween(s.data_entrada, now) >= 8
  );
  if (criticalStock.length > 0) {
    const totalKg = criticalStock.reduce((a, s) => a + s.peso_entrada, 0);
    results.push({
      triggerId: `stock-critical-${now}`,
      severity: 'CRITICO',
      title: `⚠️ ${criticalStock.length} peça(s) há 8+ dias no estoque`,
      message: `${totalKg.toFixed(1)}kg em risco de perda. Priorize vendas ou reavalie preço.`,
      navigateTo: 'stock',
      value: criticalStock.length
    });
  }

  // ── T2: Caixa baixo (< R$ 5.000) ─────────────────────────────
  const saldoCaixa = data.transactions.reduce(
    (acc, t) => acc + (t.tipo === 'ENTRADA' ? t.valor : -t.valor), 0
  );
  if (saldoCaixa < 5000 && data.transactions.length > 0) {
    results.push({
      triggerId: `low-cash-${now}`,
      severity: saldoCaixa < 0 ? 'BLOQUEIO' : 'CRITICO',
      title: saldoCaixa < 0 ? '🚨 Saldo NEGATIVO no caixa' : '🔴 Saldo baixo no caixa',
      message: `Saldo atual: R$ ${saldoCaixa.toFixed(2)}. Acione recebimentos pendentes.`,
      navigateTo: 'financial',
      value: saldoCaixa
    });
  }

  // ── T3: Contas a pagar vencidas ───────────────────────────────
  const vencidas = data.payables.filter(p =>
    p.status !== 'PAGO' && p.status !== 'ESTORNADO' && p.status !== 'CANCELADO' &&
    p.data_vencimento < now
  );
  if (vencidas.length > 0) {
    const totalVencido = vencidas.reduce((a, p) => a + (p.valor - (p.valor_pago || 0)), 0);
    results.push({
      triggerId: `payables-overdue-${now}`,
      severity: 'CRITICO',
      title: `📤 ${vencidas.length} conta(s) a pagar vencida(s)`,
      message: `Total em atraso: R$ ${totalVencido.toFixed(2)}. Regularize para evitar juros.`,
      navigateTo: 'financial',
      value: totalVencido
    });
  }

  // ── T4: Clientes inadimplentes críticos (30+ dias) ────────────
  const criticos30 = data.sales.filter(s =>
    s.status_pagamento === 'PENDENTE' &&
    daysBetween(s.data_vencimento, now) >= 30
  );
  if (criticos30.length > 0) {
    const totalCritico = criticos30.reduce((a, s) =>
      a + (s.peso_real_saida * s.preco_venda_kg) - ((s as any).valor_pago || 0), 0
    );
    const nomes = [...new Set(criticos30.map(s => s.nome_cliente || 'Cliente'))].slice(0, 3);
    results.push({
      triggerId: `overdue-clients-${now}`,
      severity: 'CRITICO',
      title: `💰 ${criticos30.length} venda(s) com 30+ dias de atraso`,
      message: `R$ ${totalCritico.toFixed(2)} em risco. Clientes: ${nomes.join(', ')}.`,
      navigateTo: 'financial',
      value: totalCritico
    });
  }

  // ── T5: Lote sem peças cadastradas (ghost batch) ──────────────
  const closedBatches = data.batches.filter(b => b.status === 'FECHADO');
  const batchIds = new Set(data.stock.map(s => s.id_lote));
  const ghostBatches = closedBatches.filter(b => !batchIds.has(b.id_lote));
  if (ghostBatches.length > 0) {
    results.push({
      triggerId: `ghost-batch-${now}`,
      severity: 'ALERTA',
      title: `📦 ${ghostBatches.length} lote(s) fechado(s) sem peças`,
      message: `Lotes: ${ghostBatches.map(b => b.id_lote).join(', ')}. Verifique o estoque.`,
      navigateTo: 'batches',
      value: ghostBatches.length
    });
  }

  // ── T6: Conta a pagar vence hoje ──────────────────────────────
  const venceHoje = data.payables.filter(p =>
    p.status !== 'PAGO' && p.status !== 'ESTORNADO' && p.status !== 'CANCELADO' &&
    p.data_vencimento === now
  );
  if (venceHoje.length > 0) {
    const total = venceHoje.reduce((a, p) => a + (p.valor - (p.valor_pago || 0)), 0);
    results.push({
      triggerId: `due-today-${now}`,
      severity: 'ALERTA',
      title: `📅 ${venceHoje.length} conta(s) vence(m) hoje`,
      message: `Total: R$ ${total.toFixed(2)}. Providencie o pagamento.`,
      navigateTo: 'financial',
      value: total
    });
  }

  // ── T7: Entrega agendada para hoje ────────────────────────────
  const entregasHoje = data.scheduledOrders.filter((o: any) =>
    (o.status === 'ABERTO' || o.status === 'CONFIRMADO') &&
    o.data_entrega === now
  );
  if (entregasHoje.length > 0) {
    results.push({
      triggerId: `deliveries-today-${now}`,
      severity: 'INFO',
      title: `🚛 ${entregasHoje.length} entrega(s) agendada(s) para hoje`,
      message: entregasHoje.map((o: any) => `${o.nome_cliente} — ${o.itens}`).join(' | '),
      navigateTo: 'scheduled_orders',
      value: entregasHoje.length
    });
  }

  // ── T8: Nenhum dado ainda (sistema novo) ──────────────────────
  if (
    data.batches.length === 0 &&
    data.sales.length === 0 &&
    data.transactions.length === 0 &&
    data.clients.length === 0
  ) {
    results.push({
      triggerId: 'empty-system',
      severity: 'INFO',
      title: '👋 Sistema pronto para uso',
      message: 'Comece cadastrando clientes e fornecedores, depois registre o primeiro lote.',
      navigateTo: 'clients'
    });
  }

  // Ordenar por severidade
  const order: Record<TriggerSeverity, number> = {
    BLOQUEIO: 0, CRITICO: 1, ALERTA: 2, INFO: 3
  };
  return results.sort((a, b) => order[a.severity] - order[b.severity]);
};

// ── Briefing diário (1x por dia) ─────────────────────────────────
const BRIEFING_KEY = 'frigogest_briefing_date';

export const shouldShowBriefingToday = (): boolean => {
  const last = localStorage.getItem(BRIEFING_KEY);
  return last !== today();
};

export const markBriefingShownToday = (): void => {
  localStorage.setItem(BRIEFING_KEY, today());
};
