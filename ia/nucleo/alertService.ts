// ═══════════════════════════════════════════════════════════════
// 🔔 ALERT SERVICE — Sistema de Alertas Automáticos de Mercado
// ═══════════════════════════════════════════════════════════════
// Persistência: Supabase (tabela market_alerts + system_config)
// Funciona em todos os dispositivos simultaneamente
// ═══════════════════════════════════════════════════════════════

import { fetchAllMarketData } from './marketDataService';
import { calcularPrecificacao } from './pricingEngineService';
import { supabase } from '../../supabaseClient';

export type AlertSeverity = 'CRITICO' | 'ALTO' | 'MEDIO' | 'INFO';
export type AlertCategory = 'PRECO' | 'MARGEM' | 'DOLAR' | 'TENDENCIA' | 'ESTOQUE' | 'SELIC' | 'OPORTUNIDADE';

export interface MarketAlert {
    id: string;
    timestamp: Date;
    severity: AlertSeverity;
    category: AlertCategory;
    titulo: string;
    mensagem: string;
    emoji: string;
    acao: string;
    valor: number;
    limiar: number;
    lida: boolean;
}

export interface AlertConfig {
    cepeaMarcos: number[];
    dolarMax: number;
    dolarMin: number;
    margemMinima: number;
    variacaoDiariaAlerta: number;
    estoqueParadoDias: number;
    pushEnabled: boolean;
    somEnabled: boolean;
}

const DEFAULT_CONFIG: AlertConfig = {
    cepeaMarcos: [330, 340, 350, 355, 360, 370, 380],
    dolarMax: 6.00,
    dolarMin: 5.30,
    margemMinima: 18,
    variacaoDiariaAlerta: 1.5,
    estoqueParadoDias: 7,
    pushEnabled: true,
    somEnabled: true,
};

// ═══ PERSISTÊNCIA — Supabase ═══

async function getStoredAlerts(): Promise<MarketAlert[]> {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('market_alerts')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);
        if (error || !data) return [];
        return data.map((a: any) => ({ ...a, timestamp: new Date(a.timestamp) }));
    } catch { return []; }
}

async function storeAlert(alert: MarketAlert): Promise<void> {
    if (!supabase) return;
    try {
        await supabase.from('market_alerts').upsert({
            id: alert.id,
            timestamp: alert.timestamp.toISOString(),
            severity: alert.severity,
            category: alert.category,
            titulo: alert.titulo,
            mensagem: alert.mensagem,
            emoji: alert.emoji,
            acao: alert.acao,
            valor: alert.valor,
            limiar: alert.limiar,
            lida: alert.lida,
        });
    } catch { }
}

export async function getAlertConfig(): Promise<AlertConfig> {
    if (!supabase) return DEFAULT_CONFIG;
    try {
        const { data } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'alert_config')
            .single();
        if (data?.value) return { ...DEFAULT_CONFIG, ...data.value };
    } catch { }
    return DEFAULT_CONFIG;
}

export async function saveAlertConfig(config: Partial<AlertConfig>): Promise<void> {
    if (!supabase) return;
    try {
        const current = await getAlertConfig();
        await supabase.from('system_config').upsert({
            key: 'alert_config',
            value: { ...current, ...config },
            updated_at: new Date().toISOString(),
        });
    } catch { }
}

// ═══ GERAÇÃO DE ALERTAS ═══

export async function checkMarketAlerts(): Promise<MarketAlert[]> {
    const config = await getAlertConfig();
    const existingAlerts = await getStoredAlerts();
    const newAlerts: MarketAlert[] = [];

    try {
        const marketData = await fetchAllMarketData();
        const pricing = await calcularPrecificacao();

        const cepeaValor = marketData.cepeaBoi.valor;
        const cepeaVar = marketData.cepeaBoi.variacao;
        const dolarValor = marketData.dolar.valor;

        // ── 1. MARCOS DE PREÇO CEPEA ──
        for (const marco of config.cepeaMarcos) {
            const alertId = `CEPEA_MARCO_${marco}`;
            const jaAlertou = existingAlerts.some(a => a.id === alertId && isToday(a.timestamp));
            if (!jaAlertou && cepeaValor >= marco && cepeaValor < marco + 5) {
                newAlerts.push({
                    id: alertId,
                    timestamp: new Date(),
                    severity: marco >= 370 ? 'CRITICO' : marco >= 350 ? 'ALTO' : 'MEDIO',
                    category: 'PRECO',
                    titulo: `🐄 CEPEA rompeu R$ ${marco}/@!`,
                    mensagem: `CEPEA/ESALQ atingiu R$ ${cepeaValor.toFixed(2)}/@ — marco de R$ ${marco} rompido!`,
                    emoji: '📈',
                    acao: marco >= 360
                        ? 'URGENTE: Trave preços de compra AGORA. Negocie lotes para os próximos 15 dias.'
                        : 'Revise suas margens. Considere repassar parcialmente ao cliente.',
                    valor: cepeaValor,
                    limiar: marco,
                    lida: false,
                });
            }
        }

        // ── 2. VARIAÇÃO DIÁRIA ──
        if (Math.abs(cepeaVar) >= config.variacaoDiariaAlerta) {
            const alertId = `VAR_DIARIA_${new Date().toISOString().slice(0, 10)}`;
            const jaAlertou = existingAlerts.some(a => a.id === alertId);
            if (!jaAlertou) {
                newAlerts.push({
                    id: alertId,
                    timestamp: new Date(),
                    severity: Math.abs(cepeaVar) >= 3 ? 'CRITICO' : 'ALTO',
                    category: 'PRECO',
                    titulo: cepeaVar > 0
                        ? `📈 Alta de ${cepeaVar.toFixed(2)}% no CEPEA hoje!`
                        : `📉 Queda de ${Math.abs(cepeaVar).toFixed(2)}% no CEPEA hoje!`,
                    mensagem: `Variação de ${cepeaVar >= 0 ? '+' : ''}${cepeaVar.toFixed(2)}% em um dia. CEPEA agora R$ ${cepeaValor.toFixed(2)}/@.`,
                    emoji: cepeaVar > 0 ? '🔥' : '❄️',
                    acao: cepeaVar > 0
                        ? 'Mercado aquecendo. Roberto deve travar preços com fornecedores.'
                        : 'Possível oportunidade de compra. Monitore nos próximos 2-3 dias.',
                    valor: cepeaVar,
                    limiar: config.variacaoDiariaAlerta,
                    lida: false,
                });
            }
        }

        // ── 3. DÓLAR ──
        if (dolarValor >= config.dolarMax) {
            const alertId = `DOLAR_MAX_${new Date().toISOString().slice(0, 10)}`;
            const jaAlertou = existingAlerts.some(a => a.id === alertId);
            if (!jaAlertou) {
                newAlerts.push({
                    id: alertId,
                    timestamp: new Date(),
                    severity: 'ALTO',
                    category: 'DOLAR',
                    titulo: `💵 Dólar acima de R$ ${config.dolarMax}!`,
                    mensagem: `USD/BRL a R$ ${dolarValor.toFixed(2)} — impacto no custo de insumos e arroba.`,
                    emoji: '💵',
                    acao: 'Revisar preços de venda. Dólar alto pressiona custo do boi.',
                    valor: dolarValor,
                    limiar: config.dolarMax,
                    lida: false,
                });
            }
        }

        // ── 4. MARGEM BAIXA ──
        if (pricing.margemBruta < config.margemMinima) {
            const alertId = `MARGEM_BAIXA_${new Date().toISOString().slice(0, 10)}`;
            const jaAlertou = existingAlerts.some(a => a.id === alertId);
            if (!jaAlertou) {
                newAlerts.push({
                    id: alertId,
                    timestamp: new Date(),
                    severity: pricing.margemBruta < 10 ? 'CRITICO' : 'ALTO',
                    category: 'MARGEM',
                    titulo: `⚠️ Margem abaixo de ${config.margemMinima}%!`,
                    mensagem: `Margem bruta atual: ${pricing.margemBruta.toFixed(1)}%. Semáforo: ${pricing.sinal}.`,
                    emoji: '⚠️',
                    acao: pricing.margemBruta < 10
                        ? 'PARE de comprar a este preço. Espere correção ou aumente preço de venda.'
                        : 'Negocie melhor com fornecedores. Busque spread regional maior.',
                    valor: pricing.margemBruta,
                    limiar: config.margemMinima,
                    lida: false,
                });
            }
        }

        // ── 5. TENDÊNCIA V4 ──
        if (pricing.tendencia === 'ALTA' && cepeaValor > 350) {
            const alertId = `TEND_ALTA_${new Date().toISOString().slice(0, 10)}`;
            const jaAlertou = existingAlerts.some(a => a.id === alertId);
            if (!jaAlertou) {
                newAlerts.push({
                    id: alertId,
                    timestamp: new Date(),
                    severity: 'INFO',
                    category: 'TENDENCIA',
                    titulo: '📊 Tendência V4: ALTA confirmada',
                    mensagem: `V4 projeta alta: R$ ${pricing.precoV4ProximoMes.toFixed(2)}/@. Considere antecipar compras.`,
                    emoji: '📊',
                    acao: 'Travar lotes agora pode economizar R$ 5-15/@ no próximo mês.',
                    valor: pricing.precoV4ProximoMes,
                    limiar: pricing.precoV4Projetado,
                    lida: false,
                });
            }
        }

        // ── 6. OPORTUNIDADE DE COMPRA ──
        if (pricing.sinal === 'COMPRAR' && pricing.economiaVsMax > 10) {
            const alertId = `OPORTUNIDADE_${new Date().toISOString().slice(0, 10)}`;
            const jaAlertou = existingAlerts.some(a => a.id === alertId);
            if (!jaAlertou) {
                newAlerts.push({
                    id: alertId,
                    timestamp: new Date(),
                    severity: 'INFO',
                    category: 'OPORTUNIDADE',
                    titulo: '🟢 Janela de compra aberta!',
                    mensagem: `R$ ${pricing.precoArrobaRegional.toFixed(0)}/@ está R$ ${pricing.economiaVsMax.toFixed(0)} abaixo do máximo. Margem de ${pricing.margemBruta.toFixed(1)}%.`,
                    emoji: '💰',
                    acao: `COMPRAR. Lucro estimado R$ ${pricing.lucroEstimadoPorCabeca.toFixed(0)}/cabeça.`,
                    valor: pricing.economiaVsMax,
                    limiar: 10,
                    lida: false,
                });
            }
        }

    } catch (err) {
        console.error('Erro ao verificar alertas:', err);
    }

    // Salvar novos alertas no Supabase
    for (const alert of newAlerts) {
        await storeAlert(alert);
    }

    // Push notification
    const cfg = await getAlertConfig();
    if (cfg.pushEnabled && newAlerts.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        for (const alert of newAlerts) {
            if (alert.severity === 'CRITICO' || alert.severity === 'ALTO') {
                try {
                    new Notification(`FrigoGest: ${alert.titulo}`, {
                        body: alert.mensagem,
                        icon: '/icons/icon-192x192.png',
                        tag: alert.id,
                        requireInteraction: alert.severity === 'CRITICO',
                    });
                } catch { }
            }
        }
    }

    return newAlerts;
}

// ═══ UTILIDADES ═══

function isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

export async function getAllAlerts(): Promise<MarketAlert[]> {
    return getStoredAlerts();
}

export async function markAlertAsRead(alertId: string): Promise<void> {
    if (!supabase) return;
    try {
        await supabase.from('market_alerts').update({ lida: true }).eq('id', alertId);
    } catch { }
}

export async function clearAllAlerts(): Promise<void> {
    if (!supabase) return;
    try {
        await supabase.from('market_alerts').delete().neq('id', '');
    } catch { }
}

export async function getUnreadCount(): Promise<number> {
    if (!supabase) return 0;
    try {
        const { count } = await supabase
            .from('market_alerts')
            .select('*', { count: 'exact', head: true })
            .eq('lida', false);
        return count || 0;
    } catch { return 0; }
}

export async function requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}
