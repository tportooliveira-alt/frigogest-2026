/**
 * ═══════════════════════════════════════════════════════════════
 * AIOS AUTO-TRIGGER SERVICE — FrigoGest
 * ═══════════════════════════════════════════════════════════════
 * Sistema de agentes sentinela que rodam AUTOMATICAMENTE,
 * sem precisar ser chamados pelo dono. Filosofia AIOS:
 * "Um time que nunca para sem contratar ninguém"
 * ═══════════════════════════════════════════════════════════════
 */

import {
    Batch, StockItem, Sale, Client, Transaction,
    Payable, ScheduledOrder, AgentAlert, AlertSeverity
} from '../types';

export interface AutoTriggerResult {
    triggerId: string;
    agentId: string;
    agentName: string;
    agentEmoji: string;
    title: string;
    message: string;
    severity: AlertSeverity;
    actionLabel?: string;
    actionTarget?: string; // rota para navegar ao clicar
    timestamp: Date;
}

interface TriggerContext {
    batches: Batch[];
    stock: StockItem[];
    sales: Sale[];
    clients: Client[];
    transactions: Transaction[];
    payables: Payable[];
    scheduledOrders: ScheduledOrder[];
}

// ─── HELPERS ───────────────────────────────────────────────────
const today = () => new Date();
const daysDiff = (dateStr: string) => {
    const d = new Date(dateStr);
    return Math.floor((today().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
};
const R$ = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── TRIGGER 1: SENTINELA DA CÂMARA FRIA (Joaquim) ─────────────
// Verifica carne parada há mais de 6 dias — risco de perda
const triggerCamaraFria = (ctx: TriggerContext): AutoTriggerResult[] => {
    const alerts: AutoTriggerResult[] = [];
    const disponivel = ctx.stock.filter(s => s.status === 'DISPONIVEL');

    const criticos = disponivel.filter(s => daysDiff(s.data_entrada) >= 8);
    const atencao = disponivel.filter(s => {
        const dias = daysDiff(s.data_entrada);
        return dias >= 6 && dias < 8;
    });

    if (criticos.length > 0) {
        const kgTotal = criticos.reduce((s, i) => s + i.peso_entrada, 0);
        const batch = ctx.batches.find(b => b.id_lote === criticos[0]?.id_lote);
        const valorRisco = kgTotal * (batch?.custo_real_kg || 0);
        alerts.push({
            triggerId: `camara-critico-${today().toDateString()}`,
            agentId: 'ESTOQUE',
            agentName: 'Joaquim',
            agentEmoji: '📦',
            title: `🔴 ${criticos.length} peças com +8 dias na câmara!`,
            message: `${kgTotal.toFixed(1)}kg em risco iminente de perda. Valor em jogo: ${R$(valorRisco)}. Venda URGENTE ou reprecificação agressiva agora!`,
            severity: 'BLOQUEIO',
            actionLabel: 'Ver Estoque',
            actionTarget: 'stock',
            timestamp: today()
        });
    }

    if (atencao.length > 0) {
        const kgTotal = atencao.reduce((s, i) => s + i.peso_entrada, 0);
        alerts.push({
            triggerId: `camara-atencao-${today().toDateString()}`,
            agentId: 'ESTOQUE',
            agentName: 'Joaquim',
            agentEmoji: '📦',
            title: `🟡 ${atencao.length} peças com 6-7 dias — priorizar saída`,
            message: `${kgTotal.toFixed(1)}kg aproximando do prazo limite. Marcos deve ligar para clientes VIP hoje.`,
            severity: 'ALERTA',
            actionLabel: 'Ver Estoque',
            actionTarget: 'stock',
            timestamp: today()
        });
    }

    return alerts;
};

// ─── TRIGGER 2: COBRANÇA AUTOMÁTICA (Diana) ────────────────────
// Detecta vendas vencidas hoje, ontem ou há mais de 2 dias
const triggerCobranca = (ctx: TriggerContext): AutoTriggerResult[] => {
    const alerts: AutoTriggerResult[] = [];
    const pendentes = ctx.sales.filter(s => s.status_pagamento === 'PENDENTE' && s.prazo_dias > 0);

    const vencidasHoje = pendentes.filter(s => {
        const diasVenc = daysDiff(s.data_vencimento);
        return diasVenc >= 0 && diasVenc <= 1;
    });

    const vencidasAtrasadas = pendentes.filter(s => {
        const diasVenc = daysDiff(s.data_vencimento);
        return diasVenc > 1;
    });

    if (vencidasHoje.length > 0) {
        const total = vencidasHoje.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
        alerts.push({
            triggerId: `cobranca-hoje-${today().toDateString()}`,
            agentId: 'COBRANCA',
            agentName: 'Diana',
            agentEmoji: '💰',
            title: `💰 ${vencidasHoje.length} cobranças vencem hoje!`,
            message: `Total a receber hoje: ${R$(total)}. Enviar WhatsApp automático de lembrete para os clientes agora.`,
            severity: 'ALERTA',
            actionLabel: 'Ver Pendências',
            actionTarget: 'clients',
            timestamp: today()
        });
    }

    if (vencidasAtrasadas.length > 0) {
        const total = vencidasAtrasadas.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
        const maxAtraso = Math.max(...vencidasAtrasadas.map(v => daysDiff(v.data_vencimento)));
        alerts.push({
            triggerId: `cobranca-atrasada-${today().toDateString()}`,
            agentId: 'COBRANCA',
            agentName: 'Diana',
            agentEmoji: '💰',
            title: `🔴 ${vencidasAtrasadas.length} vendas em atraso (máx: ${maxAtraso} dias)`,
            message: `${R$(total)} em atraso. Risco de inadimplência. Dra. Beatriz recomenda bloqueio de crédito para clientes com >5 dias de atraso.`,
            severity: 'CRITICO',
            actionLabel: 'Cobrar Agora',
            actionTarget: 'clients',
            timestamp: today()
        });
    }

    return alerts;
};

// ─── TRIGGER 3: SENTINELA DO CAIXA (Mateus) ────────────────────
// Alerta se o saldo cair abaixo do limite de segurança
const triggerCaixa = (ctx: TriggerContext): AutoTriggerResult[] => {
    const alerts: AutoTriggerResult[] = [];

    const entradas = ctx.transactions.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
    const saidas = ctx.transactions.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
    const saldo = entradas - saidas;

    // Calcula custo de 1 lote médio
    const lotesRecentes = ctx.batches.filter(b => b.status === 'ABERTO').slice(0, 3);
    const custoMedioLote = lotesRecentes.length > 0
        ? lotesRecentes.reduce((s, b) => s + b.valor_compra_total, 0) / lotesRecentes.length
        : 10000;
    const limiteMinimo = custoMedioLote * 1.5; // 1.5x custo de 1 lote

    // Payables vencendo nos próximos 7 dias
    const payablesProximos = ctx.payables.filter(p => {
        const dias = daysDiff(p.data_vencimento);
        return dias >= -7 && dias <= 0 && p.status === 'PENDENTE';
    });
    const totalPayables = payablesProximos.reduce((s, p) => s + p.valor, 0);

    if (saldo < 5000) {
        alerts.push({
            triggerId: `caixa-emergencia-${today().toDateString()}`,
            agentId: 'FLUXO_CAIXA',
            agentName: 'Mateus',
            agentEmoji: '💵',
            title: `🔴 EMERGÊNCIA: Caixa em ${R$(saldo)}!`,
            message: `Saldo crítico! Abaixo de R$5.000 não é possível pagar fornecedor. Cobranças urgentes e corte de gastos imediatamente.`,
            severity: 'BLOQUEIO',
            actionLabel: 'Ver Financeiro',
            actionTarget: 'transactions',
            timestamp: today()
        });
    } else if (saldo < limiteMinimo) {
        alerts.push({
            triggerId: `caixa-atencao-${today().toDateString()}`,
            agentId: 'FLUXO_CAIXA',
            agentName: 'Mateus',
            agentEmoji: '💵',
            title: `🟡 Caixa abaixo do mínimo seguro`,
            message: `Saldo atual: ${R$(saldo)}. Limite recomendado: ${R$(limiteMinimo)} (1.5x custo de 1 lote). ${payablesProximos.length > 0 ? `Atenção: ${R$(totalPayables)} em contas a pagar nos próximos 7 dias.` : ''}`,
            severity: 'ALERTA',
            actionLabel: 'Ver Caixa',
            actionTarget: 'transactions',
            timestamp: today()
        });
    }

    return alerts;
};

// ─── TRIGGER 4: CLIENTES ESFRIANDO (Marcos) ────────────────────
// Detecta clientes VIP que não compram há >14 dias
const triggerClientesSumindo = (ctx: TriggerContext): AutoTriggerResult[] => {
    const alerts: AutoTriggerResult[] = [];

    const clientesAtivos = ctx.clients.filter(c => c.status !== 'INATIVO');
    const clientesSumindo: { nome: string; diasSemCompra: number; limiteCredito: number }[] = [];

    for (const cliente of clientesAtivos) {
        const vendasCliente = ctx.sales.filter(s => s.id_cliente === cliente.id_ferro);
        if (vendasCliente.length === 0) continue;

        const ultimaVenda = vendasCliente.sort((a, b) =>
            new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime()
        )[0];

        const diasSemCompra = daysDiff(ultimaVenda.data_venda);
        const isVIP = cliente.limite_credito >= 5000;
        const limiteParaAlerta = isVIP ? 10 : 20;

        if (diasSemCompra >= limiteParaAlerta) {
            clientesSumindo.push({
                nome: cliente.nome_social,
                diasSemCompra,
                limiteCredito: cliente.limite_credito
            });
        }
    }

    // Ordena pelos VIPs primeiro
    clientesSumindo.sort((a, b) => b.limiteCredito - a.limiteCredito);

    if (clientesSumindo.length > 0) {
        const top3 = clientesSumindo.slice(0, 3);
        const nomes = top3.map(c => `${c.nome} (${c.diasSemCompra}d)`).join(', ');
        alerts.push({
            triggerId: `clientes-sumindo-${today().toDateString()}`,
            agentId: 'COMERCIAL',
            agentName: 'Marcos',
            agentEmoji: '🤝',
            title: `🟡 ${clientesSumindo.length} clientes sem comprar recentemente`,
            message: `Risco de churn! Principais: ${nomes}. Ligar hoje com oferta especial antes de perder para o concorrente.`,
            severity: 'ALERTA',
            actionLabel: 'Ver Clientes',
            actionTarget: 'clients',
            timestamp: today()
        });
    }

    return alerts;
};

// ─── TRIGGER 5: BRIEFING MATINAL (Dona Clara) ──────────────────
// Sempre roda 1x por dia — visão geral do dia
const triggerBriefingMatinal = (ctx: TriggerContext): AutoTriggerResult[] => {
    const estoqueDisp = ctx.stock.filter(s => s.status === 'DISPONIVEL');
    const kgDisp = estoqueDisp.reduce((s, i) => s + i.peso_entrada, 0);
    const vendaHoje = ctx.sales.filter(s => {
        const d = new Date(s.data_venda);
        const t = new Date();
        return d.toDateString() === t.toDateString();
    });
    const faturamentoHoje = vendaHoje.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);

    const pedidosHoje = ctx.scheduledOrders.filter(o => {
        const d = new Date(o.data_entrega);
        const t = new Date();
        return d.toDateString() === t.toDateString() && o.status === 'ABERTO';
    });

    const entradas = ctx.transactions.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
    const saidas = ctx.transactions.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
    const saldo = entradas - saidas;

    return [{
        triggerId: `briefing-${new Date().toDateString()}`,
        agentId: 'ADMINISTRATIVO',
        agentName: 'Dona Clara',
        agentEmoji: '🧠',
        title: `☀️ Bom dia! Briefing ${new Date().toLocaleDateString('pt-BR')}`,
        message: `💰 Caixa: ${R$(saldo)} | 📦 Estoque: ${kgDisp.toFixed(0)}kg disponível | 🛒 Vendas hoje: ${vendaHoje.length} (${R$(faturamentoHoje)}) | 📋 Entregas agendadas: ${pedidosHoje.length}`,
        severity: 'INFO',
        actionLabel: 'Ver Dashboard',
        actionTarget: 'dashboard',
        timestamp: today()
    }];
};

// ─── TRIGGER 6: CONTAS A PAGAR VENCENDO (Ana Luiza) ────────────
const triggerContasPagar = (ctx: TriggerContext): AutoTriggerResult[] => {
    const vencendo = ctx.payables.filter(p => {
        const dias = daysDiff(p.data_vencimento);
        return dias >= -3 && dias <= 0 && p.status === 'PENDENTE';
    });

    if (vencendo.length === 0) return [];

    const total = vencendo.reduce((s, p) => s + p.valor, 0);
    const vencidas = vencendo.filter(p => daysDiff(p.data_vencimento) >= 0);

    return [{
        triggerId: `contas-pagar-${today().toDateString()}`,
        agentId: 'AUDITOR',
        agentName: 'Ana Luiza',
        agentEmoji: '🔍',
        title: `${vencidas.length > 0 ? '🔴' : '🟡'} ${vencendo.length} contas a pagar ${vencidas.length > 0 ? 'vencidas!' : 'vencendo em breve'}`,
        message: `Total: ${R$(total)}. ${vencidas.length > 0 ? `${vencidas.length} já vencidas — juros correndo!` : 'Vencimento nos próximos 3 dias.'}`,
        severity: vencidas.length > 0 ? 'CRITICO' : 'ALERTA',
        actionLabel: 'Ver Contas',
        actionTarget: 'payables',
        timestamp: today()
    }];
};

// ═══════════════════════════════════════════════════════════════
// ENGINE PRINCIPAL — roda todos os triggers e retorna alertas
// ═══════════════════════════════════════════════════════════════
export const runAutoTriggers = (ctx: TriggerContext): AutoTriggerResult[] => {
    const results: AutoTriggerResult[] = [];

    try { results.push(...triggerBriefingMatinal(ctx)); } catch (e) { console.error('[AIOS] Briefing falhou:', e); }
    try { results.push(...triggerCamaraFria(ctx)); } catch (e) { console.error('[AIOS] Câmara falhou:', e); }
    try { results.push(...triggerCobranca(ctx)); } catch (e) { console.error('[AIOS] Cobrança falhou:', e); }
    try { results.push(...triggerCaixa(ctx)); } catch (e) { console.error('[AIOS] Caixa falhou:', e); }
    try { results.push(...triggerClientesSumindo(ctx)); } catch (e) { console.error('[AIOS] Clientes falhou:', e); }
    try { results.push(...triggerContasPagar(ctx)); } catch (e) { console.error('[AIOS] Contas falhou:', e); }

    // Ordenar por severidade: BLOQUEIO > CRITICO > ALERTA > INFO
    const ordem: Record<string, number> = { BLOQUEIO: 0, CRITICO: 1, ALERTA: 2, INFO: 3 };
    results.sort((a, b) => (ordem[a.severity] ?? 3) - (ordem[b.severity] ?? 3));

    return results;
};

// Chave para controle de "briefing já mostrado hoje"
export const AIOS_BRIEFING_KEY = 'aios_briefing_date';
export const shouldShowBriefingToday = (): boolean => {
    const last = localStorage.getItem(AIOS_BRIEFING_KEY);
    const today = new Date().toDateString();
    return last !== today;
};
export const markBriefingShownToday = () => {
    localStorage.setItem(AIOS_BRIEFING_KEY, new Date().toDateString());
};
