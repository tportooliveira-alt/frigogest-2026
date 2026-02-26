import { AppState, StockType, Transaction } from './types';

// ===== VERSÃO DO SISTEMA — FONTE ÚNICA DE VERDADE =====
export const APP_BUILD_DATE = '2026-02-24';
export const APP_VERSION_SHORT = '2.9.2';
export const APP_VERSION_LABEL = 'FrigoGest v2.9.2';
// ======================================================

export const CURRENT_DATE = new Date().toISOString().split('T')[0];

// MOCK_DATA vazio - sistema começa limpo
export const MOCK_DATA: AppState = {
  clients: [],
  batches: [],
  stock: [],
  sales: [],
  transactions: [],
  scheduledOrders: [],
  reports: [],
  suppliers: [],
  payables: []
};

export const INDUSTRY_BENCHMARKS_2026 = {
  RENDIMENTO_NELORE: 54.5,
  RENDIMENTO_ANGUS: 56.2,
  DRIP_LOSS_MAX: 0.8, // % em 24h
  MARGEM_OPERACIONAL_IDEAL: 18.5, // %
  ESG_MIN_COMPLIANCE: 92, // %
  GIRO_ESTOQUE_META: 4, // dias
};

export const getTypeName = (type: StockType) => {
  switch (type) {
    case StockType.INTEIRO: return 'Carcaça Inteira';
    case StockType.BANDA_A: return 'Banda A (Dir)';
    case StockType.BANDA_B: return 'Banda B (Esq)';
    default: return 'Desconhecido';
  }
};