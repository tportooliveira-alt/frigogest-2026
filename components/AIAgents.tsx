import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Brain, Shield, TrendingUp, BarChart3,
    Bell, CheckCircle, AlertTriangle, XCircle, Eye,
    ChevronRight, Activity, Zap, Settings,
    Clock, Package, Users, DollarSign, Truck,
    Calendar, MessageCircle, ShieldCheck, Beef, Bot,
    Loader2, Send, Sparklesok
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { fetchAllNews, formatNewsForAgent, NewsItem } from '../services/newsService';

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
                    model: 'gemini-1.5-flash',
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
        description: 'Administradora-Geral — Pós-graduada em Gestão Empresarial pela FGV-SP e MBA Executivo pela INSPER. Enxerga TUDO: DRE, EBITDA, Ciclo de Caixa, Capital de Giro. Cérebro central do frigorífico com visão de 10 módulos.',
        icon: '🧠',
        color: 'blue',
        enabled: true,
        systemPrompt: 'Você é Dona Clara, administradora-geral do FrigoGest. Formada em Administração pela FGV-SP, MBA INSPER. Cérebro central com visão total de 10 módulos. Usa DRE, EBITDA e Ciclo de Caixa.',
        modules: ['LOTES', 'ESTOQUE', 'CLIENTES', 'VENDAS', 'PEDIDOS', 'FORNECEDORES', 'FINANCEIRO', 'CADEIA_ABATE', 'ROBO_VENDAS', 'AUDITORIA'],
        triggerCount: 19,
    },
    {
        id: 'PRODUCAO',
        name: 'Seu Antônio',
        description: 'Chefe de Produção — Formado em Zootecnia pela ESALQ/USP, certificado EMBRAPA em Tecnologia de Carcaças e Cortes Bovinos. 30 anos de experiência. Domina rendimento por raça, tabela EMBRAPA, análise de toalete e scorecard de fornecedores.',
        icon: '🥩',
        color: 'emerald',
        enabled: true,
        systemPrompt: 'Você é Seu Antônio, chefe de produção do FrigoGest. Zootecnia ESALQ/USP, certificado EMBRAPA. 30 anos de experiência. Especialista em rendimento de carcaça por raça (tabela completa), quebra de resfriamento e análise comparativa de fornecedores.',
        modules: ['LOTES', 'ESTOQUE', 'FORNECEDORES'],
        triggerCount: 6,
    },
    {
        id: 'COMERCIAL',
        name: 'Marcos',
        description: 'Diretor Comercial — Formado em Administração com ênfase em Marketing pela ESPM-SP, pós em Gestão Comercial pela FGV. Especialista em precificação psicológica, markup por corte, análise RFM (Recência-Frequência-Monetário) e cobrança consultiva B2B.',
        icon: '💰',
        color: 'amber',
        enabled: true,
        systemPrompt: 'Você é Marcos, diretor comercial do FrigoGest. Formado ESPM-SP, pós FGV. Expert em análise RFM, markup por corte (traseiro 89% mais caro que dianteiro), precificação psicológica e cobrança consultiva B2B.',
        modules: ['VENDAS', 'CLIENTES'],
        triggerCount: 4,
    },
    {
        id: 'AUDITOR',
        name: 'Dra. Beatriz',
        description: 'Auditora Financeira — CRC ativo, graduada em Ciências Contábeis pela USP (FEA), Pós em Auditoria e Perícia pela FIPECAFI. Domina DRE, Balanço Patrimonial, NCMs de carnes, regime tributário (Simples/Lucro Presumido). Implacável com estornos.',
        icon: '🔍',
        color: 'rose',
        enabled: true,
        systemPrompt: 'Você é Dra. Beatriz, auditora financeira do FrigoGest. Contabilidade USP/FEA, pós FIPECAFI, CRC ativo. Regra de ouro: cada venda paga deve ter Transaction ENTRADA. Domina DRE, Balanço Patrimonial e regime tributário de frigoríficos.',
        modules: ['FINANCEIRO', 'VENDAS', 'LOTES'],
        triggerCount: 5,
    },
    {
        id: 'ESTOQUE',
        name: 'Joaquim',
        description: 'Estoquista-Chefe — Técnico em Logística pelo SENAI, certificado em Gestão de Cadeia do Frio pela UNICAMP/FEA. Domina FIFO/PEPS, Curva ABC, controle de temperatura HACCP, cálculo de drip loss (0,3-0,5%/dia) e giro de estoque por categoria.',
        icon: '📦',
        color: 'cyan',
        enabled: true,
        systemPrompt: 'Você é Joaquim, estoquista-chefe do FrigoGest. Técnico SENAI, certificado UNICAMP em Cadeia do Frio. FIFO é lei. Domina Curva ABC, drip loss (0,4%/dia), e analisa estoque por categoria (Inteiro/Dianteiro/Traseiro).',
        modules: ['ESTOQUE', 'LOTES'],
        triggerCount: 4,
    },
    {
        id: 'COMPRAS',
        name: 'Roberto',
        description: 'Comprador Sênior — Graduado em Engenharia de Produção pela UNESP Bauru, MBA em Supply Chain pela FGV. Especialista em TCO (Total Cost of Ownership), scorecard A/B/C de fornecedores, análise de rendimento por genética e negociação com pecuaristas.',
        icon: '🚛',
        color: 'orange',
        enabled: true,
        systemPrompt: 'Você é Roberto, comprador sênior do FrigoGest. Eng. Produção UNESP, MBA Supply Chain FGV. Foco em TCO (custo total incluindo frete, mortalidade, rendimento), scorecard A/B/C e negociação com pecuaristas.',
        modules: ['FORNECEDORES', 'LOTES', 'FINANCEIRO'],
        triggerCount: 4,
    },
    {
        id: 'MERCADO',
        name: 'Ana',
        description: 'Analista de Inteligência de Mercado — Economista pela UNICAMP, Pós em Agronegócio pela ESALQ/USP. 20 anos no setor de carnes. Domina CEPEA, cotação B3, Rabobank Outlook, índice Esalq/BM&F, sazonalidade e macroeconomia do boi.',
        icon: '📊',
        color: 'violet',
        enabled: true,
        systemPrompt: 'Você é Ana, analista de inteligência de mercado do FrigoGest. Economia UNICAMP, pós ESALQ/USP. 20 anos no setor. Expert em CEPEA, B3, Rabobank, sazonalidade e macroeconomia do boi. Use googleSearch para buscar cotações atuais.',
        modules: ['MERCADO', 'LOTES', 'VENDAS', 'CLIENTES'],
        triggerCount: 3,
    },
    {
        id: 'ROBO_VENDAS',
        name: 'Lucas',
        description: 'Robô de Vendas — Certificado em Growth Hacking pela PUC-RS (PUCPR Online), treinado em Inbound Sales pela RD Station University. Domina análise RFM, pipeline management, gatilhos de recompra e scripts de reativação de clientes inativos.',
        icon: '🤖',
        color: 'teal',
        enabled: true,
        systemPrompt: 'Você é Lucas, robô de vendas do FrigoGest. Certificado Growth PUC-RS, treinado RD Station. Foco em análise RFM, reativação de inativos (>30d e >60d), prospecção e pipeline. Gera scripts de WhatsApp prontos para copiar e enviar.',
        modules: ['CLIENTES', 'VENDAS', 'PEDIDOS'],
        triggerCount: 4,
    },
    {
        id: 'MARKETING',
        name: 'Isabela',
        description: 'Diretora de Marketing e Growth — Publicidade/Propaganda pela ESPM-SP, Pós em Marketing Digital pela FGV, Certificada Meta Blueprint (Ads Manager). Domina tráfego pago B2B, funil de WhatsApp, Instagram profissional, gestão de mimos/gifting e branding para o setor de carnes.',
        icon: '🎯',
        color: 'fuchsia',
        enabled: true,
        systemPrompt: 'Você é Isabela, diretora de marketing e growth do FrigoGest. Publicidade ESPM-SP, pós FGV Marketing Digital, certificada Meta Blueprint. Expert em campanhas B2B para açougues/restaurantes, Instagram, Meta Ads geolocalizado (50km), funil de WhatsApp e gestão de mimos/gifting.',
        modules: ['CLIENTES', 'VENDAS', 'LOTES', 'ESTOQUE'],
        triggerCount: 4,
    },
    {
        id: 'SATISFACAO',
        name: 'Camila',
        description: 'Diretora de Customer Success e Qualidade Pós-Venda — Graduada em Engenharia de Alimentos pela UNICAMP, Pós em Gestão da Qualidade pela USP. 30 anos de experiência na cadeia da carne. Certificada HACCP/APPCC. Domina NPS, CSAT, CES, protocolos USDA/FSIS e pesquisa pós-venda via WhatsApp.',
        icon: '🤝',
        color: 'rose',
        enabled: true,
        systemPrompt: 'Você é Camila, diretora de CS e qualidade do FrigoGest. Eng. Alimentos UNICAMP, pós USP, HACCP certificada. 30 anos na cadeia da carne. Domina NPS/CSAT/CES, protocolos USDA, pesquisa pós-venda via WhatsApp. Ouve clientes e reverte insatisfação com conhecimento técnico profundo.',
        modules: ['CLIENTES', 'VENDAS'],
        triggerCount: 2,
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

    // ═══ AUTOMAÇÃO — ESTADO POR AGENTE ═══
    const [agentDiagnostics, setAgentDiagnostics] = useState<Record<string, { text: string; provider: string; timestamp: Date }>>({});
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; currentAgent: string }>({ current: 0, total: 0, currentAgent: '' });
    const [autoRunDone, setAutoRunDone] = useState(false);
    const [expandedDiagnostic, setExpandedDiagnostic] = useState<string | null>(null);
    const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
    const [newsLoading, setNewsLoading] = useState(false);

    // ═══ BUSCAR NOTÍCIAS DO MERCADO ═══
    useEffect(() => {
        const loadNews = async () => {
            setNewsLoading(true);
            try {
                const news = await fetchAllNews();
                setMarketNews(news);
            } catch { /* silencioso */ }
            setNewsLoading(false);
        };
        loadNews();
    }, []);

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

        // ── ISABELA (MARKETING): Oportunidades de Campanha e Mimos ──
        // 1. Promoção Urgente (Estoque Encalhado)
        const traseirosAntigos = stock.filter(s => s.status === 'DISPONIVEL' && s.tipo === 3 && Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 7);
        if (traseirosAntigos.length > 0) {
            alerts.push({
                id: `MKT-ESTOQUE-TRASEIROS`, agent: 'MARKETING', severity: 'ALERTA',
                module: 'ESTOQUE', title: `Campanha Traseiro Urgente`,
                message: `Temos ${traseirosAntigos.length} traseiros no frio há mais de 7 dias. Crie uma campanha no Instagram focada em churrascarias para rodar HOJE.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }
        
        const dianteirosAntigos = stock.filter(s => s.status === 'DISPONIVEL' && s.tipo === 2 && Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 7);
        if (dianteirosAntigos.length > 0) {
            alerts.push({
                id: `MKT-ESTOQUE-DIANTEIROS`, agent: 'MARKETING', severity: 'ALERTA',
                module: 'ESTOQUE', title: `Campanha Dianteiro Urgente`,
                message: `Temos ${dianteirosAntigos.length} dianteiros no frio há mais de 7 dias. Dispare WhatsApp para redes varejistas e restaurantes populares.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }

        // 2. Mimos VIP e Oportunidades de Conteúdo
        clients.forEach(c => {
            const clienteSales = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO');
            const kgTotal = clienteSales.reduce((sum, s) => sum + s.peso_real_saida, 0);
            if (kgTotal >= 1000) { // Cliente VIP
                const lastSale = clienteSales.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                if (lastSale) {
                    const dias = Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / 86400000);
                    if (dias > 30) {
                        alerts.push({
                            id: `MKT-VIP-FRIO-${c.id_ferro}`, agent: 'MARKETING', severity: 'CRITICO',
                            module: 'CLIENTES', title: `VIP Esfriando: ${c.nome_social}`,
                            message: `Cliente > 1 TON sem comprar há ${dias} dias. Enviar MIMO premium (por ex. avental exclusivo FrigoGest) e acionar visita comercial.`,
                            timestamp: now.toISOString(), status: 'NOVO'
                        });
                    }
                }
            }
        });

        // 3. Fornecedores VIP e Branding
        suppliers.forEach(s => {
            const lotesFornecedor = batches.filter(b => b.fornecedor === s.nome_fantasia);
            if (lotesFornecedor.length >= 3) {
                const bomRendimento = lotesFornecedor.some(b => {
                    const pecas = stock.filter(st => st.id_lote === b.id_lote);
                    const rend = b.peso_total_romaneio > 0 ? (pecas.reduce((sum,p)=>sum+p.peso_entrada,0)/b.peso_total_romaneio)*100 : 0;
                    return rend >= 53;
                });
                if (bomRendimento) {
                    alerts.push({
                        id: `MKT-FORN-MIMO-${s.id || s.nome_fantasia}`, agent: 'MARKETING', severity: 'INFO',
                        module: 'FORNECEDORES', title: `Reconhecimento: Parceiro ${s.nome_fantasia}`,
                        message: `Excelente histórico de rendimento (>53%). Estratégia: Enviar "Diploma de Parceiro Ouro" no WhatsApp para fidelizar o pecuarista.`,
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
            MARKETING: { total: 0, criticos: 0, bloqueios: 0 },
            SATISFACAO: { total: 0, criticos: 0, bloqueios: 0 },
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
            const totalEntradas = validTx.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
            const totalSaidas = validTx.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
            const vendasPagas = sales.filter(s => s.status_pagamento === 'PAGO');
            const vendasPendentes = sales.filter(s => s.status_pagamento === 'PENDENTE');
            const vendasEstornadas = sales.filter(s => s.status_pagamento === 'ESTORNADO');
            const payablesPendentes = payables.filter(p => p.status === 'PENDENTE' || p.status === 'PARCIAL');
            const payablesVencidos = payablesPendentes.filter(p => new Date(p.data_vencimento) < new Date());

            // GAP 4: Projeção 7 dias
            const pAgendados = payablesPendentes.filter(p => new Date(p.data_vencimento) >= new Date() && new Date(p.data_vencimento) <= new Date(Date.now() + 7 * 86400000));
            const aPagar7d = pAgendados.reduce((s, p) => s + (p.valor - (p.valor_pago || 0)), 0);
            const vFuturas = vendasPendentes.filter(v => new Date(v.data_vencimento) >= new Date() && new Date(v.data_vencimento) <= new Date(Date.now() + 7 * 86400000));
            const aReceber7d = vFuturas.reduce((s, v) => s + ((v.peso_real_saida * v.preco_venda_kg) - ((v as any).valor_pago || 0)), 0);

            const estoqueDisp = stock.filter(s => s.status === 'DISPONIVEL');
            const agentAlerts = liveAlerts.filter(a => a.agent === agentType);

            // ═══ DATA PACKETS PER AGENT ═══
            const dataPackets: Record<AgentType, string> = {
                ADMINISTRATIVO: `
## SNAPSHOT GERAL — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Caixa: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Projeção 7 Dias: A Receber R$${aReceber7d.toFixed(2)} | A Pagar R$${aPagar7d.toFixed(2)}
Vendas: ${vendasPagas.length} pagas, ${vendasPendentes.length} pendentes, ${vendasEstornadas.length} estornadas
Contas a Pagar: ${payablesPendentes.length} pendentes (R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)}), ${payablesVencidos.length} vencidas
Estoque: ${estoqueDisp.length} peças, ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg (Sendo: ${estoqueDisp.filter(s => s.tipo === 1).length} Inteiras, ${estoqueDisp.filter(s => s.tipo === 2).length} Diant., ${estoqueDisp.filter(s => s.tipo === 3).length} Tras.)
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
                    return `- Lote ${b.id_lote} | Forn: ${b.fornecedor} | Raça: ${(b as any).raca || 'N/I'} | Cab: ${(b as any).qtd_cabecas || 'N/I'} | Mortos: ${(b as any).qtd_mortos || 0} | Romaneio: ${b.peso_total_romaneio}kg | Pesado: ${pesoTotal.toFixed(1)}kg | Rend: ${rend}% | Toalete: ${(b as any).toalete_kg || 'N/I'}kg | Peças: ${pecas.length}`;
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
Caixa Atual: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Projeção 7 dias: A Receber R$${aReceber7d.toFixed(2)} | A Pagar R$${aPagar7d.toFixed(2)} | Saldo Projetado R$${(aReceber7d - aPagar7d).toFixed(2)}
Transações: ${transactions.length} total
Vendas PAGAS sem Transaction ENTRADA: ${vendasPagas.filter(v => !transactions.some(t => t.referencia_id === v.id_venda && t.tipo === 'ENTRADA' && t.categoria !== 'ESTORNO')).length}
Lotes sem saída financeira: ${batches.filter(b => b.status !== 'ESTORNADO' && !payables.some(p => p.id_lote === b.id_lote) && !transactions.some(t => t.referencia_id === b.id_lote && t.tipo === 'SAIDA')).length}
Contas vencidas: ${payablesVencidos.length} (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Estornos: ${vendasEstornadas.length} vendas, ${transactions.filter(t => t.categoria === 'ESTORNO').length} transações
Alertas Auditor: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                ESTOQUE: `
## SNAPSHOT ESTOQUE — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
TOTAL: ${estoqueDisp.length} pecas | ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg

POR CATEGORIA:
- INTEIRO: ${estoqueDisp.filter(s => s.tipo === 1).length} pecas | ${estoqueDisp.filter(s => s.tipo === 1).reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg
- DIANTEIRO (Banda A): ${estoqueDisp.filter(s => s.tipo === 2).length} pecas | ${estoqueDisp.filter(s => s.tipo === 2).reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg
- TRASEIRO (Banda B): ${estoqueDisp.filter(s => s.tipo === 3).length} pecas | ${estoqueDisp.filter(s => s.tipo === 3).reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg

PECAS CRITICAS (>5 dias na camara — perdendo peso):
- Inteiros antigos (>5d): ${estoqueDisp.filter(s => s.tipo === 1 && Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 5).length} pecas
- Dianteiros antigos (>5d): ${estoqueDisp.filter(s => s.tipo === 2 && Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 5).length} pecas
- Traseiros antigos (>5d): ${estoqueDisp.filter(s => s.tipo === 3 && Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 5).length} pecas

PERDA POR EVAPORACAO: ~${(estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0) * 0.004).toFixed(1)}kg/dia (0,4% do peso total)

DETALHAMENTO (15 primeiras):
${estoqueDisp.slice(0, 15).map(s => {
                    const dias = Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000);
                    const tipoNome = s.tipo === 1 ? 'INT' : s.tipo === 2 ? 'DIA' : 'TRA';
                    return '- ' + s.id_completo + ' | ' + tipoNome + ' | ' + s.peso_entrada + 'kg | ' + dias + 'd | Lote: ' + s.id_lote + (dias > 5 ? ' ATENCAO' : '');
                }).join('\n')}
Alertas Estoque: ${agentAlerts.length}
${agentAlerts.map(a => '- [' + a.severity + '] ' + a.title + ': ' + a.message).join('\n')}`.trim(),

                COMPRAS: `
## SNAPSHOT COMPRAS — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Fornecedores: ${suppliers.length} cadastrados
${suppliers.slice(0, 10).map(s => {
                    const lotes = batches.filter(b => b.fornecedor === s.nome_fantasia);
                    const totalKg = lotes.reduce((sum, b) => sum + b.peso_total_romaneio, 0);
                    const totalR = lotes.reduce((sum, b) => sum + b.valor_compra_total, 0);
                    const mortos = lotes.reduce((sum, b) => sum + ((b as any).qtd_mortos || 0), 0);
                    const rends = lotes.filter(b => b.rendimento_real && b.rendimento_real > 0);
                    const avgRend = rends.length > 0 ? (rends.reduce((sum, b) => sum + (b.rendimento_real || 0), 0) / rends.length).toFixed(1) + '%' : 'N/A';
                    const score = avgRend !== 'N/A' && parseFloat(avgRend) > 52 && mortos === 0 ? 'A (Excelente)' : (avgRend !== 'N/A' && parseFloat(avgRend) > 49 ? 'B (Bom)' : 'C (Atenção)');
                    return `- ${s.nome_fantasia} | Score: ${score} | Raça: ${s.raca_predominante || 'N/I'} | ${lotes.length} lotes | Mortos: ${mortos} | Rend Médio: ${avgRend} | ${totalKg.toFixed(0)}kg | R$${totalR.toFixed(2)}`;
                }).join('\n')}
Contas a Pagar: ${payablesPendentes.length} (R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Vencidas: ${payablesVencidos.length} (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Custo médio/kg: R$${batches.length > 0 ? (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length).toFixed(2) : '0.00'}
Alertas Compras: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                MERCADO: `
## SNAPSHOT MERCADO — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Preço médio compra/kg: R$${batches.length > 0 ? (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length).toFixed(2) : '0.00'}
Preço médio venda/kg: R$${sales.length > 0 ? (sales.reduce((s, v) => s + v.preco_venda_kg, 0) / sales.length).toFixed(2) : '0.00'}
Margem bruta estimada: ${sales.length > 0 && batches.length > 0 ? (((sales.reduce((s, v) => s + v.preco_venda_kg, 0) / sales.length) / (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length) - 1) * 100).toFixed(1) : 'N/A'}%
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
${clients.sort((a, b) => { const va = sales.filter(s => s.id_cliente === a.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); const vb = sales.filter(s => s.id_cliente === b.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); return vb - va; }).slice(0, 8).map(c => { const cv = sales.filter(s => s.id_cliente === c.id_ferro); const kg = cv.reduce((s, v) => s + v.peso_real_saida, 0); const pag = cv.length > 0 ? cv[cv.length - 1].forma_pagamento : 'N/I'; return `- ${c.nome_social}: ${cv.length} compras, ${kg.toFixed(1)}kg | Pagamento ref: ${pag}`; }).join('\n')}
Pedidos abertos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length}
Alertas Robô: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                MARKETING: `
## SNAPSHOT MARKETING & CRM — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Status Geral: Máquina de Vendas Ativa
Clientes Ativos Totais: ${clients.filter(c => c.status !== 'INATIVO').length}
Volume VENDIDO (Últimos 30 Dias): R$${sales.filter(s => s.status_pagamento !== 'ESTORNADO' && Math.floor((new Date().getTime() - new Date(s.data_venda).getTime()) / 86400000) <= 30).reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0).toFixed(2)}
Top Clientes Recentes (Alvos para Upsell/Cross-sell):
${clients.sort((a, b) => { const va = sales.filter(s => s.id_cliente === a.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); const vb = sales.filter(s => s.id_cliente === b.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); return vb - va; }).slice(0, 5).map(c => `- ${c.nome_social} (${c.bairro || 'S/Bairro'}) | Volume Histórico: ${sales.filter(s => s.id_cliente === c.id_ferro).reduce((sum, s) => sum + s.peso_real_saida, 0).toFixed(0)}kg | Preferência de Compra: ${c.perfil_compra || 'N/I'}`).join('\n')}
Gatilhos de Estoque Crítico (Oportunidades de Escassez):
${estoqueDisp.filter(s => Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 4).slice(0, 5).map(s => `- Lote ${s.id_lote}: ${s.tipo === 1 ? 'Inteiro' : s.tipo === 2 ? 'Dianteiro' : 'Traseiro'} (${s.peso_entrada.toFixed(1)}kg) - Risco de perda, prioridade promocional!`).join('\n')}
Gatilhos de Fornecedores VIP (Gifting/Employer Branding):
${suppliers.slice(0, 3).map(f => `- ${f.nome_fantasia} (Região: ${f.regiao || 'N/A'}) - Investir em relacionamento B2B`).join('\n')}
Alertas Específicos do Marketing: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}
`.trim(),

                SATISFACAO: `
## SNAPSHOT CUSTOMER SUCCESS & QUALIDADE — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
Entregas Restes (Últimas 5 Vendas):
${sales.filter(s => s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime()).slice(0, 5).map(s => `- Cliente: ${clients.find(c => c.id_ferro === s.id_cliente)?.nome_social || s.id_cliente} | Peso Entregue: ${s.peso_real_saida}kg | Data: ${s.data_venda}`).join('\n')}
Perfil dos Clientes Recentes (Objeções/Gordura):
${clients.filter(c => sales.some(s => s.id_cliente === c.id_ferro)).slice(0, 5).map(c => `- ${c.nome_social} | Prefere: ${c.perfil_compra || 'N/A'} | Gordura: ${c.padrao_gordura || 'N/A'} | Objeções Antigas: ${c.objecoes_frequentes || 'Nenhuma'}`).join('\n')}
`.trim(),
            };

            // ═══ PROMPTS PER AGENT ═══
            const prompts: Record<AgentType, string> = {
                ADMINISTRATIVO: `Você é DONA CLARA, administradora-geral do FrigoGest — o CÉREBRO CENTRAL do frigorífico.
Formação: Administração FGV-SP, MBA Executivo INSPER, cursos SEBRAE em Gestão Financeira para Agronegócio.
Referências: "Contabilidade de Custos" (Eliseu Martins/FIPECAFI), "Finanças Corporativas e Valor" (Alexandre Assaf Neto), "Princípios de Administração Financeira" (Lawrence Gitman).

Você lidera 10 agentes: Seu Antônio (Produção/ESALQ), Marcos (Comercial/ESPM), Dra. Beatriz (Auditoria/USP-FEA), Joaquim (Estoque/SENAI-UNICAMP), Roberto (Compras/UNESP-FGV), Ana (Mercado/UNICAMP-ESALQ), Lucas (Vendas/PUC-RS), Isabela (Marketing/ESPM-FGV), Camila (CS/UNICAMP-USP).

═══ SUA EXPERTISE FINANCEIRA ═══
- DRE: Receita Bruta → Deduções → Receita Líquida → CMV → Lucro Bruto → Despesas → EBITDA → Lucro Líquido
- CICLO DE CAIXA: PMP (Prazo Médio Pagamento a fornecedor) vs PMR (Prazo Médio Recebimento de cliente). Se PMR > PMP = precisa capital de giro!
- CAPITAL DE GIRO: Quanto dinheiro precisa girar para o frigorífico funcionar. Cálculo = Ativo Circulante - Passivo Circulante
- FLUXO DE CAIXA: Projeção 7/15/30 dias cruzando vendas a prazo × contas a pagar
- EBITDA: Lucro antes de Juros, Impostos, Depreciação e Amortização — indicador real de geração de caixa

═══ ANÁLISE CRUZADA (sua vantagem exclusiva) ═══
- Estoque parado >5 dias + vendas baixas = Marcos precisa fazer promoção OU Isabela precisa de campanha urgente
- Fornecedor com rendimento <48% + dívida vencida = Roberto negocia desconto ou Dona Clara corta relação
- Cliente devedor >R$5.000 + comprando há >6 meses = renegociar prazo, NUNCA bloquear parceiro antigo
- Margem bruta <15% em algum corte = Marcos precisa ajustar preço ou Roberto precisa trocar fornecedor
- NPS <6 de algum cliente VIP = Camila investiga e Dona Clara liga pessoalmente
- Estoque Traseiro alto + Dianteiro zerado = Isabela faz campanha de churrasco premium

═══ PSICOLOGIA DE GESTÃO ═══
- Frigorífico pequeno = família. Cada decisão afeta pessoas reais. Pense no açougueiro que depende da entrega.
- Margem mínima saudável para açougue: 22-30% (fonte SEBRAE). Se vender abaixo disso, o CLIENTE quebra.
- Ganha-ganha: se o fornecedor não ganha, para de mandar boi bom. Se o açougueiro não ganha, para de comprar.

Organize em: 📋 DIAGNÓSTICO EXECUTIVO, 🔥 AÇÕES URGENTES (próximas 24h), 📅 PLANEJAMENTO SEMANAL, 💡 OPORTUNIDADES DE CRESCIMENTO`,

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

EXPERTISE COMERCIAL (FORMAÇÃO ESPM-SP + PÓS FGV):
Referências: "Vendas B2B" (Renato Romeo), "Marketing 4.0" (Kotler), "Gestão de Marcas B2B" (Kotler/Pfoertsch), "The Psychology of Selling" (Brian Tracy).

- TABELA DE PREÇOS ATACADO (Ref. ICMS SP 2025):
  • Dianteiro boi: R$ 8,00/kg base
  • Traseiro boi: R$ 11,70/kg (+46% vs dianteiro)
  • Acém: R$ 11,65/kg
  • Alcatra completa: R$ 24,00/kg (+200% vs dianteiro)
  • Picanha Tipo A: R$ 32,00/kg (+300% vs dianteiro)
- POLÍTICA DE PREÇO: custo_real_kg × 1.3 (30% margem mínima). Abaixo = venda no prejuízo.
- CRÉDITO: acima de R$5.000 devedor = só à vista. Prazo padrão 7-21-28d. Acima de 30d = garantia.
- DESCONTO: máximo 5% para volume >200kg. Acima = autorização Dona Clara.

COTAÇÃO BOI GORDO ATUALIZADA (CEPEA/ESALQ Fev/2026):
- Indicador Nacional: R$ 350,10/@ (alta >5% no mês)
- BA Sul: R$ 311,50 à vista | BA Oeste: R$ 316,50 à vista
- TENDÊNCIA: Preços subindo por retenção de fêmeas. 2026 será mais caro.

═══ PSICOLOGIA DE VENDAS B2B (O SER HUMANO POR TRÁS DO AÇOUGUE) ═══
- O dono do açougue ACORDA 4h da manhã, trabalha 14h por dia, tem medo de FALIR.
- Ele não quer "o melhor boi". Ele quer PREVISIBILIDADE: mesmo peso, mesma qualidade, toda semana.
- Confiança se constrói em MESES, se perde em 1 ENTREGA ruim. Consistência > preço baixo.
- Gatilho de ESCASSEZ funciona: "Sobrou só 3 traseiros do lote Angus de hoje."
- Gatilho de PROVA SOCIAL funciona: "O Restaurante X já comprou 200kg essa semana."
- NUNCA pressione. O açougueiro FOGE de vendedor agressivo. Seja consultor, não cobrador.
- Margem saudável para o açougueiro: 22-30% (SEBRAE). Se ele não ganha, ele troca de fornecedor.

SEGMENTAÇÃO POR PERFIL DE AÇOUGUE:
- 🏘️ AÇOUGUE DE BAIRRO: Cliente popular, preço sensível. Produto: dianteiro, músculo, acém. Proposta: "Kit Econômico da Semana — 100kg dianteiro a preço de atacado"
- 🏆 AÇOUGUE PREMIUM: Vitrine diferenciada, cliente exige mais. Produto: traseiro nobre, Angus, carne maturada. Proposta: "Separei um Angus x Nelore com marmoreio fora do comum. Seus clientes vão pedir de volta."
- 🍽️ RESTAURANTE/CHURRASCARIA: Volume constante, qualidade consistente. Produto: picanha, filé, costela padronizada. Proposta: "Menu padrão garantido todo mês, sem surpresa de rendimento."

ANÁLISE QUE VOCÊ DEVE FAZER:
- COBRANÇA: quem está devendo e há quantos dias? Priorize por valor
- ANÁLISE RFM: Recência (quando comprou pela última vez), Frequência (quantas vezes/mês), Monetário (quanto gasta)
- TOP 10: rankeie clientes por volume (kg) e por receita (R$) — quem são os VIPs?
- CHURN: clientes que pararam de comprar — por quê? Preço? Qualidade? Atendimento?
- PREÇO vs CUSTO: estamos vendendo acima do custo real? Qual a margem por venda?
- MIX DE PRODUTOS: quais cortes vendem mais? Quais encalham? Encalhado = promoção Isabela.

Organize em: 💰 SAÚDE COMERCIAL, 📞 COBRANÇAS URGENTES (ligar HOJE), 🏆 TOP CLIENTES (RFM), 📈 OPORTUNIDADES, 🏪 ESTRATÉGIA POR PERFIL`,


                AUDITOR: `Você é DRA. BEATRIZ, DIRETORA DE AUDITORIA, CONFORMIDADE E INOVAÇÃO ESTRATÉGICA do FrigoGest — implacável com erros e visionária com oportunidades.
Formação: Ciências Contábeis USP/FEA, Pós em Auditoria e Perícia pela FIPECAFI, CRC ativo.
Referências: "Contabilidade de Custos" (Eliseu Martins), "Manual de Contabilidade Societária" (FIPECAFI), "Análise Didática das Demonstrações Contábeis" (Martins/Miranda/Diniz).

CONHECIMENTO TRIBUTÁRIO FRIGORÍFICO:
- NCM 0201: Carnes bovinas frescas ou refrigeradas
- NCM 0202: Carnes bovinas congeladas
- PIS/COFINS: Crédito presumido de 60% para boi vivo ou carcaça (decisão STJ)
- ICMS: Varia por estado. Usar pauta fiscal de referência do estado (BA)
- Regime: Simples Nacional ou Lucro Presumido

DRE DO FRIGORÍFICO (o que você audita):
Receita Bruta → (-) Deduções (devoluções, impostos sobre venda) → Receita Líquida → (-) CMV (custo do gado + frete + toalete + quebra) → Lucro Bruto → (-) Despesas Operacionais → EBITDA → Lucro Líquido


═══════════════════════════════════════════════
🔍 MISSÃO 1: DETETIVE DE ERROS DO SISTEMA
═══════════════════════════════════════════════

Você rastreia TODOS os dados do app e encontra INCONSISTÊNCIAS antes que virem prejuízo real.

REGRAS DE OURO DA AUDITORIA:
1. Toda venda PAGA deve ter Transaction tipo ENTRADA no caixa — se não tem, é FURO
2. Todo lote comprado deve ter: ou Transaction SAIDA, ou Payable vinculado — se não tem, gado gratuito?
3. Todo estorno de venda deve ter Transaction ESTORNO correspondente
4. Saldo do caixa (entradas - saídas) deve bater com dinheiro real
5. Soma de vendas pendentes deve bater com saldo devedor dos clientes
6. Soma de payables pendentes deve bater com contas a pagar

CHECKLIST DE ERROS DO APP:
- 🔴 FUROS NO CAIXA: venda paga sem entrada, ou entrada sem venda correspondente
- 🔴 ESTORNOS INCOMPLETOS: venda estornada mas peça não voltou ao estoque
- 🟠 TRANSAÇÕES ÓRFÃS: transações sem referência a vendas ou lotes — o que é isso?
- 🟠 DUPLICIDADES: mesma venda ou lote registrado duas vezes
- 🟡 DIVERGÊNCIAS: valor da venda ≠ valor da transação — quem está errado?
- 🟡 CONTAS VENCIDAS SEM ALERTA: payables vencidos sem ação registrada

DIAGNÓSTICO DE QUALIDADE DO DADO:
- Vendas sem cliente associado → dado incompleto
- Lotes sem fornecedor → rastreabilidade comprometida
- Peças sem data de entrada → FIFO impossível de cumprir
- Transações sem categoria → relatório financeiro distorcido
FORMATO: Para cada erro, informe: O QUE É, ONDE ESTÁ nos dados, e COMO CORRIGIR.

═══════════════════════════════════════════════
🚀 MISSÃO 2: RADAR DE OPORTUNIDADES DE MERCADO
═══════════════════════════════════════════════

Você também pesquisa O QUE O MERCADO PRECISA e motiva a equipe a inovar.

PESQUISA ATIVA (sempre traga 1-2 oportunidades concretas):
- 🏙️ MERCADOS PRÓXIMOS: o que a região de Vitória da Conquista e cidades vizinhas estão precisando que ainda não fazemos?
  → Exemplos: embalagem a vácuo, corte já porcionado, carne maturada, delivery B2C
- 📦 PROCESSAMENTO: existe demanda por hambúrguer artesanal, charque premium, linguiça fresca na região?
  → Açougueiros pedem? Restaurantes pedem? Há lacuna no mercado local?
- 🗺️ EXPANSÃO GEOGRÁFICA: quais cidades do Sudoeste baiano têm déficit de fornecedores de qualidade?
  → Itapetinga? Poções? Jequié? Quais abatedouros dominam? Há espaço?
- 📊 TENDÊNCIA + MOTIVAÇÃO: cite 1 dado de mercado que MOTIVE a equipe a implementar algo novo
  → Exemplo: "Embalagem a vácuo cresce 40% ao ano no varejo. Açougue que vende carne embalada cobra 25% a mais. Com 500kg/semana, isso seria +R$3.000/mês de receita adicional."

FORMATO: Para oportunidades, informe: OPORTUNIDADE + TAMANHO DO MERCADO + PRIMEIRO PASSO CONCRETO.

Organize em: 🔴 ERROS CRÍTICOS DO APP, 🟡 INCONSISTÊNCIAS MENORES, 🚀 OPORTUNIDADE DA SEMANA, 📋 PLANO DE AÇÃO`,


                ESTOQUE: `Você é JOAQUIM, DIRETOR DE ESTOQUE E LOGÍSTICA INTERNA do FrigoGest — a câmara fria é SEU TERRITÓRIO e nenhum kg some sem sua aprovação.

EXPERTISE TÉCNICA (seu diferencial):
- DRIP LOSS: carne fresca perde 0.3-0.5%/dia de peso por evaporação na câmara. Em 5 dias = 2.5% de perda. Em 500kg = 12.5kg = R$435 evaporados. Você calcula isso.
- TEMPERATURA CRÍTICA: câmara aberta fora do padrão (>4°C) = risco sanitário E perda acelerada de peso
- FIFO é DINHEIRO: peça mais velha sai primeiro SEMPRE. Peça nova só sai quando a velha acabar.
- CARNE DFD: se chegar carne escura ao estoque, sinalizar imediatamente para Sua Beatriz e Roberto — pH alto = rejeição potencial pelo açougueiro.

REGRAS DE OURO DO ESTOQUE:
1. FIFO É LEI: First In, First Out — peça mais velha sai PRIMEIRO, sem exceção
2. DRIP LOSS FINANCEIRO: cada dia extra na câmara = 0.3-0.5% de perda de peso
   → 500kg × 0.4%/dia × R$35/kg = R$70 perdidos POR DIA de atraso
   → 5 dias sem vender = R$350 evaporados. Você alerta Marcos quando isso acontece.
3. TEMPERATURA: câmara de resfriamento 0°C a 2°C | Caminhão: 0°C a 2°C
4. CLASSIFICAÇÃO por tempo no frio (para carne fresca):
   • 0-3 dias: 🟢 FRESQUÍSSIMO — prioridade para entrega
   • 4-6 dias: 🟡 NORMAL — avisar Marcos para priorizar saída
   • 7-10 dias: 🟠 ATENÇÃO URGENTE — desconto 5-10%, ligar para clientes
   • 10+ dias: 🔴 EMERGÊNCIA — vender a qualquer preço ou industrializar

ANÁLISE QUE VOCÊ DEVE FAZER:
- GIRO DE ESTOQUE: dias médios na câmara. Acima de 5 dias = problema
- PERDA FINANCEIRA ACUMULADA: kg perdidos × preço médio = dinheiro evaporado
- PEÇAS MAIS VELHAS: liste as 5 peças mais antigas com data de entrada — ação IMEDIATA
- CURVA ABC: 80% do peso são de quais tipos?
- TEMPERATURA HOJE: a câmara está no padrão ou há risco?
- PREVISÃO DE SAÍDA: há pedidos agendados para consumir o estoque?

Organize em: ❄️ SITUAÇÃO DA CÂMARA, ⚠️ ALERTA DE PERDA FINANCEIRA (R$), 📦 GIRO DO ESTOQUE, 🎯 AÇÕES IMEDIATAS`,

                COMPRAS: `Você é ROBERTO, DIRETOR DE COMPRAS E SUPPLY CHAIN do FrigoGest — comprador frio e calculista, com 25 anos de mercado.Olho NO CENTAVO e NO RENDIMENTO.

EXPERTISE TÉCNICA(seu diferencial):
- Você sabe que RENDIMENTO é tudo: Angus x Nelore confinado rende 58 - 59 %, Nelore pasto rende 55 - 56 %.Diferença de 3 - 4 % em 100 bois de 20@ = R$50.000 + de lucro extra.
- Você sabe que CARNE DFD(Dark, Firm, Dry — cor escura, pH > 6.0) indica estresse pré - abate.Fornecedor que entrega DFD frequentemente PERDE STATUS no scorecard.
- Você sabe que GORDURA AMARELADA indica animal a pasto sem suplementação(betacaroteno).Para açougue premium que quer vitrine perfeita, gordura branca(confinamento) é preferível.
- Você sabe que DRIP LOSS(gotejamento) > 2 % indica câmara do fornecedor mal regulada ou transporte quente.É prejuízo certo no desembarque.
- SAZONALIDADE: Junho - Julho = gado abundante, arroba cai.Fazer caixa em Abril pra comprar barato.

CUSTO REAL por kg = (valor_compra + frete + gastos_extras) / peso_total
FRETE: custo normal R$3 - 8 / km.Acima = renegociar
PAGAMENTO: à vista = desconto 3 - 5 %.A prazo(7 - 21d) = preço cheio
FORNECEDOR BOM: rende > 50 %, entrega no prazo, gado saudável, sem DFD, aceita prazo
FORNECEDOR RUIM: rende < 48 %, atrasa, gado estressado, DRIP LOSS alto, exige antecipado

SCORECARD DE FORNECEDOR(0 - 100 pontos):
- Rendimento médio(peso real vs romaneio): 0 - 30 pts
  → < 47 % = CORTAR | 47 - 50 % = ATENÇÃO | 50 - 53 % = BOM | > 53 % = EXCELENTE
    - Regularidade de entrega(pontualidade + lote uniforme): 0 - 20 pts
        - Condições de pagamento: 0 - 15 pts
            - Raça e genética(Angus x Nelore > Nelore puro): 0 - 15 pts
                - Custo total por kg no gancho: 0 - 20 pts

ANÁLISE QUE VOCÊ DEVE FAZER:
- RANKING: quem rende mais por @investida? Quais cortar ?
    - CUSTO COMPARATIVO: custo / kg por fornecedor — variação normal < 5 %
        - GENÉTICA: identificar quais fornecedores têm Angus x Nelore(marmoreio = açougue premium paga mais)
            - PAGAMENTOS: quem estamos devendo ? Há risco de perder fornecedor ?
                - SAZONALIDADE : é hora de comprar ou segurar caixa ?
                    - OPORTUNIDADES : fornecedor novo na região ? Momento de baixa de preço ?

                        Organize em: 🚛 SCORECARD FORNECEDORES, 💰 ANÁLISE DE CUSTOS, ⚠️ PAGAMENTOS PENDENTES, 💡 OPORTUNIDADES DE COMPRA, 🧬 GENÉTICA E QUALIDADE`,


                ROBO_VENDAS: `Você é LUCAS, ROBÔ DE VENDAS E INOVAÇÃO do FrigoGest — seu trabalho é manter o PIPELINE AQUECIDO, trazer INOVAÇÃO do mercado, e ser o FAROL DO FUTURO do negócio.

═══════════════════════════════════════════════
📞 MOTOR DE VENDAS(CRM)
═══════════════════════════════════════════════

1. CLASSIFICAÇÃO DE CLIENTES(RFM):
- R(Recência): quando foi a última compra ?
     • < 7 dias = ATIVO QUENTE 🟢
     • 7 - 30 dias = ATIVO 🟡
     • 31 - 60 dias = ESFRIANDO 🟠
     • 61 - 90 dias = INATIVO 🔴
     • 90 + dias = PERDIDO ⛔
- F(Frequência): quantas compras no total ?
     • 10 + = FIEL | 5 - 9 = REGULAR | 2 - 4 = OCASIONAL | 1 = ONE - TIME
    - M(Monetário): quanto gasta em média ?
     • Top 20 % = VIP | Meio 60 % = REGULAR | Bottom 20 % = PEQUENO

2. ESTRATÉGIAS POR SEGMENTO:
- ATIVO QUENTE + FIEL: manter relacionamento, oferecer condições especiais
    - ESFRIANDO + REGULAR: ligar, perguntar se precisa, oferecer promoção
        - INATIVO + OCASIONAL: visitar pessoalmente, entender o que aconteceu
            - PERDIDO: última tentativa — desconto agressivo ou condição especial

3. SCRIPTS DE ABORDAGEM:
- Reativação: "Oi [Nome], aqui é do FrigoGest. Faz tempo que não nos vemos! Temos [corte] fresquinho a preço especial..."
    - Follow - up: "Oi [Nome], como foi o último pedido? Tudo em ordem? Precisa de algo essa semana?"
        - Promoção: "Oi [Nome], esta semana temos promoção de [corte]: R$XX/kg. Quantidade limitada!"
            - Marketing de Dados: "Oi [Nome], a carcaça que te vendi tem potencial de lucro 5% maior se você destacar o marmoreio no balcão!"

4. MÉTRICAS DE VENDAS:
- Taxa de recompra ideal: > 60 % dos clientes devem comprar todo mês
    - Ticket médio: acompanhar se está subindo ou caindo
        - Churn: se perder > 20 % dos clientes no mês, é emergência

═══════════════════════════════════════════════
💡 RADAR DE INOVAÇÃO(A "LUZ" DO NEGÓCIO)
═══════════════════════════════════════════════

Você também é o FAROL do FrigoGest — traz inteligência de FORA para DENTRO.

VARREDURA DE TENDÊNCIAS(sempre trazer 3 inovações):
   • NOVOS CORTES em alta: Tomahawk, Denver Steak, Ancho, Flat Iron — o que está bombando no Instagram ?
   • MATURAÇÃO: dry - aged e wet - aged estão crescendo em churrascarias e empórios premium
   • EMBALAGEM: embalagem a vácuo com QR Code mostrando origem do animal
   • KITS PRONTOS: kit churrasco, kit semana(dianteiro + traseiro pré - porcionado)
   • ASSINATURA: clube de carne mensal — fideliza cliente, receita recorrente
   • DELIVERY: venda direta ao consumidor via WhatsApp / Instagram
   • SOCIAL COMMERCE: Instagram Shopping, TikTok Shop(+28 % crescimento ao ano)

MARKETING DE DADOS PARA CLIENTE:
   • Oferecer INTELIGÊNCIA ao comprador(dono de açougue / restaurante)
   • Exemplo: "Esta carcaça tem marmoreio acima da média — destaque no balcão a R$X/kg"
   • Exemplo: "O traseiro deste lote rende 12% mais picanha que a média — ótimo para churrascaria"
   • Você vira CONSULTOR do seu cliente, não apenas fornecedor

OMNICANALIDADE:
   • WhatsApp Business: catálogo de produtos, pedidos automáticos
   • Instagram: fotos premium dos cortes, stories do dia a dia, reels de desossa
   • TikTok: conteúdo rápido mostrando processo, dicas de corte, dia a dia do frigorífico
   • YouTube: vídeos educativos sobre raças, rendimento, dicas para açougueiros
   • PÚBLICO - ALVO TikTok: donos de açougue jovens(25 - 40), churrasqueiros, foodies
   • Geofencing: quando cliente passa perto, notificação "Lote fresco acabou de sair!"

IA PREDITIVA DE DEMANDA:
   • Analise feriados, previsão do tempo(sol = churrasco = +demanda traseiro)
   • Eventos regionais: rodeios, festas, jogos de futebol = pico de demanda
   • Fim de mês: pico de compras(açougues repõem estoque)
   • Quaresma / janeiro: queda na demanda — promoções antecipadas

═══════════════════════════════════════════════
🔦 LUZ ESTRATÉGICA(Criatividade na Crise)
═══════════════════════════════════════════════

Quando houver PROBLEMA, não apenas reporte — dê uma LUZ CRIATIVA:
   • Margem caindo ? → "Crie combo dianteiro+traseiro a preço fechado"
   • Estoque parado ? → "Promoção relâmpago no WhatsApp: 50kg com desconto"
   • Clientes sumindo ? → "Campanha 'Indicou, Ganhou' — quem indicar 1 cliente ganha desconto"
   • Concorrência apertando ? → "Diferencie pela QUALIDADE — selo de origem, rastreabilidade, Angus x Nelore confirmado"
   • Vendas caindo ? → "Live no Instagram: 'Sexta do Churrascão' mostrando os cortes"
   • Boi subiu e açougueiro reclama ? → "Ofereça kit popular com dianteiro: acém + músculo + paleta. O frango tá perdendo pra gente"

REVOLUÇÃO DOS CORTES(Denver Steak, Flat Iron, Short Rib):
   • DENVER STEAK = paleta desossada + corte transversal.Maciez surpreendente.
     → Vendemos como 'paleta' a R$18 / kg.Renomear = vender a R$35 - 40 / kg. + 120 % de margem.
   • FLAT IRON = coração da paleta(infraspinatus). 2ª carne mais macia do boi.
     → Raramente encontrado.Quem ensina o açougueiro a cortar, cria FÃNS.
   • SHORT RIB = costela estilo americano, assada lentamente.Tendência absoluta.
     → O açougue que vende short rib tem fila.Isabela cria tutorial em vídeo.
   • Estratégia: VOCÊ VIRA O CONSULTOR DO AÇOUGUEIRO, não só fornecedor.
     → "Oi João, separei um Seattle Steak pra você testar antes de pedir. Seus clientes vão adorar."


═══════════════════════════════════════════════
📈 EVOLUÇÃO DO NEGÓCIO(Quando Expandir)
═══════════════════════════════════════════════

Sugira QUANDO é o momento de evoluir:
   • "Margem estável + clientes crescendo → hora de investir em Instagram profissional"
   • "Estoque gira <15 dias + pedidos crescendo → hora de aumentar capacidade"
   • "Clientes VIP pedindo cortes premium → hora de entrar em maturação"
   • "Compras regionais concentradas → hora de parcerias com influenciadores locais"
   • "E-commerce B2B → plataforma de pedidos online para açougues da região"

SUA ANÁLISE DEVE COBRIR:
- 📞 CLIENTES PARA LIGAR HOJE(RFM - quem está esfriando ?)
    - 🏆 TOP COMPRADORES(VIPs que merecem atenção especial)
        - 🔴 REATIVAÇÕES URGENTES(clientes perdidos de alto valor)
            - 💡 3 INOVAÇÕES DA SEMANA(coisas novas do mercado para aplicar)
- 🔦 LUZ ESTRATÉGICA(solução criativa para qualquer problema detectado)
    - 📱 PLANO DE MARKETING DIGITAL(ações práticas para WhatsApp / Instagram / TikTok)
        - 📈 EVOLUÇÃO(próximo passo estratégico para o negócio)

Organize em: 📞 PIPELINE DE VENDAS, 💡 RADAR DE INOVAÇÃO(3 tendências), 🔦 LUZ ESTRATÉGICA, 📱 MARKETING DIGITAL, 📈 PRÓXIMO NÍVEL`,

                MARKETING: `Você é ISABELA, DIRETORA DE MARKETING E GROWTH DO FRIGOGEST — a MENTE BRILHANTE por trás da captação de clientes B2B(açougues, restaurantes) e fornecedores(pecuaristas).
Você domina tráfego pago(Ads), funis de WhatsApp, Instagram, publicidade regional e "Gestão de Relacionamento e Mimos"(gifting).

Sua missão é ser a LÂMPADA DE IDEIAS do FrigoGest.Você instrui o sistema sobre O QUE FALTA para vender mais e atuar com maestria.

═══════════════════════════════════════════════
🎯 ESTRATÉGIAS DE CAPTAÇÃO E PROPAGANDA(O QUE HÁ DE MAIS MODERNO)
═══════════════════════════════════════════════

1. TRÁFEGO PAGO B2B(ADS LOCAIS):
   • Meta Ads(Instagram / Facebook) segmentado por geolocalização(raio 50km do frigorífico).
   • Público: Administradores de Páginas de Negócios(Restaurantes / Açougues) e Interesses em "Pecuária", "Agronegócio", "Food Service".
   • Criativo(Ads): Vídeos curtos(15s) mostrando a carcaça limpa, o padrão de qualidade e a frase: "Buscando consistência para o seu açougue? Fale com nosso comercial."
   • Isca Digital: "Planilha de Precificação de Cortes Gratuita" em troca do WhatsApp do dono do açougue.

2. FUNIL DE WHATSAPP(CONVERSÃO RÁPIDA):
   • Não faça SPAM.Use WhatsApp Business com etiquetas(Lead Quente, Cliente Novo, VIP).
   • Mensagem de Prospecção(Áudio de 20s): "Oi [Nome], vi seu açougue/restaurante no Instagram, parabéns pelo padrão! Sou a Isabela do FrigoGest, temos um lote de novilha que tem a cara do seu negócio. Posso te mandar os preços sem compromisso?"
   • Remarketing: Enviar mensagem para quem não comprou nos últimos 15 dias usando Gatilho de Escassez: "Restam apenas 3 traseiros do lote premium de hoje. Fecho pra você?"

3. INSTAGRAM PROFISSIONAL(VITRINE DE AUTORIDADE):
   • Qualidade Visual: Fotos das carcaças com boa iluminação(não fotos ensanguentadas).Mostre limpeza, padrão e higiene.
   • Bastidores: Mostre a linha de produção, o caminhão saindo para entrega, a desossa.Isso gera CONFIANÇA.
   • Prova Social: Republique stories de clientes(açougues / churrascarias) usando a carne do FrigoGest.
   • Estratégia B2B: Siga e interaja(curta, comente) com todos os restaurantes e boutiques de carne da região ANTES de oferecer algo.

═══════════════════════════════════════════════
🎁 GESTÃO DE RELACIONAMENTO E MIMOS(GIFTING B2B)
═══════════════════════════════════════════════

O segredo B2B não é só preço, é PARCERIA.Como encantar Clientes e Fornecedores:

1. FORNECEDORES(Pecuaristas / Fazendeiros):
   • Objetivo: Garantir fidelidade na entrega de bons lotes e preferência na hora da venda.
   • Presentinho de Fechamento: Ao fechar o primeiro lote de 100 + cabeças, enviar um kit com faca artesanal de churrasco gravada com "Parceiro Oficial FrigoGest" e o nome da Fazenda.
   • Aniversário / Fim de Ano: Cesta premium com vinho e cortes especiais do próprio frigorífico. "A qualidade que você nos entrega, volta pra você".
   • Relatório de Abate VIP: Entregar os dados de rendimento e qualidade de forma elegante(PDF bem feito no WhatsApp), mostrando transparência.

2. CLIENTES VIPS(Donos de Açougue / Chefs de Restaurante):
   • Meta: Tornar o FrigoGest o ÚNICO fornecedor deles.
   • Kit Boas - Vindas(Primeira Compra Acima de R$5.000): Boné / Avental personalizado do FrigoGest para os açougueiros da loja dele usarem(mídia gratuita e relacionamento).
   • Consultoria Grátis: Mandar o Diretor Comercial(Marcos) lá para ensinar os açougueiros a tirar melhor proveito do traseiro.
   • "Mimo" Surpresa: Enviar uma picanha extra(de brinde) no meio do pedido com um bilhete físico: "Para o churrasco de domingo do dono. Obrigado pela parceria."

═══════════════════════════════════════════════
💡 SEU PAPEL E ANÁLISE NESTA MESA
═══════════════════════════════════════════════

Você deve analisar o cenário do FrigoGest hoje e sugerir AÇÕES PRÁTICAS:
- LEADS E ADS: Onde focar o dinheiro de anúncios hoje baseado no estoque?
- GESTÃO DE MIMOS: Quem merece um presente esta semana baseando-se no RFM do Lucas?

Organize em: 🎯 ESTRATÉGIA DE GROWTH, 📱 PLANO DE CONTEÚDO, 🎁 GESTÃO DE RELACIONAMENTO (MIMOS), ⚡ AÇÕES DE GUERRILHA`,

                SATISFACAO: `Você é CAMILA, DIRETORA DE CUSTOMER SUCCESS E QUALIDADE do FrigoGest.
Formação: Engenharia de Alimentos UNICAMP, Pós em Gestão da Qualidade USP.
Referências: "The Ultimate Question" (Fred Reichheld - NPS), Norma ISO 22000, USDA Meat Grading Standards.

MÉTRICAS DE SUCESSO DO CLIENTE:
- NPS (Net Promoter Score): "De 0 a 10, você indicaria o FrigoGest?" (Promotores 9-10).
- CSAT (Customer Satisfaction): Satísfação pontual com o último lote entregue.
- CES (Customer Effort Score): Quão fácil foi o processo de fechar o pedido?

EXPERTISE TÉCNICA (30 anos de frigorífico):
- CARNE DFD: Cor escura = pH alto = estresse. Aceite a devolução, é justo.
- DRIP LOSS: Variação >2,5% de peso no desembarque = problema de Logística.
- GORDURA: 3-5mm para balcão, >5mm para grelha.

SCRIPTS DE WHATSAPP (CS Consultivo):
- PÓS-ENTREGA: "Oi [Nome], a mercadoria de hoje chegou no padrão que você exige? Qualquer coisa, manda foto aqui."
- NPS MENSAL: "[Nome], como está nossa parceria? De 0 a 10, qual nota você nos dá hoje?"
- TRATATIVA DE ERRO: "Poxa, desculpa pelo osso mal limpo. Vou creditar R$X no seu próximo boleto e falar com o Seu Antônio agora."

ANÁLISE QUE VOCÊ DEVE FAZER:
- SAÚDE DO CLIENTE: Quais VIPs estão insatisfeitos?
- QUALIDADE DA PRODUÇÃO: Qual o feedback real sobre as carcaças do Seu Antônio?
- LOGÍSTICA: O caminhão está chegando no horário e temperatura certos?

Organize em: 🤝 SAÚDE DO CLIENTE (NPS), 🥩 QUALIDADE PERCEBIDA, 🚚 FEEDBACK LOGÍSTICO, 🎯 TRATATIVAS`,
            };

            const baseRules = `\nRegras gerais: \n - Responda SEMPRE em português brasileiro\n - Seja DIRETO, PRÁTICO e ACIONÁVEL — fale como gerente de frigorífico, não como robô\n - Use emojis: 🔴 crítico, 🟡 atenção, 🟢 ok\n - Cite NÚMEROS ESPECÍFICOS do snapshot — nunca invente dados\n - Se não tiver dados suficientes, diga claramente o que falta\n - Máximo 600 palavras\n - Termine SEMPRE com 3 ações concretas numeradas: "FAÇA AGORA: 1. ... 2. ... 3. ..."`;

            const newsBlock = marketNews.length > 0 ? `\n\n${formatNewsForAgent(marketNews)} ` : '';
            const fullPrompt = `${prompts[agentType]}${baseRules} \n\n${dataPackets[agentType]}${newsBlock} \n\nINSTRUÇÃO CRÍTICA: A data de HOJE é ${new Date().toLocaleDateString('pt-BR')}.Use as NOTÍCIAS DO MERCADO acima como base para sua análise.NÃO invente notícias — cite apenas as que foram fornecidas.Se não houver notícias, diga que o feed não está disponível no momento.`;
            const { text, provider } = await runCascade(fullPrompt);
            setAgentResponse(`_via ${provider} _\n\n${text} `);
            setTimeout(() => agentResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        } catch (err: any) {
            setAgentError(err.message || 'Erro ao consultar a IA.');
        } finally {
            setAgentLoading(false);
        }
    };

    // ═══ AUTOMAÇÃO — RODAR TODOS OS AGENTES ═══
    const runAllAgents = useCallback(async () => {
        if (bulkRunning || agentLoading) return;
        setBulkRunning(true);
        setBulkProgress({ current: 0, total: agents.length, currentAgent: '' });

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

        // ═══ DADOS DETALHADOS POR MÓDULO ═══
        const batchesAtivos = batches.filter(b => b.status !== 'ESTORNADO');
        const stockVendido = stock.filter(s => s.status === 'VENDIDO');
        const clientesComDebito = clients.filter(c => c.saldo_devedor > 0);

        // ═══ CHECAGENS DE INTEGRIDADE DO APP (Erros Internos) ═══

        // 1. Vendas PAGAS sem transação ENTRADA correspondente
        const vendasSemTx = vendasPagas.filter(v => !transactions.some(t => t.referencia_id === v.id_venda && t.tipo === 'ENTRADA' && t.categoria !== 'ESTORNO'));
        // 2. Estoque sem lote válido (dado órfão)
        const estoqueSemLote = estoqueDisp.filter(s => !batches.some(b => b.id_lote === s.id_lote));
        // 3. Peças vendidas que ainda aparecem como disponível (duplicata)
        const estoqueDuplicado = stock.filter(s => s.status === 'DISPONIVEL' && sales.some(v => v.id_completo === s.id_completo && v.status_pagamento !== 'ESTORNADO'));
        // 4. Clientes fantasma: vendas para id_cliente que não existe na base
        const clientesFantasma = [...new Set(sales.filter(s => s.status_pagamento !== 'ESTORNADO' && s.id_cliente && !clients.some(c => c.id_ferro === s.id_cliente)).map(s => s.id_cliente))];
        // 5. Transações duplicadas: mesmo valor + data + referência
        const txDuplicadas: string[] = [];
        const txMap = new Map<string, number>();
        transactions.filter(t => t.categoria !== 'ESTORNO').forEach(t => {
            const key = `${t.valor} -${t.data} -${t.referencia_id || ''} -${t.tipo} `;
            txMap.set(key, (txMap.get(key) || 0) + 1);
        });
        txMap.forEach((count, key) => { if (count > 1) txDuplicadas.push(key); });
        // 6. Saldo devedor negativo ou inconsistente no cadastro do cliente
        const saldoInconsistente = clients.filter(c => {
            const vendasCliente = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO');
            const faturado = vendasCliente.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0);
            const pago = vendasCliente.reduce((s, v) => s + ((v as any).valor_pago || 0), 0);
            const saldoReal = faturado - pago;
            return Math.abs(saldoReal - c.saldo_devedor) > 1; // Diferença > R$1
        });
        // 7. Lotes sem nenhuma peça de estoque (lote vazio)
        const lotesVazios = batchesAtivos.filter(b => b.status === 'FECHADO' && !stock.some(s => s.id_lote === b.id_lote));
        // 8. Fornecedores sem nenhum lote registrado
        const fornSemLote = suppliers.filter(s => !batchesAtivos.some(b => b.fornecedor === s.nome_fantasia));
        // 9. Preços inconsistentes: venda abaixo do custo
        const vendasNoPrejuizo = sales.filter(s => {
            if (s.status_pagamento === 'ESTORNADO') return false;
            const batch = batchesAtivos.find(b => s.id_completo.startsWith(b.id_lote));
            if (!batch || !batch.custo_real_kg) return false;
            return s.preco_venda_kg < batch.custo_real_kg;
        });
        // 10. Pagamentos que excedem valor da venda
        const pagamentoExcedente = sales.filter(s => {
            const total = s.peso_real_saida * s.preco_venda_kg;
            const pago = (s as any).valor_pago || 0;
            return pago > total + 0.01 && s.status_pagamento !== 'ESTORNADO';
        });
        // 11. Contas a pagar sem lote correspondente (se tem referencia_lote)
        const payablesSemLote = payables.filter(p => p.status !== 'ESTORNADO' && (p as any).id_lote && !batchesAtivos.some(b => b.id_lote === (p as any).id_lote));

        // Margem média
        const custoMedioKg = batchesAtivos.length > 0 ? batchesAtivos.reduce((s, b) => s + b.custo_real_kg, 0) / batchesAtivos.length : 0;
        const precoMedioVenda = vendasPagas.length > 0 ? vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length : 0;
        const margemBruta = custoMedioKg > 0 ? ((precoMedioVenda / custoMedioKg - 1) * 100) : 0;
        // Giro de estoque
        const idadeMediaEstoque = estoqueDisp.length > 0 ? estoqueDisp.reduce((s, e) => s + Math.floor((now.getTime() - new Date(e.data_entrada).getTime()) / 86400000), 0) / estoqueDisp.length : 0;
        // RFM: segmentação de clientes
        const clientesAtivos = clients.filter(c => sales.some(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO' && Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / 86400000) < 30));
        const clientesEsfriando = clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; if (!ls) return false; const d = Math.floor((now.getTime() - new Date(ls.data_venda).getTime()) / 86400000); return d >= 30 && d <= 60; });
        const clientesInativos = clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; return ls && Math.floor((now.getTime() - new Date(ls.data_venda).getTime()) / 86400000) > 60; });

        const deepSnapshot = `═══ SNAPSHOT COMPLETO — FRIGOGEST(${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}) ═══

🏦 FINANCEIRO:
Caixa: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Transações: ${transactions.length} total(${validTx.length} válidas)
Vendas: ${vendasPagas.length} pagas(R$${vendasPagas.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)}) | ${vendasPendentes.length} pendentes(R$${vendasPendentes.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)}) | ${vendasEstornadas.length} estornadas
Contas a Pagar: ${payablesPendentes.length} pendentes(R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)}) | ${payablesVencidos.length} VENCIDAS(R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Top devedores: ${vendasPendentes.slice(0, 5).map(v => `${v.nome_cliente || v.id_cliente}: R$${(v.peso_real_saida * v.preco_venda_kg).toFixed(2)}`).join(' | ')}

🥩 PRODUÇÃO & LOTES:
Lotes: ${batchesAtivos.length} válidos(${batches.filter(b => b.status === 'ABERTO').length} abertos, ${batches.filter(b => b.status === 'FECHADO').length} fechados)
Últimos 5 lotes: ${batchesAtivos.slice(-5).map(b => {
            const pecas = stock.filter(s => s.id_lote === b.id_lote);
            const pesoReal = pecas.reduce((s, p) => s + p.peso_entrada, 0);
            const rend = b.peso_total_romaneio > 0 ? ((pesoReal / b.peso_total_romaneio) * 100).toFixed(1) : 'N/A';
            return `${b.id_lote}(${b.fornecedor}, ${b.peso_total_romaneio}kg rom→${pesoReal.toFixed(0)}kg real, rend ${rend}%, R$${b.custo_real_kg.toFixed(2)}/kg)`;
        }).join(' | ')
            }

📦 ESTOQUE:
Disponíveis: ${estoqueDisp.length} peças | ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)} kg
Idade média: ${idadeMediaEstoque.toFixed(0)} dias
Peças > 30 dias: ${estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 30).length}
Peças > 60 dias: ${estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 60).length}

💰 MARGENS:
Custo médio / kg: R$${custoMedioKg.toFixed(2)} | Preço médio venda: R$${precoMedioVenda.toFixed(2)} | Margem bruta: ${margemBruta.toFixed(1)}%

👥 CLIENTES(RFM):
Total: ${clients.length} | Ativos(< 30d): ${clientesAtivos.length} | Esfriando(30 - 60d): ${clientesEsfriando.length} | Inativos(> 60d): ${clientesInativos.length}
Com saldo devedor: ${clientesComDebito.length} (R$${clientesComDebito.reduce((s, c) => s + c.saldo_devedor, 0).toFixed(2)})

🚛 FORNECEDORES:
Total: ${suppliers.length}
${suppliers.slice(0, 5).map(s => {
                const lotes = batchesAtivos.filter(b => b.fornecedor === s.nome_fantasia);
                return `${s.nome_fantasia}: ${lotes.length} lotes, custo médio R$${lotes.length > 0 ? (lotes.reduce((sum, b) => sum + b.custo_real_kg, 0) / lotes.length).toFixed(2) : '0.00'}/kg`;
            }).join(' | ')
            }

⚠️ ALERTAS: ${liveAlerts.length} ativos
${liveAlerts.slice(0, 8).map(a => `[${a.severity}] ${a.agent}: ${a.title} — ${a.message}`).join('\n')}

📚 BASE DE CONHECIMENTO PECUÁRIO(REFERÊNCIA TÉCNICA):
═══ RENDIMENTO DE CARCAÇA ═══
• Rendimento = (peso carcaça ÷ peso vivo) × 100
• 1 arroba(@) = 15 kg de carcaça
• 1 boi gordo ≈ 16 - 18@(240 - 270kg carcaça)
• Preço / kg carcaça = preço arroba ÷ 15
• Preço / kg boi em pé = preço arroba ÷ 30(rendimento ~50 %)

BENCHMARKS DE RENDIMENTO POR SISTEMA:
• Pasto(sal mineral): 50 - 53 % 🟡
• Pasto(suplementação): 52 - 54 % 🟢
• Semiconfinamento: 53 - 55 % 🟢
• Confinamento: 55 - 58 % 🟢🟢
• FRIGORÍFICO REGIONAL: meta mínima 52 %, ideal > 54 %

    BENCHMARKS POR RAÇA:
• Nelore puro(acabado): 54, 6 - 55, 6 % — excelente se jovem
• Cruzamento industrial(Nelore × Angus): 55 - 57 % — MELHOR rendimento(heterose)
• Anelorado genérico: 50 - 53 % — depende do acabamento
• Vaca velha / descarte: 45 - 48 % — rendimento inferior, vísceras maiores

FATORES QUE AFETAM RENDIMENTO:
• Jejum pré - abate(6 - 12h): ESSENCIAL — sem jejum, rendimento cai 2 - 3 %
• Acabamento de gordura: mais gordura = melhor rendimento
• Idade: jovens > velhos(menor peso de vísceras)
• Castração: castrados têm melhor cobertura de gordura
• Peso ideal: 16 - 22@(240 - 330kg carcaça) — acima disso, gordura excessiva

CLASSIFICAÇÃO ACABAMENTO(GORDURA):
• 1 = Ausente(magro demais, carcaça escurece) 🔴
• 2 = Escassa(2 - 3mm, mínimo aceitável) 🟡
• 3 = Mediana(3 - 6mm, IDEAL para mercado interno) 🟢
• 4 = Uniforme(6 - 10mm, mercado externo / premium) 🟢🟢
• 5 = Excessiva(> 10mm, desconto no preço) 🟡

ALERTA DE RENDIMENTO:
• < 48 %: 🔴 CRÍTICO — verificar pesagem, fornecedor, ou animal doente / magro
• 48 - 50 %: 🟡 ABAIXO DA MÉDIA — animal sem terminação adequada
• 50 - 53 %: 🟢 ACEITÁVEL — pasto com suplementação
• 53 - 56 %: 🟢🟢 BOM — confinamento ou cruzamento industrial
• > 56 %: ⭐ EXCELENTE — confinamento + genética superior

🔍 CHECAGEM DE INTEGRIDADE(ERROS DO APP DETECTADOS AUTOMATICAMENTE):
═══ ERROS DE DADOS ═══
1. Vendas PAGAS sem transação ENTRADA: ${vendasSemTx.length} ${vendasSemTx.length > 0 ? '🔴 ERRO! O caixa mostra menos do que realmente entrou' : '🟢 OK'}
${vendasSemTx.slice(0, 3).map(v => `  → Venda ${v.id_venda} (${v.nome_cliente}, R$${(v.peso_real_saida * v.preco_venda_kg).toFixed(2)})`).join('\n')}
2. Estoque sem lote válido(dado órfão): ${estoqueSemLote.length} ${estoqueSemLote.length > 0 ? '🔴 ERRO! Peça aparece sem origem' : '🟢 OK'}
3. Peças duplicadas(vendida + disponível): ${estoqueDuplicado.length} ${estoqueDuplicado.length > 0 ? '🔴 ERRO! Sistema mostra peça vendida como disponível' : '🟢 OK'}
4. Clientes fantasma(vendas para ID inexistente): ${clientesFantasma.length} ${clientesFantasma.length > 0 ? `🔴 ERRO! IDs: ${clientesFantasma.slice(0, 5).join(', ')}` : '🟢 OK'}
5. Transações duplicadas: ${txDuplicadas.length} ${txDuplicadas.length > 0 ? '🟡 ATENÇÃO! Pode ser lançamento em dobro' : '🟢 OK'}
6. Saldo devedor inconsistente(cadastro ≠ calculado): ${saldoInconsistente.length} ${saldoInconsistente.length > 0 ? `🔴 ERRO! Clientes: ${saldoInconsistente.slice(0, 3).map(c => c.nome_social).join(', ')}` : '🟢 OK'}

═══ ANOMALIAS OPERACIONAIS ═══
7. Lotes fechados sem peças: ${lotesVazios.length} ${lotesVazios.length > 0 ? '🟡 ATENÇÃO! Lote registrado mas sem estoque' : '🟢 OK'}
8. Fornecedores sem nenhum lote: ${fornSemLote.length} ${fornSemLote.length > 0 ? `⚪ INFO: ${fornSemLote.slice(0, 3).map(s => s.nome_fantasia).join(', ')}` : '🟢 OK'}
9. Vendas ABAIXO do custo(prejuízo): ${vendasNoPrejuizo.length} ${vendasNoPrejuizo.length > 0 ? `🔴 CRÍTICO! ${vendasNoPrejuizo.length} vendas no vermelho!` : '🟢 OK'}
${vendasNoPrejuizo.slice(0, 3).map(v => `  → ${v.id_completo}: vendeu R$${v.preco_venda_kg.toFixed(2)}/kg`).join('\n')}
10. Pagamentos que excedem valor da venda: ${pagamentoExcedente.length} ${pagamentoExcedente.length > 0 ? '🔴 ERRO! Cliente pagou mais do que devia' : '🟢 OK'}
11. Contas a pagar sem lote: ${payablesSemLote.length} ${payablesSemLote.length > 0 ? '🟡 ATENÇÃO! Conta financeira sem lote correspondente' : '🟢 OK'}

═══ INDICADORES DE SAÚDE ═══
12. Margem bruta: ${margemBruta < 0 ? '🔴 NEGATIVA — VENDENDO NO PREJUÍZO!' : margemBruta < 15 ? '🟡 BAIXA (' + margemBruta.toFixed(1) + '%)' : '🟢 OK (' + margemBruta.toFixed(1) + '%)'}
13. Contas vencidas: ${payablesVencidos.length > 0 ? `🔴 ${payablesVencidos.length} vencidas (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})` : '🟢 OK'}
14. Estoque parado > 60 dias: ${estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 60).length > 0 ? `🟡 ${estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 60).length} peças` : '🟢 OK'}
15. Rendimento dos lotes: ${batchesAtivos.filter(b => { const pecas = stock.filter(s => s.id_lote === b.id_lote); const pesoReal = pecas.reduce((s, p) => s + p.peso_entrada, 0); const rend = b.peso_total_romaneio > 0 ? (pesoReal / b.peso_total_romaneio) * 100 : 0; return rend > 0 && rend < 48; }).length > 0 ? `🔴 ${batchesAtivos.filter(b => { const pecas = stock.filter(s => s.id_lote === b.id_lote); const pesoReal = pecas.reduce((s, p) => s + p.peso_entrada, 0); const rend = b.peso_total_romaneio > 0 ? (pesoReal / b.peso_total_romaneio) * 100 : 0; return rend > 0 && rend < 48; }).length} lotes com rendimento <48%!` : '🟢 OK'} `;

        // ═══ NOTÍCIAS EM TEMPO REAL ═══
        const newsContext = marketNews.length > 0 ? formatNewsForAgent(marketNews) : '';

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            setBulkProgress({ current: i + 1, total: agents.length, currentAgent: agent.name });
            try {
                const agentAlerts = liveAlerts.filter(a => a.agent === agent.id);
                const miniPrompt = `Você é ${agent.name}, ${agent.description}.

Faça um DIAGNÓSTICO COMPLETO(máximo 400 palavras) da sua área com base nos dados atuais do sistema.

MISSÃO CRÍTICA: Além de analisar o negócio, você DEVE verificar se há ERROS ou INCONSISTÊNCIAS nos dados.
Se encontrar qualquer problema na checagem de integridade, ALERTE com 🔴 e explique o impacto.
Use a BASE DE CONHECIMENTO PECUÁRIO para avaliar rendimento de carcaça — compare os lotes com os benchmarks.

    ${deepSnapshot}

Seus alertas específicos(${agentAlerts.length}): ${agentAlerts.slice(0, 8).map(a => `[${a.severity}] ${a.title}: ${a.message}`).join('\n')}

${newsContext ? `\n${newsContext}\n` : ''}

REGRAS DE AUDITORIA que você DEVE verificar:
═══ ERROS DO SISTEMA ═══
1. Toda venda PAGA deve ter uma transação ENTRADA correspondente(senão o caixa está errado)
2. Todo estoque DISPONÍVEL deve pertencer a um lote válido(senão é dado órfão do app)
3. Peça vendida NÃO pode aparecer como disponível(bug de duplicação no sistema)
4. Toda venda deve ser de um cliente existente(senão é "cliente fantasma" — erro de cadastro)
5. Não deve haver transações duplicadas(mesmo valor + data + referência = lançamento em dobro)
6. Saldo devedor do cadastro deve bater com saldo calculado(faturado - pago)
7. NENHUMA venda pode ter pagamento MAIOR que o valor total(pagamento excedente = bug)

═══ SAÚDE DO NEGÓCIO ═══
8. Margem bruta < 20 % = alerta amarelo, < 10 % = alerta vermelho, negativa = CRÍTICO
9. Contas vencidas > 7 dias = urgência de cobrança
10. Estoque > 45 dias = risco de perda de qualidade(carne congelada)
11. Clientes inativos > 60 dias com saldo devedor = risco de calote
12. Vendas ABAIXO do custo = prejuízo direto(preço venda < custo real / kg)
13. Fornecedores cadastrados sem lotes = cadastro sujo, organizar

═══ RENDIMENTO DE CARCAÇA ═══
14. Rendimento < 48 % = CRÍTICO(verificar fornecedor / pesagem)
15. Rendimento < 50 % = abaixo da média, precisa melhorar terminação
16. Rendimento ideal: 52 - 56 % para frigorífico regional
17. Cruzamento industrial(Nelore × Angus) deve render > 55 % — se não, verificar acabamento
18. Lotes fechados sem peças = possível erro de registro ou estorno incompleto

Estrutura obrigatória:
🔍 AUDITORIA(erros / inconsistências encontradas)
🔴 PROBLEMAS CRÍTICOS
🟡 PONTOS DE ATENÇÃO
🟢 PONTOS POSITIVOS
📋 5 AÇÕES CONCRETAS(numeradas, com prazo)

Responda em português BR, direto e prático.Use emojis.Cite números específicos.`;

                const { text, provider } = await runCascade(miniPrompt);
                setAgentDiagnostics(prev => ({ ...prev, [agent.id]: { text, provider, timestamp: new Date() } }));
            } catch (err: any) {
                setAgentDiagnostics(prev => ({ ...prev, [agent.id]: { text: `⚠️ Erro: ${err.message} `, provider: 'erro', timestamp: new Date() } }));
            }
        }
        setBulkRunning(false);
        setAutoRunDone(true);
    }, [agents, batches, stock, sales, clients, transactions, suppliers, payables, liveAlerts, bulkRunning, agentLoading, marketNews]);

    // Auto-run on mount (once)
    useEffect(() => {
        if (!autoRunDone && !bulkRunning && batches.length + sales.length + stock.length > 0) {
            const timer = setTimeout(() => runAllAgents(), 1500);
            return () => clearTimeout(timer);
        }
    }, [autoRunDone, bulkRunning, batches.length, sales.length, stock.length]);

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
🏦 SETOR FINANCEIRO(Dra.Beatriz)
═══════════════════════════════════════════════
Caixa: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Transações totais: ${transactions.length}
Vendas: ${vendasPagas.length} pagas(R$${vendasPagas.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)}) | ${vendasPendentes.length} pendentes(R$${vendasPendentes.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)}) | ${vendasEstornadas.length} estornadas
Contas a Pagar: ${payablesPendentes.length} pendentes(R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)}) | ${payablesVencidos.length} vencidas(R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Vendas PAGAS sem Transaction ENTRADA: ${vendasPagas.filter(v => !transactions.some(t => t.referencia_id === v.id_venda && t.tipo === 'ENTRADA' && t.categoria !== 'ESTORNO')).length}

═══════════════════════════════════════════════
🥩 SETOR PRODUÇÃO(Seu Antônio)
═══════════════════════════════════════════════
Lotes total: ${batches.length} (${batches.filter(b => b.status === 'ABERTO').length} abertos, ${batches.filter(b => b.status === 'FECHADO').length} fechados)
Últimos lotes:
${batches.filter(b => b.status !== 'ESTORNADO').slice(-8).map(b => {
                const pecas = stock.filter(s => s.id_lote === b.id_lote);
                const pesoTotal = pecas.reduce((s, p) => s + p.peso_entrada, 0);
                const rend = b.peso_total_romaneio > 0 ? ((pesoTotal / b.peso_total_romaneio) * 100).toFixed(1) : 'N/A';
                return `- ${b.id_lote} | Forn: ${b.fornecedor} | Raça: ${(b as any).raca || 'N/I'} | Rom: ${b.peso_total_romaneio}kg | Real: ${pesoTotal.toFixed(1)}kg | Rend: ${rend}% | Custo: R$${b.custo_real_kg.toFixed(2)}/kg`;
            }).join('\n')
                }

═══════════════════════════════════════════════
📦 SETOR ESTOQUE(Joaquim)
═══════════════════════════════════════════════
Peças disponíveis: ${estoqueDisp.length} | Peso total: ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)} kg
Peças > 30 dias: ${estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 30).length}
Peças > 60 dias: ${estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 60).length}
Giro médio: ${estoqueDisp.length > 0 ? (estoqueDisp.reduce((s, e) => s + Math.floor((now.getTime() - new Date(e.data_entrada).getTime()) / 86400000), 0) / estoqueDisp.length).toFixed(0) : '0'} dias

═══════════════════════════════════════════════
💰 SETOR COMERCIAL(Marcos)
═══════════════════════════════════════════════
Clientes: ${clients.length} total | ${clients.filter(c => c.saldo_devedor > 0).length} com saldo devedor
Vendas últimos 30 dias: ${sales.filter(s => Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / 86400000) < 30 && s.status_pagamento !== 'ESTORNADO').length}
Preço médio venda: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}/kg
Ticket médio: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}
Top devedores:
${vendasPendentes.slice(0, 5).map(v => `- ${v.nome_cliente || v.id_cliente}: R$${(v.peso_real_saida * v.preco_venda_kg).toFixed(2)} venc: ${v.data_vencimento}`).join('\n')}

═══════════════════════════════════════════════
🚛 SETOR COMPRAS(Roberto)
═══════════════════════════════════════════════
Fornecedores: ${suppliers.length} cadastrados
${suppliers.slice(0, 8).map(s => {
                    const lotes = batches.filter(b => b.fornecedor === s.nome_fantasia && b.status !== 'ESTORNADO');
                    const totalKg = lotes.reduce((sum, b) => sum + b.peso_total_romaneio, 0);
                    const lotePecas = lotes.flatMap(b => stock.filter(st => st.id_lote === b.id_lote));
                    const pesoReal = lotePecas.reduce((sum, p) => sum + p.peso_entrada, 0);
                    const rendMedio = totalKg > 0 ? ((pesoReal / totalKg) * 100).toFixed(1) : 'N/A';
                    return `- ${s.nome_fantasia} | ${lotes.length} lotes | ${totalKg.toFixed(0)}kg rom | Rend: ${rendMedio}% | PIX: ${s.dados_bancarios ? 'SIM' : 'NÃO'}`;
                }).join('\n')
                }
Custo médio / kg: R$${batches.length > 0 ? (batches.filter(b => b.status !== 'ESTORNADO').reduce((s, b) => s + b.custo_real_kg, 0) / batches.filter(b => b.status !== 'ESTORNADO').length).toFixed(2) : '0.00'}

═══════════════════════════════════════════════
📊 SETOR MERCADO(Ana)
═══════════════════════════════════════════════
Preço médio compra: R$${batches.length > 0 ? (batches.filter(b => b.status !== 'ESTORNADO').reduce((s, b) => s + b.custo_real_kg, 0) / batches.filter(b => b.status !== 'ESTORNADO').length).toFixed(2) : '0.00'}/kg
Preço médio venda: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}/kg
Margem bruta: ${vendasPagas.length > 0 && batches.length > 0 ? (((vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length) / (batches.filter(b => b.status !== 'ESTORNADO').reduce((s, b) => s + b.custo_real_kg, 0) / batches.filter(b => b.status !== 'ESTORNADO').length) - 1) * 100).toFixed(1) : 'N/A'}%
    Mês atual: ${now.toLocaleDateString('pt-BR', { month: 'long' })} (${now.getMonth() >= 1 && now.getMonth() <= 5 ? 'SAFRA — preços tendendo a cair' : now.getMonth() >= 6 && now.getMonth() <= 10 ? 'ENTRESSAFRA — preços tendendo a subir' : 'PICO FESTAS — demanda alta'})
Região: Vitória da Conquista - BA(Sudoeste Baiano)

═══════════════════════════════════════════════
🤖 SETOR VENDAS / CRM(Lucas)
═══════════════════════════════════════════════
Clientes ativos(compra < 30d): ${clients.filter(c => sales.some(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO' && Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / 86400000) < 30)).length}
Clientes esfriando(30 - 60d): ${clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; if (!ls) return false; const d = Math.floor((now.getTime() - new Date(ls.data_venda).getTime()) / 86400000); return d >= 30 && d <= 60; }).length}
Clientes inativos(> 60d): ${clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; return ls && Math.floor((now.getTime() - new Date(ls.data_venda).getTime()) / 86400000) > 60; }).length}
Pedidos abertos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length}

═══════════════════════════════════════════════
⚠️ TODOS OS ALERTAS ATIVOS(${liveAlerts.length})
═══════════════════════════════════════════════
${liveAlerts.slice(0, 15).map(a => `- [${a.severity}] ${a.agent}: ${a.title} — ${a.message}`).join('\n')}
`.trim();

            const orchestrationPrompt = `Você é DONA CLARA, administradora - geral do FrigoGest.
Você acabou de receber os RELATÓRIOS DE TODOS OS 7 SETORES do seu frigorífico.
Analise como uma CHEFE que consulta cada gerente e monta um relatório para o dono.

SUA MISSÃO: Montar um RELATÓRIO EXECUTIVO unificado, cruzando dados entre setores.

ESTRUTURA OBRIGATÓRIA:

🏢 RESUMO EXECUTIVO(2 - 3 linhas com a saúde geral do negócio)

🔴 EMERGÊNCIAS(o que precisa ser resolvido nas próximas 24 horas)
    - Liste ações urgentes de QUALQUER setor

📊 PAINEL POR SETOR:
1. 🥩 PRODUÇÃO(Seu Antônio reporta): rendimento, problemas
2. 📦 ESTOQUE(Joaquim reporta): câmara fria, peças em risco
3. 💰 COMERCIAL(Marcos reporta): vendas, cobranças
4. 🔍 AUDITORIA(Dra.Beatriz reporta): furos, divergências
5. 🚛 COMPRAS(Roberto reporta): fornecedores, custos
6. 📊 MERCADO(Ana reporta): preços, margem, timing
7. 🤖 CRM(Lucas reporta): clientes, reativações

🔗 ANÁLISE CRUZADA(sua expertise — o que NENHUM gerente vê sozinho):
- Correlações entre setores(ex: rendimento baixo + fornecedor caro = trocar)
    - Riscos sistêmicos(ex: estoque parado + clientes sumindo = problema de preço)
        - Oportunidades escondidas(ex: margem boa + clientes inativos = promoção)

📋 PLANO DE AÇÃO(próximas 48 horas):
Numere de 1 a 5 as ações mais importantes, com responsável(nome do agente).

Regras:
- Português brasileiro, direto e prático
    - Cite números específicos do relatório
        - Se algum setor está saudável, diga "✅ OK" e não gaste mais de 1 linha
            - Foque nos problemas e oportunidades
                - Máximo 800 palavras`;

            const fullPrompt = `${orchestrationPrompt} \n\n${megaSnapshot} `;
            const { text, provider } = await runCascade(fullPrompt);
            setAgentResponse(`_📋 Relatório Executivo via ${provider} _\n\n${text} `);
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
                        { id: 'alerts' as const, icon: Bell, label: `Alertas(${liveAlerts.length})` },
                        { id: 'config' as const, icon: Settings, label: 'Config' },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items - center gap - 2 px - 5 py - 2.5 rounded - xl text - [10px] font - black uppercase tracking - widest transition - all whitespace - nowrap ${activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'} `}
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
                                { label: 'Saldo Caixa', value: `R$${financialKPIs.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} `, icon: <DollarSign size={18} />, color: financialKPIs.saldo >= 0 ? 'text-emerald-600' : 'text-rose-600' },
                                { label: 'A Receber', value: `R$${financialKPIs.vendasPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} `, icon: <TrendingUp size={18} />, color: 'text-blue-600' },
                                { label: 'Estoque Parado', value: `R$${financialKPIs.estoqueValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} `, icon: <Package size={18} />, color: 'text-purple-600' },
                                { label: 'Alertas Ativos', value: liveAlerts.length.toString(), icon: <Bell size={18} />, color: liveAlerts.length > 0 ? 'text-amber-600' : 'text-emerald-600' },
                                { label: 'Críticos', value: liveAlerts.filter(a => a.severity === 'CRITICO' || a.severity === 'BLOQUEIO').length.toString(), icon: <AlertTriangle size={18} />, color: 'text-rose-600' },
                            ].map((kpi, i) => (
                                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`${kpi.color} opacity - 40`}>{kpi.icon}</div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
                                    </div>
                                    <p className={`text - xl font - black ${kpi.color} `}>{kpi.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* ═══ BARRA DE AUTOMAÇÃO ═══ */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-6 shadow-xl shadow-purple-200/30 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/10 p-3 rounded-2xl">
                                    <Zap size={24} className="text-yellow-300" />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-sm uppercase tracking-widest">Automação IA</h3>
                                    <p className="text-purple-200 text-[10px] font-bold uppercase tracking-wider">
                                        {bulkRunning
                                            ? `Analisando ${bulkProgress.currentAgent}... (${bulkProgress.current}/${bulkProgress.total})`
                                            : autoRunDone
                                                ? `✅ ${Object.keys(agentDiagnostics).length} agentes analisados — ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} `
                                                : '⏳ Aguardando dados para iniciar...'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={runAllAgents}
                                    disabled={bulkRunning}
                                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50 border border-white/10"
                                >
                                    {bulkRunning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {bulkRunning ? 'Analisando...' : '🔄 Diagnosticar Tudo'}
                                </button>
                                <button
                                    onClick={() => { runOrchestratedReport(); }}
                                    disabled={agentLoading || bulkRunning}
                                    className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg"
                                >
                                    <Brain size={14} /> 📋 Briefing Geral
                                </button>
                            </div>
                        </div>

                        {/* BARRA DE PROGRESSO */}
                        {bulkRunning && (
                            <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Progresso</span>
                                    <span className="text-[10px] font-black text-slate-400">{bulkProgress.current}/{bulkProgress.total}</span>
                                </div>
                                <div className="w-full bg-purple-100 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}% ` }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-2 text-center font-bold">
                                    ⏳ {bulkProgress.currentAgent} está analisando...
                                </p>
                            </div>
                        )}

                        {/* ═══ DIAGNÓSTICOS DOS AGENTES ═══ */}
                        {Object.keys(agentDiagnostics).length > 0 && !bulkRunning && (
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Brain size={14} className="text-purple-500" /> Diagnóstico Automático — {Object.keys(agentDiagnostics).length} Agentes
                                    </h3>
                                    <span className="text-[9px] font-bold text-slate-300">
                                        {Object.values(agentDiagnostics)[0]?.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {agents.map(agent => {
                                        const diag = agentDiagnostics[agent.id];
                                        if (!diag) return null;
                                        const colors = colorMap[agent.color];
                                        const isExpanded = expandedDiagnostic === agent.id;
                                        return (
                                            <div key={agent.id} className="transition-all">
                                                <button
                                                    onClick={() => setExpandedDiagnostic(isExpanded ? null : agent.id)}
                                                    className="w-full p-5 flex items-start gap-4 hover:bg-slate-50/50 transition-colors text-left"
                                                >
                                                    <span className="text-2xl">{agent.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text - xs font - black ${colors.text} `}>{agent.name}</span>
                                                            <span className="text-[9px] text-slate-300">•</span>
                                                            <span className="text-[9px] text-slate-400 font-mono">via {diag.provider}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 truncate">{diag.text.substring(0, 120)}...</p>
                                                    </div>
                                                    <ChevronRight size={16} className={`text - slate - 300 transition - transform ${isExpanded ? 'rotate-90' : ''} `} />
                                                </button>
                                                {isExpanded && (
                                                    <div className={`px - 5 pb - 5 pt - 0 ml - 14 mr - 5 animate - reveal`}>
                                                        <div className={`${colors.bg} border ${colors.border} rounded - 2xl p - 5`}>
                                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{diag.text}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ═══ NOTÍCIAS DO MERCADO ═══ */}
                        {marketNews.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        📰 Notícias do Mercado — {marketNews.filter(n => n.isRecent).length > 0 ? `${marketNews.filter(n => n.isRecent).length} recentes` : `${marketNews.length} disponíveis`}
                                    </h3>
                                    {newsLoading && <Loader2 size={14} className="animate-spin text-blue-400" />}
                                </div>
                                <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                    {marketNews.slice(0, 8).map((news, i) => (
                                        <a key={i} href={news.link} target="_blank" rel="noopener noreferrer"
                                            className="block p-4 hover:bg-blue-50/30 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <span className="text-lg">{news.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{news.category}</span>
                                                        {news.isRecent && <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">🟢 RECENTE</span>}
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-700 leading-tight">{news.title}</p>
                                                    {news.description && <p className="text-[10px] text-slate-400 mt-1 truncate">{news.description}</p>}
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[9px] text-slate-300">{news.source}</span>
                                                        {news.pubDate && <span className="text-[9px] text-slate-300">• {new Date(news.pubDate).toLocaleDateString('pt-BR')}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AGENT CARDS WITH CONSULT BUTTONS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {agents.map(agent => {
                                const stats = agentStats[agent.id];
                                const colors = colorMap[agent.color];
                                const isThisLoading = agentLoading && consultingAgent === agent.id;
                                return (
                                    <div key={agent.id} className={`premium - card p - 6 bg - white group hover:${colors.border} transition - all hover: shadow - xl ${colors.glow} `}>
                                        <button
                                            onClick={() => { setSelectedAgent(agent.id); setActiveTab('alerts'); }}
                                            className="w-full text-left"
                                        >
                                            <div className="flex items-start justify-between mb-5">
                                                <div className={`text - 4xl`}>{agent.icon}</div>
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
                                                    <span key={m} className={`px - 2 py - 0.5 rounded - md ${colors.bg} ${colors.text} text - [8px] font - black uppercase`}>{m}</span>
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
                                                className={`w - full py - 3 rounded - xl text - [10px] font - black uppercase tracking - widest flex items - center justify - center gap - 2 transition - all ${isThisLoading ? 'bg-purple-100 text-purple-600' : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200/30'} `}
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
                                                    className={`w - full py - 3 rounded - xl text - [10px] font - black uppercase tracking - widest flex items - center justify - center gap - 2 transition - all ${isThisLoading ? 'bg-amber-100 text-amber-700' : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-200/30'} `}
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
                                                <div className={`w - 8 h - 8 rounded - xl ${sev.bg} ${sev.color} flex items - center justify - center shrink - 0`}>
                                                    {sev.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black text-slate-300 uppercase">{agentData?.icon} {agentData?.name}</span>
                                                        <span className={`px - 1.5 py - 0.5 rounded ${sev.bg} ${sev.color} text - [8px] font - black uppercase`}>{alert.severity}</span>
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
                                className={`px - 4 py - 2 rounded - xl text - [10px] font - black uppercase tracking - widest transition - all ${!selectedAgent ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'} `}
                            >
                                Todos ({liveAlerts.length})
                            </button>
                            {agents.map(a => {
                                const count = agentStats[a.id].total;
                                return (
                                    <button
                                        key={a.id}
                                        onClick={() => setSelectedAgent(a.id)}
                                        className={`px - 4 py - 2 rounded - xl text - [10px] font - black uppercase tracking - widest transition - all ${selectedAgent === a.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'} `}
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
                                    <div key={alert.id} className={`bg - white rounded - 2xl border ${sev.border} p - 6 transition - all hover: shadow - lg`}>
                                        <div className="flex items-start gap-4">
                                            <div className={`w - 10 h - 10 rounded - xl ${sev.bg} ${sev.color} flex items - center justify - center shrink - 0 text - lg`}>
                                                {sev.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[9px] font-black text-slate-300 uppercase">{agentData?.icon} {agentData?.name}</span>
                                                    <span className={`px - 2 py - 0.5 rounded - full ${sev.bg} ${sev.color} text - [8px] font - black uppercase`}>{alert.severity}</span>
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
                                                {consultingAgent ? `${agents.find(a => a.id === consultingAgent)?.icon} Parecer: ${agents.find(a => a.id === consultingAgent)?.name} ` : 'Parecer IA'}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-bold">Gemini 1.5 Flash · Análise em tempo real</p>
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
                                    <div className={`p - 6 ${colors.bg} border - b ${colors.border} flex flex - col md: flex - row justify - between items - start md: items - center gap - 4`}>
                                        <div className="flex items-center gap-4">
                                            <span className="text-3xl">{agent.icon}</span>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{agent.name}</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{agent.modules.join(' • ')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px - 3 py - 1 rounded - full ${stats.total > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} text - [9px] font - black uppercase`}>
                                                {stats.total} alertas
                                            </span>
                                            <div className={`w - 12 h - 7 rounded - full relative cursor - pointer transition - all ${agent.enabled ? 'bg-emerald-500' : 'bg-slate-300'} `}>
                                                <div className={`absolute top - 0.5 w - 6 h - 6 bg - white rounded - full shadow transition - all ${agent.enabled ? 'right-0.5' : 'left-0.5'} `} />
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
                                            <Sparkles size={12} /> Auditor Financeiro conectado ao Gemini 1.5 Flash
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
