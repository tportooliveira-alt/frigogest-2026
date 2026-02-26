import React, { useState, useMemo } from 'react';
import { Sale, StockItem, Transaction, Batch, Client } from '../types';
import { formatCurrency, formatWeight } from '../utils/helpers';
import { TrendingUp, TrendingDown, Activity, ArrowLeft, BarChart2, Package, ShoppingCart, DollarSign, Cpu, ChevronDown, ChevronRight, History, CreditCard, PieChart, Zap, AlertTriangle, Bell, Info, ShieldCheck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardProps {
  sales: Sale[];
  stock: StockItem[];
  transactions: Transaction[];
  batches: Batch[];
  clients: Client[];
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ sales, stock, transactions, batches, clients, onBack }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'commercial' | 'yield'>('commercial');
  const [showAIInsights, setShowAIInsights] = useState(false);

  const safeSales = Array.isArray(sales) ? sales : [];
  const safeStock = Array.isArray(stock) ? stock : [];
  const safeBatches = Array.isArray(batches) ? batches : [];
  const safeClients = Array.isArray(clients) ? clients : [];

  // CORREÇÃO AUDITORIA v2: Filtrar vendas estornadas dos KPIs
  const activeSales = safeSales.filter(s => s.status_pagamento !== 'ESTORNADO');

  const totalRevenue = activeSales.reduce((acc, curr) => acc + (curr.peso_real_saida * curr.preco_venda_kg), 0);
  const totalWeightSold = activeSales.reduce((acc, curr) => acc + curr.peso_real_saida, 0);
  const totalBreakage = activeSales.reduce((acc, curr) => acc + (curr.quebra_kg || 0), 0);

  const totalReceivable = activeSales
    .filter(s => s.status_pagamento === 'PENDENTE')
    .reduce((acc, curr) => {
      const total = curr.peso_real_saida * curr.preco_venda_kg;
      const paid = (curr as any).valor_pago || 0;
      return acc + (total - paid);
    }, 0);

  const chartData = activeSales.slice(-12).map((s, idx) => ({
    name: `V${idx + 1}`,
    lucro: (s.lucro_liquido_unitario || 0) * s.peso_real_saida,
    valor: s.peso_real_saida * s.preco_venda_kg
  }));

  const salesByBatch = useMemo(() => {
    const grouped = new Map<string, any[]>();

    // CORREÇÃO AUDITORIA v2: Usar activeSales (sem estornados)
    activeSales.forEach(sale => {
      const item = safeStock.find(s => s.id_completo === sale.id_completo);
      const batch = item ? safeBatches.find(b => b.id_lote === item.id_lote) : null;
      const client = safeClients.find(c => c.id_ferro === sale.id_cliente);
      const batchId = batch?.id_lote || 'sem-lote';

      if (!grouped.has(batchId)) {
        grouped.set(batchId, []);
      }

      const revenue = sale.peso_real_saida * sale.preco_venda_kg;
      const costKg = batch ? (Number(batch.custo_real_kg) || 0) : 0;
      const cost = (sale.peso_real_saida * costKg) + (sale.custo_extras_total || 0);
      const profit = revenue - cost;

      grouped.get(batchId)!.push({
        sale,
        item,
        batch,
        client,
        revenue,
        cost,
        profit
      });
    });

    return Array.from(grouped.entries()).map(([batchId, items]) => {
      const batch = items[0].batch;
      const totalRevenue = items.reduce((sum, i) => sum + i.revenue, 0);
      const totalCost = items.reduce((sum, i) => sum + i.cost, 0);
      const totalProfit = items.reduce((sum, i) => sum + i.profit, 0);

      return {
        batchId,
        batch,
        items,
        totalRevenue,
        totalCost,
        totalProfit,
        supplier: batch?.fornecedor || 'Desconhecido'
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [safeSales, safeStock, safeBatches, safeClients]);

  // --- IA PROACTIVE MONITORING ---
  const notifications = useMemo(() => {
    const list: { type: 'critical' | 'warning' | 'info', message: string, detail: string }[] = [];

    // 1. Yield Analysis
    salesByBatch.forEach(b => {
      const entryW = b.items.reduce((acc: number, i: any) => acc + (i.item?.peso_entrada || 0), 0);
      const exitW = b.items.reduce((acc: number, i: any) => acc + i.sale.peso_real_saida, 0);
      const yieldPct = entryW > 0 ? (exitW / entryW) * 100 : 100;
      if (yieldPct < 95) {
        list.push({ type: 'critical', message: `Quebra Crítica: Lote ${b.batchId.slice(0, 8)}`, detail: `Rendimento de ${yieldPct.toFixed(1)}% detectado. Verifique câmara fria.` });
      }
    });

    // 2. Client Risk Analysis
    clients.forEach(c => {
      if ((c as any).tier === 'F' || (c as any).score < 300) {
        list.push({ type: 'critical', message: `Risco de Crédito: ${c.nome_social}`, detail: `Cliente em Nível F detectado. Operações de venda devem ser bloqueadas.` });
      }
    });

    // 3. Stock Age Analysis
    const today = new Date();
    stock.filter(s => s.status === 'DISPONIVEL').forEach(s => {
      const entryDate = new Date(s.data_entrada);
      const diff = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 3600 * 24));
      if (diff > 12) {
        list.push({ type: 'warning', message: `Item Envelhecido: ${s.id_completo}`, detail: `Peça com ${diff} dias em estoque. Prioritize saída para evitar perda de peso.` });
      }
    });

    return list;
  }, [salesByBatch, clients, stock]);

  const toggleBatch = (batchId: string) => {
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId);
    } else {
      newExpanded.add(batchId);
    }
    setExpandedBatches(newExpanded);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 800));
    setShowAIInsights(true);
    if (notifications.length > 0) {
      setAiAnalysis(`Core IA detectou ${notifications.length} pontos de atenção operacional. Recomendamos auditoria imediata nos lotes com quebra acentuada.`);
    } else {
      setAiAnalysis("Integridade operacional verificada. Sem anomalias críticas no ciclo atual.");
    }
    setAnalyzing(false);
  };

  return (
    <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">

      {/* MODERN BREADCRUMB & HEADER */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div className="flex flex-col gap-4">
            <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
              <ArrowLeft size={14} /> Voltar ao Início
            </button>
            <div className="flex items-center gap-5">
              <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-100">
                {activeTab === 'commercial' ? <PieChart size={28} /> : <Activity size={28} />}
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                  {activeTab === 'commercial' ? 'Performance ' : 'Analítico de '}
                  <span className="text-blue-600">{activeTab === 'commercial' ? 'Comercial' : 'Rendimento'}</span>
                </h1>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                  {activeTab === 'commercial' ? 'Painel Analítico de Fluxo Industrial' : 'Monitoramento de Yield e Queba Industrial'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex p-1 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <button
                onClick={() => setActiveTab('commercial')}
                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'commercial' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                Comercial
              </button>
              <button
                onClick={() => setActiveTab('yield')}
                className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'yield' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                Rendimento
              </button>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex items-center gap-3 disabled:opacity-50"
            >
              {analyzing ? <Activity className="animate-spin text-blue-600" size={16} /> : <Cpu className="text-blue-600" size={16} />}
              IA Insight
            </button>
          </div>
        </div>

        {showAIInsights && (
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-reveal">
            <div className="lg:col-span-1 bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Bell size={80} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-6 flex items-center gap-2">
                <Zap size={14} className="fill-blue-400" /> IA Insights Operacionais
              </h4>
              <p className="text-sm font-medium leading-relaxed italic border-l-2 border-blue-500 pl-4">
                "{aiAnalysis}"
              </p>
              <button
                onClick={() => setShowAIInsights(false)}
                className="mt-8 text-[9px] font-black uppercase text-slate-500 hover:text-white transition-colors"
              >
                OCULTAR PAINEL IA
              </button>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {notifications.slice(0, 4).map((n, i) => (
                <div key={i} className={`p-6 rounded-[24px] border-l-4 shadow-sm flex items-start gap-4 animate-reveal ${n.type === 'critical' ? 'bg-rose-50 border-rose-500' :
                  n.type === 'warning' ? 'bg-orange-50 border-orange-500' : 'bg-blue-50 border-blue-500'
                  }`}>
                  <div className={`p-2 rounded-xl ${n.type === 'critical' ? 'bg-rose-500 text-white' :
                    n.type === 'warning' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                    {n.type === 'critical' ? <AlertTriangle size={16} /> : <Info size={16} />}
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-slate-900 uppercase italic mb-1">{n.message}</h5>
                    <p className="text-[10px] font-medium text-slate-500 leading-tight">{n.detail}</p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="md:col-span-2 p-10 bg-emerald-50 rounded-[24px] border-l-4 border-emerald-500 flex flex-col items-center justify-center text-center">
                  <ShieldCheck size={40} className="text-emerald-500 mb-2" />
                  <h5 className="text-xs font-black text-emerald-900 uppercase">Ambiente Seguro</h5>
                  <p className="text-[10px] font-medium text-emerald-600">Nenhum risco detectado pelo monitor IA.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'commercial' ? (
          <>
            {/* KPI CARDS - PREMIUM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                { label: 'Receita Total', val: totalRevenue, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Fluxo Pendente', val: totalReceivable, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Volume Expedido', val: totalWeightSold, icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50', fmt: 'w' },
                { label: 'Índice de Quebra', val: totalBreakage, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', fmt: 'w' }
              ].map((kpi, i) => (
                <div key={i} className="premium-card bg-white p-6 rounded-3xl group">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`${kpi.bg} ${kpi.color} p-3 rounded-2xl`}>
                      <kpi.icon size={20} />
                    </div>
                    <div className="h-2 w-2 rounded-full bg-gray-100 group-hover:bg-blue-500 transition-colors" />
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-extrabold text-gray-900`}>
                    {kpi.fmt === 'w' ? formatWeight(kpi.val) : formatCurrency(kpi.val)}
                  </p>
                </div>
              ))}
            </div>

            {/* CHARTS CONTAINER */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
              <div className="lg:col-span-2 premium-card bg-white p-6 rounded-3xl h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Monitoramento de Vendas</h3>
                    <p className="text-[10px] text-gray-400 font-medium">Fluxo de caixa das últimas 12 operações</p>
                  </div>
                  <div className="bg-blue-50 px-3 py-1 rounded-full text-blue-600 font-bold text-[9px] uppercase tracking-widest">Tempo Real</div>
                </div>

                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBrand" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={3} fill="url(#colorBrand)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                <h3 className="text-sm font-bold text-gray-800 mb-8">Estado do Sistema</h3>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">L</div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Lotes Totais</p>
                      <p className="text-sm font-bold text-gray-900">{safeBatches.length} Registros</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">V</div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Unidades Vendidas</p>
                      <p className="text-sm font-bold text-gray-900">{safeSales.length} Itens</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">C</div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Base de Clientes</p>
                      <p className="text-sm font-bold text-gray-900">{safeClients.length} Ativos</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-gray-50">
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={10} className="text-amber-500 fill-amber-500" />
                      <span className="text-[9px] font-bold text-gray-500 uppercase">Otimização de Custos</span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[85%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ANALYTICAL TABLE */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <History size={16} className="text-blue-600" />
                  Detalhamento por Lote
                </h3>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{salesByBatch.length} Entradas</span>
              </div>

              <div className="divide-y divide-gray-50">
                {salesByBatch.map(({ batchId, batch, items, totalRevenue, totalCost, totalProfit, supplier }) => {
                  const isExpanded = expandedBatches.has(batchId);

                  return (
                    <div key={batchId} className="group">
                      <div
                        onClick={() => toggleBatch(batchId)}
                        className={`p-6 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer transition-all gap-6 ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{batchId.slice(0, 8)}</span>
                            <h4 className="text-md font-bold text-gray-800">
                              {batch ? batch.id_lote : 'Lote Avulso'}
                            </h4>
                          </div>
                          <p className="text-[11px] text-gray-400 font-medium">
                            Fornecedor: {supplier} • Itens: {items.length}
                          </p>
                        </div>

                        <div className="flex items-center gap-10">
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Venda Bruta</p>
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Lucro Líquido</p>
                            <p className={`text-sm font-extrabold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatCurrency(totalProfit)}
                            </p>
                          </div>
                          <div className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-90' : 'text-gray-300'}`}>
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-[#fcfdff] border-t border-blue-50 px-6 py-4">
                          <div className="overflow-x-auto rounded-2xl border border-gray-100">
                            <table className="technical-table">
                              <thead>
                                <tr>
                                  <th>Venda</th>
                                  <th>Cliente</th>
                                  <th>Item</th>
                                  <th className="text-right">Peso</th>
                                  <th className="text-right">Valor</th>
                                  <th className="text-right">Lucro</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((entry, idx) => (
                                  <tr key={idx}>
                                    <td className="text-[10px] font-bold text-gray-500 uppercase">
                                      {new Date(entry.sale.data_venda).toLocaleDateString()}
                                    </td>
                                    <td className="font-bold text-gray-800">
                                      {entry.client?.nome_social || entry.sale.nome_cliente || 'Varejo'}
                                    </td>
                                    <td>
                                      <span className="font-mono text-[9px] text-blue-600 font-bold">
                                        {entry.item?.id_completo || entry.sale.id_completo}
                                      </span>
                                    </td>
                                    <td className="text-right font-medium text-gray-600">
                                      {formatWeight(entry.sale.peso_real_saida)}
                                    </td>
                                    <td className="text-right font-bold text-gray-900">
                                      {formatCurrency(entry.revenue)}
                                    </td>
                                    <td className={`text-right font-bold ${entry.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {formatCurrency(entry.profit)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {salesByBatch.length === 0 && (
                  <div className="text-center py-20 text-gray-300">
                    <History size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">Nenhum registro encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="animate-reveal space-y-10">
            {/* YIELD KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(() => {
                const totalEntry = salesByBatch.reduce((sum, b) => {
                  const batchEntryWeight = b.items.reduce((acc, i) => acc + (i.item?.peso_entrada || 0), 0);
                  return sum + batchEntryWeight;
                }, 0);
                const totalExit = salesByBatch.reduce((sum, b) => sum + b.items.reduce((acc, i) => acc + i.sale.peso_real_saida, 0), 0);
                const yieldPct = totalEntry > 0 ? (totalExit / totalEntry) * 100 : 0;

                return (
                  <>
                    <div className="premium-card p-10 bg-slate-900 text-white relative flex flex-col justify-center">
                      <div className="absolute top-0 right-0 p-8 opacity-10"><Activity size={80} /></div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Yield Industrial Global</p>
                      <h3 className="text-6xl font-black tracking-tighter">{yieldPct.toFixed(1)}%</h3>
                      <p className="text-xs font-bold text-slate-500 mt-4 uppercase tracking-widest">Aproveitamento Médio</p>
                    </div>

                    <div className="premium-card p-10 bg-white shadow-xl flex flex-col justify-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Quebra Detectada</p>
                      <h3 className="text-4xl font-black text-rose-600 tracking-tight">{formatWeight(totalBreakage)}</h3>
                      <div className="mt-6 flex items-center gap-2">
                        <TrendingDown size={14} className="text-rose-600" />
                        <span className="text-[10px] font-black text-slate-900 uppercase">Impacto direto na margem</span>
                      </div>
                    </div>

                    <div className="premium-card p-10 bg-white shadow-xl flex flex-col justify-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Eficiência de Resfriamento</p>
                      <h3 className="text-4xl font-black text-emerald-600 tracking-tight">97.8%</h3>
                      <div className="mt-6 flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-600" />
                        <span className="text-[10px] font-black text-slate-900 uppercase">Status Operacional: Estável</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* YIELD AUDIT TABLE */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Auditória de Rendimento por Lote</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[8px] font-black uppercase text-slate-400">{'>'} 97% Bom</span></div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[8px] font-black uppercase text-slate-400">{'<'} 95% Crítico</span></div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="technical-table">
                  <thead>
                    <tr>
                      <th>Identificação</th>
                      <th>Entrada Bruta</th>
                      <th>Saída Líquida</th>
                      <th className="text-right">Quebra (kg)</th>
                      <th className="text-right">Rendimento %</th>
                      <th className="w-40 text-center">Status Industrial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesByBatch.map((b) => {
                      const entryWeight = b.items.reduce((acc, i) => acc + (i.item?.peso_entrada || 0), 0);
                      const exitWeight = b.items.reduce((acc, i) => acc + i.sale.peso_real_saida, 0);
                      const breakage = entryWeight - exitWeight;
                      const yieldPct = entryWeight > 0 ? (exitWeight / entryWeight) * 100 : 0;

                      return (
                        <tr key={b.batchId} className="hover:bg-slate-50 transition-colors">
                          <td className="font-extrabold text-slate-900 uppercase text-xs italic">
                            Lote {b.batchId.slice(0, 8)} • {b.supplier}
                          </td>
                          <td className="font-bold text-slate-500">{formatWeight(entryWeight)}</td>
                          <td className="font-black text-slate-900">{formatWeight(exitWeight)}</td>
                          <td className="text-right font-black text-rose-500">{formatWeight(breakage)}</td>
                          <td className={`text-right font-black text-lg ${yieldPct > 97 ? 'text-emerald-600' : yieldPct < 95 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {yieldPct.toFixed(2)}%
                          </td>
                          <td className="text-center">
                            <div className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${yieldPct > 97 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : yieldPct < 95 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                              {yieldPct > 97 ? 'ALTA EFICIÊNCIA' : yieldPct < 95 ? 'QUEBA ACENTUADA' : 'ESTÁVEL'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LOSS ANALYSIS CHART PLACEHOLDER */}
            <div className="premium-card p-24 bg-white flex flex-col items-center justify-center border-dashed border-2 border-slate-100">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-8">
                <BarChart2 size={40} className="text-slate-200" />
              </div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.6em]">Projeção de Curva de Perda Industrial</p>
              <p className="text-[9px] font-bold text-slate-200 mt-4 uppercase">IA está processando variações sazonais...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;