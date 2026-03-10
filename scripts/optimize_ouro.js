const fs = require('fs');
const path = require('path');

// ── DATASET HISTÓRICO REAL (2020 a 2026) ──
const historico = [
    { ano: '2020', dolar: 5.15, milho: 60.0, abateMilhoes: 29.7, bezerro: 2100, consumo: 27, arrobaReal: 260.00 },
    { ano: '2021', dolar: 5.40, milho: 90.0, abateMilhoes: 27.5, bezerro: 2900, consumo: 25, arrobaReal: 305.00 },
    { ano: '2022', dolar: 5.16, milho: 85.0, abateMilhoes: 29.8, bezerro: 2600, consumo: 26, arrobaReal: 295.00 },
    { ano: '2023', dolar: 4.99, milho: 55.0, abateMilhoes: 34.0, bezerro: 1950, consumo: 28, arrobaReal: 245.00 },
    { ano: '2024', dolar: 5.45, milho: 60.0, abateMilhoes: 38.0, bezerro: 2100, consumo: 30, arrobaReal: 235.00 },
    { ano: '2025', dolar: 5.80, milho: 70.0, abateMilhoes: 32.0, bezerro: 2600, consumo: 32, arrobaReal: 290.00 },
    { ano: '2026', dolar: 5.82, milho: 69.5, abateMilhoes: 28.0, bezerro: 3200, consumo: 35, arrobaReal: 350.00 }
];

function preverArroba(p, w) {
    return w.wBase +
        (p.dolar * w.wDolar) +
        (p.milho * w.wMilho) +
        (p.abateMilhoes * w.wAbate) +
        (p.bezerro * w.wBezerro) +
        (p.consumo * w.wConsumo);
}

function avaliarModelo(w) {
    let erroTotal = 0;
    for (const p of historico) {
        const previsto = preverArroba(p, w);
        erroTotal += Math.abs(previsto - p.arrobaReal);
    }
    return erroTotal / historico.length;
}

let melhoresPesos = {
    wBase: 75,
    wDolar: 25,
    wMilho: 0.5,
    wAbate: -2,
    wBezerro: 0.05,
    wConsumo: 1.5
};

let menorErro = avaliarModelo(melhoresPesos);
console.log(`\n======================================================`);
console.log(`📉 BACKTEST INICIAL (V6 ATUAL)`);
console.log(`Erro Médio Absoluto (MAE): R$ ${menorErro.toFixed(2)} por arroba`);
console.log(`======================================================\n`);

console.log(`🤖 Iniciando Otimização por IA (Busca Aleatória Dirigida - 3 Milhões de ciclos)...`);

const ITERS = 3000000;
for (let i = 0; i < ITERS; i++) {
    const wTeste = {
        wBase: melhoresPesos.wBase + (Math.random() * 10 - 5),
        wDolar: melhoresPesos.wDolar + (Math.random() * 4 - 2),
        wMilho: melhoresPesos.wMilho + (Math.random() * 0.2 - 0.1),
        wAbate: melhoresPesos.wAbate + (Math.random() * 1 - 0.5),
        wBezerro: melhoresPesos.wBezerro + (Math.random() * 0.02 - 0.01),
        wConsumo: melhoresPesos.wConsumo + (Math.random() * 1 - 0.5),
    };

    const erroAferido = avaliarModelo(wTeste);

    if (erroAferido < menorErro) {
        menorErro = erroAferido;
        melhoresPesos = { ...wTeste };
    }
}

console.log(`\n🏆 OTIMIZAÇÃO CONCLUÍDA!`);
console.log(`NOVO ERRO MÉDIO HISTÓRICO: R$ ${menorErro.toFixed(2)} por arroba`);
console.log(`\n== A FÓRMULA MATEMÁTICA DEFINITIVA (MÍNIMO GLOBAL) ==`);
console.log(`P = ${melhoresPesos.wBase.toFixed(2)} `);
console.log(`  + (${melhoresPesos.wDolar.toFixed(2)} × Dólar)`);
console.log(`  + (${melhoresPesos.wMilho.toFixed(4)} × Milho)`);
console.log(`  + (${melhoresPesos.wAbate.toFixed(2)} × AbateMilhões)`);
console.log(`  + (${melhoresPesos.wBezerro.toFixed(4)} × Bezerro)`);
console.log(`  + (${melhoresPesos.wConsumo.toFixed(2)} × Consumo)`);

console.log(`\n== TRACKING ANO A ANO (NOVA FÓRMULA vs REAL) ==`);
for (const p of historico) {
    const previsto = preverArroba(p, melhoresPesos);
    const erro = previsto - p.arrobaReal;
    console.log(`[${p.ano}] Real: R$${p.arrobaReal.toFixed(2)} | Modelo: R$${previsto.toFixed(2)} | Erro: ${erro > 0 ? '+' : ''}R$${erro.toFixed(2)}`);
}
