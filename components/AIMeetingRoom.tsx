import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Send, Users, TrendingUp, AlertCircle, Bot, Zap, Search, ShieldCheck, Mic, MicOff } from 'lucide-react';

import { GoogleGenAI } from '@google/genai';
import { Batch, StockItem, Sale, Client, Transaction, Supplier, Payable, ScheduledOrder } from '../types';

interface AIMeetingRoomProps {
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

type AgentRole = 'user' | 'agent_comercial' | 'agent_financeiro' | 'agent_auditor';

interface Message {
    id: string;
    role: AgentRole;
    content: string;
    timestamp: string;
}

const AIMeetingRoom: React.FC<AIMeetingRoomProps> = ({
    onBack, batches, stock, sales, clients,
    transactions, suppliers, payables, scheduledOrders
}) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'agent_auditor',
            content: 'Bem-vindo à Reunião de Diretoria (War Room). Sou o CEO/Auditor. Estão presentes nesta sala o **Diretor Comercial** (Marketing e Vendas) e o **Diretor Financeiro** (Fluxo de Caixa).\n\nQual é a pauta de hoje? Ex: "Temos muito dianteiro em estoque, o que fazer?" ou "Quais as campanhas para os clientes inativos?"',
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState<AgentRole | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionMeetRef = useRef<any>(null);
    const [isListeningMeet, setIsListeningMeet] = useState(false);

    const toggleMicMeet = useCallback(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { alert('Microfone n\u00e3o suportado neste navegador.'); return; }
        if (isListeningMeet) { recognitionMeetRef.current?.stop(); setIsListeningMeet(false); return; }
        const r = new SR();
        r.lang = 'pt-BR'; r.continuous = false; r.interimResults = false;
        r.onstart = () => setIsListeningMeet(true);
        r.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput(prev => prev ? prev + ' ' + t : t); };
        r.onend = () => setIsListeningMeet(false);
        r.onerror = () => setIsListeningMeet(false);
        r.start(); recognitionMeetRef.current = r;
    }, [isListeningMeet]);



    // --- CONTEXT SNAPSHOT ---
    const dataSnapshot = useMemo(() => {
        const hoje = new Date();
        const msPerDay = 86400000;

        // Simplificando o snapshot para caber sem gargalos:
        const lotesFechados = batches.filter(b => b.status === 'FECHADO');
        const activeStock = stock.filter(s => s.status === 'DISPONIVEL');
        const totalKg = activeStock.reduce((s, i) => s + i.peso_entrada, 0);
        const pecasCríticas = activeStock.filter(i => Math.floor((hoje.getTime() - new Date(i.data_entrada).getTime()) / msPerDay) > 7);

        // Vendas e Clientes (Foco Marketing)
        const vendasPendentes = sales.filter(s => s.status_pagamento === 'PENDENTE');
        const receitaPendente = vendasPendentes.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
        const clientesAtivos = clients.filter(c => c.status !== 'INATIVO');

        // Top Clientes
        const topClientes = clients.sort((a, b) => {
            const va = sales.filter(s => s.id_cliente === a.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0);
            const vb = sales.filter(s => s.id_cliente === b.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0);
            return vb - va;
        }).slice(0, 5).map(c => {
            const cv = sales.filter(s => s.id_cliente === c.id_ferro);
            return `- ${c.nome_social}: ${cv.length} compras, forma freq: ${cv.length > 0 ? cv[cv.length - 1].forma_pagamento : 'N/I'}`;
        }).join('\n');

        // Fluxo de caixa
        const validTx = transactions.filter(t => t.id?.startsWith('TR-REC-') || t.id?.startsWith('TR-PAY-') || t.categoria === 'VENDA' || t.categoria === 'ESTORNO');
        const entradas = validTx.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
        const saidas = validTx.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
        const saldo = entradas - saidas;

        return `DADOS DO FRIGÓRIFICO HOJE (${hoje.toLocaleDateString('pt-BR')}):\n
ESTOQUE: ${activeStock.length} peças totais (${totalKg.toFixed(1)}kg). Peças Críticas (>7 dias estocadas): ${pecasCríticas.length}\n
FINANCEIRO: Saldo R$${saldo.toFixed(2)}. Falta receber de vendas: R$${receitaPendente.toFixed(2)}.\n
VENDAS E MARKETING:\n- Clientes Totais: ${clientesAtivos.length}\n- Top 5 Clientes:\n${topClientes}\n`;
    }, [batches, stock, sales, clients, transactions]);

    // --- GEMINI WITH GOOGLE SEARCH ---
    const callGemini = async (prompt: string): Promise<string> => {
        const geminiKey = (import.meta as any).env.VITE_AI_API_KEY as string || '';
        if (!geminiKey) throw new Error("Chave do Gemini não configurada");

        const ai = new GoogleGenAI({ apiKey: geminiKey });

        try {
            const res = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: { parts: [{ text: prompt }] },
                config: {
                    tools: [{ googleSearch: {} }],
                }
            });
            return res.candidates?.[0]?.content?.parts?.[0]?.text || 'Nenhuma resposta';
        } catch (error: any) {
            if (error.message.includes('googleSearch')) {
                // Fallback case new SDK structure for tools differs
                const fbReq = await ai.models.generateContent({
                    model: 'gemini-1.5-flash',
                    contents: { parts: [{ text: prompt }] }
                });
                return fbReq.candidates?.[0]?.content?.parts?.[0]?.text || 'Fallback OK';
            }
            throw error;
        }
    };

    const getAgentPrompt = (agent: AgentRole, history: Message[]) => {
        let roleDef = '';
        if (agent === 'agent_comercial') {
            roleDef = `Você é Marcos, o DIRETOR COMERCIAL e de Marketing do FrigoGest. Você SEMPRE foca em aumentar vendas, escoar o estoque encalhado e propor Campanhas de Vendas agressivas.\n
OBRIGAÇÃO DE PESQUISA REGIONAL: Use SEMPRE a ferramenta googleSearch para buscar o "Preço da Arroba do Boi Gordo e da Carcaça hoje em Vitória da Conquista, Sul/Sudoeste da Bahia". Fontes recomendadas: Scot Consultoria, Acrioeste, Notícias Agrícolas, Cepea. \n
REGRA DE OURO: Você DEVE citar explicitamente no seu texto qual foi a fonte da pesquisa e o preço exato que encontrou hoje para basear seus lances e campanhas de marketing!\n\n`;
        } else if (agent === 'agent_financeiro') {
            roleDef = `Você é o DIRETOR FINANCEIRO do FrigoGest. Você é muito analítico, conservador e defende o Saldo do Caixa. Se o Diretor Comercial ou o Dono propuserem descontos ou campanhas, você DEVE analisar financeiramente (impacto no caixa).\n
OBRIGAÇÃO DE PESQUISA MACROECONÔMICA: Use a ferramenta googleSearch para buscar a cotação real do Dólar hoje, a Selic atual e o Índice de Inflação da Carne. Você DEVE citar explicitamente no seu texto os valores que encontrou na internet e qual site usou (ex: Valor Econômico, InfoMoney) para barrar ou não a campanha do Marcos!\n\n`;
        } else if (agent === 'agent_auditor') {
            roleDef = `Você é a AUDITORA e CEO do FrigoGest. Você deve ler o que o Comercial e o Financeiro debateram logo acima. Com base no embate deles (e checando se eles trouxeram dados REAIS da Bahia/Vitória da Conquista), tire uma conclusão concisa e assertiva, dê o Veredito Final sugerindo a melhor ação conjunta, e pergunte se o Dono concorda.\n\n`;
        }

        const convHistory = history.map(m => {
            const nome = m.role === 'user' ? 'DONO (Usuário)' :
                m.role === 'agent_comercial' ? 'DIRETOR COMERCIAL' :
                    m.role === 'agent_financeiro' ? 'DIRETOR FINANCEIRO' : 'AUDITOR (CEO)';
            return `${nome} disse: ${m.content}`;
        }).join('\n\n');

        return `${roleDef}Aqui estão os Dados Reais Atuais da Empresa:\n${dataSnapshot}\n\nHistórico da Reunião de Diretoria Até Agora:\n${convHistory}\n\nAGORA É A SUA VEZ DE FALAR. Responda de forma direta, madura (máximo 150 palavras). Converse com o usuário e os outros diretores presentes. Não emita blocos de formatação vazia.`;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };

        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');

        // INICIA O LOOP DE DEBATE AUTOMÁTICO
        try {
            // 1. DIRETOR COMERCIAL
            setIsTyping('agent_comercial');
            const comPrompt = getAgentPrompt('agent_comercial', newHistory);
            const comText = await callGemini(comPrompt);

            const comMsg: Message = {
                id: Date.now().toString() + 'C',
                role: 'agent_comercial',
                content: comText,
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            };

            newHistory.push(comMsg);
            setMessages([...newHistory]);

            // 2. DIRETOR FINANCEIRO (Reage ao Comercial)
            setIsTyping('agent_financeiro');
            const finPrompt = getAgentPrompt('agent_financeiro', newHistory);
            const finText = await callGemini(finPrompt);

            const finMsg: Message = {
                id: Date.now().toString() + 'F',
                role: 'agent_financeiro',
                content: finText,
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            };

            newHistory.push(finMsg);
            setMessages([...newHistory]);

            // 3. AUDITOR (Fechamento)
            setIsTyping('agent_auditor');
            const audPrompt = getAgentPrompt('agent_auditor', newHistory);
            const audText = await callGemini(audPrompt);

            const audMsg: Message = {
                id: Date.now().toString() + 'A',
                role: 'agent_auditor',
                content: audText,
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            };

            setMessages([...newHistory, audMsg]);
            setIsTyping(null);

        } catch (e: any) {
            setIsTyping(null);
            setMessages(prev => [...prev, {
                id: Date.now().toString() + 'E',
                role: 'agent_auditor',
                content: `⚠️ Erro de Reunião: Nós perdemos a conexão. [${e.message}]`,
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }]);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* HEADER */}
            <div className="bg-slate-900 text-white p-4 shadow-xl flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                            <Users size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                                Sala de Guerra <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 text-[10px] rounded border border-rose-500/30">AO VIVO</span>
                            </h1>
                            <p className="text-xs text-slate-400 font-medium">Reunião de Diretoria Interativa</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CHAT AREA */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex max-w-4xl mx-auto gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                        {/* AVATAR */}
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg border-2
              ${msg.role === 'user' ? 'bg-slate-800 border-slate-700' :
                                msg.role === 'agent_comercial' ? 'bg-amber-100 border-amber-200 text-amber-700' :
                                    msg.role === 'agent_financeiro' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' :
                                        'bg-blue-100 border-blue-200 text-blue-700'
                            }
            `}>
                            {msg.role === 'user' ? <span className="font-bold text-white">V</span> :
                                msg.role === 'agent_comercial' ? <TrendingUp size={20} /> :
                                    msg.role === 'agent_financeiro' ? <Zap size={20} /> :
                                        <ShieldCheck size={20} />}
                        </div>

                        {/* BUBBLE */}
                        <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                                {msg.role === 'user' ? 'Você (Presidência)' :
                                    msg.role === 'agent_comercial' ? 'Diretor Comercial' :
                                        msg.role === 'agent_financeiro' ? 'Diretor Financeiro' :
                                            'Auditor (CEO)'}
                                {' '}• {msg.timestamp}
                            </span>
                            <div className={`p-4 md:p-5 rounded-[2rem] text-sm md:text-base leading-relaxed shadow-sm max-w-2xl
                ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' :
                                    msg.role === 'agent_comercial' ? 'bg-white border border-amber-100 rounded-tl-none font-medium' :
                                        msg.role === 'agent_financeiro' ? 'bg-white border border-emerald-100 rounded-tl-none font-medium' :
                                            'bg-blue-50 border border-blue-100 rounded-tl-none font-medium text-slate-900'
                                }
              `}>
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>

                    </div>
                ))}

                {isTyping && (
                    <div className="flex max-w-4xl mx-auto gap-4 flex-row">
                        <div className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg border-2 bg-slate-100 border-slate-200 text-slate-400 animate-pulse">
                            <Bot size={20} />
                        </div>
                        <div className="bg-white px-5 py-4 rounded-[2rem] rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="text-xs font-bold text-slate-400 ml-2 uppercase tracking-tight">
                                {isTyping === 'agent_comercial' ? 'Comercial pesquisando mercado...' :
                                    isTyping === 'agent_financeiro' ? 'Financeiro calculando riscos...' : 'Auditor montando consenso...'}
                            </span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto relative flex gap-2">
                    <button
                        onClick={toggleMicMeet}
                        title={isListeningMeet ? 'Parar gravação' : 'Falar sua pauta'}
                        className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isListeningMeet
                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/40'
                            : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600'
                            }`}
                    >
                        {isListeningMeet ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={isListeningMeet ? '🔴 Ouvindo... fale sua pauta!' : "Interfira na reunião... ex: 'Acho que devemos liquidar as peças críticas com 15% de desconto!'"}
                            className={`w-full bg-slate-50 border-2 text-slate-900 rounded-[2rem] pl-6 pr-16 py-4 outline-none transition-all font-medium placeholder:text-slate-400 shadow-inner ${isListeningMeet ? 'border-red-400 bg-red-50 placeholder:text-red-400' : 'border-slate-200 focus:border-rose-400 focus:bg-white'
                                }`}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || !!isTyping}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400 transition-colors shadow-lg shadow-rose-500/20"
                        >
                            <Send size={18} className="translate-x-[1px] translate-y-[-1px]" />
                        </button>
                    </div>
                </div>
                {isListeningMeet && (
                    <p className="text-center text-xs text-red-500 font-bold mt-2 animate-pulse">🔴 Microfone ativo — fale agora em português!</p>
                )}
            </div>
        </div>
    );
};

export default AIMeetingRoom;
