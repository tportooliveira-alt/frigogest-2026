
// Data Models based on the Prompt's SQL Schema

export interface Client {
  id_ferro: string; // PK: ID_FERRO
  nome_social: string;
  whatsapp: string;
  limite_credito: number;
  saldo_devedor: number;
  cpf_cnpj?: string;
  cep?: string;
  telefone_residencial?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  observacoes?: string;
}

export interface Supplier {
  id: string;
  nome_fantasia: string; // Nome da Fazenda ou Proprietário
  cpf_cnpj: string;
  inscricao_estadual?: string;
  telefone: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  dados_bancarios?: string; // PIX ou Conta
  observacoes?: string;
}

export interface Batch {
  id_lote: string; // PK
  fornecedor: string;
  data_recebimento: string; // ISO Date
  peso_total_romaneio: number;
  valor_compra_total: number;
  frete: number;
  gastos_extras: number;
  custo_real_kg: number;
  url_romaneio?: string; // Novo campo para imagem/PDF do romaneio original
  status?: 'ABERTO' | 'FECHADO';
  valor_entrada?: number; // Valor de entrada/adiantamento para compras a prazo
}

export enum StockType {
  INTEIRO = 1,
  BANDA_A = 2,
  BANDA_B = 3,
}

export interface StockItem {
  id_completo: string; // PK: LOTE-SEQ-TIPO
  id_lote: string; // FK
  sequencia: number;
  tipo: StockType;
  peso_entrada: number;
  peso_animal_entrada?: number; // Soma de A+B ou Integral
  status: 'DISPONIVEL' | 'VENDIDO';
  data_entrada: string;
}

export type PaymentMethod = 'DINHEIRO' | 'PIX' | 'CHEQUE' | 'BOLETO' | 'TRANSFERENCIA' | 'OUTROS';

export interface Sale {
  id_venda: string;
  id_cliente: string;
  nome_cliente?: string; // Persistência do nome para histórico
  id_completo: string;
  peso_real_saida: number;
  preco_venda_kg: number;
  data_venda: string;
  quebra_kg: number;
  lucro_liquido_unitario: number;
  custo_extras_total: number;
  prazo_dias: number;
  data_vencimento: string;
  forma_pagamento: PaymentMethod;
  status_pagamento: 'PENDENTE' | 'PAGO';
}

export interface ScheduledOrder {
  id: string;
  id_cliente: string;
  nome_cliente: string;
  data_entrega: string; // ISO Date (YYYY-MM-DD)
  hora_entrega?: string; // HH:MM
  itens: string;
  status: 'ABERTO' | 'CONFIRMADO' | 'CANCELADO';
  data_criacao: string;
  alerta_madrugada: boolean; // Se deve alertar sobre gado saindo de madrugada
}

export interface Transaction {
  id: string;
  data: string;
  descricao: string;
  tipo: 'ENTRADA' | 'SAIDA';
  categoria: 'VENDA' | 'COMPRA_GADO' | 'OPERACIONAL' | 'ADMINISTRATIVO' | 'OUTROS' | 'ESTRUTURA' | 'FUNCIONARIOS' | 'INSUMOS' | 'MANUTENCAO' | 'IMPOSTOS' | 'DESCONTO';
  valor: number;
  referencia_id?: string;
  metodo_pagamento?: PaymentMethod;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO String
  userId: string;
  userEmail: string;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'OTHER';
  entity: 'CLIENT' | 'BATCH' | 'STOCK' | 'SALE' | 'TRANSACTION' | 'ORDER' | 'SYSTEM' | 'OTHER';
  details: string; // Human readable description
  metadata?: any; // ID of the object changed, or old/new values
}

export interface DailyReport {
  id: string;
  date: string; // ISO Date YYYY-MM-DD
  timestamp: string; // ISO Full
  userId?: string;
  userName?: string;
  intensity: 'tranquilo' | 'normal' | 'intenso';
  sentiment?: 'positive' | 'negative' | 'neutral';
  notes: string;
  type: 'RELATORIO' | 'RECLAMACAO';
  extra_movement?: boolean;
  technical_issues?: boolean;
  audio_url?: string;
  client_complaint_audio_url?: string;
  video_url?: string; // URL do vídeo da jornada ou ocorrência
}

export interface AppState {
  clients: Client[];
  batches: Batch[];
  stock: StockItem[];
  sales: Sale[];
  transactions: Transaction[];
  scheduledOrders: ScheduledOrder[];
  reports: DailyReport[];
  suppliers: Supplier[];
  payables: Payable[];
}

export interface Payable {
  id: string;
  descricao: string;
  categoria: 'OPERACIONAL' | 'ESTRUTURA' | 'FUNCIONARIOS' | 'INSUMOS' | 'MANUTENCAO' | 'IMPOSTOS' | 'OUTROS' | 'COMPRA_GADO';

  valor: number;
  valor_pago?: number;
  data_vencimento: string; // ISO YYYY-MM-DD
  data_pagamento?: string;
  status: 'PENDENTE' | 'PAGO' | 'PARCIAL' | 'ATRASADO';
  fornecedor_id?: string; // Opcional, link com Supplier
  id_lote?: string; // NOVO: Referência ao lote de gado comprado
  observacoes?: string;
  recorrente?: boolean;
}
