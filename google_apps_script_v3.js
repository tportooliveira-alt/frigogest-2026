/**
 * ═══════════════════════════════════════════════════════════════════
 *  FRIGOGEST — GOOGLE APPS SCRIPT v3.0
 *  Planilha Gerencial Completa para Frigorífico
 * 
 *  COMO USAR:
 *  1. Acesse script.google.com
 *  2. Crie um novo projeto
 *  3. Cole este código COMPLETO substituindo tudo
 *  4. Clique em "Implantar" → "New Deployment" → "Web App"
 *  5. Acesso: "Anyone" | Execute as: "Me"
 *  6. Copie a URL gerada e cole em: VITE_SHEETS_WEBAPP_URL no .env
 * ═══════════════════════════════════════════════════════════════════
 */

// ── PALETA DE CORES ──
const CORES = {
  VERDE_ESCURO:   '#1B4332',
  VERDE_MEDIO:    '#2D6A4F',
  VERDE_CLARO:    '#52B788',
  VERDE_SUAVE:    '#D8F3DC',
  LARANJA:        '#E76F51',
  AMARELO:        '#F4A261',
  AZUL_ESCURO:    '#1D3557',
  AZUL_MEDIO:     '#457B9D',
  AZUL_CLARO:     '#A8DADC',
  CINZA_DARK:     '#1E293B',
  CINZA_MED:      '#475569',
  CINZA_LIGHT:    '#F1F5F9',
  BRANCO:         '#FFFFFF',
  VERMELHO:       '#C1121F',
  VERMELHO_SUAVE: '#FFE5E5',
};

// Configurações de cada aba
const ABA_CONFIG = {
  '🏠 KPIs Dashboard':  { cor: CORES.VERDE_ESCURO,  icon: '🏠' },
  '📦 Lotes':           { cor: CORES.AZUL_ESCURO,   icon: '📦' },
  '🥩 Estoque':         { cor: CORES.VERDE_MEDIO,   icon: '🥩' },
  '🛒 Vendas':          { cor: CORES.LARANJA,        icon: '🛒' },
  '💰 Fluxo de Caixa':  { cor: CORES.CINZA_DARK,    icon: '💰' },
  '📋 Contas a Pagar':  { cor: CORES.VERMELHO,       icon: '📋' },
  '👥 Clientes':        { cor: CORES.AZUL_MEDIO,     icon: '👥' },
  '🚛 Fornecedores':    { cor: CORES.CINZA_MED,      icon: '🚛' },
  '📅 Agendamentos':    { cor: CORES.VERDE_CLARO,    icon: '📅' },
};

// Cabeçalhos de cada aba (bonitos e em português)
const CABECALHOS = {
  '🏠 KPIs Dashboard': ['📊 Indicador', '💰 Valor', '📏 Unidade'],

  '📦 Lotes': [
    'Cód. Lote', 'Fornecedor', 'Data Entrada', 'Raça', 'Qtd. Cabeças', 'Mortos',
    'Peso Romaneio (kg)', 'Peso Gancho (kg)', 'Rendimento (%)', 'Preço/@',
    'Valor Total (R$)', 'Frete (R$)', 'Gastos Extras (R$)', 'Custo Real/kg (R$)',
    'Valor Entrada (R$)', 'Status', 'Score ESG', 'Auditoria Visão'
  ],

  '🥩 Estoque': [
    'Cód. Peça', 'Lote', 'Seq Animal', 'Tipo', 'Peso Entrada (kg)',
    'Status', 'Data Entrada', 'Gordura', 'Marmoreio', 'Conformação'
  ],

  '🛒 Vendas': [
    'Cód. Venda', 'Cliente', 'Nome Cliente', 'Peça', 'Data Venda',
    'Peso Saída (kg)', 'Preço/kg (R$)', 'Valor Total (R$)',
    'Lucro/kg (R$)', 'Lucro Total (R$)', 'Quebra (kg)',
    'Extras (R$)', 'Forma Pgto', 'Prazo (dias)', 'Vencimento',
    'Status Pgto', 'Valor Pago (R$)', 'Valor Pendente (R$)'
  ],

  '💰 Fluxo de Caixa': [
    'Cód.', 'Data', 'Descrição', 'Tipo', 'Categoria', 'Valor (R$)',
    'Referência', 'Método Pgto'
  ],

  '📋 Contas a Pagar': [
    'Cód.', 'Descrição', 'Categoria', 'Valor (R$)', 'Valor Pago (R$)',
    'Valor Pendente (R$)', 'Vencimento', 'Data Pagamento', 'Status',
    'Fornecedor', 'Lote Ref.', 'Recorrente', 'Obs.'
  ],

  '👥 Clientes': [
    'Cód. Ferro', 'Nome', 'WhatsApp', 'CPF/CNPJ', 'Telefone',
    'Endereço', 'Bairro', 'Cidade', 'CEP', 'Limite Crédito (R$)',
    'Saldo Devedor (R$)', 'Status', 'Perfil Compra', 'Padrão Gordura',
    'Freq. Ideal (dias)', 'Objeções', 'Preferências', 'Obs.'
  ],

  '🚛 Fornecedores': [
    'Cód.', 'Nome / Fazenda', 'CPF/CNPJ', 'Inscrição Estadual',
    'Telefone', 'Endereço', 'Cidade', 'Estado', 'Raça Predominante',
    'Região', 'Dados Bancários', 'Status', 'Obs.'
  ],

  '📅 Agendamentos': [
    'Cód.', 'Cliente', 'Nome Cliente', 'Data Entrega', 'Hora',
    'Itens Pedidos', 'Status', 'Criado em', 'Alerta Madrugada'
  ],
};

// ─────────────────────────────────────────────────────────────
//  ENTRY POINT — recebe POST do app
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Cria/atualiza cada aba
    for (const [nomeAba, dados] of Object.entries(payload.allData || {})) {
      atualizarAba(ss, nomeAba, dados, CABECALHOS[nomeAba] || null);
    }

    // Cria/atualiza aba de Resumo Financeiro
    criarResumoFinanceiro(ss, payload.allData);

    // Atualiza aba de índice
    criarIndice(ss, payload.timestamp);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'FrigoGest Sheets v3.0 ativo' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────
//  ATUALIZAR ABA
// ─────────────────────────────────────────────────────────────
function atualizarAba(ss, nomeAba, dados, cabecalhos) {
  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) {
    sheet = ss.insertSheet(nomeAba);
  }
  sheet.clearContents();
  sheet.clearFormats();

  if (!dados || !Array.isArray(dados) || dados.length === 0) {
    // Coloca cabeçalho mesmo vazio
    if (cabecalhos) formatarCabecalho(sheet, cabecalhos, nomeAba);
    sheet.getRange(2, 1).setValue('Nenhum dado ainda.');
    return;
  }

  // Cabeçalho da aba
  if (cabecalhos) {
    formatarCabecalho(sheet, cabecalhos, nomeAba);
  } else {
    // Usa as chaves do primeiro objeto
    const keys = Object.keys(dados[0]);
    formatarCabecalho(sheet, keys, nomeAba);
  }

  // Chaves para a ordem das colunas
  const keys = cabecalhos
    ? Object.keys(dados[0])
    : Object.keys(dados[0]);

  // Preencher dados
  const linhas = dados.map(row => Object.values(row).map(v => v === null || v === undefined ? '' : v));
  if (linhas.length > 0) {
    sheet.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
  }

  // Formatação condicional
  aplicarFormatacaoCondicional(sheet, nomeAba, linhas.length);

  // Auto resize
  try { sheet.autoResizeColumns(1, (linhas[0] || cabecalhos || []).length); } catch (e) {}

  // Congelar cabeçalho
  sheet.setFrozenRows(1);

  // Cor da tab
  const config = ABA_CONFIG[nomeAba];
  if (config) sheet.setTabColor(config.cor);
}

// ─────────────────────────────────────────────────────────────
//  CABEÇALHO BONITO
// ─────────────────────────────────────────────────────────────
function formatarCabecalho(sheet, cabecalhos, nomeAba) {
  sheet.insertRowBefore(1);
  const config = ABA_CONFIG[nomeAba] || { cor: CORES.CINZA_DARK };
  const numCols = cabecalhos.length;

  // Linha de TÍTULO
  const titulo = sheet.getRange(1, 1, 1, numCols);
  titulo.merge();
  titulo.setValue(nomeAba.toUpperCase() + ' — FRIGOGEST Sistema de Gestão');
  titulo.setBackground(config.cor);
  titulo.setFontColor(CORES.BRANCO);
  titulo.setFontWeight('bold');
  titulo.setFontSize(11);
  titulo.setHorizontalAlignment('center');
  titulo.setVerticalAlignment('middle');

  sheet.setRowHeight(1, 36);

  // Linha de CABEÇALHO
  sheet.insertRowAfter(1);
  const cabRow = sheet.getRange(2, 1, 1, numCols);
  cabRow.setValues([cabecalhos]);
  cabRow.setBackground('#2D3748');
  cabRow.setFontColor(CORES.BRANCO);
  cabRow.setFontWeight('bold');
  cabRow.setFontSize(9);
  cabRow.setHorizontalAlignment('center');
  cabRow.setVerticalAlignment('middle');
  cabRow.setBorder(false, false, true, false, false, false, '#4A5568', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeight(2, 28);

  sheet.setFrozenRows(2);
}

// ─────────────────────────────────────────────────────────────
//  FORMATAÇÃO CONDICIONAL POR ABA
// ─────────────────────────────────────────────────────────────
function aplicarFormatacaoCondicional(sheet, nomeAba, numLinhas) {
  if (numLinhas === 0) return;

  const rules = [];
  const range = sheet.getDataRange();

  // Zebra stripes nos dados
  for (let i = 3; i <= numLinhas + 2; i += 2) {
    try {
      sheet.getRange(i, 1, 1, sheet.getLastColumn())
        .setBackground('#F8FAFC');
    } catch (e) {}
  }

  // Formatação por status nas Vendas
  if (nomeAba === '🛒 Vendas') {
    const statusCol = 16; // Status Pgto
    for (let i = 3; i <= numLinhas + 2; i++) {
      try {
        const cell = sheet.getRange(i, statusCol);
        const val = cell.getValue();
        if (val === 'PAGO') {
          sheet.getRange(i, 1, 1, sheet.getLastColumn()).setBackground('#D8F3DC');
        } else if (val === 'PENDENTE') {
          sheet.getRange(i, 1, 1, sheet.getLastColumn()).setBackground('#FFF9C4');
        } else if (val === 'ESTORNADO') {
          sheet.getRange(i, 1, 1, sheet.getLastColumn()).setBackground('#FFE5E5');
        }
      } catch (e) {}
    }
  }

  // Formatação por status em Contas a Pagar
  if (nomeAba === '📋 Contas a Pagar') {
    const statusCol = 9;
    const hoje = new Date();
    for (let i = 3; i <= numLinhas + 2; i++) {
      try {
        const statusCell = sheet.getRange(i, statusCol);
        const vencCell = sheet.getRange(i, 7);
        const val = statusCell.getValue();
        const venc = vencCell.getValue();

        if (val === 'PAGO') {
          sheet.getRange(i, 1, 1, sheet.getLastColumn()).setBackground('#D8F3DC');
          statusCell.setFontColor(CORES.VERDE_MEDIO).setFontWeight('bold');
        } else if (val === 'ATRASADO' || (val === 'PENDENTE' && venc && new Date(venc) < hoje)) {
          sheet.getRange(i, 1, 1, sheet.getLastColumn()).setBackground('#FFE5E5');
          statusCell.setFontColor(CORES.VERMELHO).setFontWeight('bold');
        } else if (val === 'PENDENTE') {
          sheet.getRange(i, 1, 1, sheet.getLastColumn()).setBackground('#FFF9C4');
        }
      } catch (e) {}
    }
  }

  // Estoque: vermelho se bloqueado/estornado
  if (nomeAba === '🥩 Estoque') {
    for (let i = 3; i <= numLinhas + 2; i++) {
      try {
        const statusCell = sheet.getRange(i, 6);
        const val = statusCell.getValue();
        if (val === 'VENDIDO') {
          sheet.getRange(i, 1, 1, sheet.getLastColumn()).setBackground('#F0FDF4');
          statusCell.setFontColor(CORES.VERDE_MEDIO).setFontWeight('bold');
        } else if (val === 'ESTORNADO') {
          sheet.getRange(i, 1, 1, sheet.getLastColumn()).setBackground('#FFE5E5');
        }
      } catch (e) {}
    }
  }

  // KPIs: número em negrito e azul
  if (nomeAba === '🏠 KPIs Dashboard') {
    for (let i = 3; i <= numLinhas + 2; i++) {
      try {
        sheet.getRange(i, 2).setFontWeight('bold').setFontColor(CORES.AZUL_ESCURO).setFontSize(11);
      } catch (e) {}
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  RESUMO FINANCEIRO (aba calculada)
// ─────────────────────────────────────────────────────────────
function criarResumoFinanceiro(ss, allData) {
  const nomeAba = '📊 Resumo Financeiro';
  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) sheet = ss.insertSheet(nomeAba);
  sheet.clearContents();
  sheet.clearFormats();
  sheet.setTabColor(CORES.VERDE_ESCURO);

  // Título
  sheet.getRange(1, 1, 1, 4).merge()
    .setValue('📊 RESUMO FINANCEIRO — FRIGOGEST')
    .setBackground(CORES.VERDE_ESCURO)
    .setFontColor(CORES.BRANCO)
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 45);

  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  sheet.getRange(2, 1, 1, 4).merge()
    .setValue('Gerado em: ' + agora)
    .setBackground('#F1F5F9')
    .setFontColor(CORES.CINZA_MED)
    .setFontSize(9)
    .setHorizontalAlignment('center');

  const vendas = allData?.['🛒 Vendas'] || [];
  const contas = allData?.['📋 Contas a Pagar'] || [];
  const caixa = allData?.['💰 Fluxo de Caixa'] || [];
  const estoque = allData?.['🥩 Estoque'] || [];
  const lotes = allData?.['📦 Lotes'] || [];

  // ───── SEÇÃO: RECEITAS ─────
  let linha = 4;
  escreverSecao(sheet, linha, '💵 RECEITAS', CORES.VERDE_MEDIO);
  linha++;

  const vendasAtivas = vendas.filter(v => v.status_pagamento !== 'ESTORNADO');
  const totalReceita = vendasAtivas.reduce((s, v) => s + parseFloat(v.valor_total || '0'), 0);
  const totalRecebido = vendasAtivas.filter(v => v.status_pagamento === 'PAGO').reduce((s, v) => s + parseFloat(v.valor_total || '0'), 0);
  const totalPendente = vendasAtivas.reduce((s, v) => s + parseFloat(v.valor_pendente || '0'), 0);
  const totalLucro = vendasAtivas.reduce((s, v) => s + parseFloat(v.lucro_total_venda || '0'), 0);
  const margemPct = totalReceita > 0 ? (totalLucro / totalReceita * 100) : 0;

  const linhasReceita = [
    ['Receita Bruta Total', totalReceita, 'Soma de todas as vendas (não estornadas)'],
    ['Já Recebido (PAGO)', totalRecebido, 'Vendas com status PAGO'],
    ['A Receber (PENDENTE)', totalPendente, 'Valores ainda em aberto'],
    ['Lucro Líquido Total', totalLucro, 'Receita menos custo de aquisição'],
    ['Margem de Lucro Média', margemPct / 100, 'Lucro ÷ Receita'],
    ['Qtde de Vendas', vendasAtivas.length, '—'],
  ];
  escreverLinhas(sheet, linha, linhasReceita, CORES.VERDE_SUAVE, true);
  linha += linhasReceita.length + 1;

  // ───── SEÇÃO: CUSTOS ─────
  escreverSecao(sheet, linha, '📤 CUSTOS E DESPESAS', CORES.VERMELHO);
  linha++;

  const totalPagar = contas.reduce((s, c) => s + parseFloat(c.valor || '0'), 0);
  const totalPago = contas.filter(c => c.status === 'PAGO').reduce((s, c) => s + parseFloat(c.valor_pago || '0'), 0);
  const totalAberto = contas.filter(c => ['PENDENTE','ATRASADO','PARCIAL'].includes(c.status)).reduce((s, c) => s + parseFloat(c.valor_pendente || '0'), 0);
  const totalAtrasado = contas.filter(c => c.status === 'ATRASADO').reduce((s, c) => s + parseFloat(c.valor || '0'), 0);
  const totalCompra = lotes.reduce((s, l) => s + parseFloat(l.valor_compra_total || '0'), 0);
  const totalFrete = lotes.reduce((s, l) => s + parseFloat(l.frete || '0'), 0);

  const linhasCusto = [
    ['Total Contas a Pagar (geral)', totalPagar, 'Soma de todas as contas'],
    ['Total Já Pago', totalPago, 'Contas com status PAGO'],
    ['Total em Aberto', totalAberto, 'PENDENTE + ATRASADO + PARCIAL'],
    ['Total ATRASADO', totalAtrasado, '⚠️ Vencidos sem pagamento'],
    ['Total Gasto Compra Gado', totalCompra, 'Valor pago aos fornecedores'],
    ['Total Frete', totalFrete, 'Custo de transporte dos lotes'],
  ];
  escreverLinhas(sheet, linha, linhasCusto, CORES.VERMELHO_SUAVE, true);
  linha += linhasCusto.length + 1;

  // ───── SEÇÃO: RESULTADO ─────
  escreverSecao(sheet, linha, '📈 RESULTADO LÍQUIDO', CORES.AZUL_ESCURO);
  linha++;

  const saldoLiquido = totalReceita - totalPagar;
  const caixaEntradas = caixa.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + parseFloat(t.valor || '0'), 0);
  const caixaSaidas = caixa.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + parseFloat(t.valor || '0'), 0);
  const saldoCaixa = caixaEntradas - caixaSaidas;

  const linhasResult = [
    ['Receita - Despesas', saldoLiquido, 'Saldo: receita menos todas as contas'],
    ['Entradas no Caixa', caixaEntradas, 'Total de entradas registradas'],
    ['Saídas do Caixa', caixaSaidas, 'Total de saídas registradas'],
    ['Saldo de Caixa', saldoCaixa, 'Entradas - Saídas'],
  ];
  escreverLinhas(sheet, linha, linhasResult, CORES.AZUL_CLARO, true);
  linha += linhasResult.length + 1;

  // ───── SEÇÃO: ESTOQUE ─────
  escreverSecao(sheet, linha, '🥩 ESTOQUE', CORES.VERDE_MEDIO);
  linha++;

  const estDisp = estoque.filter(e => e.status === 'DISPONIVEL');
  const pesoDisp = estDisp.reduce((s, e) => s + parseFloat(e.peso_entrada || '0'), 0);
  const estVend = estoque.filter(e => e.status === 'VENDIDO').length;
  const loteAberto = lotes.filter(l => l.status === 'ABERTO').length;

  const linhasEst = [
    ['Peças Disponíveis', estDisp.length, 'Prontas para venda'],
    ['Peso Total Disponível (kg)', pesoDisp, 'kg em estoque'],
    ['Peças Já Vendidas', estVend, 'Histórico total de saídas'],
    ['Lotes Abertos', loteAberto, 'Lotes em recepção/processo'],
  ];
  escreverLinhas(sheet, linha, linhasEst, CORES.VERDE_SUAVE, false);
  linha += linhasEst.length + 1;

  sheet.autoResizeColumns(1, 4);
  sheet.setFrozenRows(1);

  // Move para 2ª posição
  try { ss.setActiveSheet(sheet); ss.moveActiveSheet(2); } catch (e) {}
}

function escreverSecao(sheet, linha, titulo, cor) {
  const range = sheet.getRange(linha, 1, 1, 4).merge();
  range.setValue(titulo);
  range.setBackground(cor);
  range.setFontColor(CORES.BRANCO);
  range.setFontWeight('bold');
  range.setFontSize(10);
  range.setHorizontalAlignment('left');
  range.setBorder(false, false, true, false, false, false, '#00000033', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeight(linha, 30);
}

function escreverLinhas(sheet, linhaInicio, dados, corFundo, ehMonetario) {
  dados.forEach((row, idx) => {
    const l = linhaInicio + idx;
    const [label, valor, obs] = row;

    sheet.getRange(l, 1).setValue(label)
      .setBackground(idx % 2 === 0 ? corFundo : CORES.BRANCO)
      .setFontWeight('bold')
      .setFontSize(9);

    const celValor = sheet.getRange(l, 2);
    celValor.setValue(valor)
      .setBackground(idx % 2 === 0 ? corFundo : CORES.BRANCO)
      .setFontWeight('bold')
      .setFontSize(10)
      .setHorizontalAlignment('right');

    if (ehMonetario && typeof valor === 'number' && !String(label).includes('%') && !String(label).includes('Qtde') && !String(label).includes('Lotes') && !String(label).includes('Peças')) {
      if (String(label).includes('Margem')) {
        celValor.setNumberFormat('0.00%');
      } else {
        celValor.setNumberFormat('R$ #,##0.00');
      }
      if (valor < 0) celValor.setFontColor('#C1121F');
      else if (valor > 0) celValor.setFontColor(CORES.VERDE_MEDIO);
    }

    sheet.getRange(l, 3).setValue(obs || '')
      .setBackground(idx % 2 === 0 ? corFundo : CORES.BRANCO)
      .setFontColor(CORES.CINZA_MED)
      .setFontSize(8)
      .setFontStyle('italic');

    sheet.setRowHeight(l, 24);
  });
}

// ─────────────────────────────────────────────────────────────
//  ÍNDICE GERAL
// ─────────────────────────────────────────────────────────────
function criarIndice(ss, timestamp) {
  const nomeAba = '📌 Índice';
  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) { sheet = ss.insertSheet(nomeAba); ss.moveActiveSheet(1); }
  sheet.clearContents();
  sheet.clearFormats();
  sheet.setTabColor(CORES.CINZA_DARK);

  sheet.getRange(1, 1, 1, 3).merge()
    .setValue('🥩 FRIGOGEST — SISTEMA DE GESTÃO FRIGORÍFICA')
    .setBackground(CORES.CINZA_DARK)
    .setFontColor(CORES.BRANCO)
    .setFontWeight('bold')
    .setFontSize(16)
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 50);

  const horaSP = new Date(timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  sheet.getRange(2, 1, 1, 3).merge()
    .setValue('Última sincronização: ' + horaSP)
    .setBackground('#334155')
    .setFontColor('#94A3B8')
    .setFontSize(9)
    .setHorizontalAlignment('center');
  sheet.setRowHeight(2, 25);

  const abas = [
    ['📌 Esta aba', 'Índice de navegação'],
    ['📊 Resumo Financeiro', 'DRE simplificado + resultado líquido'],
    ['🏠 KPIs Dashboard', 'Indicadores-chave do negócio'],
    ['📦 Lotes', 'Registro de entrada de gado'],
    ['🥩 Estoque', 'Peças disponíveis, vendidas e estornadas'],
    ['🛒 Vendas', 'Histórico completo de vendas e recebimentos'],
    ['💰 Fluxo de Caixa', 'Entradas e saídas financeiras detalhadas'],
    ['📋 Contas a Pagar', 'Fornecedores, operacional, atrasados'],
    ['👥 Clientes', 'Cadastro e CRM de clientes'],
    ['🚛 Fornecedores', 'Cadastro de fazendas e fornecedores'],
    ['📅 Agendamentos', 'Pedidos futuros e entregas programadas'],
  ];

  sheet.getRange(4, 1, 1, 2).setValues([['Aba', 'Conteúdo']])
    .setBackground('#475569').setFontColor(CORES.BRANCO).setFontWeight('bold').setFontSize(10);

  abas.forEach(([nome, desc], idx) => {
    const l = 5 + idx;
    sheet.getRange(l, 1).setValue(nome)
      .setBackground(idx % 2 === 0 ? '#F8FAFC' : CORES.BRANCO)
      .setFontWeight(idx === 0 ? 'bold' : 'normal').setFontSize(10);
    sheet.getRange(l, 2).setValue(desc)
      .setBackground(idx % 2 === 0 ? '#F8FAFC' : CORES.BRANCO)
      .setFontColor(CORES.CINZA_MED).setFontSize(9);
    sheet.setRowHeight(l, 22);
  });

  sheet.autoResizeColumns(1, 2);
  sheet.setFrozenRows(1);

  try { ss.setActiveSheet(sheet); ss.moveActiveSheet(1); } catch (e) {}
}
