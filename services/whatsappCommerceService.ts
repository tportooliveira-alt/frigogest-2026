// ═══ WHATSAPP COMMERCE — FASE 5 ═══
// Templates profissionais para Frigorífico + Catálogo Digital + CRM WhatsApp
// Inspirado em: WhatsApp Business API, RD Station, HubSpot

import { Client, Sale, StockItem } from '../types';

// ═══ TIPOS DE TEMPLATE ═══
export type TemplateType = 'REATIVACAO' | 'PROMOCAO' | 'COBRANCA' | 'NPS' | 'BOAS_VINDAS' | 'CATALOGO' | 'ANIVERSARIO' | 'ESCASSEZ';

export interface WhatsAppTemplate {
    id: TemplateType;
    name: string;
    icon: string;
    description: string;
    color: string;
    generate: (client: Client, context?: TemplateContext) => string;
}

export interface TemplateContext {
    diasInativo?: number;
    valorDevido?: number;
    produtosEstoque?: { nome: string; peso: number; preco: number; diasNaCamara: number }[];
    ultimaCompra?: string;
    nomeEmpresa?: string;
}

// ═══ TEMPLATES PRONTOS ═══
export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
    {
        id: 'REATIVACAO',
        name: 'Reativação Cliente',
        icon: '🔄',
        description: 'Para clientes inativos há 15+ dias',
        color: 'from-blue-500 to-cyan-500',
        generate: (client, ctx) => {
            const dias = ctx?.diasInativo || 30;
            return `Olá ${client.nome_social}! 👋

Faz tempo que não aparece aqui no frigorífico! Já se passaram ${dias} dias desde sua última compra.

🥩 Preparamos condições especiais para você voltar:
✅ Desconto de 5% na próxima compra acima de 50kg
✅ Parcelamento em até 15 dias
✅ Entrega programada no melhor horário pra você

Temos carne fresca entrando toda semana, com rastreabilidade garantida.

Posso reservar um lote pra você? Qual corte precisa? 🤝`;
        }
    },
    {
        id: 'PROMOCAO',
        name: 'Promoção/Oferta',
        icon: '🔥',
        description: 'Ofertas de produtos com desconto',
        color: 'from-orange-500 to-red-500',
        generate: (client, ctx) => {
            const produtos = ctx?.produtosEstoque || [];
            const listaProdutos = produtos.length > 0
                ? produtos.map(p => `• ${p.nome} — ${p.peso.toFixed(1)}kg — R$${p.preco.toFixed(2)}/kg`).join('\n')
                : '• Dianteiro — consulte\n• Traseiro — consulte\n• Costela — consulte';
            return `🔥 OFERTA ESPECIAL — ${client.nome_social}!

Temos produtos frescos com preços imperdíveis:

${listaProdutos}

⏰ Condição válida somente esta semana!
📦 Estoque limitado — quem chegar primeiro leva.

Quer reservar? Me responde aqui que já separo pra você! 🤝`;
        }
    },
    {
        id: 'COBRANCA',
        name: 'Cobrança Educada',
        icon: '💰',
        description: 'Lembrete de pagamento pendente',
        color: 'from-amber-500 to-yellow-500',
        generate: (client, ctx) => {
            const valor = ctx?.valorDevido || client.saldo_devedor;
            return `Olá ${client.nome_social}, tudo bem? 😊

Estou passando para lembrar sobre uma pendência financeira:

💰 Valor pendente: R$${valor.toFixed(2).replace('.', ',')}

Formas de pagamento:
• PIX (cai na hora ✅)
• Transferência bancária
• Dinheiro na entrega

Podemos resolver isso hoje? Se precisar de um prazo, me avisa que a gente negocia. 🤝

Obrigado pela parceria! 🙏`;
        }
    },
    {
        id: 'NPS',
        name: 'Pesquisa NPS / Feedback',
        icon: '⭐',
        description: 'Pós-venda e pesquisa de satisfação',
        color: 'from-purple-500 to-violet-500',
        generate: (client, ctx) => {
            return `Olá ${client.nome_social}! 😊

Gostaria da sua opinião rápida sobre a última compra:

De 0 a 10, qual nota você dá pro nosso atendimento e qualidade da carne?

0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟

Sua opinião é muito importante para melhorarmos sempre! 

Se tiver alguma sugestão, pode mandar aqui.

Obrigado! 🤝`;
        }
    },
    {
        id: 'BOAS_VINDAS',
        name: 'Boas-vindas Novo Cliente',
        icon: '🎉',
        description: 'Primeiro contato com cliente novo',
        color: 'from-green-500 to-emerald-500',
        generate: (client) => {
            return `Olá ${client.nome_social}! Seja bem-vindo ao FrigoGest! 🎉

Somos um frigorífico comprometido com:
✅ Qualidade da carne rastreada
✅ Preço justo e competitivo
✅ Entrega programada na sua conveniência
✅ Atendimento personalizado

📋 Seus dados já estão cadastrados no sistema.

Quer conhecer nosso catálogo de produtos? Me responde aqui!

Obrigado pela confiança! 🤝`;
        }
    },
    {
        id: 'ESCASSEZ',
        name: 'Urgência / Escassez',
        icon: '⚡',
        description: 'Estoque acabando — gatilho de urgência',
        color: 'from-red-500 to-rose-500',
        generate: (client, ctx) => {
            const produtos = ctx?.produtosEstoque || [];
            const lista = produtos.length > 0
                ? produtos.map(p => `🥩 ${p.nome} — ÚLTIMOS ${p.peso.toFixed(0)}kg — R$${p.preco.toFixed(2)}/kg`).join('\n')
                : '🥩 Diversos cortes com estoque limitado';
            return `⚡ AVISO URGENTE — ${client.nome_social}!

Estoque acabando! Só resta:

${lista}

🔴 Quando acabar, nova remessa só na semana que vem!

Quer que eu reserve pra você? Responde rápido! ⏰`;
        }
    },
    {
        id: 'ANIVERSARIO',
        name: 'Aniversário / Data Especial',
        icon: '🎂',
        description: 'Felicitações e oferta especial',
        color: 'from-pink-500 to-rose-500',
        generate: (client) => {
            return `🎂 Parabéns, ${client.nome_social}!

Hoje é um dia especial e queremos celebrar com você! 🎉

🎁 PRESENTE: 10% de desconto na próxima compra!
Válido por 7 dias. É só mencionar esta mensagem.

Obrigado por ser nosso parceiro! 🤝`;
        }
    },
    {
        id: 'CATALOGO',
        name: 'Catálogo Digital',
        icon: '📦',
        description: 'Lista completa de produtos disponíveis',
        color: 'from-indigo-500 to-blue-500',
        generate: (client, ctx) => {
            const produtos = ctx?.produtosEstoque || [];
            const lista = produtos.length > 0
                ? produtos.map(p => `${p.diasNaCamara <= 3 ? '🟢' : p.diasNaCamara <= 6 ? '🟡' : '🔴'} ${p.nome} — ${p.peso.toFixed(1)}kg — R$${p.preco.toFixed(2)}/kg (${p.diasNaCamara}d na câmara)`).join('\n')
                : 'Consulte nosso atendimento para produtos disponíveis.';
            return `📦 CATÁLOGO FRIGOGEST — ${new Date().toLocaleDateString('pt-BR')}

Olá ${client.nome_social}! Nossos produtos disponíveis AGORA:

${lista}

🟢 = Fresquíssimo (1-3 dias)
🟡 = Fresco (4-6 dias)  
🔴 = Promoção (7-8 dias) com desconto!

Faça seu pedido respondendo esta mensagem! 🤝
Entregamos no endereço combinado.`;
        }
    }
];

// ═══ GERAR CATÁLOGO A PARTIR DO ESTOQUE ═══
export function generateCatalogFromStock(stock: StockItem[], sales: Sale[]): { nome: string; peso: number; preco: number; diasNaCamara: number }[] {
    const now = new Date();
    const disponivel = stock.filter(s => s.status === 'DISPONIVEL');
    
    // Pegar preço médio de vendas recentes para cada tipo
    const precoMedio = sales
        .filter(s => s.status_pagamento !== 'ESTORNADO')
        .reduce((acc, s) => {
            acc.total += s.preco_venda_kg;
            acc.count++;
            return acc;
        }, { total: 0, count: 0 });
    
    const precoRef = precoMedio.count > 0 ? precoMedio.total / precoMedio.count : 25;

    return disponivel.map(s => {
        const dias = Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000);
        const tipoNome = s.tipo === 1 ? 'Inteiro' : s.tipo === 2 ? 'Banda A (Dianteiro)' : 'Banda B (Traseiro)';
        // Desconto progressivo por idade (carne max 8 dias)
        const desconto = dias >= 7 ? 0.80 : dias >= 6 ? 0.90 : dias >= 5 ? 0.95 : 1.0;
        return {
            nome: `${tipoNome} (Lote ${s.id_lote})`,
            peso: s.peso_entrada,
            preco: Math.round(precoRef * desconto * 100) / 100,
            diasNaCamara: dias
        };
    }).sort((a, b) => b.diasNaCamara - a.diasNaCamara); // Mais antigos primeiro (FIFO)
}

// ═══ SELECIONAR TEMPLATE INTELIGENTE ═══
export function suggestTemplateForClient(client: Client, sales: Sale[]): TemplateType {
    const clientSales = sales.filter(s => s.id_cliente === client.id_ferro && s.status_pagamento !== 'ESTORNADO');
    const now = new Date();
    
    // Cobrança se tem saldo devedor
    if (client.saldo_devedor > 0) return 'COBRANCA';
    
    // Reativação se sem compras há 15+ dias
    if (clientSales.length > 0) {
        const ultimaVenda = new Date(clientSales.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0].data_venda);
        const diasInativo = Math.floor((now.getTime() - ultimaVenda.getTime()) / 86400000);
        if (diasInativo >= 15) return 'REATIVACAO';
        if (diasInativo >= 1 && diasInativo <= 3) return 'NPS';
    }
    
    // Boas-vindas se nunca comprou
    if (clientSales.length === 0) return 'BOAS_VINDAS';
    
    // Default
    return 'CATALOGO';
}

// ═══ GERAR LINK WA.ME ═══
export function generateWhatsAppLinkFromTemplate(phone: string, message: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}
