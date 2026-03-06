import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, X, MessageCircle, Sparkles, Phone, Video, MapPin, TrendingUp, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Message {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    type?: 'question' | 'success' | 'info';
}

interface VirtualAssistantProps {
    onClose: () => void;
}

const VirtualAssistant: React.FC<VirtualAssistantProps> = ({ onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '🏢 **CENTRAL DE INTELIGÊNCIA FRIGOGEST**\n\nOlá! Selecione qual Especialista você quer acionar hoje:\n\n1️⃣ **Gerente Comercial** (Negociar Gado/Vendas)\n2️⃣ **Suporte Técnico** (Problemas no App)\n3️⃣ **Analista Financeiro** (Simular Lucro/Custos)\n\n*Digite o número da sua escolha (1, 2 ou 3):*',
            type: 'question'
        }
    ]);
    const [selectedAgent, setSelectedAgent] = useState<'comercial' | 'suporte' | 'financeiro' | null>(null);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [step, setStep] = useState<'initial' | 'buying' | 'selling' | 'client' | 'collecting_data' | 'reporting_issue' | 'calc_profit'>('initial');
    const [leadData, setLeadData] = useState<any>({
        tipo: '',
        nome: '',
        whatsapp: '',
        localizacao: '',
        tipo_gado: '',
        reserva_item: '',
        reserva_quantidade: '',
        arroba_estimada: '',
        tem_video: false
    });

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const addMessage = (role: 'assistant' | 'user', content: string, type?: 'question' | 'success' | 'info') => {
        setMessages(prev => [...prev, { id: Date.now().toString(), role, content, type }]);
    };

    const simulateTyping = (content: string, delay = 1500, nextAction?: () => void) => {
        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            addMessage('assistant', content);
            if (nextAction) nextAction();
        }, delay);
    };

    const formatWhatsApp = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        if (cleaned.length > 0 && !cleaned.startsWith('55')) {
            return '55' + cleaned;
        }
        return cleaned;
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput('');
        addMessage('user', userMessage);

        if (!selectedAgent) {
            const choice = userMessage.trim();
            if (choice === '1' || choice.toLowerCase().includes('comercial') || choice.toLowerCase().includes('vendas')) {
                setSelectedAgent('comercial');
                simulateTyping('👨‍💼 **Gerente Comercial:**\nOlá! Vamos fechar negócios. Você quer **COMPRAR** ou **VENDER** gado hoje?');
                setStep('initial'); // Reuse existing buying/selling logic
            } else if (choice === '2' || choice.toLowerCase().includes('suporte')) {
                setSelectedAgent('suporte');
                simulateTyping('👷 **Suporte Técnico:**\nEntendido. Qual problema você está enfrentando no sistema? (Ex: Erro no login, Valor errado, etc)');
                setStep('reporting_issue');
            } else if (choice === '3' || choice.toLowerCase().includes('financeiro') || choice.toLowerCase().includes('lucro')) {
                setSelectedAgent('financeiro');
                simulateTyping('🧠 **Analista Financeiro:**\nPosso te ajudar a calcular margens. Me diga: Qual o valor da Arroba de Compra e Venda que você quer simular?');
                setStep('calc_profit');
            } else {
                simulateTyping('⚠️ Opção inválida. Digite **1**, **2** ou **3**.');
            }
            return;
        }

        // AGENT SPECIFIC LOGIC
        if (selectedAgent === 'comercial') {
            // Re-use existing routing but adapted
            const lower = userMessage.toLowerCase();
            if (step === 'initial') {
                if (lower.includes('vender') || lower.includes('fornecedor')) {
                    setStep('selling');
                    setLeadData(prev => ({ ...prev, tipo: 'fornecedor' }));
                    simulateTyping('Excelente! Estamos sempre buscando novos parceiros. 🤝 Qual o seu nome completo?');
                } else if (lower.includes('comprar') || lower.includes('venda')) {
                    setStep('buying');
                    setLeadData(prev => ({ ...prev, tipo: 'venda' }));
                    simulateTyping('Ótima escolha! Temos lotes premium. 🥩 Qual o seu nome completo?');
                } else {
                    simulateTyping('Não entendi. Digite **Comprar** ou **Vender**.');
                }
                return;
            }
        }

        if (selectedAgent === 'suporte') {
            simulateTyping('📝 Registrei sua solicitação: "' + userMessage + '".\n\nJá notifiquei o Thiago via sistema. Ele vai entrar em contato para resolver isso. Algo mais?');
            return;
        }

        if (selectedAgent === 'financeiro') {
            simulateTyping('📊 Interessante... Para uma análise completa, recomendo usar a aba "Simulador" no menu principal. Lá tenho ferramentas avançadas de custo de carcaça. Quer que eu avise o Thiago para te ligar?');
            return;
        }

        if (step === 'client') {
            if (!leadData.nome) {
                setLeadData(prev => ({ ...prev, nome: userMessage }));
                simulateTyping(`Certo, ${userMessage}! Qual o seu WhatsApp com DDD? Vou pedir para o suporte te chamar agora mesmo.`);
            } else if (!leadData.whatsapp) {
                const formattedPhone = formatWhatsApp(userMessage);
                setLeadData(prev => ({ ...prev, whatsapp: formattedPhone }));
                simulateTyping(`Perfeito! Registrei o número ${formattedPhone}. Já avisei a equipe. Posso confirmar o envio do seu contato para o Thiago?`, 1500, () => {
                    // Permite que o usuário apenas confirme ou envie qualquer mensagem para finalizar
                });
            } else {
                finishLead();
            }
            return;
        }

        if (step === 'selling') {
            if (!leadData.nome) {
                setLeadData(prev => ({ ...prev, nome: userMessage }));
                simulateTyping(`Prazer, ${userMessage}! E qual seu WhatsApp com DDD? (Vou precisar dele para o Thiago te mandar o contrato)`);
            } else if (!leadData.whatsapp) {
                const formattedPhone = formatWhatsApp(userMessage);
                setLeadData(prev => ({ ...prev, whatsapp: formattedPhone }));
                simulateTyping(`Perfeito! Registrei o número ${formattedPhone}. Agora me conte: qual o tipo de gado que você tem para vender (ex: Novilhas, Bois, etc) e qual a quantidade aproximada?`);
            } else if (!leadData.tipo_gado) {
                setLeadData(prev => ({ ...prev, tipo_gado: userMessage }));
                simulateTyping('Entendido. Qual a arrobação média estimada desse lote? E em qual cidade/região eles estão?');
            } else if (!leadData.arroba_estimada) {
                setLeadData(prev => ({ ...prev, arroba_estimada: userMessage }));
                simulateTyping('Quase lá! Você teria um vídeo desse lote? Se sim, o Thiago vai te pedir pelo WhatsApp logo após eu enviar seus dados. Posso finalizar seu cadastro agora?');
            } else {
                finishLead();
            }
        }

        if (step === 'buying') {
            if (!leadData.nome) {
                setLeadData(prev => ({ ...prev, nome: userMessage }));
                simulateTyping(`Prazer, ${userMessage}! Qual seu WhatsApp com DDD para enviarmos nossa tabela de preços?`);
            } else if (!leadData.whatsapp) {
                const formattedPhone = formatWhatsApp(userMessage);
                setLeadData(prev => ({ ...prev, whatsapp: formattedPhone }));
                simulateTyping(`Show! Registrei o número ${formattedPhone}. O que você está buscando hoje? (Ex: Banda A, Lote de Novilhas, etc) e qual a quantidade?`);
            } else if (!leadData.reserva_item) {
                setLeadData(prev => ({ ...prev, reserva_item: userMessage }));
                simulateTyping('Perfeito! Posso encaminhar sua solicitação para o Thiago finalizar com você?');
            } else {
                finishLead();
            }
        }
    };

    const finishLead = async () => {
        simulateTyping('Estou enviando seus dados agora mesmo para o sistema central do Thiago 704... 🚀');
        try {
            if (supabase) {
                await supabase.from('leads').insert({
                    ...leadData,
                    timestamp: new Date().toISOString(),
                    status: 'novo',
                    mensagem: 'Lead qualificado via Assistente Virtual IA.'
                });
            }
            setTimeout(() => {
                addMessage('assistant', 'PRONTO! ✅ Seus dados foram recebidos com sucesso. O Thiago 704 acabou de ser notificado e entrará em contato em breve via WhatsApp. Obrigado pela confiança!', 'success');
            }, 2000);
        } catch (e) {
            simulateTyping('Ops, tive um probleminha técnico para salvar, mas não se preocupe, tente preencher o formulário manual ao lado.');
        }
    };

    return (
        <div className="fixed inset-0 md:inset-auto md:bottom-8 md:right-8 md:w-[450px] md:h-[650px] bg-white md:rounded-[40px] shadow-2xl flex flex-col overflow-hidden z-[500] border border-slate-100 animate-reveal">
            {/* HEADER */}
            <div className="bg-slate-900 p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-900/40 relative">
                        <Bot size={24} />
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-slate-900" />
                    </div>
                    <div>
                        <h4 className="text-white font-black text-sm uppercase tracking-tight">Thiago 704 AI</h4>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Sincronizado</span>
                            <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-2xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center"
                >
                    <X size={20} />
                </button>
            </div>

            {/* MESSAGES */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 no-scrollbar"
            >
                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-reveal`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${m.role === 'user'
                            ? 'bg-blue-600 text-white font-bold ml-8 rounded-tr-none shadow-md shadow-blue-900/10'
                            : m.type === 'success'
                                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                                : 'bg-white text-slate-900 border border-slate-200 shadow-sm rounded-tl-none font-medium'
                            }`}>
                            {m.role === 'assistant' && (
                                <div className="flex items-center gap-2 mb-2 text-[8px] font-black uppercase tracking-[0.2em] text-blue-600">
                                    <Sparkles size={10} /> Agente Cognitivo
                                </div>
                            )}
                            <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start animate-reveal">
                        <div className="bg-white border border-slate-200 p-4 rounded-2xl flex gap-1.5">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                        </div>
                    </div>
                )}
            </div>

            {/* FOOTER INPUT */}
            <div className="p-6 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Responda aqui..."
                    spellCheck={false}
                    className="flex-1 h-14 bg-slate-50 border border-slate-200 rounded-2xl px-6 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
                <button
                    onClick={handleSend}
                    className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:scale-105 transition-all shadow-xl shadow-slate-900/20"
                >
                    <Send size={20} />
                </button>
            </div>
        </div>
    );
};

export default VirtualAssistant;
