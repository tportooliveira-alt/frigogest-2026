/**
 * ═══════════════════════════════════════════════════════
 *   🥩 FRIGOGEST → GOOGLE SHEETS SYNC
 *   Apps Script Web App - THIAGO 704
 * ═══════════════════════════════════════════════════════
 * 
 * Cole este código em: Extensões > Apps Script
 * Depois faça Deploy > Nova implantação > App da Web
 *   - Executar como: Eu
 *   - Quem tem acesso: Qualquer pessoa
 */

// ============ PALETA FRIGOGEST ============

const COLORS = {
  // Headers
  headerBg: '#1e3a5f',         // Azul escuro premium
  headerText: '#ffffff',
  headerBorder: '#2563eb',     // Brand blue
  
  // Linhas
  rowEven: '#f8fafc',
  rowOdd: '#ffffff',
  rowHover: '#eff6ff',
  
  // Status
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  
  // Accent
  accent: '#2563eb',
  accentLight: '#dbeafe',
  gold: '#f59e0b',
  
  // Title
  titleBg: '#0f172a',
  titleText: '#e2e8f0',
  subtitleText: '#94a3b8',
  
  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9'
};

// ============ CONFIGURAÇÃO DAS ABAS ============

const TABS_CONFIG = {
  'Clientes': {
    icon: '👤',
    headers: ['ID_FERRO', 'NOME_SOCIAL', 'WHATSAPP', 'CPF_CNPJ', 'TELEFONE', 'ENDEREÇO', 'BAIRRO', 'CIDADE', 'CEP', 'LIMITE_CRÉDITO', 'SALDO_DEVEDOR', 'OBS'],
    keys: ['id_ferro', 'nome_social', 'whatsapp', 'cpf_cnpj', 'telefone_residencial', 'endereco', 'bairro', 'cidade', 'cep', 'limite_credito', 'saldo_devedor', 'observacoes'],
    widths: [120, 200, 150, 160, 150, 200, 130, 130, 100, 130, 130, 200],
    moneyColumns: [10, 11] // J, K (0-indexed from headers)
  },
  'Fornecedores': {
    icon: '🏪',
    headers: ['ID', 'NOME_FANTASIA', 'CPF_CNPJ', 'INSC_ESTADUAL', 'TELEFONE', 'ENDEREÇO', 'CIDADE', 'UF', 'DADOS_BANCÁRIOS', 'OBS'],
    keys: ['id', 'nome_fantasia', 'cpf_cnpj', 'inscricao_estadual', 'telefone', 'endereco', 'cidade', 'estado', 'dados_bancarios', 'observacoes'],
    widths: [100, 200, 160, 140, 150, 200, 130, 50, 200, 200],
    moneyColumns: []
  },
  'Lotes': {
    icon: '🐂',
    headers: ['ID_LOTE', 'FORNECEDOR', 'DATA_RECEB.', 'PESO_ROMANEIO', 'VALOR_COMPRA', 'FRETE', 'EXTRAS', 'CUSTO/KG', 'STATUS', 'ENTRADA', 'OBS'],
    keys: ['id_lote', 'fornecedor', 'data_recebimento', 'peso_total_romaneio', 'valor_compra_total', 'frete', 'gastos_extras', 'custo_real_kg', 'status', 'valor_entrada', 'observacoes'],
    widths: [140, 200, 120, 130, 130, 100, 100, 100, 100, 120, 200],
    moneyColumns: [4, 5, 6, 7, 9]
  },
  'Estoque': {
    icon: '📦',
    headers: ['ID_COMPLETO', 'ID_LOTE', 'SEQ', 'TIPO', 'PESO_ENTRADA', 'STATUS', 'DATA_ENTRADA'],
    keys: ['id_completo', 'id_lote', 'sequencia', 'tipo', 'peso_entrada', 'status', 'data_entrada'],
    widths: [200, 140, 60, 100, 120, 120, 120],
    moneyColumns: []
  },
  'Vendas': {
    icon: '💰',
    headers: ['ID_VENDA', 'ID_CLIENTE', 'CLIENTE', 'PEÇA', 'PESO_SAÍDA', 'R$/KG', 'DATA_VENDA', 'QUEBRA', 'CUSTOS', 'PRAZO', 'VENCIMENTO', 'PAGAMENTO', 'STATUS'],
    keys: ['id_venda', 'id_cliente', 'nome_cliente', 'id_completo', 'peso_real_saida', 'preco_venda_kg', 'data_venda', 'quebra_kg', 'custo_extras_total', 'prazo_dias', 'data_vencimento', 'forma_pagamento', 'status_pagamento'],
    widths: [100, 100, 180, 200, 110, 90, 120, 80, 100, 70, 120, 120, 110],
    moneyColumns: [5, 8]
  },
  'Fluxo de Caixa': {
    icon: '📊',
    headers: ['ID', 'DATA', 'DESCRIÇÃO', 'TIPO', 'CATEGORIA', 'VALOR', 'REFERÊNCIA', 'PAGAMENTO'],
    keys: ['id', 'data', 'descricao', 'tipo', 'categoria', 'valor', 'referencia_id', 'metodo_pagamento'],
    widths: [100, 120, 300, 90, 140, 120, 140, 120],
    moneyColumns: [5]
  },
  'Contas a Pagar': {
    icon: '📋',
    headers: ['ID', 'DESCRIÇÃO', 'CATEGORIA', 'VALOR', 'PAGO', 'VENCIMENTO', 'DT_PGTO', 'STATUS', 'FORNECEDOR', 'LOTE', 'OBS', 'RECORRENTE'],
    keys: ['id', 'descricao', 'categoria', 'valor', 'valor_pago', 'data_vencimento', 'data_pagamento', 'status', 'fornecedor_id', 'id_lote', 'observacoes', 'recorrente'],
    widths: [120, 250, 130, 120, 120, 120, 120, 100, 150, 140, 200, 90],
    moneyColumns: [3, 4]
  },
  'Agendamentos': {
    icon: '📅',
    headers: ['ID', 'ID_CLIENTE', 'CLIENTE', 'DATA_ENTREGA', 'HORA', 'ITENS', 'STATUS', 'DT_CRIAÇÃO', 'ALERTA'],
    keys: ['id', 'id_cliente', 'nome_cliente', 'data_entrega', 'hora_entrega', 'itens', 'status', 'data_criacao', 'alerta_madrugada'],
    widths: [100, 100, 180, 120, 80, 250, 110, 120, 80],
    moneyColumns: []
  }
};

// ============ SETUP INICIAL ============

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Renomear a planilha
  ss.rename('🥩 FRIGOGEST THIAGO 704');
  
  // Criar cada aba
  Object.keys(TABS_CONFIG).forEach((tabName, tabIndex) => {
    const config = TABS_CONFIG[tabName];
    let sheet = ss.getSheetByName(tabName);
    
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    
    // Mover para posição correta
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(tabIndex + 1);
    
    // Limpar tudo
    sheet.clear();
    
    // ─── LINHA 1: Título da aba ───
    sheet.setRowHeight(1, 45);
    const titleRange = sheet.getRange(1, 1, 1, config.headers.length);
    titleRange.merge();
    titleRange.setValue(`${config.icon}  ${tabName.toUpperCase()}  —  FrigoGest`);
    titleRange.setBackground(COLORS.titleBg);
    titleRange.setFontColor(COLORS.titleText);
    titleRange.setFontSize(14);
    titleRange.setFontWeight('bold');
    titleRange.setFontFamily('Arial');
    titleRange.setHorizontalAlignment('center');
    titleRange.setVerticalAlignment('middle');
    
    // ─── LINHA 2: Subtítulo com data ───
    sheet.setRowHeight(2, 28);
    const subtitleRange = sheet.getRange(2, 1, 1, config.headers.length);
    subtitleRange.merge();
    subtitleRange.setValue(`Última sincronização: aguardando...  •  Sync automático via FrigoGest App`);
    subtitleRange.setBackground(COLORS.titleBg);
    subtitleRange.setFontColor(COLORS.subtitleText);
    subtitleRange.setFontSize(9);
    subtitleRange.setFontStyle('italic');
    subtitleRange.setHorizontalAlignment('center');
    subtitleRange.setVerticalAlignment('middle');
    
    // ─── LINHA 3: Headers ───
    sheet.setRowHeight(3, 36);
    const headerRange = sheet.getRange(3, 1, 1, config.headers.length);
    headerRange.setValues([config.headers]);
    headerRange.setBackground(COLORS.headerBg);
    headerRange.setFontColor(COLORS.headerText);
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(10);
    headerRange.setFontFamily('Arial');
    headerRange.setHorizontalAlignment('center');
    headerRange.setVerticalAlignment('middle');
    
    // Borda inferior azul no header
    headerRange.setBorder(null, null, true, null, null, null, COLORS.accent, SpreadsheetApp.BorderStyle.SOLID_THICK);
    
    // Congela cabeçalho (3 linhas: título + subtítulo + headers)
    sheet.setFrozenRows(3);
    
    // Ajusta largura das colunas
    config.widths.forEach((w, i) => {
      sheet.setColumnWidth(i + 1, w);
    });
    
    // Cor da aba
    const tabColors = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];
    sheet.setTabColor(tabColors[tabIndex % tabColors.length]);
  });
  
  // Remove a "Sheet1" / "Página1" padrão
  ['Sheet1', 'Página1', 'Planilha1'].forEach(name => {
    const defaultSheet = ss.getSheetByName(name);
    if (defaultSheet && ss.getSheets().length > 1) {
      try { ss.deleteSheet(defaultSheet); } catch(e) {}
    }
  });
  
  // Voltar para primeira aba
  ss.setActiveSheet(ss.getSheets()[0]);
  
  SpreadsheetApp.getUi().alert(
    '✅ FRIGOGEST CONFIGURADO!\n\n' +
    '8 abas criadas e formatadas.\n' +
    'Agora faça:\n' +
    '1. Deploy > Nova implantação > App da Web\n' +
    '2. Executar como: Eu\n' +
    '3. Acesso: Qualquer pessoa\n' +
    '4. Copie a URL e cole no .env do FrigoGest'
  );
}

// ============ WEB APP ENDPOINT ============

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timestamp = Utilities.formatDate(new Date(), 'America/Sao_Paulo', "dd/MM/yyyy 'às' HH:mm");
    
    // Modo: sync completo (allData)
    if (payload.allData) {
      const results = {};
      Object.keys(payload.allData).forEach(tabName => {
        const result = writeTab(ss, tabName, payload.allData[tabName], timestamp);
        results[tabName] = result;
      });
      
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', results: results, timestamp: timestamp }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Modo: tab individual
    if (payload.tab && payload.data) {
      const result = writeTab(ss, payload.tab, payload.data, timestamp);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', tab: payload.tab, ...result, timestamp: timestamp }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'Formato inválido' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: 'ok', 
      message: '🥩 FrigoGest Sheets API ativa!',
      tabs: Object.keys(TABS_CONFIG),
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ ESCRITA NAS ABAS ============

function writeTab(ss, tabName, rows, timestamp) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    return { error: 'Aba "' + tabName + '" não encontrada. Execute setupSheets()' };
  }
  
  const config = TABS_CONFIG[tabName];
  if (!config) {
    return { error: 'Config não encontrada para "' + tabName + '"' };
  }
  
  // Atualiza subtítulo com timestamp
  const subtitleRange = sheet.getRange(2, 1, 1, config.headers.length);
  subtitleRange.setValue('✅ Sincronizado: ' + timestamp + '  •  ' + (rows ? rows.length : 0) + ' registros');
  
  // Limpa dados existentes (mantém linhas 1-3: título + subtítulo + headers)
  const lastRow = sheet.getLastRow();
  if (lastRow > 3) {
    sheet.getRange(4, 1, lastRow - 3, sheet.getMaxColumns()).clear();
  }
  
  if (!rows || rows.length === 0) {
    return { rows: 0 };
  }
  
  // Converte array de objetos para array de arrays (na ordem dos keys)
  const dataRows = rows.map(row => {
    return config.keys.map(key => {
      const value = row[key] !== undefined ? row[key] : '';
      return value !== null && value !== undefined ? String(value) : '';
    });
  });
  
  // Escreve de uma vez (a partir da linha 4)
  sheet.getRange(4, 1, dataRows.length, config.headers.length).setValues(dataRows);
  
  // ─── FORMATAÇÃO DAS LINHAS DE DADOS ───
  for (let i = 0; i < dataRows.length; i++) {
    const range = sheet.getRange(i + 4, 1, 1, config.headers.length);
    
    // Cores alternadas
    range.setBackground(i % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd);
    range.setFontSize(10);
    range.setFontFamily('Arial');
    range.setVerticalAlignment('middle');
    
    // Borda inferior sutil
    range.setBorder(null, null, true, null, null, null, COLORS.borderLight, SpreadsheetApp.BorderStyle.SOLID);
  }
  
  // ─── FORMATAÇÃO CONDICIONAL DE STATUS ───
  formatStatusColumns(sheet, tabName, dataRows.length);
  
  // Ajusta altura das linhas
  for (let i = 0; i < dataRows.length; i++) {
    sheet.setRowHeight(i + 4, 30);
  }
  
  return { rows: dataRows.length };
}

// ============ FORMATAÇÃO CONDICIONAL ============

function formatStatusColumns(sheet, tabName, rowCount) {
  if (rowCount === 0) return;
  
  // Mapeamento de colunas de status por aba
  const statusMaps = {
    'Lotes': { col: 9, rules: { 'ABERTO': ['#fef3c7', '#92400e'], 'FECHADO': ['#d1fae5', '#065f46'] } },
    'Estoque': { col: 6, rules: { 'DISPONIVEL': ['#d1fae5', '#065f46'], 'VENDIDO': ['#fee2e2', '#991b1b'] } },
    'Vendas': { col: 13, rules: { 'PAGO': ['#d1fae5', '#065f46'], 'PENDENTE': ['#fef3c7', '#92400e'] } },
    'Fluxo de Caixa': { col: 4, rules: { 'ENTRADA': ['#d1fae5', '#065f46'], 'SAIDA': ['#fee2e2', '#991b1b'] } },
    'Contas a Pagar': { col: 8, rules: { 'PAGO': ['#d1fae5', '#065f46'], 'PENDENTE': ['#fef3c7', '#92400e'], 'PARCIAL': ['#dbeafe', '#1e40af'], 'ATRASADO': ['#fee2e2', '#991b1b'] } },
    'Agendamentos': { col: 7, rules: { 'ABERTO': ['#fef3c7', '#92400e'], 'CONFIRMADO': ['#d1fae5', '#065f46'], 'CANCELADO': ['#fee2e2', '#991b1b'] } }
  };
  
  const map = statusMaps[tabName];
  if (!map) return;
  
  for (let i = 0; i < rowCount; i++) {
    const cell = sheet.getRange(i + 4, map.col);
    const val = cell.getValue().toString().toUpperCase();
    const rule = map.rules[val];
    if (rule) {
      cell.setBackground(rule[0]);
      cell.setFontColor(rule[1]);
      cell.setFontWeight('bold');
      cell.setHorizontalAlignment('center');
    }
  }
}

// ============ MENU PERSONALIZADO ============

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🥩 FrigoGest')
    .addItem('🔧 Configurar Abas', 'setupSheets')
    .addItem('📊 Status dos Dados', 'showApiStatus')
    .addToUi();
}

function showApiStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tabs = Object.keys(TABS_CONFIG);
  let status = '═══ 🥩 FRIGOGEST - STATUS ═══\n\n';
  let totalRows = 0;
  
  tabs.forEach(tab => {
    const config = TABS_CONFIG[tab];
    const sheet = ss.getSheetByName(tab);
    if (sheet) {
      const rows = Math.max(0, sheet.getLastRow() - 3);
      totalRows += rows;
      status += config.icon + ' ' + tab + ': ' + rows + ' registros\n';
    } else {
      status += '❌ ' + tab + ': NÃO ENCONTRADA\n';
    }
  });
  
  status += '\n═══════════════════════════\n';
  status += '📈 Total: ' + totalRows + ' registros\n\n';
  status += '💡 FrigoGest > 🔧 Configurar Abas para recriar';
  SpreadsheetApp.getUi().alert(status);
}
