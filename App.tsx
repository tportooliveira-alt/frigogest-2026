import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Batches from './components/Batches';
import Stock from './components/Stock';
import Expedition from './components/Expedition';
import Financial from './components/Financial';
import SalesHistory from './components/SalesHistory';
import AIEditor from './components/AIEditor';
import ScheduledOrders from './components/ScheduledOrders';
import Login from './components/Login';
import SystemReset from './components/SystemReset';
import Suppliers from './components/Suppliers';
import { AppState, Sale, PaymentMethod, StockItem, Batch, Client, Transaction, DailyReport, Supplier, Payable } from './types';
import { MOCK_DATA } from './constants';
import { auth, db } from './firebaseClient';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, writeBatch, query, limit } from 'firebase/firestore';
import { Cloud, CloudOff, Loader2, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import { logAction } from './utils/audit';
import CollaboratorReport from './components/CollaboratorReport';
import HeiferManager from './components/HeiferManager';
import SalesAgent from './components/SalesAgent';
import AuditLogView from './components/AuditLogView';

const App: React.FC = () => {
  // MODO OFFLINE: mude para true para testar sem internet
  const OFFLINE_MODE = false;

  const [session, setSession] = useState<any>(OFFLINE_MODE ? { user: { email: 'offline@local' } } : null);
  const [currentView, setCurrentView] = useState('menu');
  const [viewParams, setViewParams] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<'online' | 'offline' | 'checking'>(OFFLINE_MODE ? 'offline' : 'checking');
  const [data, setData] = useState<AppState>({ ...MOCK_DATA, scheduledOrders: [], suppliers: [], payables: [] });
  const [loading, setLoading] = useState(!OFFLINE_MODE);

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

  const handleDeletePayable = async (id: string) => {
    try {
      if (OFFLINE_MODE) {
        setData(prev => ({ ...prev, payables: prev.payables.filter(p => p.id !== id) }));
        return;
      }
      await deleteDoc(doc(db, 'payables', id));
      setData(prev => ({ ...prev, payables: prev.payables.filter(p => p.id !== id) }));
      logAction(session.user, 'DELETE', 'OTHER', `Conta excluída ID: ${id}`, { id });
    } catch (e) {
      console.error(e);
      alert('Erro ao remover conta.');
    }
  };

  const sanitize = (val: any) => JSON.parse(JSON.stringify(val));

  const addBatch = async (batch: any): Promise<{ success: boolean; error?: string }> => {
    const cleanBatch = { ...batch };

    // Log
    if (session?.user) {
      logAction(session.user, 'CREATE', 'BATCH', `Novo lote criado: ${cleanBatch.id_lote} - ${cleanBatch.fornecedor}`);
    }

    // Preservar informações de pagamento temporariamente para uso na transação
    const formPagamento = cleanBatch.forma_pagamento || 'OUTROS';
    const isVista = cleanBatch.pagamento_a_vista === true;

    delete cleanBatch.pagamento_a_vista;
    delete cleanBatch.forma_pagamento;

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

      // REGISTRAR NO FINANCEIRO AUTOMATICAMENTE
      // Se for à vista OU se quiser registrar a despesa mesmo que a prazo (geralmente compra registra na data da compra)
      // O usuário pediu: "tem que entrar no caixa vermelho e saida"
      const totalCost = (cleanBatch.valor_compra_total || 0) + (cleanBatch.frete || 0) + (cleanBatch.gastos_extras || 0);

      if (totalCost > 0 && formPagamento === 'VISTA') {
        const transactionData = {
          id: `TR-LOTE-${cleanBatch.id_lote}`,
          data: cleanBatch.data_recebimento,
          descricao: `Compra Lote ${cleanBatch.id_lote} - ${cleanBatch.fornecedor}`,
          tipo: 'SAIDA',
          categoria: 'COMPRA_GADO',
          valor: totalCost,
          metodo_pagamento: formPagamento,
          referencia_id: cleanBatch.id_lote
        };
        await addTransaction(transactionData as any);
      } else if (totalCost > 0 && formPagamento === 'PRAZO') {
        // Se for a prazo, registra no CONTAS A PAGAR
        const payableData: Payable = {
          id: `PAY-LOTE-${cleanBatch.id_lote}`,
          id_lote: cleanBatch.id_lote, // IMPORTANTE: salvar id_lote para poder deletar junto
          descricao: `Compra Lote ${cleanBatch.id_lote} - ${cleanBatch.fornecedor}`,
          valor: totalCost,
          data_vencimento: new Date(Date.now() + ((cleanBatch.prazo_dias || 30) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          status: 'PENDENTE',
          categoria: 'COMPRA_GADO',
          observacoes: `Compra de Lote a Prazo`
        };
        const docRef = await addDoc(collection(db, 'payables'), payableData);
        await setDoc(docRef, { ...payableData, id: docRef.id });
      }

      await fetchData();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const deleteBatch = async (id: string) => {
    if (OFFLINE_MODE) {
      setData(prev => ({
        ...prev,
        batches: prev.batches.filter(b => b.id_lote !== id),
        stock: prev.stock.filter(s => s.id_lote !== id),
        payables: prev.payables.filter(p => p.id_lote !== id),
        sales: prev.sales.filter(s => !s.id_completo.startsWith(id)),
        transactions: prev.transactions.filter(t => t.referencia_id !== id)
      }));
      return;
    }

    if (!db) return;

    try {
      console.log(`🗑️ INICIANDO EXCLUSÃO COMPLETA DO LOTE: ${id}`);

      // 1. Deletar o lote principal
      await deleteDoc(doc(db, 'batches', id));
      console.log(`✅ Lote ${id} deletado`);

      // 2. Deletar TODOS os itens de estoque do lote
      const stockQuery = query(collection(db, 'stock_items'));
      const stockSnapshot = await getDocs(stockQuery);
      const deleteStockPromises: Promise<void>[] = [];
      let stockCount = 0;
      stockSnapshot.forEach(docSnap => {
        const item = docSnap.data();
        if (item.id_lote === id) {
          deleteStockPromises.push(deleteDoc(doc(db, 'stock_items', docSnap.id)));
          stockCount++;
        }
      });
      await Promise.all(deleteStockPromises);
      console.log(`✅ ${stockCount} itens de estoque deletados`);

      // 3. Deletar TODAS as transações financeiras (payables) do lote
      const payablesQuery = query(collection(db, 'payables'));
      const payablesSnapshot = await getDocs(payablesQuery);
      const deletePayablesPromises: Promise<void>[] = [];
      let payablesCount = 0;
      payablesSnapshot.forEach(docSnap => {
        const payable = docSnap.data();
        // Deletar se: id_lote bate OU se o ID/descrição contém o id_lote
        const matchByIdLote = payable.id_lote === id;
        const matchById = payable.id && payable.id.includes(id);
        const matchByDescricao = payable.descricao && payable.descricao.includes(id);
        if (matchByIdLote || matchById || matchByDescricao) {
          deletePayablesPromises.push(deleteDoc(doc(db, 'payables', docSnap.id)));
          payablesCount++;
        }
      });
      await Promise.all(deletePayablesPromises);
      console.log(`✅ ${payablesCount} contas a pagar deletadas`);

      // 4. Deletar TODAS as vendas (sales) do lote
      const salesQuery = query(collection(db, 'sales'));
      const salesSnapshot = await getDocs(salesQuery);
      const deleteSalesPromises: Promise<void>[] = [];
      let salesCount = 0;
      salesSnapshot.forEach(docSnap => {
        const sale = docSnap.data();
        // id_completo formato: "LOTE-SEQ-TIPO"
        if (sale.id_completo && sale.id_completo.startsWith(id)) {
          deleteSalesPromises.push(deleteDoc(doc(db, 'sales', docSnap.id)));
          salesCount++;
        }
      });
      await Promise.all(deleteSalesPromises);
      console.log(`✅ ${salesCount} vendas deletadas`);

      // 5. Deletar TODAS as transações (transactions) do lote
      const transactionsQuery = query(collection(db, 'transactions'));
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const deleteTransactionsPromises: Promise<void>[] = [];
      let transactionsCount = 0;
      transactionsSnapshot.forEach(docSnap => {
        const transaction = docSnap.data();
        // Deletar se referencia_id é o lote OU se a descrição menciona o lote
        if (transaction.referencia_id === id || (transaction.descricao && transaction.descricao.includes(id))) {
          deleteTransactionsPromises.push(deleteDoc(doc(db, 'transactions', docSnap.id)));
          transactionsCount++;
        }
      });
      await Promise.all(deleteTransactionsPromises);
      console.log(`✅ ${transactionsCount} transações deletadas`);

      console.log(`🎯 LOTE ${id} COMPLETAMENTE ELIMINADO!`);
      console.log(`📊 RESUMO: Lote + ${stockCount} estoque + ${payablesCount} payables + ${salesCount} vendas + ${transactionsCount} transações`);

      if (session?.user) {
        logAction(
          session.user,
          'DELETE',
          'BATCH',
          `Lote COMPLETAMENTE excluído: ${id} (${stockCount} estoque, ${payablesCount} payables, ${salesCount} vendas, ${transactionsCount} transações)`
        );
      }

      fetchData();
    } catch (error) {
      console.error('❌ Erro ao excluir lote:', error);
      alert('Erro ao excluir o lote. Verifique o console.');
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
    const totalCost = (batch.valor_compra_total || 0) + (batch.frete || 0) + (batch.gastos_extras || 0);
    if (totalCost === 0) return;

    const transactionData = {
      id: `TR-LOTE-${batch.id_lote}`,
      data: batch.data_recebimento,
      descricao: `Compra Lote ${batch.id_lote} - ${batch.fornecedor}`,
      tipo: 'SAIDA',
      categoria: 'COMPRA_GADO',
      valor: totalCost,
      metodo_pagamento: (batch as any).forma_pagamento || 'OUTROS',
      referencia_id: batch.id_lote
    };

    const valorEntrada = (batch as any).valor_entrada || 0;
    const isVista = (batch as any).forma_pagamento === 'VISTA';
    const isPrazo = (batch as any).forma_pagamento === 'PRAZO';

    if (isVista) {
      // PAGAMENTO TOTAL A VISTA
      await addTransaction(transactionData);
    } else if (isPrazo) {

      // 1. SE TIVER ENTRADA, LANÇA A SAÍDA DA ENTRADA AGORA
      if (valorEntrada > 0) {
        const entradaTransaction = {
          ...transactionData,
          id: `TR-LOTE-ENTRADA-${batch.id_lote}`,
          descricao: `Entrada/Adiantamento Lote ${batch.id_lote} - ${batch.fornecedor}`,
          valor: valorEntrada
        };
        await addTransaction(entradaTransaction);
      }

      // 2. O RESTANTE VAI PARA CONTAS A PAGAR
      const valorRestante = totalCost - valorEntrada;
      if (valorRestante > 0) {
        // GUARD: Verificar se já existe payable para este lote
        const existingPayables = data.payables.filter(p => p.id_lote === batch.id_lote || p.id === `PAY-LOTE-${batch.id_lote}`);
        if (existingPayables.length > 0) {
          console.log(`⚠️ Payable já existe para lote ${batch.id_lote}, ignorando duplicata.`);
          return;
        }

        const payableData: Payable = {
          id: `PAY-LOTE-${batch.id_lote}`,
          descricao: `Restante Lote ${batch.id_lote} - ${batch.fornecedor}`,
          valor: valorRestante,
          data_vencimento: new Date(Date.now() + ((batch as any).prazo_dias || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'PENDENTE',
          categoria: 'COMPRA_GADO',
          observacoes: `Compra a Prazo (Entrada: ${valorEntrada > 0 ? valorEntrada : 'Não'})`,
          fornecedor_id: batch.fornecedor,
          id_lote: batch.id_lote
        };
        // Usar doc com ID determinístico para evitar duplicatas
        const docRef = doc(db, 'payables', `PAY-LOTE-${batch.id_lote}`);
        await setDoc(docRef, payableData);
      }
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

    const removeStockItem = async (id_completo: string) => {
      if (!db) return;
      await deleteDoc(doc(db, 'stock_items', id_completo));
      if (session?.user) logAction(session.user, 'DELETE', 'STOCK', `Item removido do estoque: ${id_completo}`);
      fetchData();
    };

    const updateSaleCost = async (id_venda: string, newCost: number) => {
      if (!db) return;
      await updateDoc(doc(db, 'sales', id_venda), { custo_extras_total: newCost });
      fetchData();
    };

    const deleteTransaction = async (id: string) => {
      if (!db) return;
      await deleteDoc(doc(db, 'transactions', id));
      fetchData();
    };

    const addPartialPayment = async (saleId: string, valorPagamento: number, method: PaymentMethod, date: string) => {
      const sale = data.sales.find(s => s.id_venda === saleId);
      if (!sale || !db) return;

      const valorTotal = sale.peso_real_saida * sale.preco_venda_kg;
      const valorPagoAtual = (sale as any).valor_pago || 0;
      const novoValorPago = valorPagoAtual + valorPagamento;
      const status = novoValorPago >= valorTotal ? 'PAGO' : 'PENDENTE';

      try {
        await updateDoc(doc(db, 'sales', saleId), {
          valor_pago: novoValorPago,
          status_pagamento: status,
          forma_pagamento: method
        });

        const transaction = {
          id: `TR-PARC-${saleId}-${Date.now()}`,
          data: date,
          descricao: `Pagamento ${novoValorPago >= valorTotal ? 'Final' : 'Parcial'} - ${sale.nome_cliente || 'Cliente'} - ${sale.id_completo}`,
          tipo: 'ENTRADA',
          categoria: 'VENDA',
          valor: valorPagamento,
          referencia_id: saleId,
          metodo_pagamento: method
        };

        await addTransaction(transaction);
        // addTransaction already logs, but specialized log might be nice? Handled by addTransaction for now.
        fetchData();
      } catch (error) {
        console.error('Error adding partial payment:', error);
      }
    };

    const receiveClientPayment = async (clientId: string, amount: number, method: PaymentMethod, date: string) => {
      const pendingSales = data.sales
        .filter(s => s.id_cliente === clientId && s.status_pagamento === 'PENDENTE')
        .sort((a, b) => new Date(a.data_venda).getTime() - new Date(b.data_venda).getTime());

      let remaining = amount;
      let count = 0;

      for (const sale of pendingSales) {
        if (remaining <= 0.01) break;
        const total = sale.peso_real_saida * sale.preco_venda_kg;
        const pago = (sale as any).valor_pago || 0;
        const devendo = total - pago;
        const pagarNesta = Math.min(devendo, remaining);

        if (pagarNesta > 0) {
          await addPartialPayment(sale.id_venda, pagarNesta, method, date);
          remaining -= pagarNesta;
          count++;
        }
      }

      if (count > 0) {
        if (session?.user) logAction(session.user, 'CREATE', 'TRANSACTION', `Pagamento recebido de cliente: ${amount} (${method})`);
        fetchData();
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
        {currentView === 'menu' && <Sidebar setView={setCurrentView} onLogout={handleLogout} />}
        {currentView === 'system_reset' && <SystemReset onBack={() => setCurrentView('menu')} refreshData={fetchData} />}
        {currentView === 'dashboard' && <Dashboard sales={data.sales} stock={data.stock} transactions={data.transactions} batches={data.batches} clients={data.clients} onBack={() => setCurrentView('menu')} />}
        {
          currentView === 'clients' && <Clients
            clients={data.clients}
            sales={data.sales}
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
            deleteClient={async (id) => {
              if (db) {
                await deleteDoc(doc(db, 'clients', id));
                if (session?.user) logAction(session.user, 'DELETE', 'CLIENT', `Cliente excluído: ${id}`);
                fetchData();
              }
            }}
            receiveClientPayment={receiveClientPayment}
            onBack={() => setCurrentView('menu')}
          />
        }
        {
          currentView === 'suppliers' && <Suppliers
            suppliers={data.suppliers}
            addSupplier={handleAddSupplier}
            updateSupplier={handleUpdateSupplier}
            deleteSupplier={handleDeleteSupplier}
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
            deleteBatch={deleteBatch}
            addStockItem={addStockItem}
            updateStockItem={updateStockItem}
            removeStockItem={removeStockItem}
            registerBatchFinancial={registerBatchFinancial}
            onGoToStock={() => setCurrentView('stock')}
            onBack={() => setCurrentView('menu')}
          />
        }
        {currentView === 'stock' && <Stock
          stock={data.stock}
          batches={data.batches}
          sales={data.sales}
          clients={data.clients}
          updateBatch={async (id, updates) => {
            if (!db) return;
            await updateDoc(doc(db, 'batches', id), sanitize(updates));
            if (session?.user) logAction(session.user, 'UPDATE', 'BATCH', `Lote atualizado: ${id}`);
            fetchData();
          }}
          deleteBatch={deleteBatch}
          onBack={() => setCurrentView('menu')}
        />}
        {
          currentView === 'expedition' && <Expedition clients={data.clients} stock={data.stock} batches={data.batches} salesHistory={data.sales} onConfirmSale={(saleData) => {
            const { client, items, pricePerKg, extrasCost } = saleData;

            // AGRUPAR: Banda A + Banda B do mesmo animal = CARCAÇA INTEIRA
            const groupedItems = new Map<string, any[]>();
            items.forEach((item: any) => {
              const key = `${item.id_lote}-${item.sequencia}`;
              if (!groupedItems.has(key)) groupedItems.set(key, []);
              groupedItems.get(key)!.push(item);
            });

            const newSales: Sale[] = [];
            let groupIndex = 0;

            groupedItems.forEach((groupItems, key) => {
              const isCarcacaInteira = groupItems.length > 1; // Banda A + Banda B = 2 itens
              const batch = data.batches.find(b => b.id_lote === groupItems[0].id_lote);
              const custoKg = batch ? batch.custo_real_kg : 0;

              // Somar pesos de todos os itens do grupo
              const pesoEntradaTotal = groupItems.reduce((acc: number, i: any) => acc + i.peso_entrada, 0);
              const pesoSaidaTotal = groupItems.reduce((acc: number, i: any) => acc + (i.peso_saida || i.peso_entrada), 0);
              const quebraTotal = pesoEntradaTotal - pesoSaidaTotal;

              // Calcular lucro consolidado
              const revenue = pesoSaidaTotal * pricePerKg;
              const cost = pesoSaidaTotal * custoKg;
              const groupExtraCost = (extrasCost / groupedItems.size);
              const profit = revenue - cost - groupExtraCost;

              // ID: se for carcaça inteira, usa ID especial
              const idCompleto = isCarcacaInteira
                ? `${groupItems[0].id_lote}-${groupItems[0].sequencia}-INTEIRO`
                : groupItems[0].id_completo;

              newSales.push({
                id_venda: `V-${Date.now()}-${groupIndex++}`,
                id_cliente: client.id_ferro,
                nome_cliente: client.nome_social,
                id_completo: idCompleto,
                peso_real_saida: pesoSaidaTotal,
                preco_venda_kg: pricePerKg,
                data_venda: new Date().toISOString().split('T')[0],
                quebra_kg: quebraTotal,
                lucro_liquido_unitario: profit,
                custo_extras_total: groupExtraCost,
                prazo_dias: 30,
                data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                forma_pagamento: 'OUTROS',
                status_pagamento: 'PENDENTE',
                tipo_venda: isCarcacaInteira ? 'CARCACA_INTEIRA' : 'BANDA_AVULSA',
                // IDs originais dos itens no estoque (para marcar como vendido)
                stock_ids_originais: groupItems.map((i: any) => i.id_completo)
              } as any);
            });

            addSales(newSales);
            setCurrentView('sales_history');
          }} onBack={() => setCurrentView('menu')} />
        }
        {currentView === 'sales_history' && <SalesHistory stock={data.stock} batches={data.batches} sales={data.sales} clients={data.clients} initialSearchTerm={viewParams?.searchTerm} onBack={() => setCurrentView('menu')} />}
        {currentView === 'financial' && <Financial sales={data.sales} batches={data.batches} stock={data.stock} clients={data.clients} transactions={data.transactions} updateSaleCost={updateSaleCost} addTransaction={addTransaction} deleteTransaction={deleteTransaction} addPartialPayment={addPartialPayment} onBack={() => setCurrentView('menu')} payables={data.payables} addPayable={handleAddPayable} updatePayable={handleUpdatePayable} deletePayable={handleDeletePayable} />}
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
          />
        }
        {currentView === 'aistudio' && <AIEditor onBack={() => setCurrentView('menu')} />}
        {currentView === 'audit' && <AuditLogView onBack={() => setCurrentView('menu')} />}
        {currentView === 'system_reset' && <SystemReset onBack={() => setCurrentView('menu')} refreshData={fetchData} />}

        {/* SYSTEM STATUS BAR */}
        <div className="fixed bottom-3 left-3 right-3 md:bottom-8 md:left-8 md:right-auto z-[200] flex flex-col md:flex-row gap-2 md:gap-3 pointer-events-none items-stretch md:items-center">
          {dbStatus === 'online' && (
            <div className="bg-white/80 backdrop-blur-xl border border-emerald-50 text-emerald-600 px-4 py-2 rounded-xl md:rounded-2xl font-black text-[8px] md:text-[9px] uppercase tracking-[0.15em] md:tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/5 animate-reveal">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="hidden md:inline">CORE: SINAL_CRIPTOGRAFADO</span>
              <span className="md:hidden">ONLINE</span>
            </div>
          )}
          {dbStatus === 'offline' && (
            <div className="bg-white/80 backdrop-blur-xl border border-rose-50 text-rose-600 px-4 py-2 rounded-xl md:rounded-2xl font-black text-[8px] md:text-[9px] uppercase tracking-[0.15em] md:tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl shadow-rose-900/5 animate-reveal">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
              <span className="hidden md:inline">CORE: LINK_AUSENTE</span>
              <span className="md:hidden">OFFLINE</span>
            </div>
          )}

          {/* Botão Atualizar App - SEMPRE VISÍVEL */}
          <button
            onClick={() => {
              if (window.confirm('🔄 Atualizar aplicativo?\n\nIsso irá buscar a versão mais recente do app.\n\n⚠️ IMPORTANTE: Seus dados (lotes, financeiro, estoque) NÃO serão afetados!\n\nDeseja continuar?')) {
                window.location.reload();
              }
            }}
            className="pointer-events-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.15em] md:tracking-[0.2em] flex items-center justify-center gap-2 shadow-xl transition-all hover:scale-105 active:scale-95 animate-reveal cursor-pointer"
            title="Clique para atualizar o app e carregar a versão mais recente"
          >
            <RefreshCw size={14} className="animate-spin-slow" />
            <span>Atualizar App</span>
          </button>

          <div className="bg-slate-900 text-white px-4 py-2 rounded-xl md:rounded-2xl font-black text-[8px] md:text-[9px] uppercase tracking-[0.15em] md:tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_20px_40px_rgba(15,23,42,0.3)] animate-reveal">
            <Activity size={12} className="text-blue-400" />
            <span className="hidden md:inline">FG-PRO_v2.5.5</span>
            <span className="md:hidden">v2.5.5</span>
          </div>
        </div>
      </div >
    );
  };

  export default App;
