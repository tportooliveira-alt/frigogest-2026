import React, { useState, useMemo, useRef } from 'react';
import {
    ArrowLeft, Brain, Shield, TrendingUp, BarChart3,
    Bell, CheckCircle, AlertTriangle, XCircle, Eye,
    ChevronRight, Activity, Zap, Settings,
    Clock, Package, Users, DollarSign, Truck,
    Calendar, MessageCircle, ShieldCheck, Beef, Bot,
    Loader2, Send, Sparkles
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import {
    AgentType, AgentConfig, AgentAlert, AlertSeverity,
    Batch, StockItem, Sale, Client, Transaction, Supplier, Payable, ScheduledOrder
} from '../types';

interface AIAgentsProps {
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

// ═══ DEFAULT AGENT CONFIGURATIONS ═══
const DEFAULT_AGENTS: AgentConfig[] = [
    {
        id: 'ADMINISTRATIVO',
        name: 'Administradora',
        description: 'Cérebro Central — entende TUDO do sistema. Lotes, estoque, clientes, vendas, pedidos, fornecedores, financeiro, cadeia do abate, robô de vendas e auditoria.',
        icon: '🧠',
        color: 'blue',
        enabled: true,
        systemPrompt: 'Agente Administrativo do FrigoGest — cérebro central com 68 regras em 10 módulos.',
        modules: ['LOTES', 'ESTOQUE', 'CLIENTES', 'VENDAS', 'PEDIDOS', 'FORNECEDORES', 'FINANCEIRO', 'CADEIA_ABATE', 'ROBO_VENDAS', 'AUDITORIA'],
        triggerCount: 19,
    },
    {
        id: 'PRODUCAO',
        name: 'Produção & Rendimento',
        description: 'Especialista em rendimento de carcaça, raças, quebra de resfriamento e análise de fornecedores com scorecard.',
        icon: '🥩',
        color: 'emerald',
        enabled: true,
        systemPrompt: 'Agente de Produção — rendimento, raças, quebra de resfriamento, scorecard de fornecedores.',
        modules: ['LOTES', 'ESTOQUE', 'FORNECEDORES'],
        triggerCount: 6,
    },
    {
        id: 'COMERCIAL',
        name: 'Comercial & Vendas',
        description: 'Focado em maximizar receita, proteger margem, controlar crédito de clientes e ranking de melhores compradores.',
        icon: '💰',
        color: 'amber',
        enabled: true,
        systemPrompt: 'Agente Comercial — margem, crédito, preço sugerido, ranking de clientes.',
        modules: ['VENDAS', 'CLIENTES'],
        triggerCount: 4,
    },
    {
        id: 'AUDITOR',
        name: 'Auditor Financeiro',
        description: 'Garante que cada centavo esteja rastreado. Detecta furos no caixa, estornos incompletos e transações órfãs.',
        icon: '🔍',
        color: 'rose',
        enabled: true,
        systemPrompt: 'Auditor Financeiro — regra de ouro: cada venda paga deve ter Transaction ENTRADA.',
        modules: ['FINANCEIRO', 'VENDAS', 'LOTES'],
        triggerCount: 5,
    },
];

const AIAgents: React.FC<AIAgentsProps> = ({
    onBack, batches, stock, sales, clients, transactions, suppliers, payables, scheduledOrders
}) => {
    const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'config'>('overview');
    const [agents] = useState<AgentConfig[]>(DEFAULT_AGENTS);
    const [auditResponse, setAuditResponse] = useState<string | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState<string | null>(null);
    const auditResultRef = useRef<HTMLDivElement>(null);

    // ═══ LIVE AUDIT: Generate real alerts from actual data ═══
    const liveAlerts = useMemo<AgentAlert[]>(() => {
        const alerts: AgentAlert[] = [];
        const now = new Date();

        // ── ADMINISTRATIVO: Lotes abertos sem peças > 7 dias ──
        batches.filter(b => b.status === 'ABERTO').forEach(b => {
            const daysSince = Math.floor((now.getTime() - new Date(b.data_recebimento).getTime()) / 86400000);
            const hasStock = stock.some(s => s.id_lote === b.id_lote);
            if (daysSince > 7 && !hasStock) {
                alerts.push({
                    id: `ADM-LOTE-${b.id_lote}`, agent: 'ADMINISTRATIVO', severity: 'ALERTA',
                    module: 'LOTES', title: `Lote ${b.id_lote} sem peças`,
                    message: `Lote aberto há ${daysSince} dias sem peças registradas no estoque. Verificar desossa.`,
                    timestamp: now.toISOString(), status: 'NOVO'
                });
            }
        });

        // ── ADMINISTRATIVO: Clientes inativos (60+ dias sem compra) ──
        clients.forEach(c => {
            const lastSale = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO')
                .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
            if (lastSale) {
                const daysSince = Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / 86400000);
                if (daysSince > 60) {
                    alerts.push({
                        id: `ADM-CLI-${c.id_ferro}`, agent: 'ADMINISTRATIVO', severity: 'INFO',
                        module: 'CLIENTES', title: `Cliente ${c.nome_social} inativo`,
                        message: `Sem compras há ${daysSince} dias. Considere reativar contato.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
        });

        // ── ADMINISTRATIVO: Pedidos para amanhã sem confirmar ──
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        scheduledOrders.filter(o => o.data_entrega === tomorrowStr && o.status === 'ABERTO').forEach(o => {
            alerts.push({
                id: `ADM-PED-${o.id}`, agent: 'ADMINISTRATIVO', severity: 'CRITICO',
                module: 'PEDIDOS', title: `Pedido amanhã sem confirmar!`,
                message: `Pedido de ${o.nome_cliente} para ${tomorrowStr} ainda está ABERTO. Confirmar urgente!`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        });

        // ── ADMINISTRATIVO: Fornecedores sem dados bancários ──
        suppliers.forEach(s => {
            if (!s.dados_bancarios) {
                alerts.push({
                    id: `ADM-FORN-${s.id}`, agent: 'ADMINISTRATIVO', severity: 'ALERTA',
                    module: 'FORNECEDORES', title: `${s.nome_fantasia} sem PIX/Banco`,
                    message: `Fornecedor sem dados bancários cadastrados. Pode atrasar pagamentos.`,
                    timestamp: now.toISOString(), status: 'NOVO'
                });
            }
        });

        // ── ADMINISTRATIVO: Estoque parado > 30 dias ──
        stock.filter(s => s.status === 'DISPONIVEL').forEach(s => {
            const daysSince = Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000);
            if (daysSince > 30) {
                alerts.push({
                    id: `ADM-STK-${s.id_completo}`, agent: 'ADMINISTRATIVO', severity: 'ALERTA',
                    module: 'ESTOQUE', title: `Peça ${s.id_completo} parada`,
                    message: `No frio há ${daysSince} dias. Risco de perda de qualidade. Peso: ${s.peso_entrada}kg.`,
                    timestamp: now.toISOString(), status: 'NOVO'
                });
            }
        });

        // ── COMERCIAL: Vendas vencidas (pendentes há 7+ dias) ──
        sales.filter(s => s.status_pagamento === 'PENDENTE' && s.prazo_dias > 0).forEach(s => {
            const venc = new Date(s.data_vencimento);
            const diasAtraso = Math.floor((now.getTime() - venc.getTime()) / 86400000);
            if (diasAtraso > 7) {
                const total = s.peso_real_saida * s.preco_venda_kg;
                alerts.push({
                    id: `COM-VNC-${s.id_venda}`, agent: 'COMERCIAL', severity: 'CRITICO',
                    module: 'VENDAS', title: `Cobrança: ${s.nome_cliente || s.id_cliente}`,
                    message: `Venda ${s.id_venda} vencida há ${diasAtraso} dias. Valor: R$${total.toFixed(2)}`,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { valor: total, dias_atraso: diasAtraso }
                });
            }
        });

        // ── COMERCIAL: Cliente acima do limite de crédito ──
        clients.forEach(c => {
            if (c.limite_credito > 0) {
                const pendente = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento === 'PENDENTE')
                    .reduce((sum, s) => sum + (s.peso_real_saida * s.preco_venda_kg), 0);
                if (pendente > c.limite_credito) {
                    alerts.push({
                        id: `COM-CRED-${c.id_ferro}`, agent: 'COMERCIAL', severity: 'BLOQUEIO',
                        module: 'CLIENTES', title: `${c.nome_social} — crédito excedido`,
                        message: `Saldo devedor R$${pendente.toFixed(2)} excede limite R$${c.limite_credito.toFixed(2)}. Vendas a prazo BLOQUEADAS.`,
                        timestamp: now.toISOString(), status: 'NOVO',
                        data: { devendo: pendente, limite: c.limite_credito }
                    });
                }
            }
        });

        // ── AUDITOR: Vendas PAGAS sem Transaction ENTRADA ──
        sales.filter(s => s.status_pagamento === 'PAGO').forEach(s => {
            const hasTransaction = transactions.some(t =>
                t.referencia_id === s.id_venda && t.tipo === 'ENTRADA' && t.categoria !== 'ESTORNO'
            );
            if (!hasTransaction) {
                const valor = s.peso_real_saida * s.preco_venda_kg;
                alerts.push({
                    id: `AUD-FURO-${s.id_venda}`, agent: 'AUDITOR', severity: 'CRITICO',
                    module: 'FINANCEIRO', title: `FURO: Venda ${s.id_venda}`,
                    message: `Venda PAGA sem Transaction ENTRADA no caixa! Valor: R$${valor.toFixed(2)}. Pagamento não registrado.`,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { valor }
                });
            }
        });

        // ── AUDITOR: Lotes sem saída financeira ──
        batches.filter(b => b.status !== 'ESTORNADO').forEach(b => {
            const hasPayable = payables.some(p => p.id_lote === b.id_lote);
            const hasTransaction = transactions.some(t =>
                t.referencia_id === b.id_lote && t.tipo === 'SAIDA' && t.categoria === 'COMPRA_GADO'
            );
            if (!hasPayable && !hasTransaction) {
                alerts.push({
                    id: `AUD-LOTE-${b.id_lote}`, agent: 'AUDITOR', severity: 'CRITICO',
                    module: 'FINANCEIRO', title: `Lote ${b.id_lote} sem saída`,
                    message: `Lote comprado sem Transaction SAIDA nem Payable vinculado. Valor: R$${b.valor_compra_total.toFixed(2)}`,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { valor: b.valor_compra_total }
                });
            }
        });

        // ── AUDITOR: Payables vencidos ──
        payables.filter(p => p.status === 'PENDENTE' || p.status === 'PARCIAL').forEach(p => {
            const venc = new Date(p.data_vencimento);
            const diasAtraso = Math.floor((now.getTime() - venc.getTime()) / 86400000);
            if (diasAtraso > 0) {
                alerts.push({
                    id: `AUD-PAY-${p.id}`, agent: 'AUDITOR', severity: 'ALERTA',
                    module: 'FINANCEIRO', title: `Dívida vencida: ${p.descricao}`,
                    message: `Payable vencido há ${diasAtraso} dias. Valor: R$${p.valor.toFixed(2)}. Fornecedor: ${p.fornecedor_id || 'N/A'}`,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { valor: p.valor, dias_atraso: diasAtraso }
                });
            }
        });

        // ── PRODUÇÃO: Rendimento baixo por lote ──
        batches.filter(b => b.status === 'FECHADO').forEach(b => {
            const lotePecas = stock.filter(s => s.id_lote === b.id_lote);
            if (lotePecas.length > 0 && b.peso_total_romaneio > 0) {
                const pesoTotal = lotePecas.reduce((sum, s) => sum + s.peso_entrada, 0);
                const rendimento = (pesoTotal / b.peso_total_romaneio) * 100;
                if (rendimento < 48) {
                    alerts.push({
                        id: `PROD-REND-${b.id_lote}`, agent: 'PRODUCAO', severity: 'CRITICO',
                        module: 'LOTES', title: `Rendimento baixo: ${b.id_lote}`,
                        message: `Rendimento ${rendimento.toFixed(1)}% (abaixo de 48%). Fornecedor: ${b.fornecedor}. Investigar quebra excessiva.`,
                        timestamp: now.toISOString(), status: 'NOVO',
                        data: { rendimento, fornecedor: b.fornecedor }
                    });
                }
            }
        });

        return alerts.sort((a, b) => {
            const severityOrder: Record<AlertSeverity, number> = { BLOQUEIO: 0, CRITICO: 1, ALERTA: 2, INFO: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }, [batches, stock, sales, clients, transactions, suppliers, payables, scheduledOrders]);

    // ═══ STATS PER AGENT ═══
    const agentStats = useMemo(() => {
        const stats: Record<AgentType, { total: number; criticos: number; bloqueios: number }> = {
            ADMINISTRATIVO: { total: 0, criticos: 0, bloqueios: 0 },
            PRODUCAO: { total: 0, criticos: 0, bloqueios: 0 },
            COMERCIAL: { total: 0, criticos: 0, bloqueios: 0 },
            AUDITOR: { total: 0, criticos: 0, bloqueios: 0 },
        };
        liveAlerts.forEach(a => {
            stats[a.agent].total++;
            if (a.severity === 'CRITICO') stats[a.agent].criticos++;
            if (a.severity === 'BLOQUEIO') stats[a.agent].bloqueios++;
        });
        return stats;
    }, [liveAlerts]);

    // ═══ FINANCIAL SUMMARY FOR KPIs ═══
    const financialKPIs = useMemo(() => {
        const validTx = transactions.filter(t => t.categoria !== 'ESTORNO');
        const entradas = validTx.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
        const saidas = validTx.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
        const saldo = entradas - saidas;
        const estoqueValor = stock.filter(s => s.status === 'DISPONIVEL').reduce((s, item) => {
            const batch = batches.find(b => b.id_lote === item.id_lote);
            return s + (item.peso_entrada * (batch?.custo_real_kg || 0));
        }, 0);
        const vendasPendentes = sales.filter(s => s.status_pagamento === 'PENDENTE')
            .reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
        return { entradas, saidas, saldo, estoqueValor, vendasPendentes };
    }, [transactions, stock, batches, sales]);

    const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', glow: 'shadow-blue-200/50' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', glow: 'shadow-emerald-200/50' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', glow: 'shadow-amber-200/50' },
        rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', glow: 'shadow-rose-200/50' },
    };

    const severityConfig: Record<AlertSeverity, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
        INFO: { icon: <Eye size={14} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
        ALERTA: { icon: <AlertTriangle size={14} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        CRITICO: { icon: <XCircle size={14} />, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
        BLOQUEIO: { icon: <Shield size={14} />, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    };

    const selectedAgentData = selectedAgent ? agents.find(a => a.id === selectedAgent) : null;
    const filteredAlerts = selectedAgent
        ? liveAlerts.filter(a => a.agent === selectedAgent)
        : liveAlerts;

    // ═══ GEMINI AUDITOR — LIVE ANALYSIS ═══
    const runGeminiAudit = async () => {
        setAuditLoading(true);
        setAuditError(null);
        setAuditResponse(null);
        try {
            const apiKey = (import.meta as any).env.VITE_AI_API_KEY;
            if (!apiKey) throw new Error('API Key não configurada. Defina VITE_AI_API_KEY no .env');
            const ai = new GoogleGenAI({ apiKey });

            // Build financial snapshot
            const validTx = transactions.filter(t => t.categoria !== 'ESTORNO');
            const totalEntradas = validTx.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
            const totalSaidas = validTx.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
            const vendasPagas = sales.filter(s => s.status_pagamento === 'PAGO');
            const vendasPendentes = sales.filter(s => s.status_pagamento === 'PENDENTE');
            const vendasEstornadas = sales.filter(s => s.status_pagamento === 'ESTORNADO');
            const payablesPendentes = payables.filter(p => p.status === 'PENDENTE' || p.status === 'PARCIAL');
            const payablesVencidos = payablesPendentes.filter(p => new Date(p.data_vencimento) < new Date());
            const estoqueDisp = stock.filter(s => s.status === 'DISPONIVEL');

            const snapshot = `
## SNAPSHOT FINANCEIRO — FRIGOGEST
Data: ${new Date().toLocaleDateString('pt-BR')}

### CAIXA
- Entradas totais: R$ ${totalEntradas.toFixed(2)}
- Saídas totais: R$ ${totalSaidas.toFixed(2)}
- Saldo: R$ ${(totalEntradas - totalSaidas).toFixed(2)}
- Total transações: ${transactions.length}

### VENDAS
- Pagas: ${vendasPagas.length} (R$ ${vendasPagas.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)})
- Pendentes: ${vendasPendentes.length} (R$ ${vendasPendentes.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)})
- Estornadas: ${vendasEstornadas.length}

### CONTAS A PAGAR
- Pendentes: ${payablesPendentes.length} (R$ ${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)})
- Vencidas: ${payablesVencidos.length} (R$ ${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})

### ESTOQUE
- Peças disponíveis: ${estoqueDisp.length}
- Peso total: ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)} kg

### LOTES
- Total: ${batches.length}
- Abertos: ${batches.filter(b => b.status === 'ABERTO').length}
- Fechados: ${batches.filter(b => b.status === 'FECHADO').length}

### ALERTAS DETECTADOS (${liveAlerts.length})
${liveAlerts.slice(0, 15).map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}

### CLIENTES
- Total: ${clients.length}
- Com saldo devedor: ${clients.filter(c => c.saldo_devedor > 0).length}
            `.trim();

            const systemPrompt = `Você é o AUDITOR FINANCEIRO do FrigoGest — sistema de gestão de frigorífico.

Sua função:
1. Analisar o snapshot financeiro abaixo
2. Identificar RISCOS, FUROS e OPORTUNIDADES
3. Dar recomendações CONCRETAS e ACIONÁVEIS

Regras:
- Responda SEMPRE em português brasileiro
- Seja DIRETO e OBJETIVO
- Use emojis para destacar prioridade: 🔴 crítico, 🟡 atenção, 🟢 ok
- Cite valores e números específicos
- Se não tiver dados suficientes, diga claramente
- Máximo 500 palavras
- Organize em seções: DIAGNÓSTICO, RISCOS, RECOMENDAÇÕES`;

            const res = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: { parts: [{ text: `${systemPrompt}\n\n${snapshot}` }] },
            });

            const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                setAuditResponse(text);
                setTimeout(() => auditResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
            } else {
                setAuditError('A IA não retornou resposta. Tente novamente.');
            }
        } catch (err: any) {
            setAuditError(err.message || 'Erro ao consultar a IA.');
        } finally {
            setAuditLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] animate-reveal pb-20 font-sans">
            {/* HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex flex-col gap-4">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-700 hover:border-blue-100 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar ao Início
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="bg-slate-900 p-3 rounded-2xl text-purple-400 shadow-xl shadow-purple-900/40 relative group">
                            <Brain size={28} />
                            <div className="absolute inset-0 bg-purple-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                Central de <span className="text-purple-600">Agentes IA</span>
                            </h1>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                Ecossistema Multi-Agente • {liveAlerts.length} alertas ativos
                            </p>
                        </div>
                    </div>
                </div>
                {/* TABS */}
                <nav className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    {[
                        { id: 'overview' as const, icon: Activity, label: 'Visão Geral' },
                        { id: 'alerts' as const, icon: Bell, label: `Alertas (${liveAlerts.length})` },
                        { id: 'config' as const, icon: Settings, label: 'Configuração' },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* ═══ OVERVIEW TAB ═══ */}
                {activeTab === 'overview' && (
                    <div className="animate-reveal space-y-8">
                        {/* GLOBAL KPIs */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Saldo Caixa', value: `R$${financialKPIs.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: <DollarSign size={18} />, color: financialKPIs.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600' },
                                { label: 'A Receber', value: `R$${financialKPIs.vendasPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: <TrendingUp size={18} />, color: 'text-blue-600' },
                                { label: 'Estoque Parado', value: `R$${financialKPIs.estoqueValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: <Package size={18} />, color: 'text-purple-600' },
                                { label: 'Alertas Ativos', value: liveAlerts.length.toString(), icon: <Bell size={18} />, color: liveAlerts.length > 0 ? 'text-amber-600' : 'text-emerald-600' },
                                { label: 'Críticos', value: liveAlerts.filter(a => a.severity === 'CRITICO' || a.severity === 'BLOQUEIO').length.toString(), icon: <AlertTriangle size={18} />, color: 'text-rose-600' },
                            ].map((kpi, i) => (
                                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`${kpi.color} opacity-40`}>{kpi.icon}</div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
                                    </div>
                                    <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* AGENT CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {agents.map(agent => {
                                const stats = agentStats[agent.id];
                                const colors = colorMap[agent.color];
                                return (
                                    <button
                                        key={agent.id}
                                        onClick={() => { setSelectedAgent(agent.id); setActiveTab('alerts'); }}
                                        className={`premium-card p-6 bg-white text-left group hover:${colors.border} transition-all hover:shadow-xl ${colors.glow}`}
                                    >
                                        <div className="flex items-start justify-between mb-5">
                                            <div className={`text-4xl`}>{agent.icon}</div>
                                            <div className="flex items-center gap-1">
                                                {stats.bloqueios > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-black">{stats.bloqueios} BLOQ</span>
                                                )}
                                                {stats.criticos > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[9px] font-black">{stats.criticos} CRIT</span>
                                                )}
                                                {stats.total > 0 && stats.criticos === 0 && stats.bloqueios === 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-black">{stats.total}</span>
                                                )}
                                                {stats.total === 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[9px] font-black">OK</span>
                                                )}
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">{agent.name}</h3>
                                        <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{agent.description}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {agent.modules.slice(0, 4).map(m => (
                                                <span key={m} className={`px-2 py-0.5 rounded-md ${colors.bg} ${colors.text} text-[8px] font-black uppercase`}>{m}</span>
                                            ))}
                                            {agent.modules.length > 4 && (
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[8px] font-black">+{agent.modules.length - 4}</span>
                                            )}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{agent.triggerCount} gatilhos</span>
                                            <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* RECENT ALERTS (TOP 6) */}
                        {liveAlerts.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Zap size={14} className="text-amber-500" /> Alertas Recentes
                                    </h3>
                                    <button onClick={() => setActiveTab('alerts')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">
                                        Ver todos ({liveAlerts.length})
                                    </button>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {liveAlerts.slice(0, 6).map(alert => {
                                        const sev = severityConfig[alert.severity];
                                        const agentData = agents.find(a => a.id === alert.agent);
                                        return (
                                            <div key={alert.id} className="p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                                                <div className={`w-8 h-8 rounded-xl ${sev.bg} ${sev.color} flex items-center justify-center shrink-0`}>
                                                    {sev.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black text-slate-300 uppercase">{agentData?.icon} {agentData?.name}</span>
                                                        <span className={`px-1.5 py-0.5 rounded ${sev.bg} ${sev.color} text-[8px] font-black uppercase`}>{alert.severity}</span>
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 text-[8px] font-black uppercase">{alert.module}</span>
                                                    </div>
                                                    <h4 className="font-bold text-sm text-slate-900 truncate">{alert.title}</h4>
                                                    <p className="text-xs text-slate-400 mt-0.5 truncate">{alert.message}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {liveAlerts.length === 0 && (
                            <div className="bg-white rounded-3xl border border-emerald-100 p-16 text-center">
                                <CheckCircle size={60} className="text-emerald-500 mx-auto mb-4" />
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tudo Limpo!</h3>
                                <p className="text-sm text-slate-400 mt-2">Nenhum alerta detectado. Todos os sistemas operando normalmente.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ ALERTS TAB ═══ */}
                {activeTab === 'alerts' && (
                    <div className="animate-reveal space-y-6">
                        {/* FILTER BAR */}
                        <div className="flex flex-wrap gap-2 items-center">
                            <button
                                onClick={() => setSelectedAgent(null)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!selectedAgent ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                            >
                                Todos ({liveAlerts.length})
                            </button>
                            {agents.map(a => {
                                const count = agentStats[a.id].total;
                                return (
                                    <button
                                        key={a.id}
                                        onClick={() => setSelectedAgent(a.id)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedAgent === a.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        {a.icon} {a.name} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {/* LIST */}
                        <div className="space-y-3">
                            {filteredAlerts.map(alert => {
                                const sev = severityConfig[alert.severity];
                                const agentData = agents.find(a => a.id === alert.agent);
                                return (
                                    <div key={alert.id} className={`bg-white rounded-2xl border ${sev.border} p-6 transition-all hover:shadow-lg`}>
                                        <div className="flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-xl ${sev.bg} ${sev.color} flex items-center justify-center shrink-0 text-lg`}>
                                                {sev.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[9px] font-black text-slate-300 uppercase">{agentData?.icon} {agentData?.name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full ${sev.bg} ${sev.color} text-[8px] font-black uppercase`}>{alert.severity}</span>
                                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[8px] font-black uppercase">{alert.module}</span>
                                                </div>
                                                <h4 className="font-bold text-slate-900 mb-1">{alert.title}</h4>
                                                <p className="text-sm text-slate-500">{alert.message}</p>
                                                {alert.data?.valor && (
                                                    <p className="mt-2 text-sm font-black text-rose-600">💰 Impacto: R${alert.data.valor.toFixed(2)}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredAlerts.length === 0 && (
                                <div className="bg-white rounded-2xl border border-emerald-100 p-12 text-center">
                                    <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-slate-400">Nenhum alerta para este agente</p>
                                </div>
                            )}
                        </div>

                        {/* ═══ GEMINI AUDITOR BUTTON ═══ */}
                        <div className="mt-8">
                            <button
                                onClick={runGeminiAudit}
                                disabled={auditLoading}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-5 px-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-purple-200/50 transition-all disabled:opacity-50"
                            >
                                {auditLoading ? (
                                    <><Loader2 size={18} className="animate-spin" /> Analisando dados com Gemini...</>
                                ) : (
                                    <><Sparkles size={18} /> Consultar Auditor IA</>
                                )}
                            </button>
                            {auditError && (
                                <div className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-bold">
                                    ⚠️ {auditError}
                                </div>
                            )}
                            {auditResponse && (
                                <div ref={auditResultRef} className="mt-6 bg-slate-900 rounded-3xl p-8 shadow-2xl animate-reveal">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="bg-purple-500/20 p-2 rounded-xl">
                                            <Sparkles size={20} className="text-purple-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-widest">Parecer do Auditor IA</h4>
                                            <p className="text-[10px] text-slate-500 font-bold">Gemini 2.0 Flash · Análise em tempo real</p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                                        {auditResponse}
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                                        <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                                            {new Date().toLocaleString('pt-BR')}
                                        </span>
                                        <button onClick={runGeminiAudit} className="text-[10px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300 flex items-center gap-1">
                                            <Zap size={12} /> Atualizar Análise
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ CONFIG TAB ═══ */}
                {activeTab === 'config' && (
                    <div className="animate-reveal space-y-6">
                        {agents.map(agent => {
                            const colors = colorMap[agent.color];
                            const stats = agentStats[agent.id];
                            return (
                                <div key={agent.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                    <div className={`p-6 ${colors.bg} border-b ${colors.border} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                                        <div className="flex items-center gap-4">
                                            <span className="text-3xl">{agent.icon}</span>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{agent.name}</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{agent.modules.join(' • ')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full ${stats.total > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} text-[9px] font-black uppercase`}>
                                                {stats.total} alertas
                                            </span>
                                            <div className={`w-12 h-7 rounded-full relative cursor-pointer transition-all ${agent.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${agent.enabled ? 'right-0.5' : 'left-0.5'}`} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <p className="text-sm text-slate-500 mb-4">{agent.description}</p>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-slate-50 rounded-xl p-4 text-center">
                                                <p className="text-2xl font-black text-slate-900">{agent.modules.length}</p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Módulos</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-4 text-center">
                                                <p className="text-2xl font-black text-slate-900">{agent.triggerCount}</p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gatilhos</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-4 text-center">
                                                <p className="text-2xl font-black text-slate-900">{68}</p>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Regras</p>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">System Prompt</label>
                                            <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-blue-300 leading-relaxed">
                                                {agent.systemPrompt}
                                            </div>
                                        </div>
                                        <p className="mt-4 text-[10px] text-emerald-400 font-bold text-center flex items-center justify-center gap-1">
                                            <Sparkles size={12} /> Auditor Financeiro conectado ao Gemini 2.0 Flash
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIAgents;
