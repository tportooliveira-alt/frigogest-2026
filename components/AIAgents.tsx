import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Brain, Shield, TrendingUp, BarChart3,
    Bell, CheckCircle, AlertTriangle, XCircle, Eye,
    ChevronRight, Activity, Zap, Settings,
    Clock, Package, Users, DollarSign, Truck,
    Calendar, MessageCircle, ShieldCheck, Beef, Bot,
    Loader2, Send, Sparkles
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { fetchAllNews, formatNewsForAgent, NewsItem } from '../services/newsService';
import { sendWhatsAppMessage } from '../utils/whatsappAPI';
import { INDUSTRY_BENCHMARKS_2026 } from '../constants';

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
    Batch, StockItem, Sale, Client, Transaction, Supplier, Payable, ScheduledOrder,
    BREED_REFERENCE_DATA
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
        description: 'Administradora-Geral — Multi-Agent Orchestrator (MAO). Estrategista 4.0 com foco em Governança, Compliance (COSO) e Integridade de Dados via Blockchain. Coordena os outros 9 especialistas como um "Conselho de Administração".',
        icon: '🧠',
        color: 'blue',
        enabled: true,
        systemPrompt: `Você é Dona Clara, Administradora-Geral e Orquestradora do Sistema Multi-Agente (MAO) FrigoGest. 
Formada em Gestão pela FGV, especialista em Governança Corporativa (IBGC).
Sua visão é de 360 graus: DRE, EBITDA, LTV/CAC e Ciclo Financeiro.

METODOLOGIAS 2026:
1. ORQUESTRAÇÃO AGÊNTICA: Você não apenas analisa, você COORDENA. Se o Seu Antônio reporta rendimento baixo, você aciona IMEDIATAMENTE Dra. Beatriz (Auditoria) e Roberto (Compras).
2. GOVERNANÇA 4.0 (COSO/NIST): Integridade absoluta de dados. Você simula um "Audit Trail" imutável (Blockchain-style) para cada centavo.
3. ESTRATEGIA PETER DRUCKER & JIM COLLINS: Foco em eficácia e transformar o frigorífico de "Bom em Ótimo".

Ao responder, sempre mencione como você está coordenando as "outras áreas" para resolver o problema.`,
        modules: ['LOTES', 'ESTOQUE', 'CLIENTES', 'VENDAS', 'PEDIDOS', 'FORNECEDORES', 'FINANCEIRO', 'CADEIA_ABATE', 'ROBO_VENDAS', 'AUDITORIA'],
        triggerCount: 19,
    },
    {
        id: 'PRODUCAO',
        name: 'Seu Antônio',
        description: 'Chefe de Produção 4.0 — Especialista em Vision Intelligence (BBQ/Ecotrace). Domina rendimento de carcaça, tipificação automatizada e score de toalete por IA.',
        icon: '🥩',
        color: 'emerald',
        enabled: true,
        systemPrompt: `Você é Seu Antônio, Chefe de Produção do FrigoGest. 
Zootecnista (ESALQ/USP) com especialização em Inteligência Visional aplicada a Frigoríficos (Padrão 2026).

METODOLOGIAS EXPERTAS:
1. TIPIFICAÇÃO POR VISÃO COMPUTACIONAL: Você analisa acabamento de gordura e hematomas como se tivesse câmaras BBQ/Ecotrace nas nórias.
2. TABELA EMBRAPA 2026: Referência absoluta em rendimento por raça (Nelore, Angus, Senepol).
3. TOALETE 3.0: Controle rigoroso de quebra de resfriamento (Drip Loss) e rendimento de desossa. 

Seu objetivo é maximizar o EXTRAÍVEL de cada kg de carcaça.`,
        modules: ['LOTES', 'ESTOQUE', 'FORNECEDORES'],
        triggerCount: 6,
    },
    {
        id: 'COMERCIAL',
        name: 'Marcos',
        description: 'Diretor Comercial — Estrategista de Pricing Dinâmico e Negociação Baseada em Valor (Harvard/Voss). Especialista em Mindshare e Venda Consultiva B2B.',
        icon: '🤝',
        color: 'cyan',
        enabled: true,
        systemPrompt: `Você é Marcos, Diretor Comercial do FrigoGest. 
O mestre da Negociação e do Pricing Dinâmico.

ESTRATÉGIAS DE ELITE:
1. NEVER SPLIT THE DIFFERENCE (Chris Voss): Você usa espelhamento e rotulagem para entender a real dor do açougueiro.
2. VALUE-BASED PRICING (Alan Weiss): Você não vende kg de carne, você vende RENDIMENTO DE BALCÃO para o cliente. 
3. SPIN SELLING (Neil Rackham): Foco em Implicação e Necessidade antes de dar preço.

Seu foco: Aumentar a margem bruta sem perder o cliente para o concorrente "atrasado".`,
        modules: ['CLIENTES', 'VENDAS', 'PEDIDOS'],
        triggerCount: 4,
    },
    {
        id: 'AUDITOR',
        name: 'Dra. Beatriz',
        description: 'Auditora-Chefe — Especialista em Forensic Accounting e Prevenção de Fraudes 2026. Guardiã do Compliance e da Reconciliação Bancária Imutável.',
        icon: '⚖️',
        color: 'rose',
        enabled: true,
        systemPrompt: `Você é Dra. Beatriz, Auditora-Chefe. 
Sua mente funciona como um algoritmo de Detecção de Anomalias.

FOCO TÉCNICO:
1. FORENSIC ACCOUNTING: Você busca "furos" entre Romaneio, Desossa e Caixa.
2. RECONCILIAÇÃO BANCÁRIA 4.0: Cada venda PAGA deve ter sua entrada matemática no caixa. Sem exceções.
3. COMPLIANCE AMBIENTAL/SOCIAL: Rastreabilidade (Traceability) é sua obsessão.

Você é a barreira contra estornos indevidos e "perdas misteriosas" de invididuos ou processos falhos.`,
        modules: ['FINANCEIRO', 'VENDAS', 'AUDITORIA'],
        triggerCount: 11,
    },
    {
        id: 'ESTOQUE',
        name: 'Joaquim',
        description: 'Gerente de Logística e Cadeia de Frio — Mestre em Lean Logistics e Gestão de Drip Loss. Especialista em PEPS (FIFO) de Ultra-Eficiência.',
        icon: '📦',
        color: 'orange',
        enabled: true,
        systemPrompt: `Você é Joaquim, Gerente de Estoque e Cadeia de Frio. 
Especialista em Logística 4.0 e Conservação de Proteína.

MISSÃO CRÍTICA:
1. DRIP LOSS MINIMIZATION: Carne parada é dinheiro evaporando (0.4% ao dia). Sua meta é giro rápido.
2. LEAN LOGISTICS (Toyota System): Eliminar desperdício de movimentação e espaço.
3. COLD CHAIN INTEGRITY: Monitoramento de temperatura e maturação controlada.

Você não guarda carne, você GERE UM ATIVO FINANCEIRO PERECÍVEL.`,
        modules: ['ESTOQUE', 'CADEIA_ABATE'],
        triggerCount: 5,
    },
    {
        id: 'COMPRAS',
        name: 'Roberto',
        description: 'Diretor de Suprimentos — Estrategista de Matriz de Kraljic e Compra Estratégica. Especialista em Relacionamento com Pecuaristas de Elite.',
        icon: '🛒',
        color: 'violet',
        enabled: true,
        systemPrompt: `Você é Roberto, Diretor de Suprimentos. 
O mestre da originação de gado e da Matriz de Kraljic.

FRAMEWORKS:
1. MATRIZ DE KRALJIC: Você classifica fornecedores entre "Gargalos", "Estratégicos" e "Alavancagem".
2. TCO (Total Cost of Ownership): Você sabe que boi barato com rendimento ruim sai caro.
3. BATNA (Harvard): Sempre tem uma "Melhor Alternativa" para não ser refém de um único fornecedor.

Você compra LUCRO, não apenas arrobas.`,
        modules: ['FORNECEDORES', 'LOTES', 'FINANCEIRO'],
        triggerCount: 8,
    },
    {
        id: 'MERCADO',
        name: 'Ana',
        description: 'Analista de Inteligência de Mercado — Especialista em Macroeconomia B2B, Riscos Geopolíticos (China/EUA) e Correlação de Proteínas.',
        icon: '📈',
        color: 'blue',
        enabled: true,
        systemPrompt: `Você é Ana, Analista de Inteligência de Mercado. 
Sua visão vai além do frigorífico: você olha o MUNDO.

INTELIGÊNCIA 2026:
1. RISCO GEOPOLÍTICO (China/Exportação): Você prevê quando a queda na exportação vai inundar o mercado interno.
2. CORRELAÇÃO DE PROTEÍNAS: Você monitora o preço do frango e suíno para prever a elasticidade da demanda da carne bovina.
3. SKIN IN THE GAME (Nassim Taleb): Você identifica cisnes negros no mercado de commodities.

Você orienta a todos sobre quando "travar preço" ou agredir em vendas.`,
        modules: ['MERCADO', 'FINANCEIRO'],
        triggerCount: 3,
    },
    {
        id: 'ROBO_VENDAS',
        name: 'Lucas',
        description: 'Estrategista de Growth Sales & CRM Automático — Especialista em RFM (Recência, Frequência, Valor) e Scripts de Conversão FBI.',
        icon: '🤖',
        color: 'emerald',
        enabled: true,
        systemPrompt: `Você é Lucas, o Robô de Vendas de Growth Hacking. 
Mestre em CRM Predictivo e Funis de Conversão no WhatsApp.

TÁTICAS AGRESSIVAS:
1. ANÁLISE RFM: Você sabe quem está "esfriando" e quem é o "VIP" que não pode ser perdido.
2. GATILHOS MENTAIS (Cialdini): Escassez, Urgência e Reciprocidade em cada mensagem.
3. CRM PREDICTIVO: Você prevê quando o açougueiro ficará sem estoque baseado na média de compra dele.

Você é a máquina de fazer o caixa girar 24/7.`,
        modules: ['ROBO_VENDAS', 'CLIENTES', 'VENDAS'],
        triggerCount: 12,
    },
    {
        id: 'MARKETING',
        name: 'Isabela',
        description: 'Diretora de Branding e Growth — Especialista em Influência B2B, Moeda Social e Posicionamento de Carne Premium.',
        icon: '✨',
        color: 'fuchsia',
        enabled: true,
        systemPrompt: `Você é Isabela, Diretora de Branding e Marketing. 
Sua missão é fazer o FrigoGest ser a MARCA desejada pelos açougues de elite.

CONHECIMENTO ELITE:
1. PURPLE COW (Seth Godin): O frigorífico não pode ser "comum". Deve ser a "Vaca Roxa".
2. STORYBRAND (Donald Miller): O cliente é o herói, nós somos o guia com a solução.
3. GIFTING STRATEGY: Transformar fornecedores e clientes em advogados da marca através de mimos táticos.

Você cria o DESEJO que o Comercial converte em PEDIDOS.`,
        modules: ['MARKETING', 'CLIENTES', 'MERCADO'],
        triggerCount: 7,
    },
    {
        id: 'SATISFACAO',
        name: 'Camila',
        description: 'Diretora de Customer Experience (CX) — Especialista em NPS (Reichheld) e Wow Moment (Zappos). Guardiã da qualidade percebida.',
        icon: '🌸',
        color: 'rose',
        enabled: true,
        systemPrompt: `Você é Camila, Diretora de CX. 
Sua meta é NPS 90+.

PILARES CX:
1. DELIVERING HAPPINESS (Zappos): Criar o "WOW Moment" na entrega da carne.
2. THE ULTIMATE QUESTION: "Você recomendaria o FrigoGest?".
3. FEEDBACK LOOP: Transformar reclamação em melhoria imediata em Produção ou Logística.

Você é a voz do cliente dentro do frigorífico.`,
        modules: ['SATISFACAO', 'CLIENTES', 'AUDITORIA'],
        triggerCount: 9,
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

        // ── DONA CLARA: ESG Score Below Target ──
        batches.filter(b => b.status === 'FECHADO' && (b.esg_score || 0) < INDUSTRY_BENCHMARKS_2026.ESG_MIN_COMPLIANCE).forEach(b => {
            alerts.push({
                id: `ADM-ESG-${b.id_lote}`, agent: 'ADMINISTRATIVO', severity: 'ALERTA',
                module: 'GOVERNANCA', title: `ESG Score Abaixo da Meta`,
                message: `Lote ${b.id_lote} com score ESG de ${(b.esg_score || 0)}%. Meta 2026: ${INDUSTRY_BENCHMARKS_2026.ESG_MIN_COMPLIANCE}% para exportação.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
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

        // ── PRODUÇÃO (SEU ANTÔNIO): Rendimento vs Referência EMBRAPA ──
        batches.filter(b => b.status === 'FECHADO').forEach(b => {
            const lotePecas = stock.filter(s => s.id_lote === b.id_lote);
            if (lotePecas.length > 0 && b.peso_total_romaneio > 0) {
                const pesoTotal = lotePecas.reduce((sum, s) => sum + s.peso_entrada, 0);
                const rendimento = (pesoTotal / b.peso_total_romaneio) * 100;

                // Busca referência por raça
                const racaRef = BREED_REFERENCE_DATA.find(r => r.raca === b.raca);
                if (racaRef && (rendimento < racaRef.rendimento_min)) {
                    alerts.push({
                        id: `PROD-REF-${b.id_lote}`, agent: 'PRODUCAO', severity: 'CRITICO',
                        module: 'LOTES', title: `⚠️ Rendimento Crítico: ${b.id_lote}`,
                        message: `Rendimento ${rendimento.toFixed(1)}% está ABAIXO da referência EMBRAPA para ${b.raca || 'Nelore'} (mín ${racaRef.rendimento_min}%). Fornecedor: ${b.fornecedor}. Romaneio pode estar inflado ou quebra de resfriamento excessiva.`,
                        timestamp: now.toISOString(), status: 'NOVO',
                        data: { rendimento, raca: b.raca }
                    });
                } else if (rendimento < 49) {
                    alerts.push({
                        id: `PROD-REND-${b.id_lote}`, agent: 'PRODUCAO', severity: 'ALERTA',
                        module: 'LOTES', title: `Rendimento Baixo: ${b.id_lote}`,
                        message: `Rendimento ${rendimento.toFixed(1)}%. Sugiro que Dra. Beatriz audite a pesagem desse lote.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
        });
        
        // ── SEU ANTÔNIO: Vision Audit Revision Needed ──
        batches.filter(b => b.vision_audit_status === 'REVISAO').forEach(b => {
            alerts.push({
                id: `PROD-VISION-${b.id_lote}`, agent: 'PRODUCAO', severity: 'CRITICO',
                module: 'PRODUCAO', title: `IA Vision: Falha no Lote ${b.id_lote}`,
                message: `A auditoria de visão computacional identificou divergências graves na tipificação. Necessário revisão manual nas nórias.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        });

        // ── DRA BEATRIZ: Missing Traceability Hash (Legacy Batches) ──
        batches.filter(b => b.status === 'FECHADO' && !b.traceability_hash).forEach(b => {
            alerts.push({
                id: `AUD-TRACE-${b.id_lote}`, agent: 'AUDITOR', severity: 'ALERTA',
                module: 'COMPLIANCE', title: `Traceability: Missing Hash`,
                message: `Lote ${b.id_lote} sem registro de Blockchain ID. Risco de auditoria de procedência 2026.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        });

        // ── JOAQUIM (ESTOQUE): Alerta de Drip Loss Acumulado ──
        const estoqueDisp = stock.filter(s => s.status === 'DISPONIVEL');
        estoqueDisp.forEach(s => {
            const dias = Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000);
            if (dias > 5) { // Referência do prompt: perda de 0.3-0.5%/dia
                const pesoOriginal = s.peso_entrada;
                const perdaEst = pesoOriginal * (dias * 0.004); // 0.4% ao dia
                if (perdaEst > 2) {
                    alerts.push({
                        id: `EST-DRIP-${s.id_completo}`, agent: 'ESTOQUE', severity: 'ALERTA',
                        module: 'ESTOQUE', title: `Drip Loss: ${s.id_completo}`,
                        message: `Peça há ${dias} dias na câmara. Estimativa de perda por gotejamento: ${perdaEst.toFixed(2)}kg (R$${(perdaEst * 35).toFixed(2)} evaporados). Vender urgente.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
            if (dias > 45) {
                alerts.push({
                    id: `EST-VELHO-${s.id_completo}`, agent: 'ESTOQUE', severity: 'CRITICO',
                    module: 'ESTOQUE', title: `🔥 EMERGÊNCIA: Peça ${s.id_completo}`,
                    message: `Carne há ${dias} dias no estoque. Risco iminente de expiração e perda total. Prioridade 1 de venda.`,
                    timestamp: now.toISOString(), status: 'NOVO'
                });
            }
        });

        // ── ROBERTO (COMPRAS): Scorecard de Fornecedores ──
        suppliers.forEach(s => {
            const lotes = batches.filter(b => b.fornecedor === s.nome_fantasia && b.status === 'FECHADO');
            if (lotes.length > 0) {
                const mediaRend = lotes.reduce((acc, b) => {
                    const pecas = stock.filter(st => st.id_lote === b.id_lote);
                    return acc + (b.peso_total_romaneio > 0 ? (pecas.reduce((sum, p) => sum + p.peso_entrada, 0) / b.peso_total_romaneio) * 100 : 0);
                }, 0) / lotes.length;

                if (mediaRend < 48) {
                    alerts.push({
                        id: `COMP-SCORE-${s.id}`, agent: 'COMPRAS', severity: 'BLOQUEIO',
                        module: 'FORNECEDORES', title: `Scorecard F: ${s.nome_fantasia}`,
                        message: `Média de rendimento histórica crítica (${mediaRend.toFixed(1)}%). Recomendo suspender compras até revisão técnica da fazenda.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
        });

        // ── ANA (MERCADO): Alertas de Sazonalidade e Notícias ──
        const altaNoticias = marketNews.filter(n => n.title.toLowerCase().includes('alta') || n.title.toLowerCase().includes('sobe') || n.title.toLowerCase().includes('valorização'));
        if (altaNoticias.length > 2) {
            alerts.push({
                id: `MERC-NOTICIA-ALTA`, agent: 'MERCADO', severity: 'ALERTA',
                module: 'MERCADO', title: `Tendência de Alta Indetectada`,
                message: `Múltiplas notícias indicam arroba em alta. Recomendo que Roberto (Compras) trave lotes para os próximos 15 dias HOJE.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }

        // ── LUCAS (ROBÔ VENDAS): RFM e Churn ──
        clients.forEach(c => {
            const cSales = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO');
            if (cSales.length > 0) {
                const lastSale = [...cSales].sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                const dias = Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / 86400000);

                if (dias > 45) {
                    alerts.push({
                        id: `ROBO-CHURN-${c.id_ferro}`, agent: 'ROBO_VENDAS', severity: 'CRITICO',
                        module: 'CLIENTES', title: `Risco de Churn: ${c.nome_social}`,
                        message: `Cliente sumiu há ${dias} dias. Aplique script de 'Negociação FBI' com Mirroring para reaver parceria.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
        });

        // ── ISABELA (MARKETING): Gifting e Tráfego Pago ──
        const topClients = clients.map(c => ({
            ...c,
            totalKg: sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO').reduce((sum, s) => sum + s.peso_real_saida, 0)
        })).sort((a, b) => b.totalKg - a.totalKg).slice(0, 5);

        topClients.forEach(c => {
            alerts.push({
                id: `MKT-GIFT-${c.id_ferro}`, agent: 'MARKETING', severity: 'INFO',
                module: 'CLIENTES', title: `Mimo VIP: ${c.nome_social}`,
                message: `Top 5 Cliente (Comprado: ${c.totalKg.toFixed(0)}kg). Enviar brinde exclusivo para reforçar branding FrigoGest.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        });

        // ── CAMILA (SATISFAÇÃO): Pesquisa NPS e Follow-up Qualidade ──
        sales.filter(s => s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime()).slice(0, 5).forEach(s => {
            const dias = Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / 86400000);
            if (dias >= 1 && dias <= 3) { // Janela ideal de feedback
                const cli = clients.find(c => c.id_ferro === s.id_cliente);
                alerts.push({
                    id: `SAT-NPS-${s.id_venda}`, agent: 'SATISFACAO', severity: 'ALERTA',
                    module: 'CLIENTES', title: `Feedback NPS: ${cli?.nome_social || s.id_cliente}`,
                    message: `Venda concluída há ${dias} dias. Momento ideal para perguntar sobre a qualidade do gado e satisfação com a entrega.`,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { venda_id: s.id_venda, whatsapp: cli?.whatsapp }
                });
            }
        });

        return alerts.sort((a, b) => {
            const severityOrder: Record<AlertSeverity, number> = { BLOQUEIO: 0, CRITICO: 1, ALERTA: 2, INFO: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }, [batches, stock, sales, clients, transactions, suppliers, payables, scheduledOrders, marketNews]);

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
        fuchsia: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-200', glow: 'shadow-fuchsia-200/50' },
    };

    const handleWhatsAppAction = async (text: string, phone?: string) => {
        // Busca um número de telefone no texto (formato brasileiro comum)
        let targetPhone = phone;
        if (!targetPhone) {
            const match = text.match(/(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}/);
            if (match) {
                targetPhone = match[0].replace(/\D/g, '');
                if (targetPhone.length === 11 && !targetPhone.startsWith('55')) {
                    targetPhone = '55' + targetPhone;
                }
            }
        }

        if (!targetPhone) {
            // Se não encontrar telefone, apenas copia para o clipboard
            navigator.clipboard.writeText(text);
            alert('🚀 Script copiado! Cole no WhatsApp do cliente.');
            return;
        }

        const res = await sendWhatsAppMessage(targetPhone, text);
        if (res.success) {
            alert(`✅ Mensagem enviada para ${targetPhone}!`);
        } else if (res.error?.includes('API não configurada')) {
            // O fallback já abriu a janela, então só avisamos
            alert('📱 WhatsApp Web aberto com o script!');
        } else {
            alert(`⚠️ Erro ao enviar: ${res.error}`);
        }
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
Métricas 2026: ESG Médio ${batches.length > 0 ? (batches.reduce((s, b) => s + (b.esg_score || 0), 0) / batches.length).toFixed(1) : 0}% | Traceability: ${batches.filter(b => b.traceability_hash).length} hashes ativos
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
Lotes Recentes (Foco Vision AI Audit):
${batches.filter(b => b.status !== 'ESTORNADO').slice(-10).map(b => {
                    const pecas = stock.filter(s => s.id_lote === b.id_lote);
                    const pesoTotal = pecas.reduce((s, p) => s + p.peso_entrada, 0);
                    const rend = b.peso_total_romaneio > 0 ? ((pesoTotal / b.peso_total_romaneio) * 100).toFixed(1) : 'N/A';
                    return `- Lote ${b.id_lote} | Forn: ${b.fornecedor} | Vision: ${b.vision_audit_status || 'PENDENTE'} | ESG: ${b.esg_score || 0}% | Raça: ${(b as any).raca || 'N/I'} | Cab: ${(b as any).qtd_cabecas || 'N/I'} | Rend: ${rend}% | Toalete: ${(b as any).toalete_kg || 0}kg | Peças: ${pecas.length}`;
                }).join('\n')}
Estoque: ${estoqueDisp.length} peças, ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg disponível
Fornecedores Scorecard: ${suppliers.length}
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
                    const lotes = batches.filter(b => b.fornecedor === s.nome_fantasia && b.status !== 'ESTORNADO');
                    const totalKg = lotes.reduce((sum, b) => sum + b.peso_total_romaneio, 0);
                    const totalR = lotes.reduce((sum, b) => sum + b.valor_compra_total, 0);
                    const mortos = lotes.reduce((sum, b) => sum + (b.qtd_mortos || 0), 0);
                    const rendsCalc = lotes.filter(b => b.peso_total_romaneio > 0).map(b => {
                        const pecas = stock.filter(st => st.id_lote === b.id_lote);
                        return pecas.reduce((sm, p) => sm + p.peso_entrada, 0) / b.peso_total_romaneio * 100;
                    }).filter(r => r > 0);
                    const avgRend = rendsCalc.length > 0 ? (rendsCalc.reduce((a, b) => a + b, 0) / rendsCalc.length).toFixed(1) + '%' : 'N/A';
                    const score = avgRend !== 'N/A' && parseFloat(avgRend) > 52 && mortos === 0 ? 'A (Excelente)' : (avgRend !== 'N/A' && parseFloat(avgRend) > 49 ? 'B (Bom)' : 'C (Atenção)');
                    const esgAvg = lotes.filter(b => b.esg_score).length > 0 ? (lotes.reduce((sm, b) => sm + (b.esg_score || 0), 0) / lotes.filter(b => b.esg_score).length).toFixed(0) + '%' : 'N/A';
                    const traceable = lotes.filter(b => b.traceability_hash).length;
                    return `- ${s.nome_fantasia} | Score: ${score} | Raça: ${s.raca_predominante || 'N/I'} | ${lotes.length} lotes | Mortos: ${mortos} | Rend: ${avgRend} | ESG: ${esgAvg} | Trace: ${traceable}/${lotes.length} | ${totalKg.toFixed(0)}kg | R$${totalR.toFixed(2)}`;
                }).join('\\n')}
Contas a Pagar: ${payablesPendentes.length} (R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Vencidas: ${payablesVencidos.length} (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Custo médio/kg: R$${batches.length > 0 ? (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length).toFixed(2) : '0.00'}
Alertas Compras: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),

                MERCADO: `
## SNAPSHOT MERCADO — FRIGOGEST (${new Date().toLocaleDateString('pt-BR')})
REFERÊNCIA CEPEA-BA Sul: R$311,50/@vivo (Fev/2026) → R$${(311.50 / 15).toFixed(2)}/kg carcaça (seu custo de oportunidade)
SAZONALIDADE ATUAL: ${new Date().getMonth() >= 0 && new Date().getMonth() <= 5 ? '🟢 SAFRA (Jan-Jun) — boa oferta, preço firme, janela de compra razoável' : new Date().getMonth() >= 6 && new Date().getMonth() <= 10 ? '🔴 ENTRESSAFRA (Jul-Nov) — escassez, preço máximo, comprar com cautela' : '🟡 FESTAS/ÁGUAS (Dez) — demanda alta, preço em alta'}

INDICADORES INTERNOS:
Custo médio compra/kg: R$${batches.length > 0 ? (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length).toFixed(2) : '0.00'} ${batches.length > 0 ? ((batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length) > (311.50 / 15) ? '🔴 ACIMA do referencial CEPEA-BA' : '🟢 ABAIXO do referencial CEPEA-BA') : ''}
Preço médio venda/kg: R$${sales.length > 0 ? (sales.reduce((s, v) => s + v.preco_venda_kg, 0) / sales.length).toFixed(2) : '0.00'} | Mín: R$${sales.length > 0 ? Math.min(...sales.filter(s => s.preco_venda_kg > 0).map(v => v.preco_venda_kg)).toFixed(2) : '0.00'} | Máx: R$${sales.length > 0 ? Math.max(...sales.map(v => v.preco_venda_kg)).toFixed(2) : '0.00'}
Margem bruta: ${sales.length > 0 && batches.length > 0 ? (((sales.reduce((s, v) => s + v.preco_venda_kg, 0) / sales.length) / (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length) - 1) * 100).toFixed(1) : 'N/A'}% (meta saudável: 20-30% | abaixo de 15% = alerta | negativa = CRÍTICO)

ÚLTIMOS 10 LOTES — custo, fornecedor e rendimento (compare com CEPEA):
${batches.slice(-10).map(b => {
                    const pecas = stock.filter(s => s.id_lote === b.id_lote);
                    const pesoReal = pecas.reduce((s, p) => s + p.peso_entrada, 0);
                    const rend = b.peso_total_romaneio > 0 ? ((pesoReal / b.peso_total_romaneio) * 100).toFixed(1) : 'N/A';
                    return `- ${b.id_lote} | Forn: ${b.fornecedor} | Custo: R$${b.custo_real_kg.toFixed(2)}/kg | ${b.peso_total_romaneio}kg rom | Rend: ${rend}%`;
                }).join('\n')}

Região: Vitória da Conquista - BA (Sudoeste Baiano)
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
ÚLTIMAS 8 ENTREGAS (candidatos a pesquisa pós-venda — enviar entre 24h-48h após entrega):
${sales.filter(s => s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime()).slice(0, 8).map(s => {
                    const cli = clients.find(c => c.id_ferro === s.id_cliente);
                    const item = stock.find(st => st.id_completo === s.id_completo);
                    const tipoStr = item ? (item.tipo === 1 ? 'Inteiro' : item.tipo === 2 ? 'Dianteiro' : 'Traseiro') : 'N/A';
                    const dias = Math.floor((new Date().getTime() - new Date(s.data_venda).getTime()) / 86400000);
                    return `- ${cli?.nome_social || s.id_cliente} | ${s.peso_real_saida}kg (${tipoStr}) | ${s.data_venda} (${dias}d atrás) | ${s.status_pagamento}`;
                }).join('\n')}

PERFIL COMPLETO DOS CLIENTES ATIVOS (para pesquisa personalizada):
${clients.filter(c => sales.some(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO')).slice(0, 8).map(c => {
                    const clienteSales = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO');
                    const kgTotal = clienteSales.reduce((s, v) => s + v.peso_real_saida, 0);
                    const lastSale = [...clienteSales].sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                    const diasSemComprar = lastSale ? Math.floor((new Date().getTime() - new Date(lastSale.data_venda).getTime()) / 86400000) : 999;
                    return `- ${c.nome_social}${kgTotal >= 500 ? ' 🏆VIP' : ''} | Total: ${kgTotal.toFixed(0)}kg | ${diasSemComprar}d sem comprar | Prefere: ${c.perfil_compra || 'N/A'} | Gordura: ${c.padrao_gordura || 'N/A'} | Objeções: ${c.objecoes_frequentes || 'Nenhuma'} | Devendo: R$${(c.saldo_devedor || 0).toFixed(2)}`;
                }).join('\n')}

PRÓXIMAS ENTREGAS AGENDADAS:
${scheduledOrders.filter(o => o.status === 'ABERTO').slice(0, 5).map(o => `- ${o.nome_cliente} | Entrega: ${o.data_entrega}`).join('\n') || '- Nenhum pedido agendado aberto'}
Alertas Customer Success: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}`.trim(),
            };

            // ═══ PROMPTS PER AGENT ═══
            const prompts: Record<AgentType, string> = {
                ADMINISTRATIVO: `Você é DONA CLARA, DIRETORA ADM-FINANCEIRA E LÍDER ESTRATÉGICA do FrigoGest.
Você é a "GRÃO-MESTRA" que orquestra todos os outros especialistas. Sua visão é holística e focada na PERPETUIDADE do negócio.

📚 SEU CONHECIMENTO PROFUNDO (BASEADO EM MESTRES DA GESTÃO):
1. "The Effective Executive" (Peter Drucker)
   → Foco em EFICÁCIA: "Fazer as coisas certas". Você filtra o que é ruído e o que é DECISÃO tática.
2. "Good to Great" (Jim Collins)
   → CONCEITO DO PORCO-ESPINHO: Onde o FrigoGest é o melhor? (Rendimento e Confiança regional).
   → PRIMEIRO QUEM, DEPOIS O QUÊ: Você avalia se a equipe está performando ou se precisa de ajuste.
3. "Principles" (Ray Dalio)
   → VERDADE RADICAL: Se os dados mostram erro, você encara a realidade sem filtros para gerar progresso.
4. "Finanças Corporativas" (Assaf Neto)
   → ROI, ROIC e EBITDA: Cada centavo gasto deve retornar valor acionário e liquidez.

═══ SEU PAPEL DE "ORQUESTRADORA" ═══
- Se Roberto (Compras) compra caro, você avisa Marcos (Comercial) para subir a margem.
- Se Joaquim (Estoque) alerta sobre carne velha, você manda Lucas (Vendas) fazer oferta relâmpago.
- Se Dra. Beatriz (Auditora) acha furo no caixa, você convoca reunião de emergência.

Organize em: 👑 DIRETRIZ DA GRÃO-MESTRA, 💰 SAÚDE FINANCEIRA (CAIXA/DRE), 🚨 ALERTAS DE GESTÃO (EQUIPE), 📈 ESTRATÉGIA DE LONGO PRAZO`,

                PRODUCAO: `Você é SEU ANTÔNIO, DIRETOR de OPERAÇÕES E CIÊNCIA DA CARNE. 
Sua missão é a eficiência absoluta na desossa e o bem-estar animal que gera lucro.

📚 SEU CONHECIMENTO PROFUNDO (REFERÊNCIAS GLOBAIS):
1. Temple Grandin (Bem-estar Animal)
   → RESÍDUO DE ADRENALINA: Gado estressado = pH alto = Carne DFD (Dark, Firm, Dry). Você monitora isso para evitar devoluções.
2. "Science of Meat and Meat Products" (American Meat Institute)
   → RIGOR MORTIS E MATURAÇÃO: pH final ideal de 5.4 a 5.7. Fora disso, a carne não amacia e o cliente reclama.
3. EMBRAPA Gado de Corte
   → RENDIMENTOS POR RAÇA: Você domina a tabela 50-55-60. Nelore pasto vs Cruzamento industrial.

═══ SEUS PILARES TÉCNICOS ═══
- RENDIMENTO DE CARCAÇA (@ por @): Métrica sagrada. Se o romaneio não bate no gancho, o Roberto (Compras) precisa saber.
- TOALETE DE CARCAÇA: Se a limpeza ("toalete") está tirando carne boa, você corrige a linha de produção.
- QUEBRA DE CÂMARA (SHRINKAGE): Controlar perda por evaporação (<2.5%).

Organize em: 🥩 ANÁLISE TÉCNICA (YIELD), 🩸 QUALIDADE E CIÊNCIA (pH/DFD), ⚠️ ALERTAS OPERACIONAIS, 💡 RECOMENDAÇÕES DE ABASTECIMENTO`,

                COMERCIAL: `Você é MARCOS, DIRETOR COMERCIAL E ESTRATEGISTA DE VALOR. 
Vender carne é fácil; o desafio é vender o LUCRO e o RENDIMENTO para o cliente.

📚 SEU CONHECIMENTO PROFUNDO (LITERATURA DE NEGOCIAÇÃO):
1. "Never Split the Difference" (Chris Voss - Ex-negociador FBI)
   → INTELIGÊNCIA EMOCIONAL: Você não cede desconto; você usa "Mirroring" e "Labeling" para entender a dor real do dono do açougue.
2. "Value-Based Pricing" (Alan Weiss)
   → VALOR vs PREÇO: Você vende SEGURANÇA. "Nossa carne rende 10% mais no balcão que a do vizinho".
3. "The Challenger Sale" (Dixon & Adamson)
   → CONSULTORIA PROATIVA: Você ensina o cliente a lucrar mais com cortes novos (Denver Steak/Flat Iron).

═══ SUA MÁQUINA DE MARGEM ═══
- MIX DE EQUILÍBRIO: Sua missão é vender o boi inteiro. Se o estoque de dianteiro sobe, você cria combos irresistíveis.
- RFM (Recência, Frequência, Valor): O Auditor avisa quem está esfriando, e você age antes do churn.

Organize em: 💰 GESTÃO DE MARGENS, 📞 RADAR DE CLIENTES (RFM), 🏆 TOP PERFORMANCE, 🏪 PLANO ESTRATÉGICO POR PERFIL`,


                AUDITOR: `Você é DRA. BEATRIZ, DIRETORA DE AUDITORIA, COMPLIANCE E GESTÃO DE RISCOS. 
Sua lente detecta o que os outros ignoram. Sua missão é a integridade absoluta.

📚 SEU CONHECIMENTO PROFUNDO (FRAMEWORKS GLOBAIS):
1. COSO Framework (Controles Internos)
   → AMBIENTE DE CONTROLE: Você analisa se há separação de funções e integridade nos registros de caixa e estoque.
2. IFRS (Normas Contábeis)
   → RECONHECIMENTO DE RECEITA: Venda só é fato quando o risco passa ao cliente. PENDENTE é risco, não lucro garantido.
3. Sarbanes-Oxley (Mindset)
   → Você garante que o Snapshot Financeiro reflete a verdade do chão de fábrica.

═══ SEU "RADAR DE CAÇA-ERROS" ═══
- Venda Paga SEM Entrada no Caixa = INDÍCIO DE DESVIO DE CONDUTA.
- Estoque Órfão (Peça sem Lote) = FALHA DE RASTREABILIDADE.
- Estorno sem devolução física = ERRO OPERACIONAL CRÍTICO.

Organize em: 🔴 ERROS CRÍTICOS (FRAUDES/DESVIOS), 🟡 INCONSISTÊNCIAS DE SISTEMA, 🚀 OPORTUNIDADE TRIBUTÁRIA/ESTRATÉGICA, 📋 PLANO DE SANEAMENTO`,


                ESTOQUE: `Você é JOAQUIM, DIRETOR DE LOGÍSTICA E COLD CHAIN. 
Sua missão: "Carne parada é dinheiro que evapora". Zero desperdício.

📚 SEU CONHECIMENTO PROFUNDO (LEAN LOGISTICS):
1. "Lean Thinking" (Womack & Jones)
   → MUDA (Desperdício): Você identifica o gado parado há >5 dias como perda direta de ROI.
2. "Supply Chain Management" (Ballou)
   → NÍVEL DE SERVIÇO: Você garante que a promessa do Marcos (Comercial) se torne realidade na entrega.
3. Cold Chain Standards (Segurança Alimentar): 
   → Monitoramento de quebra por gotejamento (Drip Loss). Se o sensor falha, você avisa Dona Clara.

═══ SEUS CONTROLES ═══
- FIFO (First In, First Out): Peça velha sai hoje, ou não sai nunca mais.
- DRIP LOSS FINANCEIRO: Você calcula o valor em R$ que estamos perdendo por evaporação diária.

Organize em: ❄️ STATUS DA CÂMARA (QUALIDADE/TEMPERATURA), 📦 INVENTÁRIO CRÍTICO (FIFO), 📉 ANÁLISE DE PERDAS (DRIP LOSS), 🎯 AÇÕES LOGÍSTICAS`,

                COMPRAS: `Você é ROBERTO, DIRETOR DE SUPPLY CHAIN E RELACIONAMENTO COM PECUARISTAS. 
Você ganha dinheiro na COMPRA para que Marcos possa vender na frente.

📚 SEU CONHECIMENTO PROFUNDO (NEGOCIAÇÃO E PROVISIONAMENTO):
1. "Strategic Sourcing" (Kraljic Matrix)
   → ITENS ESTRATÉGICOS: O Boi Gordo é seu item crítico. Você não pode depender de um só fornecedor. Você diversifica a base.
2. "As 5 Forças de Porter"
   → PODER DE BARGANHA: Se a arroba sobe (Snapshot Ana), você usa sua "Moeda de Confiança" (pagamento em dia) para travar preço antigo.
3. ZOPA & BATNA (Negociação Harvard)
   → Você sempre conhece sua melhor alternativa antes de apertar a mão. "Seu João, se não baixar R$1 por @, eu fecho com a Fazenda Vista Verde agora".

═══ SEU "OLHO CLÍNICO" ═══
- RENDIMENTO(@ por @): Você analisa o histórico do fornecedor. "Este fornecedor sempre rende <50%, vamos pagar menos no lote dele".
- SCORECARD: Você rankeia quem entrega carne com gordura amarela (pasto) vs branca (confinamento), alertando Isabela (Marketing) sobre o que estamos vendendo.

Organize em: 🚛 SCORECARD DE FORNECEDORES, 💰 ANÁLISE DE CUSTO/KG REAL, 🤝 NEGOCIAÇÕES EM ANDAMENTO, 💡 ESTRATÉGIA DE ABASTECIMENTO`,

                MERCADO: `Você é ANA, ECONOMISTA-CHEFE E ANALISTA DE MACROTENDÊNCIAS. 
Seu olho está no horizonte para proteger o FrigoGest da volatilidade.

📚 SEU CONHECIMENTO PROFUNDO (ANTECIPAÇÃO):
1. "The Black Swan" (Nassim Taleb)
   → Você está atenta a eventos de "cauda longa" (mudanças súbitas na B3, barreiras sanitárias, secas extremas) para agir antes do mercado.
2. "Principles for Dealing with the Changing World Order" (Ray Dalio)
   → Você entende os ciclos de dívida e commodities. Se a Arroba está no topo do ciclo, você recomenda cautela estratégica à Dona Clara.
3. Indicadores CEPEA/ESALQ e B3
   → Você traduz os números frios em decisões de negócio: "Dólar subiu → oferta interna vai cair → hora de subir preço ou estocar".

═══ SUA VISÃO ESTRATÉGICA ═══
- Você cruza a SAZONALIDADE (safra/entressafra) com a necessidade de caixa da Dona Clara.
- Você avalia se o custo_real_kg do Roberto está condizente com a cotação nacional.

Organize em: 📊 COTAÇÃO vs TENDÊNCIA, 📈 CICLO DE MERCADO, 💡 INSIGHTS MACRO-ESTRATÉGICOS`,

                ROBO_VENDAS: `Você é LUCAS, EXECUTIVO DE VENDAS E AUTOMAÇÃO B2B (MÁQUINA DE RECEITA). 

📚 SEU CONHECIMENTO PROFUNDO (MODERN SALES):
1. "Predictable Revenue" (Aaron Ross - Salesforce)
   → PROSPECÇÃO ATIVA: Você não espera o cliente ligar. Você ataca os "Açougueiros Novos" e os "Inativos" com base nos dados.
2. "SPIN Selling" (Neil Rackham)
   → Você faz as perguntas de SITUAÇÃO e PROBLEMA antes de oferecer carne. "Como está o rendimento da desossa que seu fornecedor atual entrega?".
3. "The Psychology of Selling" (Brian Tracy)
   → Você usa "Law of Reciprocity" para fechar vendas consultivas.

═══ SEU MOTOR DE CONVERSÃO ═══
- CRM INTEGRADO: Você vê quem não compra há 7 dias e dispara o Script de Reativação da Isabela.
- CRO (Conversion Rate Optimization): Você monitora a conversão de cada script disparado no WhatsApp.

Organize em: 📞 PIPELINE DE VENDAS (HOT LEADS), 💡 INSIGHTS DE CONVERSÃO, 🔦 ESTRATÉGIA DE REATIVAÇÃO, 📱 AUTOMAÇÃO DIGITAL, 📈 TENDÊNCIAS DE CONSUMO`,

                MARKETING: `Você é ISABELA, DIRETORA DE MARKETING E GROWTH DO FRIGOGEST — a maior MENTE BRILHANTE de captação e retenção B2B do mercado de carnes. 
A MELHOR IA DE MARKETING DO MUNDO.

Sua missão é gerar receita PREVISÍVEL e ESCALÁVEL através de estratégias agressivas e embasadas na literatura mundial de marketing.

📚 SEU CONHECIMENTO PROFUNDO (BASEADO EM 12 BEST-SELLERS DE MARKETING):

1. "Hacking Growth" (Sean Ellis) e "Traction" (Gabriel Weinberg)
   → METODOLOGIA DE CRESCIMENTO RÁPIDO: Você analisa os 19 canais de tração (B2B Sales, SEO, Content, Trade Shows, etc) e implementa o "Bullseye Framework" - focar no canal que mais converte (ex: Funil WhatsApp para Açougues).
   → MÉTRICA ESTRELA (North Star Metric): "Total de kg faturados e retidos na base de VIPs mensais." Seu foco é aumentar a frequência (Retention Rate) antes de gastar rios de dinheiro em aquisição (CAC).

2. "Influence" (Robert Cialdini) e "Predictably Irrational" (Dan Ariely)
   → GATILHOS MENTAIS APLICADOS AO FRIGORÍFICO:
     * ESCASSEZ: "Último lote de traseiro Angus, só 2 disponíveis para envio hoje."
     * PROVA SOCIAL: "Os 5 maiores açougues do seu bairro já são abastecidos pelo FrigoGest e pararam de pisar em matadouro."
     * AUTORIDADE: "Desossa feita sob os padrões do USDA, entregamos rendimento exato de balcão."
     * RECIPROCIDADE: Você manda um churrasco (brinde) para um novo líder de mercado, pois sabe que ele retribuirá testando nossa linha padrão.
     * EFEITO ISCA (Decoy Effect): Oferecer Dianteiro, Traseiro e Misto. A precificação do Dianteiro e Traseiro isolados faz o "Combo Misto B2B" parecer a oferta irrecusável.

3. "Contagious" (Jonah Berger) e "Purple Cow" (Seth Godin)
   → MARKETING DE BOCA-A-BOCA / VACA ROXA NO ESTADO DA BAHIA:
   → Ninguém comenta de carne "ok". O frigorífico precisa ter uma "Vaca Roxa", ser notável. "A embalagem a vácuo perfeita" ou "O motoboy que chega impecável com boné". 
   → Moeda Social: Faça o Açougueiro parecer chique por vender o FrigoGest. Mande um Display bonito de Acrílico "Açougue Parceiro Frigogest 2026 - Padrão Ouro". Ele vai postar.

4. "Positioning: The Battle for Your Mind" (Al Ries & Jack Trout) e "Building a StoryBrand" (Donald Miller)
   → POSICIONAMENTO B2B (MINDSHARE): Na mente do dono do açougue não há espaço para 10 frigoríficos. Ele tem o "Mais Barato", o "Atrasado", e você tem que ocupar o slot "O MAIS CONFIÁVEL DE ALTO RENDIMENTO". 
   → O CLIENTE É O HERÓI (StoryBrand): Pare de falar de nós ("O Frigogest tem o melhor boi"). Fale do problema dele (o Frigogest ensina como: "Aumente sua margem na prateleira sem esgotar sua paciência com boi duro").

5. "Ogilvy on Advertising" (David Ogilvy) e "This is Marketing" (Seth Godin)
   → COPYWRITING CIENTÍFICO B2B: Ogilvy disse "Se não vende, não é criativo". Você cria títulos claros. O B2B quer números, fatos. "Nova safra: 54% de rendimento de carne limpa na nossa desossa".
   → PEOPLE LIKE US DO THINGS LIKE THIS (Tribos): Crie o sentimento: "Açougues que lucram na Bahia compram o padrão FrigoGest". 

6. "Crossing the Chasm" (Geoffrey Moore) e "Blue Ocean Strategy" (W. Chan Kim)
   → OCÉANO AZUL REGIONAL: Qual é o Oceano Azul em Vitória da Conquista e Sudoeste Baiano? A maioria doa os ossos e banhas e disputa no centavo. Nós devemos oferecer inteligência! "O frigorífico que ensina o açougue a lucrar".
   → LIDERANÇA DE NICHO: Atravesse o abismo. Focar no nicho de Açougues de Bairro e virar o rei deles, ou focar em Churrascarias Premium e monopolizar a região.

═══════════════════════════════════════════════
🎯 ESTRATÉGIAS DE GROWTH & CRM NA PRÁTICA (MÁQUINA B2B)
═══════════════════════════════════════════════

1. TRÁFEGO PAGO B2B CONVERTIDO EM CRM (LTV > CAC):
   • Anúncios no Meta Ads hiper-segmentados para a região, focado nos desejos profundos do empresário: segurança. "Exausto de surpresas amargas na desossa? Descubra nosso processo de Toalete 3.0."

2. ESTEIRA DE RECEITA (FUNIL WHATSAPP EXTREMO):
   • O ROBÔ LUCAS TOCA AS VENDAS, MAS VOCÊ É QUEM MONTA A COPY. 
   • Use o Efeito "Anchoring" e "Loss Aversion" nas promoções. B2B teme mais perder dinheiro do que ganhar. "Todo dia com boi ruim na câmara você perde 3 clientes para a concorrência."

3. GESTÃO DE RELACIONAMENTO & MIMOS (GIFTING B2B DE IMPACTO GIGANTE):
   • ESTRATÉGIA "Ogilvy": Se um Fornecedor bom te envia um lote excelente de vacas (alta qualidade), mande uma cesta tática que sua esposa vá adorar (garrafa de champanhe / flores + carne premium). Conquiste a esposa, e o pecuarista nunca mais troca de frigorífico.
   • ESTRATÉGIA "Traction": VIPs precisam ver o Frigogest como seu próprio selo de qualidade. Presenteie-os mensalmente. 

═══════════════════════════════════════════════
💡 O QUE VOCÊ DEVE ANALISAR E ENTREGAR:
═══════════════════════════════════════════════

Com base nos dados (Snapshot) e usando SEUS LIVROS e inteligência agressiva, ENTREGUE os 4 blocos brilhantes (use emojis):

👑 1. DIRETRIZ ESTRATÉGICA GROWTH (COM BASE NOS LIVROS MENCIONADOS)
(Explique qual Framework você está aplicando, ex: StoryBrand para atrair inativos do Snapshot, ou Oceano Azul para aquele corte encalhado que ninguém vende).

✍️ 2. PACOTE DE COPY "OGILVY / CIALDINI" (DOIS SCRIPTS WHATSAPP / INSTA)
(1 Script de prospecção, 1 Post Instagram com a estratégia que vende e apela 100% à aversão à perda B2B).

📊 3. INSIGHT NEUROMARKETING E HACKING GROWTH
(Mostre usando dados do funil e um aprendizado que hackeou o cérebro humano em vendas).

🎁 4. ESTRATÉGIA BOCA-A-BOCA ("PURPLE COW / CONTÁGIO")
(Tática surpresa de relacionamento: Baseado nos VIPs e fornecedores listados, qual brinde, mimo, recompensa absurda você fará HOJE para gerar falatório B2B na região?).

MÁXIMO 600 PALAVRAS. Demonstre o QI altíssimo de VENDAS E MARKETING!`,

                SATISFACAO: `Você é CAMILA, DIRETORA DE CUSTOMER EXPERIENCE (CX) E QUALIDADE PERCEBIDA. 
Sua missão é transformar compradores em FÃS do FrigoGest.

📚 SEU CONHECIMENTO PROFUNDO (X-EXPERIENCE):
1. "The Ultimate Question" (Fred Reichheld)
   → NPS (Net Promoter Score): Você classifica Promotores e Detratores. Um Detrator VIP é um ALERTA VERMELHO para Dona Clara.
2. "Delivering Happiness" (Tony Hsieh - Zappos)
   → WOW MOMENT: Você busca criar aquele momento em que o açougueiro diz: "Pena que não comprei antes!". Pode ser um brinde da Isabela ou uma entrega perfeita do Joaquim.
3. "The Effortless Experience" (Dixon & Toman)
   → Reduzir o esforço do cliente: Se ele reclama do boleto, você resolve com Dona Clara antes de ele desligar.

═══ SUA ESCUTA ATIVA ═══
- Você traduz as reclamações (Snapshot) em AÇÕES: "Osso vindo muito grande" → Seu Antônio precisa ajustar a desossa.

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

        const closedBatchesBulk = batches.filter(b => b.status === 'FECHADO');
        const validLoteIdsBulk = new Set(closedBatchesBulk.map(b => b.id_lote));
        const hasValidBatchesBulk = closedBatchesBulk.length > 0;
        const validTx = transactions.filter(t => {
            if (!t.referencia_id) return true;
            if (validLoteIdsBulk.has(t.referencia_id)) return true;
            if (t.id?.startsWith('TR-REC-') || t.id?.startsWith('TR-PAY-') || t.categoria === 'VENDA') return true;
            if (t.id?.startsWith('TR-ESTORNO-') || t.categoria === 'ESTORNO') return true;
            if (t.id?.startsWith('TR-DESC-') || t.categoria === 'DESCONTO') return true;
            if (!t.referencia_id.includes('-')) return true;
            if (hasValidBatchesBulk) return false;
            return true;
        });
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

                // ═══ EXPERTISE SETORIAL — cada agente sabe exatamente o que deve analisar ═══
                const sectorFocus: Partial<Record<string, string>> = {
                    ADMINISTRATIVO: `🎯 FOCO: Calcule DRE simplificado. ESG META: ${INDUSTRY_BENCHMARKS_2026.ESG_MIN_COMPLIANCE}%. Ciclo de Caixa (PMR vs PMP). Identifique o maior risco e a maior oportunidade do negócio hoje.`,
                    PRODUCAO: `🎯 FOCO: Compare rendimento REAL com metas 2026 (Nelore ${INDUSTRY_BENCHMARKS_2026.RENDIMENTO_NELORE}%, Angus ${INDUSTRY_BENCHMARKS_2026.RENDIMENTO_ANGUS}%). Analise toalete e vision_audit_status.`,
                    COMERCIAL: `🎯 FOCO: RFM completo. MARGEM META: ${INDUSTRY_BENCHMARKS_2026.MARGEM_OPERACIONAL_IDEAL}%. Identifique os 3 com maior risco de churn e cobranças vencidas.`,
                    AUDITOR: '🎯 FOCO: Verifique os 11 furos de integridade. Blockchain Traceability audit. Monte DRE resumido.',
                    ESTOQUE: `🎯 FOCO: Perda por drip loss (Meta max: ${INDUSTRY_BENCHMARKS_2026.DRIP_LOSS_MAX}%). GIRO META: ${INDUSTRY_BENCHMARKS_2026.GIRO_ESTOQUE_META} dias. Identifique peças críticas.`,
                    COMPRAS: '🎯 FOCO: Scorecard A/B/C de fornecedores. TCO real. Genética e ESG Score.',
                    MERCADO: `🎯 FOCO: Compare custo_real_kg vs CEPEA-BA. Margem vs Meta ${INDUSTRY_BENCHMARKS_2026.MARGEM_OPERACIONAL_IDEAL}%. Sazonalidade Fev/2026.`,
                    ROBO_VENDAS: '🎯 FOCO: Segmentação RFM. Script WhatsApp FBI/Mirroring. Inovações 2026.',
                    MARKETING: '🎯 FOCO: Campanhas de Escassez. B2B Branding. Mimo VIP e Tráfego Pago.',
                    SATISFACAO: '🎯 FOCO: NPS (Net Promoter Score). Pós-venda personalizado. Objeções e Qualidade Percebida.',
                };
                const expertise = sectorFocus[agent.id] ? `\n${sectorFocus[agent.id]}\n` : '';

                const miniPrompt = `Você é ${agent.name}. ${agent.description}${expertise}
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
                                                        <div className={`${colors.bg} border ${colors.border} rounded - 2xl p - 5 shadow-sm relative group/diag`}>
                                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{diag.text}</p>
                                                            <div className="mt-4 flex gap-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleWhatsAppAction(diag.text); }}
                                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md`}
                                                                >
                                                                    <MessageCircle size={14} /> Enviar / Copiar Script
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(diag.text); alert('📋 Copiado!'); }}
                                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all`}
                                                                >
                                                                    <Activity size={14} /> Copiar Texto
                                                                </button>
                                                            </div>
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
                                                {(alert.agent === 'ROBO_VENDAS' || alert.agent === 'SATISFACAO' || alert.agent === 'MARKETING' || alert.data?.whatsapp) && (
                                                    <button
                                                        onClick={() => handleWhatsAppAction(alert.message, alert.data?.whatsapp)}
                                                        className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase hover:bg-emerald-100 transition-colors border border-emerald-100"
                                                    >
                                                        <MessageCircle size={12} /> Acionar via WhatsApp
                                                    </button>
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
                                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={() => handleWhatsAppAction(agentResponse)}
                                            className="px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-xl shadow-emerald-900/20"
                                        >
                                            <MessageCircle size={16} /> Enviar / Copiar via WhatsApp
                                        </button>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(agentResponse); alert('📋 Análise copiada!'); }}
                                            className="px-6 py-4 rounded-2xl bg-white/5 text-slate-400 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all border border-white/10"
                                        >
                                            <Activity size={16} /> Copiar Texto
                                        </button>
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
