import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Batches from './components/Batches';
import GTAManager from './components/GTAManager';
import Stock from './components/Stock';
import Expedition from './components/Expedition';
import Financial from './components/Financial';
import SalesHistory from './components/SalesHistory';

import ScheduledOrders from './components/ScheduledOrders';
import Login from './components/Login';
import SystemReset from './components/SystemReset';
import Suppliers from './components/Suppliers';
import { AppState, Sale, PaymentMethod, StockItem, Batch, Client, Transaction, DailyReport, Supplier, Payable } from './types';
import { MOCK_DATA, APP_VERSION_LABEL, APP_VERSION_SHORT } from './constants';
import { supabase } from './supabaseClient';
import { Cloud, CloudOff, Loader2, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import { logAction } from './utils/audit';
import { syncAllToSheets, forceSyncToSheets, isSheetsConfigured } from './utils/sheetsSync';
import { todayBR } from './utils/helpers';
import CollaboratorReport from './components/CollaboratorReport';
import HeiferManager from './components/HeiferManager';
import SalesAgent from './ai/components/SalesAgent';
import AuditLogView from './components/AuditLogView';
import AIAgents from './ai/components/AIAgents';
import DataIntegrityWatchdog from './components/DataIntegrityWatchdog';
import { ErrorBoundary } from './components/ErrorBoundary';
import AIChat from './ai/components/AIChat';
import AIMeetingRoom from './ai/components/AIMeetingRoom';
import MeetingChat from './components/MeetingChat';
import MarketingHub from './components/MarketingHub';
import MarketDashboard from './components/MarketDashboard';
import PricingEngine from './components/PricingEngine';
import AlertCenter from './components/AlertCenter';
import ScenarioSimulator from './components/ScenarioSimulator';
import { ActionApprovalCenter } from './components/ActionApprovalCenter';
import { DetectedAction, parseActionsFromResponse, generateWhatsAppLink } from './services/actionParserService';
import { AIOSPanel } from './ai/components/AIOSPanel';
import { OrchestratorView } from './components/OrchestratorView';
import { runAutoTriggers, AutoTriggerResult, shouldShowBriefingToday, markBriefingShownToday } from './ai/services/autoTriggerService';
import { runOrchestration, OrchestrationResult } from './services/orchestratorService';
import { runCascade } from './ai/services/llmCascade';


const App: React.FC = () => {
  // MODO OFFLINE: controlado pela variável VITE_OFFLINE_MODE no .env
  const OFFLINE_MODE = (import.meta as any).env?.VITE_OFFLINE_MODE === 'true';

  const [session, setSession] = useState<any>(OFFLINE_MODE ? { user: { email: 'offline@local' } } : null);
  const [currentView, setCurrentView] = useState('menu');
  const [viewParams, setViewParams] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<'online' | 'offline' | 'checking' | 'error'>(OFFLINE_MODE ? 'offline' : 'checking');
  const [data, setData] = useState<AppState>({ ...MOCK_DATA, scheduledOrders: [], suppliers: [], payables: [] });
  const [loading, setLoading] = useState(!OFFLINE_MODE);
  const [sheetsSyncStatus, setSheetsSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [aiosAlerts, setAiosAlerts] = useState<AutoTriggerResult[]>([]);
  const [orchestratorResult, setOrchestratorResult] = useState<OrchestrationResult | null>(null);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [detectedActions, setDetectedActions] = useState<DetectedAction[]>([]);
  const [dismissedAlerts] = useState<Set<string>>(new Set());

  // S1-03: Rodar cleanupOrphans uma única vez após login confirmado
  useEffect(() => {
    if (session && !OFFLINE_MODE && supabase) {
      // Delay de 3s para dados carregarem antes de limpar órfãos
      const timer = setTimeout(() => cleanOrphanPayables(), 3000);
      return () => clearTimeout(timer);
    }
  }, [session]);

  useEffect(() => {
    if (OFFLINE_MODE || !supabase) {
      setSession({ user: { email: 'offline@local' } });
      setLoading(false);
      setDbStatus('offline');
      return;
    }

    const timeout = setTimeout(() => { setLoading(false); }, 5000);

    (supabase.auth as any).getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      clearTimeout(timeout);
    });

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!session || OFFLINE_MODE || !supabase) return;

    setDbStatus('checking');

    try {
      const results = await Promise.allSettled([
        supabase.from('clients').select('*'),
        supabase.from('batches').select('*'),
        supabase.from('stock_items').select('*'),
        supabase.from('sales').select('*').order('data_venda', { ascending: false }),
        supabase.from('transactions').select('*'),
        supabase.from('scheduled_orders').select('*'),
        supabase.from('daily_reports').select('*').order('date', { ascending: false }).limit(50),
        supabase.from('suppliers').select('*'),
        supabase.from('payables').select('*'),
      ]);

      const TABLE_NAMES = ['clients', 'batches', 'stock_items', 'sales', 'transactions', 'scheduled_orders', 'daily_reports', 'suppliers', 'payables'];
      const getResData = (res: PromiseSettledResult<any>) =>
        res.status === 'fulfilled' ? (res.value.data || []) : [];

      // Detectar tabelas que falharam e logar — dados parciais são silenciosos sem isso
      const failedTables = results
        .map((r, i) => r.status === 'rejected' ? TABLE_NAMES[i] : null)
        .filter(Boolean);
      if (failedTables.length > 0) {
        console.error('[fetchData] Tabelas com erro:', failedTables);
        setDbStatus('error');
        // Não interrompe — carrega o que conseguiu, mas avisa o dono
        if (failedTables.some(t => ['sales', 'clients', 'stock_items'].includes(t!))) {
          console.warn('[fetchData] Tabela crítica falhou — dados dos agentes podem estar incompletos');
        }
      }

      const clients = getResData(results[0]) as Client[];
      const batches = getResData(results[1]) as Batch[];
      const stock = getResData(results[2]) as StockItem[];
      const sales = getResData(results[3]) as Sale[];
      const transactions = getResData(results[4]) as Transaction[];
      const scheduledOrders = getResData(results[5]) as any[];
      const reports = getResData(results[6]) as DailyReport[];
      const suppliers = getResData(results[7]) as Supplier[];

      const payablesData = getResData(results[8]);
      const payables = payablesData.map((d: any) => ({
        ...d,
        valor: d.valor !== undefined ? Number(d.valor) : Number(d.valor_total || 0)
      })) as Payable[];

      const clientsWithDebt = clients.map(client => {
        const clientSales = sales.filter(s => s.id_cliente === client.id_ferro && s.status_pagamento === 'PENDENTE');
        const totalDebt = clientSales.reduce((acc, sale) => {
          const total = sale.peso_real_saida * sale.preco_venda_kg;
          const paid = (sale as any).valor_pago || 0;
          return acc + (total - paid);
        }, 0);
        return { ...client, saldo_devedor: totalDebt };
      });

      setData({
        clients: clientsWithDebt,
        batches,
        stock,
        sales,
        transactions,
        scheduledOrders,
        reports,
        suppliers,
        payables
      });

      setDbStatus('online');

      // ── AIOS AUTO-TRIGGERS (Agentes Sentinela) ──
      // Rodam silenciosamente após cada carregamento de dados
      try {
        const triggers = runAutoTriggers({
          batches, stock, sales,
          clients: clientsWithDebt,
          transactions,
          payables,
          scheduledOrders
        });
        setAiosAlerts(triggers);

        // // AUTO-ORCHESTRATION: Se houver BLOQUEIO, inicia o conselho de agentes automaticamente
        // const bloqueio = triggers.find(t => t.severity === 'BLOQUEIO');
        // if (bloqueio && !isOrchestrating && !orchestratorResult) {
        //   console.log('[AIOS] 🚨 Bloqueio detectado! Iniciando Orquestrador para:', bloqueio.title);
        //   executeOrchestration(bloqueio.title + ": " + bloqueio.message);
        // }

        // Marca briefing como mostrado hoje (1x/dia)
        if (triggers.some(t => t.triggerId.startsWith('briefing-'))) {
          markBriefingShownToday();
        }
      } catch (triggerErr) {
        console.warn('[AIOS] Erro nos triggers:', triggerErr);
      }

      // ── SYNC GOOGLE SHEETS ──
      if (isSheetsConfigured()) {

        setSheetsSyncStatus('syncing');
        syncAllToSheets({
          clients: clientsWithDebt,
          batches,
          stock,
          sales,
          transactions,
          scheduledOrders,
          reports,
          suppliers,
          payables
        }).then(r => {
          setSheetsSyncStatus(r.success ? 'ok' : 'idle');
          if (r.success) setTimeout(() => setSheetsSyncStatus('idle'), 5000);
        }).catch(() => setSheetsSyncStatus('error'));
      }
    } catch (e) {
      console.error(e);
      setDbStatus('offline');
    }
  }, [session]);

  const executeOrchestration = async (topic: string) => {
    if (isOrchestrating) return;
    setIsOrchestrating(true);
        // FIX: Orquestrador roda em background; view muda APENAS via botão manual
    try {
      // Snapshot básico para o orquestrador
      const snapshot = `STK: ${data.stock.length} itens | FIN: R$ ${data.transactions.reduce((acc, t) => acc + (t.tipo === 'ENTRADA' ? t.valor : -t.valor), 0).toFixed(2)} | CLT: ${data.clients.length}`;
      const res = await runOrchestration(topic, snapshot, runCascade);
      setOrchestratorResult(res);

      // PARSE DE AÇÕES: Extrai ações da decisão final da Dona Clara
      if (res.status === 'COMPLETED' && res.finalDecision) {
        const actions = parseActionsFromResponse(res.finalDecision, data.clients);
        if (actions.length > 0) {
          setDetectedActions(prev => [...actions, ...prev].slice(0, 8)); // Mantém as mais recentes
        }
      }
    } catch (err) {
      console.error('Erro na orquestração:', err);
    } finally {
      setIsOrchestrating(false);
    }
  };

  const handleExecuteAction = (action: DetectedAction) => {
    console.log('[App] Executando ação:', action.type, action.label);

    if (action.type === 'WHATSAPP' && action.clientPhone) {
      const msg = action.message || `Olá ${action.clientName}, aqui é da FrigoGest. ${action.description}`;
      window.open(generateWhatsAppLink(action.clientPhone, msg), '_blank');
    } else if (action.type === 'COBRAR' && action.clientPhone) {
      const msg = `Olá ${action.clientName}, notamos um pagamento pendente no valor de R$ ${action.value?.toFixed(2)}. Como podemos facilitar?`;
      window.open(generateWhatsAppLink(action.clientPhone, msg), '_blank');
    }

    // Remove da lista após executar
    setDetectedActions(prev => prev.filter(a => a.id !== action.id));
  };

  useEffect(() => {
    fetchData();

    // S1-03: cleanupOrphans movida para ser chamada APENAS no login (ver useEffect de session abaixo)
    // Não roda a cada fetchData para evitar queries desnecessárias ao Supabase

    if (OFFLINE_MODE || !supabase) return;

    // REALTIME via Supabase — debounced para evitar excesso de chamadas
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchData(), 500);
    };

    const channel = supabase.channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_orders' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payables' }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // --- CRUD SUPPLIER ---
  const handleAddSupplier = async (newSupplier: Supplier) => {
    try {
      if (OFFLINE_MODE) { setData(prev => ({ ...prev, suppliers: [...prev.suppliers, newSupplier] })); return; }
      if (!supabase) return;
      const { error } = await supabase.from('suppliers').upsert(newSupplier);
      if (error) throw error;
      setData(prev => ({ ...prev, suppliers: [...prev.suppliers, newSupplier] }));
      logAction(session.user, 'CREATE', 'OTHER', `Novo fornecedor: ${newSupplier.nome_fantasia}`, newSupplier);
      alert('Fornecedor cadastrado com sucesso!');
    } catch (e) { console.error(e); alert('Erro ao salvar fornecedor.'); throw e; }
  };

  const handleUpdateSupplier = async (updatedSupplier: Supplier) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, suppliers: prev.suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s) }));
        return;
      }
      if (!supabase) return;
      const { error } = await supabase.from('suppliers').upsert(updatedSupplier);
      if (error) throw error;
      setData(prev => ({ ...prev, suppliers: prev.suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s) }));
      logAction(session.user, 'UPDATE', 'OTHER', `Fornecedor atualizado: ${updatedSupplier.nome_fantasia}`, updatedSupplier);
      alert('Fornecedor atualizado!');
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar fornecedor.');
      throw e;
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.id !== id) }));
        return;
      }
      if (!supabase) return;
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      setData(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.id !== id) }));
      logAction(session.user, 'DELETE', 'OTHER', `Fornecedor removido ID: ${id}`, { id });
      alert('Fornecedor removido.');
    } catch (e) {
      console.error(e);
      alert('Erro ao remover fornecedor.');
    }
  }

  // --- CRUD PAYABLES ---
  const handleAddPayable = async (newPayable: Payable) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, payables: [...prev.payables, newPayable] }));
        return;
      }
      if (!supabase) return;
      const docId = newPayable.id || `PAY-${Date.now()}`;
      const payableWithId = { ...newPayable, id: docId };
      const { error } = await supabase.from('payables').upsert(payableWithId);
      if (error) throw error;
      setData(prev => ({ ...prev, payables: [...prev.payables, payableWithId] }));
      logAction(session.user, 'CREATE', 'OTHER', `Nova conta a pagar: ${payableWithId.descricao}`, payableWithId);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar conta a pagar.');
      throw e;
    }
  };

  const handleUpdatePayable = async (updatedPayable: Payable) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, payables: prev.payables.map(p => p.id === updatedPayable.id ? updatedPayable : p) }));
        return;
      }
      if (!supabase) return;
      const { error } = await supabase.from('payables').upsert(updatedPayable);
      if (error) throw error;
      setData(prev => ({ ...prev, payables: prev.payables.map(p => p.id === updatedPayable.id ? updatedPayable : p) }));
      logAction(session.user, 'UPDATE', 'OTHER', `Conta atualizada: ${updatedPayable.descricao}`, updatedPayable);
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar conta.');
    }
  };

  // ===== ESTORNO DE CONTA A PAGAR =====
  const handleEstornoPayable = async (id: string) => {
    try {
      const payable = data.payables.find(p => p.id === id);
      if (!payable) return;

      const isPago = payable.status === 'PAGO';
      const isParcial = payable.status === 'PARCIAL';
      const valorPago = Number(payable.valor_pago) || 0;

      if (OFFLINE_MODE) {
        setData(prev => ({
          ...prev,
          payables: prev.payables.map(p =>
            p.id === id ? { ...p, status: isPago || isParcial ? 'ESTORNADO' as const : 'CANCELADO' as const } : p
          )
        }));
        return;
      }

      // Marcar o payable como ESTORNADO ou CANCELADO
      const novoStatus = (isPago || isParcial) ? 'ESTORNADO' : 'CANCELADO';
      await supabase!.from('payables').update({ status: novoStatus }).eq('id', id);

      // Se já foi pago (total ou parcial), criar transação inversa (ENTRADA de estorno)
      if ((isPago || isParcial) && valorPago > 0 && supabase) {
        const estornoTransaction = {
          id: `TR-ESTORNO-PAY-${id}-${Date.now()}`,
          data: todayBR(),
          descricao: `ESTORNO: ${payable.descricao}`,
          tipo: 'ENTRADA',
          categoria: 'ESTORNO',
          valor: isPago ? payable.valor : valorPago,
          metodo_pagamento: 'OUTROS',
          referencia_id: id
        };
        await addTransaction(estornoTransaction as any);
      }

      setData(prev => ({
        ...prev,
        payables: prev.payables.map(p =>
          p.id === id ? { ...p, status: novoStatus as any } : p
        )
      }));
      logAction(session.user, 'ESTORNO', 'OTHER', `Conta estornada (${novoStatus}): ${payable.descricao}`, { id, status: novoStatus });
    } catch (e) {
      console.error(e);
      alert('Erro ao estornar conta.');
    }
  };

  const sanitize = (val: any) => JSON.parse(JSON.stringify(val));

  // REGRA DE NEGÓCIO: Lotes só existem no sistema depois de FECHADOS.
  // Componentes consumidores recebem apenas lotes/estoque de lotes fechados.
  const closedBatches = useMemo(() => data.batches.filter(b => b.status === 'FECHADO'), [data.batches]);
  const closedBatchIds = useMemo(() => new Set(closedBatches.map(b => b.id_lote)), [closedBatches]);
  const closedStock = useMemo(() => data.stock.filter(s => closedBatchIds.has(s.id_lote)), [data.stock, closedBatchIds]);

  // KPIs para o home (Sidebar)
  const homeKpis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = today.substring(0, 7) + '-01';
    const saldoCaixa = data.transactions.reduce((acc, t) => acc + (t.tipo === 'ENTRADA' ? t.valor : -t.valor), 0);
    const aReceber = data.sales
      .filter(s => s.status_pagamento !== 'ESTORNADO')
      .reduce((acc, s) => acc + Math.max(0, (s.peso_real_saida * s.preco_venda_kg) - ((s as any).valor_pago || 0)), 0);
    const aPagar = data.payables
      .filter(p => p.status !== 'ESTORNADO' && p.status !== 'CANCELADO')
      .reduce((acc, p) => acc + (p.valor - (p.valor_pago || 0)), 0);
    const closedBatchMap = new Map(closedBatches.map(b => [b.id_lote, b]));
    const stockValue = data.stock
      .filter(s => s.status === 'DISPONIVEL')
      .reduce((acc, s) => acc + (s.peso_entrada * (closedBatchMap.get(s.id_lote)?.custo_real_kg || 0)), 0);
    // RECEBIMENTOS DO MES: regime de caixa (dinheiro que efetivamente entrou no mes)
    const recebimentosMes = data.transactions
      .filter(t => t.tipo === 'ENTRADA' && t.data >= firstOfMonth && t.data <= today)
      .reduce((a, t) => a + t.valor, 0);
    const despesasMes = data.transactions
      .filter(t => t.tipo === 'SAIDA' && t.data >= firstOfMonth && t.data <= today)
      .reduce((a, t) => a + t.valor, 0);
    // FATURAMENTO DO MES: regime de competencia (vendas emitidas no mes, excluindo estornos)
    const vendasMes = data.sales.filter(function(s) {
      return s.status_pagamento !== 'ESTORNADO' &&
        s.data_venda >= firstOfMonth &&
        s.data_venda <= today;
    });
    const faturamentoMes = vendasMes.reduce(function(a, s) { return a + (s.peso_real_saida * s.preco_venda_kg); }, 0);
    // CMV DO MES: custo medio real (custo_real_kg * kg vendidos + extras)
    const cmvMes = vendasMes.reduce(function(a, s) {
      const loteId = s.id_completo.split('-').slice(0, 3).join('-');
      const custo = closedBatchMap.get(loteId)?.custo_real_kg || 0;
      return a + (s.peso_real_saida * custo) + (s.custo_extras_total || 0);
    }, 0);
    // MARGEM OPERACIONAL CORRETA: (Faturamento - CMV) / Faturamento
    const margemMes = faturamentoMes > 0 ? ((faturamentoMes - cmvMes) / faturamentoMes) * 100 : 0;
    const vencidas = data.payables
      .filter(p => p.status !== 'PAGO' && p.status !== 'ESTORNADO' && p.status !== 'CANCELADO' && p.data_vencimento < today).length;
    return { saldoCaixa, aReceber, aPagar, stockValue, recebimentosMes, despesasMes, faturamentoMes, cmvMes, margemMes, vencidas };
  }, [data.transactions, data.sales, data.payables, data.stock, closedBatches]);

  const addBatch = async (batch: any): Promise<{ success: boolean; error?: string }> => {
    // 1. Preservar dados originais ANTES da sanitização
    const rawFormaPagamento = batch.forma_pagamento || 'OUTROS';
    const rawDataRecebimento = batch.data_recebimento || todayBR();

    const cleanBatch = sanitize(batch);

    // Log
    if (session?.user) {
      logAction(session.user, 'CREATE', 'BATCH', `Novo lote criado: ${cleanBatch.id_lote} - ${cleanBatch.fornecedor}`);
    }

    // Calcular custo total real (compra + frete + extras)
    const valorCompra = parseFloat(cleanBatch.valor_compra_total) || 0;
    const frete = parseFloat(cleanBatch.frete) || 0;
    const extras = parseFloat(cleanBatch.gastos_extras) || 0;
    const totalCost = valorCompra + frete + extras;

    if (OFFLINE_MODE) {
      setData(prev => ({
        ...prev,
        batches: [...prev.batches, cleanBatch]
      }));
      return { success: true };
    }

    if (!supabase) return { success: false, error: 'Supabase não configurado' };

    try {
      // S1-01: colunas forma_pagamento_frete e prazo_dias_frete existem após sprint1 migration
      const { error: batchError } = await supabase.from('batches').upsert(cleanBatch);
      if (batchError) throw batchError;

      // FINANCEIRO: Toda lógica de transação é responsabilidade exclusiva de
      // registerBatchFinancial() chamada pelo Batches.tsx ao fechar o lote.
      // Não registrar transação aqui para evitar race condition com o state
      // do React e duplicação de transações (TR-LOTE-{id}).

      await fetchData();
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro em addBatch:', error);
      return { success: false, error: error.message };
    }
  };

  // ===== ESTORNO DE VENDA INDIVIDUAL (BLINDADO) =====
  const estornoSale = async (saleId: string) => {
    if (!supabase) return;

    // 1. Encontrar a venda
    const sale = data.sales.find(s => s.id_venda === saleId);
    if (!sale) {
      alert('Venda não encontrada.');
      return;
    }
    if (sale.status_pagamento === 'ESTORNADO') {
      alert('Esta venda já foi estornada.');
      return;
    }

    const valorPago = (sale as any).valor_pago || 0;
    const confirmMsg = `Confirmar estorno da venda?\n\nCliente: ${sale.nome_cliente}\nValor pago: R$ ${valorPago.toFixed(2)}\n\nIsso devolverá os itens ao estoque e reverterá o financeiro.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      console.log(`🔄 Iniciando estorno da venda: ${saleId} (Cliente: ${sale.nome_cliente})`);

      // 1. Marcar venda como ESTORNADO e zerar valor_pago
      await supabase.from('sales').update({ status_pagamento: 'ESTORNADO', valor_pago: 0 }).eq('id_venda', saleId);

      // 2. Devolver item(ns) ao estoque → DISPONÍVEL
      // ESTRATÉGIA: Derivar os IDs reais Baseado no ID Completo da Venda
      const restoredIds = new Set<string>();

      // Quando vendido inteiro, id_completo finaliza com -INTEIRO (ex: LOTE-1234-1-INTEIRO)
      // Quando BANDA_A, finaliza direto com -BANDA_A ou -BANDA_B
      const isInteira = sale.id_completo.endsWith('-INTEIRO');

      const targetIds = [];
      if (isInteira) {
        const base = sale.id_completo.replace(/-INTEIRO$/, '');
        targetIds.push(`${base}-BANDA_A`, `${base}-BANDA_B`);
      } else {
        targetIds.push(sale.id_completo);
      }

      console.log(`📦 Devolvendo peças ao estoque:`, targetIds);

      for (const stockId of targetIds) {
        const { data: found, error } = await supabase!.from('stock_items')
          .select('id_completo, status').eq('id_completo', stockId).limit(1);

        if (!error && found && found.length > 0) {
          if (found[0].status === 'VENDIDO') {
            await supabase!.from('stock_items').update({ status: 'DISPONIVEL' }).eq('id_completo', stockId);
            restoredIds.add(stockId);
            console.log(`✅ Item ${stockId} -> DISPONIVEL`);
          } else {
            console.log(`⚠️ Item ${stockId} já não estava VENDIDO (Status atual: ${found[0].status})`);
          }
        } else {
          console.error(`❌ Item não encontrado no Supabase para restaurar: ${stockId}`, error);
        }
      }

      // 3. Reverter financeiro: estornar TODAS as entradas de recebimento desta venda
      const entradasVenda = data.transactions.filter(t =>
        t.referencia_id === saleId && t.tipo === 'ENTRADA' && t.categoria === 'VENDA'
      );

      for (const tx of entradasVenda) {
        const estornoId = `TR-ESTORNO-VENDA-${saleId}-${tx.id}`;
        await supabase.from('transactions').upsert(sanitize({
          id: estornoId,
          data: todayBR(),
          descricao: `ESTORNO VENDA: ${sale.nome_cliente || 'Cliente'} - ${sale.id_completo}`,
          tipo: 'SAIDA',
          categoria: 'ESTORNO',
          valor: tx.valor,
          metodo_pagamento: (sale as any).metodo_pagamento || sale.forma_pagamento || 'OUTROS',
          referencia_id: saleId
        }));
      }

      // Fallback: se não havia transações de recebimento mas houve pagamento (valor_pago > 0)
      if (entradasVenda.length === 0 && valorPago > 0) {
        const estornoIdDireto = `TR-ESTORNO-VENDA-${saleId}-DIRETO`;
        await supabase.from('transactions').upsert(sanitize({
          id: estornoIdDireto,
          data: todayBR(),
          descricao: `ESTORNO VENDA: ${sale.nome_cliente || 'Cliente'} - ${sale.id_completo}`,
          tipo: 'SAIDA',
          categoria: 'ESTORNO',
          valor: valorPago,
          metodo_pagamento: (sale as any).metodo_pagamento || sale.forma_pagamento || 'OUTROS',
          referencia_id: saleId
        }));
      }

      // 4. Reverter descontos
      const descontosTx = data.transactions.filter(t =>
        t.referencia_id === saleId && t.categoria === 'DESCONTO' && t.tipo === 'SAIDA'
      );
      for (const descTx of descontosTx) {
        const descEstornoId = `TR-ESTORNO-DESC-${saleId}-${descTx.id}`;
        await supabase.from('transactions').upsert(sanitize({
          id: descEstornoId,
          data: todayBR(),
          descricao: `ESTORNO DESCONTO: ${descTx.descricao}`,
          tipo: 'ENTRADA',
          categoria: 'ESTORNO',
          valor: descTx.valor,
          metodo_pagamento: 'OUTROS',
          referencia_id: saleId
        }));
      }

      // 5. Atualizar estado local imediatamente (UI responde antes do fetchData)
      setData(prev => ({
        ...prev,
        sales: prev.sales.map(s =>
          s.id_venda === saleId ? { ...s, status_pagamento: 'ESTORNADO' as const, valor_pago: 0 } : s
        ),
        stock: prev.stock.map(item =>
          restoredIds.has(item.id_completo) ? { ...item, status: 'DISPONIVEL' as const } : item
        )
      }));

      const fallbackUsed = restoredIds.size > 0 && targetIds.every(id => !restoredIds.has(id));
      logAction(session?.user, 'ESTORNO', 'SALE', `Venda estornada: ${saleId} (${sale.nome_cliente}) - Pago: R$${valorPago.toFixed(2)}`, { saleId, valorPago, restoredIds: [...restoredIds] });

      if (restoredIds.size === 0) {
        alert(`⚠️ Estorno financeiro concluído, mas nenhum item foi encontrado no estoque para restaurar.\n\nIsso pode ocorrer se os itens já foram manualmente removidos.\nVerifique o estoque manualmente para o id: ${sale.id_completo}`);
      } else {
        alert(`✅ Estorno concluído!\n• ${restoredIds.size} item(s) devolvido(s) ao estoque${fallbackUsed ? ' (via busca automática)' : ''}\n• Financeiro revertido: R$ ${valorPago.toFixed(2)}`);
      }
      fetchData();
    } catch (error) {
      console.error('❌ Erro ao estornar venda:', error);
      alert('Erro ao estornar a venda. Verifique o console para detalhes.');
    }
  };


  // ===== ESTORNO DE LOTE BLINDADO (CASCATA ATÔMICA) =====
  const estornoBatch = async (id: string) => {
    if (OFFLINE_MODE) {
      setData(prev => ({
        ...prev,
        batches: prev.batches.map(b => b.id_lote === id ? { ...b, status: 'ESTORNADO' as const } : b),
        stock: prev.stock.map(s => s.id_lote === id ? { ...s, status: 'ESTORNADO' as const } : s),
        payables: prev.payables.map(p => p.id_lote === id ? { ...p, status: 'CANCELADO' as const } : p),
        sales: prev.sales.map(s => s.id_completo.includes(id) ? { ...s, status_pagamento: 'ESTORNADO' as const } : s),
      }));
      return;
    }

    if (!supabase) return;

    try {
      console.log(`🔄 INICIANDO ESTORNO DO LOTE: ${id}`);

      // 1. Marcar lote como ESTORNADO
      await supabase.from('batches').update({ status: 'ESTORNADO' }).eq('id_lote', id);
      console.log(`✅ Lote ${id} marcado como ESTORNADO`);

      // 2. Marcar itens de estoque como ESTORNADO
      const { data: stockItems } = await supabase.from('stock_items').select('*').eq('id_lote', id).neq('status', 'ESTORNADO');
      let stockCount = 0;
      for (const item of stockItems || []) {
        await supabase.from('stock_items').update({ status: 'ESTORNADO' }).eq('id_completo', item.id_completo);
        stockCount++;
      }
      console.log(`✅ ${stockCount} itens de estoque atualizados`);

      // 3. Estornar payables do lote — filtrado no banco (por id_lote OU id contendo loteId)
      const { data: lotePayables } = await supabase.from('payables').select('*').eq('id_lote', id);
      const { data: idPayables } = await supabase.from('payables').select('*').like('id', `%${id}%`);
      const { data: descPayables } = await supabase.from('payables').select('*').like('descricao', `%${id}%`);
      const seenPayIds = new Set<string>();
      const allPayables = [...(lotePayables || []), ...(idPayables || []), ...(descPayables || [])]
        .filter(p => { if (seenPayIds.has(p.id)) return false; seenPayIds.add(p.id); return true; });
      let payablesCount = 0;

      for (const payable of allPayables) {
        const isPago = payable.status === 'PAGO';
        const isParcial = payable.status === 'PARCIAL';
        const valorPago = payable.valor_pago || 0;

        await supabase.from('payables').update({ status: 'CANCELADO' }).eq('id', payable.id);

        if ((isPago || isParcial) && valorPago > 0) {
          const txId = `TR-ESTORNO-PAY-${payable.id}-${Date.now()}`;
          await supabase.from('transactions').upsert(sanitize({
            id: txId,
            data: todayBR(),
            descricao: `ESTORNO LOTE: ${payable.descricao}`,
            tipo: 'ENTRADA',
            categoria: 'ESTORNO',
            valor: isPago ? payable.valor : valorPago,
            metodo_pagamento: 'OUTROS',
            referencia_id: id
          }));
        }
        payablesCount++;
      }
      console.log(`✅ ${payablesCount} contas a pagar atualizadas`);

      // 4. Estornar vendas do lote — filtrado no banco por id_completo contendo loteId
      const { data: loteSales } = await supabase.from('sales').select('*')
        .like('id_completo', `%${id}%`).neq('status_pagamento', 'ESTORNADO');
      let salesCount = 0;
      for (const sale of loteSales || []) {
        const valorPago = sale.valor_pago || 0;

        await supabase.from('sales').update({ status_pagamento: 'ESTORNADO' }).eq('id_venda', sale.id_venda);

        if (valorPago > 0) {
          const txVendaId = `TR-ESTORNO-VENDA-${sale.id_venda}-${Date.now()}`;
          await supabase.from('transactions').upsert(sanitize({
            id: txVendaId,
            data: todayBR(),
            descricao: `ESTORNO LOTE: Venda ${sale.nome_cliente || 'Cliente'} - ${sale.id_completo}`,
            tipo: 'SAIDA',
            categoria: 'ESTORNO',
            valor: valorPago,
            metodo_pagamento: 'OUTROS',
            referencia_id: id
          }));
        }
        salesCount++;
      }
      console.log(`✅ ${salesCount} vendas atualizadas`);

      // 5. Estornar transações de compra do lote (Gado e Frete) — filtrado no banco
      const { data: loteTx } = await supabase.from('transactions').select('*')
        .eq('referencia_id', id).in('categoria', ['COMPRA_GADO', 'FRETE']);
      const { data: descTx } = await supabase.from('transactions').select('*')
        .like('descricao', `%${id}%`).in('categoria', ['COMPRA_GADO', 'FRETE']);
      const seenTxIds = new Set<string>();
      const allComprasTx = [...(loteTx || []), ...(descTx || [])]
        .filter(t => {
          if (seenTxIds.has(t.id) || t.descricao?.includes('ESTORNO')) return false;
          seenTxIds.add(t.id); return true;
        });
      let txCount = 0;
      for (const tx of allComprasTx) {
        const estornoTxId = `TR-ESTORNO-${tx.id}-${Date.now()}`;
        await supabase.from('transactions').upsert(sanitize({
          id: estornoTxId,
          data: todayBR(),
          descricao: `ESTORNO LOTE: Devolução de ${tx.descricao}`,
          tipo: 'ENTRADA',
          categoria: 'ESTORNO',
          valor: tx.valor,
          metodo_pagamento: 'OUTROS',
          referencia_id: id
        }));
        txCount++;
      }
      console.log(`✅ ${txCount} transações de compra estornadas`);

      console.log(`🎯 LOTE ${id} COMPLETAMENTE ESTORNADO (Transação Atômica)!`);

      if (session?.user) {
        logAction(
          session.user,
          'ESTORNO',
          'BATCH',
          `Lote COMPLETAMENTE estornado: ${id} (${stockCount} estoque, ${payablesCount} payables, ${salesCount} vendas, ${txCount} transações)`
        );
      }

      fetchData();
    } catch (error: any) {
      console.error('❌ Erro FATAL ao estornar lote (Cascata abortada!):', error);
      alert(`Erro crítico ao tentar estornar o lote: ${error.message}. NENHUMA alteração foi feita.`);
    }
  };

  const cleanAllFinancialData = async () => {
    if (!supabase) {
      alert('❌ Banco de dados não disponível');
      return;
    }

    try {
      console.log('🧹 LIMPEZA COMPLETA DO SISTEMA INICIADA');

      // Mapeamento: tabela → coluna PK real (para o .neq que força o delete)
      const tables: Array<[string, string]> = [
        ['batches', 'id_lote'],
        ['sales', 'id_venda'],
        ['stock_items', 'id_completo'],
        ['transactions', 'id'],
        ['scheduled_orders', 'id'],
        ['daily_reports', 'id'],
        ['payables', 'id'],
      ];

      for (const [tableName, pkCol] of tables) {
        console.log(`🗑️ Limpando: ${tableName}...`);
        const { error } = await supabase.from(tableName).delete().neq(pkCol, '');
        if (error) {
          console.error(`  ❌ Erro ao limpar ${tableName}:`, error);
        } else {
          console.log(`  ✅ ${tableName} limpo`);
        }
      }

      console.log('✅ LIMPEZA COMPLETA FINALIZADA');
      console.log('📋 MANTIDOS: Clientes e Fornecedores');

      if (session?.user) {
        logAction(session.user, 'DELETE', 'SYSTEM', 'Limpeza completa do sistema executada');
      }

      fetchData();
    } catch (error) {
      console.error('❌ Erro durante limpeza:', error);
      throw error;
    }
  };

  // NOVA: Limpa payables órfãos (de lotes que não existem mais)
  const cleanOrphanPayables = async () => {
    if (!supabase) return;

    try {
      const [{ data: batchesData }, { data: payablesData }] = await Promise.all([
        supabase.from('batches').select('id_lote'),
        supabase.from('payables').select('*').in('categoria', ['COMPRA_GADO', 'FRETE'])
      ]);

      const existingLoteIds = new Set((batchesData || []).map((b: any) => b.id_lote));
      let orphanCount = 0;

      for (const payable of payablesData || []) {
        let loteId = payable.id_lote;
        if (!loteId && payable.descricao) {
          const match = payable.descricao.match(/Lote ([A-Z0-9-]+)/);
          if (match) loteId = match[1];
        }
        if (!loteId && payable.id) {
          const match = payable.id.match(/PAY-LOTE-([A-Z0-9-]+)/);
          if (match) loteId = match[1];
        }

        if (loteId && !existingLoteIds.has(loteId)) {
          await supabase.from('payables').delete().eq('id', payable.id);
          orphanCount++;
          console.log(`🗑️ Removendo payable órfão: ${payable.descricao} (lote ${loteId} não existe)`);
        }
      }

      if (orphanCount > 0) {
        console.log(`✅ ${orphanCount} payables órfãos removidos automaticamente`);
        fetchData();
      }
    } catch (error) {
      console.error('Erro ao limpar payables órfãos:', error);
    }
  };

  const addStockItem = async (item: any) => {
    const cleanItem = sanitize(item);
    if (OFFLINE_MODE) {
      setData(prev => ({
        ...prev,
        stock: [...prev.stock, cleanItem]
      }));
      return { success: true };
    }

    if (!supabase) return { success: false, error: 'Supabase não configurado' };

    try {
      const { error } = await supabase.from('stock_items').upsert(cleanItem);
      if (error) throw error;
      if (session?.user) logAction(session.user, 'CREATE', 'STOCK', `Item de estoque adicionado: ${cleanItem.id_completo}`);
      fetchData();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const updateStockItem = async (id: string, updates: Partial<StockItem>) => {
    if (!supabase) return;
    await supabase.from('stock_items').update(sanitize(updates)).eq('id_completo', id);
    fetchData();
  };

  const addTransaction = async (transaction: any) => {
    if (OFFLINE_MODE) {
      setData(prev => ({ ...prev, transactions: [...prev.transactions, transaction] }));
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from('transactions').upsert(sanitize(transaction));
    if (error) throw error;
    if (session?.user) logAction(session.user, 'CREATE', 'TRANSACTION', `Transação adicionada: ${transaction.tipo} ${transaction.valor} (${transaction.descricao})`);
    // Não chamar fetchData() aqui — quem chama addTransaction já faz fetchData() no momento certo
  };

  const registerBatchFinancial = async (batch: Batch) => {
    const valorCompra = parseFloat(batch.valor_compra_total as any) || 0;
    const extras = parseFloat(batch.gastos_extras as any) || 0;
    const valorGadoTotal = valorCompra + extras;

    const frete = parseFloat(batch.frete as any) || 0;

    if (valorGadoTotal + frete === 0) return;

    const dataRecebimento = batch.data_recebimento || todayBR();

    console.log(`🏦 registerBatchFinancial Lote: ${batch.id_lote} | Gado+Extras: R$ ${valorGadoTotal.toFixed(2)} | Frete: R$ ${frete.toFixed(2)}`);

    // -- 1. FINANCEIRO DO GADO --
    const formaPagGado = (batch as any).forma_pagamento || 'VISTA';
    if (valorGadoTotal > 0) {
      if (formaPagGado === 'VISTA') {
        const txIdGado = `TR-LOTE-GADO-${batch.id_lote}`;
        const { data: existingTx } = await supabase!.from('transactions').select('id').eq('id', txIdGado).limit(1);

        if (!existingTx || existingTx.length === 0) {
          await addTransaction({
            id: txIdGado,
            data: dataRecebimento,
            descricao: `Compra Lote ${batch.id_lote} (Gado+Extras) - ${batch.fornecedor}`,
            tipo: 'SAIDA',
            categoria: 'COMPRA_GADO',
            valor: valorGadoTotal,
            metodo_pagamento: 'OUTROS',
            referencia_id: batch.id_lote
          } as any);
        }
      } else {
        const valorEntrada = parseFloat((batch as any).valor_entrada) || 0;

        if (valorEntrada > 0) {
          const txEntradaId = `TR-LOTE-ENTRADA-${batch.id_lote}`;
          const { data: existingEntrada } = await supabase!.from('transactions').select('id').eq('id', txEntradaId).limit(1);

          if (!existingEntrada || existingEntrada.length === 0) {
            await addTransaction({
              id: txEntradaId,
              data: dataRecebimento,
              descricao: `Entrada/Adiantamento Lote ${batch.id_lote} - ${batch.fornecedor}`,
              tipo: 'SAIDA',
              categoria: 'COMPRA_GADO',
              valor: Math.min(valorEntrada, valorGadoTotal),
              metodo_pagamento: 'OUTROS',
              referencia_id: batch.id_lote
            } as any);
          }
        }

        const valorRestanteGado = parseFloat((valorGadoTotal - valorEntrada).toFixed(2));
        if (valorRestanteGado > 0) {
          const vencimentoGado = (() => {
            const d = new Date(dataRecebimento);
            d.setDate(d.getDate() + ((batch as any).prazo_dias || 30));
            return d.toISOString().split('T')[0];
          })();

          const payableGadoId = `PAY-LOTE-GADO-${batch.id_lote}`;
          const { data: existingPayGado } = await supabase!.from('payables').select('id').eq('id', payableGadoId).limit(1);

          if (!existingPayGado || existingPayGado.length === 0) {
            await handleAddPayable({
              id: payableGadoId,
              id_lote: batch.id_lote,
              descricao: `Pagamento Gado Lote ${batch.id_lote} - ${batch.fornecedor}`,
              beneficiario: batch.fornecedor,
              valor: valorRestanteGado,
              valor_pago: 0,
              data_vencimento: vencimentoGado,
              status: 'PENDENTE',
              categoria: 'COMPRA_GADO'
            } as any);
          }
        }
      }
    }

    // -- 2. FINANCEIRO DO FRETE --
    if (frete > 0) {
      const formaPagFrete = (batch as any).forma_pagamento_frete || 'VISTA';

      if (formaPagFrete === 'VISTA') {
        const txIdFrete = `TR-LOTE-FRETE-${batch.id_lote}`;
        const { data: existingTxFrete } = await supabase!.from('transactions').select('id').eq('id', txIdFrete).limit(1);

        if (!existingTxFrete || existingTxFrete.length === 0) {
          await addTransaction({
            id: txIdFrete,
            data: dataRecebimento,
            descricao: `Frete Lote ${batch.id_lote} - ${batch.fornecedor}`,
            tipo: 'SAIDA',
            categoria: 'FRETE',
            valor: frete,
            metodo_pagamento: 'OUTROS',
            referencia_id: batch.id_lote
          } as any);
        }
      } else {
        const vencimentoFrete = (() => {
          const d = new Date(dataRecebimento);
          d.setDate(d.getDate() + ((batch as any).prazo_dias_frete || 15));
          return d.toISOString().split('T')[0];
        })();

        const payableFreteId = `PAY-LOTE-FRETE-${batch.id_lote}`;
        const { data: existingPayFrete } = await supabase!.from('payables').select('id').eq('id', payableFreteId).limit(1);

        if (!existingPayFrete || existingPayFrete.length === 0) {
          await handleAddPayable({
            id: payableFreteId,
            id_lote: batch.id_lote,
            descricao: `Pagamento Frete Lote ${batch.id_lote} - ${batch.fornecedor}`,
            beneficiario: batch.fornecedor,  // (Futuro: Vincular com tabela de Transportadores)
            valor: frete,
            valor_pago: 0,
            data_vencimento: vencimentoFrete,
            status: 'PENDENTE',
            categoria: 'FRETE'
          } as any);
        }
      }
    }

    await fetchData();
  };

  const addSales = async (newSales: Sale[]): Promise<{ success: boolean; error?: string }> => {
    const cleanSales = sanitize(newSales);
    if (OFFLINE_MODE) {
      // Coletar todos os IDs de estoque (originais e diretos)
      const allStockIds = new Set<string>();
      cleanSales.forEach((sale: any) => {
        if (sale.stock_ids_originais && Array.isArray(sale.stock_ids_originais)) {
          sale.stock_ids_originais.forEach((id: string) => allStockIds.add(id));
        } else {
          allStockIds.add(sale.id_completo);
        }
      });

      setData(prev => ({
        ...prev,
        sales: [...prev.sales, ...cleanSales],
        stock: prev.stock.map(item =>
          allStockIds.has(item.id_completo)
            ? { ...item, status: 'VENDIDO' as const }
            : item
        )
      }));
      return { success: true };
    }

    if (!supabase) return { success: false, error: 'Supabase não configurado' };

    try {
      // Insert sales
      const { error: salesError } = await supabase.from('sales').upsert(cleanSales);
      if (salesError) throw salesError;

      // Update stock items status - usa stock_ids_originais quando disponível
      for (const sale of cleanSales) {
        const idsToUpdate = (sale as any).stock_ids_originais && Array.isArray((sale as any).stock_ids_originais)
          ? (sale as any).stock_ids_originais
          : [sale.id_completo];

        for (const stockId of idsToUpdate) {
          await supabase.from('stock_items').update({ status: 'VENDIDO' }).eq('id_completo', stockId);
        }
      }
      if (session?.user) {
        logAction(session.user, 'CREATE', 'SALE', `Venda realizada: ${cleanSales.length} itens para ${cleanSales[0].nome_cliente || 'Cliente'}`);
      }
      fetchData();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  // ===== ESTORNO DE ITEM DE ESTOQUE =====
  const estornoStockItem = async (id_completo: string) => {
    if (!supabase) return;
    await supabase.from('stock_items').update({ status: 'ESTORNADO' }).eq('id_completo', id_completo);
    if (session?.user) logAction(session.user, 'ESTORNO', 'STOCK', `Item estornado no estoque: ${id_completo}`);
    fetchData();
  };

  const updateSaleCost = async (id_venda: string, newCost: number) => {
    if (!supabase) return;
    await supabase.from('sales').update({ custo_extras_total: newCost }).eq('id_venda', id_venda);
    fetchData();
  };

  // ===== ESTORNO DE TRANSAÇÃO (P10/P11: bloquear se vinculada) =====
  const estornoTransaction = async (id: string) => {
    if (!supabase) return;
    const tx = data.transactions.find(t => t.id === id);
    if (!tx) return;

    // P10: Bloquear se vinculada a uma venda (TR-REC)
    if (tx.id?.startsWith('TR-REC-') || (tx.referencia_id && data.sales.some(s => s.id_venda === tx.referencia_id))) {
      alert('⚠️ Esta transação está vinculada a uma VENDA.\nUse o estorno de VENDA no Histórico de Vendas.');
      return;
    }
    // P11: Bloquear se vinculada a uma conta a pagar (TR-PAY)
    if (tx.id?.startsWith('TR-PAY-') || (tx.referencia_id && data.payables.some(p => p.id === tx.referencia_id))) {
      alert('⚠️ Esta transação está vinculada a uma CONTA A PAGAR.\nUse o estorno de CONTA em Financeiro > A Pagar.');
      return;
    }
    // Bloquear se já é uma transação de estorno
    if (tx.categoria === 'ESTORNO' || tx.id?.startsWith('TR-ESTORNO-')) {
      alert('⚠️ Esta transação já é um estorno. Não pode ser estornada novamente.');
      return;
    }

    // Apenas transações manuais/avulsas podem ser estornadas diretamente
    const inversa = {
      id: `TR-ESTORNO-${id}-${Date.now()}`,
      data: todayBR(),
      descricao: `ESTORNO: ${tx.descricao}`,
      tipo: tx.tipo === 'ENTRADA' ? 'SAIDA' : 'ENTRADA',
      categoria: 'ESTORNO',
      valor: tx.valor,
      metodo_pagamento: tx.metodo_pagamento || 'OUTROS',
      referencia_id: tx.referencia_id || id
    };
    await addTransaction(inversa as any);
    logAction(session?.user, 'ESTORNO', 'TRANSACTION', `Transação estornada: ${tx.descricao} (R$${tx.valor})`);
    fetchData();
  };

  const addPartialPayment = async (saleId: string, valorPagamento: number, method: PaymentMethod, date: string) => {
    const sale = data.sales.find(s => s.id_venda === saleId);
    if (!sale || !supabase) return;

    try {
      const valorTotal = sale.peso_real_saida * sale.preco_venda_kg;
      const valorPagoAtual = (sale as any).valor_pago || 0;
      const novoValorPago = valorPagoAtual + valorPagamento;
      const status = novoValorPago >= valorTotal ? 'PAGO' : 'PENDENTE';

      await supabase.from('sales').update({
        valor_pago: novoValorPago,
        status_pagamento: status,
        forma_pagamento: method
      }).eq('id_venda', saleId);

      fetchData();
    } catch (error) {
      console.error('Error adding partial payment:', error);
    }
  };


  const addScheduledOrder = async (order: any) => {
    if (!supabase) return;
    const cleanOrder = sanitize(order);
    await supabase.from('scheduled_orders').upsert(cleanOrder);
    if (session?.user) logAction(session.user, 'CREATE', 'ORDER', `Pedido agendado criado para ${cleanOrder.nome_cliente}`);
    fetchData();
  };

  const updateScheduledOrder = async (id: string, updates: any) => {
    if (!supabase) return;
    await supabase.from('scheduled_orders').update(sanitize(updates)).eq('id', id);
    fetchData();
  };

  const deleteScheduledOrder = async (id: string) => {
    if (!supabase) return;
    await supabase.from('scheduled_orders').delete().eq('id', id);
    if (session?.user) logAction(session.user, 'DELETE', 'ORDER', `Pedido excluído: ${id}`);
    fetchData();
  };

  const handleLogout = async () => {
    if (supabase) {
      if (session?.user) logAction(session.user, 'LOGOUT', 'SYSTEM', `Usuário saiu do sistema`);
      await (supabase.auth as any).signOut();
    }
    setSession(null);
    setCurrentView('menu');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="text-blue-600 animate-spin" size={48} />
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => { }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans overflow-x-hidden selection:bg-blue-200" >
      {currentView === 'menu' && <Sidebar setView={setCurrentView} kpis={homeKpis} onLogout={handleLogout} onSyncSheets={isSheetsConfigured() ? async () => {
        setSheetsSyncStatus('syncing');
        const r = await forceSyncToSheets(data);
        setSheetsSyncStatus(r.success ? 'ok' : 'error');
        if (r.success) setTimeout(() => setSheetsSyncStatus('idle'), 5000);
      } : undefined} sheetsSyncStatus={sheetsSyncStatus} />}
      {currentView === 'system_reset' && <SystemReset onBack={() => setCurrentView('menu')} refreshData={fetchData} />}
      {currentView === 'dashboard' && (
        <div>
          {detectedActions.length > 0 && (
            <ActionApprovalCenter
              actions={detectedActions}
              onApprove={handleExecuteAction}
              onReject={(id) => setDetectedActions(prev => prev.filter(a => a.id !== id))}
              onClearAll={() => setDetectedActions([])}
            />
          )}
          <AIOSPanel
            alerts={aiosAlerts}
            onDismiss={(id) => setAiosAlerts(prev => prev.filter(a => a.triggerId !== id))}
            onNavigate={(target) => { if (target) setCurrentView(target); }}
          />
          <Dashboard sales={data.sales} stock={closedStock} transactions={data.transactions} batches={closedBatches} clients={data.clients} onBack={() => setCurrentView('menu')} />
        </div>
      )}
      {
        currentView === 'clients' && <Clients
          clients={data.clients}
          sales={data.sales}
          transactions={data.transactions}
          batches={closedBatches}
          addClient={async (c) => {
            if (supabase) {
              const { error } = await supabase.from('clients').upsert(sanitize(c));
              if (error) throw error;
              if (session?.user) logAction(session.user, 'CREATE', 'CLIENT', `Novo cliente: ${c.nome_social}`);
              fetchData();
            }
          }}
          updateClient={async (c) => {
            if (supabase) {
              const { error } = await supabase.from('clients').upsert(sanitize(c));
              if (error) throw error;
              if (session?.user) logAction(session.user, 'UPDATE', 'CLIENT', `Cliente atualizado: ${c.nome_social}`);
              fetchData();
            }
          }}
          onGoToFinancial={() => setCurrentView('financial')}
          onBack={() => setCurrentView('menu')}
        />
      }
      {
        currentView === 'suppliers' && <Suppliers
          suppliers={data.suppliers}
          addSupplier={handleAddSupplier}
          updateSupplier={handleUpdateSupplier}
          deleteSupplier={async (id) => {
            if (supabase) {
              await supabase.from('suppliers').update({ status: 'INATIVO' }).eq('id', id);
              if (session?.user) logAction(session.user, 'UPDATE', 'OTHER', `Fornecedor inativado: ${id}`);
              fetchData();
            }
          }}
          onBack={() => setCurrentView('menu')}
        />
      }
      {
        currentView === 'batches' && <Batches
          batches={data.batches}
          suppliers={data.suppliers}
          stock={data.stock}
          addBatch={addBatch}
          updateBatch={async (id, updates) => {
            if (!supabase) return;
            // S1-04: Recalcular custo_real_kg se algum campo de custo foi editado
            const u = updates as any;
            if (u.valor_compra_total !== undefined || u.frete !== undefined || u.gastos_extras !== undefined || u.peso_total_romaneio !== undefined) {
              const loteAtual = data.batches.find(b => b.id_lote === id);
              if (loteAtual) {
                const compra  = parseFloat(u.valor_compra_total ?? loteAtual.valor_compra_total) || 0;
                const frete   = parseFloat(u.frete ?? loteAtual.frete) || 0;
                const extras  = parseFloat(u.gastos_extras ?? loteAtual.gastos_extras) || 0;
                const peso    = parseFloat(u.peso_total_romaneio ?? loteAtual.peso_total_romaneio) || 0;
                const novoCusto = peso > 0 ? parseFloat(((compra + frete + extras) / peso).toFixed(4)) : 0;
                (updates as any).custo_real_kg = novoCusto;
              }
            }
            let { error } = await supabase.from('batches').update(sanitize(updates)).eq('id_lote', id);
            if (error && session?.user) console.error('Erro ao atualizar lote:', error);
            if (!error && session?.user) logAction(session.user, 'UPDATE', 'BATCH', `Lote atualizado: ${id}`);
            fetchData();
          }}
          deleteBatch={estornoBatch}
          addStockItem={addStockItem}
          updateStockItem={updateStockItem}
          removeStockItem={estornoStockItem}
          registerBatchFinancial={registerBatchFinancial}
          onGoToStock={() => setCurrentView('stock')}
          onBack={() => setCurrentView('menu')}
        />
      }
      {
        currentView === 'gta' && <GTAManager
          batches={data.batches}
          suppliers={data.suppliers}
          onBack={() => setCurrentView('menu')}
        />
      }
      {currentView === 'stock' && <Stock
        stock={closedStock}
        batches={closedBatches}
        sales={data.sales}
        clients={data.clients}
        updateBatch={async (id, updates) => {
          if (!supabase) return;
          await supabase.from('batches').update(sanitize(updates)).eq('id_lote', id);
          if (session?.user) logAction(session.user, 'UPDATE', 'BATCH', `Lote atualizado: ${id}`);
          fetchData();
        }}
        deleteBatch={estornoBatch}
        onBack={() => setCurrentView('menu')}
      />}
      {
        currentView === 'expedition' && <Expedition clients={data.clients} stock={closedStock} batches={closedBatches} salesHistory={data.sales} onConfirmSale={async (saleData) => {
          const { client, items, pricePerKg, extrasCost, pagoNoAto, metodoPagamento } = saleData;

          // AGRUPAR: Banda A + Banda B do mesmo animal = CARCAÇA INTEIRA
          const groupedItems = new Map<string, any[]>();
          items.forEach((item: any) => {
            const key = `${item.id_lote}-${item.sequencia}`;
            if (!groupedItems.has(key)) groupedItems.set(key, []);
            groupedItems.get(key)!.push(item);
          });

          const newSales: Sale[] = [];
          let groupIndex = 0;

          // Calcular peso total para distribuir extras proporcionalmente
          const totalSaleWeight = [...groupedItems.values()].reduce((acc, groupItems) =>
            acc + groupItems.reduce((sum: number, i: any) => sum + (i.peso_saida || i.peso_entrada), 0), 0);

          groupedItems.forEach((groupItems, key) => {
            const isCarcacaInteira = groupItems.length > 1;
            const batch = data.batches.find(b => b.id_lote === groupItems[0].id_lote);
            const custoKg = batch ? batch.custo_real_kg : 0;

            const pesoEntradaTotal = groupItems.reduce((acc: number, i: any) => acc + i.peso_entrada, 0);
            const pesoSaidaTotal = groupItems.reduce((acc: number, i: any) => acc + (i.peso_saida || i.peso_entrada), 0);
            const quebraTotal = pesoEntradaTotal - pesoSaidaTotal;

            const revenue = pesoSaidaTotal * pricePerKg;
            const cost = pesoSaidaTotal * custoKg;
            const groupExtraCost = totalSaleWeight > 0 ? (extrasCost * (pesoSaidaTotal / totalSaleWeight)) : 0;
            const profit = revenue - cost - groupExtraCost;

            const idCompleto = isCarcacaInteira
              ? `${groupItems[0].id_lote}-${String(groupItems[0].sequencia).padStart(3, '0')}-INTEIRO`
              : groupItems[0].id_completo;

            const valorTotal = pesoSaidaTotal * pricePerKg;
            const metodo = metodoPagamento || 'OUTROS';

            newSales.push({
              id_venda: `V-${Date.now()}-${groupIndex++}`,
              id_cliente: client.id_ferro,
              nome_cliente: client.nome_social,
              id_completo: idCompleto,
              peso_real_saida: pesoSaidaTotal,
              preco_venda_kg: pricePerKg,
              data_venda: todayBR(),
              quebra_kg: quebraTotal,
              lucro_liquido_unitario: profit,
              custo_extras_total: groupExtraCost,
              prazo_dias: pagoNoAto ? 0 : (saleData.prazoDias || 30),
              data_vencimento: (() => { const d = new Date(); d.setDate(d.getDate() + (pagoNoAto ? 0 : (saleData.prazoDias || 30))); return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); })(),
              forma_pagamento: pagoNoAto ? metodo : 'OUTROS',
              // PAGO NO ATO: já marca como PAGO e registra valor
              status_pagamento: pagoNoAto ? 'PAGO' : 'PENDENTE',
              valor_pago: pagoNoAto ? valorTotal : 0,
              tipo_venda: isCarcacaInteira ? 'CARCACA_INTEIRA' : 'BANDA_AVULSA',
              stock_ids_originais: groupItems.map((i: any) => i.id_completo)
            } as any);
          });

          const res = await addSales(newSales);
          if (!res.success) {
            alert(`Erro Crítico na Venda: ${res.error}`);
            throw new Error(res.error);
          }

          // 💰 PAGO NO ATO: criar ENTRADA individual por venda no fluxo de caixa
          // FIX #5: Antes havia 1 transação coletiva com referencia_id da primeira venda.
          // Isso fazia o estorno da 2ª, 3ª venda não encontrar a transação de entrada.
          // Agora cada venda tem seu próprio TR-VISTA com referencia_id correto.
          if (pagoNoAto && newSales.length > 0) {
            const metodo = metodoPagamento || 'OUTROS';
            for (const sale of newSales) {
              const valorSale = sale.peso_real_saida * sale.preco_venda_kg;
              await addTransaction({
                id: `TR-VISTA-${sale.id_venda}`,
                data: todayBR(),
                descricao: `Venda à Vista (${metodo}): ${client.nome_social} — ${sale.id_completo}`,
                tipo: 'ENTRADA',
                categoria: 'VENDA',
                valor: valorSale,
                metodo_pagamento: metodo,
                referencia_id: sale.id_venda
              } as any);
            }
            fetchData(); // Atualiza estado após gravar transações de venda à vista
          }

          // Não navega para outra tela — Expedition mostra tela de sucesso internamente
          // e o usuário pode fazer nova venda sem sair da área de vendas
        }} onBack={() => setCurrentView('menu')} />
      }
      {currentView === 'sales_history' && <SalesHistory stock={closedStock} batches={closedBatches} sales={data.sales} clients={data.clients} initialSearchTerm={viewParams?.searchTerm} onBack={() => setCurrentView('menu')} onGoToSales={() => setCurrentView('expedition')} estornoSale={estornoSale} />}
      {currentView === 'financial' && <Financial sales={data.sales} batches={closedBatches} stock={closedStock} clients={data.clients} transactions={data.transactions} updateSaleCost={updateSaleCost} addTransaction={addTransaction} deleteTransaction={estornoTransaction} addPartialPayment={addPartialPayment} onBack={() => setCurrentView('menu')} payables={data.payables} addPayable={handleAddPayable} updatePayable={handleUpdatePayable} deletePayable={handleEstornoPayable} estornoSale={estornoSale} />}
      {currentView === 'scheduled_orders' && <ScheduledOrders scheduledOrders={data.scheduledOrders} clients={data.clients} addScheduledOrder={addScheduledOrder} updateScheduledOrder={updateScheduledOrder} deleteScheduledOrder={deleteScheduledOrder} onViewClientHistory={(clientName) => { setViewParams({ searchTerm: clientName }); setCurrentView('sales_history'); }} onBack={() => setCurrentView('menu')} />}
      {
        currentView === 'report' && <CollaboratorReport
          reports={data.reports}
          onBack={() => setCurrentView('menu')}
          onSubmit={async (reportData) => {
            if (!supabase) return;
            const newReport: any = {
              id: `REPORT-${Date.now()}`,
              timestamp: new Date().toISOString(),
              date: new Date().toISOString().split('T')[0],
              userId: session?.user?.id || 'anonymous',
              userName: session?.user?.email?.split('@')[0] || 'Colaborador',
              ...reportData
            };
            await supabase.from('daily_reports').upsert(newReport);
            logAction(session?.user, 'CREATE', 'OTHER', `Relatório enviado: ${reportData.type}`);
            fetchData(); // Force refresh to see new report immediately
          }}
        />
      }
      {
        currentView === 'heifers' && <HeiferManager
          onBack={() => setCurrentView('menu')}
          existingOrders={data.scheduledOrders}
          onAddOrder={addScheduledOrder}
        />
      }
      {
        currentView === 'sales_agent' && <SalesAgent
          onBack={() => setCurrentView('menu')}
          clients={data.clients}
          sales={data.sales}
          stock={data.stock}
          batches={data.batches}
        />
      }

      {currentView === 'audit' && <AuditLogView onBack={() => setCurrentView('menu')} />}
      {currentView === 'ai_agents' && <ErrorBoundary><AIAgents
        onBack={() => setCurrentView('menu')}
        batches={data.batches}
        stock={data.stock}
        sales={data.sales}
        clients={data.clients}
        transactions={data.transactions}
        suppliers={data.suppliers}
        payables={data.payables}
        scheduledOrders={data.scheduledOrders}
      /></ErrorBoundary>}
      {currentView === 'ai_chat' && <AIChat
        onBack={() => setCurrentView('menu')}
        batches={data.batches}
        stock={data.stock}
        sales={data.sales}
        clients={data.clients}
        transactions={data.transactions}
        suppliers={data.suppliers}
        payables={data.payables}
        scheduledOrders={data.scheduledOrders}
      />}
      {currentView === 'marketing' && <MarketingHub data={data} onBack={() => setCurrentView('menu')} />}
      {currentView === 'market_dashboard' && <MarketDashboard onBack={() => setCurrentView('menu')} />}
      {currentView === 'pricing_engine' && <PricingEngine onBack={() => setCurrentView('menu')} />}
      {currentView === 'alert_center' && <AlertCenter onBack={() => setCurrentView('menu')} />}
      {currentView === 'ai_meeting' && <AIMeetingRoom
        onBack={() => setCurrentView('menu')}
        batches={data.batches}
        stock={data.stock}
        sales={data.sales}
        clients={data.clients}
        transactions={data.transactions}
        suppliers={data.suppliers}
        payables={data.payables}
        scheduledOrders={data.scheduledOrders}
      />}
      {currentView === 'orchestrator' && (
        <div className="p-4 md:p-8 animate-fade-in relative z-10 w-full max-w-6xl mx-auto">
          <OrchestratorView
            result={orchestratorResult}
            isLoading={isOrchestrating}
            onApprove={(decision) => {
              console.log('[App] Decisão aprovada:', decision);
              setCurrentView('menu');
            }}
            onReject={() => {
              setOrchestratorResult(null);
              setCurrentView('menu');
            }}
          />
        </div>
      )}
      {currentView === 'meeting_chat' && <MeetingChat onBack={() => setCurrentView('menu')} />}
      {currentView === 'system_reset' && <SystemReset onBack={() => setCurrentView('menu')} refreshData={fetchData} />}
      {currentView === 'scenario_simulator' && <ScenarioSimulator onBack={() => setCurrentView('menu')} onApplyScenario={(simData) => {
        setData(prev => ({
          ...prev,
          clients: simData.clients?.length ? simData.clients : prev.clients,
          sales: simData.sales?.length ? [...simData.sales, ...prev.sales] : prev.sales,
          transactions: simData.transactions?.length ? [...simData.transactions, ...prev.transactions] : prev.transactions,
        }));
        setCurrentView('menu');
      }} />}

      {/* Botão Atualizar App — canto superior direito, discreto mas acessível */}
      {currentView === 'menu' && (
        <button
          onClick={() => {
            if (window.confirm('🔄 Atualizar app?\n\nSeus dados NÃO serão perdidos.')) {
              window.location.reload();
            }
          }}
          className="fixed top-4 right-4 z-[200] w-9 h-9 bg-white/10 hover:bg-blue-600 backdrop-blur-xl border border-white/20 hover:border-blue-500 rounded-full flex items-center justify-center transition-all shadow-lg hover:shadow-blue-500/30 group"
          title="Atualizar App"
        >
          <RefreshCw size={14} className="text-white/60 group-hover:text-white group-hover:rotate-180 transition-all duration-500" />
        </button>
      )}

      {/* STATUS — apenas ponto verde/vermelho fixo no canto inferior esquerdo */}
      <div className="fixed bottom-3 left-3 z-[200] flex items-center gap-2 pointer-events-none">
        {dbStatus === 'online' && (
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" title="Online" />
        )}
        {dbStatus === 'offline' && (
          <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" title="Offline" />
        )}
        <span className="text-white/20 text-[8px] font-black">{APP_VERSION_SHORT}</span>
      </div>

      {/* 🔴 IA Auditora de Integridade Global (Watchdog) */}
      <DataIntegrityWatchdog
        stock={data.stock}
        sales={data.sales}
        transactions={data.transactions}
        payables={data.payables}
        batches={data.batches}
      />

    </div >
  );
};

export default App;
