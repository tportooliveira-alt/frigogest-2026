/**
 * BUILD SNAPSHOT — FrigoGest 2026
 * Fix 1: data local | Fix 2: contexto rico | Fix 7: geo VDC/BA
 *
 * MODOS:
 *  lite  → ~150 tokens  (chat rápido, perguntas simples)
 *  full  → ~600 tokens  (análises, orquestrador, reunião)
 */

import { Batch, StockItem, Sale, Client, Transaction, Payable } from '../../types';

export type SnapshotMode = 'lite' | 'full';

export interface SnapshotInput {
  batches: Batch[];
  stock: StockItem[];
  sales: Sale[];
  clients: Client[];
  transactions: Transaction[];
  payables: Payable[];
  scheduledOrders?: any[];
  suppliers?: any[];
  precoArrobaAtual?: number;
  mode?: SnapshotMode;
}

const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── MODO LITE: só o essencial (~150 tokens) ─────────────────────
const buildLiteSnapshot = (data: SnapshotInput): string => {
  const hoje = todayLocal();
  const saldo = data.transactions.reduce((a, t) => a + (t.tipo === 'ENTRADA' ? t.valor : -t.valor), 0);
  const aReceber = data.sales.filter(s => s.status_pagamento === 'PENDENTE')
    .reduce((a, s) => a + (s.peso_real_saida * s.preco_venda_kg) - ((s as any).valor_pago || 0), 0);
  const aPagar = data.payables.filter(p => !['PAGO','ESTORNADO','CANCELADO'].includes(p.status))
    .reduce((a, p) => a + (p.valor - (p.valor_pago || 0)), 0);
  const dispStock = data.stock.filter(s => s.status === 'DISPONIVEL');
  const arroba = data.precoArrobaAtual ? ` | Arroba: ${fmt(data.precoArrobaAtual)}/@` : '';
  return `[FrigoGest VDC/BA | ${hoje}]
💰 Caixa: ${fmt(saldo)} | A Receber: ${fmt(aReceber)} | A Pagar: ${fmt(aPagar)}
📦 Estoque: ${dispStock.length} peças (${dispStock.reduce((a,s) => a+s.peso_entrada,0).toFixed(0)}kg)
🐂 Lotes fechados: ${data.batches.filter(b => b.status === 'FECHADO').length} | Clientes: ${data.clients.length}${arroba}`;
};

// ── MODO FULL: contexto completo (~600 tokens) ──────────────────
const buildFullSnapshot = (data: SnapshotInput): string => {
  const hoje = todayLocal();
  const mesAtual = hoje.substring(0, 7);
  const saldo = data.transactions.reduce((a, t) => a + (t.tipo === 'ENTRADA' ? t.valor : -t.valor), 0);
  const vendasPendentes = data.sales.filter(s => s.status_pagamento === 'PENDENTE');
  const aReceber = vendasPendentes.reduce((a, s) => a + (s.peso_real_saida * s.preco_venda_kg) - ((s as any).valor_pago || 0), 0);
  const aPagar = data.payables.filter(p => !['PAGO','ESTORNADO','CANCELADO'].includes(p.status))
    .reduce((a, p) => a + (p.valor - (p.valor_pago || 0)), 0);
  const dispStock = data.stock.filter(s => s.status === 'DISPONIVEL');
  const totalKg = dispStock.reduce((a, s) => a + s.peso_entrada, 0);
  const stockCritico = dispStock.filter(s => {
    const dias = Math.floor((new Date().getTime() - new Date(s.data_entrada + 'T12:00:00').getTime()) / 86400000);
    return dias >= 7;
  });
  const lotesFechados = data.batches.filter(b => b.status === 'FECHADO');
  const lotesInfo = lotesFechados.slice(0, 4).map(b =>
    `  • ${b.id_lote} | ${b.fornecedor} | ${b.peso_total_romaneio}kg | ${fmt(b.custo_real_kg || 0)}/kg`
  ).join('\n');
  const vendasMes = data.sales.filter(s => s.status_pagamento !== 'ESTORNADO' && s.data_venda.startsWith(mesAtual));
  const faturamentoMes = vendasMes.reduce((a, s) => a + (s.peso_real_saida * s.preco_venda_kg), 0);
  const clientMap = new Map<string, number>();
  vendasMes.forEach(s => { const n = s.nome_cliente || s.id_cliente; clientMap.set(n, (clientMap.get(n)||0) + (s.peso_real_saida * s.preco_venda_kg)); });
  const topClientes = [...clientMap.entries()].sort((a,b) => b[1]-a[1]).slice(0,4).map(([n,v]) => `  • ${n}: ${fmt(v)}`).join('\n');
  const devedores = vendasPendentes
    .map(s => ({ nome: s.nome_cliente||'?', valor: (s.peso_real_saida*s.preco_venda_kg)-((s as any).valor_pago||0), dias: Math.floor((new Date().getTime()-new Date(s.data_vencimento+'T12:00:00').getTime())/86400000) }))
    .filter(d => d.dias > 0).sort((a,b) => b.valor-a.valor).slice(0,4);
  const contasVencidas = data.payables
    .filter(p => !['PAGO','ESTORNADO','CANCELADO'].includes(p.status) && p.data_vencimento < hoje)
    .slice(0,4).map(p => `  • ${p.descricao.substring(0,40)}: ${fmt(p.valor-(p.valor_pago||0))}`).join('\n');
  const cotacao = data.precoArrobaAtual ? `\nCOTAÇÃO ARROBA: ${fmt(data.precoArrobaAtual)}/@ (VDC/Sudoeste BA)` : '';
  return `━━ FRIGOGEST | VDC-BA | ${hoje} ━━${cotacao}
💰 FINANCEIRO
Caixa: ${fmt(saldo)} | Receber: ${fmt(aReceber)} (${vendasPendentes.length}) | Pagar: ${fmt(aPagar)}
Faturamento ${mesAtual}: ${fmt(faturamentoMes)} (${vendasMes.length} vendas)
📦 ESTOQUE: ${dispStock.length} peças | ${totalKg.toFixed(0)}kg | Crítico(7d+): ${stockCritico.length}
🐂 LOTES (últ. 4):
${lotesInfo||'  (nenhum)'}
👥 TOP CLIENTES MÊS:
${topClientes||'  (sem vendas)'}
⚠️ DEVEDORES:
${devedores.length>0 ? devedores.map(d=>`  • ${d.nome}: ${fmt(d.valor)} — ${d.dias}d atraso`).join('\n') : '  Nenhum'}
📤 CONTAS VENCIDAS:
${contasVencidas||'  Nenhuma'}`;
};

export const buildRichSnapshot = (data: SnapshotInput): string =>
  data.mode === 'lite' ? buildLiteSnapshot(data) : buildFullSnapshot(data);
