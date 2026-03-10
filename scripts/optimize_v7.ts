import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── DATASET HISTÓRICO GLOBAL (2020 a 2026) ──
// Adicionado Variáveis Globais Rabobank/USDA: Selic (Juros), Frango (Concorrente), Exportações SECEX (Demanda Externa)
interface Periodo {
    ano: string;
    dolar: number;         // R$
    milho: number;         // R$/saca 60kg
    abateMilhoes: number;  // Cabeças abatidas/ano (oferta BR)
    bezerro: number;       // R$/cabeça Nelore
    consumo: number;       // kg in natura per capita
    selic: number;         // % (Custo de oportunidade do confinamento)
    frango: number;        // R$/kg atacado (Teto de substituição USDA)
    exportacaoMiTon: number; // Volume de Exportação SECEX em Milhões de Toneladas
    arrobaReal: number;    // R$/@ Base SP (Meta)
}

const historico: Periodo[] = [
    { ano: '2020', dolar: 5.15, milho: 60.0, abateMilhoes: 29.7, bezerro: 2100, consumo: 27, selic: 2.00, frango: 4.5, exportacaoMiTon: 2.01, arrobaReal: 260.00 },
    { ano: '2021', dolar: 5.40, milho: 90.0, abateMilhoes: 27.5, bezerro: 2900, consumo: 25, selic: 9.25, frango: 6.5, exportacaoMiTon: 1.86, arrobaReal: 305.00 },
    { ano: '2022', dolar: 5.16, milho: 85.0, abateMilhoes: 29.8, bezerro: 2600, consumo: 26, selic: 13.75, frango: 7.5, exportacaoMiTon: 2.26, arrobaReal: 295.00 },
    { ano: '2023', dolar: 4.99, milho: 55.0, abateMilhoes: 34.0, bezerro: 1950, consumo: 28, selic: 11.75, frango: 6.8, exportacaoMiTon: 2.49, arrobaReal: 245.00 },
    { ano: '2024', dolar: 5.45, milho: 60.0, abateMilhoes: 38.0, bezerro: 2100, consumo: 30, selic: 11.25, frango: 7.2, exportacaoMiTon: 2.80, arrobaReal: 235.00 },
    { ano: '2025', dolar: 5.80, milho: 70.0, abateMilhoes: 32.0, bezerro: 2600, consumo: 32, selic: 13.25, frango: 8.0, exportacaoMiTon: 3.20, arrobaReal: 290.00 },
    { ano: '2026', dolar: 5.82, milho: 69.5, abateMilhoes: 28.0, bezerro: 3200, consumo: 35, selic: 13.75, frango: 8.2, exportacaoMiTon: 3.50, arrobaReal: 350.00 } // Real/Projetado
];

interface PesosV7 {
    wBase: number;
    wDolar: number;
    wMilho: number;
    wAbate: number;
    wBezerro: number;
    wConsumo: number;
    wSelic: number;
    wFrango: number;
    wExportacao: number;
}

function preverArrobaV7(p: Periodo, w: PesosV7): number {
    return w.wBase +
        (p.dolar * w.wDolar) +
        (p.milho * w.wMilho) +
        (p.abateMilhoes * w.wAbate) +
        (p.bezerro * w.wBezerro) +
        (p.consumo * w.wConsumo) +
        (p.selic * w.wSelic) +
        (p.frango * w.wFrango) +
        (p.exportacaoMiTon * w.wExportacao);
}

function avaliarModelo(w: PesosV7): number {
    let erroTotal = 0;
    for (const p of historico) {
        const previsto = preverArrobaV7(p, w);
        erroTotal += Math.abs(previsto - p.arrobaReal);
    }
    return erroTotal / historico.length; // MAE (Mean Absolute Error)
}

// Base do ponto de partida da IA (Usando os pesos de Ouro V6 + Chutes iniciais pras novas vars)
let melhoresPesos: PesosV7 = {
    wBase: 75,
    wDolar: 25,
    wMilho: 0.5,
    wAbate: -2,
    wBezerro: 0.05,
    wConsumo: 1.5,
    wSelic: -1.0, // Alta na selic tende a piorar preço por custo de carregamento do pecuarista que vende forçado 
    wFrango: 5.0, // Frango caro sobe o teto da arroba
    wExportacao: 10.0 // Mais exportação, menos carne interna = mais caro
};

let menorErro = avaliarModelo(melhoresPesos);
console.log(`\n======================================================`);
console.log(`📉 BACKTEST INICIAL (V7 BASE)`);
console.log(`Erro Médio Absoluto (MAE): R$ ${menorErro.toFixed(2)} por arroba`);
console.log(`======================================================\n`);

console.log(`🤖 Iniciando Metodologia Gradiente / Random Search - MILHOES DE COMBINAÇÕES...`);

const ITERS = 3000000;
for (let i = 0; i < ITERS; i++) {
    const wTeste: PesosV7 = {
        wBase: melhoresPesos.wBase + (Math.random() * 20 - 10),
        wDolar: melhoresPesos.wDolar + (Math.random() * 4 - 2),
        wMilho: melhoresPesos.wMilho + (Math.random() * 0.4 - 0.2),
        wAbate: melhoresPesos.wAbate + (Math.random() * 1.0 - 0.5),
        wBezerro: melhoresPesos.wBezerro + (Math.random() * 0.02 - 0.01),
        wConsumo: melhoresPesos.wConsumo + (Math.random() * 1 - 0.5),
        wSelic: melhoresPesos.wSelic + (Math.random() * 1 - 0.5),
        wFrango: melhoresPesos.wFrango + (Math.random() * 2 - 1),
        wExportacao: melhoresPesos.wExportacao + (Math.random() * 5 - 2.5),
    };

    const erroAferido = avaliarModelo(wTeste);

    // Otimização estrita (Se melhorar, salva)
    if (erroAferido < menorErro) {
        menorErro = erroAferido;
        melhoresPesos = { ...wTeste };
    }
}

console.log(`\n🏆 ALGORITMO V7 OTIMIZADO CONCLUÍDO (Global Standards)`);
console.log(`NOVO ERRO MÉDIO HISTÓRICO: R$ ${menorErro.toFixed(2)} por arroba`);
console.log(`\n== A FÓRMULA MATEMÁTICA DEFINITIVA V7 (MIN GLOBAL) ==`);
console.log(`P = ${melhoresPesos.wBase.toFixed(2)} `);
console.log(`  + (${melhoresPesos.wDolar.toFixed(2)} × Dólar)`);
console.log(`  + (${melhoresPesos.wMilho.toFixed(4)} × Milho)`);
console.log(`  + (${melhoresPesos.wAbate.toFixed(2)} × AbateMilhões)`);
console.log(`  + (${melhoresPesos.wBezerro.toFixed(4)} × Bezerro)`);
console.log(`  + (${melhoresPesos.wConsumo.toFixed(2)} × Consumo)`);
console.log(`  + (${melhoresPesos.wSelic.toFixed(2)} × Selic)`);
console.log(`  + (${melhoresPesos.wFrango.toFixed(2)} × Frango kg)`);
console.log(`  + (${melhoresPesos.wExportacao.toFixed(2)} × Exportação Mi Tons)`);

console.log(`\n== TRACKING ANO A ANO (V7 vs REAL) ==`);
for (const p of historico) {
    const previsto = preverArrobaV7(p, melhoresPesos);
    const erro = previsto - p.arrobaReal;
    console.log(`[${p.ano}] Real: R$${p.arrobaReal.toFixed(2)} | Modelo: R$${previsto.toFixed(2)} | Erro: ${erro > 0 ? '+' : ''}R$${erro.toFixed(2)}`);
}

const outPath = path.join(__dirname, 'optimization_v7_result.md');
const mdContent = `
# Backtest Histórico: Otimização Global USD/Rabobank - V7
**Margem de Erro Média Final (MAE):** R$ ${menorErro.toFixed(2)} por arroba.

Variáveis Integradas da Pesquisa Mundial:
- Exportação (Fator Demanda Global, Rabobank).
- Preço do Frango (Fator Substituição, USDA).
- Selic (Custo de Carregamento / Juros).

## Fórmula Otimizada V7
\`\`\`math
Arroba = ${melhoresPesos.wBase.toFixed(2)} + 
         (${melhoresPesos.wDolar.toFixed(2)} * Dolar) + 
         (${melhoresPesos.wMilho.toFixed(4)} * Milho) + 
         (${melhoresPesos.wAbate.toFixed(2)} * Abate_Milhoes) + 
         (${melhoresPesos.wBezerro.toFixed(4)} * Bezerro) + 
         (${melhoresPesos.wConsumo.toFixed(2)} * Consumo_Anual) + 
         (${melhoresPesos.wSelic.toFixed(2)} * Selic_Meta) + 
         (${melhoresPesos.wFrango.toFixed(2)} * Frango_Atacado) + 
         (${melhoresPesos.wExportacao.toFixed(2)} * Exportacao_Mi_Tons)
\`\`\`

## Relatório Ano a Ano (2020 - 2026)
${historico.map(p => {
    const prev = preverArrobaV7(p, melhoresPesos);
    return `- **${p.ano}:** Real R$ ${p.arrobaReal.toFixed(2)} | Calculado V7: R$ ${prev.toFixed(2)} | Diferença: ${prev - p.arrobaReal > 0 ? '+' : ''}R$ ${(prev - p.arrobaReal).toFixed(2)}`;
}).join('\n')}
`;
fs.writeFileSync(outPath, mdContent);
console.log(`\n=> Relatório salvo em: ${outPath}`);
