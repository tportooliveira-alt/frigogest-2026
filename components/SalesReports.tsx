import React, { useState } from 'react';
import { Sale, Batch, StockItem, Client } from '../types';
import { formatCurrency, formatWeight } from '../utils/helpers';
import {
  Edit2,
  Save,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  CheckCircle,
  BarChart3,
  ArrowLeft,
  ChevronRight,
  TrendingUp as TrendingUpIcon
} from 'lucide-react';

interface SalesReportsProps {
  sales: Sale[];
  batches: Batch[];
  stock: StockItem[];
  clients: Client[];
  updateSaleCost: (id_venda: string, newCost: number) => void;
  onBack?: () => void;
}

const SalesReports: React.FC<SalesReportsProps> = ({ sales, batches, stock, clients, updateSaleCost, onBack }) => {
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [tempCost, setTempCost] = useState<string>('');

  const getSaleDetails = (sale: Sale) => {
    const item = stock.find(s => s.id_completo === sale.id_completo);
    // CORREÇÃO AUDITORIA #3: Para carcaças inteiras (id_completo = "LOTE-SEQ-INTEIRO"),
    // não existe stock item com esse ID. Extrair id_lote do id_completo como fallback.
    const loteId = item?.id_lote || sale.id_completo.split('-').slice(0, 3).join('-');
    const batch = item ? batches.find(b => b.id_lote === item.id_lote) : batches.find(b => b.id_lote === loteId);
    const client = clients.find(c => c.id_ferro === sale.id_cliente);
    const revenue = sale.peso_real_saida * sale.preco_venda_kg;
    const costKg = batch ? batch.custo_real_kg : 0;
    const cgs = sale.peso_real_saida * costKg;
    const operationalCost = sale.custo_extras_total || 0;
    const netProfit = revenue - cgs - operationalCost;

    return { clientName: client ? client.nome_social : 'Consumidor Final', revenue, cgs, operationalCost, netProfit, costKg };
  };

  const totals = sales.reduce((acc, sale) => {
    const details = getSaleDetails(sale);
    return { revenue: acc.revenue + details.revenue, cgs: acc.cgs + details.cgs, ops: acc.ops + details.operationalCost, profit: acc.profit + details.netProfit };
  }, { revenue: 0, cgs: 0, ops: 0, profit: 0 });

  return (
    <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20 font-sans">

      {/* PREMIUM HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex flex-col gap-4">
          <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-emerald-700 hover:border-emerald-100 transition-all shadow-sm">
            <ArrowLeft size={14} /> Voltar ao Início
          </button>
          <div className="flex items-center gap-5">
            <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-xl shadow-emerald-100">
              <TrendingUpIcon size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                Resultado <span className="text-emerald-600">Líquido</span>
              </h1>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                Análise de Margens Reais / ID-ROI
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Apurado via Inteligência FG-Core</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* KPI GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Faturamento Bruto', value: totals.revenue, color: 'slate', icon: DollarSign },
            { label: 'Custo de Aquisição (Gado)', value: totals.cgs, color: 'slate', icon: TrendingDown },
            { label: 'Despesas Logísticas', value: totals.ops, color: 'orange', icon: Activity },
            { label: 'Lucro Líquido Final', value: totals.profit, color: 'emerald', icon: CheckCircle, highlight: true }
          ].map((kpi, idx) => (
            <div key={idx} className={`premium-card p-8 flex flex-col gap-4 group hover:translate-y-[-4px] transition-all ${kpi.highlight ? 'bg-emerald-600 border-none shadow-emerald-900/20 text-white' : ''}`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${kpi.highlight ? 'bg-white/20 text-white' : `bg-${kpi.color}-50 text-${kpi.color}-600`}`}>
                <kpi.icon size={20} />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${kpi.highlight ? 'text-emerald-100' : 'text-slate-400'}`}>{kpi.label}</p>
                <h3 className={`text-2xl font-black tracking-tight ${kpi.highlight ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(kpi.value)}</h3>
              </div>
            </div>
          ))}
        </div>

        {/* DATA TABLE */}
        <div className="premium-card overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Painel de Conciliação de Margens</h4>
            <div className="flex gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="technical-table">
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Destinatário / Item</th>
                  <th className="text-right">Faturamento</th>
                  <th className="text-right">Custo Aquisição</th>
                  <th className="text-right bg-orange-50/50">Custo Operacional</th>
                  <th className="text-right">Margem Final</th>
                  <th className="text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={7} className="py-24 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Aguardando dados de expedição</td></tr>
                ) : (
                  sales.map(s => {
                    const d = getSaleDetails(s);
                    const isEditing = editingSaleId === s.id_venda;
                    return (
                      <tr key={s.id_venda} className="hover:bg-slate-50 transition-colors group">
                        <td className="text-[10px] font-bold text-slate-400">
                          {new Date(s.data_venda).toLocaleDateString()}
                          <span className="block text-[8px] opacity-40 mt-1 uppercase">ID: {s.id_venda.substring(0, 8)}</span>
                        </td>
                        <td>
                          <p className="font-extrabold text-slate-900 uppercase text-xs">{d.clientName}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{s.id_completo} • {formatWeight(s.peso_real_saida)}</p>
                        </td>
                        <td className="text-right font-black text-slate-900">{formatCurrency(d.revenue)}</td>
                        <td className="text-right">
                          <span className="font-black text-slate-400 text-[11px]">{formatCurrency(d.cgs)}</span>
                          <span className="block text-[8px] text-slate-400 font-bold mt-1 uppercase">{formatCurrency(d.costKg)} / KG</span>
                        </td>
                        <td className="text-right bg-orange-50/30 p-0">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="text" inputMode="decimal"
                              value={tempCost}
                              onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setTempCost(v); }}
                              onKeyDown={e => e.key === 'Enter' && (updateSaleCost(s.id_venda, parseFloat(tempCost) || 0), setEditingSaleId(null))}
                              className="w-full h-full bg-white border border-orange-500 rounded-none p-4 text-right font-black text-xs text-blue-600 focus:ring-0 outline-none"
                            />
                          ) : (
                            <div className={`p-4 font-black text-[11px] ${d.operationalCost > 0 ? 'text-orange-600' : 'text-slate-300 italic'}`}>
                              {d.operationalCost > 0 ? formatCurrency(d.operationalCost) : 'Sem ajuste'}
                            </div>
                          )}
                        </td>
                        <td className={`text-right font-black ${d.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(d.netProfit)}
                        </td>
                        <td className="text-center">
                          {isEditing ? (
                            <div className="flex justify-center gap-1">
                              <button onClick={() => (updateSaleCost(s.id_venda, parseFloat(tempCost) || 0), setEditingSaleId(null))} className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-all shadow-lg"><Save size={14} /></button>
                              <button onClick={() => setEditingSaleId(null)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-200 transition-all"><X size={14} /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingSaleId(s.id_venda); setTempCost(s.custo_extras_total?.toString() || '0'); }}
                              className="opacity-0 group-hover:opacity-100 btn-modern bg-slate-900 text-white py-1.5 px-3 rounded-lg text-[9px] hover:bg-blue-600 transition-all flex items-center gap-2 mx-auto"
                            >
                              <Edit2 size={10} /> Ajustar Custos
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReports;