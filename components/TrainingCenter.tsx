import React, { useState } from 'react';
import {
    Play,
    BookOpen,
    CheckCircle2,
    Smartphone,
    Bot,
    Users,
    Package,
    DollarSign,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    MessageCircle,
    Activity,
    ShieldCheck
} from 'lucide-react';

interface TrainingStep {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    tasks: string[];
    tips: string;
}

const steps: TrainingStep[] = [
    {
        title: "1. Captura (Site & Robô)",
        description: "O fluxo começa no site público, onde o robô atende o cliente 24h por dia.",
        icon: <Bot size={32} />,
        color: "bg-blue-600",
        tasks: [
            "O robô pergunta o interesse (Comprar/Vender/Suporte)",
            "Coleta Nome, WhatsApp e localização",
            "Identifica o tipo de lote e quantidade",
            "Salva tudo automaticamente na Central de Leads"
        ],
        tips: "O robô qualifica o cliente para que você não perca tempo com curiosos."
    },
    {
        title: "2. Atendimento (Equipe)",
        description: "Nadjane e Priscila gerenciam os contatos que chegam do site.",
        icon: <Users size={32} />,
        color: "bg-amber-500",
        tasks: [
            "Acessar 'Central de Leads Web'",
            "Clicar no ícone do WhatsApp para assumir o cliente",
            "O sistema marca como 'Em Atendimento' (trava para outros)",
            "Realizar a negociação e qualificar o cadastro"
        ],
        tips: "Nunca deixe um lead em Azul por mais de 15 minutos!"
    },
    {
        title: "3. Operacional (Lotes & Gado)",
        description: "Entrada do produto no frigorífico e cálculo de custos.",
        icon: <Package size={32} />,
        color: "bg-indigo-600",
        tasks: [
            "Cadastrar novo Lote em 'Lotes'",
            "Inserir peso de romaneio e gastos extras (frete, impostos)",
            "Fazer o 'Desdobro' (separar as bandas)",
            "O sistema calcula o CUSTO REAL por KG automaticamente"
        ],
        tips: "O custo real é fundamental para saber por quanto você pode vender."
    },
    {
        title: "4. Comercial (Vendas & Saída)",
        description: "Venda da carne e baixa automática do estoque.",
        icon: <Smartphone size={32} />,
        color: "bg-emerald-600",
        tasks: [
            "Ir em 'Expedição/Vendas'",
            "Selecionar as bandas/peças pesadas na balança",
            "Vincular ao cliente e registrar o peso de saída",
            "Confirmar a venda (gera baixa no estoque e lança no financeiro)"
        ],
        tips: "Se o peso de saída for muito diferente do de entrada, o sistema avisa você."
    },
    {
        title: "5. Financeiro (Caixa & Lucro)",
        description: "Onde o dinheiro é controlado e o lucro é medido.",
        icon: <DollarSign size={32} />,
        color: "bg-slate-900",
        tasks: [
            "Monitorar Contas a Receber (Vendas)",
            "Lançar Despesas (Contas a Pagar)",
            "Conferir o Fluxo de Caixa Diário",
            "Analisar o Dashboard de Lucratividade"
        ],
        tips: "Use o Relatório Diário para registrar fechamentos de turno."
    }
];

const TrainingCenter: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [currentStep, setCurrentStep] = useState(0);

    return (
        <div className="min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">
            <div className="max-w-6xl mx-auto p-6 md:p-10">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <button onClick={onBack} className="group mb-4 flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-700 transition-all">
                            <ChevronLeft size={14} /> Voltar ao Painel
                        </button>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
                            Universidade <span className="text-blue-600">FrigoGest</span>
                        </h1>
                        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mt-2">
                            Manual Completo Thiago 704 Select
                        </p>
                    </div>
                    <div className="bg-blue-600/10 border border-blue-500/20 px-6 py-4 rounded-3xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Status da Equipe</p>
                            <p className="text-lg font-bold text-slate-900">Protocolo Ativado</p>
                        </div>
                    </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="flex gap-2 mb-12">
                    {steps.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-2 flex-1 rounded-full transition-all duration-500 ${idx <= currentStep ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-slate-200'}`}
                        />
                    ))}
                </div>

                {/* CONTENT AREA */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[500px]">
                    <div className="space-y-8 animate-reveal">
                        <div className={`${steps[currentStep].color} w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-2xl transition-all duration-500`}>
                            {steps[currentStep].icon}
                        </div>
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 uppercase leading-none mb-4">
                                {steps[currentStep].title}
                            </h2>
                            <p className="text-xl text-slate-500 font-medium leading-relaxed">
                                {steps[currentStep].description}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {steps[currentStep].tasks.map((task, idx) => (
                                <div key={idx} className="flex items-start gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group hover:border-blue-200 transition-all">
                                    <div className="mt-1 text-blue-600 group-hover:scale-110 transition-transform">
                                        <CheckCircle2 size={18} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 leading-tight">{task}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative">
                        {/* ILLUSTRATION/PREVIEW CARD */}
                        <div className="bg-slate-900 rounded-[48px] p-8 aspect-square relative shadow-[0_40px_80px_rgba(0,0,0,0.15)] flex flex-col justify-center items-center text-center group overflow-hidden border border-white/5">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent opacity-50" />

                            {/* Animated Visual Effect */}
                            <div className="relative z-10 space-y-6">
                                <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mx-auto backdrop-blur-xl border border-white/20 animate-pulse-slow">
                                    {steps[currentStep].icon}
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Preview Operacional</p>
                                    <p className="text-white text-sm font-medium px-8 leading-relaxed italic opacity-80">
                                        "{steps[currentStep].tips}"
                                    </p>
                                </div>

                                <button className="mt-8 bg-white text-slate-900 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-xl">
                                    Ver no Sistema
                                </button>
                            </div>

                            {/* Decorative Grid */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                        </div>

                        {/* NAVIGATION BUTTONS */}
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                            <button
                                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                                disabled={currentStep === 0}
                                className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-xl disabled:opacity-30"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button
                                onClick={() => {
                                    if (currentStep < steps.length - 1) {
                                        setCurrentStep(prev => prev + 1);
                                    } else {
                                        onBack();
                                    }
                                }}
                                className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all group"
                            >
                                {currentStep === steps.length - 1 ? <CheckCircle2 size={24} /> : <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* FOOTER INFO */}
                <div className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-8 border-t border-slate-200">
                    <div className="flex items-center gap-4 text-slate-400">
                        <MessageCircle size={20} />
                        <p className="text-xs font-bold leading-relaxed">
                            Alguma dúvida no treinamento? <br />
                            Fale diretamente com o Thiago ou chame o suporte técnico.
                        </p>
                    </div>
                    <div className="flex justify-start md:justify-end gap-10">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-300 uppercase mb-1 leading-none">Status</p>
                            <p className="text-xs font-black text-emerald-500 uppercase">Sincronizado</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-300 uppercase mb-1 leading-none">Versão</p>
                            <p className="text-xs font-black text-slate-500 uppercase">v2.5.5-EDU</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrainingCenter;
