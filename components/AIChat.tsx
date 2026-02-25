import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    ArrowLeft, Send, MessageCircle, Users, Clock,
    Brain, Shield, TrendingUp, BarChart3, Package,
    DollarSign, Truck, Bot, Loader2, Sparkles,
    ChevronRight, Activity
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import {
    AgentType, Batch, StockItem, Sale, Client,
    Transaction, Supplier, Payable, ScheduledOrder
} from '../types';

// ═══ CASCADE (same as AIAgents) ═══
interface CascadeProvider {
    name: string;
    call: (prompt: string) => Promise<string>;
}

const buildCascadeProviders = (): CascadeProvider[] => {
    const providers: CascadeProvider[] = [];
    const geminiKey = (import.meta as any).env.VITE_AI_API_KEY as string || '';
    const groqKey = (import.meta as any).env.VITE_GROQ_API_KEY as string || '';
    const cerebrasKey = (import.meta as any).env.VITE_CEREBRAS_API_KEY as string || '';

    if (geminiKey) {
        providers.push({
            name: 'Gemini',
            call: async (prompt: string) => {
                const ai = new GoogleGenAI({ apiKey: geminiKey });
                const res = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: { parts: [{ text: prompt }] },
                });
                const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!text) throw new Error('Gemini sem resposta');
                return text;
            },
        });
    }
    if (groqKey) {
        providers.push({
            name: 'Groq',
            call: async (prompt: string) => {
                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
                    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 2048 }),
                });
                if (!res.ok) throw new Error(`Groq ${res.status}`);
                const data = await res.json();
                return data.choices?.[0]?.message?.content || '';
            },
        });
    }
    if (cerebrasKey) {
        providers.push({
            name: 'Cerebras',
            call: async (prompt: string) => {
                const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cerebrasKey}` },
                    body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: prompt }], max_tokens: 2048 }),
                });
                if (!res.ok) throw new Error(`Cerebras ${res.status}`);
                const data = await res.json();
                return data.choices?.[0]?.message?.content || '';
            },
        });
    }
    return providers;
};

const runCascade = async (prompt: string): Promise<{ text: string; provider: string }> => {
    const providers = buildCascadeProviders();
    if (!providers.length) throw new Error('Nenhuma chave de IA configurada.');
    const errors: string[] = [];
    for (const p of providers) {
        try {
            const text = await p.call(prompt);
            return { text, provider: p.name };
        } catch (e: any) {
            errors.push(`${p.name}: ${e.message}`);
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

    const currentAgent = AGENTS.find(a => a.id === selectedAgent)!;
    const currentHistory = chatHistories[selectedAgent] || [];

    // Build data snapshot for context
    const dataSnapshot = useMemo(() => {
        const validTx = transactions.filter(t => t.categoria !== 'ESTORNO');
        const entradas = validTx.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
        const saidas = validTx.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
        const activeStock = stock.filter(s => s.status === 'DISPONIVEL');
        const totalKg = activeStock.reduce((s, i) => s + i.peso_kg, 0);

        return `DADOS DO FRIGORÍFICO (snapshot real):
- Lotes: ${batches.length} | Estoque: ${activeStock.length} peças (${totalKg.toFixed(1)}kg)
- Vendas: ${sales.length} | Clientes: ${clients.length}
- Fornecedores: ${suppliers.length} | Contas a Pagar: ${payables.length}
- Entradas: R$${entradas.toFixed(2)} | Saídas: R$${saidas.toFixed(2)} | Saldo: R$${(entradas - saidas).toFixed(2)}`;
    }, [batches, stock, sales, clients, transactions, suppliers, payables]);

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
        return `Você é ${agent.name}, ${agent.role} do FrigoGest.
Você está numa CONVERSA DIRETA com o dono do frigorífico. Ele pode te fazer perguntas, pedir conselhos, ou discutir estratégia.

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja DIRETO e PRÁTICO — fale como gerente, não como robô
- Use emojis quando apropriado: 🔴 crítico, 🟡 atenção, 🟢 ok
- Se tiver dados do snapshot, cite números específicos
- Se não souber, diga claramente
- Máximo 300 palavras (é um chat, não um relatório)
- Seja NATURAL — como se estivesse no WhatsApp com o chefe

${dataSnapshot}`;
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

            const { text, provider } = await runCascade(fullPrompt);

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

        // Each agent responds in sequence
        for (const agent of AGENTS) {
            try {
                const meetingPrompt = `Você é ${agent.name}, ${agent.role} do FrigoGest.
Você está numa REUNIÃO com o dono e os outros 7 gerentes. O assunto é:

"${topic}"

${dataSnapshot}

Dê sua opinião do ponto de vista da sua especialidade em NO MÁXIMO 150 palavras.
Seja direto, prático, e fale como se estivesse numa mesa de reunião.
Comece com seu ponto principal, não repita o que os outros provavelmente já disseram.`;

                const { text, provider } = await runCascade(meetingPrompt);

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
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gerentes</p>
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
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                        placeholder={`Fale com ${currentAgent.name}...`}
                                        className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
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
                                <div>
                                    <p className="text-sm font-black text-amber-800">Reunião de IA</p>
                                    <p className="text-[10px] text-amber-600 font-bold">Todos os 8 gerentes discutem um tema</p>
                                </div>
                                {meetingLoading && (
                                    <div className="ml-auto flex items-center gap-2 text-amber-600">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span className="text-xs font-bold">Em andamento...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Meeting Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {meetingMessages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                    <Users size={48} className="text-amber-400 mb-4" />
                                    <p className="text-sm font-bold text-slate-500">Inicie uma reunião</p>
                                    <p className="text-xs text-slate-400 mt-1">Digite um tema e todos os gerentes darão sua opinião</p>
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
