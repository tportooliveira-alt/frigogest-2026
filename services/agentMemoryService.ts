// ═══ SERVIÇO DE MEMÓRIA PERSISTENTE DOS AGENTES IA ═══
// Baseado em: SAP Joule Memory, Microsoft Copilot Context, Google ADK Memory Architecture
// Implementa memória de 3 camadas: Working (prompt) → Short-term (sessão) → Long-term (Supabase)

import { supabase } from '../supabaseClient';
import { AgentType, AgentMemory } from '../types';

const MAX_MEMORIES_PER_AGENT = 30;
const MEMORIES_IN_PROMPT = 5;

// ═══ SALVAR MEMÓRIA ═══
export async function saveAgentMemory(memory: Omit<AgentMemory, 'id'>): Promise<string | null> {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('agent_memories')
            .insert({
                agent_id: memory.agentId,
                timestamp: memory.timestamp,
                summary: memory.summary,
                key_insights: memory.keyInsights,
                alerts_found: memory.alertsFound,
                actions_recommended: memory.actionsRecommended,
                provider: memory.provider,
                context: memory.context
            })
            .select('id')
            .single();
        if (error) throw error;
        return data?.id ?? null;
    } catch (err) {
        console.warn('[AgentMemory] Erro ao salvar:', err);
        return null;
    }
}

// ═══ BUSCAR MEMÓRIAS DE UM AGENTE ═══
export async function getAgentMemories(agentId: AgentType, maxResults: number = MEMORIES_IN_PROMPT): Promise<AgentMemory[]> {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('agent_memories')
            .select('*')
            .eq('agent_id', agentId)
            .order('timestamp', { ascending: false })
            .limit(maxResults);
        if (error) throw error;
        return (data || []).map((r: any) => ({
            id: r.id, agentId: r.agent_id, timestamp: r.timestamp,
            summary: r.summary, keyInsights: r.key_insights || [],
            alertsFound: r.alerts_found || 0, actionsRecommended: r.actions_recommended || [],
            provider: r.provider, context: r.context
        })) as AgentMemory[];
    } catch (err) {
        console.warn('[AgentMemory] Erro ao buscar:', err);
        return [];
    }
}

// ═══ BUSCAR TODAS AS MEMÓRIAS (para dashboard) ═══
export async function getAllMemories(maxResults: number = 50): Promise<AgentMemory[]> {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('agent_memories')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(maxResults);
        if (error) throw error;
        return (data || []).map((r: any) => ({
            id: r.id, agentId: r.agent_id, timestamp: r.timestamp,
            summary: r.summary, keyInsights: r.key_insights || [],
            alertsFound: r.alerts_found || 0, actionsRecommended: r.actions_recommended || [],
            provider: r.provider, context: r.context
        })) as AgentMemory[];
    } catch (err) {
        console.warn('[AgentMemory] Erro ao buscar todas:', err);
        return [];
    }
}

// ═══ CONTAR MEMÓRIAS POR AGENTE ═══
export async function countAgentMemories(agentId: AgentType): Promise<number> {
    if (!supabase) return 0;
    try {
        const { count, error } = await supabase
            .from('agent_memories')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', agentId);
        if (error) throw error;
        return count ?? 0;
    } catch {
        return 0;
    }
}

// ═══ FORMATAR MEMÓRIAS PARA INJETAR NO PROMPT ═══
export function formatMemoriesForPrompt(memories: AgentMemory[]): string {
    if (!memories.length) return '';

    let text = `\n═══ 🧠 MEMÓRIA PERSISTENTE (${memories.length} interações anteriores) ═══\n`;
    text += `INSTRUÇÃO: Use estas memórias para dar CONTINUIDADE ao seu trabalho. Referencie insights anteriores quando relevante.\n\n`;

    for (const m of memories.slice(0, MEMORIES_IN_PROMPT)) {
        const date = new Date(m.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        text += `📌 [${date}] (via ${m.provider}, ${m.context})\n`;
        text += `   Resumo: ${m.summary}\n`;
        if (m.keyInsights.length > 0) {
            text += `   Insights: ${m.keyInsights.slice(0, 3).join(' | ')}\n`;
        }
        if (m.actionsRecommended.length > 0) {
            text += `   Ações pendentes: ${m.actionsRecommended.slice(0, 2).join(' | ')}\n`;
        }
        text += `   Alertas: ${m.alertsFound}\n\n`;
    }

    text += `IMPORTANTE: Se alguma ação recomendada anteriormente ainda não foi executada, REFORCE a urgência.\n`;
    return text;
}

// ═══ EXTRAIR INSIGHTS DE UMA RESPOSTA DA IA ═══
export function extractInsightsFromResponse(responseText: string, agentId: AgentType, provider: string, alertCount: number, context: 'INDIVIDUAL' | 'REUNIAO' | 'CHAT'): Omit<AgentMemory, 'id'> {
    // Extrair resumo (primeiras 2 frases significativas)
    const sentences = responseText
        .replace(/[#*═🔴🟡🟢📊📋🎯✍️🧠🎁📦⚫💰🚛👥🥩🏦❄️📞💡🔦📱📈👑]/g, '')
        .split(/[.!?\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 15);
    const summary = sentences.slice(0, 2).join('. ').substring(0, 200);

    // Extrair key insights (linhas com emojis de alerta ou números)
    const insightLines = responseText
        .split('\n')
        .filter(l => /[🔴🟡🟢⚠️📊📈💰]/.test(l) || /R\$\d/.test(l) || /\d+%/.test(l))
        .map(l => l.trim().substring(0, 100))
        .slice(0, 5);

    // Extrair ações recomendadas (linhas numeradas ou com verbos de ação)
    const actionLines = responseText
        .split('\n')
        .filter(l => /^\d+[.)]/.test(l.trim()) || /^[→•\-]/.test(l.trim()))
        .filter(l => /(enviar|cobrar|comprar|vender|ligar|agendar|criar|disparar|montar|priorizar|negociar)/i.test(l))
        .map(l => l.trim().substring(0, 120))
        .slice(0, 5);

    return {
        agentId,
        timestamp: new Date().toISOString(),
        summary: summary || 'Análise concluída sem resumo extraído.',
        keyInsights: insightLines.length > 0 ? insightLines : ['Análise realizada sem insights específicos detectados'],
        alertsFound: alertCount,
        actionsRecommended: actionLines,
        provider,
        context,
    };
}
