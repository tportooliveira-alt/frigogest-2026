/**
 * AI MEETING ROOM — FrigoGest 2026
 * Reunião de diretoria: múltiplos agentes consultados em paralelo.
 */

import React, { useState } from 'react';
import { ArrowLeft, Loader2, Users, Play } from 'lucide-react';
import { runCascade, extractFinalAnswer } from '../services/llmCascade';
import { buildRichSnapshot } from '../services/buildSnapshot';
import { AGENT_DISPLAY_NAMES, AGENT_SYSTEM_PROMPTS } from '../../agentPrompts';
import { Batch, StockItem, Sale, Client, Transaction, Payable } from '../../types';

interface AIMeetingRoomProps {
  onBack: () => void;
  batches: Batch[];
  stock: StockItem[];
  sales: Sale[];
  clients: Client[];
  transactions: Transaction[];
  suppliers?: any[];
  payables: Payable[];
  scheduledOrders?: any[];
}

interface AgentVote {
  agentId: string;
  text: string;
  provider: string;
  done: boolean;
}

// Fix 9: Agentes configuráveis pelo usuário
const ALL_MEETING_AGENTS = ['ADMINISTRATIVO', 'FLUXO_CAIXA', 'COMERCIAL', 'COMPRAS', 'ESTOQUE', 'PRODUCAO', 'AUDITOR', 'MERCADO', 'COBRANCA', 'QUALIDADE'];
const DEFAULT_AGENTS = ['ADMINISTRATIVO', 'FLUXO_CAIXA', 'COMERCIAL', 'COMPRAS', 'ESTOQUE'];



const AIMeetingRoom: React.FC<AIMeetingRoomProps> = ({ onBack, ...dataProps }) => {
  const [topic, setTopic] = useState('');
  const [running, setRunning] = useState(false);
  const [votes, setVotes] = useState<AgentVote[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(DEFAULT_AGENTS);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const runMeeting = async () => {
    if (!topic.trim()) return;
    setRunning(true);
    const snapshot = buildRichSnapshot({ ...dataProps, scheduledOrders: dataProps.scheduledOrders || [] });

    // Inicializar todas as respostas como loading
    const initial = selectedAgents.map(id => ({ agentId: id, text: '', provider: '', done: false }));
    setVotes(initial);

    // Rodar em paralelo
    await Promise.allSettled(
      selectedAgents.map(async (agId, idx) => {
        try {
          const prompt = `${AGENT_SYSTEM_PROMPTS[agId]}\n\n━━━ DADOS ━━━\n${snapshot}\n━━━━━━━━━━━\n\nTEMA DA REUNIÃO: "${topic}"\nSeu parecer (máx 100 palavras):`;
          const result = await runCascade(prompt, agId);
          setVotes(prev => prev.map((v, i) =>
            i === idx ? { ...v, text: extractFinalAnswer(result.text), provider: result.provider, done: true } : v
          ));
        } catch {
          setVotes(prev => prev.map((v, i) =>
            i === idx ? { ...v, text: '⚠️ Indisponível', provider: '', done: true } : v
          ));
        }
      })
    );
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all text-sm font-bold">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-600/20 border border-rose-600/30 rounded-2xl flex items-center justify-center">
              <Users size={22} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Sala de Guerra</h1>
              <p className="text-xs text-slate-400">Reunião com {selectedAgents.length} especialistas selecionados</p>
            </div>
          </div>
          {/* Fix 9: Picker de agentes */}
          <div className="relative">
            <button onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase transition-all">
              Agentes ({selectedAgents.length})
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Selecionar especialistas</p>
                {ALL_MEETING_AGENTS.map(agId => {
                  const ag = AGENT_DISPLAY_NAMES[agId];
                  const sel = selectedAgents.includes(agId);
                  return (
                    <button key={agId} onClick={() => setSelectedAgents(prev =>
                      sel ? prev.filter(a => a !== agId) : [...prev, agId]
                    )} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${sel ? 'bg-rose-600/30 text-white' : 'text-slate-400 hover:bg-white/10'}`}>
                      <span>{ag.emoji}</span>
                      <span className="font-bold">{ag.nome}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Tema da Reunião</p>
          <div className="flex gap-3">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500 transition-all"
              placeholder="Ex: Devemos comprar mais gado esta semana?"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              disabled={running}
              onKeyDown={e => e.key === 'Enter' && runMeeting()}
            />
            <button
              onClick={runMeeting}
              disabled={running || !topic.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? 'Reunindo...' : 'Convocar'}
            </button>
          </div>
        </div>

        {votes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {votes.map(vote => {
              const ag = AGENT_DISPLAY_NAMES[vote.agentId];
              return (
                <div key={vote.agentId} className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{ag.emoji}</span>
                    <div>
                      <p className="text-xs font-black text-white">{ag.nome}</p>
                      <p className="text-[9px] text-slate-500">{ag.cargo}</p>
                    </div>
                    {!vote.done && <Loader2 size={14} className="animate-spin text-blue-400 ml-auto" />}
                  </div>
                  {vote.done ? (
                    <>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{vote.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        {vote.provider && <p className="text-[9px] text-slate-600 uppercase">{vote.provider}</p>}
                        {/* Fix 10: Botão copiar */}
                        <button onClick={() => { navigator.clipboard.writeText(vote.text); setCopiedId(vote.agentId); setTimeout(() => setCopiedId(null), 2000); }}
                          className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-slate-400 hover:text-white">
                          {copiedId === vote.agentId ? '✅ Copiado' : '📋 Copiar'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="h-16 flex items-center">
                      <span className="text-xs text-slate-500">Aguardando parecer...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIMeetingRoom;
