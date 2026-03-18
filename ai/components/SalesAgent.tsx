/**
 * SALES AGENT — FrigoGest 2026
 * Agente IA especializado em vendas: sugere peças, preços e clientes.
 */

import React, { useState } from 'react';
import { ArrowLeft, Bot, Loader2, Send } from 'lucide-react';
import { runCascade, extractFinalAnswer } from '../services/llmCascade';
import { AGENT_SYSTEM_PROMPTS } from '../../agentPrompts';
import { StockItem, Client, Sale, Batch } from '../../types';
import { formatCurrency, formatWeight } from '../../utils/helpers';

interface SalesAgentProps {
  onBack: () => void;
  clients: Client[];
  sales: Sale[];
  stock: StockItem[];
  batches: Batch[];
}

const SalesAgent: React.FC<SalesAgentProps> = ({ onBack, clients, sales, stock, batches }) => {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [question, setQuestion] = useState('');

  const dispStock = stock.filter(s => s.status === 'DISPONIVEL');
  const totalKg = dispStock.reduce((a, s) => a + s.peso_entrada, 0);

  const askAgent = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const snapshot = `ESTOQUE DISPONÍVEL: ${dispStock.length} peças | ${totalKg.toFixed(1)}kg
CLIENTES: ${clients.length}
VENDAS RECENTES: ${sales.slice(0, 5).map(s => `${s.nome_cliente} ${s.peso_real_saida}kg @R$${s.preco_venda_kg}/kg`).join(' | ')}`;

      const prompt = `${AGENT_SYSTEM_PROMPTS.COMERCIAL}\n\n━━━ DADOS ━━━\n${snapshot}\n━━━━━━━━━━━\n\nPergunta de vendas: ${question}\nMarcos:`;
      const result = await runCascade(prompt, 'COMERCIAL');
      setSuggestion(extractFinalAnswer(result.text));
    } catch {
      setSuggestion('⚠️ Erro ao consultar agente de vendas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all text-sm font-bold">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-purple-600/20 border border-purple-600/30 rounded-2xl flex items-center justify-center">
            <Bot size={22} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Agente de Vendas</h1>
            <p className="text-xs text-slate-400">Marcos — Diretor Comercial IA</p>
          </div>
        </div>

        {/* Status do estoque */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Peças Disponíveis</p>
            <p className="text-2xl font-black text-white mt-1">{dispStock.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total em Estoque</p>
            <p className="text-2xl font-black text-white mt-1">{formatWeight(totalKg)}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-4">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Pergunte ao Marcos</p>
          <div className="flex gap-3">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 transition-all"
              placeholder="Ex: Quais clientes devo contatar hoje?"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askAgent()}
              disabled={loading}
            />
            <button
              onClick={askAgent}
              disabled={loading || !question.trim()}
              className="w-12 h-12 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 rounded-xl flex items-center justify-center transition-all"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>

        {suggestion && (
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-5">
            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-3">📈 Marcos diz:</p>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{suggestion}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesAgent;
