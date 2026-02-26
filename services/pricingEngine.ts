// ═══ MOTOR DE PRECIFICAÇÃO INTELIGENTE — FASE 7 ═══
// Precificação dinâmica por idade da carne, markup por corte, proteção de margem
// Inspirado em: Revenue Management (hotelaria/aviação), Markdown Optimization (varejo)

import { StockItem, Sale, Batch } from '../types';

// ═══ TABELA DE DESCONTO POR IDADE (Carne resfriada MAX 8 dias) ═══
export const DESCONTO_POR_IDADE: Record<number, { desconto: number; label: string; emoji: string; urgencia: string }> = {
    0: { desconto: 0, label: 'Fresquíssima', emoji: '🟢', urgencia: 'NORMAL' },
    1: { desconto: 0, label: 'Premium', emoji: '🟢', urgencia: 'NORMAL' },
    2: { desconto: 0, label: 'Premium', emoji: '🟢', urgencia: 'NORMAL' },
    3: { desconto: 0, label: 'Fresca', emoji: '🟢', urgencia: 'NORMAL' },
    4: { desconto: 0.03, label: 'Boa', emoji: '🟡', urgencia: 'ATENÇÃO' },
    5: { desconto: 0.05, label: 'Promoção', emoji: '🟡', urgencia: 'ATENÇÃO' },
    6: { desconto: 0.10, label: 'Desconto 10%', emoji: '🟠', urgencia: 'URGENTE' },
    7: { desconto: 0.20, label: 'Liquidação', emoji: '🔴', urgencia: 'CRÍTICO' },
    8: { desconto: 0.30, label: 'VENDER HOJE', emoji: '🔴', urgencia: 'EMERGÊNCIA' },
};

// ═══ MARKUP POR TIPO DE CORTE ═══
export const MARKUP_POR_TIPO: Record<number, { markup: number; nome: string }> = {
    1: { markup: 1.30, nome: 'Inteiro' },       // 30% markup base
    2: { markup: 1.25, nome: 'Banda A (Dianteiro)' }, // 25% (mais barato, mais volume)
    3: { markup: 1.35, nome: 'Banda B (Traseiro)' },  // 35% (cortes nobres)
};

export interface PrecificacaoItem {
    id_completo: string;
    id_lote: string;
    tipo: number;
    tipoNome: string;
    pesoKg: number;
    diasNaCamara: number;
    custoRealKg: number;
    precoSugerido: number;
    precoMinimo: number; // Nunca abaixo do custo + 5%
    descontoAplicado: number;
    margemEstimada: number;
    urgencia: string;
    emoji: string;
    label: string;
}

export function calcularPrecificacao(
    stock: StockItem[],
    batches: Batch[],
    sales: Sale[]
): PrecificacaoItem[] {
    const now = new Date();
    const msDay = 86400000;
    const disponivel = stock.filter(s => s.status === 'DISPONIVEL');

    // Preço médio de venda recente como referência
    const vendasRecentes = sales
        .filter(s => s.status_pagamento !== 'ESTORNADO')
        .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())
        .slice(0, 20);
    const precoMedioVenda = vendasRecentes.length > 0
        ? vendasRecentes.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasRecentes.length
        : 25;

    return disponivel.map(item => {
        const dias = Math.floor((now.getTime() - new Date(item.data_entrada).getTime()) / msDay);
        const diasClamped = Math.min(dias, 8);
        const batch = batches.find(b => b.id_lote === item.id_lote);
        const custoKg = batch?.custo_real_kg || 0;
        const markup = MARKUP_POR_TIPO[item.tipo] || MARKUP_POR_TIPO[1];
        const desc = DESCONTO_POR_IDADE[diasClamped] || DESCONTO_POR_IDADE[8];

        // Preço base = MAX(custo com markup, preço médio de mercado)
        const precoBase = Math.max(custoKg * markup.markup, precoMedioVenda);
        const precoComDesconto = precoBase * (1 - desc.desconto);
        const precoMinimo = custoKg * 1.05; // Nunca abaixo de custo + 5%
        const precoFinal = Math.max(precoComDesconto, precoMinimo);
        const margem = custoKg > 0 ? ((precoFinal - custoKg) / precoFinal) * 100 : 0;

        return {
            id_completo: item.id_completo,
            id_lote: item.id_lote,
            tipo: item.tipo,
            tipoNome: markup.nome,
            pesoKg: item.peso_entrada,
            diasNaCamara: dias,
            custoRealKg: custoKg,
            precoSugerido: Math.round(precoFinal * 100) / 100,
            precoMinimo: Math.round(precoMinimo * 100) / 100,
            descontoAplicado: desc.desconto * 100,
            margemEstimada: Math.round(margem * 10) / 10,
            urgencia: desc.urgencia,
            emoji: desc.emoji,
            label: desc.label,
        };
    }).sort((a, b) => b.diasNaCamara - a.diasNaCamara); // FIFO: mais antigos primeiro
}

// ═══ FORMATAR PARA PROMPT ═══
export function formatPrecificacaoForPrompt(items: PrecificacaoItem[]): string {
    if (items.length === 0) return '';
    const urgentes = items.filter(i => i.diasNaCamara >= 6);
    const normais = items.filter(i => i.diasNaCamara < 6);
    return `
═══ 💲 PRECIFICAÇÃO INTELIGENTE ═══
${urgentes.length > 0 ? `
🔴 PEÇAS URGENTES (6+ dias):
${urgentes.map(i => `  ${i.emoji} ${i.tipoNome} (${i.id_completo}) — ${i.pesoKg.toFixed(1)}kg — ${i.diasNaCamara}d — R$${i.precoSugerido.toFixed(2)}/kg (⬇${i.descontoAplicado.toFixed(0)}%) — Margem: ${i.margemEstimada}%`).join('\n')}` : ''}

📦 Estoque total: ${items.length} peças | ${items.reduce((s, i) => s + i.pesoKg, 0).toFixed(0)}kg
🟢 Normais: ${normais.length} | 🔴 Urgentes: ${urgentes.length}
💲 Preço médio sugerido: R$${(items.reduce((s, i) => s + i.precoSugerido, 0) / items.length).toFixed(2)}/kg`;
}
