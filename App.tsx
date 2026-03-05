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
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, writeBatch, query, limit } from 'firebase/firestore';
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

    // Setup realtime listeners
    const unsubscribeClients = onSnapshot(collection(db, 'clients'), () => fetchData());
    const unsubscribeBatches = onSnapshot(collection(db, 'batches'), () => fetchData());
    const unsubscribeStock = onSnapshot(collection(db, 'stock_items'), () => fetchData());
    const unsubscribeSales = onSnapshot(collection(db, 'sales'), () => fetchData());
    const unsubscribeTransactions = onSnapshot(collection(db, 'transactions'), () => fetchData());
    const unsubscribeOrders = onSnapshot(collection(db, 'scheduled_orders'), () => fetchData());
    const unsubscribeReports = onSnapshot(collection(db, 'daily_reports'), () => fetchData());
    const unsubscribePayables = onSnapshot(collection(db, 'payables'), () => fetchData());

    return () => {
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
    const cleanBatch = { ...batch };

    // Log
    if (session?.user) {
      logAction(session.user, 'CREATE', 'BATCH', `Novo lote criado: ${cleanBatch.id_lote} - ${cleanBatch.fornecedor}`);
    }

    // CORREÇÃO AUDITORIA #1: PRESERVAR forma_pagamento e prazo_dias no Firestore!
    // Antes esses campos eram deletados, fazendo registerBatchFinancial não saber
    // se a compra era à vista ou a prazo. Agora salvamos tudo.
    // Normalizar pagamento_a_vista → forma_pagamento
    if (cleanBatch.pagamento_a_vista === true && !cleanBatch.forma_pagamento) {
      cleanBatch.forma_pagamento = 'VISTA';
    }
    delete cleanBatch.pagamento_a_vista; // campo auxiliar de UI, não precisa no Firestore

    cleanBatch.peso_total_romaneio = parseFloat(cleanBatch.peso_total_romaneio) || 0;
    cleanBatch.valor_compra_total = parseFloat(cleanBatch.valor_compra_total) || 0;
    cleanBatch.frete = parseFloat(cleanBatch.frete) || 0;
    cleanBatch.gastos_extras = parseFloat(cleanBatch.gastos_extras) || 0;
    cleanBatch.custo_real_kg = parseFloat(cleanBatch.custo_real_kg) || 0;

    if (OFFLINE_MODE) {
      setData(prev => ({
        ...prev,
        batches: [...prev.batches, cleanBatch]
      }));
      return { success: true };
    }

    if (!db) return { success: false, error: 'Firebase não configurado' };

    try {
      await setDoc(doc(db, 'batches', cleanBatch.id_lote), cleanBatch);

      // CORREÇÃO AUDITORIA #2: REMOVIDO o bloco duplicado de criação de transação.
      // TODA a lógica financeira (à vista, a prazo, frete, entrada) é tratada
      // EXCLUSIVAMENTE por registerBatchFinancial() quando o lote é FECHADO.
      // Isso elimina o conflito de dois caminhos fazendo a mesma coisa.

      await fetchData();
      return { success: true };
    } catch (error: any) {
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

    try {
      const valorPago = sale.valor_pago || 0;
      const batch = writeBatch(db); // INÍCIO DA TRANSAÇÃO

      // 2. Marcar a venda atual como ESTORNADO
      batch.update(doc(db, 'sales', saleId), {
        status_pagamento: 'ESTORNADO'
        // NOTA ERP: NÃO ZERAMOS o valor_pago na nota original. O valor pago fica registrado
        // para histórico contábil, enquanto lançamos uma SAÍDA no fluxo de caixa compensando.
      });

      // 3. Devolver item(ns) ao estoque → DISPONÍVEL
      // Se tiver stock_ids_originais (ex: carcaça inteira juntou Banda A + Banda B), usa eles.
      const stockIdsToRestore: string[] = [];
      if ((sale as any).stock_ids_originais && Array.isArray((sale as any).stock_ids_originais)) {
        stockIdsToRestore.push(...((sale as any).stock_ids_originais));
      } else {
        stockIdsToRestore.push(sale.id_completo);
      }

      let itensDevolvidos = 0;

      // Procura ativamente todos os itens no State atual (data.stock)
      const itemsToUpdate = data.stock.filter(item => {
        if (item.status === 'VENDIDO' || item.status === 'SAIDA') {
          // Correção: Extrair a base do ID para suportar 'LOTE-123-1-INTEIRO' casando com 'LOTE-123-1-BANDA A'
          return stockIdsToRestore.some(sid => {
            const sidBase = sid.replace('-INTEIRO', '');
            const itemBase = item.id_completo.replace(/-BANDA (A|B)$/, '');
            return sid === item.id_completo || sidBase === item.id_completo || itemBase === sidBase || item.id_completo.startsWith(sidBase);
          });
        }
        return false;
      });

      for (const item of itemsToUpdate) {
        // Rastreabilidade: O item volta a ficar DISPONIVEL e perde a marcação de saída
        batch.update(doc(db, 'stock_items', item.id_completo), { status: 'DISPONIVEL' });
        itensDevolvidos++;
      }

      if (itensDevolvidos === 0) {
        console.warn(`⚠️ ALERTA DE RASTREABILIDADE: Nenhum item físico correspondente a ${saleId} foi encontrado para devolução. O estoque físico pode estar quebrado.`);
      }

      // 4. Se a venda já tinha dinheiro recebido (À VISTA, ou já baixado), OBRIGATÓRIO lançar SAÍDA
      if (valorPago > 0) {
        const txId = `TR-ESTORNO-VENDA-${saleId}-${Date.now()}`;
        batch.set(doc(db, 'transactions', txId), {
          id: txId,
          data: new Date().toISOString().split('T')[0],
          descricao: `ESTORNO (DEVOLUÇÃO CLIENTE): Venda ${sale.nome_cliente || 'Desconhecido'} - ${sale.id_completo}`,
          tipo: 'SAIDA', // Dinheiro saindo da conta do Frigorífico voltando pro Cliente
          categoria: 'ESTORNO',
          valor: valorPago,
          metodo_pagamento: sale.forma_pagamento || 'OUTROS',
          referencia_id: saleId
        });
      }

      // 5. Reverter descontos financeiros cedidos: Se o frigorífico "perdeu" dinheiro no desconto (SAÍDA),
      // o cancelamento da dívida "recupera" esse valor contábil (ENTRADA)
      const descontosConcedidos = data.transactions.filter(t =>
        (t.referencia_id === saleId || t.id?.startsWith(`TR-DESC-${saleId}`)) &&
        t.categoria === 'DESCONTO' && t.tipo === 'SAIDA'
      );

      for (const descTx of descontosConcedidos) {
        const txDescId = `TR-ESTORNO-DESC-${saleId}-${Date.now()}`;
        batch.set(doc(db, 'transactions', txDescId), {
          id: txDescId,
          data: new Date().toISOString().split('T')[0],
          descricao: `RESTITUIÇÃO DE DESCONTO (ESTORNO): ${descTx.descricao}`,
          tipo: 'ENTRADA',
          categoria: 'ESTORNO',
          valor: descTx.valor,
          metodo_pagamento: 'OUTROS',
          referencia_id: saleId
        });
      }

      await batch.commit(); // CONFIRMA TUDO ATOMICAMENTE

      if (session?.user) {
        logAction(session.user, 'ESTORNO', 'SALE', `Estorno Auditado: Venda ${saleId} (${sale.nome_cliente}). Peças restuaradas: ${itensDevolvidos}. Caixa estornado: R$${valorPago.toFixed(2)}`, { saleId, valorPago });
      }
      alert('Venda estornada com sucesso. O estoque foi devolvido e o fluxo de caixa revertido contabilmente.');
      fetchData();
    } catch (error: any) {
      console.error('❌ FATAL: Erro arquitetural ao estornar venda:', error);
      alert(`Erro crítico ao tentar estornar a venda: ${error.message}. Nenhuma alteração foi feita.`);
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
      const batchOp = writeBatch(db); // INÍCIO DA TRANSAÇÃO ATÔMICA

      // 1. Marcar lote como ESTORNADO
      batchOp.update(doc(db, 'batches', id), { status: 'ESTORNADO' });
      console.log(`✅ Lote ${id} preparado para ESTORNADO`);

      // 2. Marcar itens de estoque como ESTORNADO
      const stockSnapshot = await getDocs(collection(db, 'stock_items'));
      let stockCount = 0;
      for (const docSnap of stockSnapshot.docs) {
        const item = docSnap.data();
        if (item.id_lote === id && item.status !== 'ESTORNADO') {
          batchOp.update(doc(db, 'stock_items', docSnap.id), { status: 'ESTORNADO' });
          stockCount++;
        }
      }
      console.log(`✅ ${stockCount} itens de estoque preparados para estorno`);

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
          linkedPayableIds.add(docSnap.id);
          if (payable.status !== 'ESTORNADO' && payable.status !== 'CANCELADO') {
            const isPago = payable.status === 'PAGO';
            const isParcial = payable.status === 'PARCIAL';
            const novoStatus = (isPago || isParcial) ? 'ESTORNADO' : 'CANCELADO';
            batchOp.update(doc(db, 'payables', docSnap.id), { status: novoStatus });
            payablesCount++;
          }
        }
      }
      console.log(`✅ ${payablesCount} contas a pagar preparadas para estorno/cancelamento`);

      // 4. Estornar vendas do lote
      const salesSnapshot = await getDocs(collection(db, 'sales'));
      let salesCount = 0;
      for (const docSnap of salesSnapshot.docs) {
        const sale = docSnap.data();
        // CORREÇÃO AUDITORIA #5: Usar includes() ao invés de startsWith()
        if (sale.id_completo && sale.id_completo.includes(id) && sale.status_pagamento !== 'ESTORNADO') {
          const valorPago = sale.valor_pago || 0;

          batchOp.update(doc(db, 'sales', docSnap.id), { status_pagamento: 'ESTORNADO' });

          // Se já recebeu $, criar SAÍDA de estorno no Fluxo de Caixa
          if (valorPago > 0) {
            const txId = `TR-ESTORNO-VENDA-${docSnap.id}-${Date.now()}`;
            batchOp.set(doc(db, 'transactions', txId), {
              id: txId,
              data: new Date().toISOString().split('T')[0],
              descricao: `ESTORNO LOTE: Venda ${sale.nome_cliente || 'Cliente'} - ${sale.id_completo}`,
              tipo: 'SAIDA',
              categoria: 'ESTORNO',
              valor: valorPago,
              metodo_pagamento: 'OUTROS',
              referencia_id: id
            });
          }
          salesCount++;
        }
      }
      console.log(`✅ ${salesCount} vendas preparadas para estorno`);

      // 5. Criar transação de estorno para transações de compra já lançadas
      const transactionsSnapshot = await getDocs(collection(db, 'transactions'));
      let txCount = 0;
      for (const docSnap of transactionsSnapshot.docs) {
        const tx = docSnap.data();
        const isCategoriaDeLote = tx.categoria === 'COMPRA_GADO' || tx.categoria === 'FRETE';

        // Vinculo direto ao Lote OU vinculo a um Payable que é deste lote
        const isVinculadoLote = tx.referencia_id === id
          || (tx.descricao && tx.descricao.includes(id))
          || (tx.referencia_id && linkedPayableIds.has(tx.referencia_id))
          || (tx.id && tx.id.includes(id));

        if (isVinculadoLote && tx.tipo === 'SAIDA' && !tx.categoria?.includes('ESTORNO') && !tx.descricao?.includes('ESTORNO')) {
          const txId = `TR-ESTORNO-${docSnap.id}-${Date.now()}`;
          batchOp.set(doc(db, 'transactions', txId), {
            id: txId,
            data: new Date().toISOString().split('T')[0],
            descricao: `ESTORNO LOTE: Devolução de ${tx.descricao}`,
            tipo: 'ENTRADA',
            categoria: 'ESTORNO',
            valor: tx.valor,
            metodo_pagamento: 'OUTROS',
            referencia_id: id
          });
          txCount++;
        }
      }
      console.log(`✅ ${txCount} transações preparadas para estorno de fluxo de caixa`);

      // COMMIT DA TRANSAÇÃO ATÔMICA - Tudo ou Nada
      await batchOp.commit();
      console.log(`🎯 LOTE ${id} COMPLETAMENTE ESTORNADO NO BANCO DE DADOS!`);

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
    // 1. CUSTO DO GADO E GASTOS (Separado do Frete)
    const custoGado = (batch.valor_compra_total || 0) + (batch.gastos_extras || 0);
    const custoFrete = batch.frete || 0;

    if (custoGado === 0 && custoFrete === 0) return;

    const valorEntrada = (batch as any).valor_entrada || 0;
    const isVista = (batch as any).forma_pagamento === 'VISTA';
    const isPrazo = (batch as any).forma_pagamento === 'PRAZO';

    // FUNÇÕES AUXILIARES DE LANÇAMENTO
    const lancarGado = async () => {
      if (custoGado === 0) return;

      const transactionData = {
        id: `TR-LOTE-${batch.id_lote}`,
        data: batch.data_recebimento,
        descricao: `Compra Lote ${batch.id_lote} - ${batch.fornecedor}`,
        tipo: 'SAIDA',
        categoria: 'COMPRA_GADO',
        valor: custoGado,
        metodo_pagamento: (batch as any).forma_pagamento || 'OUTROS',
        referencia_id: batch.id_lote
      };

      if (isVista) {
        const existingTx = data.transactions.find(t => t.id === `TR-LOTE-${batch.id_lote}`);
        if (!existingTx) await addTransaction(transactionData as any);
      } else if (isPrazo) {
        if (valorEntrada > 0) {
          await addTransaction({
            ...transactionData,
            id: `TR-LOTE-ENTRADA-${batch.id_lote}`,
            descricao: `Entrada/Adiantamento Lote ${batch.id_lote} - ${batch.fornecedor}`,
            valor: valorEntrada
          } as any);
        }
        const valorRestante = custoGado - valorEntrada;
        if (valorRestante > 0) {
          const payableData: Payable = {
            id: `PAY-LOTE-${batch.id_lote}`,
            descricao: `Gado Lote ${batch.id_lote} - ${batch.fornecedor}`,
            valor: valorRestante,
            data_vencimento: new Date(Date.now() + ((batch as any).prazo_dias || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'PENDENTE',
            categoria: 'COMPRA_GADO',
            observacoes: `Compra a Prazo (Entrada: ${valorEntrada > 0 ? valorEntrada : 'Não'})`,
            fornecedor_id: batch.fornecedor,
            id_lote: batch.id_lote
          };
          await setDoc(doc(db, 'payables', payableData.id), payableData);
        }
      }
    }

    const lancarFrete = async () => {
      if (custoFrete === 0) return;
      // O frete VAI SEMPRE para Contas a Pagar, separado, com vencimento em 15 dias (padrão) ou à vista se definido.
      // Se a compra for "VISTA", consideramos o frete também à vista, mas lançamos separado.
      if (isVista) {
        const freteTx = {
          id: `TR-LOTE-FRETE-${batch.id_lote}`,
          data: batch.data_recebimento,
          descricao: `Frete Lote ${batch.id_lote}`,
          tipo: 'SAIDA',
          categoria: 'FRETE',
          valor: custoFrete,
          metodo_pagamento: 'OUTROS',
          referencia_id: batch.id_lote
        };
        const existingTx = data.transactions.find(t => t.id === `TR-LOTE-FRETE-${batch.id_lote}`);
        if (!existingTx) await addTransaction(freteTx as any);
      } else {
        const payableFrete: Payable = {
          id: `PAY-FRETE-${batch.id_lote}`,
          descricao: `Frete Lote ${batch.id_lote}`,
          valor: custoFrete,
          data_vencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 dias para frete
          status: 'PENDENTE',
          categoria: 'COMPRA_GADO', // CORREÇÃO AUDITORIA #4: Usar mesma categoria que o gado para que o estorno e Watchdog encontrem
          observacoes: `Frete desmembrado do Lote ${batch.id_lote}`,
          fornecedor_id: 'TRANSPORTADORA', // Ideal seria pegar a transportadora, fixado para manter lógica atual
          id_lote: batch.id_lote
        };
        await setDoc(doc(db, 'payables', payableFrete.id), payableFrete);
      }
    }

    await lancarGado();
    await lancarFrete();
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
              ? `${groupItems[0].id_lote}-${groupItems[0].sequencia}-INTEIRO`
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
