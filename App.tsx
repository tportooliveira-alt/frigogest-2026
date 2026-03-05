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
import { auth, db } from './firebaseClient';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, writeBatch, query, limit, where } from 'firebase/firestore';
import { Cloud, CloudOff, Loader2, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import { logAction } from './utils/audit';
import { syncAllToSheets, forceSyncToSheets, isSheetsConfigured } from './utils/sheetsSync';
import { todayBR } from './utils/helpers';
import CollaboratorReport from './components/CollaboratorReport';
import HeiferManager from './components/HeiferManager';
import SalesAgent from './components/SalesAgent';
import AuditLogView from './components/AuditLogView';
import AIAgents from './components/AIAgents';
import DataIntegrityWatchdog from './components/DataIntegrityWatchdog';
import { ErrorBoundary } from './components/ErrorBoundary';
import AIChat from './components/AIChat';
import AIMeetingRoom from './components/AIMeetingRoom';
import MeetingChat from './components/MeetingChat';
import MarketingHub from './components/MarketingHub';
import MarketDashboard from './components/MarketDashboard';
import PricingEngine from './components/PricingEngine';
import AlertCenter from './components/AlertCenter';
import ScenarioSimulator from './components/ScenarioSimulator';
import { ActionApprovalCenter } from './components/ActionApprovalCenter';
import { DetectedAction } from './services/actionParserService';
import { AIOSPanel } from './components/AIOSPanel';
import { runAutoTriggers, AutoTriggerResult, shouldShowBriefingToday, markBriefingShownToday } from './services/autoTriggerService';


const App: React.FC = () => {
  // MODO OFFLINE: mude para true para testar sem internet
  const OFFLINE_MODE = false;

  const [session, setSession] = useState<any>(OFFLINE_MODE ? { user: { email: 'offline@local' } } : null);
  const [currentView, setCurrentView] = useState('menu');
  const [viewParams, setViewParams] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<'online' | 'offline' | 'checking'>(OFFLINE_MODE ? 'offline' : 'checking');
  const [data, setData] = useState<AppState>({ ...MOCK_DATA, scheduledOrders: [], suppliers: [], payables: [] });
  const [loading, setLoading] = useState(!OFFLINE_MODE);
  const [sheetsSyncStatus, setSheetsSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [aiosAlerts, setAiosAlerts] = useState<AutoTriggerResult[]>([]);
  const [dismissedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (OFFLINE_MODE || !auth) {
      // Modo offline: pula autenticação
      setSession({ user: { email: 'offline@local' } });
      setLoading(false);
      setDbStatus('offline');
      return;
    }

    // Timeout de segurança: se depois de 5s não carregar, mostra o login
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(user ? { user } : null);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!session || OFFLINE_MODE || !db) return;

    setDbStatus('checking');

    try {
      const [
        clientsSnapshot,
        batchesSnapshot,
        stockSnapshot,
        salesSnapshot,
        transactionsSnapshot,
        ordersSnapshot,
        reportsSnapshot,
        suppliersSnapshot,
        payablesSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'batches')),
        getDocs(collection(db, 'stock_items')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'scheduled_orders')),
        getDocs(query(collection(db, 'daily_reports'), limit(50))),
        getDocs(collection(db, 'suppliers')),
        getDocs(collection(db, 'payables'))
      ]);

      const clients = clientsSnapshot.docs.map(doc => ({ ...doc.data() } as Client));
      const batches = batchesSnapshot.docs.map(doc => ({ ...doc.data() } as Batch));
      const stock = stockSnapshot.docs.map(doc => ({ ...doc.data() } as StockItem));
      const sales = salesSnapshot.docs.map(doc => ({ ...doc.data() } as Sale));
      const transactions = transactionsSnapshot.docs.map(doc => ({ ...doc.data() } as Transaction));
      const scheduledOrders = ordersSnapshot.docs.map(doc => ({ ...doc.data() } as any));
      const reports = reportsSnapshot.docs.map(doc => ({ ...doc.data() } as DailyReport));
      const suppliers = suppliersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      const payables = (payablesSnapshot?.docs || []).map(doc => {
        const d = doc.data();
        return {
          ...d,
          id: doc.id,
          valor: d.valor !== undefined ? Number(d.valor) : Number(d.valor_total || 0) // Force number casting
        } as Payable;
      });

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

  useEffect(() => {
    fetchData();

    // Limpa TODOS os dados órfãos automaticamente ao iniciar
    const cleanupOrphans = async () => {
      if (OFFLINE_MODE || !db) return;

      // Aguarda um pouco para garantir que os dados foram carregados
      setTimeout(async () => {
        try {
          const [batchesSnapshot, payablesSnapshot, stockSnapshot, salesSnapshot, transactionsSnapshot] = await Promise.all([
            getDocs(collection(db, 'batches')),
            getDocs(collection(db, 'payables')),
            getDocs(collection(db, 'stock_items')),
            getDocs(collection(db, 'sales')),
            getDocs(collection(db, 'transactions'))
          ]);

          const existingLoteIds = new Set(batchesSnapshot.docs.map(d => d.data().id_lote));
          const batch = writeBatch(db);
          let orphanCount = 0;

          // 1. Limpar PAYABLES órfãos
          payablesSnapshot.forEach(docSnap => {
            const payable = docSnap.data();
            if (payable.categoria === 'COMPRA_GADO') {
              let loteId = payable.id_lote;
              if (!loteId && payable.descricao) {
                const match = payable.descricao.match(/Lote ([A-Z0-9]+-\d{4}-\d+)/);
                if (match) loteId = match[1];
              }
              if (loteId && !existingLoteIds.has(loteId)) {
                batch.delete(docSnap.ref);
                orphanCount++;
                console.log(`🗑️ Payable órfão: ${payable.descricao}`);
              }
            }
          });

          // 1b. Limpar PAYABLES DUPLICADOS (Compra Lote vs Restante Lote)
          const payablesByLote = new Map<string, Array<{ ref: any, data: any, docId: string }>>();
          payablesSnapshot.forEach(docSnap => {
            const payable = docSnap.data();
            if (payable.categoria === 'COMPRA_GADO') {
              let loteId = payable.id_lote;
              if (!loteId && payable.descricao) {
                const match = payable.descricao.match(/Lote (LOTE-[A-Z0-9]+-\d+)/);
                if (match) loteId = match[1];
              }
              if (loteId) {
                if (!payablesByLote.has(loteId)) payablesByLote.set(loteId, []);
                payablesByLote.get(loteId)!.push({ ref: docSnap.ref, data: payable, docId: docSnap.id });
              }
            }
          });
          payablesByLote.forEach((entries, loteId) => {
            if (entries.length > 1) {
              // Manter o que tem ID determinístico (PAY-LOTE-X), deletar os outros
              const hasDetId = entries.some(e => e.docId.startsWith('PAY-LOTE-'));
              if (hasDetId) {
                entries.forEach(e => {
                  if (!e.docId.startsWith('PAY-LOTE-')) {
                    batch.delete(e.ref);
                    orphanCount++;
                    console.log(`🗑️ Payable DUPLICADO removido: "${e.data.descricao}" (ID: ${e.docId})`);
                  }
                });
              }
            }
          });

          // 2. Limpar STOCK_ITEMS órfãos
          stockSnapshot.forEach(docSnap => {
            const item = docSnap.data();
            if (item.id_lote && !existingLoteIds.has(item.id_lote)) {
              batch.delete(docSnap.ref);
              orphanCount++;
              console.log(`🗑️ Estoque órfão: ${item.id_completo}`);
            }
          });

          // 3. Limpar SALES órfãs
          salesSnapshot.forEach(docSnap => {
            const sale = docSnap.data();
            if (sale.id_completo) {
              // Extrai id_lote do id_completo (formato: LOTE-SEQ-TIPO)
              const parts = sale.id_completo.split('-');
              if (parts.length >= 3) {
                const loteId = `${parts[0]}-${parts[1]}-${parts[2]}`;
                if (!existingLoteIds.has(loteId)) {
                  batch.delete(docSnap.ref);
                  orphanCount++;
                  console.log(`🗑️ Venda órfã: ${sale.id_venda}`);
                }
              }
            }
          });

          // 4. Limpar TRANSACTIONS órfãs (relacionadas a lotes)
          transactionsSnapshot.forEach(docSnap => {
            const t = docSnap.data();
            if (t.referencia_id && t.categoria === 'COMPRA_GADO') {
              if (!existingLoteIds.has(t.referencia_id)) {
                batch.delete(docSnap.ref);
                orphanCount++;
                console.log(`🗑️ Transação órfã: ${t.descricao}`);
              }
            }
          });

          if (orphanCount > 0) {
            await batch.commit();
            console.log(`✅ ${orphanCount} registros órfãos removidos automaticamente`);
            fetchData();
          }
        } catch (e) {
          console.error('Erro limpando órfãos:', e);
        }
      }, 2000);
    };
    cleanupOrphans();

    if (OFFLINE_MODE || !db) return; // Sem realtime no modo offline

    // DEBOUNCED REALTIME: Evita tempestade de leituras.
    // Sem debounce: 1 estorno = 4 escritas × 8 listeners × 9 coleções = ~288 leituras
    // Com debounce: 1 estorno = 1 fetchData() = 9 leituras (economia de ~97%)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchData(), 500);
    };

    const unsubscribeClients = onSnapshot(collection(db, 'clients'), debouncedFetch);
    const unsubscribeBatches = onSnapshot(collection(db, 'batches'), debouncedFetch);
    const unsubscribeStock = onSnapshot(collection(db, 'stock_items'), debouncedFetch);
    const unsubscribeSales = onSnapshot(collection(db, 'sales'), debouncedFetch);
    const unsubscribeTransactions = onSnapshot(collection(db, 'transactions'), debouncedFetch);
    const unsubscribeOrders = onSnapshot(collection(db, 'scheduled_orders'), debouncedFetch);
    const unsubscribeReports = onSnapshot(collection(db, 'daily_reports'), debouncedFetch);
    const unsubscribePayables = onSnapshot(collection(db, 'payables'), debouncedFetch);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeClients();
      unsubscribeBatches();
      unsubscribeStock();
      unsubscribeSales();
      unsubscribeTransactions();
      unsubscribeOrders();
      unsubscribeReports();
      unsubscribePayables();
    };
  }, [fetchData]);

  // --- CRUD SUPPLIER ---
  const handleAddSupplier = async (newSupplier: Supplier) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, suppliers: [...prev.suppliers, newSupplier] }));
        return;
      }
      const docRef = await addDoc(collection(db, 'suppliers'), newSupplier);
      const supplierWithId = { ...newSupplier, id: docRef.id };
      await setDoc(docRef, supplierWithId); // Update with ID
      setData(prev => ({ ...prev, suppliers: [...prev.suppliers, supplierWithId] }));
      logAction(session.user, 'CREATE', 'OTHER', `Novo fornecedor: ${newSupplier.nome_fantasia}`, newSupplier);
      alert('Fornecedor cadastrado com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar fornecedor.');
    }
  };

  const handleUpdateSupplier = async (updatedSupplier: Supplier) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, suppliers: prev.suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s) }));
        return;
      }
      await setDoc(doc(db, 'suppliers', updatedSupplier.id), updatedSupplier);
      setData(prev => ({ ...prev, suppliers: prev.suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s) }));
      logAction(session.user, 'UPDATE', 'OTHER', `Fornecedor atualizado: ${updatedSupplier.nome_fantasia}`, updatedSupplier);
      alert('Fornecedor atualizado!');
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar fornecedor.');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, suppliers: prev.suppliers.filter(s => s.id !== id) }));
        return;
      }
      await deleteDoc(doc(db, 'suppliers', id));
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
      const docRef = await addDoc(collection(db, 'payables'), newPayable);
      const payableWithId = { ...newPayable, id: docRef.id };
      await setDoc(docRef, payableWithId);
      setData(prev => ({ ...prev, payables: [...prev.payables, payableWithId] }));
      logAction(session.user, 'CREATE', 'OTHER', `Nova conta a pagar: ${newPayable.descricao}`, newPayable);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar conta a pagar.');
    }
  };

  const handleUpdatePayable = async (updatedPayable: Payable) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, payables: prev.payables.map(p => p.id === updatedPayable.id ? updatedPayable : p) }));
        return;
      }
      await setDoc(doc(db, 'payables', updatedPayable.id), updatedPayable);
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
      const valorPago = payable.valor_pago || 0;

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
      await updateDoc(doc(db, 'payables', id), { status: novoStatus });

      // Se já foi pago (total ou parcial), criar transação inversa (ENTRADA de estorno)
      if ((isPago || isParcial) && valorPago > 0 && db) {
        const estornoTransaction = {
          id: `TR-ESTORNO-PAY-${id}-${Date.now()}`,
          data: new Date().toISOString().split('T')[0],
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

    if (!db) return { success: false, error: 'Firebase não configurado' };

    try {
      // Salvar o lote
      await setDoc(doc(db, 'batches', cleanBatch.id_lote), cleanBatch);

      // 2. REGISTRAR NO FINANCEIRO AUTOMATICAMENTE (Se À VISTA)
      // Usamos ID determinístico TR-LOTE-{id} para evitar duplicatas
      if (totalCost > 0 && rawFormaPagamento === 'VISTA') {
        const transactionData = {
          id: `TR-LOTE-${cleanBatch.id_lote}`,
          data: rawDataRecebimento,
          descricao: `Compra Lote ${cleanBatch.id_lote} - ${cleanBatch.fornecedor}`,
          tipo: 'SAIDA',
          categoria: 'COMPRA_GADO',
          valor: totalCost,
          metodo_pagamento: rawFormaPagamento,
          referencia_id: cleanBatch.id_lote
        };

        console.log(`💰 Registrando saída automática (À VISTA): R$ ${totalCost}`);
        await addTransaction(transactionData as any);
      }

      // NOTA: Compras a PRAZO são tratadas pela registerBatchFinancial() 
      // que é chamada ao fechar o lote no Batches.tsx.

      await fetchData();
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro em addBatch:', error);
      return { success: false, error: error.message };
    }
  };

  // ===== ESTORNO DE VENDA INDIVIDUAL (BLINDADO) =====
  const estornoSale = async (saleId: string) => {
    if (!db) return;

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
      const batchCommit = writeBatch(db);

      // 1. Marcar venda como ESTORNADO e zerar valor_pago
      batchCommit.update(doc(db, 'sales', saleId), { status_pagamento: 'ESTORNADO', valor_pago: 0 });

      // 2. Devolver item(ns) ao estoque → DISPONÍVEL
      // Prioridade: stock_ids_originais (IDs reais gravados no momento da venda)
      // Fallback: id_completo da venda (expande INTEIRO → BANDA_A + BANDA_B)
      const rawIds: string[] = (sale as any).stock_ids_originais && Array.isArray((sale as any).stock_ids_originais)
        ? (sale as any).stock_ids_originais
        : [sale.id_completo];

      const refinedIds: string[] = [];
      rawIds.forEach((id: string) => {
        if (id.endsWith('-INTEIRO')) {
          const base = id.replace('-INTEIRO', '');
          refinedIds.push(`${base}-BANDA_A`, `${base}-BANDA_B`);
        } else {
          refinedIds.push(id);
        }
      });

      console.log(`📦 Devolvendo itens ao estoque:`, refinedIds);
      const restoredIds = new Set<string>();

      for (const stockId of refinedIds) {
        // Para resolver o problema web/local: Primeiro checamos se o documento existe com o ID direto
        const directDocSnap = await getDocs(query(collection(db, 'stock_items'), where('__name__', '==', stockId)));

        if (!directDocSnap.empty) {
          batchCommit.update(doc(db, 'stock_items', stockId), { status: 'DISPONIVEL' });
          restoredIds.add(stockId);
          console.log(`✅ Item (Found ID) ${stockId} -> DISPONIVEL`);
        } else {
          // Tentativa 2: buscar pelo campo id_completo (caso document ID seja diferente)
          try {
            const q = query(collection(db, 'stock_items'), where('id_completo', '==', stockId), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              batchCommit.update(snap.docs[0].ref, { status: 'DISPONIVEL' });
              restoredIds.add(stockId);
              console.log(`✅ Item (fallback campo) ${stockId} -> DISPONIVEL`);
            } else {
              console.error(`❌ Item ${stockId} não encontrado no Firestore. Verifique o estoque manualmente.`);
            }
          } catch (fallbackErr) {
            console.error(`❌ Falha total ao devolver ${stockId}:`, fallbackErr);
          }
        }
      }

      // 3. Reverter financeiro: estornar TODAS as entradas de recebimento desta venda
      // Inclui TR-VISTA-* (venda à vista) e TR-REC-* (recebimentos parciais/a prazo)
      const entradasVenda = data.transactions.filter(t =>
        t.referencia_id === saleId && t.tipo === 'ENTRADA' && t.categoria === 'VENDA'
      );

      for (const tx of entradasVenda) {
        const estornoId = `TR-ESTORNO-VENDA-${saleId}-${tx.id}`;
        batchCommit.set(doc(db, 'transactions', estornoId), sanitize({
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
        batchCommit.set(doc(db, 'transactions', estornoIdDireto), sanitize({
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

      // 4. Reverter descontos: criar ENTRADA espelho para cada TR-DESC desta venda
      const descontosTx = data.transactions.filter(t =>
        t.referencia_id === saleId && t.categoria === 'DESCONTO' && t.tipo === 'SAIDA'
      );
      for (const descTx of descontosTx) {
        const descEstornoId = `TR-ESTORNO-DESC-${saleId}-${descTx.id}`;
        batchCommit.set(doc(db, 'transactions', descEstornoId), sanitize({
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

      // COMMIT ATÔMICO
      if (!OFFLINE_MODE) {
        await batchCommit.commit();
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

      logAction(session?.user, 'ESTORNO', 'SALE', `Venda estornada: ${saleId} (${sale.nome_cliente}) - Pago: R$${valorPago.toFixed(2)}`, { saleId, valorPago, restoredIds: [...restoredIds] });
      alert(`✅ Estorno concluído!\n• ${restoredIds.size} item(s) devolvido(s) ao estoque\n• Financeiro revertido: R$ ${valorPago.toFixed(2)}`);
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

    if (!db) return;

    try {
      console.log(`🔄 INICIANDO ESTORNO DO LOTE: ${id}`);
      const batchCommit = writeBatch(db);

      // 1. Marcar lote como ESTORNADO
      batchCommit.update(doc(db, 'batches', id), { status: 'ESTORNADO' });
      console.log(`✅ Lote ${id} marcado como ESTORNADO (enfileirado)`);

      // 2. Marcar itens de estoque como ESTORNADO
      const stockSnapshot = await getDocs(collection(db, 'stock_items'));
      let stockCount = 0;
      for (const docSnap of stockSnapshot.docs) {
        const item = docSnap.data();
        if (item.id_lote === id && item.status !== 'ESTORNADO') {
          batchCommit.update(doc(db, 'stock_items', docSnap.id), { status: 'ESTORNADO' });
          stockCount++;
        }
      }
      console.log(`✅ ${stockCount} itens de estoque enfileirados`);

      // 3. Estornar payables do lote (Cancela os pagamentos pendentes)
      const payablesSnapshot = await getDocs(collection(db, 'payables'));
      const linkedPayableIds = new Set<string>(); // Rastrear quais payables são deste lote
      let payablesCount = 0;

      for (const docSnap of payablesSnapshot.docs) {
        const payable = docSnap.data();
        const matchByIdLote = payable.id_lote === id;
        const matchById = payable.id && payable.id.includes(id);
        const matchByDescricao = payable.descricao && payable.descricao.includes(id);

        if (matchByIdLote || matchById || matchByDescricao) {
          const isPago = payable.status === 'PAGO';
          const isParcial = payable.status === 'PARCIAL';
          const valorPago = payable.valor_pago || 0;
          const novoStatus = 'CANCELADO';

          batchCommit.update(doc(db, 'payables', docSnap.id), { status: novoStatus });

          // Se já pagou, criar ENTRADA de estorno
          if ((isPago || isParcial) && valorPago > 0) {
            const txId = `TR-ESTORNO-PAY-${docSnap.id}-${Date.now()}`;
            batchCommit.set(doc(db, 'transactions', txId), sanitize({
              id: txId,
              data: new Date().toISOString().split('T')[0],
              descricao: `ESTORNO LOTE: ${payable.descricao}`,
              tipo: 'ENTRADA',
              categoria: 'ESTORNO',
              valor: isPago ? payable.valor : valorPago,
              metodo_pagamento: 'OUTROS',
              referencia_id: id
            }));
          }
        }
      }
      console.log(`✅ ${payablesCount} contas a pagar enfileiradas`);

      // 4. Estornar vendas do lote
      const salesSnapshot = await getDocs(collection(db, 'sales'));
      let salesCount = 0;
      for (const docSnap of salesSnapshot.docs) {
        const sale = docSnap.data();
        // CORREÇÃO AUDITORIA #5: Usar includes() ao invés de startsWith()
        if (sale.id_completo && sale.id_completo.includes(id) && sale.status_pagamento !== 'ESTORNADO') {
          const valorPago = sale.valor_pago || 0;

          batchCommit.update(doc(db, 'sales', docSnap.id), { status_pagamento: 'ESTORNADO' });

          // Se já recebeu $, criar SAÍDA de estorno no Fluxo de Caixa
          if (valorPago > 0) {
            const txVendaId = `TR-ESTORNO-VENDA-${docSnap.id}-${Date.now()}`;
            batchCommit.set(doc(db, 'transactions', txVendaId), sanitize({
              id: txVendaId,
              data: new Date().toISOString().split('T')[0],
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
      }
      console.log(`✅ ${salesCount} vendas enfileiradas`);

      // 5. Criar transação de estorno para transações de compra já lançadas
      const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
      let txCount = 0;
      for (const docSnap of transactionsSnapshot.docs) {
        const tx = docSnap.data();
        // Estornar transações de COMPRA deste lote (criar ENTRADA inversa)
        if ((tx.referencia_id === id || (tx.descricao && tx.descricao.includes(id)))
          && tx.categoria === 'COMPRA_GADO' && !tx.descricao?.includes('ESTORNO')) {
          const estornoTxId = `TR-ESTORNO-${docSnap.id}-${Date.now()}`;
          batchCommit.set(doc(db, 'transactions', estornoTxId), sanitize({
            id: estornoTxId,
            data: new Date().toISOString().split('T')[0],
            descricao: `ESTORNO LOTE: Devolução de ${tx.descricao}`,
            tipo: 'ENTRADA',
            categoria: 'ESTORNO',
            valor: tx.valor,
            metodo_pagamento: 'OUTROS',
            referencia_id: id
          }));
          txCount++;
        }
      }
      console.log(`✅ ${txCount} transações de compra enfileiradas`);

      // COMMIT ATÔMICO FIREBASE
      await batchCommit.commit();

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
    if (!db) {
      alert('❌ Banco de dados não disponível');
      return;
    }

    try {
      console.log('🧹 LIMPEZA COMPLETA DO SISTEMA INICIADA');

      const collections = ['batches', 'sales', 'stock', 'transactions', 'scheduled_orders', 'daily_reports', 'payables'];

      for (const colName of collections) {
        console.log(`🗑️ Limpando: ${colName}...`);
        const snap = await getDocs(collection(db, colName));

        if (snap.empty) {
          console.log(`  ✅ ${colName} já vazio`);
          continue;
        }

        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        console.log(`  ✅ ${snap.docs.length} registros deletados de ${colName}`);
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
    if (!db) return;

    try {
      const [batchesSnapshot, payablesSnapshot] = await Promise.all([
        getDocs(collection(db, 'batches')),
        getDocs(collection(db, 'payables'))
      ]);

      const existingLoteIds = new Set(batchesSnapshot.docs.map(d => d.data().id_lote));
      const deletePromises: Promise<void>[] = [];
      let orphanCount = 0;

      payablesSnapshot.forEach(docSnap => {
        const payable = docSnap.data();
        // Verifica se é um payable de lote (COMPRA_GADO) e se o lote não existe mais
        if (payable.categoria === 'COMPRA_GADO') {
          // Tenta extrair o id_lote da descrição ou do campo id_lote
          let loteId = payable.id_lote;
          if (!loteId && payable.descricao) {
            const match = payable.descricao.match(/Lote ([A-Z0-9-]+)/);
            if (match) loteId = match[1];
          }
          if (!loteId && payable.id) {
            const match = payable.id.match(/PAY-LOTE-([A-Z0-9-]+)/);
            if (match) loteId = match[1];
          }

          // Se o lote não existe mais, deleta o payable
          if (loteId && !existingLoteIds.has(loteId)) {
            deletePromises.push(deleteDoc(doc(db, 'payables', docSnap.id)));
            orphanCount++;
            console.log(`🗑️ Removendo payable órfão: ${payable.descricao} (lote ${loteId} não existe)`);
          }
        }
      });

      if (orphanCount > 0) {
        await Promise.all(deletePromises);
        console.log(`✅ ${orphanCount} payables órfãos removidos automaticamente`);
        fetchData(); // Recarrega os dados
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

    if (!db) return { success: false, error: 'Firebase não configurado' };

    try {
      await setDoc(doc(db, 'stock_items', cleanItem.id_completo), cleanItem);
      if (session?.user) logAction(session.user, 'CREATE', 'STOCK', `Item de estoque adicionado: ${cleanItem.id_completo}`);
      fetchData();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const updateStockItem = async (id: string, updates: Partial<StockItem>) => {
    if (!db) return;
    await updateDoc(doc(db, 'stock_items', id), sanitize(updates));
    fetchData();
  };

  const addTransaction = async (transaction: any) => {
    if (!db) return;
    await setDoc(doc(db, 'transactions', transaction.id), sanitize(transaction));
    if (session?.user) logAction(session.user, 'CREATE', 'TRANSACTION', `Transação adicionada: ${transaction.tipo} ${transaction.valor} (${transaction.descricao})`);
    fetchData();
  };

  const registerBatchFinancial = async (batch: Batch) => {
    // 1. Calcular custo total de aquisição
    const valorCompra = parseFloat(batch.valor_compra_total as any) || 0;
    const frete = parseFloat(batch.frete as any) || 0;
    const extras = parseFloat(batch.gastos_extras as any) || 0;
    const totalCost = valorCompra + frete + extras;

    if (totalCost === 0) return;

    const formaPagamento = (batch as any).forma_pagamento || 'OUTROS';
    const valorEntrada = parseFloat((batch as any).valor_entrada) || 0;
    const dataRecebimento = batch.data_recebimento || todayBR();

    console.log(`🏦 registerBatchFinancial Lote: ${batch.id_lote} | Total: R$ ${totalCost} | Form: ${formaPagamento}`);

    if (formaPagamento === 'VISTA') {
      // PAGAMENTO TOTAL À VISTA
      // Verificamos se addBatch já não criou essa transação
      const txId = `TR-LOTE-${batch.id_lote}`;
      const existingTx = data.transactions.find(t => t.id === txId);

      if (!existingTx) {
        await addTransaction({
          id: txId,
          data: dataRecebimento,
          descricao: `Compra Lote ${batch.id_lote} - ${batch.fornecedor}`,
          tipo: 'SAIDA',
          categoria: 'COMPRA_GADO',
          valor: totalCost,
          metodo_pagamento: formaPagamento,
          referencia_id: batch.id_lote
        } as any);
      } else {
        console.log(`⚠️ Transação ${txId} já existe, ignorando.`);
      }
    } else if (formaPagamento === 'PRAZO') {
      // COMPRA A PRAZO (Pode ter entrada)

      // 1. SE TIVER ENTRADA, LANÇA A SAÍDA AGORA
      if (valorEntrada > 0) {
        const txEntradaId = `TR-LOTE-ENTRADA-${batch.id_lote}`;
        const existingEntrada = data.transactions.find(t => t.id === txEntradaId);

        if (!existingEntrada) {
          await addTransaction({
            id: txEntradaId,
            data: dataRecebimento,
            descricao: `Entrada/Adiantamento Lote ${batch.id_lote} - ${batch.fornecedor}`,
            tipo: 'SAIDA',
            categoria: 'COMPRA_GADO',
            valor: valorEntrada,
            metodo_pagamento: 'OUTROS',
            referencia_id: batch.id_lote
          } as any);
        }
      }

      // 2. REGISTRAR O RESTANTE COMO CONTA A PAGAR (PAYABLE)
      const valorRestante = totalCost - valorEntrada;
      if (valorRestante > 0) {
        const payableId = `PAY-LOTE-${batch.id_lote}`;
        const existingPayables = data.payables.filter(p => p.id_lote === batch.id_lote || p.id === payableId);

        if (existingPayables.length === 0) {
          await handleAddPayable({
            id: payableId,
            id_lote: batch.id_lote,
            descricao: `Pagamento Lote ${batch.id_lote} - ${batch.fornecedor} (Restante)`,
            beneficiario: batch.fornecedor,
            valor: valorRestante,
            valor_pago: 0,
            data_vencimento: (() => {
              const d = new Date(dataRecebimento);
              d.setDate(d.getDate() + ((batch as any).prazo_dias || 30));
              return d.toISOString().split('T')[0];
            })(),
            status: 'PENDENTE',
            categoria: 'COMPRA_GADO'
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

    if (!db) return { success: false, error: 'Firebase não configurado' };

    try {
      const batch = writeBatch(db);

      // Add sales
      cleanSales.forEach((sale: Sale) => {
        const saleRef = doc(db, 'sales', sale.id_venda);
        batch.set(saleRef, sale);
      });

      // Update stock items status - usa stock_ids_originais quando disponível
      cleanSales.forEach((sale: any) => {
        const idsToUpdate = sale.stock_ids_originais && Array.isArray(sale.stock_ids_originais)
          ? sale.stock_ids_originais
          : [sale.id_completo];

        idsToUpdate.forEach((stockId: string) => {
          const stockRef = doc(db, 'stock_items', stockId);
          batch.update(stockRef, { status: 'VENDIDO' });
        });
      });

      await batch.commit();
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
    if (!db) return;
    await updateDoc(doc(db, 'stock_items', id_completo), { status: 'ESTORNADO' });
    if (session?.user) logAction(session.user, 'ESTORNO', 'STOCK', `Item estornado no estoque: ${id_completo}`);
    fetchData();
  };

  const updateSaleCost = async (id_venda: string, newCost: number) => {
    if (!db) return;
    await updateDoc(doc(db, 'sales', id_venda), { custo_extras_total: newCost });
    fetchData();
  };

  // ===== ESTORNO DE TRANSAÇÃO (P10/P11: bloquear se vinculada) =====
  const estornoTransaction = async (id: string) => {
    if (!db) return;
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
      data: new Date().toISOString().split('T')[0],
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
    if (!sale || !db) return;

    try {
      const batchOp = writeBatch(db);

      const valorTotal = sale.peso_real_saida * sale.preco_venda_kg;
      const valorPagoAtual = (sale as any).valor_pago || 0;
      const novoValorPago = valorPagoAtual + valorPagamento;
      const status = novoValorPago >= valorTotal ? 'PAGO' : 'PENDENTE';

      batchOp.update(doc(db, 'sales', saleId), {
        valor_pago: novoValorPago,
        status_pagamento: status,
        forma_pagamento: method
      });

      // Se for acionado de forma isolada, geramos a transação aqui (O receiveClientPayment tbm chama, 
      // mas vamos centralizar se quisermos).
      // Porém, como o botão "Pagar" único chama o receiveClientPayment, vamos manter simple.

      await batchOp.commit();
      fetchData();
    } catch (error) {
      console.error('Error adding partial payment:', error);
    }
  };

  const receiveClientPayment = async (clientId: string, amount: number, method: PaymentMethod, date: string) => {
    if (!db) return;

    const pendingSales = data.sales
      .filter(s => s.id_cliente === clientId && s.status_pagamento === 'PENDENTE')
      .sort((a, b) => new Date(a.data_venda).getTime() - new Date(b.data_venda).getTime());

    let remaining = amount;
    let count = 0;
    const clientName = data.clients.find(c => c.id_ferro === clientId)?.nome_social || 'Cliente';

    try {
      const batchOp = writeBatch(db); // TRANSAÇÃO ATÔMICA

      for (const sale of pendingSales) {
        if (remaining <= 0.01) break;
        const total = sale.peso_real_saida * sale.preco_venda_kg;
        const pago = (sale as any).valor_pago || 0;
        const devendo = total - pago;
        const pagarNesta = Math.min(devendo, remaining);

        if (pagarNesta > 0) {
          // Atualiza a venda
          const novoValorPago = pago + pagarNesta;
          const status = novoValorPago >= total ? 'PAGO' : 'PENDENTE';
          batchOp.update(doc(db, 'sales', sale.id_venda), {
            valor_pago: novoValorPago,
            status_pagamento: status,
            forma_pagamento: method
          });

          // Cria a transação de caixa (ENTRADA)
          const txId = `TR-REC-CLIENT-${sale.id_venda}-${Date.now()}`;
          batchOp.set(doc(db, 'transactions', txId), {
            id: txId,
            data: date,
            descricao: `Recebimento ${clientName} - ${sale.id_completo}`,
            tipo: 'ENTRADA',
            categoria: 'VENDA',
            valor: pagarNesta,
            metodo_pagamento: method,
            referencia_id: sale.id_venda
          });

          remaining -= pagarNesta;
          count++;
        }
      }

      if (count > 0) {
        await batchOp.commit(); // TUDO OU NADA!
        if (session?.user) logAction(session.user, 'CREATE', 'TRANSACTION', `Pagamento recebido de cliente ${clientName}: R$${amount} (${method})`);
        fetchData();
      }
    } catch (e: any) {
      console.error('❌ Erro no pagamento de cliente:', e);
      alert('Erro crítico ao salvar o pagamento online: ' + e.message);
    }
  };

  const addScheduledOrder = async (order: any) => {
    if (!db) return;
    const cleanOrder = sanitize(order);
    await setDoc(doc(db, 'scheduled_orders', cleanOrder.id), cleanOrder);
    if (session?.user) logAction(session.user, 'CREATE', 'ORDER', `Pedido agendado criado para ${cleanOrder.nome_cliente}`);
    fetchData();
  };

  const updateScheduledOrder = async (id: string, updates: any) => {
    if (!db) return;
    await updateDoc(doc(db, 'scheduled_orders', id), sanitize(updates));
    fetchData();
  };

  const deleteScheduledOrder = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'scheduled_orders', id));
    if (session?.user) logAction(session.user, 'DELETE', 'ORDER', `Pedido excluído: ${id}`);
    fetchData();
  };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      if (session?.user) logAction(session.user, 'LOGOUT', 'SYSTEM', `Usuário saiu do sistema`);
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
      {currentView === 'menu' && <Sidebar setView={setCurrentView} onLogout={handleLogout} onSyncSheets={isSheetsConfigured() ? async () => {
        setSheetsSyncStatus('syncing');
        const r = await forceSyncToSheets(data);
        setSheetsSyncStatus(r.success ? 'ok' : 'error');
        if (r.success) setTimeout(() => setSheetsSyncStatus('idle'), 5000);
      } : undefined} sheetsSyncStatus={sheetsSyncStatus} />}
      {currentView === 'system_reset' && <SystemReset onBack={() => setCurrentView('menu')} refreshData={fetchData} />}
      {currentView === 'dashboard' && (
        <div>
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
            if (db) {
              await setDoc(doc(db, 'clients', c.id_ferro), sanitize(c));
              if (session?.user) logAction(session.user, 'CREATE', 'CLIENT', `Novo cliente: ${c.nome_social}`);
              fetchData();
            }
          }}
          updateClient={async (c) => {
            if (db) {
              await setDoc(doc(db, 'clients', c.id_ferro), sanitize(c), { merge: true });
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
            if (db) {
              await updateDoc(doc(db, 'suppliers', id), { status: 'INATIVO' });
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
            if (!db) return;
            await updateDoc(doc(db, 'batches', id), sanitize(updates));
            if (session?.user) logAction(session.user, 'UPDATE', 'BATCH', `Lote atualizado: ${id}`);
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
          if (!db) return;
          await updateDoc(doc(db, 'batches', id), sanitize(updates));
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

          await addSales(newSales);

          // 💰 PAGO NO ATO: criar ENTRADA no fluxo de caixa automaticamente
          if (pagoNoAto && newSales.length > 0) {
            const totalVenda = newSales.reduce((acc, s) => acc + (s.peso_real_saida * s.preco_venda_kg), 0);
            const metodo = metodoPagamento || 'OUTROS';
            await addTransaction({
              id: `TR-VISTA-${Date.now()}`,
              data: todayBR(),
              descricao: `Venda à Vista (${metodo}): ${client.nome_social} — ${newSales.length} item(s)`,
              tipo: 'ENTRADA',
              categoria: 'VENDA',
              valor: totalVenda,
              metodo_pagamento: metodo,
              referencia_id: newSales[0].id_venda
            } as any);
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
            if (!db) return;
            const newReport: any = {
              id: `REPORT-${Date.now()}`,
              timestamp: new Date().toISOString(),
              date: new Date().toISOString().split('T')[0],
              userId: session?.user?.uid || 'anonymous',
              userName: session?.user?.email?.split('@')[0] || 'Colaborador',
              ...reportData
            };
            await setDoc(doc(db, 'daily_reports', newReport.id), newReport);
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
