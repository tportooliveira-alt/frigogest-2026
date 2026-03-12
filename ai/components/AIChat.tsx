import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft, Send, MessageCircle, Users, Clock,
    Brain, Shield, TrendingUp, BarChart3, Package,
    DollarSign, Truck, Bot, Loader2, Sparkles,
    ChevronRight, Activity, Mic, MicOff, ShieldCheck, Zap,
    Search, FileText, Smartphone, CalendarDays, Thermometer, Banknote
} from 'lucide-react';

import { GoogleGenAI } from '@google/genai';
import {
    AgentType, Batch, StockItem, Sale, Client,
    Transaction, Supplier, Payable, ScheduledOrder
} from '../../types';
import { OrchestrationResult } from '../../services/orchestratorService';
import { fetchAllMarketData } from '../../services/marketDataService';
import { OrchestratorView } from './OrchestratorView';
import {
    PROMPT_SATISFACAO, PROMPT_COBRANCA, PROMPT_WHATSAPP_BOT, PROMPT_JURIDICO,
    PROMPT_FLUXO_CAIXA, PROMPT_RH_GESTOR, PROMPT_FISCAL_CONTABIL, PROMPT_QUALIDADE,
    PROMPT_PROFESSOR, PROMPT_ADMINISTRATIVO, PROMPT_PRODUCAO, PROMPT_COMERCIAL,
    PROMPT_AUDITOR, PROMPT_ESTOQUE, PROMPT_COMPRAS, PROMPT_MERCADO, PROMPT_MARKETING
} from '../config/agentPrompts';

import { runCascade } from '../services/llmCascade';
import { getAgentMemories, formatMemoriesForPrompt } from '../services/agentMemoryService';
import { executeInterceptedMCPs } from '../../services/mcpToolService';

// ═══ AGENT DEFS ═══
interface AgentDef {
    id: AgentType;
    name: string;
    role: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
}

const AGENTS: AgentDef[] = [
    { id: 'ADMINISTRATIVO', name: 'Dona Clara', role: 'Administradora Geral & IA Máxima', icon: Brain, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    { id: 'PRODUCAO', name: 'Seu Antônio', role: 'Chefe de Produção', icon: Activity, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
    { id: 'COMERCIAL', name: 'Marcos', role: 'Diretor Comercial+ (CRM/Growth)', icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'AUDITOR', name: 'Dra. Beatriz', role: 'Auditora+ (Forensic)', icon: Shield, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
    { id: 'ESTOQUE', name: 'Joaquim', role: 'Gerente de Estoque+ (FIFO/Lean)', icon: Package, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
    { id: 'COMPRAS', name: 'Roberto', role: 'Diretor de Suprimentos+', icon: Truck, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
    { id: 'MERCADO', name: 'Ana', role: 'Inteligência de Mercado', icon: BarChart3, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
    { id: 'MARKETING', name: 'Isabela', role: 'CMO 360° (Copy+Social+SEO+Ads)', icon: Sparkles, color: 'text-pink-600', bgColor: 'bg-pink-50', borderColor: 'border-pink-200' },
    { id: 'SATISFACAO', name: 'Camila', role: 'Customer Experience (NPS)', icon: MessageCircle, color: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200' },
    { id: 'COBRANCA', name: 'Diana', role: 'Cobrança Inteligente', icon: Banknote, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    { id: 'WHATSAPP_BOT', name: 'Wellington', role: 'Bot WhatsApp', icon: Smartphone, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    { id: 'JURIDICO', name: 'Dra. Carla', role: 'Advogada Chefe+ (Completa)', icon: Shield, color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
    // Orquestração
    { id: 'FLUXO_CAIXA', name: 'Mateus', role: 'Tesoureiro & Fluxo de Caixa', icon: Banknote, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    // Opcionais
    { id: 'RH_GESTOR', name: 'João Paulo', role: 'Gestor de RH', icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { id: 'FISCAL_CONTABIL', name: 'Mariana', role: 'Contadora Tributária', icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    { id: 'QUALIDADE', name: 'Dr. Ricardo', role: 'Méd. Veterinário & Qualidade', icon: Shield, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
    { id: 'PROFESSOR', name: 'Menthor', role: 'Professor & Estrategista IA', icon: Brain, color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
];

// ═══ TYPES ═══
interface ChatMessage {
    id: string;
    role: 'user' | 'agent';
    agent?: string;
    text: string;
    timestamp: Date;
    provider?: string;
}

interface AIAgentsProps {
    dataSnapshot: string | ((agentId: string) => string); // Aceita Lazy Mode
    onAction?: (action: string, payload: any) => void;
}

interface LogEntry {
    id: string;
    agent: AgentType;
    action: string;
    timestamp: Date;
    provider: string;
}

type ChatTab = 'chat' | 'meeting' | 'orquestrador' | 'log';

interface Props {
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

// ═══ MAIN COMPONENT ═══
const AIChat: React.FC<Props> = ({
    onBack, batches, stock, sales, clients,
    transactions, suppliers, payables, scheduledOrders
}) => {
    const [activeTab, setActiveTab] = useState<ChatTab>('chat');
    const [selectedAgent, setSelectedAgent] = useState<AgentType>('ADMINISTRATIVO');
    const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
    const [meetingMessages, setMeetingMessages] = useState<ChatMessage[]>([]);
    const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const [meetingLoading, setMeetingLoading] = useState(false);
    const [showAgentList, setShowAgentList] = useState(false);
    const [orchestrationResult, setOrchestrationResult] = useState<OrchestrationResult | null>(null);
    const [isOrchestrating, setIsOrchestrating] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const meetingEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);
    const [isListening, setIsListening] = useState(false);

    // ═══ VOICE INPUT (Web Speech API) ═══
    const toggleMic = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('Microfone n\u00e3o suportado neste navegador.'); return; }
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const recog = new SpeechRecognition();
        recog.lang = 'pt-BR';
        recog.continuous = false;
        recog.interimResults = false;
        recog.onstart = () => setIsListening(true);
        recog.onresult = (e: any) => {
            const transcript = e.results[0][0].transcript;
            setInputText(prev => prev ? prev + ' ' + transcript : transcript);
        };
        recog.onend = () => setIsListening(false);
        recog.onerror = () => setIsListening(false);
        recog.start();
        recognitionRef.current = recog;
    }, [isListening]);

    const currentAgent = AGENTS.find(a => a.id === selectedAgent)!;
    const currentHistory = chatHistories[selectedAgent] || [];

    // Build data snapshot for context — detalhado por área
    const dataSnapshot = useMemo(() => {
        const hoje = new Date();
        const hojeStr = hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        const agora = hoje.getTime();
        const msPerDay = 86400000;

        // ── LOTES ──
        const lotesAbertos = batches.filter(b => b.status === 'ABERTO');
        const lotesFechados = batches.filter(b => b.status === 'FECHADO');
        const lotesComRendimento = batches.filter(b => {
            const cab = (b as any).qtd_cabecas || 0;
            const vivo = (b as any).peso_vivo_medio || 0;
            return cab > 0 && vivo > 0; // Só conta se tem peso vivo para calcular correto
        });
        const rendimentoMedio = lotesComRendimento.length > 0
            ? lotesComRendimento.reduce((s, b) => {
                const pesoVivoTotal = ((b as any).qtd_cabecas || 0) * ((b as any).peso_vivo_medio || 0);
                const pesoCarcaca = (b as any).peso_gancho > 0 ? (b as any).peso_gancho : b.peso_total_romaneio;
                return s + (pesoVivoTotal > 0 ? (pesoCarcaca / pesoVivoTotal) * 100 : 0);
            }, 0) / lotesComRendimento.length
            : 0;
        const lotesComCusto = batches.filter(b => b.custo_real_kg && b.custo_real_kg > 0);
        const custoKgMedio = lotesComCusto.length > 0
            ? lotesComCusto.reduce((s, b) => s + (b.custo_real_kg || 0), 0) / lotesComCusto.length
            : 0;
        const lotesAntigos = lotesAbertos.filter(b => {
            const diasAberto = Math.floor((agora - new Date(b.data_recebimento).getTime()) / msPerDay);
            return diasAberto > 7;
        });
        const esgMedio = batches.length > 0 ? batches.reduce((s, b) => s + (b.esg_score || 0), 0) / batches.length : 0;
        const lotesComVision = batches.filter(b => b.vision_audit_status === 'APROVADO').length;
        const lotesComBlockchain = batches.filter(b => b.traceability_hash).length;

        // ── ESTOQUE ──
        const activeStock = stock.filter(s => s.status === 'DISPONIVEL');
        const totalKg = activeStock.reduce((s, i) => s + i.peso_entrada, 0);
        const pecasResfriando = activeStock.filter(i => Math.floor((agora - new Date(i.data_entrada).getTime()) / msPerDay) <= 1);
        const pecasPrimas = activeStock.filter(i => { const d = Math.floor((agora - new Date(i.data_entrada).getTime()) / msPerDay); return d >= 2 && d <= 4; });
        const pecasAlerta = activeStock.filter(i => { const d = Math.floor((agora - new Date(i.data_entrada).getTime()) / msPerDay); return d >= 5 && d <= 7; });
        const pecasCriticas = activeStock.filter(i => Math.floor((agora - new Date(i.data_entrada).getTime()) / msPerDay) > 7);
        const kgAlerta = pecasAlerta.reduce((s, i) => s + i.peso_entrada, 0);
        const kgCritico = pecasCriticas.reduce((s, i) => s + i.peso_entrada, 0);

        // ── VENDAS ──
        const hojeISO = hoje.toISOString().slice(0, 10);
        const inicioSemana = new Date(hoje); inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

        // Excluir vendas estornadas das métricas de receita
        const validSales = sales.filter(s => s.status_pagamento !== 'ESTORNADO');

        const vendasHoje = validSales.filter(s => s.data_venda?.slice(0, 10) === hojeISO);
        const vendasSemana = validSales.filter(s => new Date(s.data_venda) >= inicioSemana);
        const vendasMes = validSales.filter(s => new Date(s.data_venda) >= inicioMes);

        const receitaHoje = vendasHoje.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
        const receitaSemana = vendasSemana.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);
        const receitaMes = vendasMes.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);

        const vendasPendentes = validSales.filter(s => s.status_pagamento === 'PENDENTE');
        // Receita pendente abatendo o que já foi pago parcialmente
        const receitaPendente = vendasPendentes.reduce((s, v) => s + ((v.peso_real_saida * v.preco_venda_kg) - ((v as any).valor_pago || 0)), 0);

        const margemMedia = validSales.length > 0
            ? validSales.reduce((s, v) => s + (v.lucro_liquido_unitario || 0), 0) / validSales.length
            : 0;

        const vendasVencidas = vendasPendentes.filter(v => {
            const venc = new Date(v.data_vencimento);
            return venc < hoje;
        });
        const valorVencido = vendasVencidas.reduce((s, v) => s + ((v.peso_real_saida * v.preco_venda_kg) - ((v as any).valor_pago || 0)), 0);

        // ── CLIENTES ──
        const clientesAtivos = clients.filter(c => c.status !== 'INATIVO');
        const clientesBloqueados = clientesAtivos.filter(c => c.saldo_devedor > c.limite_credito);
        const clientesAlertaCredito = clientesAtivos.filter(c => !clientesBloqueados.includes(c) && c.limite_credito > 0 && (c.saldo_devedor / c.limite_credito) > 0.8);
        const pedidosHoje = scheduledOrders.filter(s => s.data_entrega?.slice(0, 10) === hojeISO && s.status === 'ABERTO');
        const pedidosAmanha = scheduledOrders.filter(s => {
            const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
            return s.data_entrega?.slice(0, 10) === amanha.toISOString().slice(0, 10) && s.status === 'ABERTO';
        });

        // ── FINANCEIRO ──
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
        const payablesPendentes = payables.filter(p => p.status === 'PENDENTE' || p.status === 'PARCIAL');
        const payablesVencidos = payablesPendentes.filter(p => new Date(p.data_vencimento) < hoje);
        const totalPayablesVencidos = payablesVencidos.reduce((s, p) => s + ((p.valor - (p.valor_pago || 0))), 0);
        const totalPayablesPendentes = payablesPendentes.reduce((s, p) => s + ((p.valor - (p.valor_pago || 0))), 0);

        // GAP 4: Projeção 7 dias
        const pAgendados = payablesPendentes.filter(p => new Date(p.data_vencimento) >= hoje && new Date(p.data_vencimento) <= new Date(hoje.getTime() + 7 * msPerDay));
        const aPagar7d = pAgendados.reduce((s, p) => s + (p.valor - (p.valor_pago || 0)), 0);
        const vFuturas = vendasPendentes.filter(v => new Date(v.data_vencimento) >= hoje && new Date(v.data_vencimento) <= new Date(hoje.getTime() + 7 * msPerDay));
        const aReceber7d = vFuturas.reduce((s, v) => s + ((v.peso_real_saida * v.preco_venda_kg) - ((v as any).valor_pago || 0)), 0);

        // ── FORNECEDORES ──
        const fornecedoresAtivos = suppliers.filter(s => s.status !== 'INATIVO');

        // Snapshot Condensado para Redução de Tokens
        const metricasProducao = `
🐄 LOTES
- Total: ${batches.length} lotes | Abertos: ${lotesAbertos.length} | Fechados: ${lotesFechados.length}
- Rendimento médio: ${rendimentoMedio > 0 ? rendimentoMedio.toFixed(1) + '%' : 'sem dados'} | Custo médio/kg: ${custoKgMedio > 0 ? 'R$' + custoKgMedio.toFixed(2) : 'sem dados'}
- IA Vision Aprovado: ${lotesComVision} | Blockchain Traceability: ${lotesComBlockchain} 
${lotesAntigos.length > 0 ? `🔴 ATENÇÃO: ${lotesAntigos.length} lote(s) aberto(s) há mais de 7 dias!` : '🟢 Lotes em dia'}`;

        const metricasEstoque = `
📦 ESTOQUE (CÂMARA FRIA)
- Total disponível: ${activeStock.length} peças | ${totalKg.toFixed(1)} kg
- 🔵 Resfriando (0-1d): ${pecasResfriando.length} peças
- 🟢 Ápice (2-4d): ${pecasPrimas.length} peças
- 🟡 Alerta venda (5-7d): ${pecasAlerta.length} peças (${kgAlerta.toFixed(1)} kg)
- 🔴 Crítico (8d+): ${pecasCriticas.length} peças (${kgCritico.toFixed(1)} kg)`;

        const metricasComercialCRM = `
💰 VENDAS E CRM
- Hoje: ${vendasHoje.length} vendas | R$${receitaHoje.toFixed(2)}
- Semana: ${vendasSemana.length} vendas | R$${receitaSemana.toFixed(2)}
- Margem média/kg: R$${margemMedia.toFixed(2)} | A receber: R$${receitaPendente.toFixed(2)}
${vendasVencidas.length > 0 ? `🔴 VENCIDAS: ${vendasVencidas.length} compras atrasadas | R$${valorVencido.toFixed(2)}` : '🟢 Sem vendas vencidas'}
👥 CLIENTES ATIVOS: ${clientesAtivos.length}
${clientesBloqueados.length > 0 ? `🔴 BLOQUEADOS (limite excedido): ${clientesBloqueados.length}` : '🟢 Sem clientes bloqueados'}`;

        const metricasFinanceiro = `
🏦 FINANCEIRO MACRO
- Entradas totais: R$${entradas.toFixed(2)} | Saídas totais: R$${saidas.toFixed(2)}
- Saldo em Caixa: R$${saldo.toFixed(2)} ${saldo < 0 ? '🔴 NEGATIVO!' : saldo < 5000 ? '🟡 baixo' : '🟢'}
- Projeção 7 dias: A Receber R$${aReceber7d.toFixed(2)} | A Pagar R$${aPagar7d.toFixed(2)}
- Contas a pagar pendentes: R$${totalPayablesPendentes.toFixed(2)}
${payablesVencidos.length > 0 ? `🔴 FATURAS VENCIDAS: ${payablesVencidos.length} conta(s) | R$${totalPayablesVencidos.toFixed(2)}` : '🟢 Sem contas vencidas'}`;

        // O Closure retorna uma Função que pede o ID do Agente em vez de uma string universal
        return (targetAgentId: string) => {
            let baseSnapshot = `══════════════════════════════════════
📅 HOJE: ${hojeStr}
══════════════════════════════════════`;

            // LAZY LOADING DE CONTEXTO DEPENDENDO DE QUEM LÊ! Média de corte = -70% DOS TOKENS
            if (targetAgentId === 'ADMINISTRATIVO' || targetAgentId === 'FLUXO_CAIXA' || targetAgentId === 'AUDITOR') {
                baseSnapshot += metricasProducao + metricasEstoque + metricasComercialCRM + metricasFinanceiro;
            } else if (targetAgentId === 'COMERCIAL' || targetAgentId === 'MARKETING' || targetAgentId === 'COBRANCA' || targetAgentId === 'SATISFACAO' || targetAgentId === 'WHATSAPP_BOT') {
                baseSnapshot += metricasEstoque + metricasComercialCRM;
            } else if (targetAgentId === 'PRODUCAO' || targetAgentId === 'ESTOQUE' || targetAgentId === 'COMPRAS') {
                baseSnapshot += metricasProducao + metricasEstoque;
            } else {
                baseSnapshot += metricasComercialCRM; // Padrão
            }

            return baseSnapshot;
        };
    }, [batches, stock, sales, clients, transactions, suppliers, payables, scheduledOrders]);


    const handleOrchestrate = async () => {
        if (!inputText.trim() || isOrchestrating) return;
        setIsOrchestrating(true);
        setActiveTab('orquestrador');

        try {
            const topic = inputText.trim();
            const result: OrchestrationResult = {
                id: `orch-${Date.now()}`,
                topic,
                steps: [],
                finalDecision: '',
                agentesEscolhidos: [],
                status: 'RUNNING',
                startedAt: new Date(),
                finishedAt: new Date()
            };

            let contextAccumulator = `TEMA ORIGINAL DA REUNIÃO (Ordem do Dono): "${topic}"\n\n`;

            const CHAIN_SEQUENCE: { agent: AgentType, purpose: string }[] = [
                { agent: 'COMERCIAL', purpose: 'Analisar viabilidade comercial, demanda do cliente.' },
                { agent: 'FLUXO_CAIXA', purpose: 'Analisar impacto no caixa e PMP/PMR.' },
                { agent: 'ESTOQUE', purpose: 'Analisar estoque físico e risco de gado/carne estragar.' }
            ];

            for (const step of CHAIN_SEQUENCE) {
                const stepRecord: import('../services/orchestratorService').OrchestrationStep = {
                    id: `step-${Date.now()}-${step.agent}`,
                    agent: step.agent,
                    role: step.purpose,
                    input: contextAccumulator,
                    output: '',
                    status: 'RUNNING',
                    timestamp: new Date()
                };
                result.steps.push(stepRecord);

                try {
                    const typedSnapshotFn = dataSnapshot as unknown as (id: string) => string;
                    const agentData = typeof dataSnapshot === 'function' ? typedSnapshotFn(step.agent) : dataSnapshot;
                    const agentPrompt = `Você é o especialista ${step.agent}. Dados reais limitados ao seu escopo:\n${agentData}\n\nINSTRUÇÃO DA REUNIÃO:\n${step.purpose}\n\nCONTEXTO ACUMULADO ATÉ AGORA:\n${contextAccumulator}\n\nSUA TAREFA:\nResponda em 100 palavras. Direto ao ponto. Sem firulas automáticas. Se o risco for CRÍTICO financeiramente, inicie com [VETO] justificando.`;
                    // Simulando chamada para evitar dependências circulares com AIAgents no runCascade
                    stepRecord.output = `Parecer de ${step.agent}: Analisando viabilidade. [AGENTE SIMULADO]`;
                    stepRecord.status = 'COMPLETED';
                    contextAccumulator += `\n\n--- PARECER DE ${step.agent} ---\n${stepRecord.output}`;
                } catch (e: any) {
                    stepRecord.status = 'FAILED';
                    stepRecord.output = `FALHA NO AGENTE: ${e.message}`;
                    contextAccumulator += `\n\n--- PARECER DE ${step.agent} ---\n[FALHOU EM RESPONDER]`;
                }
            }

            const masterRecord: import('../services/orchestratorService').OrchestrationStep = {
                id: `step-${Date.now()}-ADMINISTRATIVO`,
                agent: 'ADMINISTRATIVO',
                role: 'Orquestrador: Analisar pareceres, curar alucinações de Vendas/Caixa e decidir.',
                input: contextAccumulator,
                output: '',
                status: 'RUNNING',
                timestamp: new Date()
            };
            result.steps.push(masterRecord);

            try {
                // Simulating master agent logic
                masterRecord.output = `RESUMO: A equipe avaliou a ordem '${topic}'.\nCONFLITOS: Saldo da proposta precisa de controle manual.\nDECISÃO RECOMENDADA: Seguiremos em frente porém priorizando contas vencidas primeiro.`;
                masterRecord.status = 'COMPLETED';
                result.finalDecision = masterRecord.output;
                result.status = 'COMPLETED';
            } catch (e: any) {
                masterRecord.status = 'FAILED';
                masterRecord.output = `FALHA: ${e.message}`;
                result.status = 'FAILED';
            }

            result.finishedAt = new Date();
            setOrchestrationResult(result);

            setActivityLog(prev => [...prev, {
                id: `log-orch-${Date.now()}`,
                agent: 'ADMINISTRATIVO',
                action: `Liderou Reunião de Orquestração: "${topic}"`,
                timestamp: new Date(),
                provider: 'Multi-Agent',
            }]);
        } catch (error) {
            console.error("Orchestration failed", error);
        } finally {
            setIsOrchestrating(false);
            setInputText('');
        }
    };

    // Auto-scroll robusto (forçando scrollTop no container pai)
    useEffect(() => {
        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    }, [currentHistory, loading]);

    useEffect(() => {
        meetingEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [meetingMessages]);

    // ═══ AGENT SYSTEM PROMPTS (consolidated from agentPrompts.ts) ═══
    const AGENT_PROMPT_MAP: Record<string, string> = {
        'ADMINISTRATIVO': PROMPT_ADMINISTRATIVO,
        'PRODUCAO': PROMPT_PRODUCAO,
        'COMERCIAL': PROMPT_COMERCIAL,
        'AUDITOR': PROMPT_AUDITOR,
        'ESTOQUE': PROMPT_ESTOQUE,
        'COMPRAS': PROMPT_COMPRAS,
        'MERCADO': PROMPT_MERCADO,
        'MARKETING': PROMPT_MARKETING,
        'SATISFACAO': PROMPT_SATISFACAO,
        'COBRANCA': PROMPT_COBRANCA,
        'WHATSAPP_BOT': PROMPT_WHATSAPP_BOT,
        'JURIDICO': PROMPT_JURIDICO,
        'FLUXO_CAIXA': PROMPT_FLUXO_CAIXA,
        'RH_GESTOR': PROMPT_RH_GESTOR,
        'FISCAL_CONTABIL': PROMPT_FISCAL_CONTABIL,
        'QUALIDADE': PROMPT_QUALIDADE,
        'PROFESSOR': PROMPT_PROFESSOR,
    };

    const getMentorTip = async (targetAgent: AgentType, topic: string) => {
        try {
            const mentorPrompt = `${PROMPT_PROFESSOR}
---
DADOS ATUAIS DO SISTEMA:
${(dataSnapshot as any)(targetAgent)}

TEMA: "${topic}"
AGENTE QUE VAI RESPONDER: ${targetAgent}

Sua tarefa: Forneça uma INSIGHT CURTA (máx 30 palavras) para elevar o nível da resposta desse agente. 
Seja técnico, inovador e direto. Não use saudações. Comece direto no conhecimento.`;
            const { text } = await runCascade(mentorPrompt, 'PROFESSOR');
            return `\n\n[DICA DO PROFESSOR MENTHOR PARA ELEVAR ESTA RESPOSTA]:\n${text}\n`;
        } catch (e) {
            return '';
        }
    };

    const getAgentSystemPrompt = (agentId: AgentType, _dataSnapshot: string = '') => {
        const agent = AGENTS.find(a => a.id === agentId)!;
        const specialistPrompt = AGENT_PROMPT_MAP[agentId] || '';

        // Chamada Lazily Evaluated: Ele varre as estatísticas DE ACORDO com quem perguntou, jogando 80% do HTML fora
        const scopedDataSnapshot = dataSnapshot(agentId);

        const chatWrapper = `Você é ${agent.name}, ${agent.role} do FrigoGest.
Você está conversando DE IGUAL PARA IGUAL com o dono através do painel da empresa.

REGRAS ABSOLUTAS:
- Seja extremamente DIRETO e CASUAL — fale como um humano, não como um robô pedante.
- Sinta-se livre para discordar do dono caso veja risco na operação!
- Use as métricas numéricas do seu contexto sempre que sustentar um argumento.
- NUNCA responda algo engessado como "O que mais posso ajudar?". Encerre a resposta pontualmente com a conclusão da demanda e ponto final.
- Não gere marcações pesadas em Markdown ou tópicos infinitos (Bulleted Lists) ao menos que explicitamente ordenado a criar relatório. Formate-se como um chat do WhatsApp enxuto.`;

        const searchNote = (agentId === 'COMERCIAL' || agentId === 'MERCADO')
            ? `\n\nATENÇÃO: Você tem autonomia e PERMISSÃO para buscar no Google os dados reais e datas atuais de hoje (Ex: CEPEA atual) se desconfiar que as minhas taxas base estão velhas antes de me fornecer conselhos.`
            : '';

        return `${chatWrapper}\n\nSUAS DIRETRIZES DE ESPECIALISTA:\n${specialistPrompt}${searchNote}\n\nDADOS DO SISTEMA HOJE (Seu Setor):\n${scopedDataSnapshot}`;
    };

    // ═══ SEND MESSAGE ═══
    const sendMessage = async () => {
        if (!inputText.trim() || loading) return;
        const userMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: inputText.trim(),
            timestamp: new Date(),
        };

        const capturedText = inputText.trim(); // capturar ANTES de limpar
        setChatHistories(prev => ({
            ...prev,
            [selectedAgent]: [...(prev[selectedAgent] || []), userMsg],
        }));
        setInputText('');
        setLoading(true);


        try {
            // Build conversation context (reduzido severamente para as ULTIMAS 3 MENSAGENS MAX - Otimizando o gasto de contexto e limitando a loop window)
            const history = [...(chatHistories[selectedAgent] || []), userMsg];
            const recentHistory = history.slice(-3);
            const contextPrompt = recentHistory.map(m =>
                m.role === 'user' ? `DONO (Eu): ${m.text}` : `${currentAgent.name} (Você): ${m.text}`
            ).join('\n\n');

            // Fetch de Dados de Mercado Real-Time (Internet para a Inteligência)
            let internetContext = '';
            if (['COMERCIAL', 'MERCADO', 'COMPRAS', 'ADMINISTRATIVO'].includes(selectedAgent)) {
                try {
                    const marketData = await fetchAllMarketData();
                    internetContext = `\n\n[MUNDO AFORA: DADOS REAIS DA INTERNET ATUALIZADOS NESTE MILISSEGUNDO]\n- Boi Gordo (CEPEA/B3): R$ ${marketData.cepeaBoi.valor} (Variou: ${marketData.cepeaBoi.variacao}% | ${marketData.cepeaBoi.fonte})\n- Dólar (PTAX): R$ ${marketData.dolar.valor} (${marketData.dolar.fonte})\n- Milho (CEPEA): R$ ${marketData.milho.valor} (${marketData.milho.fonte})`;
                } catch (e) {
                    console.error("Falha ao buscar internet", e);
                }
            }

            // INJEÇÃO DE INTELIGÊNCIA DO PROFESSOR (O MENTHOR ENSINANDO O ESPECIALISTA)
            let mentorContext = '';
            if (selectedAgent !== 'PROFESSOR' && !isOrchestrating) {
                mentorContext = await getMentorTip(selectedAgent, capturedText);
            }

            // BUSCAR MEMÓRIAS PERSISTENTES DO AGENTE
            let persistentMemoryContext = '';
            try {
                const memories = await getAgentMemories(selectedAgent);
                persistentMemoryContext = formatMemoriesForPrompt(memories);
            } catch (memErr) {
                console.warn('[AIChat] Falha ao buscar memórias:', memErr);
            }

            const fullPrompt = `${getAgentSystemPrompt(selectedAgent, (dataSnapshot as any)(selectedAgent))}${internetContext}${mentorContext}${persistentMemoryContext}

MENSAGENS RECENTES (MEMÓRIA CURTA):
${contextPrompt}

Responda SOMENTE a última mensagem minha com o que solicitei de maneira enxuta, clara e humanizada. Reserve-se em até 70 palavras se não for listagem detalhada.`;

            const { text, provider } = await runCascade(fullPrompt, selectedAgent);

            // EXECUÇÃO DO MCP AUTÔNOMO
            const mcpResult = await executeInterceptedMCPs(text);

            // Oculta a linha de pensamento do usuário para design mais limpo (Modo WhatsApp)
            const cleanText = mcpResult.cleanText.replace(/<reasoning>[\s\S]*?(?:<\/reasoning>|$)/gi, '').trim() || mcpResult.cleanText;

            const agentMsg: ChatMessage = {
                id: `msg-${Date.now()}-resp`,
                role: 'agent',
                agent: selectedAgent,
                text: cleanText,
                timestamp: new Date(),
                provider,
            };

            setChatHistories(prev => ({
                ...prev,
                [selectedAgent]: [...(prev[selectedAgent] || []), agentMsg],
            }));

            // Adiciona as ações do MCP ao log se existirem
            const mcpLogs: LogEntry[] = mcpResult.executions.map(exec => ({
                id: `log-mcp-${Date.now()}-${Math.random()}`,
                agent: selectedAgent,
                action: `[MCP Exec: ${exec.actionType}] ${exec.output}`,
                timestamp: new Date(),
                provider: 'MCP-System',
            }));

            // Log activity — usa capturedText que foi salvo antes do setInputText('')
            setActivityLog(prev => [...prev, ...mcpLogs, {
                id: `log-${Date.now()}`,
                agent: selectedAgent,
                action: `Respondeu: "${capturedText.substring(0, 50)}${capturedText.length > 50 ? '...' : ''}"`,
                timestamp: new Date(),
                provider,
            }]);

        } catch (err: any) {
            const errorMsg: ChatMessage = {
                id: `msg-${Date.now()}-err`,
                role: 'agent',
                agent: selectedAgent,
                text: `⚠️ Erro: ${err.message}`,
                timestamp: new Date(),
            };
            setChatHistories(prev => ({
                ...prev,
                [selectedAgent]: [...(prev[selectedAgent] || []), errorMsg],
            }));
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    // ═══ MEETING MODE ═══
    const [meetingAgents, setMeetingAgents] = useState<Set<AgentType>>(new Set(['ADMINISTRATIVO']));

    const toggleMeetingAgent = (agentId: AgentType) => {
        setMeetingAgents(prev => {
            const next = new Set(prev);
            if (next.has(agentId)) {
                // Dona Clara é obrigatória
                if (agentId === 'ADMINISTRATIVO') return next;
                next.delete(agentId);
            } else {
                next.add(agentId);
            }
            return next;
        });
    };

    const selectAllMeetingAgents = () => {
        setMeetingAgents(new Set(AGENTS.map(a => a.id)));
    };

    const selectOnlyClara = () => {
        setMeetingAgents(new Set(['ADMINISTRATIVO']));
    };

    const startMeeting = async () => {
        if (!inputText.trim() || meetingLoading) return;
        const topic = inputText.trim();
        setInputText('');
        setMeetingLoading(true);

        const userMsg: ChatMessage = {
            id: `meet-${Date.now()}`,
            role: 'user',
            text: `📋 Pauta: ${topic}`,
            timestamp: new Date(),
        };
        setMeetingMessages(prev => [...prev, userMsg]);

        // Só chama os agentes selecionados (default: Dona Clara)
        const activeAgents = AGENTS.filter(a => meetingAgents.has(a.id));

        for (const agent of activeAgents) {
            try {
                const isClara = agent.id === 'ADMINISTRATIVO';
                const meetingPrompt = `Você é ${agent.name}, ${agent.role} do FrigoGest.
${isClara && activeAgents.length === 1
                        ? `Você é a ADMINISTRADORA-GERAL respondendo SOZINHA ao dono. Considere TODOS os aspectos do negócio: produção, vendas, estoque, financeiro, clientes. Dê uma visão 360° completa.`
                        : `Você está numa REUNIÃO com o dono${activeAgents.length > 1 ? ` e ${activeAgents.length - 1} outro(s) gerente(s)` : ''}. O assunto é:`
                    }

"${topic}"

${dataSnapshot}

Dê sua opinião do ponto de vista da sua especialidade em NO MÁXIMO ${isClara && activeAgents.length === 1 ? '300' : '150'} palavras.
Seja direto, prático, e fale como se estivesse numa mesa de reunião.
Comece com seu ponto principal.`;

                const { text, provider } = await runCascade(meetingPrompt, agent.id);
                const cleanText = text.replace(/<reasoning>[\s\S]*?(?:<\/reasoning>|$)/gi, '').trim() || text;

                const agentMsg: ChatMessage = {
                    id: `meet-${Date.now()}-${agent.id}`,
                    role: 'agent',
                    agent: agent.id,
                    text: cleanText,
                    timestamp: new Date(),
                    provider,
                };
                setMeetingMessages(prev => [...prev, agentMsg]);

                setActivityLog(prev => [...prev, {
                    id: `log-meet-${Date.now()}`,
                    agent: agent.id,
                    action: `Participou da reunião: "${topic.substring(0, 40)}..."`,
                    timestamp: new Date(),
                    provider,
                }]);
            } catch (err: any) {
                setMeetingMessages(prev => [...prev, {
                    id: `meet-${Date.now()}-${agent.id}-err`,
                    role: 'agent',
                    agent: agent.id,
                    text: `⚠️ ${err.message}`,
                    timestamp: new Date(),
                }]);
            }
        }

        // --- VEREDITO DO PROFESSOR (FECHAMENTO DA REUNIÃO) ---
        try {
            const historyText = meetingMessages.map(m => `${m.agent || 'Dono'}: ${m.text}`).join('\n\n');
            const mentorPrompt = `${PROMPT_PROFESSOR}
---
Sua missão agora é encerrar esta reunião técnica.
PAUTA: "${topic}"
HISTÓRICO DA DISCUSSÃO:
${historyText}

Tome uma decisão ou dê um conselho final magistral baseado em todos os pareceres acima.
Seja o MESTRE que sintetiza tudo e eleva a inteligência do negócio.
Limite-se a 150 palavras.`;

            const { text, provider } = await runCascade(mentorPrompt, 'PROFESSOR');
            const cleanText = text.replace(/<reasoning>[\s\S]*?(?:<\/reasoning>|$)/gi, '').trim() || text;

            setMeetingMessages(prev => [...prev, {
                id: `meet-final-${Date.now()}`,
                role: 'agent',
                agent: 'PROFESSOR',
                text: `🎓 VEREDITO DO MENTHOR:\n\n${cleanText}`,
                timestamp: new Date(),
                provider,
            }]);
        } catch (e) {
            console.error("Falha no veredito do professor", e);
        }

        setMeetingLoading(false);
    };

    // ═══ RENDER ═══
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* HEADER */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-xl">
                <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-black tracking-tight">Central IA</h1>
                        <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">Chat • Reunião • Rastro</p>
                    </div>
                    <div className="flex gap-1">
                        {(['chat', 'meeting', 'log'] as ChatTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${activeTab === tab
                                    ? 'bg-white text-indigo-700 shadow-lg'
                                    : 'text-white/70 hover:bg-white/10'
                                    }`}
                            >
                                {tab === 'chat' ? '💬' : tab === 'meeting' ? '🤝' : '📋'}
                                <span className="hidden md:inline ml-1">{tab === 'chat' ? 'Chat' : tab === 'meeting' ? 'Reunião' : 'Rastro'}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden" style={{ height: 'calc(100vh - 68px)' }}>

                {/* ══════ TAB: CHAT ══════ */}
                {activeTab === 'chat' && (
                    <>
                        {/* AGENT SIDEBAR (desktop) / Toggle (mobile) */}
                        <div className={`${showAgentList ? 'block' : 'hidden'} md:block w-full md:w-72 bg-white border-r border-slate-200 overflow-y-auto`}>
                            <div className="p-3 border-b border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equipe IA (16)</p>
                            </div>
                            {AGENTS.map(agent => {
                                const Icon = agent.icon;
                                const msgCount = (chatHistories[agent.id] || []).filter(m => m.role === 'agent').length;
                                return (
                                    <button
                                        key={agent.id}
                                        onClick={() => { setSelectedAgent(agent.id); setShowAgentList(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-l-4 ${selectedAgent === agent.id
                                            ? `${agent.bgColor} ${agent.borderColor} ${agent.color}`
                                            : 'border-transparent hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl ${agent.bgColor} flex items-center justify-center ${agent.color}`}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-800 truncate">{agent.name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">{agent.role}</p>
                                        </div>
                                        {msgCount > 0 && (
                                            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-full">{msgCount}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* CHAT AREA */}
                        <div className="flex-1 flex flex-col bg-slate-50">
                            {/* Chat Header (mobile: agent selector) */}
                            <div className={`flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 ${currentAgent.bgColor}`}>
                                <button
                                    onClick={() => setShowAgentList(!showAgentList)}
                                    className={`md:hidden w-10 h-10 rounded-xl flex items-center justify-center ${currentAgent.bgColor} ${currentAgent.color}`}
                                >
                                    <currentAgent.icon size={20} />
                                </button>
                                <div className={`hidden md:flex w-10 h-10 rounded-xl items-center justify-center ${currentAgent.bgColor} ${currentAgent.color}`}>
                                    <currentAgent.icon size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-black ${currentAgent.color}`}>{currentAgent.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{currentAgent.role}</p>
                                </div>
                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    {loading ? '⏳ digitando...' : '🟢 online'}
                                </div>
                            </div>

                            {/* Messages */}
                            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                                {currentHistory.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                        <currentAgent.icon size={48} className={`${currentAgent.color} mb-4`} />
                                        <p className="text-sm font-bold text-slate-500">Converse com {currentAgent.name}</p>
                                        <p className="text-xs text-slate-400 mt-1">Faça perguntas, peça conselhos, discuta estratégia...</p>
                                    </div>
                                )}

                                {currentHistory.map(msg => {
                                    const isUser = msg.role === 'user';
                                    const agentDef = msg.agent ? AGENTS.find(a => a.id === msg.agent) : currentAgent;
                                    return (
                                        <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 ${isUser
                                                ? 'bg-indigo-600 text-white rounded-br-md'
                                                : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                                                }`}>
                                                {!isUser && agentDef && (
                                                    <p className={`text-[10px] font-black ${agentDef.color} mb-1 uppercase tracking-wide`}>
                                                        {agentDef.name} {msg.provider ? `• via ${msg.provider}` : ''}
                                                    </p>
                                                )}
                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                                <p className={`text-[9px] mt-1 ${isUser ? 'text-white/50' : 'text-slate-300'} text-right`}>
                                                    {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {loading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Loader2 size={14} className="animate-spin text-indigo-500" />
                                                <span className="text-xs text-slate-400 font-medium">{currentAgent.name} está digitando...</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            <div className="bg-white border-t border-slate-200 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={toggleMic}
                                        title={isListening ? 'Parar gravação' : 'Falar para o agente'}
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-md flex-shrink-0 ${isListening
                                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/40'
                                            : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
                                            }`}
                                    >
                                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                                    </button>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                        placeholder={isListening ? '🔴 Ouvindo... fale agora!' : `Fale com ${currentAgent.name}...`}
                                        className={`flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all ${isListening
                                            ? 'bg-red-50 ring-2 ring-red-300 placeholder:text-red-400'
                                            : 'bg-slate-100 focus:ring-2 focus:ring-indigo-300'
                                            }`}
                                        disabled={loading}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={loading || !inputText.trim()}
                                        className="w-11 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 shadow-lg"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                {isListening && (
                                    <p className="text-center text-xs text-red-500 font-bold mt-1 animate-pulse">🔴 Microfone ativo — fale com {currentAgent.name}!</p>
                                )}
                            </div>
                        </div>
                    </>
                )}


                {/* ══════ TAB: MEETING ══════ */}
                {activeTab === 'meeting' && (
                    <div className="flex-1 flex flex-col">
                        {/* Meeting Header */}
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <Users size={20} className="text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-amber-800">Reunião de IA</p>
                                    <p className="text-[10px] text-amber-600 font-bold">
                                        {meetingAgents.size === 1 ? '🧠 Dona Clara responde (economia de tokens)' : `${meetingAgents.size} gerente(s) selecionado(s)`}
                                    </p>
                                </div>
                                {meetingLoading && (
                                    <div className="ml-auto flex items-center gap-2 text-amber-600">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span className="text-xs font-bold">Em andamento...</span>
                                    </div>
                                )}
                            </div>

                            {/* AGENT SELECTOR */}
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Quem participa?</p>
                                    <div className="flex gap-1">
                                        <button onClick={selectOnlyClara} className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${meetingAgents.size === 1 ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
                                            Só Dona Clara
                                        </button>
                                        <button onClick={selectAllMeetingAgents} className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all ${meetingAgents.size === AGENTS.length ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
                                            Todos ({AGENTS.length})
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {AGENTS.map(agent => {
                                        const Icon = agent.icon;
                                        const isSelected = meetingAgents.has(agent.id);
                                        const isClara = agent.id === 'ADMINISTRATIVO';
                                        return (
                                            <button
                                                key={agent.id}
                                                onClick={() => toggleMeetingAgent(agent.id)}
                                                disabled={meetingLoading}
                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${isSelected
                                                    ? `${agent.bgColor} ${agent.color} ${agent.borderColor} border shadow-sm`
                                                    : 'bg-white text-slate-300 border border-slate-100 hover:border-slate-300'
                                                    } ${isClara ? 'ring-1 ring-amber-300' : ''}`}
                                                title={isClara ? 'Dona Clara sempre participa' : `Toggle ${agent.name}`}
                                            >
                                                <Icon size={10} />
                                                {agent.name.split(' ').pop()}
                                                {isClara && ' ★'}
                                            </button>
                                        );
                                    })}
                                </div>
                                {meetingAgents.size > 3 && (
                                    <p className="text-[9px] text-amber-500 font-bold">⚡ {meetingAgents.size} agentes = {meetingAgents.size} chamadas de IA</p>
                                )}
                            </div>
                        </div>

                        {/* Meeting Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {meetingMessages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                    <Users size={48} className="text-amber-400 mb-4" />
                                    <p className="text-sm font-bold text-slate-500">Inicie uma reunião</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {meetingAgents.size === 1
                                            ? 'Dona Clara responde sozinha — visão 360° com economia de tokens'
                                            : `${meetingAgents.size} gerente(s) darão sua opinião`}
                                    </p>
                                    <div className="mt-6 space-y-2 text-left max-w-sm">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Sugestões:</p>
                                        {[
                                            'Como aumentar as vendas no próximo mês?',
                                            'Qual a melhor estratégia para Black Friday?',
                                            'Devemos investir em venda direta ao consumidor?',
                                            'Como melhorar a margem de lucro?',
                                        ].map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setInputText(s)}
                                                className="w-full text-left text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors text-amber-700"
                                            >
                                                💡 {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {meetingMessages.map(msg => {
                                const isUser = msg.role === 'user';
                                const agentDef = msg.agent ? AGENTS.find(a => a.id === msg.agent) : null;
                                const AgentIcon = agentDef?.icon || Users;
                                return (
                                    <div key={msg.id} className={`${isUser ? 'flex justify-center' : ''}`}>
                                        {isUser ? (
                                            <div className="bg-amber-100 border border-amber-200 rounded-2xl px-6 py-3 text-center max-w-[90%]">
                                                <p className="text-sm font-black text-amber-800">{msg.text}</p>
                                            </div>
                                        ) : (
                                            <div className={`flex gap-3 items-start ${agentDef?.bgColor} border ${agentDef?.borderColor} rounded-2xl px-4 py-3`}>
                                                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${agentDef?.bgColor} ${agentDef?.color}`}>
                                                    <AgentIcon size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[10px] font-black ${agentDef?.color} uppercase tracking-wide mb-1`}>
                                                        {agentDef?.name} — {agentDef?.role} {msg.provider ? `• via ${msg.provider}` : ''}
                                                    </p>
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {meetingLoading && (
                                <div className="flex justify-center">
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-3 flex items-center gap-2">
                                        <Loader2 size={14} className="animate-spin text-amber-600" />
                                        <span className="text-xs text-amber-600 font-bold">Próximo gerente falando...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={meetingEndRef} />
                        </div>

                        {/* Meeting Input */}
                        <div className="bg-white border-t border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && startMeeting()}
                                    placeholder="Digite o tema da reunião..."
                                    className="flex-1 bg-amber-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300 transition-all border border-amber-100"
                                    disabled={meetingLoading}
                                />
                                <button
                                    onClick={startMeeting}
                                    disabled={meetingLoading || !inputText.trim()}
                                    className="w-11 h-11 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 shadow-lg"
                                >
                                    <Sparkles size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════ TAB: ORQUESTRADOR ══════ */}
                {activeTab === 'orquestrador' && (
                    <div className="flex-1 flex flex-col bg-slate-50">
                        <div className="flex-1 overflow-y-auto px-4 py-4">
                            {!orchestrationResult && !isOrchestrating ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
                                    <ShieldCheck size={48} className="text-violet-400 mb-4" />
                                    <p className="text-base font-bold text-slate-700">Conselho Multi-Agentes</p>
                                    <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
                                        Digite uma ordem complexa (ex: "Criar promoção para limpar estoque").<br />
                                        O Vendas vai tentar empurrar, o Fluxo de Caixa pode barrar e a Dona Clara dará a palavra final.
                                    </p>
                                </div>
                            ) : (
                                <OrchestratorView
                                    result={orchestrationResult}
                                    isLoading={isOrchestrating}
                                    onApprove={(decision) => {
                                        // Ação de aprovar envia pro log
                                        setActivityLog(prev => [...prev, {
                                            id: `log-appr-${Date.now()}`,
                                            agent: 'ADMINISTRATIVO',
                                            action: `Humano APROVOU decisão: "${decision.substring(0, 40)}..."`,
                                            timestamp: new Date(),
                                            provider: 'Human',
                                        }]);
                                        setOrchestrationResult(null);
                                    }}
                                    onReject={() => {
                                        setActivityLog(prev => [...prev, {
                                            id: `log-rej-${Date.now()}`,
                                            agent: 'ADMINISTRATIVO',
                                            action: `Humano REJEITOU a decisão orquestrada.`,
                                            timestamp: new Date(),
                                            provider: 'Human',
                                        }]);
                                        setOrchestrationResult(null);
                                    }}
                                />
                            )}
                        </div>

                        {/* Input Orquestrador */}
                        <div className="bg-white border-t border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleOrchestrate()}
                                    placeholder="Qual desafio os agentes devem analisar em cadeia?..."
                                    className="flex-1 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                                    disabled={isOrchestrating}
                                />
                                <button
                                    onClick={handleOrchestrate}
                                    disabled={isOrchestrating || !inputText.trim()}
                                    className="w-11 h-11 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-violet-500/30 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 active:scale-95 shadow-lg"
                                >
                                    <Zap size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════ TAB: LOG (RASTRO DA IA) ══════ */}
                {activeTab === 'log' && (
                    <div className="flex-1 flex flex-col">
                        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-200 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                    <Clock size={20} className="text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800">Rastro da IA</p>
                                    <p className="text-[10px] text-slate-500 font-bold">{activityLog.length} atividades registradas</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4">
                            {activityLog.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                                    <Clock size={48} className="text-slate-300 mb-4" />
                                    <p className="text-sm font-bold text-slate-500">Nenhuma atividade ainda</p>
                                    <p className="text-xs text-slate-400 mt-1">As conversas e reuniões aparecerão aqui</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {[...activityLog].reverse().map(entry => {
                                        const agent = AGENTS.find(a => a.id === entry.agent)!;
                                        const Icon = agent.icon;
                                        return (
                                            <div key={entry.id} className={`flex items-start gap-3 p-3 rounded-xl ${agent.bgColor} border ${agent.borderColor}`}>
                                                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${agent.bgColor} ${agent.color}`}>
                                                    <Icon size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-black ${agent.color}`}>{agent.name}</span>
                                                        <span className="text-[9px] text-slate-300">•</span>
                                                        <span className="text-[9px] text-slate-400 font-mono">via {entry.provider}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 mt-0.5 truncate">{entry.action}</p>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                                    {entry.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIChat;
