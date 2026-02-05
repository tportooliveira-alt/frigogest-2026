import { AppState, StockType, Transaction } from './types';

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