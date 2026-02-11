import React, { useMemo, useState } from 'react';
import { StockItem, Batch, Sale, Client } from '../types';
import { formatWeight, formatCurrency, exportToCSV } from '../utils/helpers';
import {
    History,
    ArrowLeft,
    Search,
    Calendar,
    User,
    Package,
    Download,
    ChevronRight,
    DollarSign,
    Activity,
    ShieldCheck,
    Printer,
    Trash2,
    FileText,
    TrendingDown,
    Filter,
    ArrowUpDown,
    CheckCircle,
    TrendingUp,
    BarChart3,
    Scale
} from 'lucide-react';
import { jsPDF } from "jspdf";

interface SalesHistoryProps {
    stock: StockItem[];
    batches: Batch[];
    sales: Sale[];
    clients: Client[];
    initialSearchTerm?: string;
    onBack: () => void;
    onGoToSales?: () => void;
}

type GroupBy = 'date' | 'client' | 'batch';

const SalesHistory: React.FC<SalesHistoryProps> = ({ stock, batches, sales, clients, initialSearchTerm, onBack, onGoToSales }) => {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [groupBy, setGroupBy] = useState<GroupBy>(initialSearchTerm ? 'client' : 'date');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (groupId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) newExpanded.delete(groupId);
        else newExpanded.add(groupId);
        setExpandedGroups(newExpanded);
    };

    const salesData = useMemo(() => {
        return sales.map(sale => {
            const item = stock.find(s => s.id_completo === sale.id_completo);
            // CORREÇÃO AUDITORIA #3: Para carcaças inteiras (id_completo = "LOTE-SEQ-INTEIRO"),
            // não existe stock item com esse ID. Extrair id_lote do id_completo como fallback.
            const loteId = item?.id_lote || sale.id_completo.split('-').slice(0, 3).join('-');
            const batch = batches.find(b => b.id_lote === loteId);
            const client = clients.find(c => c.id_ferro === sale.id_cliente);
            const revenue = sale.peso_real_saida * sale.preco_venda_kg;
            const costKg = batch ? (Number(batch.custo_real_kg) || 0) : 0;
            const cost = (sale.peso_real_saida * costKg) + (sale.custo_extras_total || 0);
            return { sale, item, batch, client, revenue, cost, profit: revenue - cost };
        }).filter(data => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                data.sale.nome_cliente?.toLowerCase().includes(term) ||
                data.item?.id_completo.toLowerCase().includes(term) ||
                data.batch?.id_lote.toLowerCase().includes(term) ||
                data.batch?.fornecedor.toLowerCase().includes(term)
            );
        }).sort((a, b) => b.sale.data_venda.localeCompare(a.sale.data_venda));
    }, [sales, stock, batches, clients, searchTerm]);

    const totals = useMemo(() => {
        return salesData.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            cost: acc.cost + curr.cost,
            profit: acc.profit + curr.profit,
            count: acc.count + 1
        }), { revenue: 0, cost: 0, profit: 0, count: 0 });
    }, [salesData]);

    const groupedData = useMemo(() => {
        const groups = new Map<string, typeof salesData>();
        salesData.forEach(entry => {
            let key = '';
            if (groupBy === 'date') {
                const date = new Date(entry.sale.data_venda);
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else if (groupBy === 'client') {
                key = entry.client?.id_ferro || 'unknown';
            } else if (groupBy === 'batch') {
                key = entry.batch?.id_lote || 'unknown';
            }
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(entry);
        });

        return Array.from(groups.entries()).map(([key, items]) => {
            const groupRevenue = items.reduce((sum, i) => sum + i.revenue, 0);
            const groupCost = items.reduce((sum, i) => sum + i.cost, 0);
            const groupProfit = items.reduce((sum, i) => sum + i.profit, 0);
            let groupLabel = key;
            if (groupBy === 'date') {
                const date = new Date(items[0].sale.data_venda);
                groupLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
            } else if (groupBy === 'client') {
                groupLabel = items[0].client ? items[0].client.nome_social : (items[0].sale.nome_cliente || 'CLIENTE_DESCONHECIDO');
            } else if (groupBy === 'batch') {
                groupLabel = items[0].batch ? `LOTE_${items[0].batch.id_lote}` : 'SEM_LOTE';
            }
            return { id: key, label: groupLabel, items, totalRevenue: groupRevenue, totalCost: groupCost, totalProfit: groupProfit, mostRecentDate: items[0].sale.data_venda };
        }).sort((a, b) => b.mostRecentDate.localeCompare(a.mostRecentDate));
    }, [salesData, groupBy]);

    const handleExport = () => {
        const data = salesData.map(({ sale, item, batch, revenue, cost, profit }) => ({
            'DATA': sale.data_venda,
            'CLIENTE': sale.nome_cliente,
            'ITEM_ID': item?.id_completo || 'N/A',
            'LOTE': batch?.id_lote || 'N/A',
            'PESO_SAIDA': sale.peso_real_saida,
            'PRECO_KG': sale.preco_venda_kg,
            'RECEITA': revenue,
            'LUCRO': profit
        }));
        exportToCSV(data, `FRIGOGEST_HIST_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const generateReceipt = (sale: Sale) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("RECIBO DE EXPEDIÇÃO", pageWidth / 2, 25, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`FRIGOGEST INDUSTRIAL • ${new Date().toLocaleDateString()}`, pageWidth / 2, 32, { align: 'center' });
        doc.line(20, 40, pageWidth - 20, 40);

        doc.setFont("helvetica", "bold");
        doc.text("DADOS DA VENDA", 20, 50);
        doc.setFont("helvetica", "normal");
        doc.text(`CLIENTE: ${sale.nome_cliente?.toUpperCase() || 'Venda Direta'}`, 20, 58);
        doc.text(`DATA: ${sale.data_venda}`, 20, 64);
        doc.text(`ID VENDA: ${sale.id_venda}`, 20, 70);

        doc.line(20, 80, pageWidth - 20, 80);
        doc.text("ITEM", 20, 90);
        doc.text("PESO (KG)", 100, 90, { align: 'right' });
        doc.text("VALOR (R$)", 140, 90, { align: 'right' });
        doc.text("SUBTOTAL (R$)", 180, 90, { align: 'right' });

        const valorTotal = sale.peso_real_saida * sale.preco_venda_kg;
        doc.text(sale.id_completo, 20, 100);
        doc.text(sale.peso_real_saida.toFixed(2), 100, 100, { align: 'right' });
        doc.text(sale.preco_venda_kg.toFixed(2), 140, 100, { align: 'right' });
        doc.text(valorTotal.toFixed(2), 180, 100, { align: 'right' });

        doc.line(20, 110, pageWidth - 20, 110);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL GERAL:", 140, 120, { align: 'right' });
        doc.text(formatCurrency(valorTotal), 180, 120, { align: 'right' });

        doc.save(`RECIBO_${sale.id_venda.substring(0, 8)}.pdf`);
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20 font-sans">
            {/* PREMIUM HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex flex-col gap-4">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar ao Início
                    </button>
                    {onGoToSales && (
                        <button onClick={onGoToSales} className="group flex items-center gap-3 px-8 py-3 bg-blue-600 rounded-2xl text-sm font-black text-white hover:bg-slate-900 transition-all shadow-xl shadow-blue-200 uppercase tracking-wider animate-pulse hover:animate-none">
                            <Scale size={20} /> FAZER NOVA VENDA
                        </button>
                    )}
                    <div className="flex items-center gap-5">
                        <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-xl">
                            <History size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                Histórico de <span className="text-blue-600">Vendas</span>
                            </h1>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                Registro de Expedição / ID-LOG
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
                    <div className="relative group flex-1 md:flex-none md:min-w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Pesquisar registros..."
                            className="modern-input pl-12 h-12 text-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm shrink-0">
                        {[
                            { id: 'date', label: 'Data' },
                            { id: 'client', label: 'Cliente' },
                            { id: 'batch', label: 'Lote' }
                        ].map((btn) => (
                            <button key={btn.id} onClick={() => setGroupBy(btn.id as any)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${groupBy === btn.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                                {btn.label}
                            </button>
                        ))}
                    </div>
                    <button onClick={handleExport} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {[
                    { label: 'Faturamento Total', val: totals.revenue, icon: DollarSign, color: 'blue' },
                    { label: 'Custo de Mercadoria', val: totals.cost, icon: TrendingDown, color: 'slate' },
                    { label: 'Margem Líquida', val: totals.profit, icon: TrendingUp, color: 'emerald' }
                ].map((kpi, i) => (
                    <div key={i} className="premium-card p-8 flex flex-col gap-4 group hover:translate-x-1 transition-all">
                        <div className={`w-10 h-10 rounded-2xl bg-${kpi.color === 'blue' ? 'blue' : kpi.color === 'emerald' ? 'emerald' : 'slate'}-50 text-${kpi.color === 'blue' ? 'blue' : kpi.color === 'emerald' ? 'emerald' : 'slate'}-600 flex items-center justify-center`}>
                            <kpi.icon size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                            <h3 className={`text-2xl font-black text-slate-900 tracking-tight`}>{formatCurrency(kpi.val)}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* GROUPED LIST */}
            <div className="max-w-7xl mx-auto space-y-4">
                {groupedData.map(group => {
                    const isExpanded = expandedGroups.has(group.id);
                    return (
                        <div key={group.id} className={`premium-card p-0 overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-blue-500/10' : ''}`}>
                            <div onClick={() => toggleGroup(group.id)} className={`p-6 flex flex-col md:flex-row items-center justify-between cursor-pointer transition-all gap-8 ${isExpanded ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-6 w-full md:w-auto">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border font-bold ${isExpanded ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                        {groupBy === 'date' && <Calendar size={20} />}
                                        {groupBy === 'client' && <User size={20} />}
                                        {groupBy === 'batch' && <Package size={20} />}
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-black uppercase tracking-tight ${isExpanded ? 'text-white' : 'text-slate-900'}`}>{group.label}</h3>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isExpanded ? 'text-slate-400' : 'text-slate-400'}`}>{group.items.length} Operações registradas</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-10 w-full md:w-auto justify-between md:justify-end">
                                    <div className="text-right">
                                        <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Receita</p>
                                        <p className="font-black text-sm">{formatCurrency(group.totalRevenue)}</p>
                                    </div>
                                    <div className="text-right border-l border-white/10 pl-10">
                                        <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Resultado</p>
                                        <p className={`font-black text-sm ${group.totalProfit >= 0 ? (isExpanded ? 'text-blue-400' : 'text-blue-600') : 'text-rose-500'}`}>{formatCurrency(group.totalProfit)}</p>
                                    </div>
                                    <div className={`transition-all duration-300 ${isExpanded ? 'rotate-90 text-blue-400' : 'text-slate-300'}`}>
                                        <ChevronRight size={24} />
                                    </div>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-0 animate-reveal overflow-x-auto bg-white">
                                    <table className="technical-table">
                                        <thead>
                                            <tr>
                                                <th>Data</th>
                                                <th>Destinatário</th>
                                                <th>ID Item</th>
                                                <th className="text-right">Peso Saída</th>
                                                <th className="text-right">Quebra (KG)</th>
                                                <th className="text-right">Valor Venda</th>
                                                <th className="text-right">Margem</th>
                                                <th className="text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.items.map((entry, idx) => {
                                                const loss = (entry.item?.peso_entrada || 0) - entry.sale.peso_real_saida;
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="text-[10px] font-bold text-slate-400">{new Date(entry.sale.data_venda).toLocaleDateString()}</td>
                                                        <td className="font-extrabold uppercase text-xs text-slate-900 truncate max-w-[150px]">{entry.sale.nome_cliente || 'Loja Física'}</td>
                                                        <td className="font-mono text-[9px] text-slate-400">{entry.item?.id_completo || 'N/A'}</td>
                                                        <td className="text-right font-black text-slate-900">{formatWeight(entry.sale.peso_real_saida)}</td>
                                                        <td className={`text-right font-black ${loss > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{formatWeight(loss)}</td>
                                                        <td className="text-right font-black text-slate-900">{formatCurrency(entry.revenue)}</td>
                                                        <td className={`text-right font-black ${entry.profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{formatCurrency(entry.profit)}</td>
                                                        <td className="text-center">
                                                            <button onClick={() => generateReceipt(entry.sale)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center"><Printer size={16} /></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SalesHistory;
