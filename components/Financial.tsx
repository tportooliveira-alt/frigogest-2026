import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Sale, Batch, StockItem, Client, Transaction, PaymentMethod, Payable } from '../types';
import { formatCurrency, formatWeight } from '../utils/helpers';
import {
  Edit2,
  Save,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  PieChart,
  CalendarClock,
  CheckCircle,
  ArrowLeft,
  Beef,
  Tag,
  Wallet,
  ShoppingBag,
  Truck,
  Landmark,
  Printer,
  Calendar,
  Filter,
  Trash2 as TrashIcon,
  RotateCcw,
  ShieldCheck,
  Activity,
  ChevronRight,
  Zap,
  ShoppingCart,
  Plus as PlusIcon,
  CreditCard as CreditCardIcon,
  BarChart3 as BarChartIcon,
  ArrowRight as ArrowRightIcon,
  Search as SearchIcon,
  AlertCircle,
  History as HistoryIcon,
  Minus as MinusIcon,
  Target,
  Crown,
  Medal,
  Flame,
  Navigation
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface FinancialProps {
  sales: Sale[];
  batches: Batch[];
  stock: StockItem[];
  clients: Client[];
  transactions: Transaction[];
  updateSaleCost: (id_venda: string, newCost: number) => void;
  addTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addPartialPayment: (saleId: string, valorPagamento: number, method: PaymentMethod, date: string) => void;
  onBack: () => void;
  payables: Payable[];
  addPayable: (p: Payable) => void;
  updatePayable: (p: Payable) => void;
  deletePayable: (id: string) => void;
  estornoSale?: (saleId: string) => Promise<void>;
  cleanAllFinancialData?: () => Promise<void>; // NOVA: Limpa todos os dados financeiros
}

const Financial: React.FC<FinancialProps> = ({
  sales = [],
  batches = [],
  stock = [],
  clients = [],
  transactions = [],
  addTransaction,
  deleteTransaction,
  addPartialPayment,
  onBack,
  payables = [],
  addPayable,
  updatePayable,
  deletePayable,
  estornoSale,
  cleanAllFinancialData
}) => {

  const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'receivables' | 'payables' | 'profit' | 'suppliers'>('overview');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showPayableForm, setShowPayableForm] = useState(false);
  const [payableFilterStatus, setPayableFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID' | 'LATE'>('PENDING');
  const [receivablesFilter, setReceivablesFilter] = useState<'ALL' | 'OVERDUE' | 'CRITICAL'>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [supplierLoteFilter, setSupplierLoteFilter] = useState<string>('ALL');

  const [newPayable, setNewPayable] = useState<Partial<Payable>>({
    descricao: '', valor: 0, valor_pago: 0, categoria: 'OPERACIONAL',
    data_vencimento: new Date().toISOString().split('T')[0], status: 'PENDENTE'
  });

  const [filterStartDate, setFilterStartDate] = useState(() => {
    const date = new Date(); date.setDate(1); return date.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // FILTROS AVANÇADOS - A PAGAR
  const [payableLoteFilter, setPayableLoteFilter] = useState('');
  const [payableSupplierFilter, setPayableSupplierFilter] = useState('');
  const [payableDateStart, setPayableDateStart] = useState('');
  const [payableDateEnd, setPayableDateEnd] = useState('');

  // FILTROS AVANÇADOS - A RECEBER
  const [receivableLoteFilter, setReceivableLoteFilter] = useState('');
  const [receivableClientFilter, setReceivableClientFilter] = useState('');
  const [receivableDateStart, setReceivableDateStart] = useState('');
  const [receivableDateEnd, setReceivableDateEnd] = useState('');

  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    descricao: '', valor: 0, tipo: 'SAIDA', categoria: 'OPERACIONAL',
    data: new Date().toISOString().split('T')[0]
  });

  const [saleToPay, setSaleToPay] = useState<Sale | null>(null);
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>('PIX');
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [payableToPay, setPayableToPay] = useState<Payable | null>(null);
  const [payableAmountStr, setPayableAmountStr] = useState('');

  const getSaleBalance = (sale: Sale) => {
    const valorTotal = (sale.peso_real_saida || 0) * (sale.preco_venda_kg || 0);
    const valorPago = (sale as any).valor_pago || 0;
    return { valorTotal, valorPago, saldoDevedor: Math.max(0, valorTotal - valorPago) };
  };

  const getBatchBalance = (batch: Batch) => {
    const totalCost = (batch.valor_compra_total || 0) + (batch.frete || 0) + (batch.gastos_extras || 0);
    const debt = totalCost - ((batch as any).valor_pago || 0);
    return { totalCost, paid: (batch as any).valor_pago || 0, debt: Math.max(0, debt) };
  };

  const getSaleDetails = (sale: Sale) => {
    const item = stock.find(s => s.id_completo === sale.id_completo);
    // CORREÇÃO AUDITORIA #3: Para carcaças inteiras (id_completo = "LOTE-SEQ-INTEIRO"),
    // não existe stock item com esse ID. Extrair id_lote do id_completo como fallback.
    const loteId = item?.id_lote || sale.id_completo.split('-').slice(0, 3).join('-');
    const batch = item ? batches.find(b => b.id_lote === item.id_lote) : batches.find(b => b.id_lote === loteId);
    const revenue = (sale.peso_real_saida || 0) * (sale.preco_venda_kg || 0);
    const costKg = batch ? (Number(batch.custo_real_kg) || 0) : 0;
    const totalCost = (sale.peso_real_saida || 0) * costKg;
    const operationalCost = (sale.custo_extras_total || 0);
    return { revenue, cgs: totalCost, operationalCost, netProfit: revenue - totalCost - operationalCost };
  };

  const confirmPartialPayment = () => {
    if (!saleToPay || !partialPaymentAmount) return;
    const valor = parseFloat(partialPaymentAmount.replace(',', '.'));
    const desconto = parseFloat(discountAmount.replace(',', '.')) || 0;
    const { saldoDevedor } = getSaleBalance(saleToPay);

    // Value + discount can't exceed balance
    if (isNaN(valor) || valor <= 0 || (valor + desconto) > saldoDevedor + 0.01) return alert("⚠️ Valor inválido!");

    // Apply payment PLUS discount to the account
    addPartialPayment(saleToPay.id_venda, valor + desconto, receiveMethod, receiveDate);

    // ✅ CRIAR TRANSAÇÃO DE ENTRADA NO FLUXO DE CAIXA (o dinheiro que entrou de verdade)
    if (valor > 0) {
      addTransaction({
        id: `TR-REC-${saleToPay.id_venda}-${Date.now()}`,
        data: receiveDate,
        descricao: `Recebimento: ${saleToPay.nome_cliente || 'Cliente'} - ${saleToPay.id_completo}`,
        tipo: 'ENTRADA',
        categoria: 'VENDA',
        valor: valor,
        metodo_pagamento: receiveMethod,
        referencia_id: saleToPay.id_venda
      });
    }

    // Log discount if applied (desconto é saída - abate do valor a receber)
    if (desconto > 0 && discountReason) {
      addTransaction({
        id: `TR-DESC-${saleToPay.id_venda}-${Date.now()}`,
        data: receiveDate,
        descricao: `DESCONTO: ${discountReason}`,
        tipo: 'SAIDA',
        categoria: 'DESCONTO',
        valor: desconto,
        metodo_pagamento: receiveMethod,
        referencia_id: saleToPay.id_venda
      });
    }

    setSaleToPay(null);
    setPartialPaymentAmount('');
    setDiscountAmount('0');
    setDiscountReason('');
  };

  const confirmPayablePayment = () => {
    if (!payableToPay || !payableAmountStr) return;
    const valor = parseFloat(payableAmountStr.replace(',', '.'));
    const restante = payableToPay.valor - (payableToPay.valor_pago || 0);
    if (isNaN(valor) || valor <= 0 || valor > restante + 0.01) return alert("⚠️ Valor inválido!");
    addTransaction({
      id: `TR-PAY-${payableToPay.id}-${Date.now()}`, data: receiveDate,
      descricao: `Pagamento: ${payableToPay.descricao}`, tipo: 'SAIDA',
      categoria: payableToPay.categoria, valor: valor, metodo_pagamento: receiveMethod,
      referencia_id: payableToPay.id
    });
    const novoPago = (payableToPay.valor_pago || 0) + valor;
    updatePayable({ ...payableToPay, valor_pago: novoPago, status: novoPago >= (payableToPay.valor - 0.01) ? 'PAGO' : 'PARCIAL', data_pagamento: new Date().toISOString().split('T')[0] });
    setPayableToPay(null); setPayableAmountStr('');
  };

  const handleSaveTransaction = () => {
    if (!newTransaction.descricao || !newTransaction.valor) return alert("Preencha todos os campos.");
    addTransaction({
      id: `TR-${Date.now()}`, descricao: newTransaction.descricao, valor: Number(newTransaction.valor),
      tipo: newTransaction.tipo as 'ENTRADA' | 'SAIDA', categoria: newTransaction.categoria as any,
      data: newTransaction.data as string, metodo_pagamento: 'DINHEIRO', referencia_id: ''
    });
    setShowTransactionForm(false);
  };

  // CORREÇÃO: Primeiro declarar validLoteIds e validTransactions

  // CORREÇÃO: Filtrar apenas lotes FECHADOS (cadastros completos) - excluir ESTORNADOS
  const closedBatches = useMemo(() => batches.filter(b => b.status === 'FECHADO'), [batches]);
  const validLoteIds = useMemo(() => new Set(closedBatches.map(b => b.id_lote)), [closedBatches]);
  const hasValidBatches = closedBatches.length > 0;
  const validTransactions = useMemo(() =>
    transactions.filter(t => {
      // CORREÇÃO AUDITORIA #8: Transações sem referência a lote SEMPRE exibidas,
      // mesmo quando não existem lotes fechados.
      if (!t.referencia_id) return true;
      // Transações de lote = verificar se lote existe
      if (validLoteIds.has(t.referencia_id)) return true;
      // Transações de RECEBIMENTO de vendas (ex: TR-REC-V-xxx) = sempre válidas
      if (t.id?.startsWith('TR-REC-') || t.id?.startsWith('TR-PAY-') || t.categoria === 'VENDA') return true;
      // Transações de ESTORNO = sempre válidas
      if (t.id?.startsWith('TR-ESTORNO-') || t.categoria === 'ESTORNO') return true;
      // Transações de DESCONTO = sempre válidas
      if (t.id?.startsWith('TR-DESC-') || t.categoria === 'DESCONTO') return true;
      // Outros casos: se não tem hífen no referencia_id = válido
      if (!t.referencia_id.includes('-')) return true;
      // Se tem lotes válidos, filtrar transações de lotes inexistentes
      if (hasValidBatches) return false;
      // Se NÃO há lotes, manter tudo (não esconder transações)
      return true;
    }),
    [transactions, validLoteIds, hasValidBatches]
  );

  const filteredTransactions = useMemo(() =>
    validTransactions.filter(t => t.data >= filterStartDate && t.data <= filterEndDate).sort((a, b) => b.data.localeCompare(a.data)),
    [validTransactions, filterStartDate, filterEndDate]
  );

  const totalBalanceGlobal = validTransactions.reduce((acc, t) => acc + (t.tipo === 'ENTRADA' ? t.valor : -t.valor), 0);

  // CORREÇÃO: Filtrar apenas sales de lotes válidos (verifica se o id_completo corresponde a um lote existente)
  const pendingSales = useMemo(() => {
    const validSales = sales.filter(s => {
      const loteFromSale = s.id_completo.split('-')[0] + '-' + s.id_completo.split('-')[1] + '-' + s.id_completo.split('-')[2];
      return validLoteIds.has(loteFromSale);
    });
    // Filtrar vendas ESTORNADAS da lista de contas a receber
    return validSales.filter(s => s.status_pagamento !== 'ESTORNADO' && getSaleBalance(s).saldoDevedor > 0.01).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [sales, validLoteIds]);

  const totalReceivable = useMemo(() => pendingSales.reduce((acc, s) => acc + getSaleBalance(s).saldoDevedor, 0), [pendingSales]);

  const today = new Date().toISOString().split('T')[0];
  const overdueSales = pendingSales.filter(s => s.data_vencimento < today);
  const criticalDateStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const criticalSales = pendingSales.filter(s => s.data_vencimento < criticalDateStr);
  const criticalDefaulters = Array.from(new Set(criticalSales.map(s => s.nome_cliente || 'Desconhecido')));

  const inventoryValue = useMemo(() =>
    stock.filter(item => item.status === 'DISPONIVEL').reduce((acc, item) => {
      const batch = closedBatches.find(b => b.id_lote === item.id_lote);
      const costKg = batch ? (Number(batch.custo_real_kg) || 0) : 0;
      return acc + (item.peso_entrada * costKg);
    }, 0),
    [stock, closedBatches]
  );

  const totalPayable = useMemo(() => {
    if (!hasValidBatches) return 0; // SE NÃO HÁ LOTES FECHADOS, RETORNA ZERO

    // SIMPLIFICADO: Usa APENAS os payables para calcular Total a Pagar
    // Isso evita duplicação, já que lotes a prazo criam payables automaticamente
    return payables
      .filter(p => {
        // Excluir ESTORNADOS e CANCELADOS
        if (p.status === 'ESTORNADO' || p.status === 'CANCELADO') return false;
        // Se tem id_lote, verifica se é de um lote válido (fechado)
        if (p.id_lote) return validLoteIds.has(p.id_lote);
        // Se é COMPRA_GADO, extrai id_lote da descrição
        if (p.categoria === 'COMPRA_GADO' && p.descricao) {
          const match = p.descricao.match(/Lote ([A-Z0-9]+-\d{4}-\d+)/);
          if (match) return validLoteIds.has(match[1]);
          return false; // Payable de lote mas lote não existe = ignorar
        }
        // Payable manual (operacional, etc) = incluir
        return true;
      })
      .reduce((acc, p) => acc + (p.valor - (p.valor_pago || 0)), 0);
  }, [payables, validLoteIds, hasValidBatches]);

  const profitTotals = useMemo(() => {
    // CORREÇÃO: Usar apenas sales de lotes válidos e excluir ESTORNADOS
    const validSales = sales.filter(s => {
      if (s.status_pagamento === 'ESTORNADO') return false;
      const loteFromSale = s.id_completo.split('-')[0] + '-' + s.id_completo.split('-')[1] + '-' + s.id_completo.split('-')[2];
      return validLoteIds.has(loteFromSale);
    });

    return validSales.reduce((acc, sale) => {
      const details = getSaleDetails(sale);
      return {
        revenue: acc.revenue + details.revenue,
        cgs: acc.cgs + details.cgs,
        ops: acc.ops + details.operationalCost,
        profit: acc.profit + details.netProfit
      };
    }, { revenue: 0, cgs: 0, ops: 0, profit: 0 });
  }, [sales, stock, closedBatches, validLoteIds]);



  // CLIENT RANKING (CURVA ABC)
  const clientRanking = useMemo(() => {
    const clientStats = new Map<string, { revenue: number, profit: number, volume: number }>();

    sales.filter(s => s.status_pagamento !== 'ESTORNADO').forEach(sale => {
      const details = getSaleDetails(sale);
      const name = sale.nome_cliente || 'Direto';
      if (!clientStats.has(name)) clientStats.set(name, { revenue: 0, profit: 0, volume: 0 });
      const current = clientStats.get(name)!;
      current.revenue += details.revenue;
      current.profit += details.netProfit;
      current.volume += sale.peso_real_saida;
    });

    return Array.from(clientStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales, stock, batches]);

  // INDUSTRIAL ANALYTICS CALCULATIONS
  const industrialAnalytics = useMemo(() => {
    const activeSales = sales.filter(s => s.status_pagamento !== 'ESTORNADO');
    const totalRevenue = activeSales.reduce((acc, s) => acc + (s.peso_real_saida * s.preco_venda_kg), 0);
    const totalPaid = activeSales.reduce((acc, s) => acc + ((s as any).valor_pago || 0), 0);
    const efficacy = totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 100;

    const cgs = profitTotals.cgs;
    const inv = inventoryValue;
    const turnover = inv > 0 ? (cgs / inv) : 0;

    return { efficacy, turnover };
  }, [sales, profitTotals, inventoryValue]);

  return (
    <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20 font-sans">

      {/* PREMIUM HEADER - FINANCIAL EDITION */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex flex-col gap-4">
          <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-700 hover:border-blue-100 transition-all shadow-sm">
            <ArrowLeft size={14} /> Voltar ao Início
          </button>
          <div className="flex items-center gap-5">
            <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-xl shadow-slate-200">
              <Landmark size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                Controladoria <span className="text-blue-600">Finanças</span>
              </h1>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                Fluxo de Caixa & Resultados / ID-FIN
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
            {(['overview', 'cashflow', 'receivables', 'payables', 'suppliers', 'profit'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                {tab === 'overview' ? 'Visão Geral' : tab === 'cashflow' ? 'Fluxo Caixa' : tab === 'receivables' ? 'A Receber' : tab === 'payables' ? 'A Pagar' : tab === 'suppliers' ? 'Fornecedores' : 'DRE'}
              </button>
            ))}
          </div>

          {/* Botão Limpar Dados Antigos */}
          {/* Botão Limpar Dados removido por segurança */}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="max-w-7xl mx-auto space-y-8 animate-reveal">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Saldo em Caixa', value: formatCurrency(totalBalanceGlobal), icon: Wallet, color: 'blue' },
              { label: 'Contas a Receber', value: formatCurrency(totalReceivable), icon: TrendingUp, color: 'emerald' },
              { label: 'Valor em Estoque', value: formatCurrency(inventoryValue), icon: Beef, color: 'amber' },
              { label: 'Total a Pagar', value: formatCurrency(totalPayable), icon: TrendingDown, color: 'rose' }
            ].map((kpi, idx) => (
              <div key={idx} className="premium-card p-8 flex flex-col gap-5 group hover:-translate-y-1 transition-all">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${kpi.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                  kpi.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    kpi.color === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                  <kpi.icon size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{kpi.label}</p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{kpi.value}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* RESUMO PATRIMÔNIO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="premium-card p-8 bg-emerald-50 border-emerald-100 group hover:-translate-y-1 transition-all">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Ativos</p>
              <p className="text-3xl font-black text-emerald-700 tracking-tight">+{formatCurrency(totalBalanceGlobal + totalReceivable + inventoryValue)}</p>
              <p className="text-[9px] font-bold text-emerald-500 mt-2">Caixa + A Receber + Estoque</p>
            </div>
            <div className="premium-card p-8 bg-rose-50 border-rose-100 group hover:-translate-y-1 transition-all">
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Total Passivos</p>
              <p className="text-3xl font-black text-rose-700 tracking-tight">-{formatCurrency(totalPayable)}</p>
              <p className="text-[9px] font-bold text-rose-500 mt-2">Contas a Pagar</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="premium-card p-10 bg-white">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                  <Medal size={16} className="text-amber-500" /> Top 5 Clientes (Curva ABC)
                </h4>
                <div className="px-3 py-1 bg-amber-50 rounded-full text-[9px] font-black text-amber-600 uppercase">Faturamento</div>
              </div>
              <div className="space-y-6">
                {clientRanking.slice(0, 5).map((client, idx) => (
                  <div key={idx} className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                        {idx === 0 ? <Crown size={16} /> : idx + 1}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-800 uppercase italic">"{client.name}"</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formatWeight(client.volume)} movimentados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{formatCurrency(client.revenue)}</p>
                      <p className="text-[9px] font-bold text-emerald-600 uppercase">+ {formatCurrency(client.profit)} lucro</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-card p-10 bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                  <Navigation size={16} className="text-blue-600" /> Industrial Analytics
                </h4>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-slate-200" />
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Eficácia de Recebimento</p>
                      <span className="text-xs font-black text-blue-600">{industrialAnalytics.efficacy.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${Math.min(100, industrialAnalytics.efficacy)}%` }} />
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-emerald-200 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Giro de Ativo (Estoque)</p>
                      <span className="text-xs font-black text-emerald-600">{industrialAnalytics.turnover.toFixed(1)}x / ciclo</span>
                    </div>
                    <div className="h-1.5 w-full bg-white rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, industrialAnalytics.turnover * 10)}%` }} />
                    </div>
                  </div>
                </div>


              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cashflow' && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-reveal">
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl shadow-blue-900/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Saldo Atualizado</p>
              </div>
              <h3 className={`text-5xl font-black tracking-tighter mb-12 ${totalBalanceGlobal >= 0 ? 'text-white' : 'text-rose-400'}`}>
                {formatCurrency(totalBalanceGlobal)}
              </h3>
              <div className="space-y-4">
                <button onClick={() => { setShowTransactionForm(true); setNewTransaction({ ...newTransaction, tipo: 'ENTRADA' }); }} className="w-full btn-modern bg-blue-600 hover:bg-white hover:text-blue-700 text-white py-5 rounded-2xl gap-4 shadow-xl transition-all font-black text-xs uppercase tracking-widest">
                  <PlusIcon size={20} /> Lançar Entrada
                </button>
                <button onClick={() => { setShowTransactionForm(true); setNewTransaction({ ...newTransaction, tipo: 'SAIDA' }); }} className="w-full btn-modern bg-white/5 border border-white/10 hover:bg-rose-600 text-white py-5 rounded-2xl gap-4 transition-all font-black text-xs uppercase tracking-widest">
                  <MinusIcon size={20} /> Lançar Saída
                </button>
              </div>
            </div>

            <div className="premium-card p-10 bg-white">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                <Filter size={16} className="text-blue-600" /> Parâmetros de Filtro
              </h4>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Período Inicial</label>
                  <input type="date" className="modern-input h-14" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Período Final</label>
                  <input type="date" className="modern-input h-14" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="premium-card overflow-hidden">
              <div className="p-8 bg-slate-50/50 border-b border-slate-50 flex flex-wrap justify-between items-center gap-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buffer de Movimentações</h4>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-1.5 bg-white rounded-full border border-slate-100 text-[10px] font-black text-slate-900 shadow-sm">
                    {filteredTransactions.length} Registros
                  </div>
                  <button
                    onClick={() => {
                      const doc = new jsPDF();
                      const pw = doc.internal.pageSize.width;
                      // ═══ LOGO THIAGO 704 ═══
                      doc.setFillColor(15, 23, 42);
                      doc.rect(15, 10, pw - 30, 28, 'F');
                      doc.setFont('courier', 'bold');
                      doc.setFontSize(28);
                      doc.setTextColor(255, 255, 255);
                      doc.text('THIAGO', 22, 28);
                      doc.setFontSize(32);
                      doc.setTextColor(59, 130, 246);
                      doc.text('704', 68, 32);
                      // Linha decorativa azul
                      doc.setFillColor(59, 130, 246);
                      doc.rect(15, 38, pw - 30, 2, 'F');
                      // Título
                      doc.setFont('helvetica', 'bold');
                      doc.setFontSize(14);
                      doc.setTextColor(15, 23, 42);
                      doc.text('FLUXO DE CAIXA', pw / 2, 50, { align: 'center' });
                      doc.setFontSize(10);
                      doc.setTextColor(100, 116, 139);
                      doc.text(`Período: ${filterStartDate}  a  ${filterEndDate}`, pw / 2, 58, { align: 'center' });
                      doc.text(`Gerado: ${new Date().toLocaleString('pt-BR')}`, pw / 2, 65, { align: 'center' });
                      doc.setDrawColor(200, 200, 200);
                      doc.line(15, 70, pw - 15, 70);
                      // ═══ RESUMO ═══
                      const totalEntradas = filteredTransactions.filter(t => t.tipo === 'ENTRADA').reduce((a, t) => a + t.valor, 0);
                      const totalSaidas = filteredTransactions.filter(t => t.tipo === 'SAIDA').reduce((a, t) => a + t.valor, 0);
                      const saldo = totalEntradas - totalSaidas;
                      doc.setFont('helvetica', 'bold');
                      doc.setFontSize(11);
                      doc.setTextColor(16, 185, 129);
                      doc.text(`ENTRADAS:  R$ ${totalEntradas.toFixed(2)}`, 18, 80);
                      doc.setTextColor(239, 68, 68);
                      doc.text(`SAÍDAS:  R$ ${totalSaidas.toFixed(2)}`, 85, 80);
                      doc.setTextColor(15, 23, 42);
                      doc.text(`SALDO:  R$ ${saldo.toFixed(2)}`, 148, 80);
                      doc.setDrawColor(200, 200, 200);
                      doc.line(15, 86, pw - 15, 86);
                      // ═══ TABELA ═══
                      let y = 96;
                      doc.setFillColor(235, 240, 245);
                      doc.rect(15, y - 6, pw - 30, 10, 'F');
                      doc.setFontSize(9);
                      doc.setFont('helvetica', 'bold');
                      doc.setTextColor(15, 23, 42);
                      doc.text('DATA', 18, y);
                      doc.text('DESCRIÇÃO', 48, y);
                      doc.text('CATEGORIA', 125, y);
                      doc.text('VALOR', pw - 18, y, { align: 'right' });
                      y += 10;
                      doc.setFontSize(10);
                      filteredTransactions.forEach(t => {
                        if (y > 270) { doc.addPage(); y = 25; }
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(80, 80, 80);
                        doc.text(new Date(t.data).toLocaleDateString('pt-BR'), 18, y);
                        doc.setTextColor(15, 23, 42);
                        doc.text((t.descricao || '').substring(0, 38), 48, y);
                        doc.setFontSize(8);
                        doc.setTextColor(100, 116, 139);
                        doc.text(t.categoria || '', 125, y);
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'bold');
                        if (t.tipo === 'ENTRADA') doc.setTextColor(16, 185, 129);
                        else doc.setTextColor(239, 68, 68);
                        doc.text(`${t.tipo === 'ENTRADA' ? '+' : '-'} R$ ${t.valor.toFixed(2)}`, pw - 18, y, { align: 'right' });
                        y += 8;
                      });
                      // ═══ RODAPÉ ═══
                      y += 8;
                      doc.setFillColor(15, 23, 42);
                      doc.rect(15, y, pw - 30, 12, 'F');
                      doc.setFont('courier', 'bold');
                      doc.setFontSize(8);
                      doc.setTextColor(255, 255, 255);
                      doc.text('THIAGO 704  //  FRIGOGEST PRO X  //  DOCUMENTO OFICIAL', pw / 2, y + 8, { align: 'center' });
                      doc.save(`FLUXO_CAIXA_${filterStartDate}_${filterEndDate}.pdf`);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm"
                  >
                    <Printer size={14} /> Exportar PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="technical-table">
                  <thead>
                    <tr>
                      <th className="w-24">Data</th>
                      <th>Histórico Operacional</th>
                      <th>Vínculo / Categoria</th>
                      <th className="text-right">Valor Líquido</th>
                      <th className="w-16 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900">{new Date(t.data).toLocaleDateString()}</td>
                        <td className="font-extrabold text-slate-900 uppercase text-xs truncate max-w-sm italic">"{t.descricao}"</td>
                        <td>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${t.categoria === 'ESTORNO' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            {t.categoria}
                          </span>
                        </td>
                        <td className={`text-right font-black text-sm ${t.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.tipo === 'ENTRADA' ? '+' : '-'} {formatCurrency(t.valor)}
                        </td>
                        <td className="text-center">
                          {t.categoria !== 'ESTORNO' && !t.id?.startsWith('TR-ESTORNO-') && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Estornar transação?\n\n"${t.descricao}"\nValor: ${formatCurrency(t.valor)}\n\nUma transação inversa será criada.`)) {
                                  deleteTransaction(t.id);
                                }
                              }}
                              className="w-8 h-8 bg-slate-50 text-slate-300 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                              title="Estornar transação"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-32 text-center">
                          <Zap size={64} className="mx-auto mb-6 text-slate-100" />
                          <p className="font-black text-[10px] uppercase text-slate-300 tracking-[0.4em]">Nenhum registro no período</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'receivables' && (
        <div className="max-w-7xl mx-auto space-y-10 animate-reveal">
          {criticalDefaulters.length > 0 && (
            <div className="bg-rose-600 rounded-[40px] text-white p-10 flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-rose-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck size={160} />
              </div>
              <div className="flex items-center gap-8 relative z-10">
                <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-lg">
                  <AlertCircle size={40} />
                </div>
                <div>
                  <h4 className="text-3xl font-black tracking-tight uppercase leading-none italic mb-2">Protocolo de Inadimplência</h4>
                  <p className="text-xs font-bold opacity-80 uppercase tracking-widest max-w-sm">Detectamos pendências críticas com mais de 30 dias de atraso nas transações.</p>
                </div>
              </div>
              <button
                onClick={() => setReceivablesFilter('CRITICAL')}
                className="btn-modern bg-white text-rose-600 px-10 py-5 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-xl font-black text-xs uppercase tracking-widest mt-6 md:mt-0 relative z-10"
              >
                Auditar Inadimplentes
              </button>
            </div>
          )}

          <div className="premium-card overflow-hidden bg-white shadow-xl">
            <div className="p-8 bg-slate-50/50 border-b border-slate-50 flex flex-wrap gap-6 items-center">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-auto flex items-center gap-2">
                <HistoryIcon size={16} className="text-blue-600" /> Fila de Compensação
              </h4>
              <div className="flex p-1.5 bg-white rounded-2xl border border-slate-100 shadow-inner">
                <button onClick={() => setReceivablesFilter('ALL')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${receivablesFilter === 'ALL' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Todos</button>
                <button onClick={() => setReceivablesFilter('OVERDUE')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${receivablesFilter === 'OVERDUE' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Vencidos</button>
                <button onClick={() => setReceivablesFilter('CRITICAL')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${receivablesFilter === 'CRITICAL' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>Críticos</button>
              </div>
            </div>
            {/* FILTROS AVANÇADOS - A RECEBER */}
            <div className="px-8 py-4 bg-white border-b border-slate-50 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Filtrar Cliente</label>
                <select value={receivableClientFilter} onChange={e => setReceivableClientFilter(e.target.value)} className="modern-input h-10 py-0 text-xs font-bold">
                  <option value="">TODOS</option>
                  {Array.from(new Set(pendingSales.map(s => s.nome_cliente || 'Desconhecido'))).sort().map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Filtrar Lote</label>
                <select value={receivableLoteFilter} onChange={e => setReceivableLoteFilter(e.target.value)} className="modern-input h-10 py-0 text-xs font-bold">
                  <option value="">TODOS</option>
                  {Array.from(new Set(pendingSales.map(s => s.id_completo.split('-').slice(0, 3).join('-')))).sort().map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Início</label>
                <input type="date" value={receivableDateStart} onChange={e => setReceivableDateStart(e.target.value)} className="modern-input h-10 py-0 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Fim</label>
                <input type="date" value={receivableDateEnd} onChange={e => setReceivableDateEnd(e.target.value)} className="modern-input h-10 py-0 text-xs" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="technical-table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Status de Risco</th>
                    <th>Entidade / Destino</th>
                    <th className="text-right">Saldo Devedor</th>
                    <th className="w-56 text-center">Operações</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSales.filter(s => {
                    if (receivableClientFilter && s.nome_cliente !== receivableClientFilter) return false;
                    if (receivableLoteFilter && !s.id_completo.includes(receivableLoteFilter)) return false;
                    if (receivableDateStart && s.data_vencimento < receivableDateStart) return false;
                    if (receivableDateEnd && s.data_vencimento > receivableDateEnd) return false;
                    const isOverdue = s.data_vencimento < today;
                    if (receivablesFilter === 'OVERDUE') return isOverdue;
                    if (receivablesFilter === 'CRITICAL') return s.data_vencimento < criticalDateStr;
                    return true;
                  }).sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento)).map(sale => {
                    const { saldoDevedor } = getSaleBalance(sale);
                    const isOverdue = sale.data_vencimento < today;
                    const diffDays = Math.ceil(Math.abs(new Date(today).getTime() - new Date(sale.data_vencimento).getTime()) / 86400000);
                    return (
                      <tr key={sale.id_venda} className={`hover:bg-slate-50 transition-colors group ${isOverdue ? "bg-rose-50/10" : ""}`}>
                        <td>
                          <span className={`text-[11px] font-extrabold ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`}>{new Date(sale.data_vencimento).toLocaleDateString()}</span>
                        </td>
                        <td>
                          <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex border ${isOverdue ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                            {isOverdue ? `${diffDays} DIAS DE ATRASO` : 'DENTRO DO PRAZO'}
                          </div>
                        </td>
                        <td>
                          <p className="font-extrabold text-slate-900 uppercase text-xs italic">"{sale.nome_cliente || 'Mercado Geral'}"</p>
                          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Comp: {sale.id_completo}</span>
                        </td>
                        <td className="text-right">
                          <span className="text-lg font-black text-slate-900 tracking-tight">{formatCurrency(saldoDevedor)}</span>
                        </td>
                        <td className="text-center">
                          <button onClick={() => setSaleToPay(sale)} className="btn-modern bg-slate-900 text-white py-2.5 px-6 rounded-xl text-[9px] uppercase font-black tracking-widest hover:bg-emerald-600 gap-2 shadow-lg group-hover:scale-105 transition-all">
                            <Wallet size={14} /> Efetuar Baixa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pendingSales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-32 text-center opacity-20">
                        <CheckCircle size={80} className="mx-auto mb-6" />
                        <p className="font-black text-xs uppercase tracking-[0.6em]">Nenhuma pendência ativa</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payables' && (
        <div className="max-w-7xl mx-auto space-y-10 animate-reveal">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              {(['ALL', 'PENDING', 'LATE', 'PAID'] as const).map(tab => (
                <button key={tab} onClick={() => setPayableFilterStatus(tab)} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${payableFilterStatus === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                  {tab === 'ALL' ? 'Tudo' : tab === 'PENDING' ? 'Em Aberto' : tab === 'LATE' ? 'Críticas' : 'Liquidadas'}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPayableForm(true)} className="btn-modern bg-blue-600 text-white hover:bg-slate-900 px-8 py-4 rounded-2xl gap-3 shadow-xl shadow-blue-900/10 font-black text-xs uppercase tracking-widest">
              <PlusIcon size={20} /> Nova Obrigação
            </button>
          </div>

          <div className="premium-card overflow-hidden shadow-xl">
            {/* FILTROS AVANÇADOS - A PAGAR */}
            <div className="px-8 py-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Filtrar Lote</label>
                <select value={payableLoteFilter} onChange={e => setPayableLoteFilter(e.target.value)} className="modern-input h-10 py-0 text-xs font-bold">
                  <option value="">TODOS</option>
                  {Array.from(new Set(payables.map(p => p.id_lote).filter(Boolean) as string[])).sort().map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Filtrar Fornecedor</label>
                <select value={payableSupplierFilter} onChange={e => setPayableSupplierFilter(e.target.value)} className="modern-input h-10 py-0 text-xs font-bold">
                  <option value="">TODOS</option>
                  {Array.from(new Set(payables.map(p => { const parts = p.descricao.split(' - '); return parts.length > 1 ? parts[parts.length - 1] : null; }).filter(Boolean) as string[])).sort().map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Início</label>
                <input type="date" value={payableDateStart} onChange={e => setPayableDateStart(e.target.value)} className="modern-input h-10 py-0 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Fim</label>
                <input type="date" value={payableDateEnd} onChange={e => setPayableDateEnd(e.target.value)} className="modern-input h-10 py-0 text-xs" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="technical-table">
                <thead>
                  <tr>
                    <th className="w-20 text-center">STS</th>
                    <th>Vencimento</th>
                    <th>Entidade / Descrição do Passivo</th>
                    <th className="text-right">Saldo Remanescente</th>
                    <th className="w-40 text-center">Buffer Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.filter(p => {
                    if (p.status === 'ESTORNADO' || p.status === 'CANCELADO') return false;
                    if (payableLoteFilter && p.id_lote !== payableLoteFilter && !(p.descricao && p.descricao.includes(payableLoteFilter))) return false;
                    if (payableSupplierFilter && !(p.descricao && p.descricao.includes(payableSupplierFilter))) return false;
                    if (payableDateStart && p.data_vencimento < payableDateStart) return false;
                    if (payableDateEnd && p.data_vencimento > payableDateEnd) return false;
                    if (payableFilterStatus === 'ALL') return true;
                    if (payableFilterStatus === 'LATE') return p.status !== 'PAGO' && p.data_vencimento < today;
                    if (payableFilterStatus === 'PENDING') return p.status !== 'PAGO';
                    return p.status === 'PAGO';
                  }).sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento)).map(p => {
                    const isLate = p.status !== 'PAGO' && p.data_vencimento < today;
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${isLate ? "bg-rose-50/10" : ""}`}>
                        <td className="text-center">
                          <div className={`w-3.5 h-3.5 rounded-full mx-auto transition-all ${p.status === 'PAGO' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : isLate ? 'animate-pulse bg-rose-600 shadow-[0_0_12px_rgba(225,29,72,0.5)]' : 'bg-slate-200 shadow-inner'}`} />
                        </td>
                        <td className="text-[11px] font-extrabold text-slate-400 group-hover:text-slate-900">{new Date(p.data_vencimento).toLocaleDateString()}</td>
                        <td>
                          <p className="font-extrabold text-slate-800 uppercase text-xs italic transition-all group-hover:translate-x-1">"{p.descricao}"</p>
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md mt-1 inline-block border border-slate-100">{p.categoria}</span>
                        </td>
                        <td className="text-right">
                          <span className="text-lg font-black text-slate-900 tracking-tight">{formatCurrency(p.valor - (p.valor_pago || 0))}</span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-3">
                            {p.status !== 'PAGO' && (
                              <button onClick={() => { setPayableToPay(p); setPayableAmountStr((p.valor - (p.valor_pago || 0)).toFixed(2).replace('.', ',')); }} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm">
                                <DollarSign size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (window.confirm(`Estornar conta a pagar?\n\n"${p.descricao}"\nValor: ${formatCurrency(p.valor)}\n${p.valor_pago && p.valor_pago > 0 ? `Já pago: ${formatCurrency(p.valor_pago)} — será devolvido ao caixa` : 'Nenhum pagamento realizado — será cancelada'}`)) {
                                  deletePayable(p.id);
                                }
                              }}
                              className="w-10 h-10 bg-slate-50 text-slate-300 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all flex items-center justify-center"
                              title="Estornar conta"
                            >
                              <RotateCcw size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profit' && (
        <div className="max-w-7xl mx-auto space-y-10 animate-reveal">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { label: 'Receita Bruta Acumulada', value: profitTotals.revenue, color: 'blue', icon: TrendingUp },
              { label: 'Custo Logístico (CGS)', value: profitTotals.cgs, color: 'rose', icon: Truck },
              { label: 'Fator Extras / Operacional', value: profitTotals.ops, color: 'orange', icon: ShoppingBag },
              { label: 'Lucro Líquido Sincronizado', value: profitTotals.profit, color: 'emerald', large: true, icon: Zap }
            ].map((kpi, idx) => (
              <div key={idx} className={`premium-card p-10 flex flex-col justify-center gap-6 relative overflow-hidden group transition-all hover:-translate-y-2 ${kpi.large ? 'bg-slate-900 text-white shadow-2xl shadow-blue-900/30' : 'bg-white'}`}>
                {kpi.large && <div className="absolute top-[-10%] right-[-10%] opacity-10 pointer-events-none transform rotate-12"><kpi.icon size={160} /></div>}
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 ${kpi.large ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors'}`}>
                  <kpi.icon size={22} />
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${kpi.large ? 'text-blue-400' : 'text-slate-400'} mb-2`}>{kpi.label}</p>
                  <h3 className={`text-4xl font-black tracking-tight ${kpi.large ? 'text-blue-100' : 'text-slate-900'}`}>{formatCurrency(kpi.value)}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="premium-card p-24 bg-white flex flex-col items-center justify-center border-dashed border-2 border-slate-100 relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-50/10 pointer-events-none" />
            <div className="relative z-10 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner animate-pulse">
                <PieChart size={48} className="text-slate-200" />
              </div>
              <h4 className="font-black text-xs uppercase tracking-[0.8em] text-slate-300">Visualização de Gráficos Analíticos</h4>
              <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest mt-4">Processando Motor de Inteligência BI...</p>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIERS TAB - PAGAMENTOS A FORNECEDORES */}
      {activeTab === 'suppliers' && (() => {
        // Agrupar pagamentos por fornecedor usando payables + transações
        const supplierPayments = new Map<string, Array<{ descricao: string, lote: string, valor: number, valorPago: number, dataPagamento: string, dataVencimento: string, status: string }>>();

        payables.filter(p => p.categoria === 'COMPRA_GADO' && p.status !== 'ESTORNADO' && p.status !== 'CANCELADO').forEach(p => {
          let fornecedor = p.fornecedor_id || '';
          if (!fornecedor && p.descricao) {
            const parts = p.descricao.split(' - ');
            if (parts.length > 1) fornecedor = parts[parts.length - 1].trim();
          }
          if (!fornecedor) fornecedor = 'Não Identificado';

          if (!supplierPayments.has(fornecedor)) supplierPayments.set(fornecedor, []);
          supplierPayments.get(fornecedor)!.push({
            descricao: p.descricao,
            lote: p.id_lote || (p.descricao.match(/LOTE-[A-Z0-9]+-\d+/) || [''])[0] || '-',
            valor: p.valor,
            valorPago: p.valor_pago || 0,
            dataPagamento: p.data_pagamento || '-',
            dataVencimento: p.data_vencimento,
            status: p.status
          });
        });

        // Também incluir transações diretas (VISTA)
        transactions.filter(t => t.tipo === 'SAIDA' && t.categoria === 'COMPRA_GADO' && !t.id.startsWith('TR-PAY-') && !t.id.startsWith('TR-ESTORNO-')).forEach(t => {
          let fornecedor = '';
          if (t.descricao) {
            const parts = t.descricao.split(' - ');
            if (parts.length > 1) fornecedor = parts[parts.length - 1].trim();
          }
          if (!fornecedor) fornecedor = 'Não Identificado';
          const loteMatch = t.descricao?.match(/LOTE-[A-Z0-9]+-\d+/) || t.referencia_id?.match(/LOTE-[A-Z0-9]+-\d+/);

          if (!supplierPayments.has(fornecedor)) supplierPayments.set(fornecedor, []);
          supplierPayments.get(fornecedor)!.push({
            descricao: t.descricao || '',
            lote: loteMatch ? loteMatch[0] : t.referencia_id || '-',
            valor: t.valor,
            valorPago: t.valor,
            dataPagamento: t.data,
            dataVencimento: t.data,
            status: 'PAGO'
          });
        });

        const sortedSuppliers = Array.from(supplierPayments.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const allSupplierNames = sortedSuppliers.map(([name]) => name);
        const allLotes = Array.from(new Set(sortedSuppliers.flatMap(([, items]) => items.map(i => i.lote)).filter(l => l && l !== '-'))).sort();
        const filteredSuppliers = (supplierFilter === 'ALL' ? sortedSuppliers : sortedSuppliers.filter(([name]) => name === supplierFilter))
          .map(([name, items]) => [name, supplierLoteFilter === 'ALL' ? items : items.filter(i => i.lote === supplierLoteFilter)] as [string, typeof items])
          .filter(([, items]) => items.length > 0);
        const grandTotal = filteredSuppliers.reduce((sum, [, items]) => sum + items.reduce((s, i) => s + i.valor, 0), 0);
        const grandTotalPago = filteredSuppliers.reduce((sum, [, items]) => sum + items.reduce((s, i) => s + i.valorPago, 0), 0);

        return (
          <div className="max-w-7xl mx-auto space-y-4 animate-reveal">
            {/* KPIs compactos */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* FILTRO DE FORNECEDOR */}
              <div className="bg-white rounded-xl border border-slate-100 px-3 py-1.5 shadow-sm flex items-center gap-2">
                <Filter size={12} className="text-blue-500" />
                <select
                  className="text-[10px] font-black text-slate-700 uppercase bg-transparent outline-none cursor-pointer pr-4"
                  value={supplierFilter}
                  onChange={e => setSupplierFilter(e.target.value)}
                >
                  <option value="ALL">TODOS FORNECEDORES</option>
                  {allSupplierNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              {/* FILTRO DE LOTE */}
              <div className="bg-white rounded-xl border border-slate-100 px-3 py-1.5 shadow-sm flex items-center gap-2">
                <Tag size={12} className="text-blue-500" />
                <select
                  className="text-[10px] font-black text-slate-700 uppercase bg-transparent outline-none cursor-pointer pr-4"
                  value={supplierLoteFilter}
                  onChange={e => setSupplierLoteFilter(e.target.value)}
                >
                  <option value="ALL">TODOS LOTES</option>
                  {allLotes.map(lote => (
                    <option key={lote} value={lote}>{lote}</option>
                  ))}
                </select>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-2 shadow-sm flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fornecedores</span>
                <span className="text-lg font-black text-slate-900">{filteredSuppliers.length}</span>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-2 shadow-sm flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total</span>
                <span className="text-lg font-black text-slate-900">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-2 shadow-sm flex items-center gap-3">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Pago</span>
                <span className="text-lg font-black text-emerald-600">{formatCurrency(grandTotalPago)}</span>
              </div>
              {grandTotal - grandTotalPago > 0.01 && (
                <div className="bg-white rounded-xl border border-orange-100 px-4 py-2 shadow-sm flex items-center gap-3">
                  <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider">Pendente</span>
                  <span className="text-lg font-black text-orange-500">{formatCurrency(grandTotal - grandTotalPago)}</span>
                </div>
              )}
              <button
                onClick={() => {
                  const doc = new jsPDF();
                  const pw = doc.internal.pageSize.width;
                  // ═══ LOGO THIAGO 704 ═══
                  doc.setFillColor(15, 23, 42);
                  doc.rect(15, 10, pw - 30, 28, 'F');
                  doc.setFont('courier', 'bold');
                  doc.setFontSize(28);
                  doc.setTextColor(255, 255, 255);
                  doc.text('THIAGO', 22, 28);
                  doc.setFontSize(32);
                  doc.setTextColor(59, 130, 246);
                  doc.text('704', 68, 32);
                  doc.setFillColor(59, 130, 246);
                  doc.rect(15, 38, pw - 30, 2, 'F');
                  // Título
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(14);
                  doc.setTextColor(15, 23, 42);
                  doc.text('PAGAMENTOS A FORNECEDORES', pw / 2, 50, { align: 'center' });
                  doc.setFontSize(10);
                  doc.setTextColor(100, 116, 139);
                  doc.text(`Gerado: ${new Date().toLocaleString('pt-BR')}`, pw / 2, 58, { align: 'center' });
                  doc.setDrawColor(200, 200, 200);
                  doc.line(15, 63, pw - 15, 63);
                  // ═══ RESUMO GERAL ═══
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(11);
                  doc.setTextColor(15, 23, 42);
                  doc.text(`TOTAL:  R$ ${grandTotal.toFixed(2)}`, 18, 73);
                  doc.setTextColor(16, 185, 129);
                  doc.text(`PAGO:  R$ ${grandTotalPago.toFixed(2)}`, 85, 73);
                  if (grandTotal - grandTotalPago > 0.01) {
                    doc.setTextColor(239, 68, 68);
                    doc.text(`PENDENTE:  R$ ${(grandTotal - grandTotalPago).toFixed(2)}`, 148, 73);
                  }
                  doc.line(15, 79, pw - 15, 79);
                  let y = 90;
                  // ═══ POR FORNECEDOR ═══
                  filteredSuppliers.forEach(([fornecedor, items]) => {
                    if (y > 255) { doc.addPage(); y = 25; }
                    const totalF = items.reduce((s, i) => s + i.valor, 0);
                    const pagoF = items.reduce((s, i) => s + i.valorPago, 0);
                    // Barra do fornecedor
                    doc.setFillColor(230, 235, 242);
                    doc.rect(15, y - 5, pw - 30, 10, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.setTextColor(15, 23, 42);
                    doc.text(`${fornecedor}  (${items.length})`, 18, y + 1);
                    doc.setFontSize(9);
                    doc.text(`Total: R$ ${totalF.toFixed(2)}`, 115, y + 1);
                    doc.setTextColor(16, 185, 129);
                    doc.text(`Pago: R$ ${pagoF.toFixed(2)}`, 158, y + 1);
                    y += 10;
                    // Cabeçalhos das colunas
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(100, 116, 139);
                    doc.text('DATA', 22, y);
                    doc.text('LOTE', 52, y);
                    doc.text('VALOR', 120, y, { align: 'right' });
                    doc.text('PAGO', 152, y, { align: 'right' });
                    doc.text('STATUS', pw - 18, y, { align: 'right' });
                    y += 7;
                    // Itens detalhados
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(9);
                    items.forEach(item => {
                      if (y > 270) { doc.addPage(); y = 25; }
                      doc.setTextColor(80, 80, 80);
                      doc.text(item.dataPagamento !== '-' ? new Date(item.dataPagamento).toLocaleDateString('pt-BR') : '-', 22, y);
                      doc.setTextColor(59, 130, 246);
                      doc.text(item.lote, 52, y);
                      doc.setTextColor(15, 23, 42);
                      doc.text(`R$ ${item.valor.toFixed(2)}`, 120, y, { align: 'right' });
                      doc.setTextColor(16, 185, 129);
                      doc.text(item.valorPago > 0 ? `R$ ${item.valorPago.toFixed(2)}` : '-', 152, y, { align: 'right' });
                      doc.setTextColor(item.status === 'PAGO' ? 16 : item.status === 'PARCIAL' ? 234 : 239, item.status === 'PAGO' ? 185 : item.status === 'PARCIAL' ? 138 : 68, item.status === 'PAGO' ? 129 : item.status === 'PARCIAL' ? 42 : 68);
                      doc.text(item.status, pw - 18, y, { align: 'right' });
                      y += 7;
                    });
                    y += 5;
                  });
                  // ═══ RODAPÉ ═══
                  y += 8;
                  if (y > 280) { doc.addPage(); y = 25; }
                  doc.setFillColor(15, 23, 42);
                  doc.rect(15, y, pw - 30, 12, 'F');
                  doc.setFont('courier', 'bold');
                  doc.setFontSize(8);
                  doc.setTextColor(255, 255, 255);
                  doc.text('THIAGO 704  //  FRIGOGEST PRO X  //  DOCUMENTO OFICIAL', pw / 2, y + 8, { align: 'center' });
                  doc.save(`FORNECEDORES_${new Date().toISOString().split('T')[0]}.pdf`);
                }}
                className="bg-blue-600 text-white rounded-xl px-4 py-2 shadow-sm flex items-center gap-2 text-[9px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all"
              >
                <Printer size={14} /> Exportar PDF
              </button>
            </div>

            {/* PLANILHA UNIFICADA */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ fontSize: '11px' }}>
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider">Fornecedor</th>
                      <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider">Data Pgto</th>
                      <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider">Lote</th>
                      <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Valor</th>
                      <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider text-right">Pago</th>
                      <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map(([fornecedor, items]) => {
                      const totalF = items.reduce((s, i) => s + i.valor, 0);
                      const pagoF = items.reduce((s, i) => s + i.valorPago, 0);
                      const sorted = [...items].sort((a, b) => b.dataVencimento.localeCompare(a.dataVencimento));
                      return (
                        <React.Fragment key={fornecedor}>
                          {/* LINHA CABEÇALHO DO FORNECEDOR */}
                          <tr className="bg-slate-100/80 border-t-2 border-slate-200">
                            <td className="px-3 py-1.5 font-black text-xs text-slate-800 uppercase" colSpan={3}>
                              <span className="flex items-center gap-2">
                                <Truck size={12} className="text-blue-500" />
                                {fornecedor}
                                <span className="text-[8px] font-bold text-slate-400 ml-1">({items.length})</span>
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right font-black text-xs text-slate-700">{formatCurrency(totalF)}</td>
                            <td className="px-3 py-1.5 text-right font-black text-xs text-emerald-600">{formatCurrency(pagoF)}</td>
                            <td className="px-3 py-1.5 text-center">
                              {totalF - pagoF > 0.01 && <span className="text-[8px] font-black text-orange-500">DEVE {formatCurrency(totalF - pagoF)}</span>}
                            </td>
                          </tr>
                          {/* LINHAS DE DETALHE */}
                          {sorted.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-50 hover:bg-blue-50/40 transition-colors">
                              <td className="px-3 py-1.5 pl-8 text-[10px] text-slate-300">—</td>
                              <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-500">{item.dataPagamento !== '-' ? new Date(item.dataPagamento).toLocaleDateString() : '-'}</td>
                              <td className="px-3 py-1.5">
                                <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{item.lote}</span>
                              </td>
                              <td className="px-3 py-1.5 text-right font-bold text-xs text-slate-700">{formatCurrency(item.valor)}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-xs text-emerald-600">{item.valorPago > 0 ? formatCurrency(item.valorPago) : '-'}</td>
                              <td className="px-3 py-1.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${item.status === 'PAGO' ? 'bg-emerald-50 text-emerald-600' :
                                  item.status === 'PARCIAL' ? 'bg-orange-50 text-orange-600' :
                                    'bg-rose-50 text-rose-600'
                                  }`}>{item.status}</span>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredSuppliers.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                <Truck size={40} className="mx-auto mb-4 text-slate-200" />
                <p className="font-black text-[9px] uppercase text-slate-300 tracking-[0.3em]">Nenhum pagamento a fornecedor registrado</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* MODALS - UNIFIED DESIGN SYSTEM */}
      {(saleToPay || payableToPay || showTransactionForm || showPayableForm) && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl animate-reveal">
          <div className="bg-white rounded-[48px] shadow-3xl w-full max-w-lg overflow-hidden flex flex-col border border-white relative">
            <div className="bg-slate-900 p-10 flex justify-between items-center text-white relative">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Landmark size={120} />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black uppercase tracking-tight italic">Terminal Financeiro</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Sincronizador de Dados Ativo</p>
              </div>
              <button
                onClick={() => { setSaleToPay(null); setPayableToPay(null); setShowTransactionForm(false); setShowPayableForm(false); }}
                className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-600 hover:border-rose-500 transition-all group relative z-10"
              >
                <X size={24} className="text-white group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            <div className="p-12 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {saleToPay && (
                <div className="space-y-8 animate-reveal">
                  <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 shadow-inner relative">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Compensação de Cliente</p>
                    <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">"{saleToPay.nome_cliente}"</p>
                    <div className="mt-8 pt-6 border-t border-slate-200">
                      <p className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">Saldo Pendente em Buffer</p>
                      <p className="text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(getSaleBalance(saleToPay).saldoDevedor)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Valor Recebido (R$)</label>
                    <input type="text" placeholder="0,00" className="modern-input h-20 text-4xl font-black text-center bg-blue-50/30 border-blue-100" value={partialPaymentAmount} onChange={e => setPartialPaymentAmount(e.target.value)} />
                  </div>

                  {/* DISCOUNT SECTION */}
                  <div className="p-6 bg-orange-50/50 border-2 border-orange-100 rounded-3xl space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                        <MinusIcon size={20} className="text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-orange-600 uppercase tracking-widest">Desconto por Avaria</h4>
                        <p className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">Carne machucada / Transporte</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest px-2">Valor do Desconto (R$)</label>
                      <input
                        type="text"
                        placeholder="0,00"
                        className="modern-input h-16 text-2xl font-black text-center bg-white border-orange-200"
                        value={discountAmount}
                        onChange={e => setDiscountAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest px-2">Motivo do Desconto</label>
                      <input
                        type="text"
                        placeholder="Ex: CARNE MACHUCADA NO TRANSPORTE"
                        className="modern-input h-14 text-xs bg-white border-orange-200 uppercase"
                        value={discountReason}
                        onChange={e => setDiscountReason(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>

                  {/* FORMA DE RECEBIMENTO + DATA */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Forma de Recebimento</label>
                      <div className="relative">
                        <select
                          className="modern-input h-14 bg-slate-50/30 appearance-none font-black text-xs uppercase cursor-pointer w-full"
                          value={receiveMethod}
                          onChange={e => setReceiveMethod(e.target.value as PaymentMethod)}
                        >
                          <option value="PIX">💠 PIX</option>
                          <option value="DINHEIRO">💵 DINHEIRO</option>
                          <option value="CHEQUE">📄 CHEQUE</option>
                          <option value="TRANSFERENCIA">🏦 TRANSFERÊNCIA</option>
                          <option value="BOLETO">📋 BOLETO</option>
                          <option value="CARTAO">💳 CARTÃO</option>
                          <option value="OUTROS">📎 OUTROS</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20"><ChevronRight size={16} className="rotate-90" /></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Data Recebimento</label>
                      <input
                        type="date"
                        className="modern-input h-14 font-bold text-xs"
                        value={receiveDate}
                        onChange={e => setReceiveDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* TOTAL SUMMARY */}
                  <div className="p-6 bg-slate-900 rounded-3xl">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recebido:</span>
                      <span className="text-lg font-black text-white">{formatCurrency(parseFloat(partialPaymentAmount.replace(',', '.')) || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Desconto:</span>
                      <span className="text-lg font-black text-orange-400">- {formatCurrency(parseFloat(discountAmount.replace(',', '.')) || 0)}</span>
                    </div>
                    <div className="h-px bg-white/10 my-4"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Total Baixado:</span>
                      <span className="text-3xl font-black text-white">{formatCurrency((parseFloat(partialPaymentAmount.replace(',', '.')) || 0) + (parseFloat(discountAmount.replace(',', '.')) || 0))}</span>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Via:</span>
                      <span className="text-sm font-black text-blue-400 uppercase">{receiveMethod}</span>
                    </div>
                  </div>

                  <button onClick={confirmPartialPayment} className="w-full btn-modern bg-slate-900 text-white py-6 rounded-2xl hover:bg-emerald-600 shadow-2xl transition-all font-black uppercase tracking-widest text-xs">Confirmar Recebimento</button>
                </div>
              )}

              {showTransactionForm && (
                <div className="space-y-8 animate-reveal">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Histórico do Registro</label>
                    <input type="text" placeholder="Ex: Manutenção da Frota" className="modern-input h-16 bg-slate-50/30" value={newTransaction.descricao} onChange={e => setNewTransaction({ ...newTransaction, descricao: e.target.value.toUpperCase() })} />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Montante (R$)</label>
                      <input type="text" inputMode="decimal" placeholder="Valor" className="modern-input h-16 font-black text-xl" value={newTransaction.valor || ''} onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setNewTransaction({ ...newTransaction, valor: parseFloat(v) || 0 }); }} />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Data Valor</label>
                      <input type="date" className="modern-input h-16" value={newTransaction.data} onChange={e => setNewTransaction({ ...newTransaction, data: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Classificação Contábil</label>
                    <div className="relative">
                      <select className="modern-input h-16 bg-slate-50/30 appearance-none font-bold text-xs uppercase cursor-pointer" value={newTransaction.categoria} onChange={e => setNewTransaction({ ...newTransaction, categoria: e.target.value as any })}>
                        <option value="OPERACIONAL">OPERACIONAL</option>
                        <option value="ESTRUTURA">SEDENTARES / SEDE</option>
                        <option value="FUNCIONARIOS">SARGENTOS / FUNCIONÁRIOS</option>
                        <option value="COMPRA_GADO">MATÉRIA PRIMA / GADO</option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-20"><ChevronRight size={20} className="rotate-90" /></div>
                    </div>
                  </div>

                  <button onClick={handleSaveTransaction} className="w-full btn-modern bg-slate-900 text-white py-6 rounded-2xl hover:bg-blue-600 shadow-2xl shadow-blue-900/10 transition-all font-black uppercase tracking-widest text-xs">Efetuar Registro</button>
                </div>
              )}

              {showPayableForm && (
                <div className="space-y-8 animate-reveal">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Identificação do Passivo</label>
                    <input type="text" placeholder="Ex: Tributos Estaduais" className="modern-input h-16 bg-slate-50/30" value={newPayable.descricao} onChange={e => setNewPayable({ ...newPayable, descricao: e.target.value.toUpperCase() })} />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Valor da Dívida</label>
                      <input type="text" inputMode="decimal" placeholder="Valor" className="modern-input h-16 font-black text-xl" value={newPayable.valor || ''} onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setNewPayable({ ...newPayable, valor: parseFloat(v) || 0 }); }} />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Vencimento Fixo</label>
                      <input type="date" className="modern-input h-16" value={newPayable.data_vencimento} onChange={e => setNewPayable({ ...newPayable, data_vencimento: e.target.value })} />
                    </div>
                  </div>
                  <button onClick={() => { addPayable({ ...newPayable, id: `PAY-${Date.now()}`, status: 'PENDENTE' } as Payable); setShowPayableForm(false); }} className="w-full btn-modern bg-slate-900 text-white py-6 rounded-2xl hover:bg-orange-600 shadow-2xl transition-all font-black uppercase tracking-widest text-xs">Agendar para Ciclo</button>
                </div>
              )}

              {payableToPay && (
                <div className="space-y-8 animate-reveal">
                  <div className="p-8 bg-rose-50 border border-rose-100 rounded-[32px] shadow-inner">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3">Baixa de Passivo / Saída</p>
                    <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">"{payableToPay.descricao}"</p>
                    <p className="text-4xl font-black text-rose-600 mt-8 tracking-tight">{formatCurrency(payableToPay.valor - (payableToPay.valor_pago || 0))}</p>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Montante da Liquidação</label>
                    <input type="text" className="modern-input h-20 text-4xl font-black text-center bg-rose-50/30 border-rose-100" value={payableAmountStr} onChange={e => setPayableAmountStr(e.target.value)} />
                  </div>
                  <button onClick={confirmPayablePayment} className="w-full btn-modern bg-slate-900 text-white py-6 rounded-2xl hover:bg-emerald-600 shadow-2xl transition-all font-black uppercase tracking-widest text-xs">Confirmar Pagamento</button>
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50/50 text-center border-t border-slate-50 relative z-10">
              <p className="text-[8px] font-black text-slate-200 uppercase tracking-[0.5em]">FG-FIN-TERMINAL v2.5.5</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financial;