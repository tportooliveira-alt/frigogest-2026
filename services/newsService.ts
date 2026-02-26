// ═══ SERVIÇO DE NOTÍCIAS DO MERCADO PECUÁRIO VIA RSS ═══
// Busca notícias em tempo real de portais do agronegócio brasileiro
// Fontes: Google News (agregador), Notícias Agrícolas, CompreRural, BeefPoint, Canal Rural

// Proxy CORS grátis para RSS (frontend não pode acessar RSS direto)
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
];

// Feeds RSS do setor pecuário — Google News busca as MAIS RECENTES automaticamente
const RSS_FEEDS = [
    // ═══ GOOGLE NEWS — AGREGADOR (sempre notícias da hora!) ═══
    {
        name: 'Google News - Boi Gordo',
        url: 'https://news.google.com/rss/search?q=boi+gordo+arroba+pre%C3%A7o&hl=pt-BR&gl=BR&ceid=BR:pt-419',
        category: 'BOI GORDO',
        icon: '🐂'
    },
    {
        name: 'Google News - Pecuária',
        url: 'https://news.google.com/rss/search?q=pecu%C3%A1ria+carne+bovina+mercado&hl=pt-BR&gl=BR&ceid=BR:pt-419',
        category: 'PECUÁRIA',
        icon: '🥩'
    },
    {
        name: 'Google News - Frigorífico',
        url: 'https://news.google.com/rss/search?q=frigor%C3%ADfico+carne+abate+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419',
        category: 'INDÚSTRIA',
        icon: '🏭'
    },
    {
        name: 'Google News - Cotação Arroba',
        url: 'https://news.google.com/rss/search?q=cota%C3%A7%C3%A3o+arroba+boi+CEPEA&hl=pt-BR&gl=BR&ceid=BR:pt-419',
        category: 'COTAÇÃO',
        icon: '📊'
    },
    // ═══ PORTAIS ESPECIALIZADOS ═══
    {
        name: 'Notícias Agrícolas - Boi',
        url: 'https://www.noticiasagricolas.com.br/rss/boi.xml',
        category: 'MERCADO',
        icon: '📈'
    },
    {
        name: 'CompreRural',
        url: 'https://www.comprerural.com/feed/',
        category: 'AGRO',
        icon: '🌾'
    },
    {
        name: 'Preços Agrícolas',
        url: 'https://economia-financas-e-agronegoci.webnode.page/rss/pre%c3%a7os-dos-produtos-agricolas-no-brasil.xml',
        category: 'PREÇOS',
        icon: '💰'
    }
];

export interface NewsItem {
    title: string;
    description: string;
    link: string;
    pubDate: string;
    source: string;
    category: string;
    icon: string;
    isRecent: boolean; // < 24h
    hoursAgo: number;  // quantas horas atrás
}

// Parser simples de XML/RSS
function parseRSSItem(itemXml: string): { title: string; description: string; link: string; pubDate: string } | null {
    try {
        const getTag = (tag: string) => {
            const match = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[(.+?)\\]\\]></${tag}>`, 's'))
                || itemXml.match(new RegExp(`<${tag}[^>]*>(.+?)</${tag}>`, 's'));
            return match ? match[1].trim() : '';
        };
        const title = getTag('title');
        const description = getTag('description').replace(/<[^>]*>/g, '').substring(0, 250);
        const link = getTag('link');
        const pubDate = getTag('pubDate');
        if (!title) return null;
        return { title, description, link, pubDate };
    } catch {
        return null;
    }
}

// Buscar um feed RSS com fallback de proxy
async function fetchFeed(feed: typeof RSS_FEEDS[0]): Promise<NewsItem[]> {
    for (const proxy of CORS_PROXIES) {
        try {
            const res = await fetch(proxy + encodeURIComponent(feed.url), {
                signal: AbortSignal.timeout(10000)
            });
            if (!res.ok) continue;
            const xml = await res.text();

            // Extrair items do RSS
            const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;

            return items.slice(0, 5).map(itemXml => {
                const parsed = parseRSSItem(itemXml);
                if (!parsed) return null;
                const pubTime = parsed.pubDate ? new Date(parsed.pubDate).getTime() : 0;
                const hoursAgo = pubTime > 0 ? Math.floor((now - pubTime) / (60 * 60 * 1000)) : 999;
                const isRecent = hoursAgo < 24;
                return {
                    title: parsed.title,
                    description: parsed.description,
                    link: parsed.link,
                    pubDate: parsed.pubDate,
                    source: feed.name,
                    category: feed.category,
                    icon: feed.icon,
                    isRecent,
                    hoursAgo
                };
            }).filter(Boolean) as NewsItem[];
        } catch {
            continue; // Tenta próximo proxy
        }
    }
    return [];
}

// Buscar notícias de TODOS os feeds
export async function fetchAllNews(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
    const allNews: NewsItem[] = [];
    for (const result of results) {
        if (result.status === 'fulfilled') {
            allNews.push(...result.value);
        }
    }
    // Remover duplicatas por título similar
    const seen = new Set<string>();
    const unique = allNews.filter(n => {
        const key = n.title.toLowerCase().substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    // Ordenar por data (mais recente primeiro)
    unique.sort((a, b) => a.hoursAgo - b.hoursAgo);
    return unique;
}

// Formatar tempo relativo
function formatTimeAgo(hoursAgo: number): string {
    if (hoursAgo < 1) return '🔴 AGORA';
    if (hoursAgo < 2) return '🔴 1h atrás';
    if (hoursAgo < 6) return `🟠 ${hoursAgo}h atrás`;
    if (hoursAgo < 24) return `🟡 ${hoursAgo}h atrás`;
    if (hoursAgo < 48) return `⚪ ontem`;
    const days = Math.floor(hoursAgo / 24);
    return `⚪ ${days} dias atrás`;
}

// Formatar notícias para injetar no prompt da IA
export function formatNewsForAgent(news: NewsItem[]): string {
    if (news.length === 0) return '⚠️ Não foi possível buscar notícias do mercado neste momento.';

    const recentNews = news.filter(n => n.isRecent);
    const topNews = (recentNews.length > 0 ? recentNews : news).slice(0, 10);

    let text = `═══ 📰 NOTÍCIAS DO MERCADO EM TEMPO REAL (${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}) ═══\n`;

    if (recentNews.length > 0) {
        text += `🟢 ${recentNews.length} notícias das últimas 24h!\n`;
        const veryRecent = recentNews.filter(n => n.hoursAgo < 6);
        if (veryRecent.length > 0) text += `🔴 ${veryRecent.length} notícias das últimas 6h!\n`;
    } else {
        text += `🟡 Mostrando notícias mais recentes disponíveis:\n`;
    }
    text += '\n';

    for (const item of topNews) {
        text += `${item.icon} [${item.category}] ${formatTimeAgo(item.hoursAgo)}\n`;
        text += `   ${item.title}\n`;
        if (item.description) text += `   ${item.description.substring(0, 150)}\n`;
        text += `   Fonte: ${item.source}\n\n`;
    }

    text += `\nINSTRUÇÃO: Use essas notícias para contextualizar sua análise com dados ATUAIS. Mencione tendências relevantes e como afetam o frigorífico HOJE.`;
    return text;
}

export { RSS_FEEDS };
