
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
  status?: 'ATIVO' | 'INATIVO'; // Para inativação em vez de delete
  // ═══ CAMPOS CRM E INTELIGÊNCIA (FASE 3) ═══
  perfil_compra?: 'BOI' | 'NOVILHA' | 'MISTO'; // Preferência do tipo de carne
  padrao_gordura?: 'MAGRO' | 'MEDIO' | 'GORDO' | 'EXPORTACAO'; // Nível de exigência de acabamento
  objecoes_frequentes?: string; // O que o cliente sempre reclama (ex: "acha o preço caro", "não gosta de osso")
  preferencias?: string; // Observações extras de venda (ex: "só compra com 30 dias de prazo")
  frequencia_ideal_dias?: number; // Para o CRM calcular churn e clientes esfriando
  mimo_recebido_data?: string; // ISO date de quando ganhou o último mimo/brinde
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
  status?: 'ATIVO' | 'INATIVO'; // Para inativação em vez de delete
  raca_predominante?: string; // Raça principal do rebanho (Nelore, Angus×Nelore, etc.)
  regiao?: string; // Região/praça do fornecedor (ex: "BA Sul", "MT Norte")
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
  status?: 'ABERTO' | 'FECHADO' | 'ESTORNADO';
  valor_entrada?: number; // Valor de entrada/adiantamento para compras a prazo
  // ═══ CAMPOS ESTÁGIO 1 — PRODUÇÃO & RAÇA ═══
  raca?: string; // Raça do lote (Nelore, Angus×Nelore, etc.)
  qtd_cabecas?: number; // Quantidade de cabeças no lote
  qtd_mortos?: number; // Mortalidade no frete/descanso
  peso_vivo_medio?: number; // Peso vivo médio por cabeça (kg) na fazenda
  peso_gancho?: number; // Peso total no gancho do frigorífico (kg)
  rendimento_real?: number; // (peso_desossa / peso_gancho) × 100 — calculado
  toalete_kg?: number; // Peso removido na toalete pelo frigorífico (kg)
  preco_arroba?: number; // Preço pago por arroba (R$) — ref. CEPEA regional
  // ═══ CAMPOS IA 2026 — RASTREABILIDADE & VISÃO ═══
  traceability_hash?: string; // Hash único Blockchain para exportação
  vision_audit_status?: 'PENDENTE' | 'APROVADO' | 'REVISAO'; // Status da auditoria por visão computacional
  esg_score?: number; // Score de compliance ambiental/social (0-100)
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
  status: 'DISPONIVEL' | 'VENDIDO' | 'ESTORNADO';
  data_entrada: string;
  // ═══ CAMPOS QUALIDADE IA 2026 ═══
  gordura?: 1 | 2 | 3 | 4 | 5; // Grau de acabamento de gordura (Visão IA)
  conformacao?: 'P' | 'U' | 'R' | 'O' | 'C' | 'O_L'; // Padrão de conformação muscular
  marmoreio?: number; // Score de marmoreio (0-10)
  anomalias_detectadas?: string[]; // Ex: ["hematoma_traseiro", "abscesso_vacina"]
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
  status_pagamento: 'PENDENTE' | 'PAGO' | 'ESTORNADO';
  valor_pago?: number; // Valor já recebido (pagamentos parciais)
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
  categoria: 'VENDA' | 'COMPRA_GADO' | 'OPERACIONAL' | 'ADMINISTRATIVO' | 'OUTROS' | 'ESTRUTURA' | 'FUNCIONARIOS' | 'INSUMOS' | 'MANUTENCAO' | 'IMPOSTOS' | 'DESCONTO' | 'ESTORNO';
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
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ESTORNO' | 'LOGIN' | 'LOGOUT' | 'OTHER';
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
  status: 'PENDENTE' | 'PAGO' | 'PARCIAL' | 'ATRASADO' | 'ESTORNADO' | 'CANCELADO';
  fornecedor_id?: string; // Opcional, link com Supplier
  id_lote?: string; // NOVO: Referência ao lote de gado comprado
  observacoes?: string;
  recorrente?: boolean;
}

// ═══ MULTI-AGENT AI SYSTEM ═══

export type AgentType = 'ADMINISTRATIVO' | 'PRODUCAO' | 'COMERCIAL' | 'AUDITOR' | 'ESTOQUE' | 'COMPRAS' | 'MERCADO' | 'ROBO_VENDAS' | 'MARKETING' | 'SATISFACAO' | 'CONFERENTE' | 'RELATORIOS' | 'WHATSAPP_BOT' | 'AGENDA' | 'TEMPERATURA' | 'COBRANCA';
export type AlertSeverity = 'INFO' | 'ALERTA' | 'CRITICO' | 'BLOQUEIO';
export type AlertStatus = 'NOVO' | 'VISTO' | 'RESOLVIDO' | 'IGNORADO';

export interface AgentConfig {
  id: AgentType;
  name: string;
  description: string;
  icon: string; // emoji
  color: string;
  enabled: boolean;
  systemPrompt: string;
  modules: string[]; // Módulos que este agente monitora
  triggerCount: number; // Quantos gatilhos configurados
  lastRun?: string; // ISO timestamp
  alertCount?: number; // Alertas pendentes
}

export interface AgentAlert {
  id: string;
  agent: AgentType;
  severity: AlertSeverity;
  module: string; // LOTES, ESTOQUE, CLIENTES, etc.
  title: string;
  message: string;
  data?: any; // Dados adicionais (IDs, valores)
  timestamp: string;
  status: AlertStatus;
  actionTaken?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface AgentAction {
  id: string;
  agent: AgentType;
  action: string;
  input: string;
  output: string;
  timestamp: string;
  success: boolean;
}

export interface BreedReference {
  raca: string;
  rendimento_min: number;
  rendimento_max: number;
  quebra_resfriamento_min: number;
  quebra_resfriamento_max: number;
  peso_medio_min: number;
  peso_medio_max: number;
  observacoes: string;
}

export interface SupplierScore {
  fornecedor_id: string;
  nome: string;
  total_lotes: number;
  media_rendimento: number;
  media_custo_kg: number;
  total_lucro: number;
  tier: 'A' | 'B' | 'C' | 'F';
  score: number;
  tendencia: 'subindo' | 'estavel' | 'caindo';
  ultimo_lote?: string;
}

// ═══ COTAÇÕES DE MERCADO (SINCRONIZAÇÃO DIÁRIA) ═══

export interface MarketPrice {
  id: string; // "2026-02-24_BA_SUL"
  data: string; // ISO date "2026-02-24"
  praca: 'BA_SUL' | 'FEIRA_SANTANA' | 'ITAPETINGA' | 'SP_CEPEA' | string;
  preco_arroba: number; // R$ por arroba
  preco_arroba_prazo?: number; // Preço a prazo (30 dias)
  tipo: 'BOI_COMUM' | 'BOI_CHINA' | 'NOVILHA' | string;
  diesel_litro?: number; // Preço diesel na região
  variacao_dia?: number; // % variação no dia
  variacao_mes?: number; // % variação no mês
  fonte: 'SCOT' | 'COOPERFEIRA' | 'AREGIAO' | 'CEPEA' | 'IMEA' | string;
  ultima_sincronizacao: string; // ISO timestamp da busca
  status_sync: 'OK' | 'FALHA' | 'MANUAL';
}

// ═══ TABELA DE RAÇAS — REFERÊNCIA EMBRAPA ═══

export const BREED_REFERENCE_DATA: BreedReference[] = [
  { raca: 'Nelore', rendimento_min: 48, rendimento_max: 62, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.5, peso_medio_min: 240, peso_medio_max: 280, observacoes: 'Raça predominante no Brasil. Referência EMBRAPA Gado de Corte.' },
  { raca: 'Angus × Nelore (F1)', rendimento_min: 50, rendimento_max: 55, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.0, peso_medio_min: 250, peso_medio_max: 270, observacoes: 'Cruzamento industrial mais popular. EMBRAPA/UNESP.' },
  { raca: 'Senepol × Nelore (F1)', rendimento_min: 53, rendimento_max: 57, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.0, peso_medio_min: 250, peso_medio_max: 300, observacoes: 'Excelente acabamento precoce. Gene pelo zero. EMBRAPA.' },
  { raca: 'Senepol (puro)', rendimento_min: 53, rendimento_max: 54, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.0, peso_medio_min: 260, peso_medio_max: 265, observacoes: 'Adaptado ao trópico. FATEC BT.' },
  { raca: 'Angus (puro)', rendimento_min: 52, rendimento_max: 56, quebra_resfriamento_min: 1.0, quebra_resfriamento_max: 1.8, peso_medio_min: 260, peso_medio_max: 290, observacoes: 'Referência em marmoreio. UNESP.' },
  { raca: 'Hereford × Nelore', rendimento_min: 52, rendimento_max: 55, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.0, peso_medio_min: 240, peso_medio_max: 260, observacoes: 'Boa cobertura de gordura. EMBRAPA.' },
  { raca: 'Brangus', rendimento_min: 51, rendimento_max: 55, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.0, peso_medio_min: 250, peso_medio_max: 280, observacoes: '3/8 Angus + 5/8 Nelore. EMBRAPA.' },
  { raca: 'Tabapuã', rendimento_min: 49, rendimento_max: 53, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.5, peso_medio_min: 230, peso_medio_max: 260, observacoes: 'Zebuíno mocho brasileiro. EMBRAPA.' },
  { raca: 'Guzerá', rendimento_min: 48, rendimento_max: 52, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.5, peso_medio_min: 220, peso_medio_max: 250, observacoes: 'Dupla aptitude (leite e corte). EMBRAPA.' },
  { raca: 'Brahman × Nelore', rendimento_min: 50, rendimento_max: 54, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.0, peso_medio_min: 240, peso_medio_max: 270, observacoes: 'Vigor híbrido zebuíno. EMBRAPA.' },
  { raca: 'Charolês × Nelore', rendimento_min: 53, rendimento_max: 57, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.0, peso_medio_min: 260, peso_medio_max: 300, observacoes: 'Alto rendimento muscular. EMBRAPA.' },
  { raca: 'Simental × Nelore', rendimento_min: 52, rendimento_max: 56, quebra_resfriamento_min: 1.5, quebra_resfriamento_max: 2.0, peso_medio_min: 250, peso_medio_max: 290, observacoes: 'Bom crescimento e precocidade. EMBRAPA.' },
];

// ═══ MEMÓRIA PERSISTENTE DOS AGENTES IA ═══
export interface AgentMemory {
  id: string;
  agentId: AgentType;
  timestamp: string; // ISO date
  summary: string; // Resumo da interação
  keyInsights: string[]; // 3-5 insights extraídos
  alertsFound: number; // Quantos alertas foram encontrados
  actionsRecommended: string[]; // Ações sugeridas
  provider: string; // Qual IA respondeu (Gemini, Groq, etc)
  context: 'INDIVIDUAL' | 'REUNIAO' | 'CHAT'; // Tipo de interação
}
