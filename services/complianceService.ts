// ═══ COMPLIANCE, ESG & RELATÓRIOS — FASE 6 ═══
// DRE Automático, Scorecard ESG, Checklist de Compliance
// Inspirado em: SAP S/4HANA Financial Close, Oracle Fusion ERP, SISBOV

import { Sale, Batch, StockItem, Transaction, Payable } from '../types';

// ═══ DRE — DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO ═══
export interface DREReport {
    periodo: string;
    receitaBruta: number;
    devolucoes: number;
    receitaLiquida: number;
    cmv: number; // Custo da Mercadoria Vendida
    lucroBruto: number;
    margemBruta: number;
    despesasOperacionais: number;
    despesasPessoal: number;
    despesasInsumos: number;
    despesasManutencao: number;
    despesasImpostos: number;
    despesasOutras: number;
    lucroOperacional: number;
    margemOperacional: number;
    receitaTotal: number;
    despesaTotal: number;
    resultadoLiquido: number;
    margemLiquida: number;
    // KPIs extras
    ticketMedio: number;
    custoMedioKg: number;
    precoMedioVendaKg: number;
    kgVendidos: number;
    qtdVendas: number;
}

export function generateDRE(
    sales: Sale[],
    transactions: Transaction[],
    batches: Batch[],
    payables: Payable[],
    periodo: 'MES' | 'SEMANA' | 'TOTAL'
): DREReport {
    const now = new Date();
    const msDay = 86400000;
    const dias = periodo === 'SEMANA' ? 7 : periodo === 'MES' ? 30 : 9999;

    // Filtrar por período
    const vendasPeriodo = sales.filter(s => {
        if (s.status_pagamento === 'ESTORNADO') return false;
        return (now.getTime() - new Date(s.data_venda).getTime()) / msDay <= dias;
    });
    const txPeriodo = transactions.filter(t => {
        return (now.getTime() - new Date(t.data).getTime()) / msDay <= dias && t.categoria !== 'ESTORNO';
    });

    // RECEITA BRUTA
    const receitaBruta = vendasPeriodo.reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);

    // DEVOLUÇÕES/ESTORNOS
    const devolucoes = sales.filter(s => {
        if (s.status_pagamento !== 'ESTORNADO') return false;
        return (now.getTime() - new Date(s.data_venda).getTime()) / msDay <= dias;
    }).reduce((s, v) => s + (v.peso_real_saida * v.preco_venda_kg), 0);

    const receitaLiquida = receitaBruta - devolucoes;

    // CMV — Custo da Mercadoria Vendida
    // Calculado como custo_real_kg * peso vendido de cada lote
    const cmv = vendasPeriodo.reduce((sum, v) => {
        const loteId = v.id_completo.split('-')[0] + '-' + v.id_completo.split('-')[1];
        const batch = batches.find(b => b.id_lote === loteId);
        const custoKg = batch?.custo_real_kg || 0;
        return sum + (custoKg * v.peso_real_saida);
    }, 0);

    const lucroBruto = receitaLiquida - cmv;
    const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;

    // DESPESAS OPERACIONAIS (por categoria)
    const despesasPessoal = txPeriodo
        .filter(t => t.tipo === 'SAIDA' && t.categoria === 'FUNCIONARIOS')
        .reduce((s, t) => s + t.valor, 0);
    const despesasInsumos = txPeriodo
        .filter(t => t.tipo === 'SAIDA' && t.categoria === 'INSUMOS')
        .reduce((s, t) => s + t.valor, 0);
    const despesasManutencao = txPeriodo
        .filter(t => t.tipo === 'SAIDA' && (t.categoria === 'MANUTENCAO' || t.categoria === 'ESTRUTURA'))
        .reduce((s, t) => s + t.valor, 0);
    const despesasImpostos = txPeriodo
        .filter(t => t.tipo === 'SAIDA' && t.categoria === 'IMPOSTOS')
        .reduce((s, t) => s + t.valor, 0);
    const despesasOutras = txPeriodo
        .filter(t => t.tipo === 'SAIDA' && ['OPERACIONAL', 'ADMINISTRATIVO', 'OUTROS'].includes(t.categoria))
        .reduce((s, t) => s + t.valor, 0);

    const despesasOperacionais = despesasPessoal + despesasInsumos + despesasManutencao + despesasImpostos + despesasOutras;

    const lucroOperacional = lucroBruto - despesasOperacionais;
    const margemOperacional = receitaLiquida > 0 ? (lucroOperacional / receitaLiquida) * 100 : 0;

    // Totais
    const receitaTotal = txPeriodo.filter(t => t.tipo === 'ENTRADA').reduce((s, t) => s + t.valor, 0);
    const despesaTotal = txPeriodo.filter(t => t.tipo === 'SAIDA').reduce((s, t) => s + t.valor, 0);
    const resultadoLiquido = receitaTotal - despesaTotal;
    const margemLiquida = receitaTotal > 0 ? (resultadoLiquido / receitaTotal) * 100 : 0;

    // KPIs
    const kgVendidos = vendasPeriodo.reduce((s, v) => s + v.peso_real_saida, 0);
    const ticketMedio = vendasPeriodo.length > 0 ? receitaBruta / vendasPeriodo.length : 0;
    const precoMedioVendaKg = kgVendidos > 0 ? receitaBruta / kgVendidos : 0;
    const custoMedioKg = kgVendidos > 0 ? cmv / kgVendidos : 0;

    return {
        periodo: periodo === 'SEMANA' ? 'Últimos 7 dias' : periodo === 'MES' ? 'Últimos 30 dias' : 'Total Geral',
        receitaBruta,
        devolucoes,
        receitaLiquida,
        cmv,
        lucroBruto,
        margemBruta,
        despesasOperacionais,
        despesasPessoal,
        despesasInsumos,
        despesasManutencao,
        despesasImpostos,
        despesasOutras,
        lucroOperacional,
        margemOperacional,
        receitaTotal,
        despesaTotal,
        resultadoLiquido,
        margemLiquida,
        ticketMedio,
        custoMedioKg,
        precoMedioVendaKg,
        kgVendidos,
        qtdVendas: vendasPeriodo.length,
    };
}

// ═══ FORMATAR DRE PARA TEXTO ═══
export function formatDREText(dre: DREReport): string {
    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `═══ DRE — DEMONSTRAÇÃO DO RESULTADO (${dre.periodo}) ═══

📊 RECEITA
  Receita Bruta:           R$ ${fmt(dre.receitaBruta)}
  (-) Devoluções/Estornos: R$ ${fmt(dre.devolucoes)}
  ═ RECEITA LÍQUIDA:       R$ ${fmt(dre.receitaLiquida)}

📦 CUSTO
  (-) CMV:                 R$ ${fmt(dre.cmv)}
  ═ LUCRO BRUTO:           R$ ${fmt(dre.lucroBruto)}
  ═ MARGEM BRUTA:          ${dre.margemBruta.toFixed(1)}% ${dre.margemBruta >= 25 ? '🟢' : dre.margemBruta >= 15 ? '🟡' : '🔴'}

💼 DESPESAS OPERACIONAIS
  Pessoal/Funcionários:    R$ ${fmt(dre.despesasPessoal)}
  Insumos:                 R$ ${fmt(dre.despesasInsumos)}
  Manutenção/Estrutura:    R$ ${fmt(dre.despesasManutencao)}
  Impostos:                R$ ${fmt(dre.despesasImpostos)}
  Outros:                  R$ ${fmt(dre.despesasOutras)}
  (-) TOTAL DESPESAS:      R$ ${fmt(dre.despesasOperacionais)}

  ═ LUCRO OPERACIONAL:     R$ ${fmt(dre.lucroOperacional)}
  ═ MARGEM OPERACIONAL:    ${dre.margemOperacional.toFixed(1)}% ${dre.margemOperacional >= 15 ? '🟢' : dre.margemOperacional >= 5 ? '🟡' : '🔴'}

📈 KPIs DO PERÍODO
  Vendas realizadas:       ${dre.qtdVendas}
  Kg vendidos:             ${dre.kgVendidos.toFixed(0)} kg
  Ticket médio:            R$ ${fmt(dre.ticketMedio)}
  Preço médio venda/kg:    R$ ${fmt(dre.precoMedioVendaKg)}
  Custo médio/kg:          R$ ${fmt(dre.custoMedioKg)}
  Spread (venda-custo):    R$ ${fmt(dre.precoMedioVendaKg - dre.custoMedioKg)}/kg`;
}

// ═══ ESG SCORECARD ═══
export interface ESGScore {
    nota: number; // 0-100
    rastreabilidade: number;
    auditoria: number;
    sustentabilidade: number;
    detalhes: { item: string; status: '✅' | '🟡' | '🔴'; nota: number }[];
}

export function calculateESGScore(batches: Batch[], stock: StockItem[]): ESGScore {
    const totalLotes = batches.length;
    if (totalLotes === 0) return { nota: 0, rastreabilidade: 0, auditoria: 0, sustentabilidade: 0, detalhes: [] };

    // Rastreabilidade
    const comHash = batches.filter(b => b.traceability_hash).length;
    const rastreabilidade = (comHash / totalLotes) * 100;

    // Auditoria por Visão
    const comVision = batches.filter(b => b.vision_audit_status === 'APROVADO').length;
    const auditoria = (comVision / totalLotes) * 100;

    // ESG Score dos lotes
    const comESG = batches.filter(b => b.esg_score && b.esg_score > 0);
    const sustentabilidade = comESG.length > 0
        ? comESG.reduce((s, b) => s + (b.esg_score || 0), 0) / comESG.length
        : 0;

    // Nota geral (média ponderada)
    const nota = Math.round((rastreabilidade * 0.4 + auditoria * 0.3 + sustentabilidade * 0.3));

    const detalhes = [
        { item: 'Rastreabilidade Blockchain', status: rastreabilidade >= 80 ? '✅' as const : rastreabilidade >= 50 ? '🟡' as const : '🔴' as const, nota: Math.round(rastreabilidade) },
        { item: 'Auditoria Vision AI', status: auditoria >= 80 ? '✅' as const : auditoria >= 50 ? '🟡' as const : '🔴' as const, nota: Math.round(auditoria) },
        { item: 'Score ESG Fornecedores', status: sustentabilidade >= 70 ? '✅' as const : sustentabilidade >= 40 ? '🟡' as const : '🔴' as const, nota: Math.round(sustentabilidade) },
        { item: 'FIFO (estoque antigo primeiro)', status: '✅' as const, nota: 100 }, // Implementado no sistema
        { item: 'Vida útil controlada (8 dias)', status: '✅' as const, nota: 100 }, // Implementado
    ];

    return { nota, rastreabilidade: Math.round(rastreabilidade), auditoria: Math.round(auditoria), sustentabilidade: Math.round(sustentabilidade), detalhes };
}

// ═══ CHECKLIST DE COMPLIANCE ═══
export interface ComplianceItem {
    id: string;
    categoria: 'SANITÁRIO' | 'FISCAL' | 'AMBIENTAL' | 'TRABALHISTA' | 'DADOS';
    item: string;
    descricao: string;
    obrigatorio: boolean;
    icon: string;
}

export const COMPLIANCE_CHECKLIST: ComplianceItem[] = [
    { id: 'SIF', categoria: 'SANITÁRIO', item: 'SIF/SIE Atualizado', descricao: 'Selo de Inspeção Federal ou Estadual vigente', obrigatorio: true, icon: '🏛️' },
    { id: 'ALVARA', categoria: 'SANITÁRIO', item: 'Alvará Sanitário', descricao: 'Emitido pela Vigilância Sanitária municipal', obrigatorio: true, icon: '📋' },
    { id: 'POP', categoria: 'SANITÁRIO', item: 'POP (Procedimentos Operacionais)', descricao: 'Manual de Boas Práticas de Fabricação (BPF)', obrigatorio: true, icon: '📖' },
    { id: 'APPCC', categoria: 'SANITÁRIO', item: 'Plano APPCC', descricao: 'Análise de Perigos e Pontos Críticos de Controle', obrigatorio: true, icon: '⚠️' },
    { id: 'TEMP', categoria: 'SANITÁRIO', item: 'Controle de Temperatura', descricao: 'Câmara fria 0-4°C registrada diariamente', obrigatorio: true, icon: '🌡️' },
    { id: 'GTA', categoria: 'SANITÁRIO', item: 'GTA (Guia Trânsito Animal)', descricao: 'Rastreabilidade de origem de cada lote', obrigatorio: true, icon: '🚛' },
    { id: 'CNPJ', categoria: 'FISCAL', item: 'CNPJ Ativo', descricao: 'Cadastro Nacional atualizado na Receita', obrigatorio: true, icon: '🏢' },
    { id: 'NF', categoria: 'FISCAL', item: 'Emissão de NF-e', descricao: 'Nota fiscal eletrônica em todas as vendas', obrigatorio: true, icon: '🧾' },
    { id: 'ICMS', categoria: 'FISCAL', item: 'ICMS/Substituição Tributária', descricao: 'Regime tributário em dia', obrigatorio: true, icon: '💰' },
    { id: 'FUNRURAL', categoria: 'FISCAL', item: 'FUNRURAL', descricao: 'Contribuição sobre compra de gado de PF', obrigatorio: true, icon: '🌾' },
    { id: 'LICAMB', categoria: 'AMBIENTAL', item: 'Licença Ambiental', descricao: 'Licença de operação ambiental vigente', obrigatorio: true, icon: '🌿' },
    { id: 'EFLUENTES', categoria: 'AMBIENTAL', item: 'Tratamento de Efluentes', descricao: 'Sistema de tratamento de resíduos industriais', obrigatorio: true, icon: '💧' },
    { id: 'PGRS', categoria: 'AMBIENTAL', item: 'PGRS (Resíduos Sólidos)', descricao: 'Plano de Gerenciamento de Resíduos', obrigatorio: false, icon: '♻️' },
    { id: 'CTPS', categoria: 'TRABALHISTA', item: 'Registro em CTPS', descricao: 'Todos os funcionários registrados', obrigatorio: true, icon: '👷' },
    { id: 'NR36', categoria: 'TRABALHISTA', item: 'NR-36 (Frigoríficos)', descricao: 'Segurança no trabalho em frigoríficos', obrigatorio: true, icon: '🦺' },
    { id: 'EPI', categoria: 'TRABALHISTA', item: 'EPIs Fornecidos', descricao: 'Luvas, aventais, botas, capacetes', obrigatorio: true, icon: '🧤' },
    { id: 'TREINAMENTO', categoria: 'TRABALHISTA', item: 'Treinamentos Periódicos', descricao: 'BPF, segurança do trabalho, higiene', obrigatorio: true, icon: '📚' },
    { id: 'LGPD', categoria: 'DADOS', item: 'LGPD (Dados Pessoais)', descricao: 'Proteção de dados de clientes e fornecedores', obrigatorio: true, icon: '🔒' },
];

// ═══ FORMATAR DRE PARA PROMPT DA IA ═══
export function formatDREForPrompt(dre: DREReport): string {
    return formatDREText(dre);
}
