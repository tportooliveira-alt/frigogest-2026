/**
 * ═══════════════════════════════════════════════════════════════
 * AGENT MEMORY SERVICE — FrigoGest 2026
 * ═══════════════════════════════════════════════════════════════
 * Salva e recupera insights dos agentes no Supabase.
 * Tabela: agent_memory (criada automaticamente se não existir).
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../supabaseClient';

export interface AgentMemoryEntry {
  id?: string;
  agent_id: string;
  topic: string;
  insight: string;
  created_at?: string;
  session_id?: string;
}

// ── Salvar insight de um agente ─────────────────────────────────
export const saveAgentMemory = async (
  agentId: string,
  topic: string,
  insight: string
): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('agent_memory').insert({
      agent_id: agentId,
      topic: topic.substring(0, 200),
      insight: insight.substring(0, 1000),
      session_id: `session-${new Date().toISOString().split('T')[0]}`
    });
  } catch (e) {
    // Tabela pode não existir ainda — silencioso
    console.warn('[AgentMemory] Não foi possível salvar insight:', e);
  }
};

// ── Recuperar últimos insights de um agente ─────────────────────
export const getAgentMemory = async (
  agentId: string,
  limit = 5
): Promise<AgentMemoryEntry[]> => {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('agent_memory')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as AgentMemoryEntry[];
  } catch {
    return [];
  }
};

// ── Extrai insights chave da resposta do agente ─────────────────
export const extractInsightsFromResponse = (response: string): string => {
  // Pega a primeira frase significativa fora das tags <reasoning>
  const clean = response.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').trim();
  const sentences = clean.split(/[.!?]/).filter(s => s.trim().length > 20);
  return sentences.slice(0, 2).join('. ').trim().substring(0, 300);
};
