import React, { useState, useMemo } from 'react';
import { StockItem, Batch, StockType, Sale, Client } from '../types';
import { getTypeName } from '../constants';
import { calculateDaysInStock, formatWeight, formatCurrency, getMaturationStatus, calculateRealCost } from '../utils/helpers';
import {
  AlertTriangle,
  Scale,
  History,
  DollarSign,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Package,
  Search,
  FileText,
  Folder,
  FolderOpen,
  Tag,
  Calendar,
  Database,
  Zap,
  Activity,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Layers,
  Archive,
  Barcode,
  Thermometer,
  Clock,
  Award,
  Dna,
  AlertCircle,
  Pencil as PencilIcon,
  Trash as TrashIcon,
  Check as CheckIcon,
  RotateCcw
} from 'lucide-react';

interface StockProps {
  stock: StockItem[];
  batches: Batch[];
  sales: Sale[];
  clients: Client[];
  updateBatch?: (id: string, updates: Partial<Batch>) => Promise<void>;
  deleteBatch?: (id: string) => Promise<void>;
  onBack: () => void;
}

const Stock: React.FC<StockProps> = ({ stock, batches, sales, clients, updateBatch, deleteBatch, onBack }) => {
  const [viewMode, setViewMode] = useState<'available' | 'sold'>('available');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBatches, setExpandedBatches] = useState<string[]>([]);

  const availableStock = stock.filter(s => s.status === 'DISPONIVEL');
  const soldStock = stock.filter(s => s.status === 'VENDIDO');

  // Group Stock by Batch -> Then by Sequence
  const inventoryByBatch = useMemo(() => {
    const batchGroups = new Map<string, { batch: Batch | undefined, items: StockItem[], sequences: Map<number, StockItem[]> }>();

    availableStock.forEach(item => {
      if (searchTerm && !item.id_completo.toLowerCase().includes(searchTerm.toLowerCase()) && !item.id_lote.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }
      if (!batchGroups.has(item.id_lote)) {
        const batchInfo = batches.find(b => b.id_lote === item.id_lote);
        // APENAS LOTES FECHADOS aparecem no estoque
        if (!batchInfo || batchInfo.status !== 'FECHADO') {
          return;
        }
        batchGroups.set(item.id_lote, { batch: batchInfo, items: [], sequences: new Map() });
      }
      const group = batchGroups.get(item.id_lote)!;
      group.items.push(item);
      if (!group.sequences.has(item.sequencia)) group.sequences.set(item.sequencia, []);
      group.sequences.get(item.sequencia)!.push(item);
    });

    return Array.from(batchGroups.values()).sort((a, b) => {
      const dateA = a.batch ? new Date(a.batch.data_recebimento).getTime() : 0;
      const dateB = b.batch ? new Date(b.batch.data_recebimento).getTime() : 0;
      return dateB - dateA;
    });
  }, [availableStock, batches, searchTerm]);

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]);
  };

  // Estados para edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  const handleEditBatch = (batch: Batch) => {
    setEditingBatch({ ...batch });
    setShowEditModal(true);
  };

  const handleSaveEditedBatch = async () => {
    if (!editingBatch || !updateBatch) return;
    try {
      await updateBatch(editingBatch.id_lote, editingBatch);
      setShowEditModal(false);
      setEditingBatch(null);
    } catch (e) {
      console.error('Erro ao salvar lote:', e);
    }
  };

  const handleDeleteBatch = async () => {
    if (!editingBatch || !deleteBatch) return;

    const confirmDelete = window.confirm(
      `🔄 ESTORNO DE LOTE\n\n` +
      `Você está prestes a ESTORNAR o lote:\n${editingBatch.id_lote} - ${editingBatch.fornecedor}\n\n` +
      `Esta ação irá:\n` +
      `• Marcar o lote como ESTORNADO\n` +
      `• Estornar vendas e devolver estoque\n` +
      `• Criar transações inversas no financeiro\n` +
      `• Manter histórico completo para auditoria\n\n` +
      `Deseja continuar?`
    );

    if (!confirmDelete) return;

    try {
      await deleteBatch(editingBatch.id_lote);
      alert('✅ Lote estornado com sucesso!');
      setShowEditModal(false);
      setEditingBatch(null);
    } catch (e) {
      console.error('Erro ao estornar lote:', e);
      alert('❌ Erro ao estornar o lote.');
    }
  };

  const soldHistory = useMemo(() => {
    return soldStock.map(item => {
      const sale = sales.find(s => s.id_completo === item.id_completo);
      const client = sale ? clients.find(c => c.id_ferro === sale.id_cliente) : null;
      return { item, sale, client };
    }).sort((a, b) => {
      if (a.sale && b.sale) return new Date(b.sale.data_venda).getTime() - new Date(a.sale.data_venda).getTime();
      return 0;
    });
  }, [soldStock, sales, clients]);

  const soldInventoryByBatch = useMemo(() => {
    const batchGroups = new Map<string, { batch: Batch | undefined, items: { item: StockItem, sale: Sale | undefined, client: Client | null }[] }>();
    soldHistory.forEach(({ item, sale, client }) => {
      if (searchTerm && !item.id_completo.toLowerCase().includes(searchTerm.toLowerCase()) && !item.id_lote.toLowerCase().includes(searchTerm.toLowerCase())) return;
      if (!batchGroups.has(item.id_lote)) {
        const batchInfo = batches.find(b => b.id_lote === item.id_lote);
        // APENAS LOTES FECHADOS aparecem no estoque
        if (!batchInfo || batchInfo.status !== 'FECHADO') {
          return;
        }
        batchGroups.set(item.id_lote, { batch: batchInfo, items: [] });
      }
      batchGroups.get(item.id_lote)!.items.push({ item, sale, client });
    });
    return Array.from(batchGroups.values()).sort((a, b) => {
      const dateA = a.batch ? new Date(a.batch.data_recebimento).getTime() : 0;
      const dateB = b.batch ? new Date(b.batch.data_recebimento).getTime() : 0;
      return dateB - dateA;
    });
  }, [soldHistory, batches, searchTerm]);

  // SUPPLIER QUALITY INSIGHTS
  const supplierInsights = useMemo(() => {
    const stats = new Map<string, { totalWeight: number, totalBreakage: number, count: number }>();

    sales.forEach(sale => {
      const item = stock.find(s => s.id_completo === sale.id_completo);
      const batch = item ? batches.find(b => b.id_lote === item.id_lote) : null;
      const supplierName = batch?.fornecedor || 'Desconhecido';

      if (!stats.has(supplierName)) {
        stats.set(supplierName, { totalWeight: 0, totalBreakage: 0, count: 0 });
      }

      const supplierStats = stats.get(supplierName)!;
      supplierStats.totalWeight += sale.peso_real_saida;
      supplierStats.totalBreakage += (sale.quebra_kg || 0);
      supplierStats.count += 1;
    });

    const insights = new Map<string, { avgBreakagePct: number, quality: 'top' | 'regular' | 'poor' }>();
    stats.forEach((v, k) => {
      const totalInitial = v.totalWeight + v.totalBreakage;
      const avgBreakagePct = totalInitial > 0 ? (v.totalBreakage / totalInitial) * 100 : 0;
      let quality: 'top' | 'regular' | 'poor' = 'regular';
      if (avgBreakagePct < 1.5) quality = 'top';
      else if (avgBreakagePct > 3) quality = 'poor';

      insights.set(k, { avgBreakagePct, quality });
    });

    return insights;
  }, [sales, batches, stock]);

  const totalCashFlow = soldHistory.reduce((acc, curr) => acc + (curr.sale ? (curr.sale.peso_real_saida * curr.sale.preco_venda_kg) : 0), 0);

  return (
    <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">

      {/* PREMIUM HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex flex-col gap-4">
          <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
            <ArrowLeft size={14} /> Voltar ao Início
          </button>
          <div className="flex items-center gap-5">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-100">
              <Database size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                Gestão de <span className="text-blue-600">Estoque</span>
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                  Controle de Inventário / ID-INV
                </p>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase">
                  <ShieldCheck size={10} /> Unidade Sincronizada
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative group w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Buscar por Lote ou ID..."
              className="modern-input pl-12 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex p-1 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <button
              onClick={() => setViewMode('available')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'available' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Layers size={14} /> Disponível
            </button>
            <button
              onClick={() => setViewMode('sold')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'sold' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Archive size={14} /> Vendido
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'available' ? (
        <div className="max-w-7xl mx-auto space-y-8 animate-reveal">
          {inventoryByBatch.length === 0 && (
            <div className="py-32 text-center premium-card">
              <Database size={64} className="mx-auto mb-6 text-slate-100" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">O estoque está vazio no momento</p>
            </div>
          )}

          {inventoryByBatch.map(({ batch, items, sequences }) => {
            const batchId = batch ? batch.id_lote : items[0].id_lote;
            const isExpanded = expandedBatches.includes(batchId) || searchTerm.length > 0;

            // Calcular peso total COM desconto de 3kg para carcaças inteiras (igual ao Batches)
            const grouped = items.reduce((acc, item) => {
              const seq = item.sequencia;
              if (!acc[seq]) acc[seq] = { bandaA: null, bandaB: null, inteiro: null };
              if (item.tipo === StockType.BANDA_A) acc[seq].bandaA = item;
              else if (item.tipo === StockType.BANDA_B) acc[seq].bandaB = item;
              else if (item.tipo === StockType.INTEIRO) acc[seq].inteiro = item;
              return acc;
            }, {} as Record<number, { bandaA: StockItem | null; bandaB: StockItem | null; inteiro: StockItem | null }>);

            const totalWeight = Object.values(grouped).reduce((acc, group) => {
              const pesoA = group.bandaA?.peso_entrada || 0;
              const pesoB = group.bandaB?.peso_entrada || 0;
              const pesoInteiro = group.inteiro?.peso_entrada || 0;

              // Se tem banda A e B = carcaça inteira, desconta 3kg do total
              const desconto = (pesoA > 0 && pesoB > 0) ? 3 : 0;
              const pesoGrupo = pesoInteiro > 0 ? pesoInteiro : (pesoA + pesoB - desconto);

              return acc + pesoGrupo;
            }, 0);

            const daysInStock = batch ? calculateDaysInStock(batch.data_recebimento) : 0;
            const isOld = daysInStock > 8;

            return (
              <div key={batchId} className="premium-card overflow-hidden">
                {/* Batch Header */}
                <div
                  onClick={() => toggleBatch(batchId)}
                  className={`p-6 flex flex-col lg:flex-row items-center justify-between cursor-pointer transition-all gap-6 ${isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-6 w-full lg:w-auto">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                      {isExpanded ? <FolderOpen size={24} /> : <Folder size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
                          {batch?.fornecedor || 'Fornecedor N/A'}
                        </h3>
                        {batch && (
                          <div className="flex gap-2">
                            {/* MATURATION SEMAPHORE */}
                            {(() => {
                              const mat = getMaturationStatus(daysInStock);
                              return (
                                <span className={`flex items-center gap-1.5 text-[9px] font-black ${mat.color} ${mat.bg} px-2.5 py-1 rounded-full uppercase tracking-widest border ${mat.border} shadow-sm`}>
                                  {mat.status === 'fresh' && <Thermometer size={10} />}
                                  {mat.status === 'prime' && <Award size={10} />}
                                  {mat.status === 'warning' && <Clock size={10} />}
                                  {mat.status === 'critical' && <AlertCircle size={10} />}
                                  {mat.label} ({daysInStock}d)
                                </span>
                              );
                            })()}

                                <Dna size={10} /> {supplierInsights.get(batch.fornecedor)?.quality === 'top' ? 'Genética Premium' : 'Gado Regular'}
                              </span>
                            )}
                            
                            {/* ═══ 2026 AI METRICS ═══ */}
                            {batch?.vision_audit_status === 'APROVADO' && (
                              <span className="flex items-center gap-1.5 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                                <Activity size={10} /> Vision Certified
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          ID-LOTE: <span className="text-slate-900">{batchId}</span>
                        </span>
                        {batch?.traceability_hash && (
                          <>
                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                            <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 rounded tracking-tighter">
                              HASH: {batch.traceability_hash}
                            </span>
                          </>
                        )}
                        <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                          Entrada: {batch?.data_recebimento ? new Date(batch.data_recebimento).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between w-full lg:w-auto gap-10">
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Peças</p>
                      <p className="text-xl font-extrabold text-slate-800">{items.length} UN</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Total</p>
                      <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                        <p className="text-xl font-extrabold text-emerald-700">{formatWeight(totalWeight)}</p>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2">
                      {batch && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditBatch(batch);
                            }}
                            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-lg hover:scale-110"
                            title="Editar lote"
                          >
                            <PencilIcon size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditBatch(batch);
                            }}
                            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center transition-all shadow-lg hover:scale-110"
                            title="Estornar lote"
                          >
                            <RotateCcw size={16} />
                          </button>
                        </>
                      )}
                    </div>

                    <div className={`transition-all duration-300 ${isExpanded ? 'rotate-90 text-blue-600' : 'text-slate-300'}`}>
                      <ChevronRight size={24} />
                    </div>
                  </div>
                </div>

                {/* Grid of items */}
                {isExpanded && (
                  <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white border-t border-slate-50 animate-reveal">
                    {Array.from(sequences.entries()).sort((a, b) => a[0] - b[0]).map(([seq, seqItems]) => {
                      const hasInteiro = seqItems.some(i => i.tipo === StockType.INTEIRO);
                      const hasBandaA = seqItems.some(i => i.tipo === StockType.BANDA_A);
                      const hasBandaB = seqItems.some(i => i.tipo === StockType.BANDA_B);
                      const isComplete = hasInteiro || (hasBandaA && hasBandaB);
                      const animalWeight = seqItems.reduce((acc, i) => acc + i.peso_entrada, 0);

                      return (
                        <div key={seq} className="group p-5 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/20 transition-all flex flex-col">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase">#{String(seq).padStart(3, '0')}</span>
                            <span className="text-lg font-black text-slate-800">{formatWeight(animalWeight)}</span>
                          </div>

                          <div className="space-y-2 flex-1">
                            {seqItems.map(item => (
                              <div key={item.id_completo} className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className="flex items-center gap-1.5 text-slate-500">
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.tipo === StockType.BANDA_A ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : item.tipo === StockType.BANDA_B ? 'bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.4)]'}`} />
                                    {getTypeName(item.tipo).toUpperCase()}
                                  </span>
                                  <span className="text-slate-900 bg-slate-50 px-2 py-0.5 rounded-lg">{formatWeight(item.peso_entrada)}</span>
                                </div>
                                {(item.gordura || item.marmoreio) && (
                                  <div className="flex gap-1">
                                    {item.gordura && (
                                      <span className="text-[8px] font-black bg-orange-100 text-orange-700 px-1.5 rounded uppercase">GORD: {item.gordura}</span>
                                    )}
                                    {item.marmoreio && (
                                      <span className="text-[8px] font-black bg-purple-100 text-purple-700 px-1.5 rounded uppercase">MARM: {item.marmoreio}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {!isComplete && !hasInteiro && (
                              <div className="mt-4 pt-3 border-t border-slate-50 text-[8px] text-orange-600 font-black flex items-center gap-1.5 uppercase tracking-widest animate-pulse">
                                <AlertTriangle size={10} /> Parcial / Incompleto
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-8 animate-reveal">
          {/* SOLD SUMMARY */}
          <div className="bg-slate-900 rounded-[40px] p-10 text-white relative shadow-2xl shadow-slate-200 overflow-hidden">
            <div className="absolute top-[-10%] right-[-5%] opacity-10 pointer-events-none transform rotate-12">
              <Archive size={200} />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-end gap-10 relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Acumulado em Vendas</p>
                </div>
                <h3 className="text-6xl md:text-7xl font-black tracking-tighter">
                  {formatCurrency(totalCashFlow)}
                </h3>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 min-w-[240px] border border-white/10">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Despachos Efetuados</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black">{soldStock.length}</p>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Unidades</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {soldInventoryByBatch.map(({ batch, items }) => {
              const batchTotalRevenue = items.reduce((acc, { sale }) => acc + (sale ? (sale.peso_real_saida * sale.preco_venda_kg) : 0), 0);
              const batchTotalCost = items.reduce((acc, { sale, item }) => {
                if (!sale || !batch) return acc;
                return acc + (sale.peso_real_saida * (Number(batch.custo_real_kg) || 0)) + (sale.custo_extras_total || 0);
              }, 0);
              const batchTotalProfit = batchTotalRevenue - batchTotalCost;

              return (
                <div key={batch ? batch.id_lote : 'unknown'} className="premium-card overflow-hidden">
                  <div className="p-8 flex flex-col md:flex-row justify-between items-center gap-10 bg-slate-50/50 border-b border-slate-50">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-900">
                        <Barcode size={28} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black tracking-tight text-slate-900">
                          {batch ? `Lote ${batch.id_lote}` : 'Lote não vinculado'}
                        </h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{batch?.fornecedor || 'Desconhecido'}</span>
                          <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Custo Base: {formatCurrency(batch?.custo_real_kg || 0)}/kg</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-10 bg-white px-8 py-5 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Lucro Operacional</p>
                        <p className={`text-2xl font-black ${batchTotalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(batchTotalProfit)}
                        </p>
                      </div>
                      <div className="w-px h-10 bg-slate-100"></div>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Qtd Vendida</p>
                        <span className="text-2xl font-black text-slate-800">{items.length} PC</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="technical-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>ID / Especificação</th>
                          <th>Cliente / Destino</th>
                          <th className="text-right">Peso Saída</th>
                          <th className="text-right">Total Venda</th>
                          <th className="text-right">Margem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(({ item, sale, client }) => {
                          const revenue = sale ? (sale.peso_real_saida * sale.preco_venda_kg) : 0;
                          const costKg = batch ? (Number(batch.custo_real_kg) || 0) : 0;
                          const cost = sale ? (sale.peso_real_saida * costKg) + (sale.custo_extras_total || 0) : 0;
                          const profit = revenue - cost;

                          return (
                            <tr key={item.id_completo} className="hover:bg-slate-50 transition-colors">
                              <td className="text-[10px] font-medium text-slate-400 uppercase">
                                {sale ? new Date(sale.data_venda).toLocaleDateString() : 'N/A'}
                              </td>
                              <td>
                                <div className="text-[10px] font-black text-slate-900 tracking-tighter uppercase">{item.id_completo}</div>
                                <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{getTypeName(item.tipo)}</div>
                              </td>
                              <td>
                                {client ? (
                                  <span className="text-[10px] font-black uppercase tracking-tight text-slate-700">{client.nome_social}</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{sale?.nome_cliente || 'Direto'}</span>
                                )}
                              </td>
                              <td className="text-right font-black text-slate-900">
                                {sale ? formatWeight(sale.peso_real_saida) : '-'}
                              </td>
                              <td className="text-right font-black text-blue-600">
                                {formatCurrency(revenue)}
                              </td>
                              <td className="text-right">
                                <div className={`inline-flex px-3 py-1 rounded-lg font-black text-sm ${profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {formatCurrency(profit)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE LOTE */}
      {showEditModal && editingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-reveal overflow-y-auto">
          <div className="bg-white rounded-[48px] shadow-2xl max-w-2xl w-full overflow-hidden border border-white my-8">
            <div className="bg-blue-600 p-12 text-white text-center">
              <div className="w-24 h-24 bg-white/20 rounded-[32px] flex items-center justify-center mx-auto mb-8">
                <PencilIcon size={48} />
              </div>
              <h3 className="text-3xl font-black tracking-tight leading-none uppercase">Editar Lote</h3>
              <p className="text-[10px] font-bold tracking-[0.2em] mt-4 uppercase text-blue-100 opacity-60">{editingBatch.id_lote}</p>
            </div>
            <div className="p-12 space-y-6 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Fornecedor</label>
                <input
                  type="text"
                  className="modern-input w-full"
                  value={editingBatch.fornecedor}
                  onChange={e => setEditingBatch({ ...editingBatch, fornecedor: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Peso Romaneio (kg)</label>
                  <input
                    type="text" inputMode="decimal"
                    className="modern-input w-full font-bold text-lg"
                    placeholder="Peso em kg"
                    value={editingBatch.peso_total_romaneio || ''}
                    onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setEditingBatch({ ...editingBatch, peso_total_romaneio: parseFloat(v) || 0 }); }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Data Recebimento</label>
                  <input
                    type="date"
                    className="modern-input w-full"
                    value={editingBatch.data_recebimento}
                    onChange={e => setEditingBatch({ ...editingBatch, data_recebimento: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Valores Financeiros</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Valor do Gado (R$)</label>
                    <input
                      type="text" inputMode="decimal"
                      className="modern-input w-full text-xl font-black"
                      placeholder="Valor total"
                      value={editingBatch.valor_compra_total || ''}
                      onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setEditingBatch({ ...editingBatch, valor_compra_total: parseFloat(v) || 0 }); }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Frete (R$)</label>
                      <input
                        type="text" inputMode="decimal"
                        className="modern-input w-full"
                        placeholder="Frete"
                        value={editingBatch.frete || ''}
                        onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setEditingBatch({ ...editingBatch, frete: parseFloat(v) || 0 }); }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Extras (R$)</label>
                      <input
                        type="text" inputMode="decimal"
                        className="modern-input w-full"
                        placeholder="Extras"
                        value={editingBatch.gastos_extras || ''}
                        onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setEditingBatch({ ...editingBatch, gastos_extras: parseFloat(v) || 0 }); }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-2xl p-4 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Custo Real/Kg:</span>
                    <span className="text-xl font-black text-orange-400">
                      {formatCurrency(calculateRealCost(
                        editingBatch.valor_compra_total,
                        editingBatch.frete,
                        editingBatch.gastos_extras,
                        editingBatch.peso_total_romaneio
                      ))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-6">
                <button
                  onClick={handleSaveEditedBatch}
                  className="btn-modern bg-blue-600 text-white w-full py-5 rounded-2xl hover:bg-blue-700 shadow-xl transition-all"
                >
                  <CheckIcon size={20} className="inline mr-2" />
                  Salvar Alterações
                </button>

                <button
                  onClick={handleDeleteBatch}
                  className="btn-modern bg-amber-500 text-white w-full py-4 rounded-2xl hover:bg-amber-600 shadow-xl transition-all border-2 border-amber-600"
                >
                  <RotateCcw size={18} className="inline mr-2" />
                  Estornar Lote
                </button>

                <button
                  onClick={() => { setShowEditModal(false); setEditingBatch(null); }}
                  className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-[0.2em] py-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;