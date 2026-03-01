// ═══ SERVIÇO DE AUTOMAÇÃO DE MARKETING — FrigoGest ═══
// Integra: Instagram Graph API, WhatsApp Business API, Stitch Design, Google Sheets

// ═══ TIPOS ═══
export interface InstagramPost {
    id?: string;
    caption: string;
    imageUrl?: string;
    videoUrl?: string;
    hashtags: string[];
    location?: string;
    scheduledAt?: Date;
    type: 'feed' | 'story' | 'reel' | 'carousel';
    status: 'draft' | 'scheduled' | 'published' | 'failed';
}

export interface WhatsAppMessage {
    id?: string;
    to: string;
    toName?: string;
    body: string;
    type: 'text' | 'template' | 'media' | 'catalog';
    templateName?: string;
    mediaUrl?: string;
    status: 'draft' | 'sent' | 'delivered' | 'read' | 'failed';
    sentAt?: Date;
    category: 'tabela_precos' | 'oferta_urgente' | 'vip_reativacao' | 'captacao_pecuarista' | 'geral';
}

export interface MarketingCampaign {
    id: string;
    name: string;
    type: 'instagram' | 'whatsapp' | 'multi';
    status: 'planning' | 'active' | 'paused' | 'completed';
    startDate: string;
    endDate?: string;
    audience: 'clientes_b2b' | 'pecuaristas' | 'ambos' | 'novos';
    messages: WhatsAppMessage[];
    posts: InstagramPost[];
    metrics: CampaignMetrics;
}

export interface CampaignMetrics {
    messagesEnviadas: number;
    messagesEntregues: number;
    messagesLidas: number;
    postsPublicados: number;
    alcanceTotal: number;
    engajamentoTotal: number;
    leadsGerados: number;
    conversoes: number;
}

export interface MarketingCalendarItem {
    date: string;
    dayOfWeek: number;
    theme: string;
    emoji: string;
    contentType: 'produto' | 'mercado' | 'educativo' | 'bastidores' | 'promo' | 'parceiros' | 'rural';
    suggestedCaption: string;
    suggestedHashtags: string[];
    platform: 'instagram' | 'whatsapp' | 'ambos';
}

// ═══ CONSTANTES ═══
const FRIGOGEST_BRAND = {
    nome: 'FrigoGest',
    tagline: 'Carcaça Premium B2B',
    cidade: 'Vitória da Conquista',
    estado: 'BA',
    regiao: 'Sudoeste Baiano',
    selos: ['SIF', 'ADAB'],
    cores: {
        primaria: '#8B0000', // Bordô
        secundaria: '#DAA520', // Dourado
        texto: '#FFFFFF', // Branco
        destaque: '#FF0000', // Vermelho urgência
    },
    bio: '🥩 FrigoGest | Frigorífico SIF • Carcaça Premium B2B | 📍 Vitória da Conquista-BA | 🏆 Qualidade + Pontualidade + Preço Justo',
    whatsapp: '(77) XXXX-XXXX',
};

const HASHTAGS = {
    local: ['#VitoriaDaConquista', '#VCA', '#SudoesteBaiano', '#BahiaAgro', '#ConquistaBA'],
    industria: ['#Frigorifico', '#CarneDeQualidade', '#BoiGordo', '#Pecuaria', '#SIF', '#ADAB'],
    produto: ['#CarcacaBovina', '#MeiaCarcaca', '#CarneFreca', '#Atacado', '#B2B'],
    engajamento: ['#ChurrascoPerfeito', '#Acougue', '#ChefDeChurrasco', '#BBQBrasil', '#CarnesNobres'],
    rural: ['#PecuariaBA', '#BoiNelore', '#AgroBahia', '#CampoECidade', '#PecuaristaBrasileiro'],
};

const CALENDARIO_EDITORIAL: Record<number, { theme: string; emoji: string; contentType: MarketingCalendarItem['contentType'] }> = {
    0: { theme: 'Conteúdo Rural', emoji: '🐄', contentType: 'rural' },        // Domingo
    1: { theme: 'Produto em Destaque', emoji: '🥩', contentType: 'produto' },  // Segunda
    2: { theme: 'Mercado do Boi', emoji: '📊', contentType: 'mercado' },       // Terça
    3: { theme: 'Conteúdo Educativo', emoji: '🎓', contentType: 'educativo' }, // Quarta
    4: { theme: 'Bastidores', emoji: '🏭', contentType: 'bastidores' },        // Quinta
    5: { theme: 'Promoção de Sexta', emoji: '🔥', contentType: 'promo' },      // Sexta
    6: { theme: 'Parceiros & UGC', emoji: '🤝', contentType: 'parceiros' },    // Sábado
};

// ═══ TEMPLATES WHATSAPP ═══
export const WHATSAPP_TEMPLATES = {
    tabela_precos: (produtos: { nome: string; precoArroba: number; precoKg: number }[]) => {
        const linhas = produtos.map(p => `| ${p.nome} | R$ ${p.precoArroba.toFixed(2)}/@ | R$ ${p.precoKg.toFixed(2)}/kg |`).join('\n');
        return `🥩 *TABELA FRIGOGEST* — Semana ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}

| Produto | R$/@ | R$/kg |
${linhas}

📲 Faça seu pedido: ${FRIGOGEST_BRAND.whatsapp}
*Entrega em VCA e região • SIF/ADAB*
✅ Balança aferida • GTA em dia`;
    },

    oferta_urgente: (produto: string, qtd: number, precoOriginal: number, precoDesconto: number) => {
        const economia = precoOriginal - precoDesconto;
        return `⚡ *OFERTA RELÂMPAGO* — Válida até amanhã!

🥩 ${qtd}x ${produto} com desconto especial
De R$ ${precoOriginal.toFixed(2)}/@ → *Por R$ ${precoDesconto.toFixed(2)}/@*
💰 Economia de R$ ${economia.toFixed(2)}/@

📲 Garanta a sua agora: ${FRIGOGEST_BRAND.whatsapp}
⚠️ Enquanto durar o estoque!`;
    },

    vip_reativacao: (nomeCliente: string, diasSemCompra: number) => {
        return `Olá ${nomeCliente}! 👋 Tudo bem?

Faz ${diasSemCompra} dias que não recebemos seu pedido.
Preparamos uma condição especial para você, nosso parceiro VIP:

🎁 *Desconto exclusivo na próxima compra*
📋 Tabela atualizada com preços especiais

Posso programar sua entrega para quando? 🚛
${FRIGOGEST_BRAND.whatsapp}`;
    },

    captacao_pecuarista: (cidade: string) => {
        return `Olá! 🤝 Sou da FrigoGest, frigorífico SIF em Vitória da Conquista.
Estamos buscando parceiros pecuaristas na região de ${cidade}.

✅ Pagamento pontual (à vista ou 7 dias)
✅ Pesagem transparente com balança aferida
✅ Preço referenciado ao CEPEA
✅ GTA e NF em dia

Tem gado pronto para abate? Vamos conversar! 📞
${FRIGOGEST_BRAND.whatsapp}`;
    },

    pos_venda: (nomeCliente: string) => {
        return `Olá ${nomeCliente}! 👋

Sua entrega foi realizada com sucesso! 🚛✅

Como foi a qualidade da carcaça? 
Sua opinião é muito importante pra gente!

⭐ 1-5, qual nota você dá?

Obrigado pela confiança! 🤝
FrigoGest — Qualidade que se vê no corte.`;
    },
};

// ═══ GERAÇÃO DE CALENDÁRIO ═══
export function generateWeeklyCalendar(startDate?: Date): MarketingCalendarItem[] {
    const start = startDate || new Date();
    const calendar: MarketingCalendarItem[] = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dow = date.getDay();
        const config = CALENDARIO_EDITORIAL[dow];

        const hashtagSet = new Set<string>();
        HASHTAGS.local.slice(0, 2).forEach(h => hashtagSet.add(h));
        HASHTAGS.industria.slice(0, 2).forEach(h => hashtagSet.add(h));

        if (config.contentType === 'produto') {
            HASHTAGS.produto.forEach(h => hashtagSet.add(h));
        } else if (config.contentType === 'rural') {
            HASHTAGS.rural.forEach(h => hashtagSet.add(h));
        } else if (config.contentType === 'promo') {
            HASHTAGS.engajamento.forEach(h => hashtagSet.add(h));
        } else {
            HASHTAGS.industria.slice(2, 5).forEach(h => hashtagSet.add(h));
        }

        calendar.push({
            date: date.toISOString().split('T')[0],
            dayOfWeek: dow,
            theme: config.theme,
            emoji: config.emoji,
            contentType: config.contentType,
            suggestedCaption: generateCaption(config.contentType, date),
            suggestedHashtags: Array.from(hashtagSet),
            platform: dow === 5 ? 'ambos' : 'instagram', // Sexta = WhatsApp + Instagram
        });
    }

    return calendar;
}

function generateCaption(contentType: MarketingCalendarItem['contentType'], date: Date): string {
    const diaSemana = date.toLocaleDateString('pt-BR', { weekday: 'long' });

    switch (contentType) {
        case 'produto':
            return `🥩 Carcaça do dia | ${diaSemana}\n\nFresquinha, com selo SIF e pronta para seu açougue.\nRendimento superior, entrega pontual.\n\n📲 Peça sua cotação: ${FRIGOGEST_BRAND.whatsapp}\n📍 ${FRIGOGEST_BRAND.cidade}-${FRIGOGEST_BRAND.estado}`;

        case 'mercado':
            return `📊 Mercado do Boi | ${diaSemana}\n\nCotação CEPEA atualizada ⬆️\nBoi gordo @ R$ — (confira)\nTendência da semana: [análise]\n\n💡 Fique por dentro do mercado!\n📍 ${FRIGOGEST_BRAND.cidade}-${FRIGOGEST_BRAND.estado}`;

        case 'educativo':
            return `🎓 Você sabia?\n\nO rendimento de carcaça varia de 48% a 56% dependendo da raça e do acabamento do gado.\n\nNa FrigoGest, trabalhamos com gado de rendimento superior.\n\n📲 Quer saber mais? ${FRIGOGEST_BRAND.whatsapp}\n📍 ${FRIGOGEST_BRAND.cidade}-${FRIGOGEST_BRAND.estado}`;

        case 'bastidores':
            return `🏭 Por dentro da FrigoGest\n\nNossa câmara fria: temperatura controlada 24h, organização impecável, selo SIF.\n\nIsso é qualidade que você vê.\n\n📲 Agende uma visita: ${FRIGOGEST_BRAND.whatsapp}\n📍 ${FRIGOGEST_BRAND.cidade}-${FRIGOGEST_BRAND.estado}`;

        case 'promo':
            return `🔥 SEXTA DE OFERTAS!\n\nAlgumas peças com condições especiais essa semana. Aproveite!\n\n⚡ Descontos exclusivos para parceiros\n📲 Chame no WhatsApp: ${FRIGOGEST_BRAND.whatsapp}\n⏰ Válido só hoje!\n📍 ${FRIGOGEST_BRAND.cidade}-${FRIGOGEST_BRAND.estado}`;

        case 'parceiros':
            return `🤝 Nossos parceiros\n\nMais de 50 açougues confiam na FrigoGest. E você?\n\nQualidade + Pontualidade + Preço Justo\n\n📲 Seja nosso parceiro: ${FRIGOGEST_BRAND.whatsapp}\n📍 ${FRIGOGEST_BRAND.cidade}-${FRIGOGEST_BRAND.estado}`;

        case 'rural':
            return `🐄 Direto do campo\n\nNosso gado: Nelore, bem manejado, com rastreabilidade completa.\n\nDo pasto à sua vitrine — com qualidade garantida.\n\n📲 ${FRIGOGEST_BRAND.whatsapp}\n📍 ${FRIGOGEST_BRAND.cidade}-${FRIGOGEST_BRAND.estado}`;

        default:
            return `🥩 FrigoGest — Carcaça Premium B2B\n📍 ${FRIGOGEST_BRAND.cidade}-${FRIGOGEST_BRAND.estado}`;
    }
}

// ═══ GERADOR DE POSTS INSTAGRAM ═══
export function generateInstagramPost(contentType: MarketingCalendarItem['contentType']): InstagramPost {
    const date = new Date();
    const caption = generateCaption(contentType, date);
    const allHashtags = [
        ...HASHTAGS.local.slice(0, 3),
        ...HASHTAGS.industria.slice(0, 3),
        ...(contentType === 'produto' ? HASHTAGS.produto : []),
        ...(contentType === 'rural' ? HASHTAGS.rural : []),
        ...HASHTAGS.engajamento.slice(0, 2),
    ];

    return {
        caption: `${caption}\n\n${allHashtags.join(' ')}`,
        hashtags: allHashtags,
        location: `${FRIGOGEST_BRAND.cidade}, ${FRIGOGEST_BRAND.estado}`,
        type: contentType === 'educativo' ? 'carousel' : contentType === 'bastidores' ? 'reel' : 'feed',
        status: 'draft',
    };
}

// ═══ GATILHOS MENTAIS PARA COPY ═══
export const GATILHOS_MENTAIS = {
    escassez: (qtd: number, produto: string) =>
        `⚠️ Apenas ${qtd} ${produto} disponíveis! Garanta a sua antes que acabe.`,

    urgencia: (prazo: string) =>
        `⏰ Oferta válida só até ${prazo}! Não perca essa oportunidade.`,

    provaSocial: (qtd: number) =>
        `✅ Mais de ${qtd} açougues já confiam na FrigoGest. Junte-se a eles!`,

    autoridade: () =>
        `🏆 Frigorífico com selo SIF + ADAB + GTA | Rastreabilidade completa | Balança aferida`,

    reciprocidade: (dica: string) =>
        `💡 Dica gratuita: ${dica}. Quer saber mais? Chame no WhatsApp!`,

    exclusividade: () =>
        `👑 Condição exclusiva para parceiros VIP FrigoGest. Essa oferta não vai durar.`,

    conexao: () =>
        `🤝 Somos uma empresa familiar que entende o valor de cada parceiro. Na FrigoGest, você não é só um número.`,
};

// ═══ MÉTRICAS DE PERFORMANCE ═══
export function getMarketingMetrics(): CampaignMetrics {
    const stored = localStorage.getItem('frigogest_marketing_metrics');
    if (stored) {
        return JSON.parse(stored);
    }
    return {
        messagesEnviadas: 0,
        messagesEntregues: 0,
        messagesLidas: 0,
        postsPublicados: 0,
        alcanceTotal: 0,
        engajamentoTotal: 0,
        leadsGerados: 0,
        conversoes: 0,
    };
}

export function updateMarketingMetrics(updates: Partial<CampaignMetrics>): void {
    const current = getMarketingMetrics();
    const updated = { ...current, ...updates };
    localStorage.setItem('frigogest_marketing_metrics', JSON.stringify(updated));
}

// ═══ STITCH DESIGN SPECS ═══
export const STITCH_DESIGN_SPECS = {
    feedPost: {
        width: '1080',
        height: '1080',
        format: '1:1',
        colors: FRIGOGEST_BRAND.cores,
        font: 'Bold Condensed',
        elements: ['Logo FrigoGest', 'Selo SIF', 'Geolocalização VCA-BA'],
        style: 'Premium, limpo, profissional',
    },
    story: {
        width: '1080',
        height: '1920',
        format: '9:16',
        colors: FRIGOGEST_BRAND.cores,
        font: 'Bold Condensed',
        elements: ['Logo FrigoGest', 'CTA WhatsApp', 'Swipe Up'],
        style: 'Urgência, impacto visual',
    },
    carousel: {
        width: '1080',
        height: '1350',
        format: '4:5',
        colors: FRIGOGEST_BRAND.cores,
        font: 'Clean Sans',
        elements: ['Logo FrigoGest', 'Numeração de slides', 'Selo SIF'],
        style: 'Educativo, informativo',
    },
};

export default {
    FRIGOGEST_BRAND,
    HASHTAGS,
    WHATSAPP_TEMPLATES,
    GATILHOS_MENTAIS,
    STITCH_DESIGN_SPECS,
    generateWeeklyCalendar,
    generateInstagramPost,
    getMarketingMetrics,
    updateMarketingMetrics,
};
