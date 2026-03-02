/**
 * ═══════════════════════════════════════════════════════════════
 * FRIGOGEST — FUNÇÕES DETERMINÍSTICAS (Substituem 5 agentes)
 * ═══════════════════════════════════════════════════════════════
 * Funções TypeScript puras que NÃO chamam LLM.
 * Substituem CONFERENTE, TEMPERATURA, RELATÓRIOS, AGENDA e MONITOR_BUGS.
 */

import { Batch, StockItem, Sale, Client, Transaction, Payable, ScheduledOrder, AppState, BREED_REFERENCE_DATA } from '../types';

// ═══════════════════════════════════════════════════════════════
// 1. VALIDAR ROMANEIO — Substitui Pedro (CONFERENTE)
// ═══════════════════════════════════════════════════════════════

interface ValidationResult {
    status: '✅ OK' | '⚠️ Atenção' | '🔴 Erro';
    field: string;
    message: string;
}

const VALID_BREEDS = [
    'Nelore', 'Angus', 'Senepol', 'Brahman', 'Tabapuã', 'Guzerá', 'Hereford',
    'Brangus', 'Charolês', 'Simental', 'Cruzamento',
    'Angus × Nelore', 'Senepol × Nelore', 'Hereford × Nelore',
    'Brahman × Nelore', 'Charolês × Nelore', 'Simental × Nelore',
    'Angus × Nelore (F1)', 'Senepol × Nelore (F1)'
];

export function validarRomaneio(batch: Batch): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Fornecedor obrigatório
    if (!batch.fornecedor || batch.fornecedor.trim() === '') {
        results.push({ status: '🔴 Erro', field: 'Fornecedor', message: 'Fornecedor não informado. BLOQUEIO.' });
    } else {
        results.push({ status: '✅ OK', field: 'Fornecedor', message: batch.fornecedor });
    }

    // Data obrigatória
    if (!batch.data_recebimento) {
        results.push({ status: '🔴 Erro', field: 'Data', message: 'Data de recebimento não informada. BLOQUEIO.' });
    } else {
        results.push({ status: '✅ OK', field: 'Data', message: batch.data_recebimento });
    }

    // Peso total do romaneio
    if (batch.peso_total_romaneio <= 0) {
        results.push({ status: '🔴 Erro', field: 'Peso Total', message: 'Peso total zerado ou negativo.' });
    } else if (batch.peso_total_romaneio < 180) {
        results.push({ status: '⚠️ Atenção', field: 'Peso Total', message: `${batch.peso_total_romaneio}kg — Muito baixo para uma carcaça.` });
    } else {
        results.push({ status: '✅ OK', field: 'Peso Total', message: `${batch.peso_total_romaneio}kg` });
    }

    // Valor de compra
    if (batch.valor_compra_total <= 0) {
        results.push({ status: '🔴 Erro', field: 'Valor Compra', message: 'Valor de compra não informado.' });
    } else {
        results.push({ status: '✅ OK', field: 'Valor Compra', message: `R$ ${batch.valor_compra_total.toFixed(2)}` });
    }

    // Preço da arroba (se informado)
    if (batch.preco_arroba) {
        if (batch.preco_arroba < 200 || batch.preco_arroba > 500) {
            results.push({ status: '⚠️ Atenção', field: 'Preço/@', message: `R$ ${batch.preco_arroba}/@ — Fora da faixa esperada (R$200-500).` });
        } else {
            results.push({ status: '✅ OK', field: 'Preço/@', message: `R$ ${batch.preco_arroba}/@` });
        }
    }

    // Raça (se informada)
    if (batch.raca) {
        const racaMatch = VALID_BREEDS.some(r => batch.raca!.toLowerCase().includes(r.toLowerCase()));
        if (!racaMatch) {
            results.push({ status: '⚠️ Atenção', field: 'Raça', message: `"${batch.raca}" — Raça não consta na tabela EMBRAPA. CONFERIR.` });
        } else {
            results.push({ status: '✅ OK', field: 'Raça', message: batch.raca });
        }
    }

    // Quantidade de cabeças
    if (batch.qtd_cabecas && batch.qtd_cabecas > 0) {
        const pesoMedio = batch.peso_total_romaneio / batch.qtd_cabecas;
        if (pesoMedio < 180 || pesoMedio > 380) {
            results.push({ status: '⚠️ Atenção', field: 'Peso Médio', message: `${pesoMedio.toFixed(1)}kg/carcaça — Fora da faixa esperada (180-380kg).` });
        } else {
            results.push({ status: '✅ OK', field: 'Peso Médio', message: `${pesoMedio.toFixed(1)}kg/carcaça` });
        }
    }

    // Rendimento real (se informado)
    if (batch.rendimento_real) {
        if (batch.rendimento_real < 42 || batch.rendimento_real > 62) {
            results.push({ status: '🔴 Erro', field: 'Rendimento', message: `${batch.rendimento_real}% — Fora da faixa EMBRAPA (42-62%). Possível erro de digitação.` });
        } else if (batch.rendimento_real < 48) {
            results.push({ status: '⚠️ Atenção', field: 'Rendimento', message: `${batch.rendimento_real}% — Abaixo do esperado. Verificar fornecedor.` });
        } else {
            results.push({ status: '✅ OK', field: 'Rendimento', message: `${batch.rendimento_real}%` });
        }
    }

    return results;
}

export function formatValidationResults(results: ValidationResult[]): string {
    const errors = results.filter(r => r.status === '🔴 Erro').length;
    const warnings = results.filter(r => r.status === '⚠️ Atenção').length;

    let header = errors > 0
        ? `🔴 ROMANEIO COM ${errors} ERRO(S)`
        : warnings > 0
            ? `⚠️ ROMANEIO COM ${warnings} ALERTA(S)`
            : `✅ ROMANEIO VALIDADO — SEM ERROS`;

    const lines = results.map(r => `${r.status} ${r.field}: ${r.message}`);
    return `${header}\n\n${lines.join('\n')}`;
}

// ═══════════════════════════════════════════════════════════════
// 2. MONITORAR TEMPERATURA — Substitui Carlos (TEMPERATURA)
// ═══════════════════════════════════════════════════════════════

interface TemperatureAlert {
    severity: '🟢 NORMAL' | '🟡 ATENÇÃO' | '🔴 CRÍTICO' | '⛔ EMERGÊNCIA';
    message: string;
    action: string;
}

export function monitorarTemperatura(tempCelsius: number, umidade?: number): TemperatureAlert {
    if (tempCelsius > 10) {
        return {
            severity: '⛔ EMERGÊNCIA',
            message: `Temperatura ${tempCelsius}°C — ACIMA DO LIMITE MÁXIMO!`,
            action: 'PARAR TUDO. Risco de contaminação. Isolar lote. Mover para câmara backup. Chamar técnico URGENTE.'
        };
    }
    if (tempCelsius > 7) {
        return {
            severity: '🔴 CRÍTICO',
            message: `Temperatura ${tempCelsius}°C — Risco sanitário (Listeria/E.coli).`,
            action: 'MOVER mercadoria para câmara de backup. Chamar técnico refrigeração. Registrar ocorrência.'
        };
    }
    if (tempCelsius > 4) {
        return {
            severity: '🟡 ATENÇÃO',
            message: `Temperatura ${tempCelsius}°C — Acima do ideal (0-4°C). Drip loss acelerado (0,6%/dia).`,
            action: 'Verificar compressor e vedação da porta. Reduzir frequência de abertura.'
        };
    }

    let result: TemperatureAlert = {
        severity: '🟢 NORMAL',
        message: `Temperatura ${tempCelsius}°C — Dentro do ideal (0-4°C). Drip loss normal (0,3%/dia).`,
        action: 'Monitoramento regular. Tudo OK.'
    };

    // Verificar umidade se informada
    if (umidade !== undefined) {
        if (umidade < 80) {
            result.message += ` ⚠️ Umidade ${umidade}% — BAIXA (ideal 85-90%). Risco de ressecamento.`;
            result.severity = '🟡 ATENÇÃO';
        } else if (umidade > 95) {
            result.message += ` ⚠️ Umidade ${umidade}% — ALTA (ideal 85-90%). Risco de bolor.`;
            result.severity = '🟡 ATENÇÃO';
        } else {
            result.message += ` Umidade ${umidade}% OK.`;
        }
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
// 3. GERAR RELATÓRIO — Substitui Rafael (RELATÓRIOS)
// ═══════════════════════════════════════════════════════════════

export function gerarResumoOperacional(
    batches: Batch[], stock: StockItem[], sales: Sale[],
    transactions: Transaction[], clients: Client[], payables: Payable[]
): string {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];

    // Estoque
    const availableStock = stock.filter(s => s.status === 'DISPONIVEL');
    const totalKgEstoque = availableStock.reduce((sum, s) => sum + s.peso_entrada, 0);

    // Estoque por idade
    const stockByAge = availableStock.map(s => {
        const days = Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / 86400000);
        return { ...s, dias: days };
    });
    const fresh = stockByAge.filter(s => s.dias <= 3).length;
    const attention = stockByAge.filter(s => s.dias >= 4 && s.dias <= 7).length;
    const critical = stockByAge.filter(s => s.dias > 7).length;

    // Vendas da semana
    const vendasSemana = sales.filter(s => s.data_venda >= sevenDaysAgo && s.status_pagamento !== 'ESTORNADO');
    const receita = vendasSemana.reduce((sum, s) => sum + (s.peso_real_saida * s.preco_venda_kg), 0);
    const kgVendidos = vendasSemana.reduce((sum, s) => sum + s.peso_real_saida, 0);

    // Financeiro
    const entradas = transactions.filter(t => t.tipo === 'ENTRADA').reduce((sum, t) => sum + t.valor, 0);
    const saidas = transactions.filter(t => t.tipo === 'SAIDA').reduce((sum, t) => sum + t.valor, 0);
    const saldo = entradas - saidas;

    const pendentes = payables.filter(p => p.status === 'PENDENTE' || p.status === 'ATRASADO');
    const totalPagar = pendentes.reduce((sum, p) => sum + (p.valor - (p.valor_pago || 0)), 0);

    const receber = sales.filter(s => s.status_pagamento === 'PENDENTE');
    const totalReceber = receber.reduce((sum, s) => sum + (s.peso_real_saida * s.preco_venda_kg) - (s.valor_pago || 0), 0);

    // Top clientes
    const clientSales: Record<string, number> = {};
    vendasSemana.forEach(s => {
        const name = s.nome_cliente || s.id_cliente;
        clientSales[name] = (clientSales[name] || 0) + (s.peso_real_saida * s.preco_venda_kg);
    });
    const topClients = Object.entries(clientSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const saldoIcon = saldo < 5000 ? '🔴' : saldo < 15000 ? '🟡' : '🟢';

    return `📊 RESUMO OPERACIONAL — ${today}

━━ ESTOQUE ━━
📦 ${availableStock.length} itens disponíveis | ${totalKgEstoque.toFixed(0)}kg total
🟢 Frescos (0-3d): ${fresh} | 🟡 Atenção (4-7d): ${attention} | 🔴 Críticos (8+d): ${critical}

━━ VENDAS (7 dias) ━━
💰 Receita: R$ ${receita.toFixed(2)} | ${kgVendidos.toFixed(0)}kg vendidos | ${vendasSemana.length} vendas
${topClients.length > 0 ? `🏆 Top: ${topClients.map(([n, v]) => `${n} (R$${v.toFixed(0)})`).join(' | ')}` : ''}

━━ FINANCEIRO ━━
${saldoIcon} Saldo Caixa: R$ ${saldo.toFixed(2)}
📥 A Receber: R$ ${totalReceber.toFixed(2)} (${receber.length} vendas)
📤 A Pagar: R$ ${totalPagar.toFixed(2)} (${pendentes.length} contas)

━━ ALERTAS ━━
${critical > 0 ? `🔴 ${critical} item(ns) com 8+ dias no estoque — VENDER URGENTE!` : '✅ Estoque sem itens críticos.'}
${saldo < 5000 ? '🔴 Saldo baixo — ATENÇÃO ao caixa!' : ''}
${pendentes.filter(p => p.status === 'ATRASADO').length > 0 ? `⚠️ ${pendentes.filter(p => p.status === 'ATRASADO').length} conta(s) a pagar ATRASADA(S)!` : ''}`;
}

// ═══════════════════════════════════════════════════════════════
// 4. ORGANIZAR AGENDA — Substitui Amanda (AGENDA)
// ═══════════════════════════════════════════════════════════════

interface AgendaItem {
    prioridade: '🔴 Hoje' | '🟡 Amanhã' | '🟢 Esta semana';
    tipo: string;
    descricao: string;
    responsavel?: string;
}

export function organizarAgenda(
    scheduledOrders: ScheduledOrder[],
    sales: Sale[],
    payables: Payable[],
    clients: Client[]
): AgendaItem[] {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
    const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
    const items: AgendaItem[] = [];

    // Entregas agendadas
    scheduledOrders.filter(o => o.status === 'ABERTO' || o.status === 'CONFIRMADO').forEach(order => {
        const prio = order.data_entrega <= today ? '🔴 Hoje'
            : order.data_entrega <= tomorrow ? '🟡 Amanhã' : '🟢 Esta semana';
        if (order.data_entrega <= weekEnd) {
            items.push({
                prioridade: prio,
                tipo: '📦 Entrega',
                descricao: `${order.nome_cliente}: ${order.itens} (${order.data_entrega}${order.hora_entrega ? ' ' + order.hora_entrega : ''})`,
                responsavel: 'Motorista'
            });
        }
    });

    // Cobranças vencidas
    sales.filter(s => s.status_pagamento === 'PENDENTE' && s.data_vencimento <= today).forEach(sale => {
        const diasAtraso = Math.floor((now.getTime() - new Date(sale.data_vencimento).getTime()) / 86400000);
        items.push({
            prioridade: diasAtraso > 7 ? '🔴 Hoje' : '🟡 Amanhã',
            tipo: '💰 Cobrança',
            descricao: `${sale.nome_cliente || sale.id_cliente}: R$ ${(sale.peso_real_saida * sale.preco_venda_kg).toFixed(2)} (${diasAtraso}d atraso)`,
            responsavel: 'Diana (Cobrança)'
        });
    });

    // Contas a pagar vencendo
    payables.filter(p => (p.status === 'PENDENTE' || p.status === 'ATRASADO') && p.data_vencimento <= weekEnd).forEach(p => {
        const prio = p.data_vencimento <= today ? '🔴 Hoje'
            : p.data_vencimento <= tomorrow ? '🟡 Amanhã' : '🟢 Esta semana';
        items.push({
            prioridade: prio,
            tipo: '📤 Conta a Pagar',
            descricao: `${p.descricao}: R$ ${(p.valor - (p.valor_pago || 0)).toFixed(2)} (vence ${p.data_vencimento})`,
            responsavel: 'Financeiro'
        });
    });

    // Follow-up de clientes inativos (>7 dias)
    clients.forEach(c => {
        if (c.status === 'INATIVO') return;
        const lastSale = sales.filter(s => s.id_cliente === c.id_ferro && s.status_pagamento !== 'ESTORNADO')
            .sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime())[0];
        if (lastSale) {
            const dias = Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / 86400000);
            if (dias >= 7 && dias < 30) {
                items.push({
                    prioridade: dias > 14 ? '🟡 Amanhã' : '🟢 Esta semana',
                    tipo: '📞 Follow-up',
                    descricao: `${c.nome_social}: ${dias} dias sem comprar`,
                    responsavel: 'Marcos (Comercial)'
                });
            }
        }
    });

    // Ordenar por prioridade
    const prioOrder = { '🔴 Hoje': 0, '🟡 Amanhã': 1, '🟢 Esta semana': 2 };
    return items.sort((a, b) => prioOrder[a.prioridade] - prioOrder[b.prioridade]);
}

export function formatAgenda(items: AgendaItem[]): string {
    if (items.length === 0) return '✅ Agenda limpa — nenhuma pendência esta semana!';

    const hoje = items.filter(i => i.prioridade === '🔴 Hoje');
    const amanha = items.filter(i => i.prioridade === '🟡 Amanhã');
    const semana = items.filter(i => i.prioridade === '🟢 Esta semana');

    let result = `🗓️ AGENDA (${items.length} itens)\n\n`;

    if (hoje.length > 0) {
        result += `━━ 🔴 HOJE (${hoje.length}) ━━\n`;
        hoje.forEach(i => { result += `  ${i.tipo} ${i.descricao}\n`; });
        result += '\n';
    }
    if (amanha.length > 0) {
        result += `━━ 🟡 AMANHÃ (${amanha.length}) ━━\n`;
        amanha.forEach(i => { result += `  ${i.tipo} ${i.descricao}\n`; });
        result += '\n';
    }
    if (semana.length > 0) {
        result += `━━ 🟢 ESTA SEMANA (${semana.length}) ━━\n`;
        semana.forEach(i => { result += `  ${i.tipo} ${i.descricao}\n`; });
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
// 5. VERIFICAR INTEGRIDADE — Substitui Felipe (MONITOR_BUGS)
// ═══════════════════════════════════════════════════════════════

interface IntegrityIssue {
    severity: '✅ OK' | '⚠️ Atenção' | '🔴 Crítico';
    module: string;
    issue: string;
}

export function verificarIntegridadeDados(
    batches: Batch[], stock: StockItem[], sales: Sale[],
    transactions: Transaction[], payables: Payable[]
): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];

    // 1. Batch FECHADO sem stock_items = "Ghost Batch"
    const closedBatches = batches.filter(b => b.status === 'FECHADO');
    closedBatches.forEach(b => {
        const hasStock = stock.some(s => s.id_lote === b.id_lote);
        if (!hasStock) {
            issues.push({
                severity: '🔴 Crítico', module: 'LOTES',
                issue: `Ghost Batch: Lote ${b.id_lote} está FECHADO mas NÃO tem peças no estoque.`
            });
        }
    });

    // 2. Stock_item VENDIDO sem sale correspondente
    const soldItems = stock.filter(s => s.status === 'VENDIDO');
    soldItems.forEach(item => {
        const hasSale = sales.some(s => s.id_completo === item.id_completo || s.id_completo.includes(item.id_completo));
        if (!hasSale) {
            issues.push({
                severity: '🔴 Crítico', module: 'ESTOQUE',
                issue: `Órfão: Item ${item.id_completo} está VENDIDO mas não tem venda associada.`
            });
        }
    });

    // 3. Payables duplicados para mesmo lote
    const lotePayables: Record<string, number> = {};
    payables.filter(p => p.categoria === 'COMPRA_GADO' && p.id_lote).forEach(p => {
        lotePayables[p.id_lote!] = (lotePayables[p.id_lote!] || 0) + 1;
    });
    Object.entries(lotePayables).filter(([_, count]) => count > 1).forEach(([loteId, count]) => {
        issues.push({
            severity: '🔴 Crítico', module: 'FINANCEIRO',
            issue: `Payable Duplicado: Lote ${loteId} tem ${count} payables de COMPRA_GADO (deveria ter 1).`
        });
    });

    // 4. Payable sem id_lote (Orphan) para COMPRA_GADO
    payables.filter(p => p.categoria === 'COMPRA_GADO' && !p.id_lote && p.status !== 'CANCELADO').forEach(p => {
        issues.push({
            severity: '⚠️ Atenção', module: 'FINANCEIRO',
            issue: `Payable Órfão: "${p.descricao}" (R$${p.valor.toFixed(2)}) não tem id_lote. Pode ser Ghost Debt.`
        });
    });

    // 5. Vendas À VISTA sem transaction de ENTRADA
    sales.filter(s => s.status_pagamento === 'PAGO').forEach(s => {
        const hasTransaction = transactions.some(t =>
            t.tipo === 'ENTRADA' && (
                t.referencia_id === s.id_venda ||
                t.descricao.includes(s.id_venda) ||
                (t.referencia_id && t.referencia_id.includes('TR-REC'))
            )
        );
        if (!hasTransaction) {
            issues.push({
                severity: '⚠️ Atenção', module: 'FINANCEIRO',
                issue: `Venda ${s.id_venda} está PAGA mas pode não ter transaction ENTRADA no caixa.`
            });
        }
    });

    // 6. Float precision (centavos suspeitos)
    const totalEntradas = transactions.filter(t => t.tipo === 'ENTRADA').reduce((sum, t) => sum + t.valor, 0);
    const totalSaidas = transactions.filter(t => t.tipo === 'SAIDA').reduce((sum, t) => sum + t.valor, 0);
    const saldo = totalEntradas - totalSaidas;
    const centavos = Math.abs(saldo * 100 - Math.round(saldo * 100));
    if (centavos > 0.01) {
        issues.push({
            severity: '⚠️ Atenção', module: 'FINANCEIRO',
            issue: `Float Drift: Saldo R$${saldo.toFixed(4)} tem centavos suspeitos (IEEE 754). Aplicar Math.round.`
        });
    }

    // Se tudo OK
    if (issues.length === 0) {
        issues.push({ severity: '✅ OK', module: 'SISTEMA', issue: 'Integridade 100% — Nenhuma inconsistência detectada!' });
    }

    return issues;
}

export function formatIntegrityReport(issues: IntegrityIssue[]): string {
    const critical = issues.filter(i => i.severity === '🔴 Crítico').length;
    const warnings = issues.filter(i => i.severity === '⚠️ Atenção').length;

    let header = critical > 0
        ? `🔴 INTEGRIDADE COMPROMETIDA — ${critical} problema(s) crítico(s)`
        : warnings > 0
            ? `⚠️ INTEGRIDADE COM ALERTAS — ${warnings} ponto(s) de atenção`
            : `✅ INTEGRIDADE 100% — Sistema saudável`;

    const lines = issues.map(i => `${i.severity} [${i.module}] ${i.issue}`);
    return `🔎 RELATÓRIO DE INTEGRIDADE\n\n${header}\n\n${lines.join('\n')}`;
}
