
import { AgentType } from '../types';
import { runCascade } from '../components/AIAgents';

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
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    startedAt: Date;
    finishedAt: Date;
}

// Trunca texto de parecer para evitar explosão do contextAccumulator
const truncateParecer = (text: string, maxChars = 300): string => {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars).trimEnd() + '... [truncado]';
};

// Prompt builder inline (evita dependência circular com AIChat)
const buildAgentPrompt = (agent: AgentType, dataSnapshot: string): string => {
    const AGENT_NAMES: Record<string, string> = {
        COMERCIAL: 'Marcos (Diretor Comercial)',
        FLUXO_CAIXA: 'Mateus (Tesoureiro)',
        ESTOQUE: 'Joaquim (Estoquista-Chefe)',
        ADMINISTRATIVO: 'Dona Clara (Administradora-Geral)',
    };
    const name = AGENT_NAMES[agent] || agent;
    return `Você é ${name} do FrigoGest. Analise os dados reais abaixo e dê seu parecer técnico.
REGRAS ABSOLUTAS: Máximo 80 palavras. Use 🔴🟡🟢. NUNCA faça perguntas. NUNCA repita dados do contexto. Conclua diretamente.
DADOS DO SISTEMA:\n${dataSnapshot}`;
};

const CHAIN_SEQUENCE: { agent: AgentType, purpose: string }[] = [
    { agent: 'COMERCIAL', purpose: 'Analisar viabilidade comercial, demanda do cliente e impacto nas metas de venda.' },
    { agent: 'FLUXO_CAIXA', purpose: 'Analisar impacto no caixa, prazos de recebimento (PMR) e inadimplência do cliente.' },
    { agent: 'ESTOQUE', purpose: 'Analisar viabilidade física: temos o produto? Vai estragar (drip loss)?' },
];

export const runOrchestration = async (
    topic: string,
    dataSnapshot: string
): Promise<OrchestrationResult> => {

    const result: OrchestrationResult = {
        id: `orch-${Date.now()}`,
        topic,
        steps: [],
        finalDecision: '',
        status: 'RUNNING',
        startedAt: new Date(),
        finishedAt: new Date()
    };

    let contextAccumulator = `TEMA ORIGINAL DA REUNIÃO (Ordem do Dono): "${topic}"\n\n`;

    for (const step of CHAIN_SEQUENCE) {
        const stepRecord: OrchestrationStep = {
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
            const agentPrompt = `${buildAgentPrompt(step.agent, dataSnapshot)}

INSTRUÇÃO DE ORQUESTRAÇÃO (Você faz parte de uma cadeia de agentes):
${step.purpose}

CONTEXTO ACUMULADO ATÉ AGORA:
${contextAccumulator}

SUA TAREFA:
Responda em até 100 palavras. 
Se você detectar um risco GIGANTE na sua área (ex: cliente não paga, não tem estoque), comece sua resposta com a palavra [VETO] seguida do motivo. Caso contrário, dê seu parecer positivo ou ressalva.`;

            const aiResponse = await runCascade(agentPrompt, step.agent);

            stepRecord.output = aiResponse.text;
            stepRecord.status = aiResponse.text.includes('[VETO]') ? 'VETOED' : 'COMPLETED';

            // Trunca para evitar que o contexto cresça indefinidamente entre agentes
            contextAccumulator += `\n\n--- PARECER DE ${step.agent} ---\n${truncateParecer(aiResponse.text)}`;

        } catch (error: any) {
            stepRecord.status = 'FAILED';
            stepRecord.output = `FALHA NO AGENTE: ${error.message}`;
            contextAccumulator += `\n\n--- PARECER DE ${step.agent} ---\n[FALHOU EM RESPONDER]`;
        }
    }

    const orquestradorRecord: OrchestrationStep = {
        id: `step-${Date.now()}-ADMINISTRATIVO`,
        agent: 'ADMINISTRATIVO',
        role: 'Orquestrador: Analisar todos os pareceres, resolver conflitos e dar a resolução final ao dono.',
        input: contextAccumulator,
        output: '',
        status: 'RUNNING',
        timestamp: new Date()
    };
    result.steps.push(orquestradorRecord);

    try {
        const masterPrompt = `${buildAgentPrompt('ADMINISTRATIVO', dataSnapshot)}

VOCÊ É A ORQUESTRADORA FINAL. Tema: "${topic}"

PARECERES DOS SUB-AGENTES:
${contextAccumulator}

SUA TAREFA (responda SOMENTE neste formato, sem introduções):
RESUMO: [1 frase objetiva do que a equipe concluiu]
CONFLITOS: [Divergências entre áreas, ou "Nenhum"]
DECISÃO RECOMENDADA: [Ação clara e direta para o dono aprovar]

Se houve [VETO], a proteção da empresa prevalece. Resolva conflitos e decida. NUNCA faça perguntas.`;

        const masterResponse = await runCascade(masterPrompt, 'ADMINISTRATIVO');
        orquestradorRecord.output = masterResponse.text;
        orquestradorRecord.status = 'COMPLETED';
        result.finalDecision = masterResponse.text;
        result.status = 'COMPLETED';

    } catch (error: any) {
        orquestradorRecord.status = 'FAILED';
        orquestradorRecord.output = `FALHA NA ORQUESTRAÇÃO FINAL: ${error.message}`;
        result.finalDecision = 'Houve uma falha na cadeia de agentes. Por favor, analise manualmente os dados no dashboard.';
        result.status = 'FAILED';
    }

    result.finishedAt = new Date();
    return result;
};
