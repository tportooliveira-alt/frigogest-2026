/**
 * AI AGENTS — FrigoGest 2026
 * Painel de agentes especializados com consulta individual.
 */

import React, { useState } from 'react';
import { ArrowLeft, Loader2, Send, ChevronRight } from 'lucide-react';
import { runCascade, extractFinalAnswer } from '../services/llmCascade';
import { buildRichSnapshot } from '../services/buildSnapshot';
import { AGENT_DISPLAY_NAMES, AGENT_SYSTEM_PROMPTS } from '../../agentPrompts';
import { getEffectiveAgent } from './AgentEditor';
import { Batch, StockItem, Sale, Client, Transaction, Payable } from '../../types';

interface AIAgentsProps {
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

interface AgentResponse {
  agentId: string;
  text: string;
  provider: string;
  loading: boolean;
}



const AGENT_LIST = Object.keys(AGENT_DISPLAY_NAMES);

const AIAgents: React.FC<AIAgentsProps> = ({ onBack, ...dataProps }) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const consultAgent = async (agentId: string, q: string) => {
    if (!q.trim()) return;
    setResponse({ agentId, text: '', provider: '', loading: true });

    try {
      const snapshot = buildRichSnapshot({ ...dataProps, scheduledOrders: dataProps.scheduledOrders || [] });
      const effAgent = getEffectiveAgent(agentId);
      const systemPrompt = effAgent.prompt || AGENT_SYSTEM_PROMPTS.ADMINISTRATIVO;
      const prompt = `${systemPrompt}\n\n━━━ DADOS REAIS ━━━\n${snapshot}\n━━━━━━━━━━━━━━━━━\n\nPergunta: ${q}`;
      const result = await runCascade(prompt, agentId);
      setResponse({ agentId, text: extractFinalAnswer(result.text), provider: result.provider, loading: false });
    } catch {
      setResponse({ agentId, text: '⚠️ Erro ao conectar com o agente.', provider: '', loading: false });
    }
  };

  // Tela de resposta
  if (selectedAgent && response) {
    const ag = AGENT_DISPLAY_NAMES[selectedAgent];
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
        <button onClick={() => { setSelectedAgent(null); setResponse(null); setQuestion(''); }}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all text-sm font-bold">
          <ArrowLeft size={16} /> Voltar aos Agentes
        </button>

        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl">{ag.emoji}</div>
            <div>
              <h2 className="text-xl font-black">{ag.nome}</h2>
              <p className="text-xs text-slate-400">{ag.cargo}</p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Sua pergunta</p>
            <p className="text-sm text-slate-300">{question}</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Resposta de {ag.nome}</p>
            {response.loading ? (
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-blue-400" />
                <span className="text-sm text-slate-400">Consultando {ag.nome}...</span>
              </div>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-white whitespace-pre-wrap">{response.text}</p>
                {response.provider && (
                  <p className="text-[9px] font-black text-slate-600 uppercase mt-3">{response.provider}</p>
                )}
                {/* Fix 10: Botão copiar */}
                <button onClick={() => { navigator.clipboard.writeText(response.text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="mt-3 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-slate-400 hover:text-white">
                  {copied ? '✅ Copiado!' : '📋 Copiar resposta'}
                </button>
              </>
            )}
          </div>

          {!response.loading && (
            <div className="flex gap-3">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                placeholder="Pergunta de acompanhamento..."
                onKeyDown={e => { if (e.key === 'Enter') { setQuestion((e.target as any).value); consultAgent(selectedAgent, (e.target as any).value); (e.target as any).value = ''; } }}
              />
              <button className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 transition-all">
                <Send size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid de agentes
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all text-sm font-bold">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-black">Central de Agentes IA</h1>
          <p className="text-xs text-slate-400 mt-1">17 especialistas com acesso aos dados reais do sistema</p>
        </div>

        {/* Campo de pergunta rápida */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Fazer uma pergunta</p>
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all resize-none"
            rows={2}
            placeholder="Ex: Como está o fluxo de caixa dos próximos 30 dias?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
          <p className="text-[9px] text-slate-500 mt-2">Selecione um agente abaixo para enviar</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {AGENT_LIST.map(agId => {
            const ag = AGENT_DISPLAY_NAMES[agId];
            return (
              <button
                key={agId}
                onClick={() => {
                  if (!question.trim()) {
                    alert('Digite uma pergunta acima primeiro!');
                    return;
                  }
                  setSelectedAgent(agId);
                  consultAgent(agId, question);
                }}
                className="bg-slate-900 border border-slate-700 hover:border-blue-500 rounded-2xl p-4 text-left transition-all group hover:-translate-y-0.5 active:scale-95"
              >
                <div className="text-2xl mb-2">{ag.emoji}</div>
                <p className="text-xs font-black text-white group-hover:text-blue-300 transition-colors">{ag.nome}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{ag.cargo}</p>
                <ChevronRight size={12} className="text-slate-600 group-hover:text-blue-400 mt-2 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AIAgents;
