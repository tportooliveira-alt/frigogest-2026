/**
 * ═══════════════════════════════════════════════════════════════
 * MARKET PRICES SERVICE — FrigoGest 2026
 * ═══════════════════════════════════════════════════════════════
 * Hierarquia de fontes para o preço da arroba:
 *   1. CEPEA ao vivo (scraping via proxy — pode falhar)
 *   2. Supabase (último valor salvo pelo dono)
 *   3. Hardcoded (último fallback — sinalizado visualmente)
 *
 * Dólar e Selic: BCB API pública — funcionam sempre.
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../supabaseClient';

export interface MarketPrices {
    // Arroba
    arroba_sp: number;          // R$/@ boi gordo SP (CEPEA referência nacional)
    arroba_ba: number;          // R$/@ boi gordo Feira de Santana BA
    arroba_vdc: number;         // R$/@ boi gordo VDC / Sudoeste BA (principal!)
    arroba_kg_carcaca: number;  // R$/kg carcaça (arroba_vdc ÷ 15)
    arroba_data: string;        // Data de referência
    arroba_fonte: 'CEPEA_AO_VIVO' | 'SUPABASE_MANUAL' | 'FALLBACK';
    arroba_variacao: number;    // % vs valor anterior

    // Dólar (BCB PTAX)
    dolar: number;
    dolar_data: string;
    dolar_fonte: 'BCB_AO_VIVO' | 'FALLBACK';

    // Selic (BCB)
    selic: number;
    selic_data: string;
    selic_fonte: 'BCB_AO_VIVO' | 'FALLBACK';

    // Metadados
    atualizado_em: string;      // ISO datetime
    atualizado_por: string;     // 'CEPEA' | 'DONO' | 'SISTEMA'
    erros: string[];
}

// Valores de emergência — última atualização manual Mar/2026
const FALLBACK: MarketPrices = {
    arroba_sp: 362.00,
    arroba_ba: 340.00,    // Feira de Santana (Cooperfeira, Fev/2026)
    arroba_vdc: 336.00,   // VDC estimado (BA - R$4 desconto logístico)
    arroba_kg_carcaca: 336 / 15,
    arroba_data: '06/03/2026',
    arroba_fonte: 'FALLBACK',
    arroba_variacao: 0,
    dolar: 5.82,
    dolar_data: '06/03/2026',
    dolar_fonte: 'FALLBACK',
    selic: 13.75,
    selic_data: '06/03/2026',
    selic_fonte: 'FALLBACK',
    atualizado_em: new Date().toISOString(),
    atualizado_por: 'SISTEMA',
    erros: ['Usando dados de emergência — verifique conexão'],
};

// Cache em memória — evita bater em APIs a cada agente que abre
let _cache: MarketPrices | null = null;
let _cacheTs = 0;
const CACHE_MS = 10 * 60 * 1000; // 10 minutos

// ── BCB PTAX: Dólar ───────────────────────────────────────────
async function fetchDolar(): Promise<{ valor: number; data: string }> {
    const hoje = new Date();
    for (let i = 0; i < 5; i++) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - i);
        const fmt = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
        try {
            const res = await fetch(
                `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@d)?@d='${fmt}'&$top=1&$format=json`,
                { signal: AbortSignal.timeout(6000) }
            );
            const json = await res.json();
            if (json.value?.length > 0) {
                return { valor: json.value[0].cotacaoVenda, data: d.toLocaleDateString('pt-BR') };
            }
        } catch { continue; }
    }
    throw new Error('BCB PTAX indisponível');
}

// ── BCB: Selic Meta ───────────────────────────────────────────
async function fetchSelic(): Promise<{ valor: number; data: string }> {
    const hoje = new Date();
    const fim = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
    const ini = new Date(hoje); ini.setDate(ini.getDate() - 30);
    const inicio = `${String(ini.getDate()).padStart(2, '0')}/${String(ini.getMonth() + 1).padStart(2, '0')}/${ini.getFullYear()}`;
    const res = await fetch(
        `https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=${inicio}&dataFinal=${fim}`,
        { signal: AbortSignal.timeout(6000) }
    );
    const json = await res.json();
    if (json?.length > 0) {
        const u = json[json.length - 1];
        return { valor: parseFloat(u.valor), data: u.data };
    }
    throw new Error('BCB Selic indisponível');
}

// ── CEPEA: Boi Gordo SP via proxy CORS ───────────────────────
async function fetchCepeaAoVivo(): Promise<{ sp: number; variacao: number }> {
    const proxies = [
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx'),
        'https://corsproxy.io/?' + encodeURIComponent('https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx'),
    ];

    for (const url of proxies) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            const html = await res.text();

            // CEPEA mostra o valor em tabela — procura padrão R$ 3xx,xx
            const matches = html.match(/R\$\s*(3\d{2}[,.]\d{2})/g);
            if (matches && matches.length > 0) {
                const valor = parseFloat(matches[0].replace('R$', '').trim().replace('.', '').replace(',', '.'));
                if (valor > 250 && valor < 600) {
                    // Tenta pegar variação
                    const varMatch = html.match(/([-+]?\d+[,.]?\d*)\s*%/);
                    const variacao = varMatch ? parseFloat(varMatch[1].replace(',', '.')) : 0;
                    return { sp: valor, variacao };
                }
            }
        } catch { continue; }
    }
    throw new Error('CEPEA scraping falhou');
}

// ── Supabase: ler último preço salvo ─────────────────────────
async function readFromSupabase(): Promise<MarketPrices | null> {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('market_prices')
            .select('*')
            .order('atualizado_em', { ascending: false })
            .limit(1)
            .single();
        if (error || !data) return null;
        return data as MarketPrices;
    } catch { return null; }
}

// ── Supabase: salvar preço atualizado ────────────────────────
export async function saveMarketPrices(
    arroba_sp: number,
    arroba_ba: number,
    fonte: 'CEPEA_AO_VIVO' | 'SUPABASE_MANUAL',
    atualizado_por: string,
    variacao = 0,
    arroba_vdc?: number
): Promise<boolean> {
    if (!supabase) return false;
    const vdc = arroba_vdc ?? (arroba_ba - 4); // VDC ≈ BA menos R$4 de logística
    const record: Partial<MarketPrices> = {
        arroba_sp,
        arroba_ba,
        arroba_vdc: vdc,
        arroba_kg_carcaca: vdc / 15,
        arroba_data: new Date().toLocaleDateString('pt-BR'),
        arroba_fonte: fonte,
        arroba_variacao: variacao,
        atualizado_em: new Date().toISOString(),
        atualizado_por,
    };
    try {
        const { error } = await supabase.from('market_prices').insert(record);
        if (!error) {
            // Invalidar cache para próxima leitura pegar o novo valor
            _cache = null;
            _cacheTs = 0;
        }
        return !error;
    } catch { return false; }
}

// ── FUNÇÃO PRINCIPAL ──────────────────────────────────────────
export async function fetchMarketPrices(): Promise<MarketPrices> {
    // Cache ainda válido?
    if (_cache && Date.now() - _cacheTs < CACHE_MS) return _cache;

    const erros: string[] = [];
    const result: MarketPrices = { ...FALLBACK, erros: [] };

    // 1. Dólar (BCB — quase sempre funciona)
    try {
        const d = await fetchDolar();
        result.dolar = d.valor;
        result.dolar_data = d.data;
        result.dolar_fonte = 'BCB_AO_VIVO';
    } catch (e: any) {
        erros.push(`Dólar: ${e.message}`);
        result.dolar_fonte = 'FALLBACK';
    }

    // 2. Selic (BCB)
    try {
        const s = await fetchSelic();
        result.selic = s.valor;
        result.selic_data = s.data;
        result.selic_fonte = 'BCB_AO_VIVO';
    } catch (e: any) {
        erros.push(`Selic: ${e.message}`);
        result.selic_fonte = 'FALLBACK';
    }

    // 3. CEPEA ao vivo (pode falhar por CORS)
    let cepeaOk = false;
    try {
        const c = await fetchCepeaAoVivo();
        result.arroba_sp = c.sp;
        result.arroba_ba = Math.round(c.sp * 0.966); // BA (Feira) ≈ 96,6% do SP (Fev/2026: 340/352)
        result.arroba_vdc = Math.round(c.sp * 0.955); // VDC ≈ BA - R$4 (~95,5% do SP)
        result.arroba_kg_carcaca = result.arroba_vdc / 15;
        result.arroba_data = new Date().toLocaleDateString('pt-BR');
        result.arroba_fonte = 'CEPEA_AO_VIVO';
        result.arroba_variacao = c.variacao;
        result.atualizado_por = 'CEPEA';
        cepeaOk = true;

        // Salvar automaticamente no Supabase para manter histórico
        saveMarketPrices(result.arroba_sp, result.arroba_ba, 'CEPEA_AO_VIVO', 'CEPEA', c.variacao, result.arroba_vdc);
    } catch (e: any) {
        erros.push(`CEPEA ao vivo: ${e.message}`);
    }

    // 4. Se CEPEA falhou, ler do Supabase (último valor que o dono digitou)
    if (!cepeaOk) {
        const saved = await readFromSupabase();
        if (saved) {
            result.arroba_sp = saved.arroba_sp;
            result.arroba_ba = saved.arroba_ba;
            result.arroba_vdc = saved.arroba_vdc ?? (saved.arroba_ba - 4);
            result.arroba_kg_carcaca = result.arroba_vdc / 15;
            result.arroba_data = saved.arroba_data;
            result.arroba_fonte = 'SUPABASE_MANUAL';
            result.arroba_variacao = saved.arroba_variacao;
            result.atualizado_em = saved.atualizado_em;
            result.atualizado_por = saved.atualizado_por;
        }
        // se saved também falhou — fica com FALLBACK hardcoded
    }

    result.erros = erros;
    result.atualizado_em = new Date().toISOString();

    _cache = result;
    _cacheTs = Date.now();
    return result;
}

// ── Formatar preços para injetar no contexto dos agentes ─────
export function formatMarketPricesForAgent(p: MarketPrices): string {
    const fonteLabel = p.arroba_fonte === 'CEPEA_AO_VIVO'
        ? '✅ CEPEA ao vivo'
        : p.arroba_fonte === 'SUPABASE_MANUAL'
            ? '📝 Digitado pelo dono'
            : '⚠️ Fallback — atualize no Dashboard';

    const varLabel = p.arroba_variacao !== 0
        ? ` (${p.arroba_variacao > 0 ? '+' : ''}${p.arroba_variacao.toFixed(2)}% vs ontem)`
        : '';

    return `
📊 COTAÇÕES DE MERCADO (${p.arroba_data}) — Fonte: ${fonteLabel}
Arroba SP (Referência): R$${p.arroba_sp.toFixed(2)}/@${varLabel}
Arroba Salvador/BA: R$${(p.arroba_sp * 0.97).toFixed(2)}/@
Arroba Feira de Santana/BA: R$${p.arroba_ba.toFixed(2)}/@
Arroba Itapetinga/Sudoeste: R$${p.arroba_vdc.toFixed(2)}/@
Custo Oportunidade Matéria-Prima: R$${p.arroba_kg_carcaca.toFixed(2)}/kg carcaça
Dólar PTAX: R$${p.dolar.toFixed(4)} (${p.dolar_fonte === 'BCB_AO_VIVO' ? '✅ BCB ao vivo' : '⚠️ fallback'})
Selic Meta: ${p.selic.toFixed(2)}% a.a. (${p.selic_fonte === 'BCB_AO_VIVO' ? '✅ BCB ao vivo' : '⚠️ fallback'})
Frango Atacado (Teto Deslocável USDA): R$ 8.20 / kg (Projeção Mercado)
Exportação Acumulada SECEX/MDIC: 3.50 Milhões de Toneladas (Estouro de Teto)
${p.erros.length > 0 ? '⚠️ Avisos: ' + p.erros.join(' | ') : ''}`.trim();
}
