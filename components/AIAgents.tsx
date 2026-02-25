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

// ═══ AI CASCADE — Gemini → Groq → Cerebras ═══
interface CascadeProvider {
    name: string;
    call: (prompt: string) => Promise<string>;
}

const buildCascadeProviders = (): CascadeProvider[] => {
    const providers: CascadeProvider[] = [];

    // Vite replaces import.meta.env.VITE_* statically at build time
    // Must access EACH key directly — cannot use dynamic property access
    const geminiKey = (import.meta as any).env.VITE_AI_API_KEY as string || '';
    const groqKey = (import.meta as any).env.VITE_GROQ_API_KEY as string || '';
    const cerebrasKey = (import.meta as any).env.VITE_CEREBRAS_API_KEY as string || '';

    // 1. GEMINI (primário)
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

    // 2. GROQ (fallback 1 — Llama 3.3 70B)
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

    // 3. CEREBRAS (fallback 2 — Llama 3.3 70B)
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
    if (providers.length === 0) throw new Error('Nenhuma API Key configurada (VITE_AI_API_KEY, VITE_GROQ_API_KEY, VITE_CEREBRAS_API_KEY)');
    const errors: string[] = [];
    for (const provider of providers) {
        try {
            const text = await provider.call(prompt);
            if (text) return { text, provider: provider.name };
        } catch (err: any) {
            errors.push(`${provider.name}: ${err.message}`);
            console.warn(`[CASCADE] ${provider.name} falhou:`, err.message);
        }
    }
    throw new Error(`Todas as IAs falharam:\n${errors.join('\n')}`);
};
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
        name: 'Dona Clara',
        description: 'Administradora-Geral — enxerga TUDO: lotes, estoque, clientes, vendas, pedidos, fornecedores, financeiro e auditoria. O cérebro central do frigorífico.',
        icon: '🧠',
        color: 'blue',
        enabled: true,
        systemPrompt: 'Você é Dona Clara, administradora-geral do FrigoGest. Cérebro central com visão total de 10 módulos.',
        modules: ['LOTES', 'ESTOQUE', 'CLIENTES', 'VENDAS', 'PEDIDOS', 'FORNECEDORES', 'FINANCEIRO', 'CADEIA_ABATE', 'ROBO_VENDAS', 'AUDITORIA'],
        triggerCount: 19,
    },
    {
        id: 'PRODUCAO',
        name: 'Seu Antônio',
        description: 'Chefe de Produção — especialista em rendimento de carcaça, raças, quebra de resfriamento e scorecard de fornecedores. 30 anos de experiência no abate.',
        icon: '🥩',
        color: 'emerald',
        enabled: true,
        systemPrompt: 'Você é Seu Antônio, chefe de produção do FrigoGest. Especialista em rendimento, raças e fornecedores.',
        modules: ['LOTES', 'ESTOQUE', 'FORNECEDORES'],
        triggerCount: 6,
    },
    {
        id: 'COMERCIAL',
        name: 'Marcos',
        description: 'Diretor Comercial — foco em maximizar receita, proteger margem, controlar crédito e manter o ranking dos melhores compradores atualizado.',
        icon: '💰',
        color: 'amber',
        enabled: true,
        systemPrompt: 'Você é Marcos, diretor comercial do FrigoGest. Foco em vendas, margem, crédito e ranking de clientes.',
        modules: ['VENDAS', 'CLIENTES'],
        triggerCount: 4,
    },
    {
        id: 'AUDITOR',
        name: 'Dra. Beatriz',
        description: 'Auditora Financeira — garante que cada centavo esteja rastreado. Detecta furos no caixa, estornos incompletos e transações órfãs. Implacável.',
        icon: '🔍',
        color: 'rose',
        enabled: true,
        systemPrompt: 'Você é Dra. Beatriz, auditora financeira do FrigoGest. Regra de ouro: cada venda paga deve ter Transaction ENTRADA.',
        modules: ['FINANCEIRO', 'VENDAS', 'LOTES'],
        triggerCount: 5,
    },
    {
        id: 'ESTOQUE',
        name: 'Joaquim',
        description: 'Estoquista-Chefe — controla a câmara fria com mão de ferro. Rotação FIFO, validade das peças e giro do estoque. Nada estraga no turno dele.',
        icon: '📦',
        color: 'cyan',
        enabled: true,
        systemPrompt: 'Você é Joaquim, estoquista-chefe do FrigoGest. FIFO é lei: peça mais velha sai primeiro.',
        modules: ['ESTOQUE', 'LOTES'],
        triggerCount: 4,
    },
    {
        id: 'COMPRAS',
        name: 'Roberto',
        description: 'Comprador — negocia com fornecedores, analisa fretes, compara preços e garante o melhor custo de aquisição. Olho nos centavos.',
        icon: '🚛',
        color: 'orange',
        enabled: true,
        systemPrompt: 'Você é Roberto, comprador do FrigoGest. Foco em custo de aquisição, frete e negociação com fornecedores.',
        modules: ['FORNECEDORES', 'LOTES', 'FINANCEIRO'],
        triggerCount: 4,
    },
    {
        id: 'MERCADO',
        name: 'Ana',
        description: 'Analista de Mercado — acompanha cotações CEPEA, tendências de preço, safra/entressafra e oportunidades de compra e venda.',
        icon: '📊',
        color: 'violet',
        enabled: true,
        systemPrompt: 'Você é Ana, analista de mercado do FrigoGest. Especialista em CEPEA, tendências e inteligência regional.',
        modules: ['MERCADO', 'LOTES'],
        triggerCount: 3,
    },
    {
        id: 'ROBO_VENDAS',
        name: 'Lucas',
        description: 'Robô de Vendas — prospecta clientes inativos, sugere follow-up, identifica oportunidades de recompra e mantém o pipeline aquecido.',
        icon: '🤖',
        color: 'teal',
        enabled: true,
        systemPrompt: 'Você é Lucas, robô de vendas do FrigoGest. Foco em reativação, prospecção e pipeline.',
        modules: ['CLIENTES', 'VENDAS', 'PEDIDOS'],
        triggerCount: 4,
    },
];

const AIAgents: React.FC<AIAgentsProps> = ({
    onBack, batches, stock, sales, clients, transactions, suppliers, payables, scheduledOrders
}) => {
    const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'config'>('overview');
    const [agents] = useState<AgentConfig[]>(DEFAULT_AGENTS);
    const [agentResponse, setAgentResponse] = useState<string | null>(null);
    const [agentLoading, setAgentLoading] = useState(false);
    const [agentError, setAgentError] = useState<string | null>(null);
    const [consultingAgent, setConsultingAgent] = useState<AgentType | null>(null);
    const agentResultRef = useRef<HTMLDivElement>(null);

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

        // ── JOAQUIM (ESTOQUE): Peças velhas na câmara fria ──
        stock.filter(s => s.status === 'DISPONIVEL').forEach(s => {
            const dias = Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000);
            if (dias > 60) {
                alerts.push({
                    id: `EST-VELHO-${s.id_completo}`, agent: 'ESTOQUE', severity: 'CRITICO',
                    module: 'ESTOQUE', title: `⚠️ Peça ${s.id_completo} — ${dias} dias!`,
                    message: `No frio há ${dias} dias. Peso: ${s.peso_entrada}kg. RISCO DE PERDA. Vender com desconto ou reprocessar URGENTE.`,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { dias, peso: s.peso_entrada }
                });
            } else if (dias > 30) {
                alerts.push({
                    id: `EST-MED-${s.id_completo}`, agent: 'ESTOQUE', severity: 'ALERTA',
                    module: 'ESTOQUE', title: `Peça ${s.id_completo} — ${dias} dias`,
                    message: `No frio há ${dias} dias. Peso: ${s.peso_entrada}kg. Priorizar saída (FIFO).`,
                    timestamp: now.toISOString(), status: 'NOVO'
                });
            }
        });

        // ── ROBERTO (COMPRAS): Fornecedores com problemas ──
        suppliers.forEach(s => {
            if (!s.dados_bancarios) {
                alerts.push({
                    id: `COMP-BANK-${s.id}`, agent: 'COMPRAS', severity: 'ALERTA',
                    module: 'FORNECEDORES', title: `${s.nome_fantasia} sem PIX/Banco`,
                    message: `Fornecedor sem dados bancários. Pode atrasar pagamentos.`,
                    timestamp: now.toISOString(), status: 'NOVO'
                });
            }
            const lastBatch = batches.filter(b => b.fornecedor === s.nome_fantasia)
                .sort((a, b) => new Date(b.data_recebimento).getTime() - new Date(a.data_recebimento).getTime())[0];
            if (lastBatch) {
                const dias = Math.floor((now.getTime() - new Date(lastBatch.data_recebimento).getTime()) / 86400000);
                if (dias > 90) {
                    alerts.push({
                        id: `COMP-INATIVO-${s.id}`, agent: 'COMPRAS', severity: 'INFO',
                        module: 'FORNECEDORES', title: `${s.nome_fantasia} inativo`,
                        message: `Sem lote há ${dias} dias. Renegociar ou buscar alternativa.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
        });

        // ── ROBERTO: Payables vencidos a fornecedores ──
        payables.filter(p => p.status === 'PENDENTE' || p.status === 'PARCIAL').forEach(p => {
            const venc = new Date(p.data_vencimento);
            const diasAtraso = Math.floor((now.getTime() - venc.getTime()) / 86400000);
            if (diasAtraso > 0) {
                alerts.push({
                    id: `COMP-PAY-${p.id}`, agent: 'COMPRAS', severity: 'CRITICO',
                    module: 'FINANCEIRO', title: `Dívida vencida: ${p.descricao}`,
                    message: `Venceu há ${diasAtraso} dias. Valor: R$${p.valor.toFixed(2)}. Pagar para não perder fornecedor.`,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { valor: p.valor, dias_atraso: diasAtraso }
                });
            }
        });

        // ── LUCAS (ROBÔ VENDAS): Clientes para reativar ──
        clients.forEach(c => {
            const lastSale = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO')
                .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
            if (lastSale) {
                const dias = Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / 86400000);
                if (dias > 60) {
                    alerts.push({
                        id: `ROBO-REATIV-${c.id_ferro}`, agent: 'ROBO_VENDAS', severity: 'ALERTA',
                        module: 'CLIENTES', title: `Reativar: ${c.nome_social}`,
                        message: `Sem compra há ${dias} dias. Ligar e oferecer promoção ou condição especial.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                } else if (dias > 30) {
                    alerts.push({
                        id: `ROBO-FOLLOW-${c.id_ferro}`, agent: 'ROBO_VENDAS', severity: 'INFO',
                        module: 'CLIENTES', title: `Follow-up: ${c.nome_social}`,
                        message: `Última compra há ${dias} dias. Mandar mensagem de acompanhamento.`,
                        timestamp: now.toISOString(), status: 'NOVO'
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
            ESTOQUE: { total: 0, criticos: 0, bloqueios: 0 },
            COMPRAS: { total: 0, criticos: 0, bloqueios: 0 },
            MERCADO: { total: 0, criticos: 0, bloqueios: 0 },
            ROBO_VENDAS: { total: 0, criticos: 0, bloqueios: 0 },
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
        cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', glow: 'shadow-cyan-200/50' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', glow: 'shadow-orange-200/50' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', glow: 'shadow-violet-200/50' },
        teal: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', glow: 'shadow-teal-200/50' },
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

    // ═══ GEMINI MULTI-AGENT — CONSULTA POR AGENTE ═══
    const runAgentConsult = async (agentType: AgentType) => {
        setAgentLoading(true);
        setAgentError(null);
        setAgentResponse(null);
        setConsultingAgent(agentType);
        try {
            // Cascade será chamado após montar prompt e data

            const validTx = transactions.filter(t => t.categoria !== 'ESTORNO');
            const totalEntradas = validTx.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
            const totalSaidas = validTx.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
            const vendasPagas = sales.filter(s => s.status_pagamento === 'PAGO');
            const vendasPendentes = sales.filter(s => s.status_pagamento === 'PENDENTE');
            const vendasEstornadas = sales.filter(s => s.status_pagamento === 'ESTORNADO');
            const payablesPendentes = payables.filter(p => p.status === 'PENDENTE' || p.status === 'PARCIAL');
            const payablesVencidos = payablesPendentes.filter(p => new Date(p.data_vencimento) < new Date());
            const estoqueDisp = stock.filter(s => s.status === 'DISPONIVEL');
            const agentAlerts = liveAlerts.filter(a => a.agent === agentType);

            // ═══ DATA PACKETS PER AGENT ═══
            const dataPackets: Record<AgentType, string> = {
                ADMINISTRATIVO: `
## SNAPSHOT GERAL — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Caixa: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Vendas: ${vendasPagas.length} pagas, ${vendasPendentes.length} pendentes, ${vendasEstornadas.length} estornadas
Contas a Pagar: ${payablesPendentes.length} pendentes (R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)}), ${payablesVencidos.length} vencidas
Estoque: ${estoqueDisp.length} peças, ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg
Lotes: ${batches.length} total (${batches.filter(b => b.status === 'ABERTO').length} abertos, ${batches.filter(b => b.status === 'FECHADO').length} fechados)
Clientes: ${clients.length} total, ${clients.filter(c => c.saldo_devedor > 0).length} com saldo devedor
Fornecedores: ${suppliers.length} cadastrados
Pedidos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length} abertos
Alertas: ${liveAlerts.length} ativos
${liveAlerts.slice(0, 10).map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                PRODUCAO: `
## SNAPSHOT PRODUÇÃO — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Lotes: ${batches.length} total
${batches.filter(b => b.status !== 'ESTORNADO').slice(-10).map(b => {
                    const pecas = stock.filter(s => s.id_lote === b.id_lote);
                    const pesoTotal = pecas.reduce((s, p) => s + p.peso_entrada, 0);
                    const rend = b.peso_total_romaneio > 0 ? ((pesoTotal / b.peso_total_romaneio) * 100).toFixed(1) : 'N/A';
                    return `- Lote ${b.id_lote} | Forn: ${b.fornecedor} | Raça: ${(b as any).raca || 'N/I'} | Cab: ${(b as any).qtd_cabecas || 'N/I'} | Romaneio: ${b.peso_total_romaneio}kg | Pesado: ${pesoTotal.toFixed(1)}kg | Rend: ${rend}% | Toalete: ${(b as any).toalete_kg || 'N/I'}kg | Peças: ${pecas.length}`;
                }).join('\n')}
Estoque: ${estoqueDisp.length} peças, ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg disponível
Fornecedores: ${suppliers.length}
Alertas Produção: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                COMERCIAL: `
## SNAPSHOT COMERCIAL — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Vendas Pagas: ${vendasPagas.length} (R$${vendasPagas.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)})
Vendas Pendentes: ${vendasPendentes.length} (R$${vendasPendentes.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)})
Vendas Estornadas: ${vendasEstornadas.length}
Preço Médio Venda/kg: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}
Clientes: ${clients.length} total
${clients.filter(c => c.saldo_devedor > 0).slice(0, 10).map(c => `- ${c.nome_social}: Devendo R$${c.saldo_devedor.toFixed(2)} | Limite R$${c.limite_credito.toFixed(2)}`).join('\n')}
Top vendas pendentes:
${vendasPendentes.slice(0, 8).map(v => `- ${v.nome_cliente || v.id_cliente}: ${v.peso_real_saida}kg × R$${v.preco_venda_kg}/kg = R$${(v.peso_real_saida * v.preco_venda_kg).toFixed(2)} | Venc: ${v.data_vencimento}`).join('\n')}
Alertas Comercial: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                AUDITOR: `
## SNAPSHOT FINANCEIRO — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Caixa: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Transações: ${transactions.length} total
Vendas PAGAS sem Transaction ENTRADA: ${vendasPagas.filter(v => !transactions.some(t => t.referencia_id === v.id_venda && t.tipo === 'ENTRADA' && t.categoria !== 'ESTORNO')).length}
Lotes sem saída financeira: ${batches.filter(b => b.status !== 'ESTORNADO' && !payables.some(p => p.id_lote === b.id_lote) && !transactions.some(t => t.referencia_id === b.id_lote && t.tipo === 'SAIDA')).length}
Contas vencidas: ${payablesVencidos.length} (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Estornos: ${vendasEstornadas.length} vendas, ${transactions.filter(t => t.categoria === 'ESTORNO').length} transações
Alertas Auditor: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                ESTOQUE: `
## SNAPSHOT ESTOQUE — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Peças disponíveis: ${estoqueDisp.length}
Peso total: ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg
Peças >30 dias: ${estoqueDisp.filter(s => Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 30).length}
Peças >60 dias: ${estoqueDisp.filter(s => Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 60).length}
Detalhamento:
${estoqueDisp.slice(0, 15).map(s => {
                    const dias = Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000);
                    return `- ${s.id_completo} | ${s.peso_entrada}kg | ${dias} dias | Lote: ${s.id_lote}`;
                }).join('\n')}
Alertas Estoque: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                COMPRAS: `
## SNAPSHOT COMPRAS — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Fornecedores: ${suppliers.length} cadastrados
${suppliers.slice(0, 10).map(s => {
                    const lotes = batches.filter(b => b.fornecedor === s.nome_fantasia);
                    const totalKg = lotes.reduce((sum, b) => sum + b.peso_total_romaneio, 0);
                    const totalR = lotes.reduce((sum, b) => sum + b.valor_compra_total, 0);
                    return `- ${s.nome_fantasia} | Raça: ${s.raca_predominante || 'N/I'} | ${lotes.length} lotes | ${totalKg.toFixed(0)}kg | R$${totalR.toFixed(2)} | Banco: ${s.dados_bancarios ? 'SIM' : 'NÃO'}`;
                }).join('\n')}
Contas a Pagar: ${payablesPendentes.length} (R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Vencidas: ${payablesVencidos.length} (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Custo médio/kg: R$${batches.length > 0 ? (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length).toFixed(2) : '0.00'}
Alertas Compras: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                MERCADO: `
## SNAPSHOT MERCADO — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Preço médio compra/kg: R$${batches.length > 0 ? (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length).toFixed(2) : '0.00'}
Preço médio venda/kg: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}
Margem bruta estimada: ${vendasPagas.length > 0 && batches.length > 0 ? (((vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length) / (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length) - 1) * 100).toFixed(1) : 'N/A'}%
Lotes recentes (10):
${batches.slice(-10).map(b => `- ${b.id_lote}: ${b.peso_total_romaneio}kg a R$${b.custo_real_kg.toFixed(2)}/kg | Forn: ${b.fornecedor}`).join('\n')}
Região: Vitória da Conquista - BA
Alertas Mercado: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                ROBO_VENDAS: `
## SNAPSHOT VENDAS — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Clientes total: ${clients.length}
Clientes com compra no mês: ${clients.filter(c => sales.some(s => s.id_cliente === c.id_ferro && Math.floor((new Date().getTime() - new Date(s.data_venda).getTime()) / 86400000) < 30)).length}
Clientes inativos (>30d): ${clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro).sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; return ls && Math.floor((new Date().getTime() - new Date(ls.data_venda).getTime()) / 86400000) > 30; }).length}
Clientes inativos (>60d): ${clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro).sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; return ls && Math.floor((new Date().getTime() - new Date(ls.data_venda).getTime()) / 86400000) > 60; }).length}
Top clientes por volume:
${clients.sort((a, b) => { const va = sales.filter(s => s.id_cliente === a.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); const vb = sales.filter(s => s.id_cliente === b.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); return vb - va; }).slice(0, 8).map(c => { const cv = sales.filter(s => s.id_cliente === c.id_ferro); const kg = cv.reduce((s, v) => s + v.peso_real_saida, 0); return `- ${c.nome_social}: ${cv.length} compras, ${kg.toFixed(1)}kg`; }).join('\n')}
Pedidos abertos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length}
Alertas Robô: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),
            };

            // ═══ PROMPTS PER AGENT ═══
            const prompts: Record<AgentType, string> = {
                ADMINISTRATIVO: `Você é DONA CLARA, administradora-geral do FrigoGest — o CÉREBRO CENTRAL do frigorífico.
Você tem visão de 360° e manda em todos os 7 outros agentes: Seu Antônio (Produção), Marcos (Comercial), Dra. Beatriz (Auditoria), Joaquim (Estoque), Roberto (Compras), Ana (Mercado), Lucas (Robô Vendas).

SUA EXPERTISE:
- Fluxo de caixa: entradas vs saídas, capital de giro, necessidade de financiamento
- Ciclo operacional: compra de gado → abate → desossa → estoque → venda → recebimento
- Correlação entre setores: se rendimento cai E dívidas sobem, identifique a raiz
- Capacidade produtiva: quantos lotes por semana processamos? Estamos ociosos ou sobrecarregados?
- Gestão de risco: concentração em poucos fornecedores ou clientes é risco

ANÁLISE CRUZADA (sua vantagem):
- Estoque parado + vendas pendentes = problema de preço ou de vendedor?
- Fornecedor com rendimento baixo + dívida vencida = cortar relação?
- Cliente devedor + alta frequência = renegociar crédito ou bloquear?

Organize em: 📋 DIAGNÓSTICO EXECUTIVO, 🔥 AÇÕES URGENTES (próximas 24h), 📅 PLANEJAMENTO (próxima semana)`,

                PRODUCAO: `Você é SEU ANTÔNIO, chefe de produção do FrigoGest com 30 ANOS de experiência em abate e desossa.

CONHECIMENTO TÉCNICO EMBRAPA:
- RENDIMENTO DE CARCAÇA por raça:
  • Nelore (puro): 48-52% (pode chegar a 62% em confinamento premium)
  • Angus × Nelore (F1): 50-55% — cruzamento industrial mais popular
  • Senepol × Nelore: 53-57% — excelente acabamento precoce, gene pelo zero
  • Senepol puro: 53-54%
  • Angus puro: 52-56% — referência em marmoreio
  • Hereford × Nelore: 52-55%
  • Charolês × Nelore: 53-56% — maior peso de carcaça
  • Brahman: 50-53%
  • Brangus: 51-55%
  • Gir × Holandês: 45-48% — dupla aptidão, rendimento menor
  • Guzerá: 48-51%
  • Tabapuã: 49-52%

- QUEBRA DE RESFRIAMENTO: normal 1.5-2.5%. Acima de 3% = problema na câmara fria
- TOALETE: normal ~15kg por carcaça. Acima de 20kg = ALERTA. Acima de 25kg = frigorífico está abusando
- PESO VIVO → CARCAÇA: 1 boi de 500kg vivo ≈ 250kg carcaça (rendimento ~50%)
- CONVERSÃO ARROBA: 1@ = 15kg. Boi de 500kg = 33,3@ vivas ≈ 16,6@ de carcaça

ANÁLISE QUE VOCÊ DEVE FAZER:
- Compare rendimento real vs referência EMBRAPA para cada raça
- Identifique fornecedores com rendimento consistentemente abaixo da média
- Calcule custo real por kg de carne (incluindo frete, toalete, quebra)
- Sugira fornecedores para cortar e para premiar
- Alerte sobre toalete excessiva (frigorífico pode estar desviando carne)

Organize em: 🥩 ANÁLISE DE RENDIMENTO, 📊 SCORECARD FORNECEDORES, ⚠️ ALERTAS PRODUÇÃO, 💡 RECOMENDAÇÕES`,

                COMERCIAL: `Você é MARCOS, diretor comercial do FrigoGest — sua missão é MAXIMIZAR RECEITA e PROTEGER MARGEM.

EXPERTISE COMERCIAL:
- POLÍTICA DE PREÇO: preço mínimo de venda deve ser custo_real_kg × 1.3 (30% margem mínima)
- CRÉDITO: cliente que excede limite NÃO pode comprar a prazo. Só à vista
- PRAZO: padrão 7-21-28 dias. Acima de 30 dias só com garantia
- DESCONTO: máximo 5% para volume. Acima disso, precisa de autorização
- SAZONALIDADE: fim de mês = pico de demanda (açougues, restaurantes, churrascarias)

ANÁLISE QUE VOCÊ DEVE FAZER:
- COBRANÇA: quem está devendo e há quantos dias? Priorize por valor
- TICKET MÉDIO: qual o valor médio por venda? Está subindo ou caindo?
- TOP 10: rankeie clientes por volume (kg) e por receita (R$) — quem são os VIPs?
- CHURN: clientes que pararam de comprar — por quê? Preço? Qualidade? Atendimento?
- PREÇO vs CUSTO: estamos vendendo acima do custo real? Qual a margem por venda?
- OPORTUNIDADES: cliente que compra pouco mas tem potencial para comprar mais
- MIX DE PRODUTOS: quais cortes vendem mais? Quais encalham?

Organize em: 💰 SAÚDE COMERCIAL, 📞 COBRANÇAS URGENTES (ligar HOJE), 🏆 TOP CLIENTES, 📈 OPORTUNIDADES`,

                AUDITOR: `Você é DRA. BEATRIZ, auditora financeira do FrigoGest — IMPLACÁVEL com cada centavo.

REGRAS DE OURO DA AUDITORIA:
1. Toda venda PAGA deve ter Transaction tipo ENTRADA no caixa — se não tem, é FURO
2. Todo lote comprado deve ter: ou Transaction SAIDA, ou Payable vinculado — se não tem, gado gratuito?
3. Todo estorno de venda deve ter Transaction ESTORNO correspondente
4. Saldo do caixa (entradas - saídas) deve bater com dinheiro real
5. Soma de vendas pendentes deve bater com saldo devedor dos clientes
6. Soma de payables pendentes deve bater com contas a pagar

CHECKLIST DE AUDITORIA:
- FUROS NO CAIXA: vendas pagas sem entrada, ou entradas sem venda correspondente
- ESTORNOS INCOMPLETOS: venda estornada mas peça não voltou ao estoque, ou dinheiro não devolvido
- TRANSAÇÕES ÓRFÃS: transações sem referência a vendas ou lotes
- DUPLICIDADES: mesma venda registrada duas vezes, ou mesmo lote pago duas vezes
- DIVERGÊNCIAS: valor da venda diferente do valor da transação
- CONTAS VENCIDAS: payables não pagos após vencimento — risco de juros e perda de fornecedor

Organize em: 🔍 DIAGNÓSTICO FINANCEIRO, 🔴 FUROS DETECTADOS, ⚠️ RISCOS, ✅ RECOMENDAÇÕES`,

                ESTOQUE: `Você é JOAQUIM, estoquista-chefe do FrigoGest — a câmara fria é SEU TERRITÓRIO.

REGRAS DE OURO DO ESTOQUE:
1. FIFO É LEI: First In, First Out — peça mais velha sai PRIMEIRO, sem exceção
2. TEMPO MÁXIMO: carne bovina congelada dura até 12 meses, mas qualidade cai após 90 dias
3. TEMPERATURA: câmara de congelamento -18°C, câmara de resfriamento 0-2°C
4. CLASSIFICAÇÃO por tempo no frio:
   • 0-15 dias: 🟢 FRESCO — vender pelo preço normal
   • 16-30 dias: 🟡 NORMAL — começar a priorizar saída
   • 31-60 dias: 🟠 ATENÇÃO — oferecer desconto 5-10%, ligar para clientes
   • 61-90 dias: 🔴 URGENTE — desconto 15-20%, promoção agressiva
   • 90+ dias: ⛔ CRÍTICO — vender a qualquer preço ou destinar para charque/industrializado

ANÁLISE QUE VOCÊ DEVE FAZER:
- GIRO DE ESTOQUE: quantos dias em média uma peça fica no frio?
- PESO TOTAL vs CAPACIDADE: estamos com câmara cheia ou ociosa?
- PEÇAS MAIS VELHAS: liste as 5 peças mais antigas — ação IMEDIATA
- CURVA ABC: 80% do peso são de quais tipos de corte?
- PERDAS: houve peças perdidas, descartadas ou com quebra de peso?
- FILA DE SAÍDA: há pedidos agendados que vão consumir esse estoque?

Organize em: ❄️ SITUAÇÃO DA CÂMARA, ⚠️ PEÇAS EM RISCO, 📦 GIRO DO ESTOQUE, 🎯 AÇÕES IMEDIATAS`,

                COMPRAS: `Você é ROBERTO, comprador do FrigoGest — OLHO NOS CENTAVOS, sem desperdiçar um real.

EXPERTISE DE COMPRAS DE GADO:
- CUSTO REAL por kg = (valor_compra + frete + gastos_extras) / peso_total
- FRETE: custo normal R$3-8/km dependendo da distância. Acima = renegociar
- PAGAMENTO: à vista = desconto 3-5%. A prazo (7-21d) = preço cheio
- FORNECEDOR BOM: entrega pontual, rendimento >50%, aceita pagamento a prazo, gado saudável
- FORNECEDOR RUIM: atrasa entrega, rendimento <48%, exige pagamento antecipado, lotes irregulares
- DIVERSIFICAÇÃO: não depender de 1-2 fornecedores. Ideal = 5+ ativos

SCORECARD DE FORNECEDOR (0-100 pontos):
- Rendimento médio (peso real vs romaneio): 0-30 pts
- Regularidade de entrega: 0-20 pts
- Condições de pagamento: 0-15 pts
- Raça e genética do rebanho: 0-15 pts
- Custo total por kg: 0-20 pts

ANÁLISE QUE VOCÊ DEVE FAZER:
- RANKING: quem é o melhor e o pior fornecedor, e por quê
- CUSTO COMPARATIVO: custo/kg por fornecedor — variação é normal <5%
- PAGAMENTOS: quem estamos devendo? Há risco de perder fornecedor?
- OPORTUNIDADES: fornecedor novo na região? Época de compra mais barata?
- FRETE: % do frete no custo total — acima de 8% precisa renegociar

Organize em: 🚛 SCORECARD FORNECEDORES, 💰 ANÁLISE DE CUSTOS, ⚠️ PAGAMENTOS PENDENTES, 💡 OPORTUNIDADES`,

                MERCADO: `Você é ANA, CONSULTORA ESTRATÉGICA DE MERCADO E MARKETING do FrigoGest — você traz inteligência do MUNDO REAL para dentro do negócio.

📍 LOCALIZAÇÃO: Vitória da Conquista - BA (Sudoeste Baiano)
Praças de referência: Feira de Santana, Itapetinga, Ilhéus, Jequié, Itabuna

═══════════════════════════════════════════════
📊 INTELIGÊNCIA DE MERCADO — DADOS REAIS FEVEREIRO 2026
═══════════════════════════════════════════════

1. COTAÇÃO DA ARROBA — BRASIL (CEPEA/ESALQ):
   • Indicador Nacional CEPEA: R$340-350/@  (mais alto desde 2022)
   • Alta de 7.7% vs final de 2025 (era R$319)
   • Volatilidade 2025 caiu para 53.1% (metade de 2023/2024) = mercado mais estável
   • B3 futuros fev/2026: R$350,60/@ → mercado aposta em alta

2. COTAÇÃO BAHIA (Scot Consultoria, fev/2026):
   • BA Sul: R$308,50/@ vista | R$312,00/@ 30 dias
   • BA Oeste: R$312,50/@ vista | R$316,00/@ 30 dias
   • DIFERENÇA BA vs SP: R$35-40 a menos (logística + distância)
   • OPORTUNIDADE: comprar na BA e vender localmente é viável. Exportar para SP não.

3. SAZONALIDADE DO BOI (ciclo anual):
   • SAFRA (fev-jun): chuva → pasto bom → mais gado → PREÇO CAI 10-15%
   • ENTRESSAFRA (jul-nov): seca → pasto ruim → menos gado → PREÇO SOBE 15-25%
   • PICO FESTAS (dez-jan): Natal/Réveillon → demanda alta → preço firme
   • VALE: janeiro (pós-festas), março-abril (quaresma)
   • AGORA (fevereiro): SAFRA INICIANDO — janela para comprar mais barato

4. TIPOS DE BOI E PRÊMIO/DESCONTO:
   • BOI COMUM (Nelore, pasto): preço base
   • BOI CHINA (habilitado exportação): +10-15% sobre o comum
   • NOVILHA: -5 a -10% vs boi inteiro (mas rendimento pode ser maior)
   • BOI CONFINADO: +5% sobre pasto (melhor acabamento)
   • BOI ORGÂNICO: +20-30% (nicho premium crescente)
   • BOI ANGUS/CRUZAMENTO: +8-12% (demanda de restaurantes crescendo)

═══════════════════════════════════════════════
💰 PREÇOS POR CORTE (REFERÊNCIA ATACADO/VAREJO)
═══════════════════════════════════════════════

ATACADO (SP, fev/2026):
   • Carcaça casada: R$23,00/kg
   • Quarto Traseiro: R$26,50/kg (margem MAIOR)
   • Quarto Dianteiro: R$20,00/kg (volume MAIOR)

VAREJO (preço médio por corte):
   • PICANHA: R$73-81/kg (margem ALTÍSSIMA, vende pouco volume)
   • FILÉ MIGNON: R$78-92/kg (nicho premium)
   • ALCATRA: R$51-54/kg (equilíbrio volume+margem)
   • CONTRAFILÉ: R$45-58/kg (corte mais pedido em restaurantes)
   • FRALDINHA: R$38/kg (queridinha do churrasco)
   • PATINHO: R$49/kg (dona de casa, dia a dia)
   • MÚSCULO: R$41/kg (baixo custo, alto volume)
   • PEITO/ACÉM: R$36/kg (popular, gira rápido)

LIÇÃO: O lucro está no MIX — vender só cortes populares dá volume mas margem baixa. 
Combinar traseiro premium + dianteiro popular = margem ótima.

═══════════════════════════════════════════════
🏪 ESTRATÉGIAS DE MARKETING POR CANAL
═══════════════════════════════════════════════

CANAL 1 — AÇOUGUES (varejo especializado):
   • Representam 40-50% das vendas de frigorífico regional
   • DECISOR: o próprio dono do açougue (relação pessoal é TUDO)
   • FREQUÊNCIA: compra 2-3x por semana (perecível)
   • ESTRATÉGIA: visita pessoal, WhatsApp direto, preço por fidelidade
   • OPORTUNIDADE: kit pronto (sortido dianteiro+traseiro), entrega rápida
   • DOR: prazo de pagamento, falta de produto, qualidade irregular
   • TENDÊNCIA 2026: açougue gourmet, degustação em loja, cortes premium

CANAL 2 — RESTAURANTES/CHURRASCARIAS:
   • Margem MAIOR que açougue (pagam mais por qualidade)
   • DECISOR: chef ou gerente de compras
   • FREQUÊNCIA: compra programada semanal
   • CORTES mais pedidos: picanha, contra-filé, fraldinha, costela
   • ESTRATÉGIA: contrato mensal com preço fixo, garantia de fornecimento
   • OPORTUNIDADE: carnes premium (Angus, maturada), cortes especiais
   • DOR: consistência de qualidade, pontualidade na entrega

CANAL 3 — ATACADO (distribuidores, outros frigoríficos):
   • Volume ALTO mas margem BAIXA (5-10%)
   • DECISOR: comprador profissional (negocia centavos)
   • ESTRATÉGIA: preço competitivo, volume mínimo, frete incluso
   • OPORTUNIDADE: limpeza de estoque antigo com desconto progressivo
   • RISCO: inadimplência alta — exigir garantias

CANAL 4 — VENDA DIRETA (consumidor final):
   • Margem ALTÍSSIMA (40-60%) mas volume baixo
   • ESTRATÉGIA: Instagram, WhatsApp, kits de churrasco, assinatura mensal
   • TENDÊNCIA 2026: social commerce (+28% ao ano), delivery, kits prontos
   • PÚBLICO: classes A/B que valorizam procedência e qualidade
   • DOR: logística de última milha (frio), embalagem, marketing digital

═══════════════════════════════════════════════
🌍 MERCADO DE EXPORTAÇÃO (inteligência estratégica)
═══════════════════════════════════════════════
   • Brasil = MAIOR exportador mundial de carne bovina (superou EUA em 2025)
   • Exportações 2025: +20.9% volume, +39.3% receita vs 2024
   • Destinos principais: China, EUA, Oriente Médio
   • Habilitação China: frigorífico precisa de SIF + protocolo sanitário específico
   • IMPACTO para frigorífico regional: boi habilitado China paga 10-15% a mais
   • Se seu frigorífico NÃO é habilitado: foque no mercado interno com qualidade

═══════════════════════════════════════════════
📈 TENDÊNCIAS DE CONSUMO 2025/2026
═══════════════════════════════════════════════
   • GERAÇÃO Z: conteúdo visual curto (TikTok/Reels), menos leal a marcas
   • SAÚDE: carne como "alimento funcional" — proteína, ferro, B12 (usar no marketing!)
   • SUSTENTABILIDADE: consumidores querem saber a ORIGEM do animal
   • RASTREABILIDADE: blockchain e QR code na embalagem (tendência forte)
   • BEM-ESTAR ANIMAL: mais importante que "sustentabilidade" para o consumidor
   • PREÇO ALTO → consumidor migra para frango/suíno (monitorar!)
   • CARNE MOÍDA: vendas fortes, item de entrada para consumidores de menor renda
   • MATURAÇÃO: nicho premium crescendo rápido em churrascarias e empórios

═══════════════════════════════════════════════
🏆 CONCORRÊNCIA PARA FRIGORÍFICO REGIONAL
═══════════════════════════════════════════════
   • VANTAGENS do regional: agilidade, conhecimento local, entrega rápida, relacionamento
   • DESVANTAGENS: escala, habilitação, poder de negociação
   • DIFERENCIAÇÃO: qualidade + atendimento + pontualidade > preço
   • BENCHMARK: margem EBITDA dos grandes (JBS, Minerva, Frigol): 3-6%
   • SEU alvo: margem bruta 25-35%, líquida 8-15% (acima da média!)

═══════════════════════════════════════════════
🎯 MARGEM DO FRIGORÍFICO
═══════════════════════════════════════════════
   • Margem bruta saudável: 25-35%
   • Margem líquida saudável: 8-15%
   • Abaixo de 20% bruta: 🟡 ALERTA — revisar preços de compra e venda
   • Abaixo de 5% líquida: 🔴 CRÍTICO — operação não se sustenta
   • Referência: grandes frigoríficos operam com 1.5-6% EBITDA. Você pode fazer MAIS.

CONVERSÕES ESSENCIAIS:
   • 1 arroba (@) = 15 kg de carcaça
   • 1 boi gordo ≈ 16-18@ de carcaça (240-270kg)
   • Preço por kg carcaça = preço arroba ÷ 15
   • Preço por kg do boi em pé = preço arroba ÷ 30 (rendimento ~50%)

SUA ANÁLISE DEVE COBRIR:
- 📊 PANORAMA: como está o mercado AGORA e para onde vai nos próximos 30 dias?
- 💰 MARGENS: estamos comprando bem e vendendo bem? Onde está o gap?
- 🎯 TIMING: é hora de comprar gado (preço baixo) ou segurar caixa (preço alto)?
- 🏪 CANAIS: estamos vendendo nos canais certos? Onde está a oportunidade?
- 📱 MARKETING: como atrair mais clientes? Que ações práticas o dono pode fazer HOJE?
- 🌍 CENÁRIO EXTERNO: exportação, preço do dólar, oferta de gado — o que impacta o negócio?
- ⚠️ RISCOS: concentração de clientes, concorrência, migração para frango
- 💡 INOVAÇÃO: maturação, kits churrasco, venda direta, Instagram, assinatura mensal

Organize em: 📊 PANORAMA DE MERCADO (com dados reais), 💰 ANÁLISE DE MARGEM, 🏪 ESTRATÉGIA POR CANAL, 📱 PLANO DE MARKETING (ações práticas), 📅 TENDÊNCIAS E TIMING, ⚠️ RISCOS E OPORTUNIDADES`,

                ROBO_VENDAS: `Você é LUCAS, robô de vendas do FrigoGest — seu trabalho é manter o PIPELINE AQUECIDO e NENHUM CLIENTE ESQUECIDO.

METODOLOGIA DE VENDAS:
1. CLASSIFICAÇÃO DE CLIENTES (RFM):
   - R (Recência): quando foi a última compra?
     • <7 dias = ATIVO QUENTE 🟢
     • 7-30 dias = ATIVO 🟡
     • 31-60 dias = ESFRIANDO 🟠
     • 61-90 dias = INATIVO 🔴
     • 90+ dias = PERDIDO ⛔
   - F (Frequência): quantas compras no total?
     • 10+ = FIEL | 5-9 = REGULAR | 2-4 = OCASIONAL | 1 = ONE-TIME
   - M (Monetário): quanto gasta em média?
     • Top 20% = VIP | Meio 60% = REGULAR | Bottom 20% = PEQUENO

2. ESTRATÉGIAS POR SEGMENTO:
   - ATIVO QUENTE + FIEL: manter relacionamento, oferecer condições especiais
   - ESFRIANDO + REGULAR: ligar, perguntar se precisa, oferecer promoção
   - INATIVO + OCASIONAL: visitar pessoalmente, entender o que aconteceu
   - PERDIDO: última tentativa — desconto agressivo ou condição especial

3. SCRIPTS DE ABORDAGEM:
   - Reativação: "Oi [Nome], aqui é do FrigoGest. Faz tempo que não nos vemos! Temos [corte] fresquinho a preço especial..."
   - Follow-up: "Oi [Nome], como foi o último pedido? Tudo em ordem? Precisa de algo essa semana?"
   - Promoção: "Oi [Nome], esta semana temos promoção de [corte]: R$XX/kg. Quantidade limitada!"

4. MÉTRICAS DE VENDAS:
   - Taxa de recompra ideal: >60% dos clientes devem comprar todo mês
   - Ticket médio: acompanhar se está subindo ou caindo
   - Churn: se perder >20% dos clientes no mês, é emergência

Organize em: 📞 CLIENTES PARA LIGAR HOJE, 🏆 TOP COMPRADORES (VIPs), 🔴 REATIVAÇÕES URGENTES, 📊 MÉTRICAS, 💡 CAMPANHAS SUGERIDAS`,
            };

            const baseRules = `\nRegras gerais:\n- Responda SEMPRE em português brasileiro\n- Seja DIRETO, PRÁTICO e ACIONÁVEL — fale como gerente de frigorífico, não como robô\n- Use emojis: 🔴 crítico, 🟡 atenção, 🟢 ok\n- Cite NÚMEROS ESPECÍFICOS do snapshot — nunca invente dados\n- Se não tiver dados suficientes, diga claramente o que falta\n- Máximo 600 palavras\n- Termine SEMPRE com 3 ações concretas numeradas: "FAÇA AGORA: 1. ... 2. ... 3. ..."`;

            const fullPrompt = `${prompts[agentType]}${baseRules}\n\n${dataPackets[agentType]}`;
            const { text, provider } = await runCascade(fullPrompt);
            setAgentResponse(`_via ${provider}_\n\n${text}`);
            setTimeout(() => agentResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        } catch (err: any) {
            setAgentError(err.message || 'Erro ao consultar a IA.');
        } finally {
            setAgentLoading(false);
        }
    };

    // ═══ DONA CLARA — RELATÓRIO EXECUTIVO ORQUESTRADO ═══
    const runOrchestratedReport = async () => {
        setAgentLoading(true);
        setAgentError(null);
        setAgentResponse(null);
        setConsultingAgent('ADMINISTRATIVO');
        setSelectedAgent('ADMINISTRATIVO');
        setActiveTab('alerts');
        try {
            // Cascade será chamado após montar snapshot e prompt

            const validTx = transactions.filter(t => t.categoria !== 'ESTORNO');
            const totalEntradas = validTx.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
            const totalSaidas = validTx.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
            const vendasPagas = sales.filter(s => s.status_pagamento === 'PAGO');
            const vendasPendentes = sales.filter(s => s.status_pagamento === 'PENDENTE');
            const vendasEstornadas = sales.filter(s => s.status_pagamento === 'ESTORNADO');
            const payablesPendentes = payables.filter(p => p.status === 'PENDENTE' || p.status === 'PARCIAL');
            const payablesVencidos = payablesPendentes.filter(p => new Date(p.data_vencimento) < new Date());
            const estoqueDisp = stock.filter(s => s.status === 'DISPONIVEL');
            const now = new Date();

            // ═══ MEGA SNAPSHOT — ALL DATA FROM ALL SECTORS ═══
            const megaSnapshot = `
## 📋 RELATÓRIO EXECUTIVO ORQUESTRADO — FRIGOGEST
## Data: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}

═══════════════════════════════════════════════
🏦 SETOR FINANCEIRO (Dra. Beatriz)
═══════════════════════════════════════════════
Caixa: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Transações totais: ${transactions.length}
Vendas: ${vendasPagas.length} pagas (R$${vendasPagas.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)}) | ${vendasPendentes.length} pendentes (R$${vendasPendentes.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)}) | ${vendasEstornadas.length} estornadas
Contas a Pagar: ${payablesPendentes.length} pendentes (R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)}) | ${payablesVencidos.length} vencidas (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Vendas PAGAS sem Transaction ENTRADA: ${vendasPagas.filter(v => !transactions.some(t => t.referencia_id === v.id_venda && t.tipo === 'ENTRADA' && t.categoria !== 'ESTORNO')).length}

═══════════════════════════════════════════════
🥩 SETOR PRODUÇÃO (Seu Antônio)
═══════════════════════════════════════════════
Lotes total: ${batches.length} (${batches.filter(b => b.status === 'ABERTO').length} abertos, ${batches.filter(b => b.status === 'FECHADO').length} fechados)
Últimos lotes:
${batches.filter(b => b.status !== 'ESTORNADO').slice(-8).map(b => {
                const pecas = stock.filter(s => s.id_lote === b.id_lote);
                const pesoTotal = pecas.reduce((s, p) => s + p.peso_entrada, 0);
                const rend = b.peso_total_romaneio > 0 ? ((pesoTotal / b.peso_total_romaneio) * 100).toFixed(1) : 'N/A';
                return `- ${b.id_lote} | Forn: ${b.fornecedor} | Raça: ${(b as any).raca || 'N/I'} | Rom: ${b.peso_total_romaneio}kg | Real: ${pesoTotal.toFixed(1)}kg | Rend: ${rend}% | Custo: R$${b.custo_real_kg.toFixed(2)}/kg`;
            }).join('\n')}

═══════════════════════════════════════════════
📦 SETOR ESTOQUE (Joaquim)
═══════════════════════════════════════════════
Peças disponíveis: ${estoqueDisp.length} | Peso total: ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg
Peças >30 dias: ${estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 30).length}
Peças >60 dias: ${estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 60).length}
Giro médio: ${estoqueDisp.length > 0 ? (estoqueDisp.reduce((s, e) => s + Math.floor((now.getTime() - new Date(e.data_entrada).getTime()) / 86400000), 0) / estoqueDisp.length).toFixed(0) : '0'} dias

═══════════════════════════════════════════════
💰 SETOR COMERCIAL (Marcos)
═══════════════════════════════════════════════
Clientes: ${clients.length} total | ${clients.filter(c => c.saldo_devedor > 0).length} com saldo devedor
Vendas últimos 30 dias: ${sales.filter(s => Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / 86400000) < 30 && s.status_pagamento !== 'ESTORNADO').length}
Preço médio venda: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}/kg
Ticket médio: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}
Top devedores:
${vendasPendentes.slice(0, 5).map(v => `- ${v.nome_cliente || v.id_cliente}: R$${(v.peso_real_saida * v.preco_venda_kg).toFixed(2)} venc: ${v.data_vencimento}`).join('\n')}

═══════════════════════════════════════════════
🚛 SETOR COMPRAS (Roberto)
═══════════════════════════════════════════════
Fornecedores: ${suppliers.length} cadastrados
${suppliers.slice(0, 8).map(s => {
                const lotes = batches.filter(b => b.fornecedor === s.nome_fantasia && b.status !== 'ESTORNADO');
                const totalKg = lotes.reduce((sum, b) => sum + b.peso_total_romaneio, 0);
                const lotePecas = lotes.flatMap(b => stock.filter(st => st.id_lote === b.id_lote));
                const pesoReal = lotePecas.reduce((sum, p) => sum + p.peso_entrada, 0);
                const rendMedio = totalKg > 0 ? ((pesoReal / totalKg) * 100).toFixed(1) : 'N/A';
                return `- ${s.nome_fantasia} | ${lotes.length} lotes | ${totalKg.toFixed(0)}kg rom | Rend: ${rendMedio}% | PIX: ${s.dados_bancarios ? 'SIM' : 'NÃO'}`;
            }).join('\n')}
Custo médio/kg: R$${batches.length > 0 ? (batches.filter(b => b.status !== 'ESTORNADO').reduce((s, b) => s + b.custo_real_kg, 0) / batches.filter(b => b.status !== 'ESTORNADO').length).toFixed(2) : '0.00'}

═══════════════════════════════════════════════
📊 SETOR MERCADO (Ana)
═══════════════════════════════════════════════
Preço médio compra: R$${batches.length > 0 ? (batches.filter(b => b.status !== 'ESTORNADO').reduce((s, b) => s + b.custo_real_kg, 0) / batches.filter(b => b.status !== 'ESTORNADO').length).toFixed(2) : '0.00'}/kg
Preço médio venda: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}/kg
Margem bruta: ${vendasPagas.length > 0 && batches.length > 0 ? (((vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length) / (batches.filter(b => b.status !== 'ESTORNADO').reduce((s, b) => s + b.custo_real_kg, 0) / batches.filter(b => b.status !== 'ESTORNADO').length) - 1) * 100).toFixed(1) : 'N/A'}%
Mês atual: ${now.toLocaleDateString('pt-BR', { month: 'long' })} (${now.getMonth() >= 1 && now.getMonth() <= 5 ? 'SAFRA — preços tendendo a cair' : now.getMonth() >= 6 && now.getMonth() <= 10 ? 'ENTRESSAFRA — preços tendendo a subir' : 'PICO FESTAS — demanda alta'})
Região: Vitória da Conquista - BA (Sudoeste Baiano)

═══════════════════════════════════════════════
🤖 SETOR VENDAS/CRM (Lucas)
═══════════════════════════════════════════════
Clientes ativos (compra <30d): ${clients.filter(c => sales.some(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO' && Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / 86400000) < 30)).length}
Clientes esfriando (30-60d): ${clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; if (!ls) return false; const d = Math.floor((now.getTime() - new Date(ls.data_venda).getTime()) / 86400000); return d >= 30 && d <= 60; }).length}
Clientes inativos (>60d): ${clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; return ls && Math.floor((now.getTime() - new Date(ls.data_venda).getTime()) / 86400000) > 60; }).length}
Pedidos abertos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length}

═══════════════════════════════════════════════
⚠️ TODOS OS ALERTAS ATIVOS (${liveAlerts.length})
═══════════════════════════════════════════════
${liveAlerts.slice(0, 15).map(a => `- [${a.severity}] ${a.agent}: ${a.title} — ${a.message}`).join('\n')}
`.trim();

            const orchestrationPrompt = `Você é DONA CLARA, administradora-geral do FrigoGest.
Você acabou de receber os RELATÓRIOS DE TODOS OS 7 SETORES do seu frigorífico.
Analise como uma CHEFE que consulta cada gerente e monta um relatório para o dono.

SUA MISSÃO: Montar um RELATÓRIO EXECUTIVO unificado, cruzando dados entre setores.

ESTRUTURA OBRIGATÓRIA:

🏢 RESUMO EXECUTIVO (2-3 linhas com a saúde geral do negócio)

🔴 EMERGÊNCIAS (o que precisa ser resolvido nas próximas 24 horas)
- Liste ações urgentes de QUALQUER setor

📊 PAINEL POR SETOR:
1. 🥩 PRODUÇÃO (Seu Antônio reporta): rendimento, problemas
2. 📦 ESTOQUE (Joaquim reporta): câmara fria, peças em risco
3. 💰 COMERCIAL (Marcos reporta): vendas, cobranças
4. 🔍 AUDITORIA (Dra. Beatriz reporta): furos, divergências
5. 🚛 COMPRAS (Roberto reporta): fornecedores, custos
6. 📊 MERCADO (Ana reporta): preços, margem, timing
7. 🤖 CRM (Lucas reporta): clientes, reativações

🔗 ANÁLISE CRUZADA (sua expertise — o que NENHUM gerente vê sozinho):
- Correlações entre setores (ex: rendimento baixo + fornecedor caro = trocar)
- Riscos sistêmicos (ex: estoque parado + clientes sumindo = problema de preço)
- Oportunidades escondidas (ex: margem boa + clientes inativos = promoção)

📋 PLANO DE AÇÃO (próximas 48 horas):
Numere de 1 a 5 as ações mais importantes, com responsável (nome do agente).

Regras:
- Português brasileiro, direto e prático
- Cite números específicos do relatório
- Se algum setor está saudável, diga "✅ OK" e não gaste mais de 1 linha
- Foque nos problemas e oportunidades
- Máximo 800 palavras`;

            const fullPrompt = `${orchestrationPrompt}\n\n${megaSnapshot}`;
            const { text, provider } = await runCascade(fullPrompt);
            setAgentResponse(`_📋 Relatório Executivo via ${provider}_\n\n${text}`);
            setTimeout(() => agentResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        } catch (err: any) {
            setAgentError(err.message || 'Erro ao gerar relatório.');
        } finally {
            setAgentLoading(false);
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
                <nav className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                    {[
                        { id: 'overview' as const, icon: Activity, label: 'Visão Geral' },
                        { id: 'alerts' as const, icon: Bell, label: `Alertas (${liveAlerts.length})` },
                        { id: 'config' as const, icon: Settings, label: 'Config' },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
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

                        {/* AGENT CARDS WITH CONSULT BUTTONS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {agents.map(agent => {
                                const stats = agentStats[agent.id];
                                const colors = colorMap[agent.color];
                                const isThisLoading = agentLoading && consultingAgent === agent.id;
                                return (
                                    <div key={agent.id} className={`premium-card p-6 bg-white group hover:${colors.border} transition-all hover:shadow-xl ${colors.glow}`}>
                                        <button
                                            onClick={() => { setSelectedAgent(agent.id); setActiveTab('alerts'); }}
                                            className="w-full text-left"
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
                                        </button>
                                        <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); runAgentConsult(agent.id); setActiveTab('alerts'); setSelectedAgent(agent.id); }}
                                                disabled={agentLoading}
                                                className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isThisLoading ? 'bg-purple-100 text-purple-600' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200/30'}`}
                                            >
                                                {isThisLoading ? (
                                                    <><Loader2 size={14} className="animate-spin" /> Analisando...</>
                                                ) : (
                                                    <><Sparkles size={14} /> Consultar IA</>
                                                )}
                                            </button>
                                            {agent.id === 'ADMINISTRATIVO' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); runOrchestratedReport(); }}
                                                    disabled={agentLoading}
                                                    className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isThisLoading ? 'bg-amber-100 text-amber-700' : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-200/30'}`}
                                                >
                                                    {isThisLoading ? (
                                                        <><Loader2 size={14} className="animate-spin" /> Orquestrando 7 agentes...</>
                                                    ) : (
                                                        <><Brain size={14} /> 📋 Relatório Executivo</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
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

                        {/* ═══ GEMINI AGENT BUTTON (CONTEXT-AWARE) ═══ */}
                        <div className="mt-8">
                            <button
                                onClick={() => runAgentConsult(selectedAgent || 'ADMINISTRATIVO')}
                                disabled={agentLoading}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-5 px-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-purple-200/50 transition-all disabled:opacity-50"
                            >
                                {agentLoading ? (
                                    <><Loader2 size={18} className="animate-spin" /> Analisando com Gemini...</>
                                ) : (
                                    <><Sparkles size={18} /> Consultar {selectedAgent ? agents.find(a => a.id === selectedAgent)?.name : 'Agente IA'}</>
                                )}
                            </button>
                            {agentError && (
                                <div className="mt-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-bold">
                                    ⚠️ {agentError}
                                </div>
                            )}
                            {agentResponse && (
                                <div ref={agentResultRef} className="mt-6 bg-slate-900 rounded-3xl p-8 shadow-2xl animate-reveal">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="bg-purple-500/20 p-2 rounded-xl">
                                            <Sparkles size={20} className="text-purple-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-widest">
                                                {consultingAgent ? `${agents.find(a => a.id === consultingAgent)?.icon} Parecer: ${agents.find(a => a.id === consultingAgent)?.name}` : 'Parecer IA'}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-bold">Gemini 2.0 Flash · Análise em tempo real</p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                                        {agentResponse}
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                                        <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                                            {new Date().toLocaleString('pt-BR')}
                                        </span>
                                        <button onClick={() => runAgentConsult(consultingAgent || 'ADMINISTRATIVO')} className="text-[10px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300 flex items-center gap-1">
                                            <Zap size={12} /> Atualizar
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
