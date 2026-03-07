/**
 * ═══════════════════════════════════════════════════════════════
 * CAMPAIGN LEARNING SERVICE — FrigoGest 2026 (Fase 2)
 * ═══════════════════════════════════════════════════════════════
 * Analisa os resultados de campanha marcados pelo dono (resultado_campanha)
 * e extrai padrões reais de conversão para alimentar Isabela, Marcos e Camila.
 *
 * FONTE DE DADOS: sales.resultado_campanha (marcado manualmente pelo dono)
 * CONSUMIDORES: dataPackets MARKETING, COMERCIAL, SATISFACAO
 */

import { Sale, Client } from '../types';

export type ResultadoCampanha = 'COMPROU' | 'RESPONDEU' | 'IGNOROU' | 'NUMERO_ERRADO';

export interface ConversionPattern {
    // Taxas gerais
    totalComResultado: number;
    taxaConversao: number;        // % que comprou
    taxaResposta: number;         // % que respondeu (comprou + respondeu)
    taxaIgnorou: number;          // % que ignorou
    taxaNumeroErrado: number;     // % com número errado

    // Por tier RFM
    porTier: Record<string, {
        total: number;
        comprou: number;
        respondeu: number;
        ignorou: number;
        taxaConversao: number;
    }>;

    // Por dia da semana (0=Dom, 1=Seg... 6=Sab)
    porDiaSemana: Record<number, {
        label: string;
        total: number;
        comprou: number;
        taxaConversao: number;
    }>;

    // Por período do mês
    porPeriodoMes: {
        inicio: { total: number; comprou: number; taxa: number };  // dias 1-10
        meio:   { total: number; comprou: number; taxa: number };  // dias 11-20
        fim:    { total: number; comprou: number; taxa: number };  // dias 21-31
    };

    // Melhores horários (se data_venda tiver hora)
    melhorDiaSemana: string;
    melhorPeriodoMes: string;

    // Clientes que nunca respondem (bloquear para não gastar tempo)
    clientesRefratarios: Array<{
        id_ferro: string;
        nome: string;
        tentativas: number;
        ultimaTentativa: string;
    }>;

    // Insight principal para o agente
    insightPrincipal: string;
    recomendacaoTom: string;
}

export interface NPSPendente {
    id_venda: string;
    id_cliente: string;
    nome_cliente: string;
    whatsapp?: string;
    entrega_confirmada_em: string;
    horas_desde_entrega: number;
    valor_venda: number;
    // Sinaliza urgência: >48h = muito tarde, <2h = cedo demais
    janela: 'IDEAL' | 'CEDO' | 'TARDE' | 'EXPIRADO';
}

const DIA_SEMANA_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Analisa os resultados de campanha e extrai padrões de conversão.
 * Retorna null se não há dados suficientes (< 5 resultados marcados).
 */
export function analyzeCampaignResults(
    sales: Sale[],
    clients: Client[]
): ConversionPattern | null {
    const comResultado = sales.filter(s =>
        s.resultado_campanha != null && s.status_pagamento !== 'ESTORNADO'
    );

    if (comResultado.length < 5) return null; // Não tem dados suficientes ainda

    const total = comResultado.length;
    const comprou = comResultado.filter(s => s.resultado_campanha === 'COMPROU').length;
    const respondeu = comResultado.filter(s => s.resultado_campanha === 'RESPONDEU').length;
    const ignorou = comResultado.filter(s => s.resultado_campanha === 'IGNOROU').length;
    const errado = comResultado.filter(s => s.resultado_campanha === 'NUMERO_ERRADO').length;

    // ── Por tier RFM (aproximado: usa recência da última compra) ──
    const now = new Date();
    const msDay = 86400000;
    const porTier: ConversionPattern['porTier'] = {};

    comResultado.forEach(s => {
        const client = clients.find(c => c.id_ferro === s.id_cliente);
        const clientSales = sales.filter(v => v.id_cliente === s.id_cliente && v.status_pagamento !== 'ESTORNADO');
        const lastSale = clientSales.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
        const diasRecencia = lastSale ? Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / msDay) : 999;

        const tier = diasRecencia <= 10 ? 'VIP' : diasRecencia <= 30 ? 'Ativo' : diasRecencia <= 60 ? 'Esfriando' : 'Em Risco';

        if (!porTier[tier]) porTier[tier] = { total: 0, comprou: 0, respondeu: 0, ignorou: 0, taxaConversao: 0 };
        porTier[tier].total++;
        if (s.resultado_campanha === 'COMPROU') porTier[tier].comprou++;
        if (s.resultado_campanha === 'RESPONDEU') porTier[tier].respondeu++;
        if (s.resultado_campanha === 'IGNOROU') porTier[tier].ignorou++;
    });

    Object.keys(porTier).forEach(tier => {
        porTier[tier].taxaConversao = porTier[tier].total > 0
            ? Math.round((porTier[tier].comprou / porTier[tier].total) * 100)
            : 0;
    });

    // ── Por dia da semana ──
    const porDiaSemana: ConversionPattern['porDiaSemana'] = {};
    comResultado.forEach(s => {
        const dia = new Date(s.data_venda).getDay();
        if (!porDiaSemana[dia]) porDiaSemana[dia] = { label: DIA_SEMANA_LABELS[dia], total: 0, comprou: 0, taxaConversao: 0 };
        porDiaSemana[dia].total++;
        if (s.resultado_campanha === 'COMPROU') porDiaSemana[dia].comprou++;
    });
    Object.keys(porDiaSemana).forEach(d => {
        const dia = parseInt(d);
        porDiaSemana[dia].taxaConversao = porDiaSemana[dia].total > 0
            ? Math.round((porDiaSemana[dia].comprou / porDiaSemana[dia].total) * 100)
            : 0;
    });

    const melhorDia = Object.entries(porDiaSemana)
        .sort((a, b) => b[1].taxaConversao - a[1].taxaConversao)[0];
    const melhorDiaSemana = melhorDia
        ? `${melhorDia[1].label} (${melhorDia[1].taxaConversao}% conversão)`
        : 'Dados insuficientes';

    // ── Por período do mês ──
    const periodos = { inicio: { total: 0, comprou: 0, taxa: 0 }, meio: { total: 0, comprou: 0, taxa: 0 }, fim: { total: 0, comprou: 0, taxa: 0 } };
    comResultado.forEach(s => {
        const dia = new Date(s.data_venda).getDate();
        const periodo = dia <= 10 ? 'inicio' : dia <= 20 ? 'meio' : 'fim';
        periodos[periodo].total++;
        if (s.resultado_campanha === 'COMPROU') periodos[periodo].comprou++;
    });
    Object.keys(periodos).forEach(p => {
        const k = p as keyof typeof periodos;
        periodos[k].taxa = periodos[k].total > 0 ? Math.round((periodos[k].comprou / periodos[k].total) * 100) : 0;
    });

    const melhorPeriodoMes = [
        { label: 'início do mês (dias 1-10)', taxa: periodos.inicio.taxa },
        { label: 'meio do mês (dias 11-20)', taxa: periodos.meio.taxa },
        { label: 'final do mês (dias 21-31)', taxa: periodos.fim.taxa },
    ].sort((a, b) => b.taxa - a.taxa)[0]?.label || 'Dados insuficientes';

    // ── Clientes refratários (3+ IGNOROU sem nenhum COMPROU) ──
    const clienteStats = new Map<string, { ignorou: number; comprou: number; ultima: string; nome: string }>();
    comResultado.forEach(s => {
        if (!clienteStats.has(s.id_cliente)) {
            const cli = clients.find(c => c.id_ferro === s.id_cliente);
            clienteStats.set(s.id_cliente, { ignorou: 0, comprou: 0, ultima: s.data_venda, nome: cli?.nome_social || s.id_cliente });
        }
        const stat = clienteStats.get(s.id_cliente)!;
        if (s.resultado_campanha === 'IGNOROU') stat.ignorou++;
        if (s.resultado_campanha === 'COMPROU') stat.comprou++;
        if (new Date(s.data_venda) > new Date(stat.ultima)) stat.ultima = s.data_venda;
    });

    const clientesRefratarios = Array.from(clienteStats.entries())
        .filter(([, stat]) => stat.ignorou >= 3 && stat.comprou === 0)
        .map(([id, stat]) => ({
            id_ferro: id,
            nome: stat.nome,
            tentativas: stat.ignorou,
            ultimaTentativa: new Date(stat.ultima).toLocaleDateString('pt-BR'),
        }))
        .sort((a, b) => b.tentativas - a.tentativas);

    // ── Insight e recomendação ──
    const taxaConversao = Math.round((comprou / total) * 100);
    const taxaResposta = Math.round(((comprou + respondeu) / total) * 100);

    let insightPrincipal = '';
    if (taxaConversao >= 40) insightPrincipal = `✅ Excelente! ${taxaConversao}% das abordagens viram compra. Escale a estratégia atual.`;
    else if (taxaConversao >= 25) insightPrincipal = `🟡 ${taxaConversao}% conversão — acima da média B2B (20%). Refinar tom para VIPs.`;
    else if (taxaConversao >= 15) insightPrincipal = `🟠 ${taxaConversao}% conversão — abaixo do potencial. Testar copy com escassez real.`;
    else insightPrincipal = `🔴 ${taxaConversao}% conversão — crítico. Revisar lista, limpar números errados, mudar abordagem.`;

    let recomendacaoTom = '';
    const tierVIP = porTier['VIP'];
    const tierEmRisco = porTier['Em Risco'];
    if (tierVIP && tierVIP.taxaConversao > 50) recomendacaoTom = 'VIPs respondem bem — priorizar reativação deles. Tom: parceiro íntimo.';
    else if (tierEmRisco && tierEmRisco.taxaConversao < 10) recomendacaoTom = 'Clientes "Em Risco" quase não convertem — parar de insistir após 3 tentativas.';
    else recomendacaoTom = 'Foco em "Esfriando" (30-60d) — janela de recuperação antes de virar inativo.';

    return {
        totalComResultado: total,
        taxaConversao,
        taxaResposta,
        taxaIgnorou: Math.round((ignorou / total) * 100),
        taxaNumeroErrado: Math.round((errado / total) * 100),
        porTier,
        porDiaSemana,
        porPeriodoMes: periodos,
        melhorDiaSemana,
        melhorPeriodoMes,
        clientesRefratarios,
        insightPrincipal,
        recomendacaoTom,
    };
}

/**
 * Formata o padrão de conversão para injetar no prompt dos agentes.
 */
export function formatCampaignLearningForAgent(pattern: ConversionPattern | null): string {
    if (!pattern) {
        return `\n\n📊 APRENDIZADO DE CAMPANHAS:
Nenhum resultado registrado ainda. Use o campo 📊 no histórico de vendas para aprender.
Instrução: após enviar uma mensagem WhatsApp para um cliente, marque o resultado na venda correspondente.`;
    }

    const tierLines = Object.entries(pattern.porTier)
        .sort((a, b) => b[1].taxaConversao - a[1].taxaConversao)
        .map(([tier, data]) => `  ${tier}: ${data.taxaConversao}% conversão (${data.comprou}/${data.total} abordagens)`)
        .join('\n');

    const refratariosLines = pattern.clientesRefratarios.slice(0, 3)
        .map(c => `  ⛔ ${c.nome} — ${c.tentativas}x ignorou, nunca comprou. Pausar abordagem.`)
        .join('\n');

    return `\n\n📊 INTELIGÊNCIA DE CAMPANHAS (${pattern.totalComResultado} abordagens analisadas):
${pattern.insightPrincipal}
Recomendação de tom: ${pattern.recomendacaoTom}

TAXAS REAIS:
  ✅ Comprou: ${pattern.taxaConversao}% | 💬 Respondeu: ${pattern.taxaResposta - pattern.taxaConversao}% | 👻 Ignorou: ${pattern.taxaIgnorou}% | ❌ Nº errado: ${pattern.taxaNumeroErrado}%

CONVERSÃO POR SEGMENTO RFM:
${tierLines || '  Dados insuficientes por segmento'}

MELHOR MOMENTO PARA ABORDAR:
  📅 Dia da semana: ${pattern.melhorDiaSemana}
  📆 Período do mês: ${pattern.melhorPeriodoMes}

${pattern.clientesRefratarios.length > 0 ? `CLIENTES REFRATÁRIOS (parar de abordar):\n${refratariosLines}` : '✅ Nenhum cliente refratário identificado ainda'}`;
}

/**
 * Detecta vendas com entrega confirmada que ainda não receberam NPS.
 * Janela ideal: 4-24h após confirmação.
 */
export function detectNPSPendente(
    sales: Sale[],
    clients: Client[]
): NPSPendente[] {
    const now = new Date();

    return sales
        .filter(s =>
            s.entrega_confirmada_em &&
            s.status_pagamento !== 'ESTORNADO' &&
            !(s as any).nps_enviado_em // campo futuro — enquanto não existe, sempre aparece
        )
        .map(s => {
            const entregaDate = new Date(s.entrega_confirmada_em!);
            const horasDesde = Math.floor((now.getTime() - entregaDate.getTime()) / 3600000);
            const client = clients.find(c => c.id_ferro === s.id_cliente);

            let janela: NPSPendente['janela'];
            if (horasDesde < 2) janela = 'CEDO';
            else if (horasDesde <= 24) janela = 'IDEAL';
            else if (horasDesde <= 48) janela = 'TARDE';
            else janela = 'EXPIRADO';

            return {
                id_venda: s.id_venda,
                id_cliente: s.id_cliente,
                nome_cliente: client?.nome_social || s.id_cliente,
                whatsapp: client?.whatsapp,
                entrega_confirmada_em: s.entrega_confirmada_em!,
                horas_desde_entrega: horasDesde,
                valor_venda: s.peso_real_saida * s.preco_venda_kg,
                janela,
            };
        })
        .filter(n => n.janela !== 'EXPIRADO') // Mais de 48h = muito tarde
        .sort((a, b) => {
            // Prioridade: IDEAL > TARDE > CEDO
            const ordem = { IDEAL: 0, TARDE: 1, CEDO: 2, EXPIRADO: 3 };
            return ordem[a.janela] - ordem[b.janela];
        });
}

/**
 * Formata os NPS pendentes para o dataPacket da Camila.
 */
export function formatNPSPendenteForAgent(pendentes: NPSPendente[]): string {
    if (pendentes.length === 0) {
        return `\n\n📬 NPS PENDENTES:\nNenhuma entrega confirmada aguardando pesquisa no momento.\nDica: confirme entregas com o botão 🚚 no histórico de vendas.`;
    }

    const ideais = pendentes.filter(n => n.janela === 'IDEAL');
    const tardes = pendentes.filter(n => n.janela === 'TARDE');
    const cedos = pendentes.filter(n => n.janela === 'CEDO');

    const formatLine = (n: NPSPendente) => {
        const icone = n.janela === 'IDEAL' ? '🟢' : n.janela === 'TARDE' ? '🟡' : '⏰';
        const horas = n.horas_desde_entrega < 1 ? '<1h' : `${n.horas_desde_entrega}h`;
        return `  ${icone} ${n.nome_cliente} | Entregue há ${horas} | R$${n.valor_venda.toFixed(0)} | WhatsApp: ${n.whatsapp || 'não cadastrado'}`;
    };

    let resultado = `\n\n📬 NPS PENDENTES (${pendentes.length} entregas aguardando pesquisa):`;
    if (ideais.length > 0) resultado += `\n\n🟢 JANELA IDEAL (enviar AGORA — 4-24h após entrega):\n${ideais.map(formatLine).join('\n')}`;
    if (tardes.length > 0) resultado += `\n\n🟡 TARDE MAS VÁLIDO (enviar ainda hoje — 24-48h):\n${tardes.map(formatLine).join('\n')}`;
    if (cedos.length > 0) resultado += `\n\n⏰ CEDO DEMAIS (aguardar mais 2h para enviar):\n${cedos.map(formatLine).join('\n')}`;

    return resultado;
}
