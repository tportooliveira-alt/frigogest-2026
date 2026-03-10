import { GoogleGenAI } from '@google/genai';
import { AgentType } from '../types';

// ═══ AI HIERARCHY — 4 Tiers ═══
export type AITier = 'PEAO' | 'ESTAGIARIO' | 'FUNCIONARIO' | 'GERENTE' | 'MESTRA';

export interface CascadeProvider {
    name: string;
    tier: AITier;
    call: (prompt: string) => Promise<string>;
}

export const AGENT_TIER_MAP: Record<string, AITier> = {
    // Top-Tier (Alto QI / Alto Custo / Orquestração e Análise Profunda)
    'ADMINISTRATIVO': 'MESTRA', // Dona Clara (Gemini Pro)
    'PROFESSOR': 'MESTRA',      // Menthor (Gemini Pro)
    'AUDITOR': 'MESTRA',        // Dra. Beatriz (Forensic exige Alto QI)

    // Mid-Tier (Modelos Rápidos / Gerenciais)
    'COMERCIAL': 'GERENTE',
    'MERCADO': 'GERENTE',
    'MARKETING': 'GERENTE',
    'JURIDICO': 'GERENTE',

    // Operários de Dados (Força Bruta Barata e Ultrarápida)
    'PRODUCAO': 'FUNCIONARIO',
    'ESTOQUE': 'FUNCIONARIO',
    'COMPRAS': 'FUNCIONARIO',
    'FLUXO_CAIXA': 'FUNCIONARIO',
    'RH_GESTOR': 'FUNCIONARIO',
    'FISCAL_CONTABIL': 'FUNCIONARIO',
    'QUALIDADE': 'FUNCIONARIO',

    // PEÕES (Resposta Imediata via Llama3 8B / Flash)
    'SATISFACAO': 'PEAO',
    'WHATSAPP_BOT': 'PEAO',
    'COBRANCA': 'PEAO',
};

const TIER_FALLBACK: Record<AITier, AITier[]> = {
    'PEAO': ['PEAO', 'ESTAGIARIO', 'FUNCIONARIO', 'GERENTE', 'MESTRA'],
    'ESTAGIARIO': ['ESTAGIARIO', 'PEAO', 'FUNCIONARIO', 'GERENTE', 'MESTRA'],
    'FUNCIONARIO': ['FUNCIONARIO', 'ESTAGIARIO', 'PEAO', 'GERENTE', 'MESTRA'],
    'GERENTE': ['GERENTE', 'FUNCIONARIO', 'MESTRA', 'ESTAGIARIO', 'PEAO'],
    'MESTRA': ['MESTRA', 'GERENTE', 'FUNCIONARIO', 'ESTAGIARIO', 'PEAO'],
};

const CHAT_FREE_TIERS: AITier[] = ['PEAO', 'ESTAGIARIO'];
const CHAT_PREMIUM_AGENTS = ['ADMINISTRATIVO', 'AUDITOR'];
const CHAT_PAID_PROVIDERS = ['Gemini Pro', 'Gemini Flash', 'Mistral Large'];

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const _chatCache = new Map<string, { text: string; provider: string; ts: number }>();
const CHAT_CACHE_TTL = 5 * 60 * 1000;

function _chatCacheKey(prompt: string, agentId?: string) {
    return (agentId || 'G') + '::' + prompt.slice(-200).replace(/\s+/g, ' ');
}

function withChatTimeout<T,>(p: Promise<T>, ms = 18000): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

const buildAllProviders = (): CascadeProvider[] => {
    const providers: CascadeProvider[] = [];
    const geminiKey = (import.meta as any).env.VITE_AI_API_KEY as string || '';
    const groqKey = (import.meta as any).env.VITE_GROQ_API_KEY as string || '';
    const cerebrasKey = (import.meta as any).env.VITE_CEREBRAS_API_KEY as string || '';
    const openrouterKey = (import.meta as any).env.VITE_OPENROUTER_API_KEY as string || '';
    const togetherKey = (import.meta as any).env.VITE_TOGETHER_API_KEY as string || '';
    const deepseekKey = (import.meta as any).env.VITE_DEEPSEEK_API_KEY as string || '';
    const siliconflowKey = (import.meta as any).env.VITE_SILICONFLOW_API_KEY as string || '';
    const mistralKey = (import.meta as any).env.VITE_MISTRAL_API_KEY as string || '';

    const TIER_MAX_TOKENS: Record<AITier, number> = {
        PEAO: 300, ESTAGIARIO: 512, FUNCIONARIO: 768, GERENTE: 1024, MESTRA: 2048
    };

    const oai = (name: string, tier: AITier, url: string, key: string, model: string): CascadeProvider => ({
        name, tier, call: async (prompt: string) => {
            const res = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: TIER_MAX_TOKENS[tier], temperature: 0.2 })
            });
            if (!res.ok) throw new Error(`${name} ${res.status}`);
            const data = await res.json(); return data.choices?.[0]?.message?.content || '';
        },
    });

    if (geminiKey) providers.push({
        name: 'Gemini Pro', tier: 'MESTRA', call: async (p) => {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            try {
                const r = await ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: { parts: [{ text: p }] },
                    config: { tools: [{ googleSearch: {} }], maxOutputTokens: 2048, temperature: 0.2 }
                });
                return r.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } catch (e: any) {
                const fb = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: { parts: [{ text: p }] }, config: { maxOutputTokens: 2048, temperature: 0.2 } });
                return fb.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
        }
    });

    if (geminiKey) providers.push({
        name: 'Gemini Flash', tier: 'GERENTE', call: async (p) => {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            try {
                const r = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [{ text: p }] },
                    config: { tools: [{ googleSearch: {} }], maxOutputTokens: 1024, temperature: 0.2 }
                });
                return r.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } catch (e: any) {
                const fb = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: p }] }, config: { maxOutputTokens: 1024, temperature: 0.2 } });
                return fb.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
        }
    });

    if (mistralKey) providers.push(oai('Mistral Large', 'GERENTE', 'https://api.mistral.ai/v1/chat/completions', mistralKey, 'mistral-large-latest'));
    if (deepseekKey) providers.push(oai('DeepSeek V3', 'FUNCIONARIO', 'https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-chat'));
    if (groqKey) providers.push(oai('Groq 70B', 'FUNCIONARIO', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.3-70b-versatile'));
    if (siliconflowKey) providers.push(oai('SiliconFlow', 'FUNCIONARIO', 'https://api.siliconflow.cn/v1/chat/completions', siliconflowKey, 'deepseek-ai/DeepSeek-V3'));
    if (togetherKey) providers.push(oai('Together 70B', 'FUNCIONARIO', 'https://api.together.xyz/v1/chat/completions', togetherKey, 'meta-llama/Llama-3.3-70B-Instruct-Turbo'));
    if (openrouterKey) providers.push(oai('OpenRouter', 'FUNCIONARIO', 'https://openrouter.ai/api/v1/chat/completions', openrouterKey, 'deepseek/deepseek-chat-v3-0324:free'));
    if (cerebrasKey) providers.push(oai('Cerebras 8B', 'ESTAGIARIO', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'llama3.1-8b'));
    if (groqKey) providers.push(oai('Groq 8B', 'ESTAGIARIO', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.1-8b-instant'));
    if (deepseekKey) providers.push(oai('DeepSeek R1', 'GERENTE', 'https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-reasoner'));
    if (mistralKey) providers.push(oai('Ministral 3B', 'ESTAGIARIO', 'https://api.mistral.ai/v1/chat/completions', mistralKey, 'ministral-3b-latest'));
    if (cerebrasKey) providers.push(oai('Cerebras Peao', 'PEAO', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'llama3.1-8b'));
    if (groqKey) providers.push(oai('Groq Peao', 'PEAO', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'gemma2-9b-it'));

    return providers;
};

export const runCascade = async (prompt: string, agentId?: string): Promise<{ text: string; provider: string }> => {
    const cKey = _chatCacheKey(prompt, agentId);
    const hit = _chatCache.get(cKey);
    if (hit && Date.now() - hit.ts < CHAT_CACHE_TTL) return { text: hit.text, provider: `${hit.provider} (cache)` };

    const allProviders = buildAllProviders();
    if (!allProviders.length) throw new Error('Nenhuma chave de IA configurada.');

    const agentIdStr = (agentId as unknown as string);
    const preferredTier: AITier = agentIdStr ? (AGENT_TIER_MAP[agentIdStr] || 'GERENTE') : 'GERENTE';
    const isPremium = CHAT_PREMIUM_AGENTS.includes(agentIdStr || '');
    const freeOnly = CHAT_FREE_TIERS.includes(preferredTier) && !isPremium;

    const sorted: CascadeProvider[] = [];
    for (const tier of TIER_FALLBACK[preferredTier]) {
        for (const p of allProviders.filter(p => p.tier === tier)) {
            if (freeOnly && CHAT_PAID_PROVIDERS.includes(p.name)) continue;
            sorted.push(p);
        }
    }
    if (!sorted.length) throw new Error('Nenhum provider disponível.');

    for (const p of sorted) {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const text = await withChatTimeout(p.call(prompt), 18000);
                if (text) {
                    const label = p.tier === preferredTier ? '' : ` ↑${p.tier}`;
                    const result = { text, provider: `${p.name}${label}` };
                    _chatCache.set(cKey, { ...result, ts: Date.now() });
                    return result;
                }
                break;
            } catch (e: any) {
                const msg = e.message || '';
                const is429 = msg.includes('429') || msg.toLowerCase().includes('rate');
                const is500 = msg.includes('500') || msg.includes('503');
                if ((is429 || is500) && attempt < 2) {
                    await delay(1000 * Math.pow(2, attempt));
                    continue;
                }
                break;
            }
        }
    }
    throw new Error('Falha em todos os providers de IA.');
};
