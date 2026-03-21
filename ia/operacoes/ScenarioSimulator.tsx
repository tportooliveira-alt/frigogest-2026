import React, { useState } from 'react';
import { ArrowLeft, Play, TrendingDown, TrendingUp, Award, Zap, AlertTriangle, CheckCircle, Brain, RefreshCw, ChevronRight } from 'lucide-react';

interface ScenarioSimulatorProps {
    onBack: () => void;
    onApplyScenario: (data: any) => void;
}

type ScenarioPhase = 'auge' | 'crise' | 'recuperacao';

const SCENARIOS = {
    auge: {
        label: '🏆 Empresa no Auge',
        subtitle: 'A melhor distribuidora do Brasil',
        color: 'from-emerald-600 to-green-500',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        bgColor: 'bg-emerald-500/10',
        icon: Award,
        description: 'Empresa no pico: 120 clientes ativos, estoque completo, caixa positivo R$45k, todos os lotes rentáveis. Os agentes de IA vão confirmar tudo verde.',
        kpis: [
            { label: 'Clientes Ativos', value: '120', trend: '+18% mês' },
            { label: 'Receita Mensal', value: 'R$ 187k', trend: '+22% vs anterior' },
            { label: 'Margem Bruta', value: '24,3%', trend: '✅ Acima da meta' },
            { label: 'Caixa Atual', value: 'R$ 45.200', trend: 'Saudável' },
        ],
        alerts: ['✅ Estoque: 8 lotes disponíveis, giro rápido', '✅ Clientes: Nenhum inadimplente', '✅ Fornecedores: 3 parceiros VIP ativos', '✅ Fluxo de Caixa: Projeção positiva 90 dias'],
    },
    crise: {
        label: '🔴 Simulação de Crise',
        subtitle: 'Empresa em dificuldades — missão: segurar as pontas',
        color: 'from-rose-700 to-red-600',
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/30',
        bgColor: 'bg-rose-500/10',
        icon: TrendingDown,
        description: 'Cenário de quebra: 3 clientes grandes sumiram, estoque parado, caixa negativo, fornecedor principal cancelou parceria. Os agentes precisam apresentar plano de sobrevivência.',
        kpis: [
            { label: 'Clientes Ativos', value: '31', trend: '-74% vs mês anterior ⚠️' },
            { label: 'Receita Mensal', value: 'R$ 23k', trend: '-88% ⚠️ CRITICO' },
            { label: 'Margem Bruta', value: '-4,1%', trend: '🔴 PREJUÍZO' },
            { label: 'Caixa Atual', value: '-R$ 8.700', trend: '🔴 NEGATIVO' },
        ],
        alerts: ['🔴 Estoque: 2 lotes vencendo em 3 dias — LIQUIDAÇÃO URGENTE', '🔴 5 clientes com R$ 34k em aberto há 60+ dias', '🔴 Fornecedor principal: preço +40% ou cancelamento', '🔴 Fluxo: deficit projetado em 15 dias'],
    },
    recuperacao: {
        label: '📈 Plano de Recuperação IA',
        subtitle: 'Os agentes entram em ação — resultados em 30 dias',
        color: 'from-blue-600 to-indigo-500',
        textColor: 'text-blue-400',
        borderColor: 'border-blue-500/30',
        bgColor: 'bg-blue-500/10',
        icon: TrendingUp,
        description: 'Após 30 dias com os agentes de IA coordenando: Dona Clara reestruturou o financeiro, Roberto fechou novo fornecedor, Isabela reativou 18 clientes via WhatsApp. Resultados reais.',
        kpis: [
            { label: 'Clientes Recuperados', value: '18', trend: '+58% vs crise' },
            { label: 'Receita Mês 1', value: 'R$ 67k', trend: '+191% vs crise' },
            { label: 'Margem Bruta', value: '11,2%', trend: '↗️ Voltando ao positivo' },
            { label: 'Caixa Atual', value: 'R$ 3.400', trend: '↗️ Saiu do negativo' },
        ],
        alerts: ['✅ 18 clientes reativados via script WhatsApp da Isabela', '✅ R$ 21k de inadimplência cobrada pelo Seu Luíz', '✅ Novo fornecedor: -12% vs anterior (negociação Roberto)', '✅ Estoque liquidado: economia de R$ 9k em perda'],
    }
};

const AI_INSIGHTS: Record<ScenarioPhase, { agent: string; icon: string; message: string }[]> = {
    auge: [
        { agent: 'Dona Clara', icon: '🧠', message: 'EBITDA projetado: R$42k/mês. Recomendo reinvestir 30% em estoque de cortes nobres (picanha, ancho) para temporada de churrasco. ROI estimado: 340% em 60 dias.' },
        { agent: 'Isabela (Marketing)', icon: '📣', message: 'Momento ideal para campanha de expansão B2B. 23 restaurantes identificados na região ainda não são clientes. Meta: +8 contratos em 30 dias.' },
        { agent: 'Roberto (Compras)', icon: '🤝', message: 'Fornecedor Fazenda Boa Vista ofereceu desconto de 8% para contrato trimestral. Recomendo aceitar — economia projetada de R$ 12.400.' },
    ],
    crise: [
        { agent: 'Dona Clara', icon: '🧠', message: '🚨 ALERTA MÁXIMO: Caixa negativo em 15 dias. Prioridade 1: cobrar os R$34k em aberto. Prioridade 2: liquidar estoque parado. Prioridade 3: renegociar prazo com fornecedores.' },
        { agent: 'Seu Luíz (Cobrança)', icon: '💰', message: 'Identifiquei 5 devedores. Script de cobrança preparado para WhatsApp. Potencial de recuperação: R$28k em 15 dias com abordagem Loss Aversion (\"Proteja seu crédito\").' },
        { agent: 'Isabela (Marketing)', icon: '📣', message: 'Campanha de reativação pronta: 89 clientes inativos identificados. Script: oferta de primeira compra com 5% de desconto + entrega grátis. Custo: R$0 (apenas WhatsApp).' },
    ],
    recuperacao: [
        { agent: 'Dona Clara', icon: '🧠', message: 'Empresa estabilizada. Fluxo de caixa positivo por 3 semanas consecutivas. Próximo marco: margem 15% em 60 dias. Plano de expansão pode ser retomado com orçamento controlado.' },
        { agent: 'Seu Antônio (Produção)', icon: '🏭', message: 'Rendimento médio dos últimos 3 lotes: 67,4% (acima da média do setor de 64%). Novo protocolo de controle de quebra economizou R$3.200 no período.' },
        { agent: 'Isabela (Marketing)', icon: '📣', message: 'Taxa de reativação de clientes: 32% (benchmark setor: 18%). Scripts de WhatsApp com maior conversão: \"Volta\" + oferta imediata. Próximo: atacar 71 clientes ainda inativos.' },
    ]
};

const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({ onBack, onApplyScenario }) => {
    const [activePhase, setActivePhase] = useState<ScenarioPhase>('auge');
    const [isApplying, setIsApplying] = useState(false);
    const [applied, setApplied] = useState<ScenarioPhase | null>(null);

    const scenario = SCENARIOS[activePhase];
    const Icon = scenario.icon;
    const insights = AI_INSIGHTS[activePhase];

    const handleApply = async () => {
        setIsApplying(true);
        await new Promise(r => setTimeout(r, 1500));

        // Gera dados de simulação baseados no cenário
        const now = new Date();
        const simData = generateScenarioData(activePhase, now);
        onApplyScenario(simData);

        setApplied(activePhase);
        setIsApplying(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 font-sans">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold mb-4">
                            <ArrowLeft size={16} /> Voltar
                        </button>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
                            🎬 Modo <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Simulação IA</span>
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Simule cenários reais e veja os agentes de IA em ação</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-2xl">
                        <Brain size={16} className="text-purple-400" />
                        <span className="text-purple-300 text-xs font-black uppercase tracking-widest">16 Agentes Ativos</span>
                    </div>
                </div>

                {/* Phase Selector */}
                <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
                    {(Object.keys(SCENARIOS) as ScenarioPhase[]).map((phase, i) => {
                        const s = SCENARIOS[phase];
                        const PhaseIcon = s.icon;
                        const isActive = activePhase === phase;
                        return (
                            <button
                                key={phase}
                                onClick={() => setActivePhase(phase)}
                                className={`flex-shrink-0 flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all border ${isActive
                                    ? `bg-gradient-to-r ${s.color} text-white border-transparent shadow-xl`
                                    : `bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white`
                                    }`}
                            >
                                <PhaseIcon size={18} />
                                <span className="hidden sm:block">{s.label}</span>
                                <span className="sm:hidden">{i === 0 ? 'Auge' : i === 1 ? 'Crise' : 'Recuperação'}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: KPIs */}
                    <div className="space-y-4">
                        <div className={`bg-gradient-to-br ${scenario.color} rounded-3xl p-6 shadow-2xl`}>
                            <Icon size={32} className="text-white mb-3" />
                            <h2 className="text-xl font-black text-white">{scenario.label}</h2>
                            <p className="text-white/70 text-xs mt-1">{scenario.subtitle}</p>
                        </div>

                        <div className={`${scenario.bgColor} border ${scenario.borderColor} rounded-3xl p-5`}>
                            <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-4">KPIs do Cenário</p>
                            <div className="space-y-3">
                                {scenario.kpis.map((kpi, i) => (
                                    <div key={i} className="flex justify-between items-start">
                                        <div>
                                            <p className="text-white/60 text-xs">{kpi.label}</p>
                                            <p className="text-white font-black text-lg leading-none">{kpi.value}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${scenario.textColor} ${scenario.bgColor} border ${scenario.borderColor}`}>
                                            {kpi.trend}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Apply Button */}
                        <button
                            onClick={handleApply}
                            disabled={isApplying}
                            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all bg-gradient-to-r ${scenario.color} text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60`}
                        >
                            {isApplying ? (
                                <><RefreshCw size={18} className="animate-spin" /> Aplicando Cenário...</>
                            ) : applied === activePhase ? (
                                <><CheckCircle size={18} /> Cenário Aplicado!</>
                            ) : (
                                <><Play size={18} /> Aplicar Este Cenário</>
                            )}
                        </button>
                        {applied === activePhase && (
                            <p className="text-center text-xs text-slate-400 font-bold">
                                ✅ Dados carregados! Vá para Central IA para ver os agentes analisando.
                            </p>
                        )}
                    </div>

                    {/* Center + Right: Alerts + AI Insights */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Alertas */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle size={16} className={scenario.textColor} />
                                <p className="text-white font-black text-xs uppercase tracking-widest">Alertas Detectados pelos Agentes</p>
                            </div>
                            <div className="space-y-2">
                                {scenario.alerts.map((alert, i) => (
                                    <div key={i} className={`px-4 py-3 rounded-xl text-sm font-bold text-white/80 ${scenario.bgColor} border ${scenario.borderColor}`}>
                                        {alert}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* AI Agent Insights */}
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Brain size={16} className="text-purple-400" />
                                <p className="text-white font-black text-xs uppercase tracking-widest">O que os Agentes Recomendam</p>
                            </div>
                            <div className="space-y-3">
                                {insights.map((insight, i) => (
                                    <div key={i} className="bg-black/20 border border-white/5 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xl">{insight.icon}</span>
                                            <span className="text-white font-black text-sm">{insight.agent}</span>
                                            <ChevronRight size={12} className="text-white/30" />
                                            <span className="text-white/40 text-[10px] uppercase tracking-widest">Análise</span>
                                        </div>
                                        <p className="text-white/70 text-sm leading-relaxed">{insight.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Journey Guide */}
                        <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 rounded-3xl p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap size={16} className="text-yellow-400" />
                                <p className="text-white font-black text-xs uppercase tracking-widest">Como usar o Modo Simulação</p>
                            </div>
                            <div className="space-y-2 text-xs text-white/60 font-medium">
                                <p>1️⃣ Clique em <strong className="text-white">🏆 Empresa no Auge</strong> → Aplique → Abra Central IA para ver tudo verde</p>
                                <p>2️⃣ Volte aqui, selecione <strong className="text-white">🔴 Crise</strong> → Aplique → Veja os alertas críticos dos agentes</p>
                                <p>3️⃣ Selecione <strong className="text-white">📈 Recuperação</strong> → Aplique → Veja o progresso após 30 dias com IA</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Gera dados sintéticos baseados no cenário escolhido
function generateScenarioData(phase: ScenarioPhase, now: Date): any {
    const day = (d: number) => {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - d);
        return dt.toISOString().split('T')[0];
    };

    const clients = [
        { id_ferro: 'CLI-001', nome_social: 'Açougue Central', whatsapp: '5511999990001', limite_credito: 15000 },
        { id_ferro: 'CLI-002', nome_social: 'Supermercado Boa Compra', whatsapp: '5511999990002', limite_credito: 25000 },
        { id_ferro: 'CLI-003', nome_social: 'Restaurante Sabor Brasil', whatsapp: '5511999990003', limite_credito: 8000 },
        { id_ferro: 'CLI-004', nome_social: 'Churrascaria do Roberto', whatsapp: '5511999990004', limite_credito: 20000 },
        { id_ferro: 'CLI-005', nome_social: 'Mercado São João', whatsapp: '5511999990005', limite_credito: 12000 },
    ];

    if (phase === 'auge') {
        return {
            clients,
            sales: [
                { id_venda: 'S001', id_cliente: 'CLI-001', nome_cliente: 'Açougue Central', id_completo: 'LOT-A01-PCH', peso_real_saida: 48, preco_venda_kg: 68, data_venda: day(2), status_pagamento: 'PAGO', valor_total: 3264, forma_pagamento: 'VISTA' },
                { id_venda: 'S002', id_cliente: 'CLI-002', nome_cliente: 'Supermercado Boa Compra', id_completo: 'LOT-A01-ALC', peso_real_saida: 120, preco_venda_kg: 42, data_venda: day(1), status_pagamento: 'PAGO', valor_total: 5040, forma_pagamento: 'PRAZO' },
                { id_venda: 'S003', id_cliente: 'CLI-004', nome_cliente: 'Churrascaria do Roberto', id_completo: 'LOT-A02-PCH', peso_real_saida: 85, preco_venda_kg: 72, data_venda: day(0), status_pagamento: 'PAGO', valor_total: 6120, forma_pagamento: 'VISTA' },
                { id_venda: 'S004', id_cliente: 'CLI-003', nome_cliente: 'Restaurante Sabor Brasil', id_completo: 'LOT-A01-CTL', peso_real_saida: 60, preco_venda_kg: 28, data_venda: day(5), status_pagamento: 'PAGO', valor_total: 1680, forma_pagamento: 'VISTA' },
                { id_venda: 'S005', id_cliente: 'CLI-005', nome_cliente: 'Mercado São João', id_completo: 'LOT-A02-ALC', peso_real_saida: 90, preco_venda_kg: 38, data_venda: day(3), status_pagamento: 'PAGO', valor_total: 3420, forma_pagamento: 'PRAZO' },
            ],
            transactions: [
                { id: 'T001', data: day(5), descricao: 'Compra Lote A01 — 4 bois — Fazenda Boa Vista', tipo: 'SAIDA', categoria: 'COMPRA_GADO', valor: 28000, metodo_pagamento: 'PIX' },
                { id: 'T002', data: day(2), descricao: 'Recebimento vendas semana', tipo: 'ENTRADA', categoria: 'VENDA', valor: 15000, metodo_pagamento: 'PIX' },
            ],
        };
    }

    if (phase === 'crise') {
        return {
            clients,
            sales: [
                { id_venda: 'S010', id_cliente: 'CLI-001', nome_cliente: 'Açougue Central', id_completo: 'LOT-C01-ALC', peso_real_saida: 30, preco_venda_kg: 35, data_venda: day(45), status_pagamento: 'PENDENTE', valor_total: 1050, forma_pagamento: 'PRAZO' },
                { id_venda: 'S011', id_cliente: 'CLI-003', nome_cliente: 'Restaurante Sabor Brasil', id_completo: 'LOT-C01-CTL', peso_real_saida: 20, preco_venda_kg: 26, data_venda: day(62), status_pagamento: 'PENDENTE', valor_total: 520, forma_pagamento: 'PRAZO' },
            ],
            transactions: [
                { id: 'T010', data: day(15), descricao: 'Pagamento Lote C01 — Fazenda Esperança', tipo: 'SAIDA', categoria: 'COMPRA_GADO', valor: 18000, metodo_pagamento: 'PIX' },
                { id: 'T011', data: day(10), descricao: 'Conta de energia + frete', tipo: 'SAIDA', categoria: 'OPERACIONAL', valor: 3200, metodo_pagamento: 'DEBITO' },
                { id: 'T012', data: day(5), descricao: 'Recebimento parcial', tipo: 'ENTRADA', categoria: 'VENDA', valor: 2100, metodo_pagamento: 'PIX' },
            ],
        };
    }

    // recuperacao
    return {
        clients,
        sales: [
            { id_venda: 'S020', id_cliente: 'CLI-001', nome_cliente: 'Açougue Central', id_completo: 'LOT-R01-PCH', peso_real_saida: 55, preco_venda_kg: 65, data_venda: day(15), status_pagamento: 'PAGO', valor_total: 3575, forma_pagamento: 'VISTA' },
            { id_venda: 'S021', id_cliente: 'CLI-002', nome_cliente: 'Supermercado Boa Compra', id_completo: 'LOT-R01-ALC', peso_real_saida: 80, preco_venda_kg: 40, data_venda: day(10), status_pagamento: 'PAGO', valor_total: 3200, forma_pagamento: 'PRAZO' },
            { id_venda: 'S022', id_cliente: 'CLI-004', nome_cliente: 'Churrascaria do Roberto', id_completo: 'LOT-R01-PCH', peso_real_saida: 70, preco_venda_kg: 68, data_venda: day(5), status_pagamento: 'PAGO', valor_total: 4760, forma_pagamento: 'VISTA' },
            { id_venda: 'S023', id_cliente: 'CLI-005', nome_cliente: 'Mercado São João', id_completo: 'LOT-R02-CTL', peso_real_saida: 100, preco_venda_kg: 27, data_venda: day(2), status_pagamento: 'PAGO', valor_total: 2700, forma_pagamento: 'PRAZO' },
            { id_venda: 'S024', id_cliente: 'CLI-003', nome_cliente: 'Restaurante Sabor Brasil', id_completo: 'LOT-R02-ALC', peso_real_saida: 45, preco_venda_kg: 39, data_venda: day(0), status_pagamento: 'PAGO', valor_total: 1755, forma_pagamento: 'VISTA' },
        ],
        transactions: [
            { id: 'T020', data: day(20), descricao: 'Recuperação inadimplência — Seu Luíz (IA)', tipo: 'ENTRADA', categoria: 'COBRANCA', valor: 21000, metodo_pagamento: 'PIX' },
            { id: 'T021', data: day(15), descricao: 'Compra Lote R01 — Fazenda Nova Via (-12%)', tipo: 'SAIDA', categoria: 'COMPRA_GADO', valor: 22400, metodo_pagamento: 'PIX' },
            { id: 'T022', data: day(5), descricao: 'Recebimento vendas recuperadas', tipo: 'ENTRADA', categoria: 'VENDA', valor: 15990, metodo_pagamento: 'PIX' },
        ],
    };
}

export default ScenarioSimulator;
