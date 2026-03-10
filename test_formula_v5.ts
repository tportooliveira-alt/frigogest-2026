import { predizerPrecoFuturoV5, calcularPrecoV4 } from './services/marketDataService';

console.log("=== TESTE DE CALIBRAÇÃO FÓRMULA V5 (EXPORTAÇÃO E MACRO) ===");

// Cenário 1: Atual (Março 2026 - Dólar 5.75, Exportação Normal, Virada de Ciclo)
const c1 = predizerPrecoFuturoV5(5.75, 170000, 'VIRADA_RETENCAO', true, false);
console.log("CENÁRIO 1 (Atual - Dólar 5.75, Virada Ciclo): ", c1);

// Cenário 2: Bull Market Extremo (Dolar explodindo e China comprando tudo)
const c2 = predizerPrecoFuturoV5(6.10, 220000, 'VIRADA_RETENCAO', true, false);
console.log("CENÁRIO 2 (Bull Market - Dólar 6.10, SECEX Recorde): ", c2);

// Cenário 3: Bear Market Normal (Dólar Baixo, Sem exportação agressiva, Oferta Gado Alta)
const c3 = predizerPrecoFuturoV5(4.90, 130000, 'BAIXA', false, false);
console.log("CENÁRIO 3 (Bear Market - Dólar 4.90, Ciclo de Baixa): ", c3);

// Cenário 4: Vaca Louca (Cisne Negro)
const c4 = predizerPrecoFuturoV5(5.50, 160000, 'VIRADA_RETENCAO', true, true);
console.log("CENÁRIO 4 (Cisne Negro / Embargo China): ", c4);

console.log("\nComparando com a V4 Antiga (Simplista):");
console.log("Preço V4 Dólar 5.75:", calcularPrecoV4(5.75, 80, 2400));
