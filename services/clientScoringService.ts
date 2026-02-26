// ═══ CLIENT RFM SCORING — FASE 8 ═══
// Classificação automática: Recency, Frequency, Monetary
// Inspirado em: HubSpot Lead Scoring, RD Station, Salesforce Einstein

import { Client, Sale } from '../types';

export type ClientTier = 'OURO' | 'PRATA' | 'BRONZE' | 'RISCO' | 'NOVO' | 'INATIVO';

export interface ClientScore {
    id_ferro: string;
    nome: string;
    tier: ClientTier;
    tierEmoji: string;
    tierColor: string;
    // RFM Components
    recency: number;    // Dias desde última compra
    frequency: number;  // Nº de compras nos últimos 90 dias
    monetary: number;   // Total gasto nos últimos 90 dias (R$)
    // Scores 1-5
    recencyScore: number;
    frequencyScore: number;
    monetaryScore: number;
    totalScore: number; // 3-15
    // Business metrics
    ticketMedio: number;
    kgTotal: number;
    saldoDevedor: number;
    risco: boolean;
    recomendacao: string;
}

const TIER_CONFIG: Record<ClientTier, { emoji: string; color: string; bgColor: string }> = {
    OURO:    { emoji: '🥇', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    PRATA:   { emoji: '🥈', color: 'text-slate-500', bgColor: 'bg-slate-50' },
    BRONZE:  { emoji: '🥉', color: 'text-orange-600', bgColor: 'bg-orange-50' },
    RISCO:   { emoji: '⚠️', color: 'text-rose-600', bgColor: 'bg-rose-50' },
    NOVO:    { emoji: '🆕', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    INATIVO: { emoji: '💤', color: 'text-gray-400', bgColor: 'bg-gray-50' },
};

export function calculateClientScores(clients: Client[], sales: Sale[]): ClientScore[] {
    const now = new Date();
    const msDay = 86400000;
    const validSales = sales.filter(s => s.status_pagamento !== 'ESTORNADO');

    return clients
        .filter(c => c.status !== 'INATIVO')
        .map(client => {
            const clientSales = validSales.filter(s => s.id_cliente === client.id_ferro);
            const sales90d = clientSales.filter(s => (now.getTime() - new Date(s.data_venda).getTime()) / msDay <= 90);

            // Recency
            let recency = 999;
            if (clientSales.length > 0) {
                const ultimaVenda = clientSales.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                recency = Math.floor((now.getTime() - new Date(ultimaVenda.data_venda).getTime()) / msDay);
            }

            // Frequency (90d)
            const frequency = sales90d.length;

            // Monetary (90d)
            const monetary = sales90d.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);

            // Score 1-5 each
            const recencyScore = recency <= 7 ? 5 : recency <= 15 ? 4 : recency <= 30 ? 3 : recency <= 60 ? 2 : 1;
            const frequencyScore = frequency >= 8 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 1 ? 2 : 1;
            const monetaryScore = monetary >= 10000 ? 5 : monetary >= 5000 ? 4 : monetary >= 2000 ? 3 : monetary >= 500 ? 2 : 1;
            const totalScore = recencyScore + frequencyScore + monetaryScore;

            // Ticket médio e kg
            const ticketMedio = sales90d.length > 0 ? monetary / sales90d.length : 0;
            const kgTotal = sales90d.reduce((s, v) => s + v.peso_real_saida, 0);

            // Tier classification
            let tier: ClientTier;
            let recomendacao: string;

            if (clientSales.length === 0) {
                tier = 'NOVO';
                recomendacao = 'Enviar boas-vindas + catálogo. Oferecer condição especial na 1ª compra.';
            } else if (client.saldo_devedor > 0 && recency > 30) {
                tier = 'RISCO';
                recomendacao = `Cobrar R$${client.saldo_devedor.toFixed(0)} URGENTE. Só vender à vista até regularizar.`;
            } else if (recency > 60) {
                tier = 'INATIVO';
                recomendacao = 'Campanha de reativação. Ligar pessoalmente. Oferta especial para voltar.';
            } else if (totalScore >= 12) {
                tier = 'OURO';
                recomendacao = 'VIP! Prazo estendido, prioridade na entrega, mimo mensal (desconto ou brinde).';
            } else if (totalScore >= 8) {
                tier = 'PRATA';
                recomendacao = 'Bom cliente. Manter relacionamento, oferecer variedade de cortes, prazo padrão.';
            } else {
                tier = 'BRONZE';
                recomendacao = 'Esporádico. Enviar promoções semanais, tentar aumentar frequência.';
            }

            const risco = client.saldo_devedor > 0 && recency > 30;
            const config = TIER_CONFIG[tier];

            return {
                id_ferro: client.id_ferro,
                nome: client.nome_social,
                tier,
                tierEmoji: config.emoji,
                tierColor: config.color,
                recency,
                frequency,
                monetary,
                recencyScore,
                frequencyScore,
                monetaryScore,
                totalScore,
                ticketMedio,
                kgTotal,
                saldoDevedor: client.saldo_devedor,
                risco,
                recomendacao,
            };
        })
        .sort((a, b) => b.totalScore - a.totalScore);
}

// ═══ RESUMO POR TIER ═══
export function getClientTierSummary(scores: ClientScore[]): Record<ClientTier, number> {
    const summary: Record<ClientTier, number> = { OURO: 0, PRATA: 0, BRONZE: 0, RISCO: 0, NOVO: 0, INATIVO: 0 };
    scores.forEach(s => summary[s.tier]++);
    return summary;
}

// ═══ FORMATAR PARA PROMPT ═══
export function formatRFMForPrompt(scores: ClientScore[]): string {
    const summary = getClientTierSummary(scores);
    const riscos = scores.filter(s => s.tier === 'RISCO');
    const ouros = scores.filter(s => s.tier === 'OURO');
    const inativos = scores.filter(s => s.tier === 'INATIVO');

    return `
═══ 👥 SCORING DE CLIENTES (RFM) ═══
Distribuição: 🥇 ${summary.OURO} Ouro | 🥈 ${summary.PRATA} Prata | 🥉 ${summary.BRONZE} Bronze | ⚠️ ${summary.RISCO} Risco | 🆕 ${summary.NOVO} Novo | 💤 ${summary.INATIVO} Inativo

${ouros.length > 0 ? `🥇 TOP CLIENTES OURO:\n${ouros.slice(0, 3).map(c => `  ${c.nome} — R$${c.monetary.toFixed(0)} (90d) — ${c.frequency} compras — Ticket R$${c.ticketMedio.toFixed(0)}`).join('\n')}` : ''}

${riscos.length > 0 ? `⚠️ CLIENTES EM RISCO:\n${riscos.map(c => `  ${c.nome} — Devendo R$${c.saldoDevedor.toFixed(0)} — Inativo há ${c.recency}d — ${c.recomendacao}`).join('\n')}` : ''}

${inativos.length > 0 ? `💤 INATIVOS (reativação urgente):\n${inativos.slice(0, 3).map(c => `  ${c.nome} — Última compra há ${c.recency}d`).join('\n')}` : ''}`;
}
