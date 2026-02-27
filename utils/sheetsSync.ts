/**
 * FRIGOGEST → GOOGLE SHEETS SYNC v3.0
 * Todos os campos atualizados: lucro, pago_no_ato, RFM, ESG, romaneio IA, etc.
 * Throttle de 30s para não sobrecarregar.
 */

import { AppState, Client, Supplier, Batch, StockItem, Sale, Transaction, Payable, ScheduledOrder, StockType } from '../types';

const getWebAppUrl = (): string | null => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_SHEETS_WEBAPP_URL) {
      return (import.meta as any).env.VITE_SHEETS_WEBAPP_URL;
    }
  } catch { }
  return null;
};

let lastSyncTime = 0;
const THROTTLE_MS = 30_000;
let syncInProgress = false;

// ============ MAPPERS ATUALIZADOS ============

function mapClients(clients: Client[]): Record<string, string>[] {
  return clients.map(c => ({
    id_ferro: c.id_ferro || '',
    nome_social: c.nome_social || '',
    whatsapp: c.whatsapp || '',
    cpf_cnpj: c.cpf_cnpj || '',
    telefone: c.telefone_residencial || '',
    endereco: c.endereco || '',
    bairro: c.bairro || '',
    cidade: c.cidade || '',
    cep: c.cep || '',
    limite_credito: String(c.limite_credito || 0),
    saldo_devedor: String(c.saldo_devedor || 0),
    status: c.status || 'ATIVO',
    perfil_compra: c.perfil_compra || '',
    padrao_gordura: c.padrao_gordura || '',
    frequencia_ideal_dias: String(c.frequencia_ideal_dias || ''),
    objecoes_frequentes: c.objecoes_frequentes || '',
    preferencias: c.preferencias || '',
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
    raca_predominante: s.raca_predominante || '',
    regiao: s.regiao || '',
    dados_bancarios: s.dados_bancarios || '',
    status: s.status || 'ATIVO',
    observacoes: s.observacoes || ''
  }));
}

function mapBatches(batches: Batch[]): Record<string, string>[] {
  return batches.map(b => ({
    id_lote: b.id_lote || '',
    fornecedor: b.fornecedor || '',
    data_recebimento: b.data_recebimento || '',
    raca: b.raca || '',
    qtd_cabecas: String(b.qtd_cabecas || 0),
    qtd_mortos: String(b.qtd_mortos || 0),
    peso_total_romaneio: String(b.peso_total_romaneio || 0),
    peso_gancho: String(b.peso_gancho || 0),
    rendimento_real: String(b.rendimento_real || 0),
    preco_arroba: String(b.preco_arroba || 0),
    valor_compra_total: String(b.valor_compra_total || 0),
    frete: String(b.frete || 0),
    gastos_extras: String(b.gastos_extras || 0),
    custo_real_kg: String(b.custo_real_kg || 0),
    valor_entrada: String(b.valor_entrada || 0),
    status: b.status || '',
    esg_score: String(b.esg_score || 0),
    vision_audit_status: b.vision_audit_status || '',
    observacoes: ''
  }));
}

function mapStock(stock: StockItem[]): Record<string, string>[] {
  const tipoMap: Record<number, string> = {
    [StockType.INTEIRO]: 'INTEIRO',
    [StockType.BANDA_A]: 'BANDA A',
    [StockType.BANDA_B]: 'BANDA B'
  };
  return stock.map(s => ({
    id_completo: s.id_completo || '',
    id_lote: s.id_lote || '',
    sequencia: String(s.sequencia || 0),
    tipo: tipoMap[s.tipo] || String(s.tipo),
    peso_entrada: String(s.peso_entrada || 0),
    status: s.status || '',
    data_entrada: s.data_entrada || '',
    gordura: String(s.gordura || ''),
    marmoreio: String(s.marmoreio || ''),
    conformacao: s.conformacao || ''
  }));
}

function mapSales(sales: Sale[]): Record<string, string>[] {
  return sales.map(s => ({
    id_venda: s.id_venda || '',
    id_cliente: s.id_cliente || '',
    nome_cliente: s.nome_cliente || '',
    id_completo: s.id_completo || '',
    data_venda: s.data_venda || '',
    peso_real_saida: String(s.peso_real_saida || 0),
    preco_venda_kg: String(s.preco_venda_kg || 0),
    valor_total: String((s.peso_real_saida || 0) * (s.preco_venda_kg || 0)),
    lucro_liquido_unitario: String(s.lucro_liquido_unitario || 0),
    lucro_total_venda: String((s.lucro_liquido_unitario || 0) * (s.peso_real_saida || 0)),
    quebra_kg: String(s.quebra_kg || 0),
    custo_extras_total: String(s.custo_extras_total || 0),
    forma_pagamento: s.forma_pagamento || '',
    prazo_dias: String(s.prazo_dias || 0),
    data_vencimento: s.data_vencimento || '',
    status_pagamento: s.status_pagamento || '',
    valor_pago: String(s.valor_pago || 0),
    valor_pendente: String(Math.max(0, (s.peso_real_saida * s.preco_venda_kg) - (s.valor_pago || 0)))
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
    valor_pendente: String(Math.max(0, (p.valor || 0) - (p.valor_pago || 0))),
    data_vencimento: p.data_vencimento || '',
    data_pagamento: p.data_pagamento || '',
    status: p.status || '',
    fornecedor_id: p.fornecedor_id || '',
    id_lote: p.id_lote || '',
    recorrente: String(p.recorrente || false),
    observacoes: p.observacoes || ''
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

// KPIs calculados para o Dashboard
function calcKPIs(data: AppState) {
  const activeSales = data.sales.filter(s => s.status_pagamento !== 'ESTORNADO');
  const totalReceita = activeSales.reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg, 0);
  const totalLucro = activeSales.reduce((s, v) => s + (v.lucro_liquido_unitario || 0) * v.peso_real_saida, 0);
  const totalPeso = activeSales.reduce((s, v) => s + v.peso_real_saida, 0);
  const ticketMedio = activeSales.length > 0 ? totalReceita / activeSales.length : 0;
  const margemMedia = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
  const totalPendente = activeSales.filter(s => s.status_pagamento === 'PENDENTE').reduce((s, v) => s + v.peso_real_saida * v.preco_venda_kg - (v.valor_pago || 0), 0);
  const totalPagar = data.payables.filter(p => p.status === 'PENDENTE').reduce((s, p) => s + p.valor - (p.valor_pago || 0), 0);
  const estoque = data.stock.filter(s => s.status === 'DISPONIVEL').length;
  const pesoEstoque = data.stock.filter(s => s.status === 'DISPONIVEL').reduce((s, i) => s + i.peso_entrada, 0);

  return [
    { kpi: 'Receita Total', valor: String(totalReceita.toFixed(2)), unidade: 'R$' },
    { kpi: 'Lucro Total', valor: String(totalLucro.toFixed(2)), unidade: 'R$' },
    { kpi: 'Margem Média', valor: String(margemMedia.toFixed(2)), unidade: '%' },
    { kpi: 'Ticket Médio por Venda', valor: String(ticketMedio.toFixed(2)), unidade: 'R$' },
    { kpi: 'Total Vendido (kg)', valor: String(totalPeso.toFixed(3)), unidade: 'kg' },
    { kpi: 'Qtde de Vendas', valor: String(activeSales.length), unidade: 'vendas' },
    { kpi: 'A Receber (clientes)', valor: String(totalPendente.toFixed(2)), unidade: 'R$' },
    { kpi: 'A Pagar (fornecedores)', valor: String(totalPagar.toFixed(2)), unidade: 'R$' },
    { kpi: 'Peças em Estoque', valor: String(estoque), unidade: 'peças' },
    { kpi: 'Peso em Estoque (kg)', valor: String(pesoEstoque.toFixed(3)), unidade: 'kg' },
    { kpi: 'Clientes Ativos', valor: String(data.clients.filter(c => c.status !== 'INATIVO').length), unidade: 'clientes' },
    { kpi: 'Lotes Abertos', valor: String(data.batches.filter(b => b.status === 'ABERTO').length), unidade: 'lotes' },
  ];
}

// ============ SYNC PRINCIPAL ============

export async function syncAllToSheets(data: AppState): Promise<{ success: boolean; message: string }> {
  const url = getWebAppUrl();
  if (!url) return { success: false, message: 'VITE_SHEETS_WEBAPP_URL não configurada' };

  const now = Date.now();
  if (now - lastSyncTime < THROTTLE_MS) {
    return { success: false, message: `Throttle: aguarde ${Math.ceil((THROTTLE_MS - (now - lastSyncTime)) / 1000)}s` };
  }
  if (syncInProgress) return { success: false, message: 'Sync já em andamento' };

  syncInProgress = true;
  lastSyncTime = now;

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      version: '3.0',
      allData: {
        '🏠 KPIs Dashboard': calcKPIs(data),
        '📦 Lotes': mapBatches(data.batches),
        '🥩 Estoque': mapStock(data.stock),
        '🛒 Vendas': mapSales(data.sales),
        '💰 Fluxo de Caixa': mapTransactions(data.transactions),
        '📋 Contas a Pagar': mapPayables(data.payables),
        '👥 Clientes': mapClients(data.clients),
        '🚛 Fornecedores': mapSuppliers(data.suppliers),
        '📅 Agendamentos': mapScheduledOrders(data.scheduledOrders)
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    let result: any = {};
    try {
      const text = await response.text();
      result = JSON.parse(text);
      console.log('📊 Sheets sync:', result);
    } catch {
      console.log('📊 Sheets sync status:', response.status);
    }

    if (response.ok || response.status === 0) {
      return { success: true, message: `✅ Sincronizado! ${new Date().toLocaleTimeString('pt-BR')}` };
    } else {
      return { success: false, message: `HTTP ${response.status}: ${result.message || 'erro'}` };
    }
  } catch (error: any) {
    console.warn('📊 Sheets sync erro:', error.message);
    return { success: false, message: error.message };
  } finally {
    syncInProgress = false;
  }
}

export async function forceSyncToSheets(data: AppState): Promise<{ success: boolean; message: string }> {
  lastSyncTime = 0;
  return syncAllToSheets(data);
}

export function isSheetsConfigured(): boolean {
  return !!getWebAppUrl();
}
