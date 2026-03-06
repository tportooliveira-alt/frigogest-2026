// ═══ CONTENT STUDIO SERVICE — FrigoGest 2026 ═══
// Geração real de imagem + copy + hashtags acionada pela Isabela
// Fluxo: Isabela detecta oportunidade → gera conteúdo → dono aprova → WhatsApp abre pronto

import { GoogleGenAI } from '@google/genai';

export type ContentType = 'PROMO_ESCASSEZ' | 'REATIVACAO' | 'LANCAMENTO' | 'COMBO' | 'BASTIDORES' | 'DICA_TECNICA';

export interface ContentStudioRequest {
    type: ContentType;
    // Dados reais injetados pelo agente
    clientName?: string;
    clientPhone?: string;
    clientDaysInactive?: number;
    stockItem?: { tipo: string; pesoKg: number; diasCamara: number; precoKg?: number };
    customContext?: string; // contexto livre da Isabela
}

export interface GeneratedContent {
    imageUrl: string | null;        // base64 data URL ou null se falhou
    imagePrompt: string;
    copyWhatsApp: string;           // mensagem pronta para WhatsApp (≤300 chars)
    copyInstagram: string;          // legenda para Instagram
    hashtags: string;
    subject: string;                // título do conteúdo
    approved: boolean;              // sempre false até o dono aprovar
    generatedAt: Date;
    type: ContentType;
    clientPhone?: string;
    clientName?: string;
}

// ─── Monta prompt de imagem baseado no tipo de conteúdo ───
function buildImagePrompt(req: ContentStudioRequest): string {
    const base = 'Fotografia comercial profissional para distribuidora de carnes bovina brasileira. ';
    const style = 'Iluminação quente, fundo escuro, visual premium, apetitoso, alta qualidade, sem texto.';

    switch (req.type) {
        case 'PROMO_ESCASSEZ':
            return `${base}Cortes de carne bovina frescos (${req.stockItem?.tipo || 'traseiro bovino'}) em tábua de madeira escura com ervas frescas. Urgência visual, cores quentes. ${style}`;
        case 'REATIVACAO':
            return `${base}Mesa de churrasco familiar farta com picanha grelhada e brasas, clima de celebração e nostalgia. ${style}`;
        case 'LANCAMENTO':
            return `${base}Corte nobre de carne bovina em close, faca profissional ao lado, apresentação de chef, sofisticado. ${style}`;
        case 'COMBO':
            return `${base}Dois ou três cortes bovinos complementares (dianteiro e traseiro) dispostos em tábua rústica, visual de kit completo. ${style}`;
        case 'BASTIDORES':
            return `${base}Interior de frigorífico profissional limpo, câmara fria moderna, controle de qualidade, visual de confiança e transparência. ${style}`;
        case 'DICA_TECNICA':
            return `${base}Açougueiro profissional demonstrando corte preciso de carne bovina, facas cirúrgicas, avental, visual educativo e profissional. ${style}`;
        default:
            return `${base}Carne bovina brasileira de qualidade em apresentação premium. ${style}`;
    }
}

// ─── Gera copy + hashtags via Claude (ou Gemini como fallback) ───
async function generateCopy(req: ContentStudioRequest, anthropicKey?: string): Promise<{ copyWhatsApp: string; copyInstagram: string; hashtags: string; subject: string }> {
    const contextMap: Record<ContentType, string> = {
        PROMO_ESCASSEZ: req.stockItem
            ? `Temos ${req.stockItem.pesoKg.toFixed(0)}kg de ${req.stockItem.tipo} com ${req.stockItem.diasCamara} dias na câmara${req.stockItem.precoKg ? ` a R$${req.stockItem.precoKg.toFixed(2)}/kg` : ''}. Precisa sair hoje. Crie urgência real (escassez, sem mentira).`
            : 'Promoção relâmpago de cortes bovinos. Urgência e escassez real.',
        REATIVACAO: req.clientName
            ? `Cliente ${req.clientName} está há ${req.clientDaysInactive} dias sem comprar. Crie mensagem de reativação calorosa, com saudade real, sem ser insistente. Use o nome dele.`
            : 'Mensagem de reativação para cliente que sumiu.',
        LANCAMENTO: req.customContext || 'Novo corte ou produto chegou. Destaque exclusividade.',
        COMBO: req.stockItem
            ? `Combo de ${req.stockItem.tipo} — aproveite o desequilíbrio de estoque para criar oferta irresistível.`
            : 'Combo especial de cortes bovinos.',
        BASTIDORES: 'Bastidores do frigorífico. Transparência, qualidade, higiene e cuidado com a carne.',
        DICA_TECNICA: req.customContext || 'Dica técnica sobre corte ou preparo de carne bovina.',
    };

    const systemPrompt = `Você é redator especialista em marketing B2B para distribuidoras de carne bovina no Brasil.
Gere conteúdo REAL, com dados específicos. NUNCA invente certificações ou prêmios.
Responda APENAS com JSON válido, sem markdown, sem explicações.`;

    const userPrompt = `Contexto: ${contextMap[req.type]}
    
Gere:
{
  "subject": "título curto do post (máx 8 palavras)",
  "copyWhatsApp": "mensagem direta para WhatsApp (máx 280 chars, emoji no início, CTA no final, tom de conversa real entre conhecidos)",
  "copyInstagram": "legenda para Instagram (3-5 linhas, quebra de linha com \\n, tom mais elaborado, CTA para chamar no WhatsApp)",
  "hashtags": "8 hashtags relevantes separadas por espaço (mix: nicho + local + geral)"
}`;

    // Tenta Claude primeiro
    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-haiku-4-5',
                max_tokens: 600,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            }),
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const clean = text.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
    } catch {
        // Fallback: Gemini Flash
        const geminiKey = (import.meta as any)?.env?.VITE_AI_API_KEY || (import.meta as any)?.env?.VITE_GEMINI_API_KEY || '';
        if (geminiKey) {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            const r = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: { parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
            });
            const text = r.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const clean = text.replace(/```json|```/g, '').trim();
            return JSON.parse(clean);
        }
        // Fallback hardcoded
        return {
            subject: 'Promoção Especial',
            copyWhatsApp: req.clientName
                ? `🥩 ${req.clientName}, temos novidade pra você! Estoque fresquinho chegando. Chama no zap! 👊`
                : '🥩 Promoção especial hoje! Cortes frescos com preço especial. Chama pra saber! 👊',
            copyInstagram: 'Qualidade que você já conhece, preço que você vai amar.\n\nNovidades chegando toda semana.\nChama no WhatsApp e garante o seu! 🔥',
            hashtags: '#carnebovina #frigorifico #distribuidora #churrasco #cortesbovinos #qualidade #picanha #brasil',
        };
    }
}

// ─── Gera imagem via Gemini/Imagen ───
async function generateImage(prompt: string): Promise<string | null> {
    const key = (import.meta as any)?.env?.VITE_AI_API_KEY || (import.meta as any)?.env?.VITE_GEMINI_API_KEY || '';
    if (!key) return null;

    try {
        const ai = new GoogleGenAI({ apiKey: key });

        // Tenta Imagen 3 primeiro
        try {
            const r = await (ai.models as any).generateImages({
                model: 'imagen-3.0-generate-002',
                prompt,
                config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
            });
            const b64 = r?.generatedImages?.[0]?.image?.imageBytes;
            if (b64) return `data:image/jpeg;base64,${b64}`;
        } catch {
            // fallback Gemini Flash
        }

        // Fallback Gemini 2.0 Flash
        const r2 = await ai.models.generateContent({
            model: 'gemini-2.0-flash-preview-image-generation',
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: ['TEXT', 'IMAGE'] as any },
        });
        const parts = r2.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
            if ((p as any).inlineData) {
                const { mimeType, data: b64 } = (p as any).inlineData;
                return `data:${mimeType};base64,${b64}`;
            }
        }
        return null;
    } catch {
        return null;
    }
}

// ─── FUNÇÃO PRINCIPAL: gera tudo em paralelo ───
export async function generateContent(req: ContentStudioRequest): Promise<GeneratedContent> {
    const imagePrompt = buildImagePrompt(req);

    // Imagem + copy em paralelo
    const [imageUrl, copy] = await Promise.all([
        generateImage(imagePrompt),
        generateCopy(req),
    ]);

    return {
        imageUrl,
        imagePrompt,
        ...copy,
        approved: false,
        generatedAt: new Date(),
        type: req.type,
        clientPhone: req.clientPhone,
        clientName: req.clientName,
    };
}

// ─── Detecta se a resposta da Isabela pede criação de conteúdo ───
export function detectContentRequest(text: string): ContentStudioRequest | null {
    const lower = text.toLowerCase();

    if (/escassez|perde.*dia|vencendo|urgente.*vend|dias na câmara|relâmpago/i.test(text)) {
        const kgMatch = text.match(/(\d+[\.,]?\d*)\s*kg/i);
        const diasMatch = text.match(/(\d+)\s*dias? (na câmara|de câmara)/i);
        const precoMatch = text.match(/R\$\s*([\d.,]+)\s*\/?\s*kg/i);
        return {
            type: 'PROMO_ESCASSEZ',
            stockItem: {
                tipo: /dianteiro/i.test(text) ? 'Dianteiro Bovino' : /traseiro/i.test(text) ? 'Traseiro Bovino' : 'Inteiro Bovino',
                pesoKg: kgMatch ? parseFloat(kgMatch[1].replace(',', '.')) : 100,
                diasCamara: diasMatch ? parseInt(diasMatch[1]) : 7,
                precoKg: precoMatch ? parseFloat(precoMatch[1].replace(',', '.')) : undefined,
            },
        };
    }

    if (/reativ|reconquist|dias sem comprar|sumiu|saudade/i.test(text)) {
        // tenta extrair nome e dias
        const diasMatch = text.match(/(\d+)\s*dias? sem comprar/i);
        return {
            type: 'REATIVACAO',
            clientDaysInactive: diasMatch ? parseInt(diasMatch[1]) : undefined,
        };
    }

    if (/combo|kit|dianteiro.*traseiro|pacote/i.test(text)) {
        return { type: 'COMBO' };
    }

    if (/bastidores|transparência|nossa produção|mostr/i.test(text)) {
        return { type: 'BASTIDORES' };
    }

    if (/dica.*técnica|como cortar|como armazenar|temperatura.*carne/i.test(text)) {
        return { type: 'DICA_TECNICA', customContext: text.substring(0, 300) };
    }

    return null;
}
