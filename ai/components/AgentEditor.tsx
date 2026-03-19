/**
 * AGENT EDITOR — FrigoGest 2026
 * Edita nome, cargo, emoji e prompt de cada agente diretamente no app.
 * Persiste no localStorage — sem deploy necessário.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, RotateCcw, Edit3, ChevronRight, CheckCircle, Zap } from 'lucide-react';
import { AGENT_DISPLAY_NAMES, AGENT_SYSTEM_PROMPTS } from '../../agentPrompts';

interface AgentEditorProps {
  onBack: () => void;
}

const STORAGE_KEY = 'frigogest_custom_agents';

export interface CustomAgentData {
  nome?: string;
  cargo?: string;
  emoji?: string;
  prompt?: string;
}

// Carrega customizações salvas do localStorage
export const loadCustomAgents = (): Record<string, CustomAgentData> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

// Salva customizações no localStorage
export const saveCustomAgents = (data: Record<string, CustomAgentData>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Retorna o nome/cargo/emoji/prompt efetivo (custom sobrescreve padrão)
export const getEffectiveAgent = (agentId: string) => {
  const custom = loadCustomAgents()[agentId] || {};
  const base = AGENT_DISPLAY_NAMES[agentId] || { nome: agentId, cargo: '', emoji: '🤖' };
  const basePrompt = AGENT_SYSTEM_PROMPTS[agentId] || '';
  return {
    nome:  custom.nome  || base.nome,
    cargo: custom.cargo || base.cargo,
    emoji: custom.emoji || base.emoji,
    prompt: custom.prompt || basePrompt,
    isCustom: !!(custom.nome || custom.cargo || custom.emoji || custom.prompt),
  };
};

const AGENT_LIST = Object.keys(AGENT_DISPLAY_NAMES);

const AgentEditor: React.FC<AgentEditorProps> = ({ onBack }) => {
  const [customAgents, setCustomAgents] = useState<Record<string, CustomAgentData>>({});
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', cargo: '', emoji: '', prompt: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCustomAgents(loadCustomAgents());
  }, []);

  const openEditor = (agentId: string) => {
    const eff = getEffectiveAgent(agentId);
    setEditForm({ nome: eff.nome, cargo: eff.cargo, emoji: eff.emoji, prompt: eff.prompt });
    setSelectedAgent(agentId);
    setSaved(false);
  };

  const handleSave = () => {
    if (!selectedAgent) return;
    const base = AGENT_DISPLAY_NAMES[selectedAgent];
    const basePrompt = AGENT_SYSTEM_PROMPTS[selectedAgent] || '';
    const updated = {
      ...customAgents,
      [selectedAgent]: {
        nome:  editForm.nome  !== base.nome  ? editForm.nome  : undefined,
        cargo: editForm.cargo !== base.cargo ? editForm.cargo : undefined,
        emoji: editForm.emoji !== base.emoji ? editForm.emoji : undefined,
        prompt: editForm.prompt !== basePrompt ? editForm.prompt : undefined,
      }
    };
    // Limpar chave se não tem nada customizado
    const entry = updated[selectedAgent];
    if (!entry.nome && !entry.cargo && !entry.emoji && !entry.prompt) {
      delete updated[selectedAgent];
    }
    setCustomAgents(updated);
    saveCustomAgents(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (!selectedAgent) return;
    const base = AGENT_DISPLAY_NAMES[selectedAgent];
    const basePrompt = AGENT_SYSTEM_PROMPTS[selectedAgent] || '';
    setEditForm({ nome: base.nome, cargo: base.cargo, emoji: base.emoji, prompt: basePrompt });
    const updated = { ...customAgents };
    delete updated[selectedAgent];
    setCustomAgents(updated);
    saveCustomAgents(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const charCount = editForm.prompt.length;
  const tokenEstimate = Math.round(charCount / 4);

  // ── Tela de edição ──────────────────────────────────────────────
  if (selectedAgent) {
    const base = AGENT_DISPLAY_NAMES[selectedAgent];
    const isCustom = !!(customAgents[selectedAgent]?.nome || customAgents[selectedAgent]?.cargo || customAgents[selectedAgent]?.emoji || customAgents[selectedAgent]?.prompt);

    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setSelectedAgent(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all text-sm font-bold">
            <ArrowLeft size={16} /> Voltar à Lista
          </button>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-2xl">
              {editForm.emoji}
            </div>
            <div>
              <h2 className="text-xl font-black">{editForm.nome}</h2>
              <p className="text-xs text-slate-400">{editForm.cargo}</p>
              {isCustom && <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">● Customizado</span>}
            </div>
          </div>

          <div className="space-y-5">
            {/* Identidade */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Identidade do Agente</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase">Emoji</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-2xl text-center outline-none focus:border-blue-500"
                    value={editForm.emoji} onChange={e => setEditForm(p => ({...p, emoji: e.target.value}))} maxLength={2} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase">Nome</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                    value={editForm.nome} onChange={e => setEditForm(p => ({...p, nome: e.target.value}))} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase">Cargo / Especialidade</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={editForm.cargo} onChange={e => setEditForm(p => ({...p, cargo: e.target.value}))} />
              </div>
            </div>

            {/* Prompt */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Prompt do Sistema</p>
                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-black ${tokenEstimate > 300 ? 'text-amber-400' : 'text-slate-500'}`}>
                    ~{tokenEstimate} tokens
                  </span>
                  {tokenEstimate > 300 && (
                    <span className="text-[9px] font-black text-amber-400 uppercase">⚠️ Prompt longo</span>
                  )}
                </div>
              </div>
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all resize-none font-mono leading-relaxed"
                rows={12}
                value={editForm.prompt}
                onChange={e => setEditForm(p => ({...p, prompt: e.target.value}))}
                placeholder="Instruções do agente..."
              />
              <div className="bg-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">💡 Dica de economia de tokens</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Prompts com menos de 150 tokens são ideais. Evite repetições. Use frases diretas como
                  "Máx 100 palavras. Cite números reais." em vez de parágrafos longos.
                </p>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3">
              <button onClick={handleSave}
                className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${saved ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {saved ? <><CheckCircle size={16}/> Salvo!</> : <><Save size={16}/> Salvar</>}
              </button>
              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-slate-400">
                <RotateCcw size={16}/> Resetar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Lista de agentes ────────────────────────────────────────────
  const customCount = Object.keys(customAgents).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all text-sm font-bold">
          <ArrowLeft size={16}/> Voltar
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3">
              <Edit3 size={22} className="text-blue-400" /> Editor de Agentes
            </h1>
            <p className="text-xs text-slate-400 mt-1">Personalize nome, cargo e instruções de cada especialista</p>
          </div>
          {customCount > 0 && (
            <div className="bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] font-black text-amber-400 uppercase">{customCount} customizado{customCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Card de dicas de economia */}
        <div className="bg-blue-600/10 border border-blue-600/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Zap size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Economia de Tokens</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Chat usa modo <strong className="text-white">lite</strong> (~150 tokens). Análises usam modo <strong className="text-white">full</strong> (~600 tokens).
              Prompts curtos e diretos economizam até 60% dos tokens. Mantenha abaixo de 150 tokens por prompt.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {AGENT_LIST.map(agId => {
            const eff = getEffectiveAgent(agId);
            const isCustom = !!customAgents[agId];
            return (
              <button key={agId} onClick={() => openEditor(agId)}
                className="w-full flex items-center gap-4 p-4 bg-slate-900 border border-slate-700 hover:border-blue-500 rounded-2xl transition-all group text-left">
                <span className="text-2xl w-10 text-center">{eff.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-white">{eff.nome}</p>
                    {isCustom && <span className="text-[8px] font-black bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full uppercase">custom</span>}
                  </div>
                  <p className="text-[10px] text-slate-500">{eff.cargo}</p>
                </div>
                <div className="text-right mr-2">
                  <p className="text-[9px] text-slate-600 uppercase">~{Math.round((AGENT_SYSTEM_PROMPTS[agId]||'').length/4)} tok</p>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AgentEditor;
