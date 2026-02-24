import { AppState, StockType, Transaction } from './types';

// ===== VERSÃO DO SISTEMA — FONTE ÚNICA DE VERDADE =====
export const APP_VERSION = '2.9.0';
export const APP_BUILD_DATE = '2026-02-24';
export const APP_VERSION_LABEL = `FG-PRO_v${APP_VERSION}`;
export const APP_VERSION_SHORT = `v${APP_VERSION}`;
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

export const getTypeName = (type: StockType) => {
  switch (type) {
    case StockType.INTEIRO: return 'Carcaça Inteira';
    case StockType.BANDA_A: return 'Banda A (Dir)';
    case StockType.BANDA_B: return 'Banda B (Esq)';
    default: return 'Desconhecido';
  }
};