import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    ArrowLeft, Brain, Shield, TrendingUp, BarChart3,
    Bell, CheckCircle, AlertTriangle, XCircle, Eye,
    ChevronRight, Activity, Zap, Settings,
    Clock, Package, Users, DollarSign, Truck,
    Calendar, MessageCircle, ShieldCheck, Beef, Bot,
    Loader2, Send, Sparkles
} from 'lucide-react';
import { runCascade } from '../services/llmCascade';
import { fetchAllNews, formatNewsForAgent, NewsItem } from '../services/newsService';
import { sendWhatsAppMessage } from '../utils/whatsappAPI';
import { OPERATION_CONTEXT, OPERATION_SUMMARY } from '../operationConfig';
import { INDUSTRY_BENCHMARKS_2026 } from '../constants';
import { getAgentMemories, saveAgentMemory, formatMemoriesForPrompt, extractInsightsFromResponse, countAgentMemories } from '../services/agentMemoryService';
import { AgentMemory } from '../types';
import { parseActionsFromResponse, DetectedAction, generateWhatsAppLink } from '../services/actionParserService';
import { calculatePredictions, formatPredictionsForPrompt, PredictiveSnapshot } from '../utils/predictions';
import { WHATSAPP_TEMPLATES, generateCatalogFromStock, suggestTemplateForClient, generateWhatsAppLinkFromTemplate, TemplateType } from '../services/whatsappCommerceService';
import { generateContent, detectContentRequest, GeneratedContent, ContentStudioRequest } from '../services/contentStudioService';
import ContentStudioModal from './ContentStudioModal';
import { generateDRE, formatDREText, calculateESGScore, COMPLIANCE_CHECKLIST, DREReport } from '../services/complianceService';
import { calcularPrecificacao, formatPrecificacaoForPrompt, PrecificacaoItem } from '../services/pricingEngine';
import { calculateClientScores, formatRFMForPrompt, getClientTierSummary, ClientScore } from '../services/clientScoringService';
import {
    PROMPT_ADMINISTRATIVO, PROMPT_PRODUCAO, PROMPT_COMERCIAL, PROMPT_AUDITOR,
    PROMPT_ESTOQUE, PROMPT_COMPRAS, PROMPT_MERCADO, PROMPT_MARKETING,
    PROMPT_SATISFACAO, PROMPT_COBRANCA, PROMPT_WHATSAPP_BOT, PROMPT_JURIDICO,
    PROMPT_FLUXO_CAIXA, PROMPT_RH_GESTOR, PROMPT_FISCAL_CONTABIL, PROMPT_QUALIDADE
} from '../agentPrompts';

// re-export para compatibilidade com AIChat.tsx
export { runCascade } from '../services/llmCascade';

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

// ═══ DEFAULT AGENT CONFIGURATIONS (Reestruturado: 12 core + 1 orquestração + 3 opcionais) ═══
const DEFAULT_AGENTS: AgentConfig[] = [
    // ═══ CORE: 12 agentes com LLM ═══
    {
        id: 'ADMINISTRATIVO', name: 'Dona Clara',
        description: 'Administradora-Geral — Orquestradora Multi-Agente (MAO). Visão 360°, DRE, EBITDA, OKRs.',
        icon: '🧠', color: 'blue', enabled: true,
        systemPrompt: PROMPT_ADMINISTRATIVO,
        modules: ['LOTES', 'ESTOQUE', 'CLIENTES', 'VENDAS', 'PEDIDOS', 'FORNECEDORES', 'FINANCEIRO', 'CADEIA_ABATE', 'AUDITORIA'],
        triggerCount: 19,
    },
    {
        id: 'PRODUCAO', name: 'Seu Antônio',
        description: 'Chefe de Produção 4.0 — Rendimento de carcaça, tipificação, tabela EMBRAPA.',
        icon: '🥩', color: 'emerald', enabled: true,
        systemPrompt: PROMPT_PRODUCAO,
        modules: ['LOTES', 'ESTOQUE', 'FORNECEDORES'],
        triggerCount: 6,
    },
    {
        id: 'COMERCIAL', name: 'Marcos',
        description: 'Diretor Comercial+ — Pricing dinâmico, CRM/RFM, Growth Sales, Analytics. (Absorve Lucas + Bruno Analytics)',
        icon: '🤝', color: 'cyan', enabled: true,
        systemPrompt: PROMPT_COMERCIAL,
        modules: ['CLIENTES', 'VENDAS', 'PEDIDOS', 'MARKETING'],
        triggerCount: 16,
    },
    {
        id: 'AUDITOR', name: 'Dra. Beatriz',
        description: 'Auditora+ — Forensic accounting, estornos, vendas suspeitas, integridade cross-módulo. (Absorve Patrícia + Eduardo + Ana Luiza)',
        icon: '⚖️', color: 'rose', enabled: true,
        systemPrompt: PROMPT_AUDITOR,
        modules: ['FINANCEIRO', 'VENDAS', 'AUDITORIA', 'ESTOQUE', 'LOTES'],
        triggerCount: 11,
    },
    {
        id: 'ESTOQUE', name: 'Joaquim',
        description: 'Gerente de Estoque+ — FIFO/FEFO, Lean, Drip Loss, detecção de furos na cadeia. (Absorve Carlos Auditor)',
        icon: '📦', color: 'orange', enabled: true,
        systemPrompt: PROMPT_ESTOQUE,
        modules: ['ESTOQUE', 'CADEIA_ABATE', 'LOTES'],
        triggerCount: 5,
    },
    {
        id: 'COMPRAS', name: 'Roberto',
        description: 'Diretor de Suprimentos+ — Kraljic, TCO, BATNA, validação de lotes. (Absorve Sandra)',
        icon: '🛒', color: 'violet', enabled: true,
        systemPrompt: PROMPT_COMPRAS,
        modules: ['FORNECEDORES', 'LOTES', 'FINANCEIRO'],
        triggerCount: 8,
    },
    {
        id: 'MERCADO', name: 'Ana',
        description: 'Inteligência de Mercado — Macroeconomia B2B, riscos geopolíticos, CEPEA/B3.',
        icon: '📈', color: 'blue', enabled: true,
        systemPrompt: PROMPT_MERCADO,
        modules: ['MERCADO', 'FINANCEIRO'],
        triggerCount: 3,
    },
    {
        id: 'MARKETING', name: 'Isabela',
        description: 'CMO 360°+ — Copy, social media, email, SEO, influencer, media buying, branding, parcerias. (Absorve 10 sub-agentes)',
        icon: '✨', color: 'fuchsia', enabled: true,
        systemPrompt: PROMPT_MARKETING,
        modules: ['MARKETING', 'CLIENTES', 'MERCADO', 'VENDAS'],
        triggerCount: 14,
    },
    {
        id: 'SATISFACAO', name: 'Camila',
        description: 'Customer Experience — NPS, CSAT, CES, protocolo de recovery. Gera pesquisas WhatsApp.',
        icon: '🌸', color: 'rose', enabled: true,
        systemPrompt: PROMPT_SATISFACAO,
        modules: ['SATISFACAO', 'CLIENTES'],
        triggerCount: 9,
    },
    {
        id: 'COBRANCA', name: 'Diana',
        description: 'Cobradora Inteligente — Mensagens personalizadas por perfil (Ouro/Prata/Bronze/Risco).',
        icon: '💰', color: 'amber', enabled: true,
        systemPrompt: PROMPT_COBRANCA,
        modules: ['FINANCEIRO', 'CLIENTES'],
        triggerCount: 0,
    },
    {
        id: 'WHATSAPP_BOT', name: 'Wellington',
        description: 'Bot WhatsApp — Respostas automáticas para consultas de preço, status, catálogo.',
        icon: '📱', color: 'green', enabled: true,
        systemPrompt: PROMPT_WHATSAPP_BOT,
        modules: ['CLIENTES', 'VENDAS', 'ESTOQUE'],
        triggerCount: 0,
    },
    {
        id: 'JURIDICO', name: 'Dra. Carla',
        description: 'Advogada Chefe+ — Direito Agroindustrial, Sanitário (SIF/ADAB), Trabalhista (NR-36), Contratos. (Absorve Dr. Rafael + Dra. Patrícia)',
        icon: '⚖️', color: 'indigo', enabled: true,
        systemPrompt: PROMPT_JURIDICO,
        modules: ['FINANCEIRO', 'CLIENTES', 'ADMINISTRATIVO'],
        triggerCount: 0,
    },
    // ═══ ORQUESTRAÇÃO ═══
    {
        id: 'FLUXO_CAIXA', name: 'Mateus',
        description: 'Tesoureiro — Fluxo de caixa, inadimplência, previsão de capital. Usado na cadeia de orquestração.',
        icon: '💵', color: 'emerald', enabled: true,
        systemPrompt: PROMPT_FLUXO_CAIXA,
        modules: ['FINANCEIRO', 'CLIENTES', 'FORNECEDORES'],
        triggerCount: 0,
    },
    // ═══ OPCIONAIS (ativar quando houver módulo específico) ═══
    {
        id: 'RH_GESTOR', name: 'João Paulo',
        description: 'Gestor de RH — CLT, NR-36, folha de pagamento.',
        icon: '👥', color: 'blue', enabled: false,
        systemPrompt: PROMPT_RH_GESTOR,
        modules: ['ADMINISTRATIVO'],
        triggerCount: 0,
    },
    {
        id: 'FISCAL_CONTABIL', name: 'Mariana',
        description: 'Contadora Tributária — Simples Nacional, ICMS, PIS/COFINS, SPED.',
        icon: '📑', color: 'green', enabled: false,
        systemPrompt: PROMPT_FISCAL_CONTABIL,
        modules: ['FINANCEIRO', 'ADMINISTRATIVO'],
        triggerCount: 0,
    },
    {
        id: 'QUALIDADE', name: 'Dr. Ricardo',
        description: 'Médico Veterinário — HACCP, BPF, RIISPOA, microbiologia.',
        icon: '🩺', color: 'teal', enabled: false,
        systemPrompt: PROMPT_QUALIDADE,
        modules: ['ESTOQUE', 'LOTES', 'ADMINISTRATIVO'],
        triggerCount: 0,
    },
];



const AIAgents: React.FC<AIAgentsProps> = ({
    onBack, batches, stock, sales, clients, transactions, suppliers, payables, scheduledOrders
}) => {
    const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'config'>('overview');
    const [agents] = useState<AgentConfig[]>(DEFAULT_AGENTS);
    const [agentResponse, setAgentResponse] = useState<string | null>(null);
    const [detectedActions, setDetectedActions] = useState<DetectedAction[]>([]);
    const [actionConfirm, setActionConfirm] = useState<DetectedAction | null>(null);
    // ─── Content Studio (Isabela) ───
    const [studioContent, setStudioContent] = useState<GeneratedContent | null>(null);
    const [studioLoading, setStudioLoading] = useState(false);
    const [studioRequest, setStudioRequest] = useState<ContentStudioRequest | null>(null);
    const [actionLog, setActionLog] = useState<{ action: string; time: Date }[]>([]);
    const [agentLoading, setAgentLoading] = useState(false);
    const [agentError, setAgentError] = useState<string | null>(null);
    const [consultingAgent, setConsultingAgent] = useState<AgentType | null>(null);
    const agentResultRef = useRef<HTMLDivElement>(null);

    // ═══ AUTOMAÇÃO — ESTADO POR AGENTE ═══
    const [agentDiagnostics, setAgentDiagnostics] = useState<Record<string, { text: string; provider: string; timestamp: Date }>>({});
    const [memoryCounts, setMemoryCounts] = useState<Record<string, number>>({});

    // Load memory counts on mount
    useEffect(() => {
        const loadCounts = async () => {
            const counts: Record<string, number> = {};
            for (const agent of agents) {
                counts[agent.id] = await countAgentMemories(agent.id as any);
            }
            setMemoryCounts(counts);
        };
        loadCounts();
    }, [agents]);
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; currentAgent: string }>({ current: 0, total: 0, currentAgent: '' });
    const [autoRunDone, setAutoRunDone] = useState(false);
    // FASE 4: Multi-Agent Debate
    const [debateSynthesis, setDebateSynthesis] = useState<{ text: string; provider: string; timestamp: Date } | null>(null);
    const [debateRunning, setDebateRunning] = useState(false);
    // FASE 5: WhatsApp Commerce
    const [selectedWaTemplate, setSelectedWaTemplate] = useState<TemplateType | null>(null);
    const [selectedWaClient, setSelectedWaClient] = useState<string>('');
    const [waPreview, setWaPreview] = useState<string>('');
    // FASE 6: Compliance & DRE
    const [drePeriodo, setDrePeriodo] = useState<'SEMANA' | 'MES' | 'TOTAL'>('MES');
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
                    id: `ADM - LOTE - ${b.id_lote} `, agent: 'ADMINISTRATIVO', severity: 'ALERTA',
                    module: 'LOTES', title: `Lote ${b.id_lote} sem peças`,
                    message: `Lote aberto há ${daysSince} dias sem peças registradas no estoque.Verificar desossa.`,
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
                        id: `ADM - CLI - ${c.id_ferro} `, agent: 'ADMINISTRATIVO', severity: 'INFO',
                        module: 'CLIENTES', title: `Cliente ${c.nome_social} inativo`,
                        message: `Sem compras há ${daysSince} dias.Considere reativar contato.`,
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
                id: `ADM - PED - ${o.id} `, agent: 'ADMINISTRATIVO', severity: 'CRITICO',
                module: 'PEDIDOS', title: `Pedido amanhã sem confirmar!`,
                message: `Pedido de ${o.nome_cliente} para ${tomorrowStr} ainda está ABERTO.Confirmar urgente!`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        });

        // ── ADMINISTRATIVO: Fornecedores sem dados bancários ──
        suppliers.forEach(s => {
            if (!s.dados_bancarios) {
                alerts.push({
                    id: `ADM - FORN - ${s.id} `, agent: 'ADMINISTRATIVO', severity: 'ALERTA',
                    module: 'FORNECEDORES', title: `${s.nome_fantasia} sem PIX / Banco`,
                    message: `Fornecedor sem dados bancários cadastrados.Pode atrasar pagamentos.`,
                    timestamp: now.toISOString(), status: 'NOVO'
                });
            }
        });

        // ── ADMINISTRATIVO: Estoque parado > 30 dias ──
        stock.filter(s => s.status === 'DISPONIVEL').forEach(s => {
            const daysSince = Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000);
            if (daysSince > 30) {
                alerts.push({
                    id: `ADM - STK - ${s.id_completo} `, agent: 'ADMINISTRATIVO', severity: 'ALERTA',
                    module: 'ESTOQUE', title: `Peça ${s.id_completo} parada`,
                    message: `No frio há ${daysSince} dias.Risco de perda de qualidade.Peso: ${s.peso_entrada} kg.`,
                    timestamp: now.toISOString(), status: 'NOVO'
                });
            }
        });

        // ── DONA CLARA: ESG Score Below Target ──
        batches.filter(b => b.status === 'FECHADO' && (b.esg_score || 0) < INDUSTRY_BENCHMARKS_2026.ESG_MIN_COMPLIANCE).forEach(b => {
            alerts.push({
                id: `ADM - ESG - ${b.id_lote} `, agent: 'ADMINISTRATIVO', severity: 'ALERTA',
                module: 'GOVERNANCA', title: `ESG Score Abaixo da Meta`,
                message: `Lote ${b.id_lote} com score ESG de ${(b.esg_score || 0)}%.Meta 2026: ${INDUSTRY_BENCHMARKS_2026.ESG_MIN_COMPLIANCE}% para exportação.`,
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
                    id: `COM - VNC - ${s.id_venda} `, agent: 'COMERCIAL', severity: 'CRITICO',
                    module: 'VENDAS', title: `Cobrança: ${s.nome_cliente || s.id_cliente} `,
                    message: `Venda ${s.id_venda} vencida há ${diasAtraso} dias.Valor: R$${total.toFixed(2)} `,
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
                        id: `COM - CRED - ${c.id_ferro} `, agent: 'COMERCIAL', severity: 'BLOQUEIO',
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
                    id: `AUD - FURO - ${s.id_venda} `, agent: 'AUDITOR', severity: 'CRITICO',
                    module: 'FINANCEIRO', title: `FURO: Venda ${s.id_venda} `,
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
                    id: `AUD - LOTE - ${b.id_lote} `, agent: 'AUDITOR', severity: 'CRITICO',
                    module: 'FINANCEIRO', title: `Lote ${b.id_lote} sem saída`,
                    message: `Lote comprado sem Transaction SAIDA nem Payable vinculado.Valor: R$${b.valor_compra_total.toFixed(2)} `,
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
                    id: `AUD - PAY - ${p.id} `, agent: 'AUDITOR', severity: 'ALERTA',
                    module: 'FINANCEIRO', title: `Dívida vencida: ${p.descricao} `,
                    message: `Payable vencido há ${diasAtraso} dias.Valor: R$${p.valor.toFixed(2)}.Fornecedor: ${p.fornecedor_id || 'N/A'} `,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { valor: p.valor, dias_atraso: diasAtraso }
                });
            }
        });

        // ── PRODUÇÃO (SEU ANTÔNIO): Rendimento Carcaça vs Referência EMBRAPA ──
        // FÓRMULA CORRETA: Rendimento = (Peso Carcaça / Peso Vivo Total) × 100
        // Só calcula se peso vivo for informado (qtd_cabecas × peso_vivo_medio)
        // Nunca usar peso_romaneio como denominador (daria ~100%, que é absurdo)
        batches.filter(b => b.status === 'FECHADO').forEach(b => {
            const qtdCabecas = (b as any).qtd_cabecas || 0;
            const pesoVivoMedio = (b as any).peso_vivo_medio || 0;
            const pesoGancho = (b as any).peso_gancho || 0;

            // Só calcula rendimento se tiver peso vivo cadastrado
            if (qtdCabecas > 0 && pesoVivoMedio > 0) {
                const pesoVivoTotal = qtdCabecas * pesoVivoMedio;
                const pesoCarcaca = pesoGancho > 0 ? pesoGancho : b.peso_total_romaneio;
                const rendimento = (pesoCarcaca / pesoVivoTotal) * 100;

                // Valida intervalo real (48-62% é normal para gado bovino)
                if (rendimento < 40 || rendimento > 70) {
                    alerts.push({
                        id: `PROD - REND - DADOS - ${b.id_lote} `, agent: 'PRODUCAO', severity: 'ALERTA',
                        module: 'LOTES', title: `⚠️ Rendimento fora do intervalo: ${b.id_lote}`,
                        message: `Rendimento calculado: ${rendimento.toFixed(1)}% — valor improvável(esperado 48 - 62 %).Verifique os dados: Peso vivo total = ${pesoVivoTotal} kg, Peso carcaça = ${pesoCarcaca} kg.Possível erro de cadastro.`,
                        timestamp: now.toISOString(), status: 'NOVO',
                        data: { rendimento, pesoVivoTotal, pesoCarcaca }
                    });
                } else {
                    const racaRef = BREED_REFERENCE_DATA.find(r => r.raca === b.raca);
                    if (racaRef && rendimento < racaRef.rendimento_min) {
                        alerts.push({
                            id: `PROD - REF - ${b.id_lote} `, agent: 'PRODUCAO', severity: 'CRITICO',
                            module: 'LOTES', title: `⚠️ Rendimento Crítico: ${b.id_lote} `,
                            message: `Rendimento de carcaça ${rendimento.toFixed(1)}% está ABAIXO da referência EMBRAPA para ${b.raca} (mínimo ${racaRef.rendimento_min}%). Peso vivo: ${pesoVivoTotal} kg → Gancho: ${pesoCarcaca} kg.Fornecedor: ${b.fornecedor}. Possível quebra excessiva ou romaneio inflado.`,
                            timestamp: now.toISOString(), status: 'NOVO',
                            data: { rendimento, raca: b.raca }
                        });
                    } else if (rendimento < 49) {
                        alerts.push({
                            id: `PROD - REND - ${b.id_lote} `, agent: 'PRODUCAO', severity: 'ALERTA',
                            module: 'LOTES', title: `Rendimento Baixo: ${b.id_lote} `,
                            message: `Rendimento de carcaça ${rendimento.toFixed(1)}% (Peso vivo: ${pesoVivoTotal} kg → Gancho: ${pesoCarcaca}kg). Sugiro que Dra.Beatriz audite a pesagem desse lote.`,
                            timestamp: now.toISOString(), status: 'NOVO'
                        });
                    }
                }
            }
            // Se não tem peso vivo: não calcula rendimento (não dá para calcular sem essa informação)
        });

        // ── SEU ANTÔNIO: Vision Audit Revision Needed ──
        batches.filter(b => b.vision_audit_status === 'REVISAO').forEach(b => {
            alerts.push({
                id: `PROD - VISION - ${b.id_lote} `, agent: 'PRODUCAO', severity: 'CRITICO',
                module: 'PRODUCAO', title: `IA Vision: Falha no Lote ${b.id_lote} `,
                message: `A auditoria de visão computacional identificou divergências graves na tipificação.Necessário revisão manual nas nórias.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        });

        // ── DRA BEATRIZ: Missing Traceability Hash (Legacy Batches) ──
        batches.filter(b => b.status === 'FECHADO' && !b.traceability_hash).forEach(b => {
            alerts.push({
                id: `AUD - TRACE - ${b.id_lote} `, agent: 'AUDITOR', severity: 'ALERTA',
                module: 'COMPLIANCE', title: `Traceability: Missing Hash`,
                message: `Lote ${b.id_lote} sem registro de Blockchain ID.Risco de auditoria de procedência 2026.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        });

        // ── JOAQUIM (ESTOQUE): Alerta de Drip Loss Acumulado ──
        const estoqueDisp = stock.filter(s => s.status === 'DISPONIVEL');
        estoqueDisp.forEach(s => {
            const dias = Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000);
            if (dias > 6) { // Câmara fria: perde com 8 dias. Alerta com 7 para dar tempo de agir
                const pesoOriginal = s.peso_entrada;
                const perdaEst = pesoOriginal * (dias * 0.004); // 0.4% ao dia
                if (perdaEst > 2) {
                    alerts.push({
                        id: `EST - DRIP - ${s.id_completo} `, agent: 'ESTOQUE', severity: 'ALERTA',
                        module: 'ESTOQUE', title: `Drip Loss: ${s.id_completo} `,
                        message: `Peça há ${dias} dias na câmara.Estimativa de perda por gotejamento: ${perdaEst.toFixed(2)} kg(R$${(perdaEst * 35).toFixed(2)} evaporados).Vender urgente.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
            if (dias > 45) {
                alerts.push({
                    id: `EST - VELHO - ${s.id_completo} `, agent: 'ESTOQUE', severity: 'CRITICO',
                    module: 'ESTOQUE', title: `🔥 EMERGÊNCIA: Peça ${s.id_completo} `,
                    message: `Carne há ${dias} dias no estoque.Risco iminente de expiração e perda total.Prioridade 1 de venda.`,
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
                        id: `COMP - SCORE - ${s.id} `, agent: 'COMPRAS', severity: 'BLOQUEIO',
                        module: 'FORNECEDORES', title: `Scorecard F: ${s.nome_fantasia} `,
                        message: `Média de rendimento histórica crítica(${mediaRend.toFixed(1)} %).Recomendo suspender compras até revisão técnica da fazenda.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
        });

        // ── ANA (MERCADO): Alertas de Sazonalidade e Notícias ──
        const altaNoticias = marketNews.filter(n => n.title.toLowerCase().includes('alta') || n.title.toLowerCase().includes('sobe') || n.title.toLowerCase().includes('valorização'));
        if (altaNoticias.length > 2) {
            alerts.push({
                id: `MERC - NOTICIA - ALTA`, agent: 'MERCADO', severity: 'ALERTA',
                module: 'MERCADO', title: `Tendência de Alta Indetectada`,
                message: `Múltiplas notícias indicam arroba em alta.Recomendo que Roberto(Compras) trave lotes para os próximos 15 dias HOJE.`,
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
                        id: `ROBO - CHURN - ${c.id_ferro} `, agent: 'COMERCIAL', severity: 'CRITICO',
                        module: 'CLIENTES', title: `Risco de Churn: ${c.nome_social} `,
                        message: `Cliente sumiu há ${dias} dias.Aplique script de 'Negociação FBI' com Mirroring para reaver parceria.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
        });

        // ── ISABELA (MARKETING 2026): ABM, Escassez, Churn, Growth ──
        const msDay = 86400000;
        const validSalesForMkt = sales.filter(s => s.status_pagamento !== 'ESTORNADO');

        // ABM: Clientes esfriando (30-60d sem compra)
        clients.forEach(c => {
            const cs = validSalesForMkt.filter(s => s.id_cliente === c.id_ferro);
            if (cs.length > 0) {
                const lastSale = [...cs].sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                const diasSemCompra = Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / msDay);
                if (diasSemCompra >= 30 && diasSemCompra <= 60) {
                    alerts.push({
                        id: `MKT - REATIV - ${c.id_ferro} `, agent: 'MARKETING', severity: 'ALERTA',
                        module: 'CLIENTES', title: `🟡 Reativação ABM: ${c.nome_social} `,
                        message: `${diasSemCompra}d sem comprar.Enviar script Loss Aversion: "Você sabia que seus concorrentes já estão com o lote novo?".WhatsApp: ${c.whatsapp || 'N/A'} `,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
                if (diasSemCompra > 60) {
                    alerts.push({
                        id: `MKT - PERDIDO - ${c.id_ferro} `, agent: 'MARKETING', severity: 'CRITICO',
                        module: 'CLIENTES', title: `🔴 Cliente Perdido: ${c.nome_social} `,
                        message: `${diasSemCompra}d inativo.Campanha de Reconquista: Zero Price Effect(frete grátis no próximo pedido).LTV perdido estimado: R$${cs.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(0)}.`,
                        timestamp: now.toISOString(), status: 'NOVO'
                    });
                }
            }
        });

        // Escassez: Estoque velho = campanha urgente
        const estoqueVelho = stock.filter(s => s.status === 'DISPONIVEL' && Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / msDay) > 6);
        if (estoqueVelho.length > 2) {
            alerts.push({
                id: `MKT - ESCASSEZ - ${now.toISOString().split('T')[0]} `, agent: 'MARKETING', severity: 'ALERTA',
                module: 'ESTOQUE', title: `📦 Campanha Relâmpago: ${estoqueVelho.length} peças`,
                message: `${estoqueVelho.length} peças com > 6 dias(PERDE com 8!).Montar combo Decoy Effect e disparar via WhatsApp para lista VIP.Peso total: ${estoqueVelho.reduce((s, e) => s + e.peso_entrada, 0).toFixed(0)} kg.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }

        // Desequilíbrio: Excesso de dianteiro vs traseiro
        const dianteirosD = stock.filter(s => s.status === 'DISPONIVEL' && s.tipo === 2);
        const traseirosD = stock.filter(s => s.status === 'DISPONIVEL' && s.tipo === 3);
        if (dianteirosD.length > traseirosD.length * 1.5 && dianteirosD.length > 2) {
            alerts.push({
                id: `MKT - COMBO - DECOY`, agent: 'MARKETING', severity: 'ALERTA',
                module: 'ESTOQUE', title: `🧠 Decoy Effect: Combo Dianteiro`,
                message: `${dianteirosD.length} dianteiros vs ${traseirosD.length} traseiros.Criar COMBO irresistível: "Leve Dianteiro + Traseiro com 8% OFF".O dianteiro avulso deve parecer ruim.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }

        // Gifting VIPs
        const topClients = clients.map(c => ({
            ...c,
            totalKg: validSalesForMkt.filter(s => s.id_cliente === c.id_ferro).reduce((sum, s) => sum + s.peso_real_saida, 0)
        })).sort((a, b) => b.totalKg - a.totalKg).slice(0, 3);
        topClients.forEach(c => {
            alerts.push({
                id: `MKT - GIFT - ${c.id_ferro} `, agent: 'MARKETING', severity: 'INFO',
                module: 'CLIENTES', title: `🎁 Mimo ABM: ${c.nome_social} `,
                message: `Top 3 Cliente(${c.totalKg.toFixed(0)}kg comprados).GROWTH LOOP: Enviar Display "Parceiro FrigoGest 2026" + churrasco cortesia → ele posta → lead orgânico.`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        });

        // ── CAMILA (SATISFAÇÃO): Pesquisa NPS e Follow-up Qualidade ──
        sales.filter(s => s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime()).slice(0, 5).forEach(s => {
            const dias = Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / 86400000);
            if (dias >= 1 && dias <= 3) { // Janela ideal de feedback
                const cli = clients.find(c => c.id_ferro === s.id_cliente);
                alerts.push({
                    id: `SAT - NPS - ${s.id_venda} `, agent: 'SATISFACAO', severity: 'ALERTA',
                    module: 'CLIENTES', title: `Feedback NPS: ${cli?.nome_social || s.id_cliente} `,
                    message: `Venda concluída há ${dias} dias.Momento ideal para perguntar sobre a qualidade do gado e satisfação com a entrega.`,
                    timestamp: now.toISOString(), status: 'NOVO',
                    data: { venda_id: s.id_venda, whatsapp: cli?.whatsapp }
                });
            }
        });

        // ═══ 📈 ALERTAS PREDITIVOS (FASE 3) ═══
        const pred = calculatePredictions(sales, stock, batches, clients, payables, transactions);

        if (pred.alertaEstoqueBaixo) {
            alerts.push({
                id: `PRED - ESTOQUE - ${now.toISOString().split('T')[0]} `, agent: 'ESTOQUE', severity: 'CRITICO',
                module: 'ESTOQUE', title: `📈 PREVISÃO: Estoque esgota em ${pred.diasAteEsgotar} d`,
                message: `Consumo médio: ${pred.consumoMedio7dKg.toFixed(1)} kg / dia.Estoque atual: ${pred.estoqueAtualKg.toFixed(0)} kg.Agendar novo lote em ${pred.proximaCompraIdealDias} dias!`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }

        if (pred.alertaCaixaNegativo) {
            alerts.push({
                id: `PRED - CAIXA - ${now.toISOString().split('T')[0]} `, agent: 'ADMINISTRATIVO', severity: 'CRITICO',
                module: 'FINANCEIRO', title: `📈 PREVISÃO: Caixa fica negativo em ~${pred.diasAteCaixaNegativo} d`,
                message: `Saldo atual: R$${pred.caixaAtual.toFixed(0)}. Após pagamentos: R$${pred.caixaProjetado30d.toFixed(0)}. Cobrar inadimplentes ou renegociar prazos!`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }

        if (pred.alertaChurnAlto) {
            alerts.push({
                id: `PRED - CHURN - ${now.toISOString().split('T')[0]} `, agent: 'COMERCIAL', severity: 'ALERTA',
                module: 'CLIENTES', title: `📈 PREVISÃO: Churn alto(${pred.taxaChurn.toFixed(0)} %)`,
                message: `${pred.clientesInativos30d} de ${pred.clientesAtivos30d + pred.clientesInativos30d} clientes NÃO compraram nos últimos 30d.Ativar campanhas de retenção!`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }

        if (pred.tendenciaReceita === 'CAINDO') {
            alerts.push({
                id: `PRED - RECEITA - ${now.toISOString().split('T')[0]} `, agent: 'COMERCIAL', severity: 'ALERTA',
                module: 'VENDAS', title: `📉 PREVISÃO: Receita em queda(${pred.percentualVariacao.toFixed(1)} %)`,
                message: `Receita 30d: R$${pred.receita30d.toFixed(0)} vs período anterior.Projeção: R$${pred.receitaProjetada30d.toFixed(0)}. Intensificar vendas!`,
                timestamp: now.toISOString(), status: 'NOVO'
            });
        }

        return alerts.sort((a, b) => {
            const severityOrder: Record<AlertSeverity, number> = { BLOQUEIO: 0, CRITICO: 1, ALERTA: 2, INFO: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }, [batches, stock, sales, clients, transactions, suppliers, payables, scheduledOrders, marketNews]);

    // ═══ 📈 PREDICTIONS SNAPSHOT ═══
    const predictions = useMemo(() => {
        return calculatePredictions(sales, stock, batches, clients, payables, transactions);
    }, [sales, stock, batches, clients, payables, transactions]);

    // ═══ 📋 DRE & ESG (FASE 6) ═══
    const dreReport = useMemo(() => {
        return generateDRE(sales, transactions, batches, payables, drePeriodo);
    }, [sales, transactions, batches, payables, drePeriodo]);

    const esgScore = useMemo(() => {
        return calculateESGScore(batches, stock);
    }, [batches, stock]);

    // ═══ 💲 PRECIFICAÇÃO INTELIGENTE (FASE 7) ═══
    const precificacao = useMemo(() => {
        return calcularPrecificacao(stock, batches, sales);
    }, [stock, batches, sales]);

    // ═══ 👥 SCORING CLIENTES RFM (FASE 8) ═══
    const clientScores = useMemo(() => {
        return calculateClientScores(clients, sales);
    }, [clients, sales]);

    const tierSummary = useMemo(() => {
        return getClientTierSummary(clientScores);
    }, [clientScores]);

    // ═══ STATS PER AGENT — dinâmico, nunca quebra com novos agentes ═══
    const agentStats = useMemo(() => {
        // Constrói o mapa a partir de todos os agentes ativos (expansível automaticamente)
        const stats: Record<string, { total: number; criticos: number; bloqueios: number }> = {};
        agents.forEach(a => { stats[a.id] = { total: 0, criticos: 0, bloqueios: 0 }; });
        liveAlerts.forEach(a => {
            // Guard defensivo: se o agent.id não existir no stats, inicializa
            if (!stats[a.agent]) stats[a.agent] = { total: 0, criticos: 0, bloqueios: 0 };
            stats[a.agent].total++;
            if (a.severity === 'CRITICO') stats[a.agent].criticos++;
            if (a.severity === 'BLOQUEIO') stats[a.agent].bloqueios++;
        });
        return stats;
    }, [liveAlerts, agents]);

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
        // Cores adicionadas para os novos agentes
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', glow: 'shadow-indigo-200/50' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', glow: 'shadow-purple-200/50' },
        pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200', glow: 'shadow-pink-200/50' },
        slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', glow: 'shadow-slate-200/50' },
        stone: { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200', glow: 'shadow-stone-200/50' },
        gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', glow: 'shadow-gray-200/50' },
        yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200', glow: 'shadow-yellow-200/50' },
        red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', glow: 'shadow-red-200/50' },
        green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', glow: 'shadow-green-200/50' },
        sky: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', glow: 'shadow-sky-200/50' },
        lime: { bg: 'bg-lime-50', text: 'text-lime-600', border: 'border-lime-200', glow: 'shadow-lime-200/50' },
    };
    const COLOR_FALLBACK = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', glow: 'shadow-gray-200/50' };

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
            alert(`✅ Mensagem enviada para ${targetPhone} !`);
        } else if (res.error?.includes('API não configurada')) {
            // O fallback já abriu a janela, então só avisamos
            alert('📱 WhatsApp Web aberto com o script!');
        } else {
            alert(`⚠️ Erro ao enviar: ${res.error} `);
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
## SNAPSHOT GERAL — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Caixa: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Projeção 7 Dias: A Receber R$${aReceber7d.toFixed(2)} | A Pagar R$${aPagar7d.toFixed(2)}
Métricas 2026: ESG Médio ${batches.length > 0 ? (batches.reduce((s, b) => s + (b.esg_score || 0), 0) / batches.length).toFixed(1) : 0}% | Traceability: ${batches.filter(b => b.traceability_hash).length} hashes ativos
Vendas: ${vendasPagas.length} pagas, ${vendasPendentes.length} pendentes, ${vendasEstornadas.length} estornadas
Contas a Pagar: ${payablesPendentes.length} pendentes(R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)}), ${payablesVencidos.length} vencidas
Estoque: ${estoqueDisp.length} peças, ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)} kg(Sendo: ${estoqueDisp.filter(s => s.tipo === 1).length} Inteiras, ${estoqueDisp.filter(s => s.tipo === 2).length} Diant., ${estoqueDisp.filter(s => s.tipo === 3).length} Tras.)
Lotes: ${batches.length} total(${batches.filter(b => b.status === 'ABERTO').length} abertos, ${batches.filter(b => b.status === 'FECHADO').length} fechados)
Clientes: ${clients.length} total, ${clients.filter(c => c.saldo_devedor > 0).length} com saldo devedor
Fornecedores: ${suppliers.length} cadastrados
Pedidos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length} abertos
Alertas: ${liveAlerts.length} ativos
${liveAlerts.slice(0, 10).map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim(),

                PRODUCAO: `
## SNAPSHOT PRODUÇÃO — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Lotes Recentes(Foco Vision AI Audit):
${batches.filter(b => b.status !== 'ESTORNADO').slice(-10).map(b => {
                    const pecas = stock.filter(s => s.id_lote === b.id_lote);
                    const pesoTotal = pecas.reduce((s, p) => s + p.peso_entrada, 0);
                    const rend = b.peso_total_romaneio > 0 ? ((pesoTotal / b.peso_total_romaneio) * 100).toFixed(1) : 'N/A';
                    return `- Lote ${b.id_lote} | Forn: ${b.fornecedor} | Vision: ${b.vision_audit_status || 'PENDENTE'} | ESG: ${b.esg_score || 0}% | Raça: ${(b as any).raca || 'N/I'} | Cab: ${(b as any).qtd_cabecas || 'N/I'} | Rend: ${rend}% | Toalete: ${(b as any).toalete_kg || 0}kg | Peças: ${pecas.length}`;
                }).join('\n')
                    }
Estoque: ${estoqueDisp.length} peças, ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg disponível
Fornecedores Scorecard: ${suppliers.length}
Alertas Produção: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim(),

                COMERCIAL: `
## SNAPSHOT COMERCIAL — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Vendas Pagas: ${vendasPagas.length} (R$${vendasPagas.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)})
Vendas Pendentes: ${vendasPendentes.length} (R$${vendasPendentes.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0).toFixed(2)})
Vendas Estornadas: ${vendasEstornadas.length}
Preço Médio Venda / kg: R$${vendasPagas.length > 0 ? (vendasPagas.reduce((s, v) => s + v.preco_venda_kg, 0) / vendasPagas.length).toFixed(2) : '0.00'}
Clientes: ${clients.length} total
${clients.filter(c => c.saldo_devedor > 0).slice(0, 10).map(c => `- ${c.nome_social}: Devendo R$${c.saldo_devedor.toFixed(2)} | Limite R$${c.limite_credito.toFixed(2)}`).join('\n')}
Top vendas pendentes:
${vendasPendentes.slice(0, 8).map(v => `- ${v.nome_cliente || v.id_cliente}: ${v.peso_real_saida}kg × R$${v.preco_venda_kg}/kg = R$${(v.peso_real_saida * v.preco_venda_kg).toFixed(2)} | Venc: ${v.data_vencimento}`).join('\n')}
Alertas Comercial: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim(),

                AUDITOR: `
## SNAPSHOT FINANCEIRO — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Caixa Atual: Entradas R$${totalEntradas.toFixed(2)} | Saídas R$${totalSaidas.toFixed(2)} | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Projeção 7 dias: A Receber R$${aReceber7d.toFixed(2)} | A Pagar R$${aPagar7d.toFixed(2)} | Saldo Projetado R$${(aReceber7d - aPagar7d).toFixed(2)}
Transações: ${transactions.length} total
Vendas PAGAS sem Transaction ENTRADA: ${vendasPagas.filter(v => !transactions.some(t => t.referencia_id === v.id_venda && t.tipo === 'ENTRADA' && t.categoria !== 'ESTORNO')).length}
Lotes sem saída financeira: ${batches.filter(b => b.status !== 'ESTORNADO' && !payables.some(p => p.id_lote === b.id_lote) && !transactions.some(t => t.referencia_id === b.id_lote && t.tipo === 'SAIDA')).length}
Contas vencidas: ${payablesVencidos.length} (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Estornos: ${vendasEstornadas.length} vendas, ${transactions.filter(t => t.categoria === 'ESTORNO').length} transações
Alertas Auditor: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim(),

                ESTOQUE: `
## SNAPSHOT ESTOQUE — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
TOTAL: ${estoqueDisp.length} pecas | ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)} kg

POR CATEGORIA:
- INTEIRO: ${estoqueDisp.filter(s => s.tipo === 1).length} pecas | ${estoqueDisp.filter(s => s.tipo === 1).reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)} kg
    - DIANTEIRO(Banda A): ${estoqueDisp.filter(s => s.tipo === 2).length} pecas | ${estoqueDisp.filter(s => s.tipo === 2).reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)} kg
        - TRASEIRO(Banda B): ${estoqueDisp.filter(s => s.tipo === 3).length} pecas | ${estoqueDisp.filter(s => s.tipo === 3).reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)} kg

PECAS CRITICAS(> 5 dias na camara — perdendo peso):
- Inteiros antigos(> 5d): ${estoqueDisp.filter(s => s.tipo === 1 && Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 5).length} pecas
    - Dianteiros antigos(> 5d): ${estoqueDisp.filter(s => s.tipo === 2 && Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 5).length} pecas
        - Traseiros antigos(> 5d): ${estoqueDisp.filter(s => s.tipo === 3 && Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000) > 5).length} pecas

PERDA POR EVAPORACAO: ~${(estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0) * 0.004).toFixed(1)} kg / dia(0, 4 % do peso total)

DETALHAMENTO(15 primeiras):
${estoqueDisp.slice(0, 15).map(s => {
                    const dias = Math.floor((new Date().getTime() - new Date(s.data_entrada).getTime()) / 86400000);
                    const tipoNome = s.tipo === 1 ? 'INT' : s.tipo === 2 ? 'DIA' : 'TRA';
                    return '- ' + s.id_completo + ' | ' + tipoNome + ' | ' + s.peso_entrada + 'kg | ' + dias + 'd | Lote: ' + s.id_lote + (dias > 5 ? ' ATENCAO' : '');
                }).join('\n')
                    }
Alertas Estoque: ${agentAlerts.length}
${agentAlerts.map(a => '- [' + a.severity + '] ' + a.title + ': ' + a.message).join('\n')} `.trim(),

                COMPRAS: `
## SNAPSHOT COMPRAS — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
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
                }).join('\\n')
                    }
Contas a Pagar: ${payablesPendentes.length} (R$${payablesPendentes.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Vencidas: ${payablesVencidos.length} (R$${payablesVencidos.reduce((s, p) => s + p.valor, 0).toFixed(2)})
Custo médio / kg: R$${batches.length > 0 ? (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length).toFixed(2) : '0.00'}
Alertas Compras: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim(),

                MERCADO: `
## SNAPSHOT MERCADO — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
REFERÊNCIA CEPEA - BA Sul: R$311, 50 / @vivo(Fev / 2026) → R$${(311.50 / 15).toFixed(2)}/kg carcaça (seu custo de oportunidade)
SAZONALIDADE ATUAL: ${new Date().getMonth() >= 0 && new Date().getMonth() <= 5 ? '🟢 SAFRA (Jan-Jun) — boa oferta, preço firme, janela de compra razoável' : new Date().getMonth() >= 6 && new Date().getMonth() <= 10 ? '🔴 ENTRESSAFRA (Jul-Nov) — escassez, preço máximo, comprar com cautela' : '🟡 FESTAS/ÁGUAS (Dez) — demanda alta, preço em alta'}

INDICADORES INTERNOS:
Custo médio compra / kg: R$${batches.length > 0 ? (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length).toFixed(2) : '0.00'} ${batches.length > 0 ? ((batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length) > (311.50 / 15) ? '🔴 ACIMA do referencial CEPEA-BA' : '🟢 ABAIXO do referencial CEPEA-BA') : ''}
Preço médio venda / kg: R$${sales.length > 0 ? (sales.reduce((s, v) => s + v.preco_venda_kg, 0) / sales.length).toFixed(2) : '0.00'} | Mín: R$${sales.length > 0 ? Math.min(...sales.filter(s => s.preco_venda_kg > 0).map(v => v.preco_venda_kg)).toFixed(2) : '0.00'} | Máx: R$${sales.length > 0 ? Math.max(...sales.map(v => v.preco_venda_kg)).toFixed(2) : '0.00'}
Margem bruta: ${sales.length > 0 && batches.length > 0 ? (((sales.reduce((s, v) => s + v.preco_venda_kg, 0) / sales.length) / (batches.reduce((s, b) => s + b.custo_real_kg, 0) / batches.length) - 1) * 100).toFixed(1) : 'N/A'}% (meta saudável: 20 - 30 % | abaixo de 15 % = alerta | negativa = CRÍTICO)

ÚLTIMOS 10 LOTES — custo, fornecedor e rendimento(compare com CEPEA):
${batches.slice(-10).map(b => {
                    const pecas = stock.filter(s => s.id_lote === b.id_lote);
                    const pesoReal = pecas.reduce((s, p) => s + p.peso_entrada, 0);
                    const rend = b.peso_total_romaneio > 0 ? ((pesoReal / b.peso_total_romaneio) * 100).toFixed(1) : 'N/A';
                    return `- ${b.id_lote} | Forn: ${b.fornecedor} | Custo: R$${b.custo_real_kg.toFixed(2)}/kg | ${b.peso_total_romaneio}kg rom | Rend: ${rend}%`;
                }).join('\n')
                    }

Região: Vitória da Conquista - BA(Sudoeste Baiano)
Alertas Mercado: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim(),

                ROBO_VENDAS: `
## SNAPSHOT VENDAS — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Clientes total: ${clients.length}
Clientes com compra no mês: ${clients.filter(c => sales.some(s => s.id_cliente === c.id_ferro && Math.floor((new Date().getTime() - new Date(s.data_venda).getTime()) / 86400000) < 30)).length}
Clientes inativos(> 30d): ${clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro).sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; return ls && Math.floor((new Date().getTime() - new Date(ls.data_venda).getTime()) / 86400000) > 30; }).length}
Clientes inativos(> 60d): ${clients.filter(c => { const ls = sales.filter(s => s.id_cliente === c.id_ferro).sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0]; return ls && Math.floor((new Date().getTime() - new Date(ls.data_venda).getTime()) / 86400000) > 60; }).length}
Top clientes por volume:
${clients.sort((a, b) => { const va = sales.filter(s => s.id_cliente === a.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); const vb = sales.filter(s => s.id_cliente === b.id_ferro).reduce((s, v) => s + v.peso_real_saida, 0); return vb - va; }).slice(0, 8).map(c => { const cv = sales.filter(s => s.id_cliente === c.id_ferro); const kg = cv.reduce((s, v) => s + v.peso_real_saida, 0); const pag = cv.length > 0 ? cv[cv.length - 1].forma_pagamento : 'N/I'; return `- ${c.nome_social}: ${cv.length} compras, ${kg.toFixed(1)}kg | Pagamento ref: ${pag}`; }).join('\n')}
Pedidos abertos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length}
Alertas Robô: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim(),

                MARKETING: (() => {
                    const now = new Date();
                    const msDay = 86400000;
                    const validSales = sales.filter(s => s.status_pagamento !== 'ESTORNADO');
                    const sales30d = validSales.filter(s => Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / msDay) <= 30);
                    const sales7d = validSales.filter(s => Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / msDay) <= 7);
                    const revenue30d = sales30d.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
                    const revenue7d = sales7d.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
                    const kg30d = sales30d.reduce((s, v) => s + v.peso_real_saida, 0);

                    // RFM SEGMENTATION
                    const clientRFM = clients.filter(c => c.status !== 'INATIVO').map(c => {
                        const cs = validSales.filter(s => s.id_cliente === c.id_ferro);
                        const lastSale = cs.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                        const recencia = lastSale ? Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / msDay) : 999;
                        const frequencia = cs.length;
                        const valor = cs.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
                        const segmento = recencia <= 15 && frequencia >= 3 ? 'VIP_ATIVO' : recencia <= 30 ? 'ATIVO' : recencia <= 60 ? 'ESFRIANDO' : recencia <= 90 ? 'EM_RISCO' : frequencia > 0 ? 'PERDIDO' : 'NUNCA_COMPROU';
                        return { ...c, recencia, frequencia, valor, segmento };
                    });
                    const vips = clientRFM.filter(c => c.segmento === 'VIP_ATIVO');
                    const esfriando = clientRFM.filter(c => c.segmento === 'ESFRIANDO');
                    const emRisco = clientRFM.filter(c => c.segmento === 'EM_RISCO');
                    const perdidos = clientRFM.filter(c => c.segmento === 'PERDIDO');
                    const nuncaComprou = clientRFM.filter(c => c.segmento === 'NUNCA_COMPROU');

                    // ESTOQUE PARA CAMPANHAS DE ESCASSEZ
                    const estoqueVelho = estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / msDay) > 6);
                    const dianteirosDisp = estoqueDisp.filter(s => s.tipo === 2);
                    const traseirosDisp = estoqueDisp.filter(s => s.tipo === 3);
                    const inteirosDisp = estoqueDisp.filter(s => s.tipo === 1);

                    // LTV (Lifetime Value) por segmento
                    const ltvVip = vips.length > 0 ? vips.reduce((s, c) => s + c.valor, 0) / vips.length : 0;

                    return `
## SNAPSHOT GROWTH MARKETING 2026 — FRIGOGEST(${now.toLocaleDateString('pt-BR')})

═══ 📊 KPIs DE GROWTH ═══
Receita 7 dias: R$${revenue7d.toFixed(2)} | Receita 30 dias: R$${revenue30d.toFixed(2)}
Volume 30d: ${kg30d.toFixed(0)}kg em ${sales30d.length} vendas
Ticket Médio: R$${sales30d.length > 0 ? (revenue30d / sales30d.length).toFixed(2) : '0.00'}
LTV Médio VIP: R$${ltvVip.toFixed(2)} | Total Clientes: ${clients.filter(c => c.status !== 'INATIVO').length}

═══ 🎯 SEGMENTAÇÃO RFM(FUNIL ABM) ═══
🟣 VIP ATIVO(≤15d, ≥3 compras): ${vips.length} clientes
${vips.slice(0, 5).map(c => `  → ${c.nome_social} | ${c.recencia}d | ${c.frequencia} compras | R$${c.valor.toFixed(0)} | Perfil: ${c.perfil_compra || 'N/I'} | Gordura: ${c.padrao_gordura || 'N/I'} | WhatsApp: ${c.whatsapp || 'N/A'}`).join('\\n')}
🟢 ATIVO(≤30d): ${clientRFM.filter(c => c.segmento === 'ATIVO').length} clientes
🟡 ESFRIANDO(30 - 60d): ${esfriando.length} clientes — ALVO REATIVAÇÃO
${esfriando.slice(0, 5).map(c => `  → ${c.nome_social} | ${c.recencia}d sem comprar | Objeções: ${c.objecoes_frequentes || 'Nenhuma'} | WhatsApp: ${c.whatsapp || 'N/A'}`).join('\\n')}
🔴 EM RISCO(60 - 90d): ${emRisco.length} clientes — URGÊNCIA
${emRisco.slice(0, 3).map(c => `  → ${c.nome_social} | ${c.recencia}d | Último R$${c.valor.toFixed(0)}`).join('\\n')}
⚫ PERDIDO(> 90d): ${perdidos.length} | NUNCA COMPROU: ${nuncaComprou.length}

═══ 🧠 DADOS PARA NEUROMARKETING ═══
PERFIS PSICOGRÁFICOS(para Decoy Effect e Anchoring):
${clientRFM.filter(c => c.perfil_compra || c.padrao_gordura || c.objecoes_frequentes).slice(0, 8).map(c => `- ${c.nome_social}: Prefere ${c.perfil_compra || '?'} | Gordura ${c.padrao_gordura || '?'} | Objeção: "${c.objecoes_frequentes || 'nenhuma'}" | Mimo: ${c.mimo_recebido_data || 'nunca'}`).join('\\n')}

═══ 📦 GATILHOS DE ESCASSEZ(Campanhas Urgentes) ═══
Estoque > 6 dias(PERDE COM 8!): ${estoqueVelho.length} peças — PROMO RELÂMPAGO URGENTE
Dianteiros disponíveis: ${dianteirosDisp.length} (${dianteirosDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(0)}kg)
Traseiros disponíveis: ${traseirosDisp.length} (${traseirosDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(0)}kg)
Inteiros disponíveis: ${inteirosDisp.length} (${inteirosDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(0)}kg)
${dianteirosDisp.length > traseirosDisp.length * 1.5 ? '⚠️ DESEQUILÍBRIO: Excesso de dianteiros — criar COMBO IRRESISTÍVEL (Decoy Effect)' : ''}
${estoqueVelho.length > 3 ? '🔴 EMERGÊNCIA: +3 peças velhas — disparar campanha LOSS AVERSION "Última chance"' : '🟢 Estoque equilibrado'}

═══ 🤝 ABM — CONTAS ESTRATÉGICAS ═══
Fornecedores VIP(Gifting B2B):
${suppliers.slice(0, 5).map(f => {
                        const lotes = batches.filter(b => b.fornecedor === f.nome_fantasia && b.status !== 'ESTORNADO');
                        return `- ${f.nome_fantasia} | ${lotes.length} lotes | Região: ${f.regiao || 'N/A'} | Raça: ${f.raca_predominante || 'N/I'}`;
                    }).join('\\n')
                        }
Pedidos Abertos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length}
Alertas Marketing: ${agentAlerts.length}
${agentAlerts.map(a => '- [' + a.severity + '] ' + a.title + ': ' + a.message).join('\\n')} `.trim();
                })(),

                SATISFACAO: `
## SNAPSHOT CUSTOMER SUCCESS & QUALIDADE — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
ÚLTIMAS 8 ENTREGAS(candidatos a pesquisa pós - venda — enviar entre 24h - 48h após entrega):
${sales.filter(s => s.status_pagamento !== 'ESTORNADO').sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime()).slice(0, 8).map(s => {
                    const cli = clients.find(c => c.id_ferro === s.id_cliente);
                    const item = stock.find(st => st.id_completo === s.id_completo);
                    const tipoStr = item ? (item.tipo === 1 ? 'Inteiro' : item.tipo === 2 ? 'Dianteiro' : 'Traseiro') : 'N/A';
                    const dias = Math.floor((new Date().getTime() - new Date(s.data_venda).getTime()) / 86400000);
                    return `- ${cli?.nome_social || s.id_cliente} | ${s.peso_real_saida}kg (${tipoStr}) | ${s.data_venda} (${dias}d atrás) | ${s.status_pagamento}`;
                }).join('\n')
                    }

PERFIL COMPLETO DOS CLIENTES ATIVOS(para pesquisa personalizada):
${clients.filter(c => sales.some(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO')).slice(0, 8).map(c => {
                        const clienteSales = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO');
                        const kgTotal = clienteSales.reduce((s, v) => s + v.peso_real_saida, 0);
                        const lastSale = [...clienteSales].sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                        const diasSemComprar = lastSale ? Math.floor((new Date().getTime() - new Date(lastSale.data_venda).getTime()) / 86400000) : 999;
                        return `- ${c.nome_social}${kgTotal >= 500 ? ' 🏆VIP' : ''} | Total: ${kgTotal.toFixed(0)}kg | ${diasSemComprar}d sem comprar | Prefere: ${c.perfil_compra || 'N/A'} | Gordura: ${c.padrao_gordura || 'N/A'} | Objeções: ${c.objecoes_frequentes || 'Nenhuma'} | Devendo: R$${(c.saldo_devedor || 0).toFixed(2)}`;
                    }).join('\n')
                    }

PRÓXIMAS ENTREGAS AGENDADAS:
${scheduledOrders.filter(o => o.status === 'ABERTO').slice(0, 5).map(o => `- ${o.nome_cliente} | Entrega: ${o.data_entrega}`).join('\n') || '- Nenhum pedido agendado aberto'}
Alertas Customer Success: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim(),
                // ─── JURIDICO: Dr. Augusto ─────────────────────────────────
                JURIDICO: `
## CONTEXTO JURÍDICO — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
CLIENTES COM SALDO DEVEDOR(risco jurídico):
${clients.filter(c => c.saldo_devedor > 0).slice(0, 8).map(c =>
                    `- ${c.nome_social} | Devendo: R$${(c.saldo_devedor || 0).toFixed(2)} | Limite: R$${(c.limite_credito || 0).toFixed(2)}`
                ).join('\n') || '- Nenhum cliente com saldo devedor'
                    }

VENDAS VENCIDAS(risco de inadimplência):
${sales.filter(s => s.status_pagamento === 'PENDENTE' && new Date(s.data_vencimento) < new Date()).slice(0, 5).map(s =>
                        `- ${s.nome_cliente} | R$${(s.peso_real_saida * s.preco_venda_kg).toFixed(2)} | Venceu: ${s.data_vencimento}`
                    ).join('\n') || '- Nenhuma venda vencida'
                    }

FORNECEDORES(análise contratual):
${suppliers.slice(0, 5).map(f => `- ${f.nome_fantasia} | ${f.cidade || 'N/A'} | Contato: ${(f as any).contato_principal || 'N/A'}`).join('\n') || '- Sem fornecedores cadastrados'}

FUNCIONÁRIOS / RH:
- Alertas trabalhistas: ${agentAlerts.filter(a => a.agent === 'JURIDICO' || a.agent === 'RH_GESTOR').length}
${agentAlerts.filter(a => a.agent === 'JURIDICO' || a.agent === 'RH_GESTOR').map(a => `- [${a.severity}] ${a.title}`).join('\n') || '- Sem alertas jurídicos ativos'}

CHECKLIST LEGAL(base de análise):
✅ SIF / SIE / SIM: verificar status da inspeção sanitária do estabelecimento
✅ NR - 36: verificar concessão de pausas, EPIs, insalubridade nos contratos
✅ NF - e: verificar emissão correta de notas fiscais em todas as vendas
✅ GTA: verificar se todas as compras de gado têm Guia de Trânsito Animal
✅ Contratos: verificar se clientes com crédito > R$5.000 têm contrato assinado`.trim(),

                // ─── MARKETING AGENTS: Contexto de negócio sem dados financeiros ─
                // Todos os agentes abaixo são de MARKETING/PUBLICIDADE/CONTEÚDO
                // Eles NÃO devem analisar caixa, saldo, pagamentos, contabilidade
                // Devem FOCAR EM: posicionamento, conteúdo, clientes como audiência
                CONTEUDO: `
## CONTEXTO DE MARKETING — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é Luna, especialista em Criação de Conteúdo e Arte.Foque APENAS em marketing, arte e comunicação.
NÃO analise finanças, caixa, saldo ou operações.Isso não é sua área.

CONTEXTO DO NEGÓCIO(para estratégia de conteúdo):
- Empresa: Frigorífico bovino localizado em Vitória da Conquista, Bahia
    - Produto principal: carne bovina semi - processada(dianteiro, traseiro, carcaça inteira)
        - Clientes: açougues, restaurantes, mercados da região sudoeste da Bahia
            - Total de clientes ativos: ${clients.filter(c => c.status !== 'INATIVO').length}
- Faixa de preço: produto premium local, preço justo pelo mercado regional

AUDIÊNCIA PARA CONTEÚDO:
${clients.slice(0, 5).map(c => `- ${c.nome_social} | Perfil: ${c.perfil_compra || 'N/A'} | Cidade: ${(c as any).cidade_entrega || 'N/A'}`).join('\n') || '- Cadastrar perfil de clientes para segmentação'}

MISSÃO DA LUNA: criar conteúdo visual, textos e artes que fortaleçam a marca do frigorífico junto aos clientes açougues e restaurantes.Foque em: fotos de cortes, vídeos do processo, receitas, dicas de manipulação, certificações de qualidade.`.trim(),

                SOCIAL_MEDIA: `
## CONTEXTO SOCIAL MEDIA — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é especialista em redes sociais do frigorífico.FOCO: Instagram, WhatsApp Business, Facebook.
NÃO analise caixa, saldo ou pagamentos.Isso não é sua área.

    CONTEXTO:
- Negócio: Frigorífico bovino em Vitória da Conquista, BA
    - Clientes: açougues e restaurantes regionais(${clients.filter(c => c.status !== 'INATIVO').length} ativos)
        - Produtos: cortes bovinos(dianteiro, traseiro, carcaça)
            - Tom de voz: confiança, qualidade, parceria local

OPORTUNIDADES DE CONTEÚDO:
- Segunda - feira: "Começo de semana com carne fresca" → stories do estoque chegando
    - Quinta - feira: "Oferta especial de quinta" → cortes da semana com preço
        - Sábado: "Fim de semana é churrasco" → receitas e dicas de corte`.trim(),

                EMAIL_MKTG: `
## CONTEXTO EMAIL MARKETING — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é especialista em email marketing B2B para o frigorífico.FOCO: comunicação com açougues e restaurantes.
NÃO analise caixa ou operações financeiras.Isso não é sua área.

LISTA DE CLIENTES PARA E - MAIL:
${clients.filter(c => c.status !== 'INATIVO').slice(0, 10).map(c =>
                    `- ${c.nome_social} | Contato: ${(c as any).telefone || 'N/A'} | Cidade: ${(c as any).cidade_entrega || 'N/A'}`
                ).join('\n') || '- Sem clientes ativos para e-mail'
                    }

CAMPANHAS SUGERIDAS:
1. "Nova tabela de preços" → toda segunda - feira para todos os clientes
2. "Oferta especial" → para clientes inativos há + 15 dias
3. "Programa de fidelidade" → para clientes VIP(volume alto)`.trim(),

                SEO_EXPERT: `
## CONTEXTO SEO — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é especialista em SEO / visibilidade online do frigorífico.FOCO: ser encontrado por açougues e restaurantes.
NÃO analise operações financeiras.Isso não é sua área.

CONTEXTO DO NEGÓCIO:
- Frigorífico bovino em Vitória da Conquista, Bahia(região sudoeste)
    - Target: açougues, mercados, restaurantes da região
        - Google Meu Negócio: configurado ? Avaliações ? Fotos atualizadas ?

            PALAVRAS - CHAVE PRIORITÁRIAS:
- "Frigorífico Vitória da Conquista"
    - "Carne bovina atacado Bahia"
    - "Fornecedor açougue sudoeste Bahia"
    - "Corte bovino semi-processado Conquista"`.trim(),

                COPYWRITER: `
## CONTEXTO COPYWRITER — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é copywriter especializado em vendas B2B para o frigorífico.FOCO: textos persuasivos, scripts de venda.
NÃO analise caixa, saldo ou pagamentos.Isso não é sua área.

    PRODUTO: Carne bovina semi - processada(dianteiro / traseiro / carcaça) — qualidade premium, origem rastreável, frigorífico local.
        CLIENTES: ${clients.filter(c => c.status !== 'INATIVO').length} açougues / restaurantes ativos na região de Vitória da Conquista, BA.

COPY PRINCIPAL DO PRODUTO:
"Carne bovina fresca, cortada no ponto certo, entregue na hora certa — direto do frigorífico para a sua bancada."

OBJEÇÕES COMUNS A QUEBRAR:
1. "Compro do meu fornecedor de sempre" → qualidade comparável, preço justo, entrega local
2. "Preço alto" → custo - benefício: menos desperdício, mais rendimento por kg
3. "Não preciso de tanto volume" → pedido mínimo flexível`.trim(),

                MEDIA_BUYER: `
## CONTEXTO MÍDIA PAGA — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é especialista em mídia paga B2B para o frigorífico.FOCO: Google Ads, Facebook Ads, WhatsApp Ads.
NÃO analise caixa, saldo ou pagamentos.Isso não é sua área.

    NEGÓCIO: Frigorífico bovino em Vitória da Conquista, BA
AUDIÊNCIA - ALVO: Proprietários de açougues e restaurantes no sudoeste da Bahia
RAIO GEOGRÁFICO: Vitória da Conquista + municípios em 150km de raio
TICKET MÉDIO: B2B — pedidos de 100kg a toneladas`.trim(),

                CREATIVE_DIR: `
## CONTEXTO DIREÇÃO DE ARTE — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é Diretor de Arte do frigorífico.FOCO: identidade visual, estética da marca, peças publicitárias.
NÃO analise operações financeiras.Isso não é sua área.

IDENTIDADE DA MARCA:
- Tom: sério, confiável, qualidade artesanal local
    - Cores sugeridas: vermelho escuro(carne), branco(limpeza / higiene), verde(campo / gado)
        - Tipografia: robusta, legível, sem serifa
            - Fotografia: cortes frescos, ambiente limpo, processo de abate com qualidade

PEÇAS PRIORITÁRIAS:
1. Tabela de preços semanal(WhatsApp)
2. Stories com promoções do dia
3. Cardápio de cortes disponíveis`.trim(),

                INFLUENCER: `
## CONTEXTO INFLUENCER — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é especialista em marketing de influência para o frigorífico.FOCO: parcerias com chefs, açougues e influenciadores de gastronomia local.
NÃO analise operações financeiras.Isso não é sua área.

    REGIÃO: Vitória da Conquista, BA e sudoeste da Bahia
NICHOS RELEVANTES: culinária regional, churrasco, açougue gourmet, restaurantes locais
CLIENTES ATUAIS: ${clients.filter(c => c.status !== 'INATIVO').length} estabelecimentos alimentícios`.trim(),

                DATA_MKTG: `
## CONTEXTO DATA MARKETING — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é especialista em dados de marketing.FOCO: segmentação de clientes, RFM, comportamento de compra para estratégia de marketing.
Você pode analisar dados de vendas APENAS para fins de segmentação de audiência.

CLIENTES PARA SEGMENTAÇÃO(${clients.filter(c => c.status !== 'INATIVO').length} ativos):
${clients.slice(0, 10).map(c => {
                    const cv = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO');
                    const kgTotal = cv.reduce((s, v) => s + v.peso_real_saida, 0);
                    const lastSale = cv.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                    const diasInativo = lastSale ? Math.floor((new Date().getTime() - new Date(lastSale.data_venda).getTime()) / 86400000) : 999;
                    return `- ${c.nome_social} | Volume: ${kgTotal.toFixed(0)}kg | Inativo há: ${diasInativo}d | Segmento: ${kgTotal >= 500 ? 'VIP' : diasInativo > 30 ? 'Em Risco' : 'Ativo'}`;
                }).join('\n') || '- Sem dados de clientes'
                    } `.trim(),

                PARCEIROS: `
## CONTEXTO PARCERIAS — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é especialista em desenvolvimento de parcerias B2B.FOCO: novos canais de venda, distribuidores, cooperativas.
NÃO analise caixa, saldo ou pagamentos.Isso não é sua área.

FORNECEDORES ATUAIS: ${suppliers.length} cadastrados
CLIENTES ATUAIS: ${clients.filter(c => c.status !== 'INATIVO').length} estabelecimentos ativos
REGIÃO: Vitória da Conquista, BA(hub para o sudoeste da Bahia)

OPORTUNIDADES DE PARCERIA:
1. Cooperativas de produtores rurais(garantia de fornecimento)
2. Redes de açougues regionais(volume garantido de compra)
3. Restaurantes de escola / hospital(licitação pública)
4. Aplicativos de delivery de carne(iFood Mercado, Rappi)`.trim(),

                MKT_INSTAGRAM: `
## CONTEXTO INSTAGRAM — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você é especialista em Instagram para o frigorífico.FOCO: feed, stories, reels, engajamento com açougues e restaurantes.
    Produto: Carne bovina semi - processada.Região: Vitória da Conquista, BA.`.trim(),

                MKT_COPYWRITER: `
## CONTEXTO COPYWRITER MKT — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você escreve copy de vendas para o frigorífico.FOCO: WhatsApp, Instagram, e - mail B2B.
    Produto: cortes bovinos frescos para açougues e restaurantes.Região: Vitória da Conquista, BA.`.trim(),

                MKT_TENDENCIAS: `
## CONTEXTO TENDÊNCIAS — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Você monitora tendências do mercado de carne para o frigorífico.FOCO: novos cortes em alta, comportamento do consumidor, mercado bovino.
Região de referência: sudoeste da Bahia e Brasil.`.trim(),

            } as Record<string, string>;

            // Fallback genérico para agentes não mapeados no dataPackets
            const dataPacket = (dataPackets[agentType] ?? `
## SNAPSHOT OPERACIONAL — FRIGOGEST(${new Date().toLocaleDateString('pt-BR')})
Estoque: ${estoqueDisp.length} peças | ${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(1)}kg disponível
Vendas: ${vendasPagas.length} pagas | ${vendasPendentes.length} pendentes | R$${totalEntradas.toFixed(2)} entrada / R$${totalSaidas.toFixed(2)} saída | Saldo R$${(totalEntradas - totalSaidas).toFixed(2)}
Clientes: ${clients.length} total | ${clients.filter(c => c.saldo_devedor > 0).length} com saldo devedor
Lotes: ${batches.filter(b => b.status === 'ABERTO').length} abertos | ${batches.filter(b => b.status === 'FECHADO').length} fechados
Pedidos abertos: ${scheduledOrders.filter(o => o.status === 'ABERTO').length}
Alertas do agente: ${agentAlerts.length}
${agentAlerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')} `.trim());


            // ═══ PROMPTS PER AGENT ═══
            const prompts: Record<string, string> = {
                ADMINISTRATIVO: `Você é DONA CLARA, DIRETORA ADM - FINANCEIRA E LÍDER ESTRATÉGICA do FrigoGest.
Você é a "GRÃO-MESTRA" que orquestra todos os outros especialistas.Sua visão é holística e focada na PERPETUIDADE do negócio.

📚 SEU CONHECIMENTO PROFUNDO(BASEADO EM MESTRES DA GESTÃO):
1. "The Effective Executive"(Peter Drucker)
   → Foco em EFICÁCIA: "Fazer as coisas certas".Você filtra o que é ruído e o que é DECISÃO tática.
2. "Good to Great"(Jim Collins)
   → CONCEITO DO PORCO - ESPINHO: Onde o FrigoGest é o melhor ? (Rendimento e Confiança regional).
   → PRIMEIRO QUEM, DEPOIS O QUÊ: Você avalia se a equipe está performando ou se precisa de ajuste.
3. "Principles"(Ray Dalio)
   → VERDADE RADICAL: Se os dados mostram erro, você encara a realidade sem filtros para gerar progresso.
4. "Finanças Corporativas"(Assaf Neto)
   → ROI, ROIC e EBITDA: Cada centavo gasto deve retornar valor acionário e liquidez.

═══ SEU PAPEL DE "ORQUESTRADORA" ═══
- Se Roberto(Compras) compra caro, você avisa Marcos(Comercial) para subir a margem.
- Se Joaquim(Estoque) alerta sobre carne velha, você manda Lucas(Vendas) fazer oferta relâmpago.
- Se Dra.Beatriz(Auditora) acha furo no caixa, você convoca reunião de emergência.

Organize em: 👑 DIRETRIZ DA GRÃO - MESTRA, 💰 SAÚDE FINANCEIRA(CAIXA / DRE), 🚨 ALERTAS DE GESTÃO(EQUIPE), 📈 ESTRATÉGIA DE LONGO PRAZO`,

                PRODUCAO: `Você é SEU ANTÔNIO, DIRETOR de OPERAÇÕES E CIÊNCIA DA CARNE. 
Sua missão é a eficiência absoluta na desossa e o bem - estar animal que gera lucro.

📚 SEU CONHECIMENTO PROFUNDO(REFERÊNCIAS GLOBAIS):
1. Temple Grandin(Bem - estar Animal)
   → RESÍDUO DE ADRENALINA: Gado estressado = pH alto = Carne DFD(Dark, Firm, Dry).Você monitora isso para evitar devoluções.
2. "Science of Meat and Meat Products"(American Meat Institute)
   → RIGOR MORTIS E MATURAÇÃO: pH final ideal de 5.4 a 5.7.Fora disso, a carne não amacia e o cliente reclama.
3. EMBRAPA Gado de Corte
   → RENDIMENTOS POR RAÇA: Você domina a tabela 50 - 55 - 60. Nelore pasto vs Cruzamento industrial.

═══ SEUS PILARES TÉCNICOS ═══
- RENDIMENTO DE CARCAÇA(@por @): Métrica sagrada.Se o romaneio não bate no gancho, o Roberto(Compras) precisa saber.
- TOALETE DE CARCAÇA: Se a limpeza("toalete") está tirando carne boa, você corrige a linha de produção.
- QUEBRA DE CÂMARA(SHRINKAGE): Controlar perda por evaporação(< 2.5 %).

Organize em: 🥩 ANÁLISE TÉCNICA(YIELD), 🩸 QUALIDADE E CIÊNCIA(pH / DFD), ⚠️ ALERTAS OPERACIONAIS, 💡 RECOMENDAÇÕES DE ABASTECIMENTO`,

                COMERCIAL: `Você é MARCOS, DIRETOR COMERCIAL E ESTRATEGISTA DE VALOR. 
Vender carne é fácil; o desafio é vender o LUCRO e o RENDIMENTO para o cliente.

📚 SEU CONHECIMENTO PROFUNDO(LITERATURA DE NEGOCIAÇÃO):
1. "Never Split the Difference"(Chris Voss - Ex - negociador FBI)
   → INTELIGÊNCIA EMOCIONAL: Você não cede desconto; você usa "Mirroring" e "Labeling" para entender a dor real do dono do açougue.
2. "Value-Based Pricing"(Alan Weiss)
   → VALOR vs PREÇO: Você vende SEGURANÇA. "Nossa carne rende 10% mais no balcão que a do vizinho".
3. "The Challenger Sale"(Dixon & Adamson)
   → CONSULTORIA PROATIVA: Você ensina o cliente a lucrar mais com cortes novos(Denver Steak / Flat Iron).

═══ SUA MÁQUINA DE MARGEM ═══
- MIX DE EQUILÍBRIO: Sua missão é vender o boi inteiro.Se o estoque de dianteiro sobe, você cria combos irresistíveis.
- RFM(Recência, Frequência, Valor): O Auditor avisa quem está esfriando, e você age antes do churn.

Organize em: 💰 GESTÃO DE MARGENS, 📞 RADAR DE CLIENTES(RFM), 🏆 TOP PERFORMANCE, 🏪 PLANO ESTRATÉGICO POR PERFIL`,


                AUDITOR: `Você é DRA.BEATRIZ, DIRETORA DE AUDITORIA, COMPLIANCE E GESTÃO DE RISCOS. 
Sua lente detecta o que os outros ignoram.Sua missão é a integridade absoluta.

📚 SEU CONHECIMENTO PROFUNDO(FRAMEWORKS GLOBAIS):
1. COSO Framework(Controles Internos)
   → AMBIENTE DE CONTROLE: Você analisa se há separação de funções e integridade nos registros de caixa e estoque.
2. IFRS(Normas Contábeis)
   → RECONHECIMENTO DE RECEITA: Venda só é fato quando o risco passa ao cliente.PENDENTE é risco, não lucro garantido.
3. Sarbanes - Oxley(Mindset)
   → Você garante que o Snapshot Financeiro reflete a verdade do chão de fábrica.

═══ SEU "RADAR DE CAÇA-ERROS" ═══
- Venda Paga SEM Entrada no Caixa = INDÍCIO DE DESVIO DE CONDUTA.
- Estoque Órfão(Peça sem Lote) = FALHA DE RASTREABILIDADE.
- Estorno sem devolução física = ERRO OPERACIONAL CRÍTICO.

Organize em: 🔴 ERROS CRÍTICOS(FRAUDES / DESVIOS), 🟡 INCONSISTÊNCIAS DE SISTEMA, 🚀 OPORTUNIDADE TRIBUTÁRIA / ESTRATÉGICA, 📋 PLANO DE SANEAMENTO`,


                ESTOQUE: `Você é JOAQUIM, DIRETOR DE LOGÍSTICA E COLD CHAIN. 
Sua missão: "Carne parada é dinheiro que evapora".Zero desperdício.

📚 SEU CONHECIMENTO PROFUNDO(LEAN LOGISTICS):
1. "Lean Thinking"(Womack & Jones)
   → MUDA(Desperdício): Você identifica o gado parado há > 5 dias como perda direta de ROI.
2. "Supply Chain Management"(Ballou)
   → NÍVEL DE SERVIÇO: Você garante que a promessa do Marcos(Comercial) se torne realidade na entrega.
3. Cold Chain Standards(Segurança Alimentar): 
   → Monitoramento de quebra por gotejamento(Drip Loss).Se o sensor falha, você avisa Dona Clara.

═══ SEUS CONTROLES ═══
- FIFO(First In, First Out): Peça velha sai hoje, ou não sai nunca mais.
- DRIP LOSS FINANCEIRO: Você calcula o valor em R$ que estamos perdendo por evaporação diária.

Organize em: ❄️ STATUS DA CÂMARA(QUALIDADE / TEMPERATURA), 📦 INVENTÁRIO CRÍTICO(FIFO), 📉 ANÁLISE DE PERDAS(DRIP LOSS), 🎯 AÇÕES LOGÍSTICAS`,

                COMPRAS: `Você é ROBERTO, DIRETOR DE SUPPLY CHAIN E RELACIONAMENTO COM PECUARISTAS. 
Você ganha dinheiro na COMPRA para que Marcos possa vender na frente.

📚 SEU CONHECIMENTO PROFUNDO(NEGOCIAÇÃO E PROVISIONAMENTO):
1. "Strategic Sourcing"(Kraljic Matrix)
   → ITENS ESTRATÉGICOS: O Boi Gordo é seu item crítico.Você não pode depender de um só fornecedor.Você diversifica a base.
2. "As 5 Forças de Porter"
   → PODER DE BARGANHA: Se a arroba sobe(Snapshot Ana), você usa sua "Moeda de Confiança"(pagamento em dia) para travar preço antigo.
3. ZOPA & BATNA(Negociação Harvard)
   → Você sempre conhece sua melhor alternativa antes de apertar a mão. "Seu João, se não baixar R$1 por @, eu fecho com a Fazenda Vista Verde agora".

═══ SEU "OLHO CLÍNICO" ═══
- RENDIMENTO(@por @): Você analisa o histórico do fornecedor. "Este fornecedor sempre rende <50%, vamos pagar menos no lote dele".
- SCORECARD: Você rankeia quem entrega carne com gordura amarela(pasto) vs branca(confinamento), alertando Isabela(Marketing) sobre o que estamos vendendo.

Organize em: 🚛 SCORECARD DE FORNECEDORES, 💰 ANÁLISE DE CUSTO / KG REAL, 🤝 NEGOCIAÇÕES EM ANDAMENTO, 💡 ESTRATÉGIA DE ABASTECIMENTO`,

                MERCADO: `Você é ANA, ECONOMISTA - CHEFE E ANALISTA DE MACROTENDÊNCIAS. 
Seu olho está no horizonte para proteger o FrigoGest da volatilidade.

📚 SEU CONHECIMENTO PROFUNDO(ANTECIPAÇÃO):
1. "The Black Swan"(Nassim Taleb)
   → Você está atenta a eventos de "cauda longa"(mudanças súbitas na B3, barreiras sanitárias, secas extremas) para agir antes do mercado.
2. "Principles for Dealing with the Changing World Order"(Ray Dalio)
   → Você entende os ciclos de dívida e commodities.Se a Arroba está no topo do ciclo, você recomenda cautela estratégica à Dona Clara.
3. Indicadores CEPEA / ESALQ e B3
   → Você traduz os números frios em decisões de negócio: "Dólar subiu → oferta interna vai cair → hora de subir preço ou estocar".

═══ SUA VISÃO ESTRATÉGICA ═══
- Você cruza a SAZONALIDADE(safra / entressafra) com a necessidade de caixa da Dona Clara.
- Você avalia se o custo_real_kg do Roberto está condizente com a cotação nacional.

Organize em: 📊 COTAÇÃO vs TENDÊNCIA, 📈 CICLO DE MERCADO, 💡 INSIGHTS MACRO - ESTRATÉGICOS`,

                ROBO_VENDAS: `Você é LUCAS, EXECUTIVO DE VENDAS E AUTOMAÇÃO B2B(MÁQUINA DE RECEITA). 

📚 SEU CONHECIMENTO PROFUNDO(MODERN SALES):
1. "Predictable Revenue"(Aaron Ross - Salesforce)
   → PROSPECÇÃO ATIVA: Você não espera o cliente ligar.Você ataca os "Açougueiros Novos" e os "Inativos" com base nos dados.
2. "SPIN Selling"(Neil Rackham)
   → Você faz as perguntas de SITUAÇÃO e PROBLEMA antes de oferecer carne. "Como está o rendimento da desossa que seu fornecedor atual entrega?".
3. "The Psychology of Selling"(Brian Tracy)
   → Você usa "Law of Reciprocity" para fechar vendas consultivas.

═══ SEU MOTOR DE CONVERSÃO ═══
- CRM INTEGRADO: Você vê quem não compra há 7 dias e dispara o Script de Reativação da Isabela.
- CRO(Conversion Rate Optimization): Você monitora a conversão de cada script disparado no WhatsApp.

Organize em: 📞 PIPELINE DE VENDAS(HOT LEADS), 💡 INSIGHTS DE CONVERSÃO, 🔦 ESTRATÉGIA DE REATIVAÇÃO, 📱 AUTOMAÇÃO DIGITAL, 📈 TENDÊNCIAS DE CONSUMO`,

                MARKETING: `Você é ISABELA, DIRETORA DE GROWTH MARKETING & ABM DO FRIGOGEST 2026 — a MENTE MAIS BRILHANTE de captação e retenção B2B do mercado de carnes no Brasil.

Sua missão é gerar receita PREVISÍVEL e ESCALÁVEL usando as estratégias mais modernas do mundo, adaptadas ao frigorífico regional.

📚 SEU CONHECIMENTO PROFUNDO(18 BEST - SELLERS + TENDÊNCIAS 2026):

═══ BLOCO 1: PSICOLOGIA DE DECISÃO E NEUROMARKETING ═══

1. "Thinking, Fast and Slow"(Daniel Kahneman, Nobel 2002)
   → SISTEMA 1 vs SISTEMA 2: O dono do açougue decide com emoção(Sistema 1) e justifica com razão(Sistema 2).Você cria mensagens que ativam o emocional PRIMEIRO.
   → ANCHORING(Viés de Ancoragem): Sempre mostre o preço mais alto primeiro. "Nosso traseiro premium sai R$42/kg, mas o combo B2B desta semana sai por R$35/kg."

2. "Influence: The Psychology of Persuasion"(Robert Cialdini)
   → 6 + 1 PRINCÍPIOS APLICADOS AO FRIGORÍFICO:
   * ESCASSEZ: "Último lote de traseiro Angus, só 2 disponíveis para envio hoje."
    * PROVA SOCIAL: "Os 5 maiores açougues do seu bairro já são abastecidos pelo FrigoGest."
        * AUTORIDADE: "Desossa com certificação ESG 2026 e rastreabilidade Blockchain."
            * RECIPROCIDADE: Enviar brinde tático → cliente retribui com pedido.
   * COMPROMISSO E COERÊNCIA: "Você que sempre compra o melhor, vai deixar o padrão Angus acabar?"
    * AFEIÇÃO: Construir rapport pessoal com cada açougueiro VIP.
   * UNIDADE(7º princípio, 2021): "Nós, açougueiros da Bahia, merecemos carne de primeira."

3. "Predictably Irrational"(Dan Ariely, MIT)
   → DECOY EFFECT B2B: Ofereça 3 opções: Dianteiro(barato), Traseiro(caro), COMBO MISTO(meio - termo atrativo).O combo é sua meta de margem.
   → LOSS AVERSION: "Todo dia com boi ruim na câmara você PERDE 3 clientes para a concorrência."
   → ZERO PRICE EFFECT: "Primeira entrega com frete GRÁTIS" destrói a barreira de entrada.

═══ BLOCO 2: GROWTH HACKING & FUNIL B2B ═══

4. "Hacking Growth"(Sean Ellis) + "Traction"(Gabriel Weinberg)
   → BULLSEYE FRAMEWORK: O canal nº1 do FrigoGest é WHATSAPP COMMERCE(80 % dos açougueiros estão lá).
   → NORTH STAR METRIC: "Total de kg faturados e retidos na base de VIPs mensais."
   → GROWTH LOOP: Cliente compra → recebe mimo(Cialdini: Reciprocidade) → posta foto do selo "Parceiro FrigoGest" → novo lead vê → ciclo repete.

5. "Predictable Revenue"(Aaron Ross, Salesforce)
   → MÁQUINA DE RECEITA PREVISÍVEL: Dividir o funil em COLD(prospecção), WARM(nutrição) e HOT(fechamento).
   → INTEGRAÇÃO COM LUCAS(Robô de Vendas): Isabela cria a COPY, Lucas dispara em escala.

═══ BLOCO 3: BRANDING, POSICIONAMENTO E CONTEÚDO ═══

6. "Purple Cow"(Seth Godin) + "Contagious"(Jonah Berger)
   → VACA ROXA: O FrigoGest não pode ser "mais um".Deve ser o frigorífico que o açougueiro ORGULHOSAMENTE conta para os outros.
   → MOEDA SOCIAL: Mande um Display de Acrílico "Açougue Parceiro FrigoGest 2026 - Padrão Ouro".Ele vai postar.
   → STEPPS(Jonah Berger): Social Currency, Triggers, Emotion, Public, Practical Value, Stories.

7. "Building a StoryBrand"(Donald Miller) + "Positioning"(Al Ries)
   → O CLIENTE É O HERÓI: "Aumente sua margem na prateleira sem esgotar sua paciência com boi duro."
   → POSICIONAMENTO: Ocupar o slot mental "O MAIS CONFIÁVEL DE ALTO RENDIMENTO".

8. "Ogilvy on Advertising"(David Ogilvy) + "This is Marketing"(Seth Godin)
   → COPYWRITING CIENTÍFICO B2B: Títulos claros com números. "Nova safra: 54% de rendimento de carne limpa."
   → TRIBOS: "Açougues que lucram na Bahia compram o padrão FrigoGest."

═══ BLOCO 4: ABM & ESTRATÉGIA MODERNA 2026 ═══

9. ACCOUNT - BASED MARKETING(ABM)
   → Cada açougue VIP é um "mercado de um".Criar conteúdo exclusivo para as TOP 10 contas.
   → PIPELINE ABM: Identify → Expand → Engage → Advocate.

10. HIPERPERSONALIZAÇÃO VIA IA 2026
   → Usar perfil_compra, padrao_gordura e objecoes_frequentes de cada cliente para criar ofertas sob medida.
   → WHATSAPP COMMERCE: Catálogo digital, chatbot de pedidos, campanhas segmentadas por RFM.

11. "Blue Ocean Strategy"(W.Chan Kim)
   → OCÉANO AZUL: Enquanto concorrentes disputam preço, FrigoGest oferece INTELIGÊNCIA("O frigorífico que ensina o açougue a lucrar").

═══════════════════════════════════════════════
💡 ENTREGUE 5 BLOCOS BRILHANTES:
═══════════════════════════════════════════════

🎯 1. DIAGNÓSTICO ABM(Segmentação RFM do Snapshot)
Analise os segmentos VIP, ESFRIANDO e EM_RISCO.Defina ação específica para cada grupo.

✍️ 2. SCRIPTS WHATSAPP COMMERCE(2 scripts prontos)
1 Script de REATIVAÇÃO(para ESFRIANDO) usando Loss Aversion + Mirroring FBI.
1 Script de PROSPECÇÃO(para NUNCA_COMPROU) usando Decoy Effect + Zero Price.

📊 3. CAMPANHA DE ESCASSEZ(baseada no estoque atual)
Use os dados de estoque velho e desequilíbrios do Snapshot para criar uma campanha URGENTE.

🧠 4. INSIGHT NEUROMARKETING
Aplique um viés cognitivo específico de Kahneman / Ariely aos dados do Snapshot para hackear uma venda.

🎁 5. GIFTING & VIRAL(baseado nos VIPs e fornecedores do Snapshot)
Qual mimo tático enviar HOJE para gerar boca - a - boca na região ? Use STEPPS de Jonah Berger.

    MÁXIMO 700 PALAVRAS.Use emojis.Cite NÚMEROS EXATOS do snapshot.Demonstre QI altíssimo.`,

                SATISFACAO: `Você é CAMILA, DIRETORA DE CUSTOMER EXPERIENCE(CX) E QUALIDADE PERCEBIDA. 
Sua missão é transformar compradores em FÃS do FrigoGest.

📚 SEU CONHECIMENTO PROFUNDO(X - EXPERIENCE):
1. "The Ultimate Question"(Fred Reichheld)
   → NPS(Net Promoter Score): Você classifica Promotores e Detratores.Um Detrator VIP é um ALERTA VERMELHO para Dona Clara.
2. "Delivering Happiness"(Tony Hsieh - Zappos)
   → WOW MOMENT: Você busca criar aquele momento em que o açougueiro diz: "Pena que não comprei antes!".Pode ser um brinde da Isabela ou uma entrega perfeita do Joaquim.
3. "The Effortless Experience"(Dixon & Toman)
   → Reduzir o esforço do cliente: Se ele reclama do boleto, você resolve com Dona Clara antes de ele desligar.

═══ SUA ESCUTA ATIVA ═══
- Você traduz as reclamações (Snapshot) em AÇÕES: "Osso vindo muito grande" → Seu Antônio precisa ajustar a desossa.

Organize em: 🤝 SAÚDE DO CLIENTE(NPS), 🥩 QUALIDADE PERCEBIDA, 🚚 FEEDBACK LOGÍSTICO, 🎯 TRATATIVAS`,
            };

            const baseRules = `\nRegras gerais: \n - Responda SEMPRE em português brasileiro\n - Seja DIRETO, PRÁTICO e ACIONÁVEL — fale como gerente de frigorífico, não como robô\n - Use emojis: 🔴 crítico, 🟡 atenção, 🟢 ok\n - Cite NÚMEROS ESPECÍFICOS do snapshot — nunca invente dados\n - Se não tiver dados suficientes, diga claramente o que falta\n - Máximo 600 palavras\n - Termine SEMPRE com 3 ações concretas numeradas: "FAÇA AGORA: 1. ... 2. ... 3. ..."`;

            // 🧠 MEMÓRIA PERSISTENTE — Buscar e injetar memórias anteriores
            let memoryBlock = '';
            try {
                const memories = await getAgentMemories(agentType as any);
                memoryBlock = formatMemoriesForPrompt(memories);
            } catch (e) { console.warn('[Memory] Falha ao buscar memórias:', e); }

            const newsBlock = marketNews.length > 0 ? `\n\n${formatNewsForAgent(marketNews)} ` : '';
            const predictionsBlock = formatPredictionsForPrompt(predictions);
            const dreBlock = (agentType === 'AUDITOR' || agentType === 'ADMINISTRATIVO') ? `\n\n${formatDREText(dreReport)} ` : '';
            const pricingBlock = (agentType === 'ESTOQUE' || agentType === 'COMERCIAL' || agentType === 'PRODUCAO') ? formatPrecificacaoForPrompt(precificacao) : '';
            const rfmBlock = (agentType === 'COMERCIAL' || agentType === 'MARKETING' || agentType === 'SATISFACAO') ? formatRFMForPrompt(clientScores) : '';
            const fullPrompt = `${prompts[agentType]}${baseRules}${memoryBlock} \n\n${dataPackets[agentType]}${predictionsBlock}${dreBlock}${pricingBlock}${rfmBlock}${newsBlock} \n\nINSTRUÇÃO CRÍTICA: A data de HOJE é ${new Date().toLocaleDateString('pt-BR')}.Use as NOTÍCIAS DO MERCADO acima como base para sua análise.NÃO invente notícias — cite apenas as que foram fornecidas.Se não houver notícias, diga que o feed não está disponível no momento.LEMBRE - SE: CARNE DURA NO MÁXIMO 8 DIAS NA CÂMARA.Peças com 6 + dias = VENDA URGENTE.`;
            const { text, provider } = await runCascade(fullPrompt, agentType);
            setAgentResponse(`_via ${provider} | 🧠 ${(memoryCounts[agentType] || 0) + 1} memórias_\n\n${text} `);

            // ⚡ FAÇÃO AUTÔNOMA — Detectar ações na resposta
            try {
                const detected = parseActionsFromResponse(text, clients);
                setDetectedActions(detected);
            } catch (e) { setDetectedActions([]); }

            // 🎨 CONTENT STUDIO — Detectar se Isabela quer gerar conteúdo visual
            if (agentType === 'MARKETING') {
                try {
                    const contentReq = detectContentRequest(text);
                    if (contentReq) {
                        setStudioRequest(contentReq);
                    } else {
                        setStudioRequest(null);
                    }
                } catch (e) { setStudioRequest(null); }
            } else {
                setStudioRequest(null);
            }

            setTimeout(() => agentResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);

            // 🧠 SALVAR MEMÓRIA — Extrair insights e persistir
            try {
                const agentAlerts = liveAlerts.filter(a => a.agent === agentType);
                const memoryData = extractInsightsFromResponse(text, agentType as any, provider, agentAlerts.length, 'INDIVIDUAL');
                await saveAgentMemory(memoryData);
                setMemoryCounts(prev => ({ ...prev, [agentType]: (prev[agentType] || 0) + 1 }));
            } catch (e) { console.warn('[Memory] Falha ao salvar memória:', e); }
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

        // Acumulador local para debate (evitar stale state)
        const localDiags: Record<string, { text: string; provider: string }> = {};

        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            setBulkProgress({ current: i + 1, total: agents.length, currentAgent: agent.name });
            try {
                const agentAlerts = liveAlerts.filter(a => a.agent === agent.id);

                // ═══ EXPERTISE SETORIAL — cada agente sabe exatamente o que deve analisar ═══
                const sectorFocus: Partial<Record<string, string>> = {
                    ADMINISTRATIVO: `🎯 FOCO: Calcule DRE simplificado.ESG META: ${INDUSTRY_BENCHMARKS_2026.ESG_MIN_COMPLIANCE}%.Ciclo de Caixa(PMR vs PMP).Identifique o maior risco e a maior oportunidade do negócio hoje.`,
                    PRODUCAO: `🎯 FOCO: Compare rendimento REAL com metas 2026(Nelore ${INDUSTRY_BENCHMARKS_2026.RENDIMENTO_NELORE} %, Angus ${INDUSTRY_BENCHMARKS_2026.RENDIMENTO_ANGUS} %).Analise toalete e vision_audit_status.`,
                    COMERCIAL: `🎯 FOCO: RFM completo.MARGEM META: ${INDUSTRY_BENCHMARKS_2026.MARGEM_OPERACIONAL_IDEAL}%.Identifique os 3 com maior risco de churn e cobranças vencidas.`,
                    AUDITOR: '🎯 FOCO: Verifique os 11 furos de integridade. Blockchain Traceability audit. Monte DRE resumido.',
                    ESTOQUE: `🎯 FOCO: Perda por drip loss(Meta max: ${INDUSTRY_BENCHMARKS_2026.DRIP_LOSS_MAX} %).GIRO META: ${INDUSTRY_BENCHMARKS_2026.GIRO_ESTOQUE_META} dias.Identifique peças críticas.`,
                    COMPRAS: '🎯 FOCO: Scorecard A/B/C de fornecedores. TCO real. Genética e ESG Score.',
                    MERCADO: `🎯 FOCO: Compare custo_real_kg vs CEPEA - BA.Margem vs Meta ${INDUSTRY_BENCHMARKS_2026.MARGEM_OPERACIONAL_IDEAL}%.Sazonalidade Fev / 2026.`,
                    ROBO_VENDAS: '🎯 FOCO: Segmentação RFM. Script WhatsApp FBI/Mirroring. Inovações 2026.',
                    MARKETING: '🎯 FOCO: ABM Completo — Diagnóstico RFM (VIP/Esfriando/Em Risco/Perdido). Campanha de ESCASSEZ com estoque >4d. Script WhatsApp com Anchoring + Loss Aversion (Kahneman). Gifting B2B tático. GROWTH LOOP: compra→mimo→post→lead.',
                    SATISFACAO: '🎯 FOCO: NPS (Net Promoter Score). Pós-venda personalizado. Objeções e Qualidade Percebida.',
                };
                const expertise = sectorFocus[agent.id] ? `\n${sectorFocus[agent.id]} \n` : '';

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
10. Estoque > 8 dias = CARNE VENCENDO, vender com desconto urgente(vida útil MAX 8 dias refrigerado)
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

                // 🧠 MEMÓRIA — Buscar e injetar memórias neste agente
                let memBlock = '';
                try {
                    const mems = await getAgentMemories(agent.id as any, 3);
                    memBlock = formatMemoriesForPrompt(mems);
                } catch (e) { }
                const promptWithMemory = miniPrompt + memBlock;

                const { text, provider } = await runCascade(promptWithMemory, agent.id);
                setAgentDiagnostics(prev => ({ ...prev, [agent.id]: { text, provider, timestamp: new Date() } }));
                localDiags[agent.id] = { text, provider };

                // 🧠 SALVAR MEMÓRIA do diagnóstico bulk
                try {
                    const memData = extractInsightsFromResponse(text, agent.id as any, provider, liveAlerts.filter(a => a.agent === agent.id).length, 'REUNIAO');
                    await saveAgentMemory(memData);
                    setMemoryCounts(prev => ({ ...prev, [agent.id]: (prev[agent.id] || 0) + 1 }));
                } catch (e) { }
            } catch (err: any) {
                setAgentDiagnostics(prev => ({ ...prev, [agent.id]: { text: `⚠️ Erro: ${err.message} `, provider: 'erro', timestamp: new Date() } }));
            }
        }
        setBulkRunning(false);
        setAutoRunDone(true);

        // ═══ 🤝 FASE 4: MULTI-AGENT DEBATE — Dona Clara sintetiza tudo ═══
        try {
            setDebateRunning(true);
            setBulkProgress({ current: 0, total: 1, currentAgent: 'Dona Clara (Síntese Executiva)' });

            // Coletar diagnósticos do acumulador local
            const allDiags: string[] = [];
            agents.forEach(agent => {
                const d = localDiags[agent.id];
                if (d && d.provider !== 'erro') {
                    allDiags.push(`═══ ${agent.icon} ${agent.name} ═══\n${d.text.substring(0, 500)} `);
                }
            });

            if (allDiags.length >= 3) {
                const predBlock = formatPredictionsForPrompt(predictions);
                const debatePrompt = `Você é a MODERADORA de uma REUNIÃO DE DIRETORIA do FrigoGest.
    ${allDiags.length} diretores acabaram de apresentar seus relatórios.

SUA MISSÃO: Simular uma CONVERSA REAL entre os diretores onde:
- Cada diretor DEFENDE seu ponto de vista com dados
    - Quando discordam, DEBATEM até chegar a um consenso
        - Votam nas decisões(✅ concordam / ❌ discordam)
            - Chegam a um PLANO DE AÇÃO UNIFICADO

REGRAS DO FRIGORÍFICO que DEVEM guiar as decisões:
- Carne resfriada = MAX 8 DIAS.Peças > 6 dias = desconto urgente.FIFO obrigatório.
- Margem saudável: 25 - 35 %.Giro ideal: 3 - 5 dias.
- Prazo de pagamento ao fornecedor DEVE ser maior que prazo de recebimento do cliente
    - Rendimento carcaça ideal: 52 - 56 %

        ${predBlock}

═══ RELATÓRIOS APRESENTADOS ═══
${allDiags.join('\n\n')}

═══ FORMATO OBRIGATÓRIO ═══

🗣️ DEBATE DOS DIRETORES:
[Simule 3 - 4 trocas onde diretores DISCUTEM entre si.Use os nomes reais.Ex: ]
👩‍💼 Dona Clara: "Roberto, vi que você quer comprar lote, mas o caixa..."
👨‍💼 Roberto: "Se não comprarmos, estoque acaba em 5 dias..."
📊 Joaquim: "Concordo com Roberto. Temos peças vencendo."

🤝 CONSENSO FINAL:
[O que TODOS concordaram]

🗳️ PLANO DE AÇÃO VOTADO:
1.[ação] — ✅ X / 10 votos — RESPONSÁVEL: [diretor]
2. ...
3. ...
4. ...
5. ...

📋 DECISÃO FINAL DA DONA CLARA:
[3 frases decidindo]

Responda em português BR.Máximo 500 palavras.`;

                const { text, provider } = await runCascade(debatePrompt, 'ADMINISTRATIVO');
                setDebateSynthesis({ text, provider, timestamp: new Date() });

                // Salvar memória da síntese
                try {
                    const memData = extractInsightsFromResponse(text, 'ADMINISTRATIVO', provider, liveAlerts.length, 'REUNIAO');
                    memData.summary = 'REUNIÃO DE DIRETORIA - Debate entre ' + allDiags.length + ' diretores com votação';
                    await saveAgentMemory(memData);
                } catch (e) { }
            }
        } catch (e) {
            console.warn('[Debate] Falha na síntese:', e);
        } finally {
            setDebateRunning(false);
        }
    }, [agents, batches, stock, sales, clients, transactions, suppliers, payables, liveAlerts, bulkRunning, agentLoading, marketNews, predictions]);

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
            const { text, provider } = await runCascade(fullPrompt, 'ADMINISTRATIVO');
            setAgentResponse(`_📋 Relatório Executivo via ${provider} _\n\n${text} `);
            setTimeout(() => agentResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
        } catch (err: any) {
            setAgentError(err.message || 'Erro ao gerar relatório.');
        } finally {
            setAgentLoading(false);
        }
    };

    return (
        <>
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

                        {/* ═══ 📈 PAINEL PREDITIVO (FASE 3) ═══ */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl border border-slate-700/50">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-blue-500/20 p-2 rounded-xl">
                                    <TrendingUp size={20} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-black text-sm uppercase tracking-widest">📈 Analytics Preditivo</h3>
                                    <p className="text-slate-500 text-[9px] font-bold">Projeções baseadas em médias móveis 7d/30d • Carne dura MAX 8 dias</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {[
                                    {
                                        label: 'Receita 30d',
                                        value: `R$${predictions.receitaProjetada30d.toFixed(0)} `,
                                        sub: `${predictions.tendenciaReceita === 'SUBINDO' ? '📈' : predictions.tendenciaReceita === 'CAINDO' ? '📉' : '➡️'} ${predictions.percentualVariacao > 0 ? '+' : ''}${predictions.percentualVariacao.toFixed(0)}% `,
                                        color: predictions.tendenciaReceita === 'CAINDO' ? 'text-rose-400' : 'text-emerald-400'
                                    },
                                    {
                                        label: 'Estoque esgota',
                                        value: predictions.diasAteEsgotar === 999 ? 'N/A' : `${predictions.diasAteEsgotar} d`,
                                        sub: `🥩 ${predictions.pecasVencendo} vencendo`,
                                        color: predictions.alertaEstoqueBaixo ? 'text-rose-400' : 'text-emerald-400'
                                    },
                                    {
                                        label: 'Caixa projetado',
                                        value: `R$${predictions.caixaProjetado30d.toFixed(0)} `,
                                        sub: predictions.alertaCaixaNegativo ? '🔴 Risco!' : '✅ Saudável',
                                        color: predictions.alertaCaixaNegativo ? 'text-rose-400' : 'text-emerald-400'
                                    },
                                    {
                                        label: 'Taxa Churn',
                                        value: `${predictions.taxaChurn.toFixed(0)}% `,
                                        sub: `${predictions.clientesAtivos30d} ativos`,
                                        color: predictions.alertaChurnAlto ? 'text-rose-400' : 'text-emerald-400'
                                    },
                                    {
                                        label: 'Comprar em',
                                        value: `${predictions.proximaCompraIdealDias} d`,
                                        sub: `Custo ${predictions.tendenciaCusto === 'SUBINDO' ? '🔴↑' : predictions.tendenciaCusto === 'CAINDO' ? '🟢↓' : '🟡→'} `,
                                        color: predictions.proximaCompraIdealDias <= 2 ? 'text-rose-400' : 'text-blue-400'
                                    },
                                ].map((p, i) => (
                                    <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5">
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{p.label}</p>
                                        <p className={`text - xl font - black ${p.color} `}>{p.value}</p>
                                        <p className="text-[9px] text-slate-500 font-bold mt-1">{p.sub}</p>
                                    </div>
                                ))}
                            </div>
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

                        {/* ═══ 💲 PRECIFICAÇÃO INTELIGENTE (FASE 7) ═══ */}
                        {precificacao.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-50">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-emerald-500/10 p-2 rounded-xl">
                                            <TrendingUp size={20} className="text-emerald-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">💲 Precificação Inteligente</h3>
                                            <p className="text-[9px] font-bold text-slate-400">Preço automático por idade • FIFO • Margem protegida</p>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[9px]">
                                            <thead>
                                                <tr className="text-left text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                                                    <th className="pb-2">Peça</th>
                                                    <th className="pb-2">Tipo</th>
                                                    <th className="pb-2">Peso</th>
                                                    <th className="pb-2">Dias</th>
                                                    <th className="pb-2">Custo/kg</th>
                                                    <th className="pb-2">Preço Sugerido</th>
                                                    <th className="pb-2">Desc.</th>
                                                    <th className="pb-2">Margem</th>
                                                    <th className="pb-2">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {precificacao.slice(0, 10).map(item => (
                                                    <tr key={item.id_completo} className={item.diasNaCamara >= 7 ? 'bg-rose-50' : item.diasNaCamara >= 5 ? 'bg-amber-50' : ''}>
                                                        <td className="py-2 font-mono font-bold text-slate-600">{item.id_completo}</td>
                                                        <td className="py-2 text-slate-500">{item.tipoNome}</td>
                                                        <td className="py-2 font-bold">{item.pesoKg.toFixed(1)}kg</td>
                                                        <td className="py-2 font-black">{item.emoji} {item.diasNaCamara}d</td>
                                                        <td className="py-2 text-slate-400">R${item.custoRealKg.toFixed(2)}</td>
                                                        <td className="py-2 font-black text-emerald-600">R${item.precoSugerido.toFixed(2)}</td>
                                                        <td className="py-2">{item.descontoAplicado > 0 ? <span className="text-rose-500 font-black">-{item.descontoAplicado}%</span> : '—'}</td>
                                                        <td className={`py - 2 font - black ${item.margemEstimada >= 25 ? 'text-emerald-600' : item.margemEstimada >= 10 ? 'text-amber-500' : 'text-rose-500'} `}>{item.margemEstimada}%</td>
                                                        <td className="py-2 text-[8px] font-black">{item.label}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ 👥 SCORING CLIENTES RFM (FASE 8) ═══ */}
                        {clientScores.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-50">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-purple-500/10 p-2 rounded-xl">
                                            <Users size={20} className="text-purple-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">👥 Scoring de Clientes (RFM)</h3>
                                            <p className="text-[9px] font-bold text-slate-400">Classificação automática • Recency × Frequency × Monetary</p>
                                        </div>
                                    </div>
                                    {/* Tier Distribution */}
                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                                        {([
                                            { tier: 'OURO', emoji: '🥇', color: 'from-amber-400 to-yellow-500' },
                                            { tier: 'PRATA', emoji: '🥈', color: 'from-slate-300 to-slate-400' },
                                            { tier: 'BRONZE', emoji: '🥉', color: 'from-orange-400 to-amber-500' },
                                            { tier: 'RISCO', emoji: '⚠️', color: 'from-rose-400 to-red-500' },
                                            { tier: 'NOVO', emoji: '🆕', color: 'from-blue-400 to-cyan-500' },
                                            { tier: 'INATIVO', emoji: '💤', color: 'from-gray-300 to-gray-400' },
                                        ] as const).map(t => (
                                            <div key={t.tier} className={`bg - gradient - to - r ${t.color} rounded - xl p - 3 text - center text - white`}>
                                                <p className="text-lg font-black">{tierSummary[t.tier]}</p>
                                                <p className="text-[8px] font-bold opacity-80">{t.emoji} {t.tier}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Top clients */}
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {clientScores.slice(0, 8).map(c => (
                                            <div key={c.id_ferro} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                                                <span className="text-lg">{c.tierEmoji}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black text-slate-700 truncate">{c.nome}</p>
                                                    <p className="text-[8px] text-slate-400">{c.recomendacao.substring(0, 60)}...</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-slate-600">R${c.monetary.toFixed(0)}</p>
                                                    <p className="text-[7px] text-slate-400">{c.frequency}x em 90d</p>
                                                </div>
                                                <span className={`text - [7px] font - black px - 2 py - 0.5 rounded - full ${c.tier === 'OURO' ? 'bg-amber-100 text-amber-700' : c.tier === 'RISCO' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'} `}>
                                                    {c.totalScore}/15
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ 📋 DRE + ESG + COMPLIANCE (FASE 6) ═══ */}
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-500/10 p-2 rounded-xl">
                                            <Activity size={20} className="text-indigo-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">📋 Compliance & Relatórios</h3>
                                            <p className="text-[9px] font-bold text-slate-400">DRE automática • ESG Score • Checklist regulatório</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        {(['SEMANA', 'MES', 'TOTAL'] as const).map(p => (
                                            <button key={p} onClick={() => setDrePeriodo(p)}
                                                className={`px - 3 py - 1.5 rounded - lg text - [8px] font - black uppercase tracking - widest transition - all ${drePeriodo === p ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                    } `}>
                                                {p === 'SEMANA' ? '7d' : p === 'MES' ? '30d' : 'Total'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* DRE Resumida */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                                    {[
                                        { label: 'Receita Líquida', value: `R$${dreReport.receitaLiquida.toFixed(0)} `, color: 'text-emerald-600' },
                                        { label: 'CMV', value: `R$${dreReport.cmv.toFixed(0)} `, color: 'text-rose-500' },
                                        { label: 'Lucro Bruto', value: `R$${dreReport.lucroBruto.toFixed(0)} `, color: dreReport.lucroBruto > 0 ? 'text-emerald-600' : 'text-rose-500' },
                                        { label: 'Margem Bruta', value: `${dreReport.margemBruta.toFixed(1)}% `, color: dreReport.margemBruta >= 25 ? 'text-emerald-600' : dreReport.margemBruta >= 15 ? 'text-amber-500' : 'text-rose-500' },
                                    ].map((k, i) => (
                                        <div key={i} className="bg-slate-50 rounded-xl p-3">
                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
                                            <p className={`text - lg font - black ${k.color} `}>{k.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* DRE Detalhada */}
                                <div className="bg-slate-900 rounded-xl p-4 mb-5 overflow-x-auto">
                                    <pre className="text-[10px] text-emerald-400 font-mono leading-relaxed whitespace-pre-wrap">
                                        {formatDREText(dreReport)}
                                    </pre>
                                    <button onClick={() => { navigator.clipboard.writeText(formatDREText(dreReport)); alert('📋 DRE copiada!'); }}
                                        className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500/30 transition-all">
                                        📋 Copiar DRE
                                    </button>
                                </div>

                                {/* ESG + Compliance lado a lado */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* ESG Score */}
                                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">🌱 ESG Score</h4>
                                            <div className={`text - 3xl font - black ${esgScore.nota >= 70 ? 'text-emerald-600' : esgScore.nota >= 40 ? 'text-amber-500' : 'text-rose-500'} `}>
                                                {esgScore.nota}/100
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {esgScore.detalhes.map((d, i) => (
                                                <div key={i} className="flex items-center justify-between">
                                                    <span className="text-[9px] text-slate-600 font-bold">{d.status} {d.item}</span>
                                                    <span className="text-[9px] font-black text-slate-500">{d.nota}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Compliance Checklist */}
                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
                                        <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-3">🏛️ Checklist Compliance ({COMPLIANCE_CHECKLIST.length} itens)</h4>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {COMPLIANCE_CHECKLIST.map(item => (
                                                <div key={item.id} className="flex items-center gap-2 text-[9px]">
                                                    <span>{item.icon}</span>
                                                    <span className="font-bold text-slate-700 flex-1">{item.item}</span>
                                                    <span className={`text - [7px] font - black px - 2 py - 0.5 rounded - full ${item.obrigatorio ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                                        } `}>{item.obrigatorio ? 'OBRIG.' : 'REC.'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ 📱 WHATSAPP COMMERCE (FASE 5) ═══ */}
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-green-500/10 p-2 rounded-xl">
                                        <MessageCircle size={20} className="text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">📱 WhatsApp Commerce</h3>
                                        <p className="text-[9px] font-bold text-slate-400">8 templates prontos • Catálogo digital • FIFO automático</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                                    {WHATSAPP_TEMPLATES.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                setSelectedWaTemplate(t.id);
                                                setWaPreview('');
                                            }}
                                            className={`px - 3 py - 2.5 rounded - xl text - [9px] font - black uppercase tracking - widest flex items - center gap - 1.5 transition - all ${selectedWaTemplate === t.id
                                                ? `bg-gradient-to-r ${t.color} text-white shadow-lg scale-[1.02]`
                                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                } `}
                                        >
                                            <span>{t.icon}</span> {t.name}
                                        </button>
                                    ))}
                                </div>
                                {selectedWaTemplate && (
                                    <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                        <div className="flex gap-3">
                                            <select
                                                value={selectedWaClient}
                                                onChange={(e) => {
                                                    setSelectedWaClient(e.target.value);
                                                    const cli = clients.find(c => c.id_ferro === e.target.value);
                                                    if (cli) {
                                                        const tmpl = WHATSAPP_TEMPLATES.find(t => t.id === selectedWaTemplate);
                                                        const catalog = generateCatalogFromStock(stock, sales);
                                                        const diasInativo = sales.filter(s => s.id_cliente === cli.id_ferro && s.status_pagamento !== 'ESTORNADO')
                                                            .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
                                                        const msg = tmpl?.generate(cli, {
                                                            diasInativo: diasInativo ? Math.floor((Date.now() - new Date(diasInativo.data_venda).getTime()) / 86400000) : 30,
                                                            valorDevido: cli.saldo_devedor,
                                                            produtosEstoque: catalog.slice(0, 5)
                                                        }) || '';
                                                        setWaPreview(msg);
                                                    }
                                                }}
                                                className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 font-bold"
                                            >
                                                <option value="">Selecionar cliente...</option>
                                                {clients.filter(c => c.whatsapp).map(c => {
                                                    const suggested = suggestTemplateForClient(c, sales);
                                                    return (
                                                        <option key={c.id_ferro} value={c.id_ferro}>
                                                            {c.nome_social} {c.saldo_devedor > 0 ? `(💰 R$${c.saldo_devedor.toFixed(0)})` : ''} {suggested === selectedWaTemplate ? '✅ Recomendado' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        {waPreview && (
                                            <>
                                                <div className="bg-white rounded-xl p-4 border border-green-200 shadow-sm">
                                                    <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-2">👁️ Pré-visualização</p>
                                                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{waPreview}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const cli = clients.find(c => c.id_ferro === selectedWaClient);
                                                            if (cli?.whatsapp) {
                                                                window.open(generateWhatsAppLinkFromTemplate(cli.whatsapp, waPreview), '_blank');
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
                                                    >
                                                        <MessageCircle size={14} /> Enviar via WhatsApp
                                                    </button>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(waPreview); alert('📋 Mensagem copiada!'); }}
                                                        className="px-4 py-3 rounded-xl bg-white text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all"
                                                    >
                                                        📋 Copiar
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ═══ 🤝 SÍNTESE EXECUTIVA — MULTI-AGENT DEBATE (FASE 4) ═══ */}
                        {debateRunning && (
                            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-3xl border border-amber-200 p-6 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <Loader2 size={20} className="animate-spin text-amber-500" />
                                    <span className="text-sm font-black text-amber-700 uppercase tracking-widest">🤝 Dona Clara está sintetizando os relatórios de todos os diretores...</span>
                                </div>
                            </div>
                        )}
                        {debateSynthesis && !bulkRunning && !debateRunning && (
                            <div className="bg-gradient-to-br from-amber-900 via-yellow-900 to-orange-900 rounded-3xl shadow-2xl overflow-hidden border border-amber-700/30">
                                <div className="p-6 border-b border-amber-700/30 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-yellow-500/20 p-2.5 rounded-xl">
                                            <Users size={20} className="text-yellow-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-yellow-300 uppercase tracking-widest">🤝 Síntese Executiva — Multi-Agent Debate</h3>
                                            <p className="text-[9px] font-bold text-amber-500">
                                                Dona Clara analisou {Object.keys(agentDiagnostics).length} relatórios • via {debateSynthesis.provider} • {debateSynthesis.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(debateSynthesis.text); alert('📋 Síntese copiada!'); }}
                                        className="px-4 py-2 rounded-xl bg-yellow-500/20 text-yellow-300 text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500/30 transition-all"
                                    >
                                        📋 Copiar
                                    </button>
                                </div>
                                <div className="p-6">
                                    <div className="text-sm text-amber-100 leading-relaxed whitespace-pre-wrap font-medium">
                                        {debateSynthesis.text}
                                    </div>
                                </div>
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
                                                        <div className={`${colors.bg} border ${colors.border} rounded - 2xl p - 5 shadow - sm relative group / diag`}>
                                                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{diag.text}</p>
                                                            <div className="mt-4 flex gap-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleWhatsAppAction(diag.text); }}
                                                                    className={`flex items - center gap - 2 px - 4 py - 2 rounded - xl text - [10px] font - black uppercase tracking - widest bg - emerald - 500 text - white hover: bg - emerald - 600 transition - all shadow - md`}
                                                                >
                                                                    <MessageCircle size={14} /> Enviar / Copiar Script
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(diag.text); alert('📋 Copiado!'); }}
                                                                    className={`flex items - center gap - 2 px - 4 py - 2 rounded - xl text - [10px] font - black uppercase tracking - widest bg - white text - slate - 500 border border - slate - 200 hover: bg - slate - 50 transition - all`}
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
                                const stats = agentStats[agent.id] ?? { total: 0, criticos: 0, bloqueios: 0 };
                                const colors = colorMap[agent.color] ?? COLOR_FALLBACK;
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
                                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">
                                                {agent.name}
                                                {(memoryCounts[agent.id] || 0) > 0 && (
                                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[8px] font-black align-middle" title={`${memoryCounts[agent.id]} memórias persistentes`}>
                                                        🧠 {memoryCounts[agent.id]}
                                                    </span>
                                                )}
                                            </h3>
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
                                                {(alert.agent === 'COMERCIAL' || alert.agent === 'SATISFACAO' || alert.agent === 'MARKETING' || alert.data?.whatsapp) && (
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

                                    {/* ⚡ AÇÕES AUTÔNOMAS — Botões detectádos pela IA */}
                                    {detectedActions.length > 0 && (
                                        <div className="mt-6 p-5 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Zap size={16} className="text-yellow-400" />
                                                <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">
                                                    ⚡ {detectedActions.length} Ações Detectádas — Clique para Executar
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {detectedActions.map(action => (
                                                    <button
                                                        key={action.id}
                                                        onClick={() => {
                                                            if (action.type === 'WHATSAPP' || action.type === 'REATIVAR' || action.type === 'COBRAR') {
                                                                if (action.clientPhone) {
                                                                    const msg = action.type === 'COBRAR'
                                                                        ? `Olá ${action.clientName || ''} !Tudo bem ? Passando para lembrar sobre o pagamento pendente.Podemos resolver hoje ? 🙏`
                                                                        : `Olá ${action.clientName || ''} !Temos novidades incríveis para você! 🔥 Quer saber das ofertas exclusivas desta semana ? `;
                                                                    window.open(generateWhatsAppLink(action.clientPhone, msg), '_blank');
                                                                    setActionLog(prev => [...prev, { action: `${action.icon} ${action.label} `, time: new Date() }]);
                                                                } else {
                                                                    navigator.clipboard.writeText(action.description);
                                                                    alert(`📋 Script copiado! Cole no WhatsApp de ${action.clientName || 'seu cliente'}.`);
                                                                    setActionLog(prev => [...prev, { action: `📋 Copiou: ${action.label} `, time: new Date() }]);
                                                                }
                                                            } else if (action.type === 'PROMO') {
                                                                navigator.clipboard.writeText(action.description);
                                                                alert(`📢 Campanha copiada!\n\n"${action.description}"\n\nCole no WhatsApp ou redes sociais.`);
                                                                setActionLog(prev => [...prev, { action: `📢 Campanha criada`, time: new Date() }]);
                                                            } else if (action.type === 'RELATORIO') {
                                                                navigator.clipboard.writeText(agentResponse || '');
                                                                alert('📊 Relatório copiado para área de transferência!');
                                                                setActionLog(prev => [...prev, { action: `📊 Relatório exportado`, time: new Date() }]);
                                                            } else {
                                                                navigator.clipboard.writeText(action.description);
                                                                alert(`✅ Ação registrada: ${action.label} `);
                                                                setActionLog(prev => [...prev, { action: action.label, time: new Date() }]);
                                                            }
                                                        }}
                                                        className={`px - 4 py - 3 rounded - xl bg - gradient - to - r ${action.color} text - white text - [10px] font - black uppercase tracking - widest flex items - center gap - 2 hover: scale - [1.02] transition - all shadow - lg`}
                                                    >
                                                        <span>{action.icon}</span>
                                                        <span className="flex-1 text-left">{action.label}</span>
                                                        {action.urgency === 'ALTA' && <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[8px]">URGENTE</span>}
                                                    </button>
                                                ))}
                                            </div>
                                            {actionLog.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-white/5">
                                                    <p className="text-[9px] text-slate-500 font-bold">Histórico: {actionLog.slice(-3).map(l => `${l.action} (às ${l.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`).join(' • ')}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 🎨 CONTENT STUDIO — botão aparece quando Isabela detecta oportunidade de conteúdo */}
                                    {studioRequest && consultingAgent === 'MARKETING' && (
                                        <div className="mt-4 p-5 bg-gradient-to-br from-fuchsia-900/20 to-purple-900/20 rounded-2xl border border-fuchsia-500/20">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-fuchsia-400">✨</span>
                                                <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">
                                                    Isabela identificou oportunidade de conteúdo visual
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mb-4">
                                                Gerar imagem + copy + hashtags prontos com os dados reais do seu estoque/clientes.
                                                <span className="text-amber-400"> Nada é enviado sem sua aprovação.</span>
                                            </p>
                                            <button
                                                onClick={async () => {
                                                    setStudioLoading(true);
                                                    try {
                                                        const content = await generateContent(studioRequest);
                                                        setStudioContent(content);
                                                    } catch (e) {
                                                        console.error('[ContentStudio] Erro:', e);
                                                    } finally {
                                                        setStudioLoading(false);
                                                    }
                                                }}
                                                disabled={studioLoading}
                                                className="w-full px-5 py-4 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:from-fuchsia-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-900/30 disabled:opacity-60"
                                            >
                                                {studioLoading ? (
                                                    <>
                                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                                        </svg>
                                                        Gerando imagem + copy...
                                                    </>
                                                ) : (
                                                    <>✨ Criar Conteúdo Visual (Imagem + Copy + Hashtags)</>
                                                )}
                                            </button>
                                        </div>
                                    )}

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

        {/* 🎨 CONTENT STUDIO MODAL — aprovação obrigatória antes de qualquer envio */}
        {studioContent && (
            <ContentStudioModal
                content={studioContent}
                onClose={() => setStudioContent(null)}
                onRegenerate={async () => {
                    if (!studioRequest) return;
                    setStudioLoading(true);
                    try {
                        const fresh = await generateContent(studioRequest);
                        setStudioContent(fresh);
                    } catch (e) {
                        console.error('[ContentStudio] Regenerar erro:', e);
                    } finally {
                        setStudioLoading(false);
                    }
                }}
                isRegenerating={studioLoading}
            />
        )}
        </>
    );
};

export default AIAgents;
