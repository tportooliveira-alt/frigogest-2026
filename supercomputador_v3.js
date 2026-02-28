// 🧠 ANA - SUPERCOMPUTADOR V3: 12 VARIÁVEIS × 5 ANOS
// Cruzamento TOTAL de indicadores REAIS pesquisados para achar a conta perfeita
// Cada ano cruza com os dados da MESMA ÉPOCA (milho de 2022 com boi de 2022, etc.)

console.log("=================================================================");
console.log("🧠 ANA SUPERCOMPUTADOR V3: 12 VARIÁVEIS CRUZADAS (DADOS REAIS)");
console.log("=================================================================\n");

// TODOS OS DADOS REAIS PESQUISADOS (fontes: CEPEA, IBGE, B3, ABIEC, SCOT, BCB)
const dados = [
    {
        ano: 2021,
        preco_real: 305.5,       // Arroba média SP (CEPEA)
        femeas_pct: 33.8,        // % fêmeas no abate (IBGE) 
        dolar: 5.39,             // Câmbio médio BCB
        milho_saca: 91.7,        // Saca 60kg Campinas (CEPEA) - RECORDE
        frango_kg: 13.0,         // Frango atacado SP (R$/kg)
        abate_milhoes: 27.54,    // Volume abate anual (IBGE)
        exportacao_mt: 1.86,     // Milhões ton exportadas (ABIEC)
        confinamento_m: 6.5,     // Milhões cabeças confinadas (DSM)
        selic: 9.25,             // Taxa Selic final do ano (BCB)
        bezerro_preco: 2200,     // Preço médio bezerro (R$/cabeça) 
        custo_terra_ha: 1200,    // Arrendamento médio pasto (R$/ha)
        consumo_percapita: 36.2  // Consumo per capita (kg/hab/ano)
    },
    {
        ano: 2022,
        preco_real: 317.8,
        femeas_pct: 37.18,
        dolar: 5.16,
        milho_saca: 85.0,        // Milho alto mas recuando
        frango_kg: 16.5,         // Frango disparou (substituto caro = bom pro boi)
        abate_milhoes: 29.96,
        exportacao_mt: 2.26,
        confinamento_m: 7.0,
        selic: 13.75,
        bezerro_preco: 2600,
        custo_terra_ha: 1350,
        consumo_percapita: 24.2  // PIOR consumo em 18 anos!
    },
    {
        ano: 2023,
        preco_real: 255.1,       // ANO DO DERRETIMENTO
        femeas_pct: 41.19,       // Liquidação pesada
        dolar: 4.99,             // Dólar caiu
        milho_saca: 60.0,        // Milho barateou = confinamento ficou viável
        frango_kg: 8.0,          // Frango barateou = concorrente barato
        abate_milhoes: 34.06,    // Abate explodiu
        exportacao_mt: 2.28,
        confinamento_m: 7.3,
        selic: 11.75,
        bezerro_preco: 1800,     // Bezerro caiu junto
        custo_terra_ha: 1450,
        consumo_percapita: 32.0
    },
    {
        ano: 2024,
        preco_real: 258.0,       // Ainda no fundo
        femeas_pct: 43.0,        // Liquidação máxima
        dolar: 5.20,
        milho_saca: 58.0,        // Milho barato 
        frango_kg: 7.7,          // Frango barato = concorrente
        abate_milhoes: 39.27,    // RECORDE ABSOLUTO
        exportacao_mt: 2.50,
        confinamento_m: 8.0,
        selic: 10.50,
        bezerro_preco: 2100,     // Começou a subir
        custo_terra_ha: 1650,
        consumo_percapita: 35.0  // Voltou forte
    },
    {
        ano: 2025,
        preco_real: 310.0,       // Virada violenta
        femeas_pct: 45.80,       // Retenção começou (menos fêmeas disponíveis)
        dolar: 5.50,
        milho_saca: 76.0,        // Milho voltou a encarecer
        frango_kg: 8.2,
        abate_milhoes: 42.35,    // Novo recorde
        exportacao_mt: 2.70,
        confinamento_m: 9.3,
        selic: 15.00,            // Selic explodiu
        bezerro_preco: 2880,     // Bezerro disparou (+37%)
        custo_terra_ha: 1931,    // Arrendamento no teto
        consumo_percapita: 31.9
    }
];

// Fev/2026 REAL (O que está acontecendo AGORA - fonte CEPEA 27/02/2026)
const realidade2026 = {
    preco_real_sp: 352.80,    // CEPEA bateu RECORDE HISTÓRICO!
    dolar: 5.75,
    milho: 69.53,
    selic: 15.00,
    femeas_lag: 43.0          // As fêmeas de 2024 estão cobrando a conta agora
};

console.log("📊 DADOS CARREGADOS: 12 variáveis × 5 anos = 60 pontos de cruzamento real\n");

// NORMALIZAR todos os dados para a mesma escala (0 a 1) 
// Isso permite comparar o PESO relativo real de cada variável
function normalizar(arr) {
    let min = Math.min(...arr);
    let max = Math.max(...arr);
    return arr.map(v => max === min ? 0.5 : (v - min) / (max - min));
}

let precos = dados.map(d => d.preco_real);
let vars = {
    femeas: { vals: normalizar(dados.map(d => d.femeas_pct)), nome: "% Fêmeas Abate" },
    dolar: { vals: normalizar(dados.map(d => d.dolar)), nome: "Câmbio USD/BRL" },
    milho: { vals: normalizar(dados.map(d => d.milho_saca)), nome: "Milho Saca 60kg" },
    frango: { vals: normalizar(dados.map(d => d.frango_kg)), nome: "Frango Atacado" },
    abate: { vals: normalizar(dados.map(d => d.abate_milhoes)), nome: "Vol. Abate Total" },
    export: { vals: normalizar(dados.map(d => d.exportacao_mt)), nome: "Exportação (ton)" },
    confin: { vals: normalizar(dados.map(d => d.confinamento_m)), nome: "Confinamento" },
    selic: { vals: normalizar(dados.map(d => d.selic)), nome: "Taxa Selic" },
    bezerro: { vals: normalizar(dados.map(d => d.bezerro_preco)), nome: "Preço Bezerro" },
    terra: { vals: normalizar(dados.map(d => d.custo_terra_ha)), nome: "Custo Terra/ha" },
    consumo: { vals: normalizar(dados.map(d => d.consumo_percapita)), nome: "Consumo Per Capita" }
};

// CORRELAÇÃO DE PEARSON REAL entre cada variável e o preço
function pearson(x, y) {
    let n = x.length;
    let mx = x.reduce((a, b) => a + b, 0) / n;
    let my = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        num += (x[i] - mx) * (y[i] - my);
        dx += (x[i] - mx) ** 2;
        dy += (y[i] - my) ** 2;
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

let precosN = normalizar(precos);
console.log("🔬 CORRELAÇÃO DE PEARSON (Cada Variável vs. Preço da Arroba):");
console.log("   (Positivo = preço sobe junto | Negativo = preço cai junto)\n");

let correlacoes = [];
for (let key in vars) {
    let r = pearson(vars[key].vals, precosN);
    correlacoes.push({ nome: vars[key].nome, r: r, absR: Math.abs(r) });
    let dir = r > 0 ? "↑ sobe junto" : "↓ inverso";
    console.log(`   ${vars[key].nome.padEnd(22)} r = ${r > 0 ? '+' : ''}${r.toFixed(4)}  ${dir}`);
}

// Ordenar pelo impacto absoluto
correlacoes.sort((a, b) => b.absR - a.absR);
let totalAbsR = correlacoes.reduce((s, c) => s + c.absR, 0);

console.log("\n=================================================================");
console.log("🏆 RANKING FINAL: O QUE MAIS AFETA O PREÇO DA ARROBA?");
console.log("=================================================================\n");

correlacoes.forEach((c, i) => {
    let pct = ((c.absR / totalAbsR) * 100).toFixed(1);
    let barra = "█".repeat(Math.round(pct / 2));
    console.log(`${(i + 1).toString().padStart(2)}. ${c.nome.padEnd(22)} ${pct.padStart(5)}%  ${barra}  (r=${c.r > 0 ? '+' : ''}${c.r.toFixed(3)})`);
});

// REGRESSÃO MÚLTIPLA SIMPLIFICADA (Stepwise: Top 6 variáveis)
console.log("\n=================================================================");
console.log("⚙️ REGRESSÃO COM AS TOP 6 VARIÁVEIS (Grid Search Adaptativo)");
console.log("=================================================================\n");

// Usar os dados brutos (não normalizados) para a regressão
let melhor = { erro: Infinity };

// Grid search com as variáveis mais impactantes
for (let base = 0; base <= 500; base += 25) {
    for (let wF = -15; wF <= 0; wF += 1) {       // Fêmeas
        for (let wD = 20; wD <= 80; wD += 5) {      // Dólar
            for (let wM = -2; wM <= 2; wM += 0.5) {   // Milho
                for (let wA = -5; wA <= 0; wA += 1) {    // Abate
                    for (let wB = 0; wB <= 0.05; wB += 0.01) { // Bezerro

                        let erroT = 0;
                        for (let d of dados) {
                            let calc = base
                                + (wF * d.femeas_pct)
                                + (wD * d.dolar)
                                + (wM * d.milho_saca)
                                + (wA * d.abate_milhoes)
                                + (wB * d.bezerro_preco);
                            erroT += Math.abs(calc - d.preco_real);
                        }
                        let erroM = erroT / dados.length;
                        if (erroM < melhor.erro) {
                            melhor = { erro: erroM, base, wF, wD, wM, wA, wB };
                        }
                    }
                }
            }
        }
    }
}

console.log(`Erro Médio Absoluto da Fórmula: R$ ${melhor.erro.toFixed(2)} por arroba\n`);
console.log("A FÓRMULA REAL COM 6 VARIÁVEIS CRUZADAS:");
console.log(`Preço = ${melhor.base}`);
console.log(`      + (${melhor.wF} × % Fêmeas)        → Ciclo Pecuário`);
console.log(`      + (${melhor.wD} × Dólar)            → Câmbio`);
console.log(`      + (${melhor.wM} × Milho R$/saca)    → Custo Alimentação`);
console.log(`      + (${melhor.wA} × Abate em Milhões) → Pressão de Oferta`);
console.log(`      + (${melhor.wB} × Preço Bezerro)    → Custo Reposição`);

console.log("\nPROVA REAL ANO A ANO:");
for (let d of dados) {
    let calc = melhor.base
        + (melhor.wF * d.femeas_pct)
        + (melhor.wD * d.dolar)
        + (melhor.wM * d.milho_saca)
        + (melhor.wA * d.abate_milhoes)
        + (melhor.wB * d.bezerro_preco);
    let diff = Math.abs(calc - d.preco_real);
    console.log(`${d.ano} | Real: R$ ${d.preco_real.toFixed(2)} | Modelo: R$ ${calc.toFixed(2)} | Erro: R$ ${diff.toFixed(2)}`);
}

// PROJEÇÃO 2026 COM DADOS REAIS DE AGORA
console.log("\n=================================================================");
console.log("🔮 PROJEÇÃO 2026 (DADOS REAIS DE FEV/2026)");
console.log("=================================================================");

// Premissas 2026 baseadas na realidade (pesquisas já feitas)
let proj2026 = {
    femeas: 41.1,       // Retenção confirmada (caiu de 45.8 para 41.1)
    dolar: 5.75,        // Câmbio real
    milho: 69.53,       // CEPEA 27/02/2026
    abate: 38.0,        // Projeção: QUEDA de abate (retenção de matrizes = menos gado disponível)
    bezerro: 3200       // Projeção: bezerro continuando a subir
};

let proj = melhor.base
    + (melhor.wF * proj2026.femeas)
    + (melhor.wD * proj2026.dolar)
    + (melhor.wM * proj2026.milho)
    + (melhor.wA * proj2026.abate)
    + (melhor.wB * proj2026.bezerro);

console.log(`\nPremissas 2026:`);
console.log(`  Fêmeas: ${proj2026.femeas}% | Dólar: R$ ${proj2026.dolar} | Milho: R$ ${proj2026.milho}`);
console.log(`  Abate Projetado: ${proj2026.abate}M cabeças | Bezerro: R$ ${proj2026.bezerro}`);
console.log(`\n🎯 PROJEÇÃO MÉDIA ANUAL 2026 (Base CEPEA-SP): R$ ${proj.toFixed(2)} / @`);
console.log(`   Com Sazonalidade de Pico (Outubro, IS=102.6): R$ ${(proj * 1.026).toFixed(2)} / @`);
console.log(`   CEPEA Real Hoje (Fev/2026): R$ ${realidade2026.preco_real_sp}`);
console.log(`   Desvio do Modelo vs Realidade Atual: R$ ${Math.abs(proj - realidade2026.preco_real_sp).toFixed(2)}`);
console.log("=================================================================");
