/**
 * AI CHAT — FrigoGest 2026
 * Chat direto com agentes especializados. Contexto real do sistema injetado.
 * Streaming palavra por palavra via polling (compatível com Vite/browser).
 */

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Bot, User, Loader2, ChevronDown } from 'lucide-react';
import { runCascade, extractFinalAnswer } from '../services/llmCascade';
import { buildRichSnapshot } from '../services/buildSnapshot';
import { getAgentMemory } from '../services/agentMemoryService';
import { AGENT_DISPLAY_NAMES, AGENT_SYSTEM_PROMPTS } from '../../agentPrompts';
import { getEffectiveAgent } from './AgentEditor';
import { Batch, StockItem, Sale, Client, Transaction, Payable } from '../../types';

interface AIChatProps {
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  agent?: string;
  provider?: string;
  timestamp: Date;
}



const AGENT_LIST = Object.keys(AGENT_DISPLAY_NAMES);

const AIChat: React.FC<AIChatProps> = ({ onBack, ...dataProps }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('ADMINISTRATIVO');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const agentInfo = AGENT_DISPLAY_NAMES[selectedAgent] || AGENT_DISPLAY_NAMES.ADMINISTRATIVO;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Lite para chat rápido (economiza ~450 tokens por mensagem)
      const snapshot = buildRichSnapshot({ ...dataProps, scheduledOrders: dataProps.scheduledOrders || [], mode: 'lite' });
      // Usa customização do usuário se existir
      const effAgent = getEffectiveAgent(selectedAgent);
      const systemPrompt = effAgent.prompt || AGENT_SYSTEM_PROMPTS.ADMINISTRATIVO;

      // Histórico recente (últimas 4 trocas)
      const history = messages.slice(-8).map(m =>
        `${m.role === 'user' ? 'Usuário' : agentInfo.nome}: ${m.text}`
      ).join('\n');

      // Fix 5: Injetar memória persistente do agente no contexto
      const memorias = await getAgentMemory(selectedAgent, 3);
      const memoriaCtx = memorias.length > 0
        ? `MEMÓRIA DO AGENTE (interações anteriores):\n${memorias.map(m => `  • ${m.topic}: ${m.insight}`).join('\n')}\n`
        : '';

      const fullPrompt = `${systemPrompt}

${memoriaCtx}
━━━ DADOS REAIS DO SISTEMA ━━━
${snapshot}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${history ? `HISTÓRICO RECENTE:\n${history}\n` : ''}
Usuário: ${text}
${agentInfo.nome}:`;

      const result = await runCascade(fullPrompt, selectedAgent);
      const cleanText = extractFinalAnswer(result.text);

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: cleanText,
        agent: selectedAgent,
        provider: result.provider,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: '⚠️ Erro ao conectar com o agente. Tente novamente.',
        agent: selectedAgent,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-slate-800 bg-slate-900 shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Fale com</p>
          <h1 className="text-sm font-black">{agentInfo.emoji} {agentInfo.nome} — {agentInfo.cargo}</h1>
        </div>
        {/* Seletor de agente */}
        <div className="relative">
          <button
            onClick={() => setShowAgentPicker(!showAgentPicker)}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase transition-all"
          >
            Trocar <ChevronDown size={12} />
          </button>
          {showAgentPicker && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
              {AGENT_LIST.map(agId => {
                const ag = AGENT_DISPLAY_NAMES[agId];
                return (
                  <button
                    key={agId}
                    onClick={() => { setSelectedAgent(agId); setShowAgentPicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/10 transition-all text-xs ${selectedAgent === agId ? 'bg-blue-600/30' : ''}`}
                  >
                    <span className="text-lg">{ag.emoji}</span>
                    <div>
                      <p className="font-black text-white">{ag.nome}</p>
                      <p className="text-[10px] text-slate-400">{ag.cargo}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
            <span className="text-6xl">{agentInfo.emoji}</span>
            <p className="text-sm font-black text-center">
              {agentInfo.nome} pronto para ajudar.<br/>
              <span className="text-xs font-normal text-slate-400">Pergunte sobre estoque, vendas, financeiro...</span>
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
              {msg.role === 'user' ? <User size={14} /> : agentInfo.emoji}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-blue-600 rounded-tr-sm' : 'bg-slate-800 rounded-tl-sm'}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.provider && (
                <p className="text-[9px] font-black text-slate-500 uppercase mt-1">{msg.provider}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center text-sm shrink-0">
              {agentInfo.emoji}
            </div>
            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-blue-400" />
              <span className="text-[11px] text-slate-400 uppercase font-black tracking-widest">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0">
        <div className="flex gap-3 items-end">
          <input
            ref={inputRef}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white/10 focus:border-blue-500 transition-all placeholder-slate-600"
            placeholder={`Pergunte para ${agentInfo.nome}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 rounded-2xl flex items-center justify-center transition-all shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
