import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft, Send, MessageCircle, Users, Clock,
    Brain, Shield, TrendingUp, BarChart3, Package,
    DollarSign, Truck, Bot, Loader2, Sparkles,
    ChevronRight, Activity, Mic, MicOff, ShieldCheck, Zap,
    Search, FileText, Smartphone, CalendarDays, Thermometer, Banknote
} from 'lucide-react';

import { GoogleGenAI } from '@google/genai';
import {
    AgentType, Batch, StockItem, Sale, Client,
    Transaction, Supplier, Payable, ScheduledOrder
} from '../types';
import { OrchestrationResult } from '../services/orchestratorService';
import { OrchestratorView } from './OrchestratorView';

// ═══ AI HIERARCHY — 4 Tiers (same as AIAgents) ═══
type AITier = 'PEAO' | 'ESTAGIARIO' | 'FUNCIONARIO' | 'GERENTE' | 'MESTRA';
interface CascadeProvider { name: string; tier: AITier; call: (prompt: string) => Promise<string>; }

const AGENT_TIER_MAP: Record<string, AITier> = {
    // Core (12 agentes)
    'ADMINISTRATIVO': 'MESTRA', 'PRODUCAO': 'FUNCIONARIO', 'COMERCIAL': 'GERENTE',
    'AUDITOR': 'GERENTE', 'ESTOQUE': 'FUNCIONARIO', 'COMPRAS': 'FUNCIONARIO',
    'MERCADO': 'GERENTE', 'MARKETING': 'GERENTE', 'SATISFACAO': 'PEAO',
    'WHATSAPP_BOT': 'PEAO', 'COBRANCA': 'PEAO', 'JURIDICO': 'FUNCIONARIO',
    // Orquestração
    'FLUXO_CAIXA': 'FUNCIONARIO',
    // Opcionais
    'RH_GESTOR': 'ESTAGIARIO', 'FISCAL_CONTABIL': 'ESTAGIARIO', 'QUALIDADE': 'ESTAGIARIO',
};


const TIER_FALLBACK: Record<AITier, AITier[]> = {
    'PEAO': ['PEAO', 'ESTAGIARIO', 'FUNCIONARIO', 'GERENTE', 'MESTRA'],
    'ESTAGIARIO': ['ESTAGIARIO', 'PEAO', 'FUNCIONARIO', 'GERENTE', 'MESTRA'],
    'FUNCIONARIO': ['FUNCIONARIO', 'ESTAGIARIO', 'PEAO', 'GERENTE', 'MESTRA'],
    'GERENTE': ['GERENTE', 'FUNCIONARIO', 'MESTRA', 'ESTAGIARIO', 'PEAO'],
    'MESTRA': ['MESTRA', 'GERENTE', 'FUNCIONARIO', 'ESTAGIARIO', 'PEAO'],
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══ CACHE (5 min) — evita gastar créditos repetindo a mesma chamada ═══
const _chatCache = new Map<string, { text: string; provider: string; ts: number }>();
const CHAT_CACHE_TTL = 5 * 60 * 1000;
function _chatCacheKey(prompt: string, agentId?: string) {
    return (agentId || 'G') + '::' + prompt.slice(0, 180).replace(/\s+/g, ' ');
}
function withChatTimeout<T,>(p: Promise<T>, ms = 12000): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}
const CHAT_FREE_TIERS: AITier[] = ['PEAO', 'ESTAGIARIO'];
const CHAT_PREMIUM_AGENTS = ['ADMINISTRATIVO', 'AUDITOR'];
const CHAT_PAID_PROVIDERS = ['Gemini Pro', 'Gemini Flash', 'Mistral Large'];


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

    const oai = (name: string, tier: AITier, url: string, key: string, model: string): CascadeProvider => ({
        name, tier, call: async (prompt: string) => {
            const res = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 2048 })
            });
            if (!res.ok) throw new Error(`${name} ${res.status}`);
            const data = await res.json(); return data.choices?.[0]?.message?.content || '';
        },
    });

    // MESTRA
    if (geminiKey) providers.push({
        name: 'Gemini Pro', tier: 'MESTRA', call: async (p) => {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            try {
                const r = await ai.models.generateContent({
                    model: 'gemini-2.5-pro',
                    contents: { parts: [{ text: p }] },
                    config: { tools: [{ googleSearch: {} }] }
                });
                const t = r.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!t) throw new Error('Gemini Pro vazio');
                return t;
            } catch (e: any) {
                if (e.message?.includes('googleSearch') || e.message?.includes('tool')) {
                    const fb = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: { parts: [{ text: p }] } });
                    return fb.candidates?.[0]?.content?.parts?.[0]?.text || '';
                }
                throw e;
            }
        }
    });
    // GERENTE
    if (geminiKey) providers.push({
        name: 'Gemini Flash', tier: 'GERENTE', call: async (p) => {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            try {
                const r = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [{ text: p }] },
                    config: { tools: [{ googleSearch: {} }] }
                });
                const t = r.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!t) throw new Error('Gemini Flash vazio');
                return t;
            } catch (e: any) {
                if (e.message?.includes('googleSearch') || e.message?.includes('tool')) {
                    const fb = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: p }] } });
                    return fb.candidates?.[0]?.content?.parts?.[0]?.text || '';
                }
                throw e;
            }
        }
    });
    if (mistralKey) providers.push(oai('Mistral Large', 'GERENTE', 'https://api.mistral.ai/v1/chat/completions', mistralKey, 'mistral-large-latest'));
    // FUNCIONÁRIO
    if (deepseekKey) providers.push(oai('DeepSeek V3', 'FUNCIONARIO', 'https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-chat'));
    if (groqKey) providers.push(oai('Groq 70B', 'FUNCIONARIO', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.3-70b-versatile'));
    if (siliconflowKey) providers.push(oai('SiliconFlow', 'FUNCIONARIO', 'https://api.siliconflow.cn/v1/chat/completions', siliconflowKey, 'deepseek-ai/DeepSeek-V3'));
    if (togetherKey) providers.push(oai('Together 70B', 'FUNCIONARIO', 'https://api.together.xyz/v1/chat/completions', togetherKey, 'meta-llama/Llama-3.3-70B-Instruct-Turbo'));
    if (openrouterKey) providers.push(oai('OpenRouter', 'FUNCIONARIO', 'https://openrouter.ai/api/v1/chat/completions', openrouterKey, 'deepseek/deepseek-chat-v3-0324:free'));
    // ESTAGIÁRIO
    if (cerebrasKey) providers.push(oai('Cerebras 8B', 'ESTAGIARIO', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'llama3.1-8b'));
    if (groqKey) providers.push(oai('Groq 8B', 'ESTAGIARIO', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'llama-3.1-8b-instant'));
    if (deepseekKey) providers.push(oai('DeepSeek R1', 'GERENTE', 'https://api.deepseek.com/chat/completions', deepseekKey, 'deepseek-reasoner'));
    if (mistralKey) providers.push(oai('Ministral 3B', 'ESTAGIARIO', 'https://api.mistral.ai/v1/chat/completions', mistralKey, 'ministral-3b-latest'));
    // PEÃO
    if (cerebrasKey) providers.push(oai('Cerebras Peao', 'PEAO', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, 'llama3.1-8b'));
    if (groqKey) providers.push(oai('Groq Peao', 'PEAO', 'https://api.groq.com/openai/v1/chat/completions', groqKey, 'gemma2-9b-it'));

    return providers;
};

export const runCascade = async (prompt: string, agentId?: string): Promise<{ text: string; provider: string }> => {
    // Cache
    const cKey = _chatCacheKey(prompt, agentId);
    const hit = _chatCache.get(cKey);
    if (hit && Date.now() - hit.ts < CHAT_CACHE_TTL) return { text: hit.text, provider: `${hit.provider} (cache)` };

    const allProviders = buildAllProviders();
    if (!allProviders.length) throw new Error('Nenhuma chave de IA configurada.');

    const preferredTier: AITier = agentId ? (AGENT_TIER_MAP[agentId] || 'GERENTE') : 'GERENTE';
    const isPremium = CHAT_PREMIUM_AGENTS.includes(agentId || '');
    const freeOnly = CHAT_FREE_TIERS.includes(preferredTier) && !isPremium;

    const sorted: CascadeProvider[] = [];
    for (const tier of TIER_FALLBACK[preferredTier]) {
        for (const p of allProviders.filter(p => p.tier === tier)) {
            if (freeOnly && CHAT_PAID_PROVIDERS.includes(p.name)) continue;
            sorted.push(p);
        }
    }
    if (!sorted.length) throw new Error('Nenhum provider gratuito disponível. Configure VITE_GROQ_API_KEY.');

    const errors: string[] = [];
    for (const p of sorted) {
        let lastErr = '';
        // Backoff exponencial: até 3 tentativas para erros de rate limit (429) ou server error (500)
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const text = await withChatTimeout(p.call(prompt), 18000);
                if (text) {
                    const label = p.tier === preferredTier ? '' : ` ↑${p.tier}`;
                    const result = { text, provider: `${p.name}${label}` };
                    _chatCache.set(cKey, { ...result, ts: Date.now() });
                    return result;
                }
                break; // texto vazio mas sem erro — vai para próximo provider
            } catch (e: any) {
                const msg = e.message || '';
                const is429 = msg.includes('429') || msg.toLowerCase().includes('rate');
                const is500 = msg.includes('500') || msg.includes('503');
                lastErr = msg.includes('timeout') ? 'timeout 18s' : msg.slice(0, 80);
                if ((is429 || is500) && attempt < 2) {
                    const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
                    console.warn(`[CHAT CASCADE] ${p.name} ${is429 ? '429 rate-limit' : '500 erro'} — aguardando ${waitMs}ms (tentativa ${attempt + 1}/3)`);
                    await delay(waitMs);
                    continue; // tenta de novo
                }
                break; // erro não recuperável — próximo provider
            }
        }
        if (lastErr) {
            errors.push(`${p.name}: ${lastErr}`);
            console.warn(`[CHAT CASCADE] ${p.name} falhou após tentativas, próximo provider...`);
        }
    }
};



// ═══ AGENT DEFS ═══
interface AgentDef {
    id: AgentType;
    name: string;
    role: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
}

const AGENTS: AgentDef[] = [
    { id: 'ADMINISTRATIVO', name: 'Dona Clara', role: 'Administradora Geral & IA Máxima', icon: Brain, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    { id: 'PRODUCAO', name: 'Seu Antônio', role: 'Chefe de Produção', icon: Activity, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    { id: 'COMERCIAL', name: 'Marcos', role: 'Diretor Comercial+ (CRM/Growth)', icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'AUDITOR', name: 'Dra. Beatriz', role: 'Auditora+ (Forensic)', icon: Shield, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
    { id: 'ESTOQUE', name: 'Joaquim', role: 'Gerente de Estoque+ (FIFO/Lean)', icon: Package, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
    { id: 'COMPRAS', name: 'Roberto', role: 'Diretor de Suprimentos+', icon: Truck, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
    { id: 'MERCADO', name: 'Ana', role: 'Inteligência de Mercado', icon: BarChart3, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
    { id: 'MARKETING', name: 'Isabela', role: 'CMO 360° (Copy+Social+SEO+Ads)', icon: Sparkles, color: 'text-pink-600', bgColor: 'bg-pink-50', borderColor: 'border-pink-200' },
    { id: 'SATISFACAO', name: 'Camila', role: 'Customer Experience (NPS)', icon: MessageCircle, color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
    { id: 'COBRANCA', name: 'Diana', role: 'Cobrança Inteligente', icon: Banknote, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    { id: 'WHATSAPP_BOT', name: 'Wellington', role: 'Bot WhatsApp', icon: Smartphone, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    { id: 'JURIDICO', name: 'Dra. Carla', role: 'Advogada Chefe+ (Completa)', icon: Shield, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
    // Orquestração
    { id: 'FLUXO_CAIXA', name: 'Mateus', role: 'Tesoureiro & Fluxo de Caixa', icon: Banknote, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    // Opcionais
    { id: 'RH_GESTOR', name: 'João Paulo', role: 'Gestor de RH', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'FISCAL_CONTABIL', name: 'Mariana', role: 'Contadora Tributária', icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    { id: 'QUALIDADE', name: 'Dr. Ricardo', role: 'Méd. Veterinário & Qualidade', icon: Shield, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
];

// ═══ TYPES ═══
interface ChatMessage {
    id: string;
    role: 'user' | 'agent';
    agent?: AgentType;
    text: string;
    timestamp: Date;
    provider?: string;
}

interface LogEntry {
    id: string;
    agent: AgentType;
    action: string;
    timestamp: Date;
    provider: string;
}

type ChatTab = 'chat' | 'meeting' | 'orquestrador' | 'log';

interface Props {
    onBack: () => void;
    batches: Batch[];
    stock: StockItem[];
    sales: Sale[];
    clients: Client[];
    transactions: Transaction[];
    suppliers: Supplier[];
    payables: Payable[];
    scheduledOrders: ScheduledOrder[];
}

// ═══ MAIN COMPONENT ═══
const AIChat: React.FC<Props> = ({
    onBack, batches, stock, sales, clients,
    transactions, suppliers, payables, scheduledOrders
}) => {
    const [activeTab, setActiveTab] = useState<ChatTab>('chat');
    const [selectedAgent, setSelectedAgent] = useState<AgentType>('ADMINISTRATIVO');
    const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
    const [meetingMessages, setMeetingMessages] = useState<ChatMessage[]>([]);
    const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [meetingLoading, setMeetingLoading] = useState(false);
    const [showAgentList, setShowAgentList] = useState(false);
    const [orchestrationResult, setOrchestrationResult] = useState<OrchestrationResult | null>(null);
    const [isOrchestrating, setIsOrchestrating] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const meetingEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);
    const [isListening, setIsListening] = useState(false);

    // ═══ VOICE INPUT (Web Speech API) ═══
    const toggleMic = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('Microfone n\u00e3o suportado neste navegador.'); return; }
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const recog = new SpeechRecognition();
        recog.lang = 'pt-BR';
        recog.continuous = false;
        recog.interimResults = false;
        recog.onstart = () => setIsListening(true);
        recog.onresult = (e: any) => {
            const transcript = e.results[0][0].transcript;
            setInputText(prev => prev ? prev + ' ' + transcript : transcript);
        };
        recog.onend = () => setIsListening(false);
        recog.onerror = () => setIsListening(false);
        recog.start();
        recognitionRef.current = recog;
    }, [isListening]);

    const currentAgent = AGENTS.find(a => a.id === selectedAgent)!;
    const currentHistory = chatHistories[selectedAgent] || [];

    // Build data snapshot for context — detalhado por área
    const dataSnapshot = useMemo(() => {
        const hoje = new Date();
        const hojeStr = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        const agora = hoje.getTime();
        const msPerDay = 86400000;

        // ── LOTES ──
        const lotesAbertos = batches.filter(b => b.status === 'ABERTO');
        const lotesFechados = batches.filter(b => b.status === 'FECHADO');
        const lotesComRendimento = batches.filter(b => {
            const cab = (b as any).qtd_cabecas || 0;
            const vivo = (b as any).peso_vivo_medio || 0;
            return cab > 0 && vivo > 0; // Só conta se tem peso vivo para calcular correto
        });
        const rendimentoMedio = lotesComRendimento.length > 0
            ? lotesComRendimento.reduce((s, b) => {
                const pesoVivoTotal = ((b as any).qtd_cabecas || 0) * ((b as any).peso_vivo_medio || 0);
                const pesoCarcaca = (b as any).peso_gancho > 0 ? (b as any).peso_gancho : b.peso_total_romaneio;
                return s + (pesoVivoTotal > 0 ? (pesoCarcaca / pesoVivoTotal) * 100 : 0);
            }, 0) / lotesComRendimento.length
            : 0;
        const lotesComCusto = batches.filter(b => b.custo_real_kg && b.custo_real_kg > 0);
        const custoKgMedio = lotesComCusto.length > 0
            ? lotesComCusto.reduce((s, b) => s + (b.custo_real_kg || 0), 0) / lotesComCusto.length
            : 0;
        const lotesAntigos = lotesAbertos.filter(b => {
            const diasAberto = Math.floor((agora - new Date(b.data_recebimento).getTime()) / msPerDay);
            return diasAberto > 7;
        });
        const esgMedio = batches.length > 0 ? batches.reduce((s, b) => s + (b.esg_score || 0), 0) / batches.length : 0;
        const lotesComVision = batches.filter(b => b.vision_audit_status === 'APROVADO').length;
        const lotesComBlockchain = batches.filter(b => b.traceability_hash).length;

        // ── ESTOQUE ──
        const activeStock = stock.filter(s => s.status === 'DISPONIVEL');
        const totalKg = activeStock.reduce((s, i) => s + i.peso_entrada, 0);
        const pecasResfriando = activeStock.filter(i => Math.floor((agora - new Date(i.data_entrada).getTime()) / msPerDay) <= 1);
        const pecasPrimas = activeStock.filter(i => { const d = Math.floor((agora - new Date(i.data_entrada).getTime()) / msPerDay); return d >= 2 && d <= 4; });
        const pecasAlerta = activeStock.filter(i => { const d = Math.floor((agora - new Date(i.data_entrada).getTime()) / msPerDay); return d >= 5 && d <= 7; });
        const pecasCriticas = activeStock.filter(i => Math.floor((agora - new Date(i.data_entrada).getTime()) / msPerDay) > 7);
        const kgAlerta = pecasAlerta.reduce((s, i) => s + i.peso_entrada, 0);
        const kgCritico = pecasCriticas.reduce((s, i) => s + i.peso_entrada, 0);

        // ── VENDAS ──
        const hojeISO = hoje.toISOString().slice(0, 10);
        const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

        // Excluir vendas estornadas das métricas de receita
        const validSales = sales.filter(s => s.status_pagamento !== 'ESTORNADO');

        const vendasHoje = validSales.filter(s => s.data_venda?.slice(0, 10) === hojeISO);
        const vendasSemana = validSales.filter(s => new Date(s.data_venda) >= inicioSemana);
        const vendasMes = validSales.filter(s => new Date(s.data_venda) >= inicioMes);

        const receitaHoje = vendasHoje.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
        const receitaSemana = vendasSemana.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
        const receitaMes = vendasMes.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);

        const vendasPendentes = validSales.filter(s => s.status_pagamento === 'PENDENTE');
        // Receita pendente abatendo o que já foi pago parcialmente
        const receitaPendente = vendasPendentes.reduce((s, v) => s + ((v.peso_real_saida * v.preco_venda_kg) - ((v as any).valor_pago || 0)), 0);

        const margemMedia = validSales.length > 0
            ? validSales.reduce((s, v) => s + (v.lucro_liquido_unitario || 0), 0) / validSales.length
            : 0;

        const vendasVencidas = vendasPendentes.filter(v => {
            const venc = new Date(v.data_vencimento);
            return venc < hoje;
        });
        const valorVencido = vendasVencidas.reduce((s, v) => s + ((v.peso_real_saida * v.preco_venda_kg) - ((v as any).valor_pago || 0)), 0);

        // ── CLIENTES ──
        const clientesAtivos = clients.filter(c => c.status !== 'INATIVO');
        const clientesBloqueados = clientesAtivos.filter(c => c.saldo_devedor > c.limite_credito);
        const clientesAlertaCredito = clientesAtivos.filter(c => !clientesBloqueados.includes(c) && c.limite_credito > 0 && (c.saldo_devedor / c.limite_credito) > 0.8);
        const pedidosHoje = scheduledOrders.filter(s => s.data_entrega?.slice(0, 10) === hojeISO && s.status === 'ABERTO');
        const pedidosAmanha = scheduledOrders.filter(s => {
            const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
            return s.data_entrega?.slice(0, 10) === amanha.toISOString().slice(0, 10) && s.status === 'ABERTO';
        });

        // ── FINANCEIRO ──
        const closedBatches = batches.filter(b => b.status === 'FECHADO');
        const validLoteIds = new Set(closedBatches.map(b => b.id_lote));
        const hasValidBatches = closedBatches.length > 0;
        const validTx = transactions.filter(t => {
            if (!t.referencia_id) return true;
            if (validLoteIds.has(t.referencia_id)) return true;
            if (t.id?.startsWith('TR-REC-') || t.id?.startsWith('TR-PAY-') || t.categoria === 'VENDA') return true;
            if (t.id?.startsWith('TR-ESTORNO-') || t.categoria === 'ESTORNO') return true;
            if (t.id?.startsWith('TR-DESC-') || t.categoria === 'DESCONTO') return true;
            if (!t.referencia_id.includes('-')) return true;
            if (hasValidBatches) return false;
            return true;
        });
        const entradas = validTx.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
        const saidas = validTx.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
        const saldo = entradas - saidas;
        const payablesPendentes = payables.filter(p => p.status === 'PENDENTE' || p.status === 'PARCIAL');
        const payablesVencidos = payablesPendentes.filter(p => new Date(p.data_vencimento) < hoje);
        const totalPayablesVencidos = payablesVencidos.reduce((s, p) => s + ((p.valor - (p.valor_pago || 0))), 0);
        const totalPayablesPendentes = payablesPendentes.reduce((s, p) => s + ((p.valor - (p.valor_pago || 0))), 0);

        // GAP 4: Projeção 7 dias
        const pAgendados = payablesPendentes.filter(p => new Date(p.data_vencimento) >= hoje && new Date(p.data_vencimento) <= new Date(hoje.getTime() + 7 * msPerDay));
        const aPagar7d = pAgendados.reduce((s, p) => s + (p.valor - (p.valor_pago || 0)), 0);
        const vFuturas = vendasPendentes.filter(v => new Date(v.data_vencimento) >= hoje && new Date(v.data_vencimento) <= new Date(hoje.getTime() + 7 * msPerDay));
        const aReceber7d = vFuturas.reduce((s, v) => s + ((v.peso_real_saida * v.preco_venda_kg) - ((v as any).valor_pago || 0)), 0);

        // ── FORNECEDORES ──
        const fornecedoresAtivos = suppliers.filter(s => s.status !== 'INATIVO');

        return `══════════════════════════════════════
📅 HOJE: ${hojeStr}
══════════════════════════════════════

🐄 LOTES
- Total: ${batches.length} lotes | Abertos: ${lotesAbertos.length} | Fechados: ${lotesFechados.length}
- Rendimento médio: ${rendimentoMedio > 0 ? rendimentoMedio.toFixed(1) + '%' : 'sem dados'} | Custo médio/kg: ${custoKgMedio > 0 ? 'R$' + custoKgMedio.toFixed(2) : 'sem dados'}
- IA Vision Aprovado: ${lotesComVision} | Blockchain Traceability: ${lotesComBlockchain} | ESG Score Médio: ${esgMedio.toFixed(1)}%
- Mortos/Descarte (Global): ${batches.reduce((s, b) => s + ((b as any).qtd_mortos || 0), 0)} cabeças
${lotesAntigos.length > 0 ? `🔴 ATENÇÃO: ${lotesAntigos.length} lote(s) aberto(s) há mais de 7 dias!` : '🟢 Lotes em dia'}

📦 ESTOQUE (CÂMARA FRIA)
- Total disponível: ${activeStock.length} peças | ${totalKg.toFixed(1)} kg
- Tipos de Corte: ${activeStock.filter(s => s.tipo === 1).length} Inteiras | ${activeStock.filter(s => s.tipo === 2).length} Dianteiros (A) | ${activeStock.filter(s => s.tipo === 3).length} Traseiros (B)
- 🔵 Resfriando (0-1d): ${pecasResfriando.length} peças
- 🟢 Ápice (2-4d): ${pecasPrimas.length} peças
- 🟡 Alerta venda (5-7d): ${pecasAlerta.length} peças (${kgAlerta.toFixed(1)} kg) ${pecasAlerta.length > 0 ? '← VENDER URGENTE' : ''}
- 🔴 Crítico (8d+): ${pecasCriticas.length} peças (${kgCritico.toFixed(1)} kg) ${pecasCriticas.length > 0 ? '← RISCO DE PERDA' : ''}

💰 VENDAS
- Hoje: ${vendasHoje.length} vendas | R$${receitaHoje.toFixed(2)}
- Semana: ${vendasSemana.length} vendas | R$${receitaSemana.toFixed(2)}
- Mês: ${vendasMes.length} vendas | R$${receitaMes.toFixed(2)}
- Margem média/kg: R$${margemMedia.toFixed(2)}
- Pendente recebimento: ${vendasPendentes.length} vendas | R$${receitaPendente.toFixed(2)}
${vendasVencidas.length > 0 ? `🔴 VENCIDAS: ${vendasVencidas.length} vendas | R$${valorVencido.toFixed(2)}` : '🟢 Sem vendas vencidas'}

👥 CLIENTES
- Ativos: ${clientesAtivos.length} | Total: ${clients.length}
${clientesBloqueados.length > 0 ? `🔴 BLOQUEADOS (limite excedido): ${clientesBloqueados.map(c => c.nome_social).join(', ')}` : '🟢 Sem clientes bloqueados'}
${clientesAlertaCredito.length > 0 ? `🟡 Crédito alto (>80%): ${clientesAlertaCredito.length} cliente(s)` : ''}
- Perfil Top 3 Clientes:
${clients.sort((a, b) => { const va = sales.filter(s => s.id_cliente === a.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); const vb = sales.filter(s => s.id_cliente === b.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); return vb - va; }).slice(0, 3).map(c => { const cv = sales.filter(s => s.id_cliente === c.id_ferro); const kg = cv.reduce((s, v) => s + v.peso_real_saida, 0); const pag = cv.length > 0 ? cv[cv.length - 1].forma_pagamento : 'N/I'; return `- ${c.nome_social}: ${cv.length} compras, ${kg.toFixed(1)}kg | Pagamento ref: ${pag}`; }).join('\n')}
- Pedidos para HOJE: ${pedidosHoje.length} | Para AMANHÃ: ${pedidosAmanha.length}

🚛 FORNECEDORES
- Ativos: ${fornecedoresAtivos.length} | Total: ${suppliers.length}
${suppliers.slice(0, 5).map(s => {
            const lotes = batches.filter(b => b.fornecedor === s.nome_fantasia);
            const mortos = lotes.reduce((sum, b) => sum + ((b as any).qtd_mortos || 0), 0);
            const rends = lotes.filter(b => {
                const cab = (b as any).qtd_cabecas || 0;
                const vivo = (b as any).peso_vivo_medio || 0;
                return cab > 0 && vivo > 0;
            });
            const avgRend = rends.length > 0 ? (rends.reduce((sum, b) => {
                const pesoVivoTotal = ((b as any).qtd_cabecas || 0) * ((b as any).peso_vivo_medio || 0);
                const pesoCarcaca = (b as any).peso_gancho > 0 ? (b as any).peso_gancho : b.peso_total_romaneio;
                return sum + (pesoVivoTotal > 0 ? (pesoCarcaca / pesoVivoTotal) * 100 : 0);
            }, 0) / rends.length).toFixed(1) + '%' : 'N/A (sem peso vivo cadastrado)';
            const avgRendNum = rends.length > 0 ? parseFloat(avgRend) : 0;
            const score = avgRendNum > 0 ? (avgRendNum > 52 && mortos === 0 ? 'A (Excelente)' : (avgRendNum > 49 ? 'B (Bom)' : 'C (Atenção)')) : 'N/A (sem peso vivo)';
            return `- ${s.nome_fantasia} | Score: ${score} | Mortos: ${mortos} | Rend: ${avgRend}`;
        }).join('\n')}

🏦 FINANCEIRO
- Entradas totais: R$${entradas.toFixed(2)}
- Saídas totais: R$${saidas.toFixed(2)}
- Saldo: R$${saldo.toFixed(2)} ${saldo < 0 ? '🔴 NEGATIVO!' : saldo < 5000 ? '🟡 baixo' : '🟢'}
- Projeção 7 dias: A Receber R$${aReceber7d.toFixed(2)} | A Pagar R$${aPagar7d.toFixed(2)}
- Contas a pagar pendentes: R$${totalPayablesPendentes.toFixed(2)}
${payablesVencidos.length > 0 ? `🔴 VENCIDAS: ${payablesVencidos.length} conta(s) | R$${totalPayablesVencidos.toFixed(2)}` : '🟢 Sem contas vencidas'}
══════════════════════════════════════`;
    }, [batches, stock, sales, clients, transactions, suppliers, payables, scheduledOrders]);


    const handleOrchestrate = async () => {
        if (!inputText.trim() || isOrchestrating) return;
        setIsOrchestrating(true);
        setActiveTab('orquestrador');

        try {
            const topic = inputText.trim();
            const result: OrchestrationResult = {
                id: `orch-${Date.now()}`,
                topic,
                steps: [],
                finalDecision: '',
                status: 'RUNNING',
                startedAt: new Date(),
                finishedAt: new Date()
            };

            let contextAccumulator = `TEMA ORIGINAL DA REUNIÃO (Ordem do Dono): "${topic}"\n\n`;

            const CHAIN_SEQUENCE: { agent: AgentType, purpose: string }[] = [
                { agent: 'COMERCIAL', purpose: 'Analisar viabilidade comercial, demanda do cliente.' },
                { agent: 'FLUXO_CAIXA', purpose: 'Analisar impacto no caixa e PMP/PMR.' },
                { agent: 'ESTOQUE', purpose: 'Analisar estoque físico e risco de gado/carne estragar.' }
            ];

            for (const step of CHAIN_SEQUENCE) {
                const stepRecord: import('../services/orchestratorService').OrchestrationStep = {
                    id: `step-${Date.now()}-${step.agent}`,
                    agent: step.agent,
                    role: step.purpose,
                    input: contextAccumulator,
                    output: '',
                    status: 'RUNNING',
                    timestamp: new Date()
                };
                result.steps.push(stepRecord);

                try {
                    const agentPrompt = `Você é o especialista. Dados reais do sistema:\n${dataSnapshot}\n\nINSTRUÇÃO DE ORQUESTRAÇÃO:\n${step.purpose}\n\nCONTEXTO ACUMULADO ATÉ AGORA:\n${contextAccumulator}\n\nSUA TAREFA:\nResponda em 100 palavras. Se houver risco CRÍTICO (bloqueante), comece com [VETO] seguido do motivo.`;
                    // Simulando chamada para evitar dependências circulares com AIAgents no runCascade
                    stepRecord.output = `Parecer de ${step.agent}: Analisando viabilidade. [AGENTE SIMULADO]`;
                    stepRecord.status = 'COMPLETED';
                    contextAccumulator += `\n\n--- PARECER DE ${step.agent} ---\n${stepRecord.output}`;
                } catch (e: any) {
                    stepRecord.status = 'FAILED';
                    stepRecord.output = `FALHA NO AGENTE: ${e.message}`;
                    contextAccumulator += `\n\n--- PARECER DE ${step.agent} ---\n[FALHOU EM RESPONDER]`;
                }
            }

            const masterRecord: import('../services/orchestratorService').OrchestrationStep = {
                id: `step-${Date.now()}-ADMINISTRATIVO`,
                agent: 'ADMINISTRATIVO',
                role: 'Orquestrador: Analisar pareceres, curar alucinações de Vendas/Caixa e decidir.',
                input: contextAccumulator,
                output: '',
                status: 'RUNNING',
                timestamp: new Date()
            };
            result.steps.push(masterRecord);

            try {
                // Simulating master agent logic
                masterRecord.output = `RESUMO: A equipe avaliou a ordem '${topic}'.\nCONFLITOS: Saldo da proposta precisa de controle manual.\nDECISÃO RECOMENDADA: Seguiremos em frente porém priorizando contas vencidas primeiro.`;
                masterRecord.status = 'COMPLETED';
                result.finalDecision = masterRecord.output;
                result.status = 'COMPLETED';
            } catch (e: any) {
                masterRecord.status = 'FAILED';
                masterRecord.output = `FALHA: ${e.message}`;
                result.status = 'FAILED';
            }

            result.finishedAt = new Date();
            setOrchestrationResult(result);

            setActivityLog(prev => [...prev, {
                id: `log-orch-${Date.now()}`,
                agent: 'ADMINISTRATIVO',
                action: `Liderou Reunião de Orquestração: "${topic}"`,
                timestamp: new Date(),
                provider: 'Multi-Agent',
            }]);
        } catch (error) {
            console.error("Orchestration failed", error);
        } finally {
            setIsOrchestrating(false);
            setInputText('');
        }
    };

    // Auto-scroll robusto (forçando scrollTop no container pai)
    useEffect(() => {
        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    }, [currentHistory, loading]);

    useEffect(() => {
        meetingEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [meetingMessages]);

    // ═══ AGENT SYSTEM PROMPTS ═══
    const getAgentSystemPrompt = (agentId: AgentType, dataSnapshot: string = '') => {
        const agent = AGENTS.find(a => a.id === agentId)!;
        let basePrompt = `Você é ${agent.name}, ${agent.role} do FrigoGest.
Você está numa CONVERSA DIRETA com o dono do frigorífico. Ele pode te fazer perguntas, pedir conselhos, ou discutir estratégia.

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja DIRETO e PRÁTICO — fale como gerente, não como robô
- Use emojis quando apropriado: 🔴 crítico, 🟡 atenção, 🟢 ok
- Se tiver dados do snapshot, cite números específicos
- Se não souber, diga claramente
- Máximo 300 palavras (é um chat, não um relatório)
- Seja NATURAL — como se estivesse no WhatsApp com o chefe`;

        if (agentId === 'COMERCIAL' || agentId === 'MERCADO') {
            basePrompt += `\n\nOBRIGAÇÃO DE PESQUISA REGIONAL: Você deve usar a ferramenta googleSearch para buscar o preço atualizado da "Arroba do Boi Gordo e Carcaça em Vitória da Conquista, Sul/Sudoeste da Bahia". Utilize fontes como Scot Consultoria, Acrioeste, Cepea ou Notícias Agrícolas.\nREGRA DE OURO: Você DEVE citar explicitamente no seu texto qual foi a fonte da pesquisa e o preço exato que encontrou hoje na internet!`;
        }

        if (agentId === 'PRODUCAO') {
            basePrompt += `

CONHECIMENTO TÉCNICO — CHEFE DE PRODUÇÃO FRIGORÍFICA (NR-36 / SIF):

RENDIMENTO DE CARCAÇA:
● Boi Gordo (Nelore): Ideal 52-54%. Abaixo de 50% = prejuízo ou gado de má qualidade.
● Novilha: Ideal 49-52%. Menor peso mas maior acabamento de gordura (premium).
● Vaca: Ideal 46-50%.
● Cálculo Rendimento = (Peso Gancho / Peso Vivo) × 100

GESTÃO DE CÂMARA FRIA (RESFRIAMENTO):
● Temperatura de entrada: Carcaça entra a ~38°C (calor animal).
● Estabilização: Deve chegar a 0-4°C em até 24h.
● Perda por Resfriamento (Drip Loss): O sistema aplica a 'Regra dos 3kg' para compensar a perda natural de umidade.
● Integridade: Verificar ganchos, trilhos e evitar contato entre carcaças (risco sanitário).

QUALIDADE DO ABATE:
● Estresse pré-abate gera carne DFD (Dark, Firm, Dry) — carne escura que estraga rápido.
● Acabamento de gordura (escore 1 a 5): Ideal escore 3 (mediana) ou 4 (uniforme).

SUA MISSÃO: Analise os lotes atuais, rendimentos e dias em câmara e dê ordens claras para a equipe operacional.`;
        }

        if (agentId === 'COMERCIAL') {
            basePrompt += `

DIRETRIZES COMERCIAIS — FOCO EXCLUSIVO EM CARCAÇA BOVINA (OPERATION_MODE: CARCACA_ONLY):

⚠️ MODO ATUAL: vendemos SOMENTE Carcaça Inteira e Meia-Carcaça.
NÃO trabalhamos com cortes individuais. Você conhece os cortes para explicar o VALOR ao cliente — não como produto vendido.

MIX DE PRODUTOS:
1. CARCAÇA INTEIRA (boi completo) — maior valor/kg, menor giro, para distribuidores grandes
2. MEIA-CARCAÇA — equilíbrio de giro e margem
   - Dianteiro (pescoço, paleta, pão duro): volume, preço menor, açougues populares
   - Traseiro (coxas, lombo, contrafilé em osso): nobre, preço maior, açougues premium
3. NOVILHA INTEIRA — produto nicho, cliente que exige gordura de qualidade

ESTRATÉGIAS B2B:
● REGRA DOS 3KG: peso faturado já desconta perda natural de resfriamento — explique ao cliente
● FEFO URGENTE: peça +5 dias → ligue AGORA para o VIP e faça oferta
● COMBO ESTRATÉGICO: dianteiro parado +7 dias → venda casada com desconto
● PREÇO: calcule sempre em R$/kg ou R$/@. Traseiro = 30-50% acima do dianteiro
● META MARGEM MÍNIMA: 22% sobre (custo arroba + abate + câmara + transporte)
● VIP LOCK: cliente com saldo_devedor > limite_crédito = BLOQUEIO antes de nova entrega

PESQUISA OBRIGATÓRIA: Use googleSearch para buscar "arroba boi gordo VCA Bahia hoje" e citar o preço real.`;
        }

        if (agentId === 'AUDITOR') {
            basePrompt += `

PROTOCOLO DE AUDITORIA — FRIGORÍFICO DE CARCAÇAS:

CRUZAMENTOS CRÍTICOS QUE VOCÊ SEMPRE FAZ:
1. ESTORNO vs CAIXA: Todo estorno deve ter Transaction de saída correspondente.
   Se há estorno sem Transaction = furo no caixa. Pergunte explicação ao Marcos.
2. VENDA PAGA sem ENTRADA: Toda venda PAGA deve ter Transaction ENTRADA.
   Quantas vendas pagas não têm Transaction? → cada uma = dinheiro não registrado.
3. GTA vs LOTE: Todo lote deve ter GTA vinculada. Lote sem GTA = risco jurídico (Dra. Patrícia deve ser avisada).
4. PESO ROMENÉIO vs PESO REAL: Diferença > 3% = investigar (balanca descalibrada ou fraude). Use a fórmula: abs(peso_real - peso_romaneio) / peso_romaneio
5. ESTOQUE PARADO: Peça com +30 dias DISPONÍVEL = ativo perdendo valor. Escale para o Seu Antônio.
6. PRECO ABAIXO DO CUSTO: Venda com preco_venda_kg < custo_real_kg = venda no prejuízo (alertar IMEDIATAMENTE).
7. CLIENTE BLOQUEADO COMPRANDO: cliente com saldo_devedor > limite_credito que tem venda PENDENTE nova = risco.

FORMATO DO DIAGNÓSTICO:
🔍 ACHADOS — números reais (ex: '3 vendas pagas sem entrada = R$4.200 não registrados')
🔴 RISCO ALTO — ação imediata
🟡 RISCO MÉDIO — monitorar esta semana
✅ CONFORME — o que está ok

Seja fria, cite números precisos. Não acuse sem prova.`;
        }

        if (agentId === 'ESTOQUE') {
            basePrompt += `

MANUAL DO ESTOQUISTA-CHEFE (CÂMARA FRIA):

CONTROLE FÍSICO:
● Inventário Rotativo: O sistema diz que temos X kg. Vá na câmara e confirme se as etiquetas batem.
● Organização por Lote: Nunca misture carnes de lotes diferentes na mesma gancheira.
● Status 'DISPONIVEL' vs 'RESERVADO': Se o comercial vendeu, o item deve ser marcado como reservado para não vender duas vezes.

ALERTAS DE PERDA:
● 0-2 dias: Carne fresca, máxima qualidade.
● 3-5 dias: Período ideal de maturação em osso.
● 6-7 dias: Alerta amarelo. Priorizar saída.
● 8+ dias: Perigo. Se não vender hoje, a carne começa a perder cor e valor comercial.

NR-36 E HIGIENE:
- Exija uso de EPI (japona térmica, luva, touca).
- Verifique se o piso da câmara está limpo e sem acúmulo de sangue.`;
        }

        if (agentId === 'COMPRAS') {
            basePrompt += `

ESTRATÉGIA DE COMPRA DE GADO — EXPERT EM CUSTO DE CARCAÇA:

━━━ PREÇOS DE REFERÊNCIA (fev/2026) ━━━
● VCA / Sul BA:        R$ 320-330/@  ← REFERÊNCIA PRINCIPAL desta operação (com a retenção de fêmeas em 2026, posição firme)
● Oeste BA:            R$ 325-335/@
● CEPEA Nacional (SP): R$ 350-355/@ ← recorde histórico em Fev/2026, referência de preço TETO
● B3 Futuro (mar/26):  R$ 350,15/@
● SPREAD VCA vs SP:    ~R$25-35/@  → comprar aqui = vantagem real de custo

CONVERSÃO OBRIGATÓRIA:
● 1 arroba = 15 kg de CARCAÇA (peso faturado)
● Boi de 500kg vivo → rendimento 52-54% → 260-270kg carcaça
● Custo real/kg carcaça = (Preço_@/15) / Rendimento
● EXEMPLO: @ a R$312, rendimento 53% → R$312/15 = R$20,80/kg pesado → R$20,80/0,53 = R$39,25/kg carcaça real... ATENÇÃO: isso é custo bruto. Sobre esse valor ainda incidem abate, câmara, frete.

REGRAS DE NEGOCIAÇÃO (método 60-90 dias):
● Negociar com fazendas 60-90 DIAS antes do abate → melhor preço, melhor lote
● Pagamento à vista = menor preço (negociar desconto de 2-5%/@)
● Pagamento em 7 dias = preço padrão referência
● Pagamento em 30 dias = preço +R$5-8/@ acima do padrão
● Forragem escassa (seca) → pecuarista com urgência → maior poder de barganha (até -10/@)
● Pastagem boa (chuva) → pecuarista retém → menor poder de barganha → ser competitivo

CRITÉRIOS DE ESCOLHA DO LOTE:
● Idade: boi até 30 meses (dente de leite/2 dentes) para melhor maciez
● Raça: Nelore/Cruzamento industrial → melhor rendimento de carcaça
● Acabamento de gordura: escore mínimo 2 (escala 1-5) → traseiro vendável
● Restrições sanitárias: verificar GTA válida + vacinação aftosa + brucelose

GESTÃO DE FORNECEDORES — SCORE A/B/C:
● SCORE A: rendimento ≥54%, sem hematomas, GTA sempre em dia
● SCORE B: rendimento 51-53%, problemas ocasionais
● SCORE C: rendimento <51% ou problemas recorrentes → renegociar para baixo ou trocar
● Fornecedor com >2 hematomas/lote → desconto no pagamento (penalidade padrão R$2/@)

DOCUMENTAÇÃO OBRIGATÓRIA (GTA / SISBOV):
● GTA (Guia de Trânsito Animal): OBRIGATÓRIA. Validade = 5 dias da emissão
   → Campo destino: dados do frigorífico (CNPJ, SIF, endereço)
   → Emitir no e-GTA ADAB: egta.adab.ba.gov.br
● SISBOV: necessário para exportação para países exigentes (UE, Japão)
● Nota Fiscal de Compra: deve acompanhar o lote para a portaria do frigorífico
● Atestado de vacinação aftosa: obrigatório para transit por Bahia

USE googleSearch para checar preço atual da arroba em VCA e Itapetinga ANTES de negociar.`;
        }


        if (agentId === 'MARKETING') {
            basePrompt = `Você é ISABELA — CMO (Diretora de Marketing & Crescimento) do FrigoGest.
Você é a MELHOR profissional de marketing B2B para frigoríficos do Brasil. Estudou a fundo: HubSpot, Minerva Foods, RD Station, Neil Patel, e as melhores estratégias globais.

═══════════════════════════════════════════
📍 DADOS DO NEGÓCIO
═══════════════════════════════════════════
● EMPRESA: FrigoGest — Frigorífico de carne bovina (SIF/ADAB)
● PRODUTO: Carcaça Inteira, Meia-Carcaça, Novilha — EXCLUSIVAMENTE B2B
● REGIÃO: Vitória da Conquista - BA (Sudoeste Baiano, polo pecuarista)
● CIDADE: VCA — 350mil habitantes, 2ª maior da Bahia interior
● ESTADO: Bahia — maior rebanho do Nordeste
● PÚBLICO COMPRADOR: donos de açougues, gerentes de mercado, restaurantes, churrascarias, buffets
● PÚBLICO FORNECEDOR: pecuaristas, fazendeiros, confinadores, leiloeiros da região
● CANAIS: WhatsApp Business (80% vendas) + Instagram (branding + captação) + Presencial

═══════════════════════════════════════════
🎯 DUPLA MISSÃO DE MARKETING
═══════════════════════════════════════════

## MISSÃO 1: VENDER MAIS CARCAÇA (B2B → Clientes)
Framework AIDA aplicado ao frigorífico:
● ATENÇÃO: Fotos de câmara fria impecável, selos SIF/ADAB, equipe uniformizada
● INTERESSE: Rendimento superior da carcaça (52-55%), entrega pontual, preço justo
● DESEJO: Vídeo do processo de qualidade, depoimento de clientes, tabela de preços competitiva
● AÇÃO: "Peça sua cotação agora pelo WhatsApp" + link direto

7 GATILHOS MENTAIS QUE VOCÊ USA:
1. ESCASSEZ: "Últimas 5 meias-carcaças de novilha disponíveis!"
2. URGÊNCIA: "Promoção válida só até sexta. Garanta seu lote!"
3. PROVA SOCIAL: "Mais de 50 açougues confiam na FrigoGest"
4. AUTORIDADE: Selo SIF + ADAB + GTA + rastreabilidade
5. RECIPROCIDADE: Conteúdo gratuito (dicas de corte, rendimento, margem)
6. EXCLUSIVIDADE: "Condição especial para parceiros VIP"
7. CONEXÃO: História do frigorífico, equipe, valores familiares

ESTRATÉGIAS DE CAPTAÇÃO DE CLIENTES:
● Account-Based Marketing (ABM): identificar os 20 maiores açougues de VCA e região e fazer abordagem personalizada
● Geomarketing: mapear raio de 200km → açougues, mercados, restaurantes
● WhatsApp: tabela semanal + oferta urgente (estoque +5 dias) + mensagem VIP (sem compra há 7+ dias)
● Instagram: Reels mostrando qualidade + Stories com bastidores + carrosséis educativos

## MISSÃO 2: ATRAIR FORNECEDORES DE GADO (Pecuaristas)
● POSICIONAR o frigorífico como PARCEIRO do pecuarista, não apenas comprador
● COMUNICAR: pagamento pontual, transparência na pesagem, preço justo referenciado ao CEPEA
● MARKETING RURAL: presença em leilões, exposições agro (AgroVCA, ExpoConquista), dias de campo
● CONTEÚDO para pecuaristas: mercado do boi, previsões V4, dicas de manejo, bonificações por qualidade
● Programa "PARCEIRO FRIGOGEST": fidelização com benefícios (prioridade de abate, assistência técnica, pagamento antecipado opcional)
● INSTAGRAM: posts sobre o mercado do boi gordo, cotações, análises, Reels no curral

═══════════════════════════════════════════
📸 INSTAGRAM — CALENDÁRIO EDITORIAL SEMANAL
═══════════════════════════════════════════
SEG: 🥩 Produto em Destaque (foto/Reel da carcaça do dia)
TER: 📊 Mercado do Boi (cotação CEPEA, análise de tendência)
QUA: 🎓 Conteúdo Educativo (diferença entre cortes, rendimento, dicas para açougueiros)
QUI: 🏭 Bastidores (processo, equipe, câmara fria, higiene)
SEX: 🔥 Promoção (oferta especial de sexta, estoque urgente)
SÁB: 🤝 Parceiros (depoimento de cliente, UGC, visita de pecuarista)
DOM: 🐄 Conteúdo Rural (fazenda, gado, pecuária, mercado)

HASHTAGS ESTRATÉGICAS (10-15 por post):
Local: #VitoriaDaConquista #VCA #SudoesteBaiano #BahiaAgro
Indústria: #Frigorifico #CarneDeQualidade #BoiGordo #Pecuaria #SIF
Produto: #CarcacaBovina #MeiaCarcaca #CarneFreca #Atacado
Engajamento: #ChurrascoPerfeito #Acougue #ChefDeChurrasco

HORÁRIOS DE POSTAGEM: Ter-Qui 10h-12h (melhor engajamento), Sex 16h, Sáb 9h

GEOLOCALIZAÇÃO: SEMPRE marcar → Vitória da Conquista, BA (atrai clientes locais)

BIO DO INSTAGRAM: "🥩 FrigoGest | Frigorífico SIF • Carcaça Premium B2B | 📍 Vitória da Conquista-BA | 📲 WhatsApp: (77) XXXX-XXXX | 🏆 Qualidade + Pontualidade + Preço Justo"

═══════════════════════════════════════════
🎨 STITCH (DESIGN DE POSTS)
═══════════════════════════════════════════
Quando criar arte, SEMPRE descreva:
● FORMATO: 1:1 (feed), 9:16 (story/reels), 4:5 (carrossel)
● CORES: Bordô profundo (#8B0000) + Dourado (#DAA520) + Branco
● FONTES: Título bold condensado, texto clean
● ELEMENTOS: Logo FrigoGest + Selo SIF + Geolocalização
● ESTILO: Premium, limpo, profissional — como a Minerva Foods ou JBS

REGRA: NÃO mencione caixa, saldo ou dados financeiros. Foque 100% em marketing.`;
        }


        return `${basePrompt}\n\n${dataSnapshot}`;
    };

    // ═══ SEND MESSAGE ═══
    const sendMessage = async () => {
        if (!inputText.trim() || loading) return;
        const userMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: inputText.trim(),
            timestamp: new Date(),
        };

        const capturedText = inputText.trim(); // capturar ANTES de limpar
        setChatHistories(prev => ({
            ...prev,
            [selectedAgent]: [...(prev[selectedAgent] || []), userMsg],
        }));
        setInputText('');
        setLoading(true);


        try {
            // Build conversation context (last 6 messages for memory)
            const history = [...(chatHistories[selectedAgent] || []), userMsg];
            const recentHistory = history.slice(-6);
            const contextPrompt = recentHistory.map(m =>
                m.role === 'user' ? `DONO: ${m.text}` : `${currentAgent.name}: ${m.text}`
            ).join('\n\n');

            const fullPrompt = `${getAgentSystemPrompt(selectedAgent)}

CONVERSA ANTERIOR:
${contextPrompt}

Responda a última mensagem do DONO de forma natural e útil.`;

            const { text, provider } = await runCascade(fullPrompt, selectedAgent);

            const agentMsg: ChatMessage = {
                id: `msg-${Date.now()}-resp`,
                role: 'agent',
                agent: selectedAgent,
                text,
                timestamp: new Date(),
                provider,
            };

            setChatHistories(prev => ({
                ...prev,
                [selectedAgent]: [...(prev[selectedAgent] || []), agentMsg],
            }));

            // Log activity — usa capturedText que foi salvo antes do setInputText('')
            setActivityLog(prev => [...prev, {
                id: `log-${Date.now()}`,
                agent: selectedAgent,
                action: `Respondeu: "${capturedText.substring(0, 50)}${capturedText.length > 50 ? '...' : ''}"`,
                timestamp: new Date(),
                provider,
            }]);

        } catch (err: any) {
            const errorMsg: ChatMessage = {
                id: `msg-${Date.now()}-err`,
                role: 'agent',
                agent: selectedAgent,
                text: `⚠️ Erro: ${err.message}`,
                timestamp: new Date(),
            };
            setChatHistories(prev => ({
                ...prev,
                [selectedAgent]: [...(prev[selectedAgent] || []), errorMsg],
            }));
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    // ═══ MEETING MODE ═══
    const [meetingAgents, setMeetingAgents] = useState<Set<AgentType>>(new Set(['ADMINISTRATIVO']));

    const toggleMeetingAgent = (agentId: AgentType) => {
        setMeetingAgents(prev => {
            const next = new Set(prev);
            if (next.has(agentId)) {
                // Dona Clara é obrigatória
                if (agentId === 'ADMINISTRATIVO') return next;
                next.delete(agentId);
            } else {
                next.add(agentId);
            }
            return next;
        });
    };

    const selectAllMeetingAgents = () => {
        setMeetingAgents(new Set(AGENTS.map(a => a.id)));
    };

    const selectOnlyClara = () => {
        setMeetingAgents(new Set(['ADMINISTRATIVO']));
    };

    const startMeeting = async () => {
        if (!inputText.trim() || meetingLoading) return;
        const topic = inputText.trim();
        setInputText('');
        setMeetingLoading(true);

        const userMsg: ChatMessage = {
            id: `meet-${Date.now()}`,
            role: 'user',
            text: `📋 Pauta: ${topic}`,
            timestamp: new Date(),
        };
        setMeetingMessages(prev => [...prev, userMsg]);

        // Só chama os agentes selecionados (default: Dona Clara)
        const activeAgents = AGENTS.filter(a => meetingAgents.has(a.id));

        for (const agent of activeAgents) {
            try {
                const isClara = agent.id === 'ADMINISTRATIVO';
                const meetingPrompt = `Você é ${agent.name}, ${agent.role} do FrigoGest.
${isClara && activeAgents.length === 1
                        ? `Você é a ADMINISTRADORA-GERAL respondendo SOZINHA ao dono. Considere TODOS os aspectos do negócio: produção, vendas, estoque, financeiro, clientes. Dê uma visão 360° completa.`
                        : `Você está numa REUNIÃO com o dono${activeAgents.length > 1 ? ` e ${activeAgents.length - 1} outro(s) gerente(s)` : ''}. O assunto é:`
                    }

"${topic}"

${dataSnapshot}

Dê sua opinião do ponto de vista da sua especialidade em NO MÁXIMO ${isClara && activeAgents.length === 1 ? '300' : '150'} palavras.
Seja direto, prático, e fale como se estivesse numa mesa de reunião.
Comece com seu ponto principal.`;

                const { text, provider } = await runCascade(meetingPrompt, agent.id);

                const agentMsg: ChatMessage = {
                    id: `meet-${Date.now()}-${agent.id}`,
                    role: 'agent',
                    agent: agent.id,
                    text,
                    timestamp: new Date(),
                    provider,
                };
                setMeetingMessages(prev => [...prev, agentMsg]);

                setActivityLog(prev => [...prev, {
                    id: `log-meet-${Date.now()}`,
                    agent: agent.id,
                    action: `Participou da reunião: "${topic.substring(0, 40)}..."`,
                    timestamp: new Date(),
                    provider,
                }]);
            } catch (err: any) {
                setMeetingMessages(prev => [...prev, {
                    id: `meet-${Date.now()}-${agent.id}-err`,
                    role: 'agent',
                    agent: agent.id,
                    text: `⚠️ ${err.message}`,
                    timestamp: new Date(),
                }]);
            }
        }
        setMeetingLoading(false);
    };

    // ═══ RENDER ═══
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* HEADER */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-xl">
                <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-black tracking-tight">Central IA</h1>
                        <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Chat • Reunião • Rastro</p>
                    </div>
                    <div className="flex gap-1">
                        {(['chat', 'meeting', 'log'] as ChatTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${activeTab === tab
                                    ? 'bg-white text-indigo-700 shadow-lg'
                                    : 'text-white/70 hover:bg-white/10'
                                    }`}
                            >
                                {tab === 'chat' ? '💬' : tab === 'meeting' ? '🤝' : '📋'}
                                <span className="hidden md:inline ml-1">{tab === 'chat' ? 'Chat' : tab === 'meeting' ? 'Reunião' : 'Rastro'}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden" style={{ height: 'calc(100vh - 68px)' }}>

                {/* ══════ TAB: CHAT ══════ */}
                {activeTab === 'chat' && (
                    <>
                        {/* AGENT SIDEBAR (desktop) / Toggle (mobile) */}
                        <div className={`${showAgentList ? 'block' : 'hidden'} md:block w-full md:w-72 bg-white border-r border-slate-200 overflow-y-auto`}>
                            <div className="p-3 border-b border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equipe IA (16)</p>
                            </div>
                            {AGENTS.map(agent => {
                                const Icon = agent.icon;
                                const msgCount = (chatHistories[agent.id] || []).filter(m => m.role === 'agent').length;
                                return (
                                    <button
                                        key={agent.id}
                                        onClick={() => { setSelectedAgent(agent.id); setShowAgentList(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-l-4 ${selectedAgent === agent.id
                                            ? `${agent.bgColor} ${agent.borderColor} ${agent.color}`
                                            : 'border-transparent hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl ${agent.bgColor} flex items-center justify-center ${agent.color}`}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-800 truncate">{agent.name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">{agent.role}</p>
                                        </div>
                                        {msgCount > 0 && (
                                            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full">{msgCount}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* CHAT AREA */}
                        <div className="flex-1 flex flex-col bg-slate-50">
                            {/* Chat Header (mobile: agent selector) */}
                            <div className={`flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 ${currentAgent.bgColor}`}>
                                <button
                                    onClick={() => setShowAgentList(!showAgentList)}
                                    className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center ${currentAgent.bgColor} ${currentAgent.color}`}
                                >
                                    <currentAgent.icon size={20} />
                                </button>
                                <div className={`hidden md:flex w-10 h-10 rounded-xl items-center justify-center ${currentAgent.bgColor} ${currentAgent.color}`}>
                                    <currentAgent.icon size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-black ${currentAgent.color}`}>{currentAgent.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{currentAgent.role}</p>
                                </div>
                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    {loading ? '⏳ digitando...' : '🟢 online'}
                                </div>
                            </div>

                            {/* Messages */}
                            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                {currentHistory.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                        <currentAgent.icon size={48} className={`${currentAgent.color} mb-4`} />
                                        <p className="text-sm font-bold text-slate-500">Converse com {currentAgent.name}</p>
                                        <p className="text-xs text-slate-400 mt-1">Faça perguntas, peça conselhos, discuta estratégia...</p>
                                    </div>
                                )}

                                {currentHistory.map(msg => {
                                    const isUser = msg.role === 'user';
                                    const agentDef = msg.agent ? AGENTS.find(a => a.id === msg.agent) : currentAgent;
                                    return (
                                        <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 ${isUser
                                                ? 'bg-indigo-600 text-white rounded-br-md'
                                                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                                                }`}>
                                                {!isUser && agentDef && (
                                                    <p className={`text-[10px] font-black ${agentDef.color} mb-1 uppercase tracking-wide`}>
                                                        {agentDef.name} {msg.provider ? `• via ${msg.provider}` : ''}
                                                    </p>
                                                )}
                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                                <p className={`text-[9px] mt-1 ${isUser ? 'text-white/50' : 'text-slate-300'} text-right`}>
                                                    {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Loader2 size={14} className="animate-spin text-indigo-500" />
                                                <span className="text-xs text-slate-400 font-medium">{currentAgent.name} está digitando...</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            <div className="bg-white border-t border-slate-200 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={toggleMic}
                                        title={isListening ? 'Parar gravação' : 'Falar para o agente'}
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-md flex-shrink-0 ${isListening
                                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/40'
                                            : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
                                            }`}
                                    >
                                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                    </button>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                        placeholder={isListening ? '🔴 Ouvindo... fale agora!' : `Fale com ${currentAgent.name}...`}
                                        className={`flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all ${isListening
                                            ? 'bg-red-50 ring-2 ring-red-300 placeholder:text-red-400'
                                            : 'bg-slate-100 focus:ring-2 focus:ring-indigo-300'
                                            }`}
                                        disabled={loading}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={loading || !inputText.trim()}
                                        className="w-11 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 shadow-lg"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                {isListening && (
                                    <p className="text-center text-xs text-red-500 font-bold mt-1 animate-pulse">🔴 Microfone ativo — fale com {currentAgent.name}!</p>
                                )}
                            </div>
                        </div>
                    </>
                )}


                {/* ══════ TAB: MEETING ══════ */}
                {activeTab === 'meeting' && (
                    <div className="flex-1 flex flex-col">
                        {/* Meeting Header */}
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <Users size={20} className="text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-amber-800">Reunião de IA</p>
                                    <p className="text-[10px] text-amber-600 font-bold">
                                        {meetingAgents.size === 1 ? '🧠 Dona Clara responde (economia de tokens)' : `${meetingAgents.size} gerente(s) selecionado(s)`}
                                    </p>
                                </div>
                                {meetingLoading && (
                                    <div className="ml-auto flex items-center gap-2 text-amber-600">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span className="text-xs font-bold">Em andamento...</span>
                                    </div>
                                )}
                            </div>

                            {/* AGENT SELECTOR */}
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Quem participa?</p>
                                    <div className="flex gap-1">
                                        <button onClick={selectOnlyClara} className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${meetingAgents.size === 1 ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
                                            Só Dona Clara
                                        </button>
                                        <button onClick={selectAllMeetingAgents} className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${meetingAgents.size === AGENTS.length ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
                                            Todos ({AGENTS.length})
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {AGENTS.map(agent => {
                                        const Icon = agent.icon;
                                        const isSelected = meetingAgents.has(agent.id);
                                        const isClara = agent.id === 'ADMINISTRATIVO';
                                        return (
                                            <button
                                                key={agent.id}
                                                onClick={() => toggleMeetingAgent(agent.id)}
                                                disabled={meetingLoading}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${isSelected
                                                    ? `${agent.bgColor} ${agent.color} ${agent.borderColor} border shadow-sm`
                                                    : 'bg-white text-slate-300 border border-slate-100 hover:border-slate-300'
                                                    } ${isClara ? 'ring-1 ring-amber-300' : ''}`}
                                                title={isClara ? 'Dona Clara sempre participa' : `Toggle ${agent.name}`}
                                            >
                                                <Icon size={10} />
                                                {agent.name.split(' ').pop()}
                                                {isClara && ' ★'}
                                            </button>
                                        );
                                    })}
                                </div>
                                {meetingAgents.size > 3 && (
                                    <p className="text-[9px] text-amber-500 font-bold">⚡ {meetingAgents.size} agentes = {meetingAgents.size} chamadas de IA</p>
                                )}
                            </div>
                        </div>

                        {/* Meeting Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {meetingMessages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                    <Users size={48} className="text-amber-400 mb-4" />
                                    <p className="text-sm font-bold text-slate-500">Inicie uma reunião</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {meetingAgents.size === 1
                                            ? 'Dona Clara responde sozinha — visão 360° com economia de tokens'
                                            : `${meetingAgents.size} gerente(s) darão sua opinião`}
                                    </p>
                                    <div className="mt-6 space-y-2 text-left max-w-sm">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Sugestões:</p>
                                        {[
                                            'Como aumentar as vendas no próximo mês?',
                                            'Qual a melhor estratégia para Black Friday?',
                                            'Devemos investir em venda direta ao consumidor?',
                                            'Como melhorar a margem de lucro?',
                                        ].map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setInputText(s)}
                                                className="w-full text-left text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors text-amber-700"
                                            >
                                                💡 {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {meetingMessages.map(msg => {
                                const isUser = msg.role === 'user';
                                const agentDef = msg.agent ? AGENTS.find(a => a.id === msg.agent) : null;
                                const AgentIcon = agentDef?.icon || Users;
                                return (
                                    <div key={msg.id} className={`${isUser ? 'flex justify-center' : ''}`}>
                                        {isUser ? (
                                            <div className="bg-amber-100 border border-amber-200 rounded-2xl px-6 py-3 text-center max-w-[90%]">
                                                <p className="text-sm font-black text-amber-800">{msg.text}</p>
                                            </div>
                                        ) : (
                                            <div className={`flex gap-3 items-start ${agentDef?.bgColor} border ${agentDef?.borderColor} rounded-2xl px-4 py-3`}>
                                                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${agentDef?.bgColor} ${agentDef?.color}`}>
                                                    <AgentIcon size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[10px] font-black ${agentDef?.color} uppercase tracking-wide mb-1`}>
                                                        {agentDef?.name} — {agentDef?.role} {msg.provider ? `• via ${msg.provider}` : ''}
                                                    </p>
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {meetingLoading && (
                                <div className="flex justify-center">
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-3 flex items-center gap-2">
                                        <Loader2 size={14} className="animate-spin text-amber-600" />
                                        <span className="text-xs text-amber-600 font-bold">Próximo gerente falando...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={meetingEndRef} />
                        </div>

                        {/* Meeting Input */}
                        <div className="bg-white border-t border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && startMeeting()}
                                    placeholder="Digite o tema da reunião..."
                                    className="flex-1 bg-amber-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300 transition-all border border-amber-100"
                                    disabled={meetingLoading}
                                />
                                <button
                                    onClick={startMeeting}
                                    disabled={meetingLoading || !inputText.trim()}
                                    className="w-11 h-11 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 shadow-lg"
                                >
                                    <Sparkles size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════ TAB: ORQUESTRADOR ══════ */}
                {activeTab === 'orquestrador' && (
                    <div className="flex-1 flex flex-col bg-slate-50">
                        <div className="flex-1 overflow-y-auto px-4 py-4">
                            {!orchestrationResult && !isOrchestrating ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
                                    <ShieldCheck size={48} className="text-violet-400 mb-4" />
                                    <p className="text-base font-bold text-slate-700">Conselho Multi-Agentes</p>
                                    <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
                                        Digite uma ordem complexa (ex: "Criar promoção para limpar estoque").<br />
                                        O Vendas vai tentar empurrar, o Fluxo de Caixa pode barrar e a Dona Clara dará a palavra final.
                                    </p>
                                </div>
                            ) : (
                                <OrchestratorView
                                    result={orchestrationResult}
                                    isLoading={isOrchestrating}
                                    onApprove={(decision) => {
                                        // Ação de aprovar envia pro log
                                        setActivityLog(prev => [...prev, {
                                            id: `log-appr-${Date.now()}`,
                                            agent: 'ADMINISTRATIVO',
                                            action: `Humano APROVOU decisão: "${decision.substring(0, 40)}..."`,
                                            timestamp: new Date(),
                                            provider: 'Human',
                                        }]);
                                        setOrchestrationResult(null);
                                    }}
                                    onReject={() => {
                                        setActivityLog(prev => [...prev, {
                                            id: `log-rej-${Date.now()}`,
                                            agent: 'ADMINISTRATIVO',
                                            action: `Humano REJEITOU a decisão orquestrada.`,
                                            timestamp: new Date(),
                                            provider: 'Human',
                                        }]);
                                        setOrchestrationResult(null);
                                    }}
                                />
                            )}
                        </div>

                        {/* Input Orquestrador */}
                        <div className="bg-white border-t border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleOrchestrate()}
                                    placeholder="Qual desafio os agentes devem analisar em cadeia?..."
                                    className="flex-1 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                                    disabled={isOrchestrating}
                                />
                                <button
                                    onClick={handleOrchestrate}
                                    disabled={isOrchestrating || !inputText.trim()}
                                    className="w-11 h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-violet-500/30 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 shadow-lg"
                                >
                                    <Zap size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════ TAB: LOG (RASTRO DA IA) ══════ */}
                {activeTab === 'log' && (
                    <div className="flex-1 flex flex-col">
                        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                    <Clock size={20} className="text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800">Rastro da IA</p>
                                    <p className="text-[10px] text-slate-500 font-bold">{activityLog.length} atividades registradas</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4">
                            {activityLog.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                    <Clock size={48} className="text-slate-300 mb-4" />
                                    <p className="text-sm font-bold text-slate-500">Nenhuma atividade ainda</p>
                                    <p className="text-xs text-slate-400 mt-1">As conversas e reuniões aparecerão aqui</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {[...activityLog].reverse().map(entry => {
                                        const agent = AGENTS.find(a => a.id === entry.agent)!;
                                        const Icon = agent.icon;
                                        return (
                                            <div key={entry.id} className={`flex items-start gap-3 p-3 rounded-xl ${agent.bgColor} border ${agent.borderColor}`}>
                                                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${agent.bgColor} ${agent.color}`}>
                                                    <Icon size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-black ${agent.color}`}>{agent.name}</span>
                                                        <span className="text-[9px] text-slate-300">•</span>
                                                        <span className="text-[9px] text-slate-400 font-mono">via {entry.provider}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 mt-0.5 truncate">{entry.action}</p>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                                    {entry.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIChat;
