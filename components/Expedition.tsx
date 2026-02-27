import React, { useState, useMemo } from 'react';
import { StockItem, Client, Sale, Batch } from '../types';
import DecimalInput from './DecimalInput';
import {
  Search,
  ShoppingCart,
  User,
  CheckCircle,
  X,
  Calendar,
  ClipboardList,
  Trash2,
  ArrowLeft,
  Zap,
  Printer,
  Database,
  Scale,
  History,
  Package,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  FileText,
  Weight,
  DollarSign,
  Plus,
  Minus,
  AlertCircle,
  Truck,
  ArrowRight,
  LayoutGrid,
  BoxSelect,
  MoreHorizontal
} from 'lucide-react';
import { formatWeight, formatCurrency, todayBR, formatDateBR } from '../utils/helpers';
import { jsPDF } from 'jspdf';

interface ExpeditionProps {
  stock: StockItem[];
  clients: Client[];
  batches?: Batch[];
  onConfirmSale: (saleData: any) => void;
  onBack: () => void;
  salesHistory: Sale[];
}

const Expedition: React.FC<ExpeditionProps> = ({ stock, clients, batches, onConfirmSale, onBack, salesHistory }) => {

  const getSupplierName = (batchId: string) => {
    if (!batches) return '';
    const batch = batches.find(b => b.id_lote === batchId);
    return batch ? batch.fornecedor : '';
  };
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedItems, setSelectedItems] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showLoadPlanner, setShowLoadPlanner] = useState(false);

  // Helper: calcular dias em câmara
  const getDaysInChamber = (item: StockItem) => {
    const entrada = (item as any).data_entrada || (item as any).data_recebimento;
    if (!entrada) return 0;
    return Math.floor((Date.now() - new Date(entrada).getTime()) / 86400000);
  };

  // CORREÇÃO SANITÁRIA (MAPA/SIF): Filtrar lotes FECHADOS + excluir peças > 8 dias
  const availableStock = useMemo(() => {
    if (!batches || batches.length === 0) return [];
    const closedBatchIds = new Set(batches.filter(b => b.status === 'FECHADO').map(b => b.id_lote));
    return stock
      .filter(item => item.status === 'DISPONIVEL' && closedBatchIds.has(item.id_lote))
      // FIFO: ordenar pelo mais antigo primeiro (legislação sanitária)
      .sort((a, b) => {
        const aDate = (a as any).data_entrada || '';
        const bDate = (b as any).data_entrada || '';
        return aDate.localeCompare(bDate);
      });
  }, [stock, batches]);

  // Peças bloqueadas (>= 12 dias) — removidas completamente da lista
  const expiredItems = useMemo(() =>
    availableStock.filter(item => getDaysInChamber(item) >= 12),
    [availableStock]
  );
  // Peças em atenção (8-11 dias) — podem vender mas com aviso laranja
  const warningItems = useMemo(() =>
    availableStock.filter(item => { const d = getDaysInChamber(item); return d >= 8 && d < 12; }),
    [availableStock]
  );
  // Estoque seguro (< 12 dias) — inclui os de aviso (8-11d), mas REMOVE os bloqueados
  const safeStock = useMemo(() =>
    availableStock.filter(item => getDaysInChamber(item) < 12),
    [availableStock]
  );

  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());

  const toggleLot = (loteId: string) => {
    setExpandedLots(prev => {
      const next = new Set(prev);
      if (next.has(loteId)) next.delete(loteId);
      else next.add(loteId);
      return next;
    });
  };

  const groupedStock = useMemo(() => {
    // Usar safeStock (sem expirados) para seleção, mas mostrar expirados em vermelho
    const filtered = safeStock.filter(item =>
      item.id_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id_lote.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups = new Map<string, StockItem[]>();
    filtered.forEach(item => {
      const key = item.id_lote;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    return Array.from(groups.entries()).map(([loteId, items]) => {
      const carcassMap = new Map<number, StockItem[]>();
      items.forEach(item => {
        if (!carcassMap.has(item.sequencia)) carcassMap.set(item.sequencia, []);
        carcassMap.get(item.sequencia)!.push(item);
      });

      return {
        key: loteId,
        items: items,
        lote: loteId,
        carcasses: Array.from(carcassMap.entries()).map(([seq, parts]) => ({
          sequencia: seq,
          parts: parts.sort((a, b) => a.tipo - b.tipo),
          totalCarcassWeight: parts.reduce((acc, p) => acc + p.peso_entrada, 0)
        })).sort((a, b) => b.sequencia - a.sequencia),
        totalWeight: items.reduce((acc, i) => acc + i.peso_entrada, 0),
        supplier: getSupplierName(loteId),
        expiredCount: expiredItems.filter(e => e.id_lote === loteId).length,
        warningCount: warningItems.filter(e => e.id_lote === loteId).length,
      };
    }).sort((a, b) => b.lote.localeCompare(a.lote));
  }, [safeStock, searchTerm, batches, expiredItems, warningItems]);


  const [itemWeights, setItemWeights] = useState<Record<string, number>>({});
  const [pesoUnit, setPesoUnit] = useState<'KG' | 'G'>('KG');
  const [pagoNoAto, setPagoNoAto] = useState(false);
  const [pagoMetodo, setPagoMetodo] = useState<'PIX' | 'DINHEIRO' | 'CARTAO'>('PIX');
  const [saleSuccess, setSaleSuccess] = useState<{ clientName: string; totalKg: number; totalValue: number; items: number } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  // Conversor de unidade para exibição/entrada
  const toDisplayWeight = (kg: number) => pesoUnit === 'G' ? Math.round(kg * 1000) : kg;
  const toKg = (v: number) => pesoUnit === 'G' ? v / 1000 : v;

  const getTotalWeight = () => {
    return selectedItems.reduce((acc, item) => {
      const customWeight = itemWeights[item.id_completo];
      return acc + (customWeight !== undefined ? customWeight : item.peso_entrada);
    }, 0);
  };

  const totalWeight = getTotalWeight();
  const [pricePerKg, setPricePerKg] = useState<number>(0);
  const [extrasCost, setExtrasCost] = useState<number>(0);
  const totalValue = totalWeight * pricePerKg;

  const handleWeightChange = (itemId: string, newWeight: number) => {
    setItemWeights(prev => ({ ...prev, [itemId]: newWeight }));
  };

  const handleToggleItem = (item: StockItem) => {
    if (selectedItems.find(i => i.id_completo === item.id_completo)) {
      setSelectedItems(prev => prev.filter(i => i.id_completo !== item.id_completo));
      setItemWeights(prev => {
        const newWeights = { ...prev };
        delete newWeights[item.id_completo];
        return newWeights;
      });
    } else {
      setSelectedItems(prev => [...prev, item]);
      setItemWeights(prev => ({ ...prev, [item.id_completo]: item.peso_entrada }));
    }
  };

  const handleToggleGroup = (items: StockItem[]) => {
    const allSelected = items.every(item => selectedItems.some(i => i.id_completo === item.id_completo));
    if (allSelected) {
      setSelectedItems(prev => prev.filter(i => !items.some(item => item.id_completo === i.id_completo)));
    } else {
      const newItems = items.filter(item => !selectedItems.some(i => i.id_completo === item.id_completo));
      setSelectedItems(prev => [...prev, ...newItems]);
      newItems.forEach(item => {
        setItemWeights(prev => ({ ...prev, [item.id_completo]: item.peso_entrada }));
      });
    }
  };

  const handleGroupWeightChange = (items: StockItem[], totalWeight: number) => {
    const totalEntryWeight = items.reduce((acc, i) => acc + i.peso_entrada, 0);
    const newWeights: Record<string, number> = {};
    let allocatedWeight = 0;

    items.forEach((item, index) => {
      if (index === items.length - 1) {
        newWeights[item.id_completo] = parseFloat((totalWeight - allocatedWeight).toFixed(2));
      } else {
        const ratio = totalEntryWeight > 0 ? item.peso_entrada / totalEntryWeight : 0;
        const w = parseFloat((totalWeight * ratio).toFixed(2));
        newWeights[item.id_completo] = w;
        allocatedWeight += w;
      }
    });

    setItemWeights(prev => ({ ...prev, ...newWeights }));
  };

  const groupedSelectedItems = useMemo(() => {
    const groups = new Map<string, StockItem[]>();
    selectedItems.forEach(item => {
      const key = `${item.id_lote}-${item.sequencia}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    return Array.from(groups.values());
  }, [selectedItems]);

  const generateReceipt = () => {
    if (!selectedClient || selectedItems.length === 0) {
      alert("Selecione um cliente e itens para gerar o recibo.");
      return;
    }

    const doc = jsPDF ? new jsPDF() : null;
    if (!doc) return;

    const pageWidth = doc.internal.pageSize.width;

    // --- LOGOTIPO THIAGO 704 ---
    doc.setFillColor(15, 23, 42); // Navy Dark
    doc.rect(20, 15, 45, 15, 'F');
    doc.setFont("courier", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("THIAGO", 25, 23);
    doc.setFontSize(16);
    doc.setTextColor(59, 130, 246); // Blue-500
    doc.text("704", 47, 26);

    // Brand subtitle
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("EXCELÊNCIA EM CARNA OPERACIONAL", 20, 35);

    // Header Info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.text("COMPROVANTE DE ENTREGA", pageWidth - 20, 25, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`FRIGOGEST PRO X // ID: ${Date.now()}`, pageWidth - 20, 32, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 40, pageWidth - 20, 40);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("DADOS DO DESTINATÁRIO", 20, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`CLIENTE: ${selectedClient.nome_social}`, 20, 58);
    doc.text(`DOCUMENTO: ${selectedClient.cpf_cnpj || 'N/A'}`, 20, 64);
    doc.text(`ENDEREÇO: ${selectedClient.endereco || 'RETIRADA LOCAL'}`, 20, 70);

    doc.line(20, 80, pageWidth - 20, 80);
    doc.setFont("helvetica", "bold");
    doc.text("DETALHAMENTO DOS ITENS", 20, 90);

    let y = 100;
    doc.setFillColor(242, 245, 248);
    doc.rect(20, y - 6, pageWidth - 40, 9, 'F');
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("IDENTIFICAÇÃO / DESCRIÇÃO", 22, y);
    doc.text("TIPO", 80, y);
    doc.text("LOTE", 110, y);
    doc.text("PESO (KG)", 155, y, { align: 'right' });
    doc.text("VALOR (R$)", 190, y, { align: 'right' });

    y += 10; // Increment Y after headers to avoid overlap
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const groups = new Map<string, StockItem[]>();
    selectedItems.forEach(item => {
      const key = `${item.id_lote}-${item.sequencia}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

    groups.forEach((items, key) => {
      const isWhole = items.length > 1 || items[0].tipo === 1;
      const groupWeight = items.reduce((acc, item) => acc + (itemWeights[item.id_completo] || item.peso_entrada), 0);
      const groupValue = groupWeight * pricePerKg;

      doc.setTextColor(15, 23, 42);
      if (isWhole && items.length > 1) {
        // Carcaça inteira (Banda A + Banda B) - Mostrar header e depois as bandas
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`CARCASSA INTEIRA #${items[0].sequencia}`, 22, y);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(items[0].id_lote, 110, y);
        doc.text(groupWeight.toFixed(2), 155, y, { align: 'right' });
        doc.text(groupValue.toFixed(2), 190, y, { align: 'right' });
        y += 7;

        // Mostrar as bandas individuais
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        items.forEach(item => {
          const weight = itemWeights[item.id_completo] || item.peso_entrada;
          doc.text(`  └─ ${item.tipo === 2 ? 'BANDA A' : 'BANDA B'}`, 22, y);
          doc.text(weight.toFixed(2) + ' kg', 155, y, { align: 'right' });
          y += 5;
        });
        y += 3;
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
      } else if (isWhole && items[0].tipo === 1) {
        // Inteiro (não dividido)
        doc.setFont("helvetica", "bold");
        doc.text(`CARCASSA INTEIRA #${items[0].sequencia}`, 22, y);
        doc.setFont("helvetica", "normal");
        doc.text("-", 80, y);
        doc.text(items[0].id_lote, 110, y);
        doc.text(groupWeight.toFixed(2), 155, y, { align: 'right' });
        doc.text(groupValue.toFixed(2), 190, y, { align: 'right' });
        y += 8;
      } else {
        items.forEach(item => {
          const weight = itemWeights[item.id_completo] || item.peso_entrada;
          const total = weight * pricePerKg;
          doc.text(item.id_completo, 22, y);
          doc.text(item.tipo === 1 ? 'INTEIRO' : item.tipo === 2 ? 'BANDA A' : 'BANDA B', 80, y);
          doc.text(item.id_lote, 110, y);
          doc.text(weight.toFixed(2), 155, y, { align: 'right' });
          doc.text(total.toFixed(2), 190, y, { align: 'right' });
          y += 8;
        });
      }

      if (y > 250) {
        doc.addPage();
        y = 30;
      }
    });

    doc.setDrawColor(226, 232, 240);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246);
    doc.text("TOTAL DA CARGA:", 20, y);
    doc.setTextColor(15, 23, 42);
    doc.text(`${totalWeight.toFixed(2)} KG`, 155, y, { align: 'right' });
    doc.text(formatCurrency(totalValue + extrasCost), 190, y, { align: 'right' });

    // SIGNATURE AREA
    y += 40;
    if (y > 260) {
      doc.addPage();
      y = 50;
    }

    // Line for Receiver
    doc.setDrawColor(15, 23, 42);
    doc.line(25, y, 95, y);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("RECEBIDO POR (CLIENTE)", 60, y + 5, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text(selectedClient.nome_social, 60, y + 9, { align: 'center' });

    // Line for Deliverer
    doc.line(pageWidth - 95, y, pageWidth - 25, y);
    doc.setFont("helvetica", "bold");
    doc.text("ENTREGUE POR (THIAGO 704)", pageWidth - 60, y + 5, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.text("LOGÍSTICA OPERACIONAL FG", pageWidth - 60, y + 9, { align: 'center' });

    doc.save(`RECIBO_THIAGO704_${selectedClient.id_ferro}.pdf`);
  };

  const handleConfirm = () => {
    if (!selectedClient || selectedItems.length === 0 || pricePerKg <= 0) {
      alert("⚠️ Preencha todos os dados da venda!");
      return;
    }
    if (confirm("Deseja gerar o Manifesto de Carga (PDF)?")) {
      generateReceipt();
    }

    const totalKg = getTotalWeight();
    const totalValue = totalKg * pricePerKg;
    const clientName = selectedClient.nome_social;
    const itemCount = selectedItems.length;

    const itemsWithWeights = selectedItems.map(item => ({
      ...item,
      peso_saida: itemWeights[item.id_completo] !== undefined ? itemWeights[item.id_completo] : item.peso_entrada
    }));

    onConfirmSale({
      client: selectedClient,
      items: itemsWithWeights,
      pricePerKg,
      extrasCost,
      pagoNoAto,
      metodoPagamento: pagoNoAto ? pagoMetodo : undefined
    });

    // Resetar form
    setSelectedClient(null);
    setSelectedItems([]);
    setPricePerKg(0);
    setExtrasCost(0);
    setPagoNoAto(false);
    setItemWeights({});

    // Mostrar tela de sucesso DENTRO da expedição (não navega para outro lugar)
    setSaleSuccess({ clientName, totalKg, totalValue, items: itemCount });
  };

  // ═══ TELA DE SUCESSO APÓS VENDA ═══
  if (saleSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full">
          {/* Ícone de sucesso */}
          <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-200 animate-bounce">
            <CheckCircle size={48} className="text-white" />
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-2">Venda Registrada! 🎉</h1>
          <p className="text-slate-500 text-sm mb-8">A venda foi confirmada com sucesso.</p>

          {/* Resumo da venda */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 p-6 mb-8 text-left space-y-4 border border-slate-100">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <User size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cliente</p>
                <p className="text-sm font-black text-slate-800">{saleSuccess.clientName}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-slate-800">{saleSuccess.items}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Peças</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-emerald-700">{saleSuccess.totalKg.toFixed(1)}</p>
                <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wide">kg saída</p>
              </div>
              <div className="bg-blue-50 rounded-2xl p-3 text-center">
                <p className="text-lg font-black text-blue-700">{formatCurrency(saleSuccess.totalValue)}</p>
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wide">Total</p>
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="space-y-3">
            <button
              onClick={() => setSaleSuccess(null)}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <ShoppingCart size={20} />
              🛒 Nova Venda
            </button>
            <button
              onClick={() => { setSaleSuccess(null); setShowHistory(true); }}
              className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <ClipboardList size={16} />
              Ver Histórico de Expedição
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] animate-reveal pb-20 font-sans">
        <div className="max-w-7xl mx-auto flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setShowHistory(false)} className="group flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 rounded-full text-xs font-black text-slate-500 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50 transition-all shadow-sm">
                <ArrowLeft size={16} /> Voltar à Expedição
              </button>

              <button onClick={() => setShowHistory(false)} className="group flex items-center gap-3 px-8 py-3 bg-blue-600 rounded-2xl text-xs font-black text-white hover:bg-slate-900 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest">
                <Truck size={18} /> Realizar Outra Venda
              </button>
            </div>

            <div className="flex items-center gap-6 mt-4">
              <div className="bg-slate-900 p-4 rounded-3xl text-white shadow-2xl shadow-slate-200">
                <History size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 italic">LOG de <span className="text-blue-600">Expedição</span></h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Histórico Operacional Cronológico</p>
              </div>
            </div>
          </div>

          <div className="premium-card overflow-hidden bg-white shadow-xl shadow-slate-100">
            <div className="overflow-x-auto">
              <table className="technical-table">
                <thead>
                  <tr>
                    <th>Data Valor</th>
                    <th>Entidade Receptora</th>
                    <th>ID Unitário</th>
                    <th className="text-right">Peso Saída</th>
                    <th className="text-right">Montante Final</th>
                  </tr>
                </thead>
                <tbody>
                  {salesHistory.slice(0, 100).map((sale, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900">{new Date(sale.data_venda).toLocaleDateString()}</td>
                      <td>
                        <p className="font-extrabold text-slate-900 uppercase text-xs italic">"{sale.nome_cliente || 'Mercado Interno'}"</p>
                      </td>
                      <td>
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{sale.id_completo}</span>
                      </td>
                      <td className="text-right font-black text-slate-900 text-sm">
                        {formatWeight(sale.peso_real_saida)}
                      </td>
                      <td className="text-right">
                        <span className="font-black text-blue-600 text-sm">{formatCurrency(sale.peso_real_saida * sale.preco_venda_kg)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] overflow-hidden animate-reveal font-sans">

      {/* PREMIUM HEADER - EXPEDITION CONTROL */}
      <div className="h-24 bg-white border-b border-slate-100 flex items-center justify-between px-10 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-10">
          <button onClick={onBack} className="group flex items-center gap-2.5 px-5 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 hover:bg-white hover:border-blue-200 transition-all shadow-sm">
            <ArrowLeft size={16} /> Home
          </button>
          <div className="h-10 w-px bg-slate-100" />
          <div className="flex items-center gap-5">
            <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-100">
              <Truck size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight italic leading-none">Terminal de <span className="text-blue-600">Vendas</span></h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1.5 opacity-60">Expedição Controlada / ID-X-PROC</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">
            <History size={16} /> Archive Log
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: SELECTION ENGINE */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white/50 backdrop-blur-sm relative">

          {/* SEARCH & CLIENT BAR */}
          <div className="p-8 pb-4 flex flex-col xl:flex-row gap-6 shrink-0 relative z-10">
            <div className="flex-1 group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block px-1 group-focus-within:text-blue-600 transition-colors">Entidade Receptora</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <select
                  className="modern-input h-16 pl-12 bg-white font-extrabold text-xs uppercase tracking-widest shadow-sm hover:border-blue-300 transition-all cursor-pointer"
                  value={selectedClient ? JSON.stringify(selectedClient) : ""}
                  onChange={(e) => {
                    if (e.target.value) setSelectedClient(JSON.parse(e.target.value));
                    else setSelectedClient(null);
                  }}
                >
                  <option value="">-- SELECIONE O CLIENTE --</option>
                  {clients.sort((a, b) => a.nome_social.localeCompare(b.nome_social)).map(client => (
                    <option key={client.id_ferro} value={JSON.stringify(client)}>
                      {client.id_ferro} // {client.nome_social}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full xl:w-96 group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block px-1 group-focus-within:text-blue-600 transition-colors">Filtro de Logística</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="BUSCAR ID OU LOTE..."
                  className="modern-input h-16 pl-12 bg-white font-black text-xs uppercase tracking-widest shadow-sm hover:border-blue-300 transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* COMPACT STOCK GRID */}
          <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6 custom-scrollbar">
            {groupedStock.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale">
                <Database size={100} className="mb-6" />
                <p className="text-xs font-black uppercase tracking-[0.4em]">Estoque Indisponível</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {groupedStock.map(group => {
                  const allSelected = group.items.every(item => selectedItems.some(i => i.id_completo === item.id_completo));
                  const someSelected = group.items.some(item => selectedItems.some(i => i.id_completo === item.id_completo));
                  const isExpanded = expandedLots.has(group.lote);

                  return (
                    <div key={group.key} className="bg-white rounded-[24px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow group/batch">

                      {/* BATCH HEADER - FOLDER STYLE */}
                      <div
                        onClick={() => toggleLot(group.lote)}
                        className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'bg-white hover:bg-slate-50/50'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-600 text-white rotate-90' : 'bg-slate-100 text-slate-400'}`}>
                            <ChevronRight size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">LOTE: {group.lote}</p>
                            <p className="text-xs font-extrabold text-slate-900 uppercase tracking-tighter italic">"{group.supplier || 'CARGA PADRÃO'}"</p>
                          </div>
                          {(group as any).expiredCount > 0 && (
                            <div className="flex items-center gap-1.5 bg-rose-100 border border-rose-200 text-rose-700 px-3 py-1 rounded-full">
                              <AlertCircle size={12} />
                              <span className="text-[9px] font-black uppercase">{(group as any).expiredCount} VENCIDA{(group as any).expiredCount > 1 ? 'S' : ''} — BLOQUEADA{(group as any).expiredCount > 1 ? 'S' : ''} +12d</span>
                            </div>
                          )}
                          {(group as any).warningCount > 0 && (
                            <div className="flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-700 px-3 py-1 rounded-full">
                              <AlertCircle size={12} />
                              <span className="text-[9px] font-black uppercase">{(group as any).warningCount} EM ATENÇÃO — 8-11d</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Payload Total</p>
                            <p className="text-[12px] font-black text-slate-900">{formatWeight(group.totalWeight)}</p>
                          </div>
                          <div className="h-8 w-px bg-slate-100 hidden sm:block" />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleGroup(group.items); }}
                            className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${allSelected
                              ? `bg-blue-600 text-white shadow-lg shadow-blue-100`
                              : `bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50`
                              }`}
                          >
                            {allSelected ? 'LIBERAR' : someSelected ? 'COMPLETAR' : 'RESERVAR'}
                          </button>
                        </div>
                      </div>

                      {/* UNIT TABLE - PLANILHA STYLE (COLLAPSIBLE) */}
                      {isExpanded && (
                        <div className="overflow-x-auto bg-white animate-reveal">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/20">
                                <th className="px-6 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">Sel</th>
                                <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Procedência</th>
                                <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo</th>
                                <th className="px-6 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Peso (KG)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {group.carcasses.map(carcass => {
                                const carcassAllSelected = carcass.parts.every(p => selectedItems.some(si => si.id_completo === p.id_completo));
                                return (
                                  <React.Fragment key={carcass.sequencia}>
                                    {/* CARCASS SUB-HEADER */}
                                    <tr className="bg-slate-50/10 border-t border-slate-100/50">
                                      <td className="px-6 py-1 text-center bg-slate-50/20">
                                        <div className="w-4 h-4 rounded bg-slate-200 flex items-center justify-center text-[7px] font-black text-slate-500">#{carcass.sequencia}</div>
                                      </td>
                                      <td className="px-4 py-1" colSpan={2}>
                                        <div className="flex items-center gap-3">
                                          <span className="text-[9px] font-black text-slate-900 uppercase">Carcassa #{carcass.sequencia}</span>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleGroup(carcass.parts); }}
                                            className={`px-2 py-0.5 rounded text-[7px] font-black uppercase transition-all ${carcassAllSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200'}`}
                                          >
                                            {carcassAllSelected ? 'INTEIRA SELECIONADA' : 'VENDER INTEIRA'}
                                          </button>
                                        </div>
                                      </td>
                                      <td className="px-6 py-1 text-right">
                                        <span className="text-[9px] font-black text-slate-400">{formatWeight(carcass.totalCarcassWeight)}</span>
                                      </td>
                                    </tr>
                                    {/* CARCASS PARTS */}
                                    {carcass.parts.map(item => {
                                      const isSelected = selectedItems.some(i => i.id_completo === item.id_completo);
                                      return (
                                        <tr
                                          key={item.id_completo}
                                          onClick={() => handleToggleItem(item)}
                                          className={`group/row cursor-pointer transition-all ${isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}
                                        >
                                          <td className="px-6 py-1.5 text-center">
                                            <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'
                                              }`}>
                                              {isSelected && <CheckCircle size={8} fill="currentColor" className="text-white" />}
                                            </div>
                                          </td>
                                          <td className="px-4 py-1.5">
                                            <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>
                                              {item.id_completo}
                                            </span>
                                          </td>
                                          <td className="px-4 py-1.5 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                              }`}>
                                              {item.tipo === 1 ? 'INT' : item.tipo === 2 ? 'B-A' : 'B-B'}
                                            </span>
                                          </td>
                                          <td className="px-6 py-1.5 text-right">
                                            <span className={`text-xs font-black tracking-tight ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                                              {formatWeight(item.peso_entrada)}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
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
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          FLOATING CART BUTTON (estilo iFood/Rappi)
          aparece quando tem itens no carrinho
      ══════════════════════════════════════════ */}
      {selectedItems.length > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full max-w-lg mx-auto flex pointer-events-auto bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl shadow-2xl shadow-emerald-900/30 transition-all items-center justify-between px-5 py-4"
          >
            {/* Badge de qtd */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart size={22} />
                <span className="absolute -top-2 -right-2 bg-white text-emerald-700 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                  {selectedItems.length}
                </span>
              </div>
              <span className="text-sm font-black uppercase tracking-wider">Ver Carrinho</span>
            </div>

            {/* Resumo do peso */}
            <div className="text-right">
              <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wide">{totalWeight.toFixed(1)} kg</p>
              {pricePerKg > 0 && <p className="text-base font-black">{formatCurrency(totalValue)}</p>}
            </div>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          BOTTOM SHEET CART (slide-up)
      ══════════════════════════════════════════ */}
      {cartOpen && (
        <>
          {/* Overlay escuro */}
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />

          {/* Panel deslizando de baixo */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

            {/* Handle de arrastar + header */}
            <div className="flex flex-col items-center pt-3 pb-2 border-b border-slate-100 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full mb-3" />
              <div className="w-full px-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-600 p-2 rounded-xl text-white">
                    <ShoppingCart size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Carrinho de Venda</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{selectedItems.length} peça(s) · {totalWeight.toFixed(2)} kg</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedItems.length > 0 && (
                    <button
                      onClick={() => { setSelectedItems([]); setItemWeights({}); }}
                      className="text-[10px] font-black text-rose-500 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-all uppercase"
                    >
                      Limpar
                    </button>
                  )}
                  <button
                    onClick={() => setCartOpen(false)}
                    className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Cliente */}
            <div className="px-5 py-3 shrink-0 border-b border-slate-50">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Cliente</label>
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none"
                value={selectedClient ? JSON.stringify(selectedClient) : ''}
                onChange={(e) => { if (e.target.value) setSelectedClient(JSON.parse(e.target.value)); else setSelectedClient(null); }}
              >
                <option value="">-- Selecione o cliente --</option>
                {clients.sort((a, b) => a.nome_social.localeCompare(b.nome_social)).map(client => (
                  <option key={client.id_ferro} value={JSON.stringify(client)}>{client.id_ferro} // {client.nome_social}</option>
                ))}
              </select>
            </div>

            {/* Lista de itens com PESO DE SAÍDA */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {groupedSelectedItems.map((group, groupIdx) => {
                const isGroup = group.length > 1;
                const groupItemsWeight = group.reduce((acc, item) => acc + (itemWeights[item.id_completo] || item.peso_entrada), 0);
                const groupEntryWeight = group.reduce((acc, item) => acc + item.peso_entrada, 0);
                const quebra = groupEntryWeight - groupItemsWeight;

                return (
                  <div key={groupIdx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    {/* Cabeçalho */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isGroup ? (
                          <><div className="bg-blue-600 p-1 rounded-lg text-white"><ShieldCheck size={10} /></div>
                          <span className="text-[10px] font-black text-slate-800">Carcaça Inteira · {group.length} cortes</span></>
                        ) : (
                          <span className="text-[10px] font-black text-slate-800">
                            {group[0].tipo === 1 ? 'Inteiro' : group[0].tipo === 2 ? 'Banda A' : 'Banda B'} · #{group[0].sequencia}
                          </span>
                        )}
                      </div>
                      <button onClick={() => { group.forEach(item => handleToggleItem(item)); }} className="text-rose-400 hover:text-rose-600 p-1">
                        <X size={14} />
                      </button>
                    </div>

                    {/* Peso entrada */}
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-slate-400 font-bold uppercase">Entrou na câmara:</span>
                      <span className="font-black text-slate-500">{groupEntryWeight.toFixed(2)} kg</span>
                    </div>

                    {/* PESO DE SAÍDA — DESTAQUE */}
                    <div>
                      <label className="text-[9px] font-black text-orange-600 uppercase tracking-widest block mb-1">📦 Peso de Saída (kg reais)</label>
                      <div className="flex items-center gap-2 bg-white border-2 border-orange-400 rounded-2xl px-4 py-3 shadow-sm">
                        <Scale size={18} className="text-orange-500 flex-shrink-0" />
                        <DecimalInput
                          className="flex-1 bg-transparent font-black text-2xl text-orange-700 outline-none"
                          placeholder={groupEntryWeight.toFixed(2)}
                          value={groupItemsWeight}
                          onValueChange={(v) => {
                            if (isGroup) handleGroupWeightChange(group, v);
                            else handleWeightChange(group[0].id_completo, v);
                          }}
                        />
                        <span className="text-base font-black text-orange-400">kg</span>
                      </div>
                      {quebra > 0.01 && (
                        <p className="text-[9px] text-amber-600 font-bold mt-1">
                          ↓ Quebra: {quebra.toFixed(2)} kg ({((quebra / groupEntryWeight) * 100).toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RODAPÉ: preço + confirmar */}
            <div className="shrink-0 border-t border-slate-100 px-5 py-4 space-y-3 bg-white">
              {/* Preço/kg */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">R$ Preço / kg</label>
                  <DecimalInput
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-400 rounded-xl px-4 py-3 font-black text-xl text-slate-900 outline-none"
                    placeholder="0,00"
                    value={pricePerKg}
                    onValueChange={setPricePerKg}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Extras (R$)</label>
                  <DecimalInput
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-slate-900 outline-none"
                    placeholder="0"
                    value={extrasCost}
                    onValueChange={setExtrasCost}
                  />
                </div>
              </div>

              {/* Total e pagamento */}
              <div className="flex items-center justify-between bg-slate-900 rounded-2xl px-5 py-3">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Total da venda</span>
                <span className="text-xl font-black text-white">{formatCurrency(totalValue + extrasCost)}</span>
              </div>

              {/* Pagamento */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPagoNoAto(!pagoNoAto)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                    pagoNoAto ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <DollarSign size={14} /> Pago no Ato
                </button>
                {pagoNoAto && (
                  <div className="flex gap-1 flex-1">
                    {(['PIX', 'DINHEIRO', 'CARTAO'] as const).map(m => (
                      <button key={m} onClick={() => setPagoMetodo(m)}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all ${
                          pagoMetodo === m ? 'bg-green-100 text-green-700 border-2 border-green-400' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {m === 'PIX' ? '🟢 PIX' : m === 'DINHEIRO' ? '💵 Dinheiro' : '💳 Cartão'}
                      </button>
                    ))}
                  </div>
                )}
                {!pagoNoAto && <span className="text-[9px] text-slate-400 font-bold uppercase">Prazo/Fiado</span>}
              </div>

              {/* Botão confirmar */}
              <button
                onClick={() => { setCartOpen(false); handleConfirm(); }}
                disabled={!selectedClient || selectedItems.length === 0 || pricePerKg <= 0}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                Confirmar Entrega {pagoNoAto ? '[Pago ✔]' : '[Fiado]'}
              </button>
              {(!selectedClient || pricePerKg <= 0) && (
                <p className="text-[9px] text-amber-600 font-bold text-center">
                  {!selectedClient ? '⚠️ Selecione o cliente' : '⚠️ Informe o preço por kg'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Expedition;

          {/* CART HEADER - CONDENSED */}
          <div className="p-6 pb-2 shrink-0 border-b border-slate-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-lg">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight italic">Manifesto de <span className="text-blue-600">Saída</span></h2>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aguardando Confirmação</p>
                </div>
              </div>

              {selectedItems.length > 0 && (
                <button onClick={() => setSelectedItems([])} className="text-[10px] font-black text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all uppercase tracking-tighter">
                  Limpar Tudo
                </button>
              )}
            </div>

            {/* CLIENT MINI BADGE */}
            <div className={`px-4 py-3 rounded-2xl transition-all flex items-center gap-3 ${selectedClient ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 border border-slate-100 text-slate-300'}`}>
              <User size={18} className={selectedClient ? 'text-white' : 'text-slate-300'} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase truncate italic">
                  {selectedClient ? selectedClient.nome_social : 'Selecionar Cliente Ativo'}
                </p>
              </div>
              {selectedItems.length > 0 && (
                <div className="bg-white/20 px-2 py-0.5 rounded-md text-[9px] font-black">{selectedItems.length} ITENS</div>
              )}
            </div>
          </div>

          {/* CART ITEMS AREA - CLEANER LIST */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar-thin bg-slate-50/30">
            {selectedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <Package size={40} className="text-slate-300 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carrinho Vazio</p>
              </div>
            ) : (
              groupedSelectedItems.map((group, groupIdx) => {
                const isGroup = group.length > 1;
                const groupItemsWeight = group.reduce((acc, item) => acc + (itemWeights[item.id_completo] || item.peso_entrada), 0);
                const groupEntryWeight = group.reduce((acc, item) => acc + item.peso_entrada, 0);
                const quebra = groupEntryWeight - groupItemsWeight;

                return (
                  <div key={groupIdx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Header do animal */}
                    <div className="bg-slate-800 px-4 py-2 flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Animal #{group[0].sequencia} // Lote {group[0].id_lote}</span>
                      <button
                        onClick={() => { group.forEach(item => handleToggleItem(item)); }}
                        className="text-[8px] font-black text-rose-400 hover:bg-rose-900/30 px-2 py-1 rounded transition-all uppercase"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    <div className="p-3 space-y-3">
                      {/* Tipo de item */}
                      <div className="flex items-center gap-2">
                        {isGroup ? (
                          <div className="flex items-center gap-2">
                            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><ShieldCheck size={12} /></div>
                            <span className="text-[10px] font-black text-blue-900 uppercase">Carcaça Inteira · {group.length} cortes</span>
                          </div>
                        ) : (
                          group.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <div className="bg-slate-100 px-2 py-0.5 rounded text-[8px] font-bold text-slate-600 font-mono">{item.id_completo.split('-').pop()}</div>
                              <span className="text-[10px] font-black text-slate-800 uppercase">{item.tipo === 1 ? 'Inteiro' : item.tipo === 2 ? 'Banda A (Dianteiro)' : 'Banda B (Traseiro)'}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Peso de entrada (referência) */}
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">⚖️ Peso entrada (câmara):</span>
                        <span className="text-[9px] font-black text-slate-500">{groupEntryWeight.toFixed(2)} kg</span>
                      </div>

                      {/* PESO DE SAÍDA — DESTAQUE PRINCIPAL */}
                      <div>
                        <label className="text-[9px] font-black text-orange-600 uppercase tracking-widest block mb-1.5">📦 PESO DE SAÍDA (kg reais saindo)</label>
                        <div className="flex items-center gap-2 bg-orange-50 border-2 border-orange-400 rounded-2xl px-4 py-3 shadow-sm shadow-orange-100">
                          <Scale size={20} className="text-orange-500 flex-shrink-0" />
                          <DecimalInput
                            className="flex-1 bg-transparent font-black text-2xl text-orange-700 outline-none"
                            placeholder={groupEntryWeight.toFixed(2)}
                            value={toDisplayWeight(Number(groupItemsWeight.toFixed(2))) || 0}
                            onValueChange={(v) => {
                              if (isGroup) {
                                handleGroupWeightChange(group, toKg(v));
                              } else {
                                handleWeightChange(group[0].id_completo, toKg(v));
                              }
                            }}
                          />
                          <span className="text-base font-black text-orange-500">{pesoUnit}</span>
                        </div>
                        {quebra > 0.01 && (
                          <p className="text-[9px] text-amber-600 font-bold mt-1 px-1">
                            ↓ Quebra: {quebra.toFixed(2)} kg ({((quebra/groupEntryWeight)*100).toFixed(1)}%) — normal até 3%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* TOGGLE KG/GRAMAS para pesos de saída */}
          {selectedItems.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-t border-slate-700">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Unidade peso saída:</span>
              <button
                onClick={() => setPesoUnit(u => u === 'KG' ? 'G' : 'KG')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  pesoUnit === 'G'
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-900'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                {pesoUnit === 'KG' ? '⚖️ KG' : '🔢 GRAMAS'}
              </button>
              {pesoUnit === 'G' && (
                <span className="text-[9px] text-orange-400 font-bold">Digite em gramas → converte para KG</span>
              )}
            </div>
          )}

          {/* CHECKOUT ACTION AREA - CONDENSED */}
          <div className="shrink-0 bg-slate-900 text-white p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
              <ShoppingCart size={200} className="rotate-12 translate-x-20 translate-y-20" />
            </div>

            <div className="relative z-10 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">R$ Preço / KG</label>
                  <div className="flex items-center bg-white/10 border border-white/10 rounded-xl px-4 h-12 focus-within:bg-white/20 transition-all">
                    <DecimalInput
                      className="w-full bg-transparent text-white font-black text-xl outline-none"
                      value={pricePerKg || 0}
                      onValueChange={v => setPricePerKg(v)}
                      placeholder="Preço/kg"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Custos Extras</label>
                  <div className="flex items-center bg-white/10 border border-white/10 rounded-xl px-4 h-12 focus-within:bg-white/20 transition-all">
                    <DecimalInput
                      className="w-full bg-transparent text-white font-black text-lg outline-none"
                      value={extrasCost || 0}
                      onValueChange={v => setExtrasCost(v)}
                      placeholder="Extras"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Subtotal Acumulado</p>
                    <h2 className="text-3xl font-black text-blue-400 tracking-tighter italic leading-none">{formatCurrency(totalValue + extrasCost)}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Carga (Σ KG)</p>
                    <p className="text-xl font-black text-white italic tracking-tighter leading-none">{formatWeight(totalWeight)}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">

                  {/* PAGO NO ATO TOGGLE */}
                  <div className={`rounded-xl border p-3 transition-all ${pagoNoAto ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-white/5 border-white/10'}`}>
                    <button
                      onClick={() => setPagoNoAto(p => !p)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${pagoNoAto ? 'bg-emerald-400 border-emerald-400' : 'border-white/30'}`}>
                          {pagoNoAto && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-white">💵 Pago no Ato</span>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${pagoNoAto ? 'bg-emerald-400 text-white' : 'bg-white/10 text-slate-400'}`}>
                        {pagoNoAto ? 'ATIVADO → Entrará no Caixa' : 'PRAZO'}
                      </span>
                    </button>
                    {pagoNoAto && (
                      <div className="mt-3 flex gap-2">
                        {(['PIX', 'DINHEIRO', 'CARTAO'] as const).map(m => (
                          <button
                            key={m}
                            onClick={() => setPagoMetodo(m)}
                            className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                              pagoMetodo === m ? 'bg-emerald-400 text-white shadow-sm' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                            }`}
                          >
                            {m === 'PIX' ? '⚡ PIX' : m === 'DINHEIRO' ? '💵 Dinheiro' : '💳 Cartão'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleConfirm}
                    disabled={selectedItems.length === 0 || !selectedClient || pricePerKg <= 0}
                    className={`w-full py-4 rounded-xl text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all disabled:opacity-20 active:scale-95 shadow-xl ${
                      pagoNoAto
                        ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/30'
                        : 'bg-blue-600 hover:bg-white hover:text-slate-900 shadow-blue-500/20'
                    }`}
                  >
                    <ShieldCheck size={20} />
                    {pagoNoAto ? `✅ Confirmar + Receber ${pagoMetodo}` : 'Confirmar Entrega [FIADO]'}
                  </button>

                  <button
                    onClick={generateReceipt}
                    disabled={selectedItems.length === 0 || !selectedClient || pricePerKg <= 0}
                    className="w-full py-2.5 bg-white/5 border border-white/10 rounded-lg text-white font-black text-[8px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-10"
                  >
                    <Printer size={14} /> Imprimir Comprovante
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* EXPEDIÇÃO TETRIS MODAL */}
      {showLoadPlanner && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xl animate-reveal p-10 flex items-center justify-center">
          <div className="bg-white rounded-[48px] shadow-3xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-white">
            <div className="bg-slate-900 p-10 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><LayoutGrid size={28} /></div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight italic">Expedição <span className="text-blue-500">Tetris</span></h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Simulador de Carregamento Industrial</p>
                </div>
              </div>
              <button
                onClick={() => setShowLoadPlanner(false)}
                className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-600 hover:border-rose-500 transition-all group"
              >
                <X size={24} className="group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            <div className="flex-1 p-10 flex flex-col lg:flex-row gap-10 overflow-hidden">
              <div className="flex-1 bg-slate-50 rounded-[40px] border border-slate-100 p-8 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Truck size={200} /></div>

                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8">Layout Interno do Veículo</h4>

                {/* TRUCK LOAD VISUALIZER */}
                <div className="flex-1 grid grid-cols-6 grid-rows-8 gap-3 content-start">
                  {selectedItems.map((item, i) => (
                    <div
                      key={i}
                      className={`h-16 rounded-xl border flex flex-col items-center justify-center transition-all group hover:scale-[1.05] animate-reveal ${item.tipo === 1 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-100 text-slate-900'
                        }`}
                      title={`${item.id_completo} - ${formatWeight(item.peso_entrada)}`}
                    >
                      <span className="text-[9px] font-black uppercase tracking-tighter">{item.tipo === 1 ? 'INT' : item.tipo === 2 ? 'B-A' : 'B-B'}</span>
                      <span className="text-[8px] font-bold opacity-40">{formatWeight(item.peso_entrada)}</span>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 48 - selectedItems.length) }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-100">
                      <Plus size={16} />
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-100 rounded-lg"><div className="w-2 h-2 rounded-full bg-slate-900"></div><span className="text-[9px] font-black uppercase text-slate-400">Pesados / Inteiros</span></div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-100 rounded-lg"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[9px] font-black uppercase text-slate-400">Média Estabilidade</span></div>
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle size={14} className="text-blue-500" /> Distribua o peso uniformemente
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-96 flex flex-col gap-8 shrink-0">
                <div className="bg-blue-600 rounded-[32px] p-8 text-white shadow-xl shadow-blue-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-100 mb-2">Resumo do Manifesto</p>
                  <h3 className="text-4xl font-black italic tracking-tighter">{formatWeight(totalWeight)}</h3>
                  <div className="mt-8 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60"><span>Items Totais:</span><span>{selectedItems.length} UN</span></div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60"><span>Volume Médio:</span><span>{(totalWeight / (selectedItems.length || 1)).toFixed(1)} KG/UN</span></div>
                    <div className="h-px bg-white/10 my-4"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black uppercase italic">Distribuição de Carga</span>
                      <span className="text-sm font-black text-blue-200">OK</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-slate-50 rounded-[32px] p-8 border border-slate-100 overflow-y-auto">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Fila de Carregamento</h4>
                  <div className="space-y-3">
                    {selectedItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black bg-slate-900 text-white w-5 h-5 flex items-center justify-center rounded-lg">{i + 1}</span>
                          <div>
                            <p className="text-[10px] font-black text-slate-900 uppercase">#{item.id_completo.split('-').pop()}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.id_lote}</p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-blue-600">{formatWeight(item.peso_entrada)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expedition;
