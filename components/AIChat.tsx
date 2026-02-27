import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft, Send, MessageCircle, Users, Clock,
    Brain, Shield, TrendingUp, BarChart3, Package,
    DollarSign, Truck, Bot, Loader2, Sparkles,
    ChevronRight, Activity, Mic, MicOff,
    Search, FileText, Smartphone, CalendarDays, Thermometer, Banknote
} from 'lucide-react';

import { GoogleGenAI } from '@google/genai';
import {
    AgentType, Batch, StockItem, Sale, Client,
    Transaction, Supplier, Payable, ScheduledOrder
} from '../types';

// ═══ AI HIERARCHY — 4 Tiers (same as AIAgents) ═══
type AITier = 'PEAO' | 'ESTAGIARIO' | 'FUNCIONARIO' | 'GERENTE' | 'MESTRA';
interface CascadeProvider { name: string; tier: AITier; call: (prompt: string) => Promise<string>; }

const AGENT_TIER_MAP: Record<string, AITier> = {
    'ADMINISTRATIVO': 'MESTRA', 'PRODUCAO': 'FUNCIONARIO', 'COMERCIAL': 'GERENTE',
    'AUDITOR': 'GERENTE', 'ESTOQUE': 'ESTAGIARIO', 'COMPRAS': 'FUNCIONARIO',
    'MERCADO': 'GERENTE', 'ROBO_VENDAS': 'FUNCIONARIO', 'MARKETING': 'ESTAGIARIO', 'SATISFACAO': 'ESTAGIARIO',
    'CONFERENTE': 'PEAO', 'RELATORIOS': 'PEAO', 'WHATSAPP_BOT': 'PEAO',
    'AGENDA': 'PEAO', 'TEMPERATURA': 'PEAO', 'COBRANCA': 'PEAO',
};

const TIER_FALLBACK: Record<AITier, AITier[]> = {
    'PEAO': ['PEAO', 'ESTAGIARIO', 'FUNCIONARIO', 'GERENTE', 'MESTRA'],
    'ESTAGIARIO': ['ESTAGIARIO', 'PEAO', 'FUNCIONARIO', 'GERENTE', 'MESTRA'],
    'FUNCIONARIO': ['FUNCIONARIO', 'ESTAGIARIO', 'PEAO', 'GERENTE', 'MESTRA'],
    'GERENTE': ['GERENTE', 'FUNCIONARIO', 'MESTRA', 'ESTAGIARIO', 'PEAO'],
    'MESTRA': ['MESTRA', 'GERENTE', 'FUNCIONARIO', 'ESTAGIARIO', 'PEAO'],
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

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
            const ai = new GoogleGenAI({ apiKey: geminiKey }); const r = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: { parts: [{ text: p }] } });
            const t = r.candidates?.[0]?.content?.parts?.[0]?.text; if (!t) throw new Error('Gemini Pro vazio'); return t;
        }
    });
    // GERENTE
    if (geminiKey) providers.push({
        name: 'Gemini Flash', tier: 'GERENTE', call: async (p) => {
            const ai = new GoogleGenAI({ apiKey: geminiKey }); const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ text: p }] } });
            const t = r.candidates?.[0]?.content?.parts?.[0]?.text; if (!t) throw new Error('Gemini Flash vazio'); return t;
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

const runCascade = async (prompt: string, agentId?: string): Promise<{ text: string; provider: string }> => {
    const allProviders = buildAllProviders();
    if (!allProviders.length) throw new Error('Nenhuma chave de IA configurada.');
    const preferredTier: AITier = agentId ? (AGENT_TIER_MAP[agentId] || 'GERENTE') : 'GERENTE';
    const sorted: CascadeProvider[] = [];
    for (const tier of TIER_FALLBACK[preferredTier]) sorted.push(...allProviders.filter(p => p.tier === tier));
    const errors: string[] = [];
    for (const p of sorted) {
        try {
            const text = await p.call(prompt);
            if (text) { const label = p.tier === preferredTier ? '' : ` ↑${p.tier}`; return { text, provider: `${p.name}${label}` }; }
        } catch (e: any) {
            if (e.message?.includes('429')) {
                await delay(25000);
                try { const t = await p.call(prompt); if (t) return { text: t, provider: `${p.name} (retry)` }; } catch (re: any) { errors.push(`${p.name}: ${re.message}`); }
            } else { errors.push(`${p.name}: ${e.message}`); }
        }
    }
    throw new Error(`Todas as IAs falharam: ${errors.join(' | ')}`);
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
    { id: 'ADMINISTRATIVO', name: 'Dona Clara', role: 'Administradora Geral', icon: Brain, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    { id: 'PRODUCAO', name: 'Seu Antônio', role: 'Chefe de Produção', icon: Activity, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    { id: 'COMERCIAL', name: 'Marcos', role: 'Diretor Comercial', icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'AUDITOR', name: 'Dra. Beatriz', role: 'Auditora', icon: Shield, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
    { id: 'ESTOQUE', name: 'Joaquim', role: 'Estoquista-Chefe', icon: Package, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
    { id: 'COMPRAS', name: 'Roberto', role: 'Comprador', icon: Truck, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
    { id: 'MERCADO', name: 'Ana', role: 'Consultora de Mercado', icon: BarChart3, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
    { id: 'ROBO_VENDAS', name: 'Lucas', role: 'Vendas & Inovação', icon: Bot, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
    { id: 'MARKETING', name: 'Isabela', role: 'Gestora de Marketing', icon: Sparkles, color: 'text-pink-600', bgColor: 'bg-pink-50', borderColor: 'border-pink-200' },
    { id: 'SATISFACAO', name: 'Camila', role: 'Customer Success (CS) & Qualidade', icon: MessageCircle, color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
    // ═══ PEÕES — IAs GRÁTIS ═══
    { id: 'CONFERENTE', name: 'Pedro', role: 'Conferente de Dados', icon: Search, color: 'text-stone-600', bgColor: 'bg-stone-50', borderColor: 'border-stone-200' },
    { id: 'RELATORIOS', name: 'Rafael', role: 'Gerador de Relatórios', icon: FileText, color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
    { id: 'WHATSAPP_BOT', name: 'Wellington', role: 'Bot WhatsApp', icon: Smartphone, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    { id: 'AGENDA', name: 'Amanda', role: 'Gestora de Agenda', icon: CalendarDays, color: 'text-sky-600', bgColor: 'bg-sky-50', borderColor: 'border-sky-200' },
    { id: 'TEMPERATURA', name: 'Carlos', role: 'Monitor de Temperatura', icon: Thermometer, color: 'text-red-500', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    { id: 'COBRANCA', name: 'Diana', role: 'Cobrança Automática', icon: Banknote, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
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

type ChatTab = 'chat' | 'meeting' | 'log';

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
    const chatEndRef = useRef<HTMLDivElement>(null);
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

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentHistory]);

    useEffect(() => {
        meetingEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [meetingMessages]);

    // ═══ AGENT SYSTEM PROMPTS ═══
    const getAgentSystemPrompt = (agentId: AgentType) => {
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

        if (agentId === 'MARKETING') {
            basePrompt += `\n\nFOCO DE INTELIGÊNCIA EM MARKETING: Você é especialista nas melhores formas de conseguir leads no setor da cadeia da carne (açougues de luxo, restaurantes e fornecedores do agro/pecuaristas). Descubra o que atrai a atenção desse público e quais propagandas modernas funcionam hoje. Instrua o FrigoGest sobre o que falta no App para capturar esses leads (ex: landings, iscas digitais) e crie campanhas de altíssimo nível.`;
        }

        if (agentId === 'SATISFACAO') {
            basePrompt += `\n\nVocê tem 30 ANOS DE EXPERIÊNCIA na cadeia da carne. Você já foi desossadora, gerente de expedição, compradora de gado e auditora de qualidade. Você sabe que "carne escura" pode ser pH alto (DFD), que "muito osso" é desossa apressada, que "faltou peso" pode ser drip loss por câmara mal regulada. Você fala a LÍNGUA DO AÇOUGUEIRO.

OBRIGAÇÃO DE PESQUISA (CUSTOMER SUCCESS): Você DEVE usar a ferramenta googleSearch para pesquisar "melhores práticas pesquisa satisfação cliente B2B distribuidor carnes açougue restaurante WhatsApp NPS CSAT".
Mergulhe nas metodologias mais modernas para pesquisar satisfação de donos de açougues e churrascarias SEM SER CHATA (máx 3 perguntas, tom de parceiro, nunca telemarketing).
Investigue 3 pilares: QUALIDADE do produto (gordura, rendimento, cor), LOGÍSTICA (temperatura, horário, embalagem), e INTELIGÊNCIA DE MERCADO (o que o cliente final tá pedindo que a gente não tem).
Sua regra de ouro: Ajude o FrigoGest a melhorar baseado em CONVERSAS REAIS com os clientes!`;
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

            // Log activity
            setActivityLog(prev => [...prev, {
                id: `log-${Date.now()}`,
                agent: selectedAgent,
                action: `Respondeu: "${inputText.substring(0, 50)}..."`,
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
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
