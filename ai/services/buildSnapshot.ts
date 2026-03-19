/**
 * ═══════════════════════════════════════════════════════════════
 * BUILD SNAPSHOT — FrigoGest 2026
 * ═══════════════════════════════════════════════════════════════
 * Snapshot rico do sistema para injetar nos agentes.
 * Inclui dados reais: clientes, lotes, vendas, cotações, devedores.
 * Fix 1: data em hora local (sem bug de timezone)
 * Fix 2: snapshot enriquecido com contexto real
 * Fix 7: contexto geográfico VDC/BA embutido
 * Fix 8: cotação de arroba quando disponível
 * ═══════════════════════════════════════════════════════════════
 */

import { Batch, StockItem, Sale, Client, Transaction, Payable } from '../../types';

export interface SnapshotInput {
  batches: Batch[];
  stock: StockItem[];
  sales: Sale[];
  clients: Client[];
  transactions: Transaction[];
  payables: Payable[];
  scheduledOrders?: any[];
  suppliers?: any[];
  precoArrobaAtual?: number; // Fix 8: cotação real se disponível
}

// Fix 1: data local sem bug de UTC
const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const buildRichSnapshot = (data: SnapshotInput): string => {
  const hoje = todayLocal();
  const mesAtual = hoje.substring(0, 7);

  // ── Financeiro ──
  const saldo = data.transactions.reduce(
    (a, t) => a + (t.tipo === 'ENTRADA' ? t.valor : -t.valor), 0
  );

  const vendasPendentes = data.sales.filter(s => s.status_pagamento === 'PENDENTE');
  const aReceber = vendasPendentes.reduce(
    (a, s) => a + (s.peso_real_saida * s.preco_venda_kg) - ((s as any).valor_pago || 0), 0
  );
  const aPagar = data.payables
    .filter(p => !['PAGO','ESTORNADO','CANCELADO'].includes(p.status))
    .reduce((a, p) => a + (p.valor - (p.valor_pago || 0)), 0);

  // ── Estoque ──
  const dispStock = data.stock.filter(s => s.status === 'DISPONIVEL');
  const totalKg = dispStock.reduce((a, s) => a + s.peso_entrada, 0);
  const stockCritico = dispStock.filter(s => {
    const dias = Math.floor((new Date().getTime() - new Date(s.data_entrada + 'T12:00:00').getTime()) / 86400000);
    return dias >= 7;
  });

  // ── Lotes ──
  const lotesFechados = data.batches.filter(b => b.status === 'FECHADO');
  const lotesInfo = lotesFechados.slice(0, 5).map(b =>
    `  • ${b.id_lote} | ${b.fornecedor} | ${b.peso_total_romaneio}kg | R$${b.custo_real_kg?.toFixed(2)}/kg`
  ).join('\n');

  // ── Vendas do mês ──
  const vendasMes = data.sales.filter(s =>
    s.status_pagamento !== 'ESTORNADO' && s.data_venda.startsWith(mesAtual)
  );
  const faturamentoMes = vendasMes.reduce((a, s) => a + (s.peso_real_saida * s.preco_venda_kg), 0);

  // ── Top devedores (Fix 11: com nomes reais) ──
  const devedores = vendasPendentes
    .map(s => ({
      nome: s.nome_cliente || 'Desconhecido',
      valor: (s.peso_real_saida * s.preco_venda_kg) - ((s as any).valor_pago || 0),
      diasAtraso: Math.floor((new Date().getTime() - new Date(s.data_vencimento + 'T12:00:00').getTime()) / 86400000)
    }))
    .filter(d => d.diasAtraso > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  // ── Top clientes ativos ──
  const clientMap = new Map<string, number>();
  vendasMes.forEach(s => {
    const n = s.nome_cliente || s.id_cliente;
    clientMap.set(n, (clientMap.get(n) || 0) + (s.peso_real_saida * s.preco_venda_kg));
  });
  const topClientes = [...clientMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n, v]) => `  • ${n}: ${fmt(v)}`).join('\n');

  // ── Contas a pagar vencidas ──
  const contasVencidas = data.payables
    .filter(p => !['PAGO','ESTORNADO','CANCELADO'].includes(p.status) && p.data_vencimento < hoje)
    .map(p => `  • ${p.descricao}: ${fmt(p.valor - (p.valor_pago||0))} (venceu ${p.data_vencimento})`)
    .join('\n');

  // Fix 8: Cotação arroba
  const cotacaoArroba = data.precoArrobaAtual
    ? `\nCOTAÇÃO ARROBA ATUAL: R$ ${data.precoArrobaAtual.toFixed(2)}/@ (referência VDC/Sudoeste BA)`
    : '';

  // Fix 7: Contexto geográfico
  const geoContext = `LOCALIZAÇÃO: Vitória da Conquista, Bahia — Mercado Sudoeste BA
REFERÊNCIA REGIONAL: Feirão de VDC, Feira de Santana, CEASA-BA`;

  return `━━━ DADOS REAIS DO FRIGOGEST ━━━
DATA: ${hoje}
${geoContext}${cotacaoArroba}

💰 FINANCEIRO
Saldo Caixa: ${fmt(saldo)}
A Receber: ${fmt(aReceber)} (${vendasPendentes.length} vendas pendentes)
A Pagar: ${fmt(aPagar)}
Faturamento ${mesAtual}: ${fmt(faturamentoMes)} (${vendasMes.length} vendas)

📦 ESTOQUE
Peças disponíveis: ${dispStock.length} | Total: ${totalKg.toFixed(1)}kg
Peças críticas (7+ dias): ${stockCritico.length}

🐂 LOTES ATIVOS (últimos 5)
${lotesInfo || '  (nenhum lote fechado)'}

👥 TOP CLIENTES DO MÊS
${topClientes || '  (sem vendas este mês)'}

⚠️ INADIMPLENTES
${devedores.length > 0
  ? devedores.map(d => `  • ${d.nome}: ${fmt(d.valor)} — ${d.diasAtraso}d de atraso`).join('\n')
  : '  Nenhum devedor em atraso'}

📤 CONTAS VENCIDAS
${contasVencidas || '  Nenhuma conta vencida'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
};
