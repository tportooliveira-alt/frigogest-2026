/**
 * FRIGOGEST → GOOGLE SHEETS SYNC
 * 
 * Envia dados do Firebase para o Google Sheets via Apps Script Web App.
 * Throttle de 30s para não sobrecarregar.
 */

import { AppState, Client, Supplier, Batch, StockItem, Sale, Transaction, Payable, ScheduledOrder } from '../types';

// ============ CONFIG ============

const getWebAppUrl = (): string | null => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_SHEETS_WEBAPP_URL) {
      return (import.meta as any).env.VITE_SHEETS_WEBAPP_URL;
    }
  } catch { }
  return null;
};

// ============ THROTTLE ============

let lastSyncTime = 0;
const THROTTLE_MS = 30_000; // 30 segundos
let syncInProgress = false;

// ============ MAPPERS ============

function mapClients(clients: Client[]): Record<string, string>[] {
  return clients.map(c => ({
    id_ferro: c.id_ferro || '',
    nome_social: c.nome_social || '',
    whatsapp: c.whatsapp || '',
    cpf_cnpj: c.cpf_cnpj || '',
    telefone_residencial: c.telefone_residencial || '',
    endereco: c.endereco || '',
    bairro: c.bairro || '',
    cidade: c.cidade || '',
    cep: c.cep || '',
    limite_credito: String(c.limite_credito || 0),
    saldo_devedor: String(c.saldo_devedor || 0),
    observacoes: c.observacoes || ''
  }));
}

function mapSuppliers(suppliers: Supplier[]): Record<string, string>[] {
  return suppliers.map(s => ({
    id: s.id || '',
    nome_fantasia: s.nome_fantasia || '',
    cpf_cnpj: s.cpf_cnpj || '',
    inscricao_estadual: s.inscricao_estadual || '',
    telefone: s.telefone || '',
    endereco: s.endereco || '',
    cidade: s.cidade || '',
    estado: s.estado || '',
    dados_bancarios: s.dados_bancarios || '',
    observacoes: s.observacoes || ''
  }));
}

function mapBatches(batches: Batch[]): Record<string, string>[] {
  return batches.map(b => ({
    id_lote: b.id_lote || '',
    fornecedor: b.fornecedor || '',
    data_recebimento: b.data_recebimento || '',
    peso_total_romaneio: String(b.peso_total_romaneio || 0),
    valor_compra_total: String(b.valor_compra_total || 0),
    frete: String(b.frete || 0),
    gastos_extras: String(b.gastos_extras || 0),
    custo_real_kg: String(b.custo_real_kg || 0),
    status: b.status || '',
    valor_entrada: String(b.valor_entrada || 0),
    observacoes: ''
  }));
}

function mapStock(stock: StockItem[]): Record<string, string>[] {
  const tipoMap: Record<number, string> = { 1: 'INTEIRO', 2: 'BANDA_A', 3: 'BANDA_B' };
  return stock.map(s => ({
    id_completo: s.id_completo || '',
    id_lote: s.id_lote || '',
    sequencia: String(s.sequencia || 0),
    tipo: tipoMap[s.tipo] || String(s.tipo),
    peso_entrada: String(s.peso_entrada || 0),
    status: s.status || '',
    data_entrada: s.data_entrada || ''
  }));
}

function mapSales(sales: Sale[]): Record<string, string>[] {
  return sales.map(s => ({
    id_venda: s.id_venda || '',
    id_cliente: s.id_cliente || '',
    nome_cliente: s.nome_cliente || '',
    id_completo: s.id_completo || '',
    peso_real_saida: String(s.peso_real_saida || 0),
    preco_venda_kg: String(s.preco_venda_kg || 0),
    data_venda: s.data_venda || '',
    quebra_kg: String(s.quebra_kg || 0),
    custo_extras_total: String(s.custo_extras_total || 0),
    prazo_dias: String(s.prazo_dias || 0),
    data_vencimento: s.data_vencimento || '',
    forma_pagamento: s.forma_pagamento || '',
    status_pagamento: s.status_pagamento || ''
  }));
}

function mapTransactions(transactions: Transaction[]): Record<string, string>[] {
  return transactions.map(t => ({
    id: t.id || '',
    data: t.data || '',
    descricao: t.descricao || '',
    tipo: t.tipo || '',
    categoria: t.categoria || '',
    valor: String(t.valor || 0),
    referencia_id: t.referencia_id || '',
    metodo_pagamento: t.metodo_pagamento || ''
  }));
}

function mapPayables(payables: Payable[]): Record<string, string>[] {
  return payables.map(p => ({
    id: p.id || '',
    descricao: p.descricao || '',
    categoria: p.categoria || '',
    valor: String(p.valor || 0),
    valor_pago: String(p.valor_pago || 0),
    data_vencimento: p.data_vencimento || '',
    data_pagamento: p.data_pagamento || '',
    status: p.status || '',
    fornecedor_id: p.fornecedor_id || '',
    id_lote: p.id_lote || '',
    observacoes: p.observacoes || '',
    recorrente: String(p.recorrente || false)
  }));
}

function mapScheduledOrders(orders: ScheduledOrder[]): Record<string, string>[] {
  return orders.map(o => ({
    id: o.id || '',
    id_cliente: o.id_cliente || '',
    nome_cliente: o.nome_cliente || '',
    data_entrega: o.data_entrega || '',
    hora_entrega: o.hora_entrega || '',
    itens: o.itens || '',
    status: o.status || '',
    data_criacao: o.data_criacao || '',
    alerta_madrugada: String(o.alerta_madrugada || false)
  }));
}

// ============ SYNC PRINCIPAL ============

export async function syncAllToSheets(data: AppState): Promise<{ success: boolean; message: string }> {
  const url = getWebAppUrl();
  if (!url) {
    return { success: false, message: 'VITE_SHEETS_WEBAPP_URL não configurada' };
  }

  // Throttle
  const now = Date.now();
  if (now - lastSyncTime < THROTTLE_MS) {
    return { success: false, message: `Throttle: aguarde ${Math.ceil((THROTTLE_MS - (now - lastSyncTime)) / 1000)}s` };
  }

  if (syncInProgress) {
    return { success: false, message: 'Sync já em andamento' };
  }

  syncInProgress = true;
  lastSyncTime = now;

  try {
    const payload = {
      allData: {
        'Clientes': mapClients(data.clients),
        'Fornecedores': mapSuppliers(data.suppliers),
        'Lotes': mapBatches(data.batches),
        'Estoque': mapStock(data.stock),
        'Vendas': mapSales(data.sales),
        'Fluxo de Caixa': mapTransactions(data.transactions),
        'Contas a Pagar': mapPayables(data.payables),
        'Agendamentos': mapScheduledOrders(data.scheduledOrders)
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script requer text/plain para CORS
      body: JSON.stringify(payload),
      mode: 'no-cors' // Apps Script não suporta preflight CORS
    });

    // No modo no-cors, não temos acesso à resposta, mas o envio foi feito
    console.log('📊 Sheets sync: enviado com sucesso');
    return { success: true, message: 'Dados enviados para a planilha' };

  } catch (error: any) {
    console.warn('📊 Sheets sync erro:', error.message);
    return { success: false, message: error.message };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Força sync ignorando throttle (para uso manual)
 */
export async function forceSyncToSheets(data: AppState): Promise<{ success: boolean; message: string }> {
  lastSyncTime = 0; // Reset throttle
  return syncAllToSheets(data);
}

/**
 * Verifica se a URL do Sheets está configurada
 */
export function isSheetsConfigured(): boolean {
  return !!getWebAppUrl();
}
