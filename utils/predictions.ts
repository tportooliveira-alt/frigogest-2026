// ═══ SERVIÇO DE ANALYTICS PREDITIVO — FASE 3 ═══
// Inspirado em: SAP S/4HANA Predictive Analytics, Oracle ERP Forecasting, Dynamics 365 Demand Planning
// Usa médias móveis (7d, 30d) e projeções lineares para prever KPIs futuros

import { Sale, StockItem, Batch, Client, Payable, Transaction } from '../types';

export interface PredictiveSnapshot {
    // Receita
    receita7d: number;
    receita30d: number;
    receitaProjetada7d: number;
    receitaProjetada30d: number;
    tendenciaReceita: 'SUBINDO' | 'ESTAVEL' | 'CAINDO';
    percentualVariacao: number;

    // Estoque
    estoqueAtualKg: number;
    consumoMedio7dKg: number;
    diasAteEsgotar: number;
    pecasVencendo: number; // Peças com 6+ dias (MAX vida útil: 8 dias)
    alertaEstoqueBaixo: boolean;

    // Caixa
    caixaAtual: number;
    entradas30d: number;
    saidas30d: number;
    caixaProjetado30d: number;
    alertaCaixaNegativo: boolean;
    diasAteCaixaNegativo: number;

    // Clientes
    clientesAtivos30d: number;
    clientesInativos30d: number;
    taxaChurn: number;
    alertaChurnAlto: boolean;

    // Compras
    custoMedioKg7d: number;
    custoMedioKg30d: number;
    tendenciaCusto: 'SUBINDO' | 'ESTAVEL' | 'CAINDO';
    proximaCompraIdealDias: number;

    // Volume
    vendasCount7d: number;
    vendasCount30d: number;
    mediaDiariaVendas: number;
    pesoMedioPorVenda: number;
}

export function calculatePredictions(
    sales: Sale[],
    stock: StockItem[],
    batches: Batch[],
    clients: Client[],
    payables: Payable[],
    transactions: Transaction[]
): PredictiveSnapshot {
    const now = new Date();
    const msDay = 86400000;
    const validSales = sales.filter(s => s.status_pagamento !== 'ESTORNADO');

    // ═══ RECEITA ═══
    const sales7d = validSales.filter(s => (now.getTime() - new Date(s.data_venda).getTime()) / msDay <= 7);
    const sales30d = validSales.filter(s => (now.getTime() - new Date(s.data_venda).getTime()) / msDay <= 30);
    const sales30_60d = validSales.filter(s => {
        const dias = (now.getTime() - new Date(s.data_venda).getTime()) / msDay;
        return dias > 30 && dias <= 60;
    });

    const receita7d = sales7d.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0);
    const receita30d = sales30d.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0);
    const receita30_60d = sales30_60d.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0);

    const mediaDiaria7d = receita7d / Math.max(1, Math.min(7, sales7d.length > 0 ? 7 : 1));
    const mediaDiaria30d = receita30d / Math.max(1, Math.min(30, sales30d.length > 0 ? 30 : 1));

    const receitaProjetada7d = mediaDiaria7d * 7;
    const receitaProjetada30d = mediaDiaria30d * 30;

    let tendenciaReceita: 'SUBINDO' | 'ESTAVEL' | 'CAINDO' = 'ESTAVEL';
    let percentualVariacao = 0;
    if (receita30_60d > 0) {
        percentualVariacao = ((receita30d - receita30_60d) / receita30_60d) * 100;
        if (percentualVariacao > 5) tendenciaReceita = 'SUBINDO';
        else if (percentualVariacao < -5) tendenciaReceita = 'CAINDO';
    }

    // ═══ ESTOQUE ═══
    const estoqueDisp = stock.filter(s => s.status === 'DISPONIVEL');
    const estoqueAtualKg = estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0);

    const pesoVendido7d = sales7d.reduce((s, v) => s + v.peso_real_saida, 0);
    const consumoMedio7dKg = pesoVendido7d / Math.max(1, 7);

    const diasAteEsgotar = consumoMedio7dKg > 0
        ? Math.round(estoqueAtualKg / consumoMedio7dKg)
        : estoqueAtualKg > 0 ? 999 : 0;

    // Peças próximas do vencimento (carne dura MAX 8 dias)
    const pecasVencendo = estoqueDisp.filter(s => {
        const dias = Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / msDay);
        return dias >= 6; // 6+ dias = urgência (faltam 2 dias ou menos)
    }).length;

    // ═══ CAIXA ═══
    const txValidasRecentes = transactions.filter(t => {
        const dias = (now.getTime() - new Date(t.data).getTime()) / msDay;
        return dias <= 30 && t.categoria !== 'ESTORNO';
    });
    const entradas30d = txValidasRecentes
        .filter(t => t.tipo === 'ENTRADA')
        .reduce((s, t) => s + t.valor, 0);
    const saidas30d = txValidasRecentes
        .filter(t => t.tipo === 'SAIDA')
        .reduce((s, t) => s + t.valor, 0);

    const caixaAtual = transactions
        .filter(t => t.categoria !== 'ESTORNO')
        .reduce((s, t) => {
            if (t.tipo === 'ENTRADA') return s + t.valor;
            return s - t.valor;
        }, 0);

    const fluxoMedioDiario = (entradas30d - saidas30d) / 30;
    const caixaProjetado30d = caixaAtual + (fluxoMedioDiario * 30);

    // Pagar nos próximos 30d
    const payablesProximos = payables.filter(p => {
        if (p.status !== 'PENDENTE') return false;
        const venc = new Date(p.data_vencimento);
        return venc.getTime() - now.getTime() <= 30 * msDay && venc.getTime() >= now.getTime();
    });
    const totalAPagar30d = payablesProximos.reduce((s, p) => s + p.valor, 0);
    const caixaAposPagamentos = caixaAtual - totalAPagar30d;

    let diasAteCaixaNegativo = 999;
    if (fluxoMedioDiario < 0 && caixaAtual > 0) {
        diasAteCaixaNegativo = Math.round(caixaAtual / Math.abs(fluxoMedioDiario));
    } else if (caixaAposPagamentos < 0) {
        diasAteCaixaNegativo = Math.round((caixaAtual / totalAPagar30d) * 30);
    }

    // ═══ CLIENTES ═══
    const clientesAtivos30d = new Set(
        sales30d.map(s => s.id_cliente)
    ).size;
    const todosClientes = clients.filter(c => c.status !== 'INATIVO').length;
    const clientesInativos30d = todosClientes - clientesAtivos30d;
    const taxaChurn = todosClientes > 0 ? (clientesInativos30d / todosClientes) * 100 : 0;

    // ═══ COMPRAS ═══
    const batchesFechados = batches.filter(b => b.status === 'FECHADO');
    const batches7d = batchesFechados.filter(b =>
        (now.getTime() - new Date(b.data_recebimento).getTime()) / msDay <= 7
    );
    const batches30d = batchesFechados.filter(b =>
        (now.getTime() - new Date(b.data_recebimento).getTime()) / msDay <= 30
    );

    const custoTotal7d = batches7d.reduce((s, b) => s + (b.preco_arroba * (b.peso_total_romaneio / 15)), 0);
    const pesoTotal7d = batches7d.reduce((s, b) => s + b.peso_total_romaneio, 0);
    const custoMedioKg7d = pesoTotal7d > 0 ? custoTotal7d / pesoTotal7d : 0;

    const custoTotal30d = batches30d.reduce((s, b) => s + (b.preco_arroba * (b.peso_total_romaneio / 15)), 0);
    const pesoTotal30d = batches30d.reduce((s, b) => s + b.peso_total_romaneio, 0);
    const custoMedioKg30d = pesoTotal30d > 0 ? custoTotal30d / pesoTotal30d : 0;

    let tendenciaCusto: 'SUBINDO' | 'ESTAVEL' | 'CAINDO' = 'ESTAVEL';
    if (custoMedioKg7d > 0 && custoMedioKg30d > 0) {
        const diff = ((custoMedioKg7d - custoMedioKg30d) / custoMedioKg30d) * 100;
        if (diff > 3) tendenciaCusto = 'SUBINDO';
        else if (diff < -3) tendenciaCusto = 'CAINDO';
    }

    const proximaCompraIdealDias = Math.max(0, diasAteEsgotar - 3); // 3 dias de segurança

    // ═══ VOLUME ═══
    const vendasCount7d = sales7d.length;
    const vendasCount30d = sales30d.length;
    const mediaDiariaVendas = vendasCount30d / Math.max(1, 30);
    const pesoMedioPorVenda = vendasCount30d > 0
        ? sales30d.reduce((s, v) => s + v.peso_real_saida, 0) / vendasCount30d
        : 0;

    return {
        receita7d,
        receita30d,
        receitaProjetada7d,
        receitaProjetada30d,
        tendenciaReceita,
        percentualVariacao,
        estoqueAtualKg,
        consumoMedio7dKg,
        diasAteEsgotar,
        alertaEstoqueBaixo: diasAteEsgotar <= 5 || pecasVencendo > 0,
        caixaAtual,
        entradas30d,
        saidas30d,
        caixaProjetado30d: caixaAposPagamentos,
        pecasVencendo,
        alertaCaixaNegativo: caixaAposPagamentos < 0 || diasAteCaixaNegativo < 15,
        diasAteCaixaNegativo,
        clientesAtivos30d,
        clientesInativos30d,
        taxaChurn,
        alertaChurnAlto: taxaChurn > 40,
        custoMedioKg7d,
        custoMedioKg30d,
        tendenciaCusto,
        proximaCompraIdealDias,
        vendasCount7d,
        vendasCount30d,
        mediaDiariaVendas,
        pesoMedioPorVenda,
    };
}

// ═══ FORMATAR PARA INJETAR NO PROMPT DA IA ═══
export function formatPredictionsForPrompt(p: PredictiveSnapshot): string {
    const tendenciaEmoji = { SUBINDO: '📈', ESTAVEL: '➡️', CAINDO: '📉' };
    const custoEmoji = { SUBINDO: '🔴', ESTAVEL: '🟡', CAINDO: '🟢' };

    return `
═══ 📈 ANALYTICS PREDITIVO (Projeções baseadas em dados reais) ═══

💰 RECEITA:
  Últimos 7d: R$${p.receita7d.toFixed(0)} | Últimos 30d: R$${p.receita30d.toFixed(0)}
  Projeção 7d: R$${p.receitaProjetada7d.toFixed(0)} | Projeção 30d: R$${p.receitaProjetada30d.toFixed(0)}
  Tendência: ${tendenciaEmoji[p.tendenciaReceita]} ${p.tendenciaReceita} (${p.percentualVariacao > 0 ? '+' : ''}${p.percentualVariacao.toFixed(1)}% vs mês anterior)

📦 ESTOQUE (⚠️ CARNE DURA MAX 8 DIAS!):
  Disponível: ${p.estoqueAtualKg.toFixed(0)}kg | Consumo médio: ${p.consumoMedio7dKg.toFixed(1)}kg/dia
  ⏰ ESGOTA EM: ${p.diasAteEsgotar === 999 ? 'Sem vendas recentes' : `${p.diasAteEsgotar} dias`}${p.alertaEstoqueBaixo ? ' 🔴 CRÍTICO!' : ''}
  🥩 Peças com 6+ dias (vencendo): ${p.pecasVencendo}${p.pecasVencendo > 0 ? ' 🔴 VENDER HOJE!' : ' ✅'}

💳 FLUXO DE CAIXA:
  Saldo atual: R$${p.caixaAtual.toFixed(0)}
  Entradas 30d: R$${p.entradas30d.toFixed(0)} | Saídas 30d: R$${p.saidas30d.toFixed(0)}
  Caixa projetado (após pagamentos): R$${p.caixaProjetado30d.toFixed(0)}${p.alertaCaixaNegativo ? ' 🔴 RISCO DE CAIXA NEGATIVO!' : ''}
  ${p.diasAteCaixaNegativo < 999 ? `⚠️ Caixa negativo em ~${p.diasAteCaixaNegativo} dias` : ''}

👥 CLIENTES:
  Ativos (30d): ${p.clientesAtivos30d} | Inativos: ${p.clientesInativos30d}
  Taxa de Churn: ${p.taxaChurn.toFixed(0)}%${p.alertaChurnAlto ? ' 🔴 ALTO! Ativar retenção!' : ''}

🚛 CUSTO DE COMPRA:
  Custo/kg 7d: R$${p.custoMedioKg7d.toFixed(2)} | 30d: R$${p.custoMedioKg30d.toFixed(2)}
  Tendência: ${custoEmoji[p.tendenciaCusto]} ${p.tendenciaCusto}
  Próxima compra ideal em: ${p.proximaCompraIdealDias} dias

📊 VOLUME:
  Vendas 7d: ${p.vendasCount7d} | 30d: ${p.vendasCount30d} | Média: ${p.mediaDiariaVendas.toFixed(1)}/dia
  Peso médio/venda: ${p.pesoMedioPorVenda.toFixed(1)}kg

INSTRUÇÃO: Use estas previsões para antecipar problemas e recomendar ações PREVENTIVAS, não apenas reativas.`;
}
