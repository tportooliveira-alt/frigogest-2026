import React, { useState, useEffect, useRef } from 'react';
import {
    Play,
    Pause,
    RotateCcw,
    ChevronRight,
    MousePointer2,
    MessageCircle,
    CheckCircle2,
    Bot,
    Globe,
    Smartphone,
    X,
    Cpu,
    Activity,
    Package,
    Scale,
    History,
    Beef,
    DollarSign,
    ShieldCheck,
    Users,
    TrendingUp,
    FileText,
    LayoutDashboard,
    AlertCircle,
    Truck,
    Volume2
} from 'lucide-react';

interface Scene {
    title: string;
    sub: string;
    action: string;
    duration: number;
    render: () => React.ReactNode;
}

const VideoTutorial: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [currentScene, setCurrentScene] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const progressIntervalRef = useRef<any>(null);

    // FUNÇÃO DE VOZ REFORÇADA (ANTI-CORTE)
    const falarComCalma = (texto: string) => {
        if (!('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();

        // Quebra o texto em frases menores para não bugar o Chrome
        const frases = texto.split('. ');
        let index = 0;

        const falarProximaFrase = () => {
            if (index >= frases.length) {
                setIsSpeaking(false);
                return;
            }

            const msg = new SpeechSynthesisUtterance(frases[index]);
            msg.lang = 'pt-BR';
            msg.rate = 0.9;
            msg.pitch = 1.0;

            // Tenta achar uma voz brasileira real
            const voices = window.speechSynthesis.getVoices();
            const ptVoice = voices.find(v => v.lang.includes('PT') || v.lang.includes('BR'));
            if (ptVoice) msg.voice = ptVoice;

            msg.onstart = () => setIsSpeaking(true);
            msg.onend = () => {
                index++;
                // Pequena pausa entre frases para naturalidade
                setTimeout(falarProximaFrase, 300);
            };

            // HACK: Evita o corte de 15 segundos do Chrome
            msg.onboundary = (event) => {
                if (event.name === 'word') {
                    // Manutenção de atividade
                }
            };

            utteranceRef.current = msg;
            window.speechSynthesis.speak(msg);
        };

        falarProximaFrase();
    };

    const scenes: Scene[] = [
        {
            title: "1. O Robô Atendente no Site",
            sub: "Tudo começa na porta da sua empresa na internet. O robô atende o cliente, pergunta o nome, o WhatsApp e o que ele deseja. Isso filtra quem realmente quer fazer negócio, economizando o tempo da sua equipe.",
            action: "Robô capturando Lead...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-slate-50 flex items-center justify-center p-8">
                    <div className="w-full max-w-sm bg-white rounded-[32px] shadow-2xl p-6 border border-slate-100 flex flex-col gap-4 animate-reveal">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg"><Bot size={20} /></div>
                            <div>
                                <p className="text-xs font-black uppercase text-slate-900">Atendimento Thiago 704</p>
                                <p className="text-[9px] text-emerald-500 font-bold italic">● AGENTE ATIVO 24H</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none mr-6">
                                <p className="text-[11px] font-bold text-slate-700">Olá! Eu sou o assistente do Thiago. Qual seu WhatsApp e o que você precisa?</p>
                            </div>
                            <div className="bg-blue-600 p-3 rounded-2xl rounded-tr-none ml-6 text-white shadow-md">
                                <p className="text-[11px] font-bold tracking-tight">Oi, quero comprar gado e vender carnes.</p>
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-[60%] left-[30%] animate-bounce"><MousePointer2 size={32} className="text-blue-600" /></div>
                </div>
            )
        },
        {
            title: "2. Triagem e Trava de Segurança",
            sub: "Os dados do site caem na Central de Leads. Repare na cor azul para novos clientes. Quando a Nadjane ou a Priscila clicam no WhatsApp, o sistema coloca o nome de quem assumiu o lead. Isso trava o cliente e evita que duas pessoas liguem para ele ao mesmo tempo.",
            action: "Equipe assumindo o cliente...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-[#f8fafc] p-10 flex flex-col gap-4 justify-center">
                    <div className="max-w-md mx-auto w-full space-y-4">
                        <div className="bg-amber-500 text-white p-6 rounded-3xl shadow-2xl flex items-center justify-between ring-8 ring-amber-100/50 animate-reveal">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner"><MessageCircle size={24} /></div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-tight">CLIENTE: MARCOS DA FAZENDA</p>
                                    <p className="text-[9px] font-bold italic">🟡 EM ATENDIMENTO POR NADJANE</p>
                                </div>
                            </div>
                            <div className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black border border-white/20">PROTEGIDO</div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "3. O IDs de Ferro e o Limite",
            sub: "No cadastro de clientes, usamos o ID de Ferro para identificar rápido cada comprador. O ponto mais importante é o Limite de Crédito. O sistema monitora quanto o cliente deve e não deixa ele carregar carne se passar do valor que você autorizou.",
            action: "Bloqueando crédito de risco...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-slate-900 flex items-center justify-center p-10">
                    <div className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-sm animate-reveal">
                        <div className="flex items-center gap-4 mb-6">
                            <ShieldCheck size={32} className="text-blue-600" />
                            <h4 className="text-2xl font-black text-slate-900 italic">ID 704: SELECT</h4>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Limite Permitido</p>
                            <p className="text-3xl font-black text-blue-600">R$ 50.000,00</p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "4. A Entrada do Gado e os Lotes",
            sub: "Nesta tela você registra a chegada do gado. Você anota o fornecedor, o peso total no caminhão e quanto pagou pelo lote. É aqui que o sistema começa a rastrear o nascimento de cada quilo de carne da sua empresa.",
            action: "Recebendo Carga Animal...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-slate-950 p-10 flex items-center justify-center">
                    <div className="bg-white/5 border border-white/10 p-10 rounded-[40px] w-full max-w-md animate-reveal">
                        <div className="flex items-center gap-5 mb-8 text-blue-400">
                            <Package size={40} />
                            <p className="text-2xl font-black italic text-white uppercase">Novo Lote: LT-100</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                <p className="text-[8px] text-white/50 uppercase font-black">Peso Total</p>
                                <p className="text-lg font-black text-white">4.200 KG</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                <p className="text-[8px] text-white/50 uppercase font-black">Valor Lote</p>
                                <p className="text-lg font-black text-emerald-400">R$ 68.450</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "5. O Desdobro e o Custo Real",
            sub: "O sistema faz a conta completa do seu lucro. Ele soma o valor do boi, o frete pago e os impostos. Depois, ele te dá o custo real de cada quilo de carne pendurado. Isso garante que você nunca venda carne no prejuízo sem saber.",
            action: "Calculando Lucro Líquido...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-blue-600 flex flex-col items-center justify-center text-white text-center p-10">
                    <TrendingUp size={64} className="mb-6 opacity-30" />
                    <p className="text-xs font-black uppercase tracking-[0.6em] mb-2">Custo de Carne no Gancho</p>
                    <h4 className="text-7xl font-black tracking-tighter">R$ 19,45 <small className="text-lg opacity-40">/kg</small></h4>
                    <div className="mt-8 px-6 py-2 bg-white/10 rounded-full border border-white/20 text-[10px] font-black uppercase">Considerando: Gado + Frete + Impostos</div>
                </div>
            )
        },
        {
            title: "6. Estoque na Câmara Fria",
            sub: "Na câmara fria, você vê cada banda de carne separada com seu próprio número. Você sabe exatamente qual banda veio de qual boi e de qual fazenda. É o controle total do seu inventário de ganchos em tempo real.",
            action: "Conferindo Ganchos...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-white p-10 flex flex-col">
                    <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                        <h4 className="text-4xl font-black text-slate-900 italic tracking-tighter">Inventário <span className="text-blue-600">Frio</span></h4>
                        <div className="text-right text-slate-400 font-black"><p className="text-[9px] uppercase">Capacidade</p><p className="text-xl text-slate-900 leading-none">85%</p></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="p-4 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col gap-2">
                                < Beef size={16} className="text-blue-600" />
                                <p className="text-[9px] font-black text-slate-400 uppercase">LT-{700 + i}</p>
                                <p className="text-xs font-black italic">BANDA {i % 2 === 0 ? 'A' : 'B'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            title: "7. Venda e Pesagem de Saída",
            sub: "Na hora de vender, você escolhe as bandas de carne. Como a carne perde peso no frio, o sistema permite que você digite o peso real medido na balança de saída. Assim, o valor cobrado do cliente é sempre o peso exato do momento da venda.",
            action: "Sincronizando Balança...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-[#0a0a0a] p-10 flex flex-col justify-center items-center">
                    <div className="bg-white p-12 rounded-[56px] shadow-[0_40px_100px_rgba(0,0,0,0.5)] w-full max-w-sm animate-reveal relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 -mr-16 -mt-16 rounded-full" />
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl"><Scale size={32} /></div>
                            <div><p className="text-[10px] font-black text-slate-400 uppercase">Balança de Saída</p><p className="text-4xl font-black text-slate-900 italic tracking-tighter leading-none">2.450 <small className="text-lg">KG</small></p></div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400">Cliente ID</p>
                                <p className="text-sm font-black text-slate-900">THIAGO SELECT 704</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "8. Manifesto em PDF Especial",
            sub: "Chega de papéis perdidos. O sistema gera um comprovante profissional com sua marca. Esse PDF tem os pesos reais, valor total e a lista de peças. O motorista leva esse impresso e o cliente assina como comprovante de entrega perfeito.",
            action: "Imprimindo Comprovante...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-slate-50 p-10 flex items-center justify-center">
                    <div className="bg-white p-10 rounded-[48px] shadow-3xl w-full max-w-sm border-t-[16px] border-blue-600 animate-reveal">
                        <div className="flex justify-between items-start mb-10">
                            <div><p className="text-2xl font-black italic leading-none">THIAGO <span className="text-blue-600">704</span></p></div>
                            <FileText size={40} className="text-slate-100" />
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full mb-4" />
                        <div className="h-2 w-3/4 bg-slate-50 rounded-full mb-10" />
                        <div className="bg-blue-600 p-6 rounded-[28px] text-white flex justify-between items-center shadow-xl shadow-blue-500/30">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Nota</p>
                            <p className="text-xl font-black italic">R$ 54.200,80</p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "9. Financeiro e Cobrança",
            sub: "No financeiro, todas as vendas são registradas na hora. Se o cliente atrasar um dia, a linha dele fica vermelha para você cobrar. Quando ele paga, você clica em 'Baixar' e o dinheiro entra direto no seu fluxo de caixa diário.",
            action: "Auditando Recebimentos...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-slate-900 p-10 flex flex-col justify-center items-center gap-6">
                    <div className="bg-emerald-600/10 border border-emerald-500/20 p-8 rounded-[40px] w-full max-w-md flex justify-between items-center text-white animate-reveal">
                        <div className="flex items-center gap-5"><CheckCircle2 className="text-emerald-500" size={32} /><div><p className="text-[9px] font-black text-white/40 uppercase">Marcão Açougue</p><p className="text-lg font-black italic">VALOR RECEBIDO</p></div></div>
                        <p className="text-2xl font-black text-emerald-500">R$ 1.500</p>
                    </div>
                    <div className="bg-rose-600/10 border border-rose-500/20 p-8 rounded-[40px] w-full max-w-md flex justify-between items-center text-white opacity-40">
                        <div className="flex items-center gap-5"><AlertCircle className="text-rose-500" size={32} /><div><p className="text-[9px] font-black text-white/40 uppercase">Venda 704-B</p><p className="text-lg font-black italic">ATRASADO 2 DIAS</p></div></div>
                        <p className="text-2xl font-black text-rose-500">R$ 4.200</p>
                    </div>
                </div>
            )
        },
        {
            title: "10. Resultados e Lucro Real",
            sub: "Aqui você vê o coração da empresa. O sistema pega as vendas e retira o custo do gado e as despesas da loja. O valor que sobrar na tela é o seu lucro limpo. Sem achismo, apenas a verdade do seu negócio.",
            action: "Visualizando Sangria e Lucro...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-emerald-600 flex flex-col items-center justify-center p-10 overflow-hidden text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:60px_60px] opacity-10" />
                    <div className="bg-white/10 backdrop-blur-3xl p-16 rounded-[80px] border border-white/20 text-center animate-reveal shadow-3xl">
                        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-10 shadow-3xl animate-pulse"><TrendingUp size={48} /></div>
                        <p className="text-sm font-black uppercase tracking-[0.6em] opacity-80 mb-2">Lucratividade Atual</p>
                        <h4 className="text-8xl font-black tracking-tighter leading-none mb-6">+ 24%</h4>
                        <p className="text-2xl font-black italic text-emerald-200">R$ 42.850,00 LIVRES</p>
                    </div>
                </div>
            )
        },
        {
            title: "11. Relatório Diário Final",
            sub: "Ao final do turno, Nadjane e Priscila escrevem as ocorrências do dia. Você lê esse diário do seu celular e dorme tranquilo sabendo se tudo correu bem, quem reclamou e o que foi carregado. É o controle total na sua mão.",
            action: "Encerrando Turno das Meninas...",
            duration: 18000,
            render: () => (
                <div className="relative w-full h-full bg-slate-50 p-10 flex items-center justify-center">
                    <div className="bg-white p-12 rounded-[56px] shadow-2xl w-full max-w-sm border border-slate-200 animate-reveal">
                        <div className="flex items-center gap-5 mb-10">
                            <History size={32} className="text-blue-600" />
                            <h4 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Fechamento <br /><span className="text-blue-600">do Dia</span></h4>
                        </div>
                        <div className="space-y-4">
                            <div className="h-4 bg-slate-50 rounded-full w-full" />
                            <div className="h-4 bg-slate-50 rounded-full w-4/5" />
                            <div className="mt-8 pt-8 border-t border-slate-100 flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-900 rounded-full" />
                                <div><p className="text-[10px] font-black text-slate-400 uppercase">Equipe de Hoje</p><p className="text-xs font-black italic">PRISCILA E NADJANE</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    useEffect(() => {
        if (isPlaying) {
            falarComCalma(`${scenes[currentScene].title}. ${scenes[currentScene].sub}`);
        } else {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, [currentScene, isPlaying]);

    useEffect(() => {
        if (isPlaying) {
            progressIntervalRef.current = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        // Se estiver falando, espera um pouco mais em 100%
                        if (isSpeaking) return 100;
                        setCurrentScene(curr => (curr + 1) % scenes.length);
                        return 0;
                    }
                    return prev + 1;
                });
            }, scenes[currentScene].duration / 100);
        } else {
            clearInterval(progressIntervalRef.current);
        }
        return () => clearInterval(progressIntervalRef.current);
    }, [isPlaying, currentScene, isSpeaking]);

    return (
        <div className="fixed inset-0 z-[500] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-4 lg:p-10 animate-reveal overflow-hidden">
            <div className="w-full max-w-7xl h-full max-h-[900px] bg-white rounded-[64px] shadow-[0_60px_150px_rgba(0,0,0,0.5)] flex flex-col lg:flex-row overflow-hidden border border-white/20 relative">

                {/* BOTÃO FECHAR */}
                <button
                    onClick={() => { window.speechSynthesis.cancel(); onBack(); }}
                    className="absolute top-8 right-8 z-[600] w-14 h-14 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-2xl active:scale-90"
                >
                    <X size={32} />
                </button>

                {/* AREA DO VIDEO */}
                <div className="flex-1 bg-slate-100 relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent z-20 pointer-events-none" />

                    {scenes[currentScene].render()}

                    {/* TOAST DE AÇÃO */}
                    <div className="absolute bottom-12 left-12 z-30 flex items-center gap-8 bg-white/95 backdrop-blur-3xl border border-white p-8 rounded-[40px] shadow-3xl animate-slide-up">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 relative">
                            <Activity size={32} className="animate-pulse" />
                            {isSpeaking && <Volume2 size={16} className="absolute -top-2 -right-2 text-blue-400 animate-ping" />}
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-1">Módulo Operacional {currentScene + 1} de {scenes.length}</p>
                            <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{scenes[currentScene].action}</p>
                        </div>
                    </div>

                    {/* BARRA DE PROGRESSO */}
                    <div className="absolute bottom-0 left-0 right-0 h-2.5 bg-slate-200/50 z-40">
                        <div
                            className="h-full bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,1)] transition-all duration-100 ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* ÁREA DE CONTROLES E TEXTO */}
                <div className="w-full lg:w-[480px] bg-white border-l border-slate-100 flex flex-col p-14 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-4 mb-14">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl"><ShieldCheck size={28} /></div>
                        <div>
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] leading-none">Thiago 704 Select</span>
                            <p className="text-xs font-black text-blue-600 uppercase">PROFESSOR DIGITAL v7.0</p>
                        </div>
                    </div>

                    <div className="mb-12">
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="w-full h-24 bg-slate-900 rounded-[32px] flex items-center justify-center gap-6 text-white font-black text-lg uppercase tracking-widest hover:bg-blue-600 transition-all shadow-3xl shadow-slate-900/20 active:scale-95"
                        >
                            {isPlaying ? <><Pause size={32} /> PAUSAR AULA</> : <><Play size={32} fill="white" /> INICIAR PANORAMA</>}
                        </button>
                    </div>

                    <div className="space-y-10 animate-reveal">
                        <h2 className="text-6xl font-black text-slate-900 uppercase leading-none tracking-tighter italic">
                            {scenes[currentScene].title}
                        </h2>
                        <div className="p-8 bg-slate-50 rounded-[40px] border border-slate-100 relative">
                            <p className="text-2xl text-slate-600 font-medium leading-relaxed italic">
                                "{scenes[currentScene].sub}"
                            </p>
                            <div className={`absolute top-4 right-4 ${isSpeaking ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                                <div className="flex gap-0.5 items-end h-6">
                                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-1 bg-blue-600 rounded-full animate-[pulse_1s_infinite]" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s` }} />)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 space-y-3">
                        <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4 text-center">Roteiro de Treinamento:</p>
                        <div className="grid grid-cols-1 gap-2">
                            {scenes.map((s, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => { setCurrentScene(idx); setProgress(0); setIsPlaying(true); }}
                                    className={`w-full p-5 rounded-3xl flex items-center justify-between transition-all group ${idx === currentScene ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/30' : 'bg-transparent text-slate-400 hover:bg-slate-50 border border-transparent hover:border-slate-100'}`}
                                >
                                    <span className={`text-[11px] font-black uppercase tracking-tight ${idx === currentScene ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`}>{idx + 1}. {s.title.split('. ')[1]}</span>
                                    {idx === currentScene ? <Activity size={16} className="animate-pulse" /> : <ChevronRight size={16} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes reveal {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(80px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-reveal { animation: reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
                .animate-slide-up { animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 12px; }
            `}} />
        </div>
    );
};

export default VideoTutorial;
