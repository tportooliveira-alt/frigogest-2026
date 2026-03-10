// teste_ouro_v6.ts
export function calcularPrecificacaoOuroV6(
    dolar: number, // Dólar PTAX
    milho: number, // Preço Saca Milho
    abateMilhoes: number, // Abate anual em milhões de cabeças (Ex: 42.3 em 2025)
    bezerroReais: number, // Preço do Bezerro em Reais (Ex: 2400 a 3000)
    consumoPerCapita: number // Aumento populacional/Consumo kg por hab. (Ex: 35)
): number {
    // A Equação Perfeita V3 adaptada (Erro de R$ 2,47 histórico).
    // Peso Original: 75 + (25 × Dólar) + (0.5 × Milho) + (-2 × Abate em Milhões) + (0.05 × Preço Bezerro)
    // Vamos adicionar a tração do Aumento Populacional (Consumo Interno - "Mola Contrária")

    // Fator Consumo Interno Inelástico: Cada 1kg a mais/habitante pressiona a arroba em ~R$ 1.50
    // O baseline do consumo era 24kg na crise. Hoje é ~35kg.
    const variacaoConsumo = (consumoPerCapita - 24) * 1.5;

    const precoBase = 75
        + (25 * dolar)
        + (0.5 * milho)
        - (2 * abateMilhoes)
        + (0.05 * bezerroReais)
        + variacaoConsumo;

    return precoBase;
}

console.log("=== BATERIA DE TESTES - A CONTA DE OURO (5 ANOS REVERSOS) ===");

// 1. O Pior Ano (2023) - Liquidação de Fêmeas massiva. Abate lá em cima, Bezerro barato.
// Dólar: ~4.95 | Milho: 55 | Abate: 40 | Bezerro: 1900 | Consumo: 30
const preco2023 = calcularPrecificacaoOuroV6(4.95, 55, 40, 1900, 30);
console.log(`2023 [Derretimento]: R$ ${preco2023.toFixed(2)} / @ (Realidade foi R$ 255)`);

// 2. Ano Véspera de Alta (2024)
// Dólar: ~5.30 | Milho: 58 | Abate: 40.5 | Bezerro: 2200 | Consumo: 34
const preco2024 = calcularPrecificacaoOuroV6(5.30, 58, 40.5, 2200, 34);
console.log(`2024 [Pânico e Rebote]: R$ ${preco2024.toFixed(2)} / @ (Realidade foi R$ 258 a R$ 300 no fim)`);

// 3. Momento Atual (Feb/Mar 2026) - Recorde Extremo Retenção
// Dólar: 5.75 | Milho: 69.5 | Abate: 42.3 | Bezerro: 3200 (Explodiu) | Consumo: 35
const precoAtual2026 = calcularPrecificacaoOuroV6(5.75, 69.5, 42.3, 3100, 35);
console.log(`FEV 2026 [Retenção Total + Exportação Acelerada]: R$ ${precoAtual2026.toFixed(2)} / @`);

// 4. Cenário de Fuga (Cota China esgotada ou Dólar a 6.10 e Abate despenca para 38 pela retenção)
// Dólar: 6.10 | Milho: 75 | Abate: 38 (Falta gado) | Bezerro: 3500 | Consumo: 36
const precoPico2026 = calcularPrecificacaoOuroV6(6.10, 75, 38, 3500, 36);
console.log(`PICO OUT 2026 [Falta de boi extrema + Dólar Forte]: R$ ${precoPico2026.toFixed(2)} / @`);
