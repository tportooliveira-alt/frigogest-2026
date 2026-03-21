// ═══════════════════════════════════════════════════════════════
// 🧠 ORCHESTRATOR SERVICE — Roteamento Inteligente de Agentes
// ═══════════════════════════════════════════════════════════════
// Dona Clara decide QUAIS agentes chamar antes de gastar tokens.
// Máximo 3 agentes por consulta. Sequencial com contexto acumulado.
// ═══════════════════════════════════════════════════════════════

import { AgentType } from '../../types';
import { saveAgentMemory, extractInsightsFromResponse } from './agentMemoryService';

export interface OrchestrationStep {
    id: string;
    agent: AgentType;
    role: string;
    input: string;
    output: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'VETOED';
    timestamp: Date;
    vetoedBy?: AgentType;
    vetoReason?: string;
}

export interface OrchestrationResult {
    id: string;
    topic: string;
    steps: OrchestrationStep[];
    finalDecision: string;
    agentesEscolhidos: AgentType[];
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    startedAt: Date;
    finishedAt: Date;
}

// ═══ MAPA DE EXPERTISE — Quem sabe o quê ═══
const AGENT_EXPERTISE: Record<AgentType, string[]> = {
    ADMINISTRATIVO: ['decisão estratégica', 'visão geral', 'dre', 'ebitda', 'okr', 'governança', 'planejamento'],
    PRODUCAO: ['rendimento', 'carcaça', 'abate', 'tipificação', 'embrapa', 'raça', 'gmd', 'desossa', 'toalete'],
    COMERCIAL: ['venda', 'cliente', 'rfm', 'churn', 'crm', 'preço de venda', 'desconto', 'prazo', 'pedido'],
    AUDITOR: ['fraude', 'estorno', 'auditoria', 'inconsistência', 'erro', 'divergência', 'integridade', 'forensic'],
    ESTOQUE: ['estoque', 'fifo', 'câmara', 'drip loss', 'vencimento', 'peça', 'peso', 'quebra', 'frio'],
    COMPRAS: ['fornecedor', 'lote', 'gta', 'arroba', 'compra', 'boi', 'originação', 'suprimento', 'recebimento'],
    MERCADO: ['cepea', 'mercado', 'preço arroba', 'dólar', 'tendência', 'sazonalidade', 'cotação', 'conjuntura'],
    MARKETING: ['campanha', 'marketing', 'redes sociais', 'promoção', 'copy', 'instagram', 'branding', 'reativação'],
    SATISFACAO: ['nps', 'satisfação', 'reclamação', 'pós-venda', 'insatisfeito', 'detrator', 'depoimento'],
    COBRANCA: ['cobrança', 'inadimplência', 'devedor', 'atraso', 'pagamento pendente', 'recuperar'],
    WHATSAPP_BOT: ['resposta whatsapp', 'bot', 'catálogo', 'consulta preço', 'status pedido', 'horário'],
    JURIDICO: ['contrato', 'trabalhista', 'nr-36', 'sif', 'adab', 'sanitário', 'autuação', 'legal', 'jurídico'],
    FLUXO_CAIXA: ['caixa', 'fluxo', 'saldo', 'recebimento', 'pagamento', 'capital', 'inadimplência financeira'],
    RH_GESTOR: ['funcionário', 'rh', 'folha', 'clt', 'admissão', 'demissão', 'salário'],
    FISCAL_CONTABIL: ['imposto', 'nf-e', 'icms', 'simples nacional', 'tributação', 'contabilidade', 'sped'],
    QUALIDADE: ['haccp', 'bpf', 'veterinário', 'microbiologia', 'temperatura câmara', 'rastreabilidade', 'riispoa'],
    PROFESSOR: ['mentoria', 'tendência de mercado', 'estudo acadêmico', 'inovação', 'estratégia avançada', 'professor', 'análise preditiva'],
};

// ═══ REGRAS DE ROTEAMENTO DIRETO (sem gastar token do router) ═══
// Se a pergunta bate exatamente, roteia na hora
const ROUTING_RULES: { keywords: string[]; agents: AgentType[] }[] = [
    {
        keywords: ['rendimento', 'carcaça', 'rc%', 'desossa', 'tipificação', 'raça', 'embrapa'],
        agents: ['PRODUCAO', 'COMPRAS']
    },
    {
        keywords: ['estorno', 'fraude', 'suspeito', 'divergência', 'erro no sistema', 'inconsistência'],
        agents: ['AUDITOR', 'FLUXO_CAIXA']
    },
    {
        keywords: ['estoque vencendo', 'peça velha', 'fifo', 'drip loss', 'câmara fria'],
        agents: ['ESTOQUE', 'COMERCIAL']
    },
    {
        keywords: ['comprar boi', 'novo lote', 'fornecedor', 'gta', 'arroba', 'originação'],
        agents: ['COMPRAS', 'MERCADO', 'FLUXO_CAIXA']
    },
    {
        keywords: ['cliente inadimplente', 'não pagou', 'cobrar', 'devedor', 'atraso'],
        agents: ['COBRANCA', 'FLUXO_CAIXA']
    },
    {
        keywords: ['cepea', 'cotação', 'preço mercado', 'tendência de preço'],
        agents: ['MERCADO', 'COMPRAS']
    },
    {
        keywords: ['campanha', 'marketing', 'promoção', 'instagram', 'reativar cliente'],
        agents: ['MARKETING', 'COMERCIAL']
    },
    {
        keywords: ['fluxo de caixa', 'saldo', 'dinheiro em caixa', 'capital de giro'],
        agents: ['FLUXO_CAIXA', 'ADMINISTRATIVO']
    },
    {
        keywords: ['nps', 'reclamação', 'insatisfeito', 'pós-venda'],
        agents: ['SATISFACAO', 'COMERCIAL']
    },
    {
        keywords: ['jurídico', 'contrato', 'nr-36', 'sif', 'adab', 'autuação'],
        agents: ['JURIDICO']
    },
    {
        keywords: ['dre', 'ebitda', 'resultado do mês', 'balanço', 'planejamento anual'],
        agents: ['ADMINISTRATIVO', 'FLUXO_CAIXA']
    },
    {
        keywords: ['estratégia', 'novo mercado', 'inovação', 'melhoria', 'risco de crédito', 'marketing digital', 'tráfego', 'análise preditiva', 'como melhorar', 'dica', 'tendência'],
        agents: ['PROFESSOR', 'ADMINISTRATIVO']
    },
];

// ═══ ROUTER — Decide quais agentes chamar ═══
function routeDirectly(topic: string): AgentType[] | null {
    const topicLower = topic.toLowerCase();
    for (const rule of ROUTING_RULES) {
        if (rule.keywords.some(kw => topicLower.includes(kw))) {
            return rule.agents;
        }
    }
    return null; // Não achou rota direta — usar LLM router
}

async function routeWithLLM(
    topic: string,
    dataSnapshot: string,
    runCascade: (prompt: string, agentId?: string) => Promise<{ text: string; provider: string }>
): Promise<AgentType[]> {
    const agentList = Object.entries(AGENT_EXPERTISE)
        .map(([id, keywords]) => `${id}: ${keywords.slice(0, 4).join(', ')}`)
        .join('\n');

    const routerPrompt = `Você é um roteador de agentes do FrigoGest. Sua única tarefa é decidir QUAIS agentes devem responder ao tema abaixo.

TEMA: "${topic}"

AGENTES DISPONÍVEIS:
${agentList}

REGRAS:
- Escolha no MÍNIMO 1 e no MÁXIMO 3 agentes
- Escolha apenas os MAIS RELEVANTES para o tema
- Sempre inclua ADMINISTRATIVO se for decisão estratégica
- Responda SOMENTE com os IDs separados por vírgula, sem explicação
- Exemplo de resposta válida: ESTOQUE,COMERCIAL

RESPOSTA:`;

    try {
        const { text } = await runCascade(routerPrompt, 'PEAO' as any);
        const ids = text.trim().toUpperCase().split(',').map(s => s.trim()) as AgentType[];
        const valid = ids.filter(id => id in AGENT_EXPERTISE);
        return valid.length > 0 ? valid.slice(0, 3) : ['ADMINISTRATIVO'];
    } catch {
        return ['ADMINISTRATIVO'];
    }
}

// ═══ TRUNCADOR DE CONTEXTO ═══
const truncate = (text: string, max = 300): string =>
    text.length <= max ? text : text.slice(0, max).trimEnd() + '... [truncado]';

// ═══ BUILDER DE PROMPT POR AGENTE ═══
const AGENT_NAMES: Record<string, string> = {
    ADMINISTRATIVO: 'Dona Clara (Administradora-Geral)',
    PRODUCAO: 'Seu Antônio (Chefe de Produção)',
    COMERCIAL: 'Marcos (Diretor Comercial)',
    AUDITOR: 'Dra. Beatriz (Auditora-Chefe)',
    ESTOQUE: 'Joaquim (Gerente de Estoque)',
    COMPRAS: 'Roberto (Diretor de Suprimentos)',
    MERCADO: 'Ana (Inteligência de Mercado)',
    MARKETING: 'Isabela (CMO)',
    SATISFACAO: 'Camila (Customer Experience)',
    COBRANCA: 'Diana (Cobradora)',
    WHATSAPP_BOT: 'Wellington (Bot WhatsApp)',
    JURIDICO: 'Dra. Carla (Advogada)',
    FLUXO_CAIXA: 'Mateus (Tesoureiro)',
    RH_GESTOR: 'João Paulo (RH)',
    FISCAL_CONTABIL: 'Mariana (Contadora)',
    QUALIDADE: 'Dr. Ricardo (Veterinário)',
};

const buildPrompt = (agent: AgentType, dataSnapshot: string, contextAccumulator: string, topic: string, mentorTip: string = ''): string => {

    // Injeção dinâmica do sussurro do mentor (Invisible Whisper)
    const mentorSection = mentorTip
        ? `\n💡 [SUSSURRO DE INTELIGÊNCIA DO PROFESSOR (Apenas para você)]:\n"${mentorTip}"\nUse este conhecimento para elevar seu parecer operacional.\n`
        : '';

    return `Você é ${AGENT_NAMES[agent] || agent} do FrigoGest. A data de hoje é ${new Date().toLocaleDateString('pt-BR')}.

REGRAS DE CONVERSA (MODO CORPORATIVO ORGÂNICO):
1. Aja exatamente como o seu cargo numa empresa real conversando num grupo de WhatsApp ou Teams. Respeite os demais especialistas.
2. Seu parecer deve focar no "O QUE" e "COMO" resolver. Máximo 130 palavras, focado em retorno/lucro e praticidade.
3. Não use bullets a menos que indispensável. Seja direto, cordial e resolutivo.
4. <reasoning>: Antes de responder, abra a tag <reasoning> e feche </reasoning>. DENTRO desta tag, faça todos os cálculos e verifique regras de forma bruta.
5. FORA da tag <reasoning>, apenas dê os "bons dias" executivos e entregue a solução pronta (O seu raciocínio ficará oculto para a gerência não ler, eles só lerão a resposta final).
6. NUNCA invente números, use APENAS dados do snapshot. Se detectar risco severo, diga [VETO].

${mentorSection}
TEMA DA REUNIÃO: "${topic}"

━━━ DADOS REAIS DO SISTEMA ━━━
${dataSnapshot}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTEXTO DOS OUTROS AGENTES:
${contextAccumulator || '(primeiro parecer)'}

Seu parecer técnico (máx 130 palavras, cite números reais):`;
}

// ═══ FUNÇÃO PRINCIPAL ═══
export const runOrchestration = async (
    topic: string,
    dataSnapshot: string,
    runCascade: (prompt: string, agentId?: string) => Promise<{ text: string; provider: string }>
): Promise<OrchestrationResult> => {

    const result: OrchestrationResult = {
        id: `orch-${Date.now()}`,
        topic,
        steps: [],
        finalDecision: '',
        agentesEscolhidos: [],
        status: 'RUNNING',
        startedAt: new Date(),
        finishedAt: new Date(),
    };

    // ── 1. ROTEAMENTO: Quais agentes chamar? ──
    let agentesEscolhidos = routeDirectly(topic);
    if (!agentesEscolhidos) {
        agentesEscolhidos = await routeWithLLM(topic, dataSnapshot, runCascade);
    }

    // Garantir que ADMINISTRATIVO faz a síntese final (mas não duplicar se já está na lista)
    const agentesConsultores = agentesEscolhidos.filter(a => a !== 'ADMINISTRATIVO');
    result.agentesEscolhidos = agentesEscolhidos;

    let contextAccumulator = `TEMA: "${topic}"\n\n`;

    // ── 2. CONSULTORES: Todos em paralelo com Promise.allSettled ──
    const stepRecords: OrchestrationStep[] = agentesConsultores.map(agent => ({
        id: `step-${Date.now()}-${agent}`,
        agent,
        role: AGENT_EXPERTISE[agent]?.slice(0, 3).join(', ') || '',
        input: contextAccumulator,
        output: '',
        status: 'RUNNING' as const,
        timestamp: new Date(),
    }));
    stepRecords.forEach(s => result.steps.push(s));

    // Monta o contexto estático antes de disparar em paralelo
    const staticContext = contextAccumulator;

    // ── INJEÇÃO DO PROFESSOR (Menthor) ——
    // Obtemos um único conselho holístico do Professor para o tema, que será enviado como "Sussurro" a todos os consultores.
    let globalMentorTip = '';
    if (!agentesConsultores.includes('PROFESSOR')) {
        try {
            const professorPrompt = `Você é o Professor (Menthor). Forneça UM insight estratégico agressivo (máximo 40 palavras) sobre: "${topic}". Foco em blindagem financeira, marketing ou eficiência operacional. Não use saudações.`;
            const paramData = typeof dataSnapshot === 'function' ? (dataSnapshot as any)('PROFESSOR') : dataSnapshot;
            const insightResult = await runCascade(professorPrompt + `\nSnapshot:\n${paramData}`, 'PROFESSOR');
            globalMentorTip = insightResult.text;
        } catch (e) {
            console.warn('Falha ao acionar Professor silencioso.');
        }
    }


    const parallelResults = await Promise.allSettled(
        agentesConsultores.map(async (agent, i) => {
            // MOCK INJECT: VENTO EM POPA para teste de análise global
            let finalSnapshot = typeof dataSnapshot === 'function' ? (dataSnapshot as any)(agent) : dataSnapshot;

            // Fix 6: Mock de dados de teste removido — sempre usa dados reais

            const initialPrompt = buildPrompt(agent, finalSnapshot, staticContext, topic, globalMentorTip);

            // Loop de Tool Calling (Máximo 1 iteração por enquanto para economizar token/tempo)
            let response = await runCascade(initialPrompt, agent);

            // Verifica se o agente quer usar a ferramenta de mercado/internet
            if (response.text.includes('[TOOL:FETCH_CEPEA]') || response.text.includes('[TOOL:FETCH_MARKET]')) {
                console.log(`[Orchestrator] O agente ${agent} chamou a Ferramenta Mercado Externo.`);
                // SIMULAÇÃO DE FETCH MUNDO REAL (Para MVP Local)
                const mockMarketData = `
📡 DADOS DA INTERNET (Ferramenta: CEPEA/B3 Live - HOJE):
- Arroba Boi Gordo SP: R$ 229,50 (Estável)
- Dólar Comercial: R$ 5,02 (+0.2%)
- Clima local (Prev): Chuva forte 3 dias
`;
                // Segunda iterada: Devolver o dado e pedir a análise consolidada
                const followUpPrompt = `${initialPrompt}\n\nVocê tentou buscar dados no mercado externo. Aqui estão os resultados reais:\n${mockMarketData}\n\nAgora FORMULE seu parecer final (max 120 palavras). NUNCA mais repita a tag [TOOL:*].`;
                response = await runCascade(followUpPrompt, agent);
            }

            return { agent, text: response.text, idx: i };
        })
    );

    for (const settled of parallelResults) {
        if (settled.status === 'fulfilled') {
            const { agent, text, idx } = settled.value;
            // Remove as tags de chain of thought para visualização limpa
            const cleanText = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim() || text;

            stepRecords[idx].output = cleanText;
            stepRecords[idx].status = cleanText.includes('[VETO]') ? 'VETOED' : 'COMPLETED';
            contextAccumulator += `\n\n--- ${AGENT_NAMES[agent]} ---\n${truncate(cleanText)}`;

            // Salvar memória do agente consultor
            try {
                const insights = extractInsightsFromResponse(cleanText);
                saveAgentMemory(String(agent), 'ORQUESTRAÇÃO', insights);
            } catch (memErr) {
                console.warn('[Orchestrator] Falha ao salvar memória do consultor:', agent, memErr);
            }
        } else {
            const idx = parallelResults.indexOf(settled);
            if (stepRecords[idx]) {
                stepRecords[idx].status = 'FAILED';
                stepRecords[idx].output = `Falha: ${String((settled as PromiseRejectedResult).reason)}`;
                contextAccumulator += `\n\n--- [AGENTE FALHOU] ---\n[FALHOU]`;
            }
        }
    }

    // ── 3. DONA CLARA: Síntese final ──
    const masterStep: OrchestrationStep = {
        id: `step-${Date.now()}-ADMINISTRATIVO`,
        agent: 'ADMINISTRATIVO',
        role: 'Síntese executiva e decisão final',
        input: contextAccumulator,
        output: '',
        status: 'RUNNING',
        timestamp: new Date(),
    };
    result.steps.push(masterStep);

    try {
        const masterPrompt = `Você é Dona Clara, Administradora-Geral do FrigoGest. Data: ${new Date().toLocaleDateString('pt-BR')}.
Sua equipe analisou o tema abaixo. Você dá a DECISÃO FINAL ao dono.

REGRAS:
- Máximo 180 palavras. Seja direta como um CEO.
- NUNCA faça perguntas. NUNCA invente dados.
- Se houve [VETO], ele PREVALECE — explique em 1 linha e dê alternativa.
- Cite os números mais importantes que a equipe levantou.

TEMA: "${topic}"
PARECERES DA EQUIPE:
${contextAccumulator}

Responda EXATAMENTE neste formato (sem alterar os rótulos):
📋 RESUMO: [O que a equipe concluiu em 1 frase com 1 número-chave]
⚠️ CONFLITOS: [Divergências entre agentes, ou "Consenso total"]
✅ DECISÃO: [Ação #1 clara — quem faz, o quê, quando]
🔢 NÚMEROS-CHAVE: [2-3 métricas citadas pelos agentes que embasam a decisão]`;

        const rawText = (await runCascade(masterPrompt, 'ADMINISTRATIVO')).text;
        const finalCleanText = rawText.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim() || rawText;

        masterStep.output = finalCleanText;
        masterStep.status = 'COMPLETED';
        result.finalDecision = finalCleanText;
        result.status = 'COMPLETED';

        // Salvar memória da Dona Clara (Administrativo)
        try {
            const insights = extractInsightsFromResponse(finalCleanText);
            saveAgentMemory('ADMINISTRATIVO', 'ORQUESTRAÇÃO', insights);
        } catch (memErr) {
            console.warn('[Orchestrator] Falha ao salvar memória da Dona Clara:', memErr);
        }
    } catch (err: any) {
        masterStep.status = 'FAILED';
        result.finalDecision = 'Falha na síntese. Verifique os pareceres individuais acima.';
        result.status = 'FAILED';
    }

    result.finishedAt = new Date();
    return result;
};
