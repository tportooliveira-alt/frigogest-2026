// ═══════════════════════════════════════════════════════════════
// 🔔 ALERT SERVICE — Sistema de Alertas Automáticos de Mercado
// ═══════════════════════════════════════════════════════════════
// Monitora dados ao vivo e gera alertas quando:
// 1. CEPEA rompe marcos de preço (R$ 340, 350, 360, 370, 380)
// 2. Dólar sobe/desce além de limites
// 3. Margem de compra fica abaixo do aceitável
// 4. Tendência V4 muda de direção
// 5. Estoque parado há muitos dias
// ═══════════════════════════════════════════════════════════════

import { fetchAllMarketData } from './marketDataService';
import { calcularPrecificacao } from './pricingEngineService';

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
    acao: string;      // O que fazer
    valor: number;     // Valor que disparou o alerta
    limiar: number;    // Limiar configurado
    lida: boolean;
}

export interface AlertConfig {
    // Marcos de preço CEPEA (R$/@)
    cepeaMarcos: number[];
    // Limites de dólar
    dolarMax: number;
    dolarMin: number;
    // Margem mínima aceitável (%)
    margemMinima: number;
    // Variação diária que merece alerta (%)
    variacaoDiariaAlerta: number;
    // Estoque parado (dias)
    estoqueParadoDias: number;
    // Ativar push notifications
    pushEnabled: boolean;
    // Ativar alertas sonoros
    somEnabled: boolean;
}

// Configuração padrão
const DEFAULT_CONFIG: AlertConfig = {
    cepeaMarcos: [330, 340, 350, 355, 360, 370, 380],
    dolarMax: 6.00,
    dolarMin: 5.30,
    dolarAlertaDiario: 0.05,
    margemMinima: 18,
    variacaoDiariaAlerta: 1.5,
    estoqueParadoDias: 7,
    pushEnabled: true,
    somEnabled: true
} as any;

// Storage keys
const ALERTS_STORAGE_KEY = 'frigogest_market_alerts';
const CONFIG_STORAGE_KEY = 'frigogest_alert_config';
const LAST_CHECK_KEY = 'frigogest_last_alert_check';

// ═══ PERSISTÊNCIA ═══
function getStoredAlerts(): MarketAlert[] {
    try {
        const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
        if (stored) {
            const alerts = JSON.parse(stored);
            return alerts.map((a: any) => ({ ...a, timestamp: new Date(a.timestamp) }));
        }
    } catch { }
    return [];
}

function storeAlerts(alerts: MarketAlert[]): void {
    try {
        // Manter apenas os últimos 50 alertas
        const trimmed = alerts.slice(-50);
        localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(trimmed));
    } catch { }
}

export function getAlertConfig(): AlertConfig {
    try {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch { }
    return DEFAULT_CONFIG;
}

export function saveAlertConfig(config: Partial<AlertConfig>): void {
    try {
        const current = getAlertConfig();
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({ ...current, ...config }));
    } catch { }
}

// ═══ GERAÇÃO DE ALERTAS ═══
export async function checkMarketAlerts(): Promise<MarketAlert[]> {
    const config = getAlertConfig();
    const existingAlerts = getStoredAlerts();
    const newAlerts: MarketAlert[] = [];

    try {
        // Buscar dados ao vivo
        const marketData = await fetchAllMarketData();
        const pricing = await calcularPrecificacao();

        const cepeaValor = marketData.cepeaBoi.valor;
        const cepeaVar = marketData.cepeaBoi.variacao;
        const dolarValor = marketData.dolar.valor;
        const selicValor = marketData.selic.valor;

        // ── 1. ALERTAS DE PREÇO CEPEA ──
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
                    mensagem: `Indicador CEPEA/ESALQ atingiu R$ ${cepeaValor.toFixed(2)}/@ — marco de R$ ${marco} rompido!`,
                    emoji: '📈',
                    acao: marco >= 360
                        ? 'URGENTE: Trave preços de compra AGORA. Negocie lotes para os próximos 15 dias.'
                        : 'Revise suas margens. Considere repassar parcialmente ao cliente.',
                    valor: cepeaValor,
                    limiar: marco,
                    lida: false
                });
            }
        }

        // ── 2. ALERTA DE VARIAÇÃO DIÁRIA ──
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
                    mensagem: `Variação de ${cepeaVar >= 0 ? '+' : ''}${cepeaVar.toFixed(2)}% em um único dia. CEPEA agora R$ ${cepeaValor.toFixed(2)}/@.`,
                    emoji: cepeaVar > 0 ? '🔥' : '❄️',
                    acao: cepeaVar > 0
                        ? 'Mercado aquecendo. Roberto deve travar preços com fornecedores.'
                        : 'Possível oportunidade de compra. Monitore nos próximos 2-3 dias.',
                    valor: cepeaVar,
                    limiar: config.variacaoDiariaAlerta,
                    lida: false
                });
            }
        }

        // ── 3. ALERTAS DE DÓLAR ──
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
                    mensagem: `USD/BRL a R$ ${dolarValor.toFixed(2)} — impacto na Equação V4 (peso 20×). Preço projetado da arroba SOBE.`,
                    emoji: '💵',
                    acao: 'Revisar preços de venda. Dólar alto eleva custo de insumos (milho, combustível) e pressiona arroba.',
                    valor: dolarValor,
                    limiar: config.dolarMax,
                    lida: false
                });
            }
        }

        // ── 4. ALERTA DE MARGEM ──
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
                    mensagem: `Margem bruta atual: ${pricing.margemBruta.toFixed(1)}%. Preço máximo por @: R$ ${pricing.precoMaximoArroba.toFixed(2)}. Semáforo: ${pricing.sinal}.`,
                    emoji: '⚠️',
                    acao: pricing.margemBruta < 10
                        ? 'PARE de comprar a este preço. Espere correção ou aumente preço de venda.'
                        : 'Negocie melhor com fornecedores. Busque spread regional maior.',
                    valor: pricing.margemBruta,
                    limiar: config.margemMinima,
                    lida: false
                });
            }
        }

        // ── 5. ALERTA DE TENDÊNCIA ──
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
                    mensagem: `V4 projeta alta para o próximo mês: R$ ${pricing.precoV4ProximoMes.toFixed(2)}/@. Considere antecipar compras.`,
                    emoji: '📊',
                    acao: 'Travar lotes agora pode economizar R$ 5-15/@ no próximo mês.',
                    valor: pricing.precoV4ProximoMes,
                    limiar: pricing.precoV4Projetado,
                    lida: false
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
                    mensagem: `Preço regional R$ ${pricing.precoArrobaRegional.toFixed(0)}/@ está R$ ${pricing.economiaVsMax.toFixed(0)} abaixo do máximo. Margem de ${pricing.margemBruta.toFixed(1)}%.`,
                    emoji: '💰',
                    acao: `COMPRAR. Lucro estimado de R$ ${pricing.lucroEstimadoPorCabeca.toFixed(0)}/cabeça. Negocie volume!`,
                    valor: pricing.economiaVsMax,
                    limiar: 10,
                    lida: false
                });
            }
        }

    } catch (err) {
        console.error('Erro ao verificar alertas:', err);
    }

    // Salvar novos alertas
    if (newAlerts.length > 0) {
        const allAlerts = [...existingAlerts, ...newAlerts];
        storeAlerts(allAlerts);

        // Push notification (se habilitado e disponível)
        const config2 = getAlertConfig();
        if (config2.pushEnabled && 'Notification' in window && Notification.permission === 'granted') {
            for (const alert of newAlerts) {
                if (alert.severity === 'CRITICO' || alert.severity === 'ALTO') {
                    try {
                        new Notification(`FrigoGest: ${alert.titulo}`, {
                            body: alert.mensagem,
                            icon: '/icons/icon-192x192.png',
                            tag: alert.id,
                            requireInteraction: alert.severity === 'CRITICO'
                        });
                    } catch { }
                }
            }
        }

        // Som de alerta
        if (config2.somEnabled && newAlerts.some(a => a.severity === 'CRITICO')) {
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEA' +
                    'ABxXAABQnwAAAgAQAGRhdGFeBgAA');
                audio.volume = 0.3;
                audio.play().catch(() => { });
            } catch { }
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

export function getAllAlerts(): MarketAlert[] {
    return getStoredAlerts().sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function markAlertAsRead(alertId: string): void {
    const alerts = getStoredAlerts();
    const updated = alerts.map(a => a.id === alertId ? { ...a, lida: true } : a);
    storeAlerts(updated);
}

export function clearAllAlerts(): void {
    localStorage.removeItem(ALERTS_STORAGE_KEY);
}

export function getUnreadCount(): number {
    return getStoredAlerts().filter(a => !a.lida).length;
}

export async function requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}
