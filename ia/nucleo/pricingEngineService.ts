// ═══════════════════════════════════════════════════════════════
// 🎯 PRICING ENGINE SERVICE — Motor de Precificação Inteligente V4
// ═══════════════════════════════════════════════════════════════
// Usa a Equação V4 + Dados ao Vivo para calcular:
// 1. Preço máximo de compra por arroba
// 2. Custo real por kg de carcaça
// 3. Margem projetada de lucro
// 4. Semáforo de decisão (COMPRAR / ESPERAR / NÃO COMPRAR)
// ═══════════════════════════════════════════════════════════════

import { fetchAllMarketData, calcularPrecoMensalV4 } from './marketDataService';

// Custos operacionais do frigorífico (R$ por cabeça)
export interface CustosOperacionais {
    abate: number;       // Custo de abate por cabeça (SIF/ADAB)
    frete: number;       // Frete fazenda → frigorífico
    camaraFria: number;  // Custo diário de câmara fria × dias médios
    funrural: number;    // % Funrural (2.3% sobre compra)
    icms: number;        // % ICMS diferido (0% na BA para gado)
    margensDesejada: number; // % margem bruta desejada
}

export interface ResultadoPrecificacao {
    // Inputs
    precoArrobaRegional: number;    // Preço da @ na região (VCA-BA)
    precoArrobaCepea: number;       // Preço CEPEA nacional
    dolarAtual: number;
    spreadRegional: number;         // Diferença CEPEA - Regional

    // Cálculos V4
    precoV4Projetado: number;       // Equação V4 para o mês atual
    precoV4ProximoMes: number;      // Equação V4 para o próximo mês
    tendencia: 'ALTA' | 'BAIXA' | 'LATERAL'; // Tendência V4

    // Análise de Compra
    custoTotalPorArroba: number;    // @ + frete + abate + funrural
    custoRealPorKg: number;         // Custo real por kg de carcaça
    precoVendaMedioKg: number;      // Preço médio de venda no mercado
    margemBruta: number;            // % margem bruta estimada
    margemLiquida: number;          // % margem líquida

    // Limites de Compra
    precoMaximoArroba: number;      // Máximo que pode pagar por @
    precoIdealArroba: number;       // Preço ideal (com margem confortável)
    economiaVsMax: number;          // Quanto economiza vs máximo (R$/@)

    // Semáforo
    sinal: 'COMPRAR' | 'ESPERAR' | 'NAO_COMPRAR';
    corSinal: string;
    justificativa: string;

    // Extras
    pontoEquilibrio: number;        // Arrobas/mês para cobrir custos fixos
    lucroEstimadoPorCabeca: number;
}

// Custos padrão para frigorífico pequeno em VCA-BA
const CUSTOS_PADRAO: CustosOperacionais = {
    abate: 180,          // R$ 180/cabeça (serviço de abate)
    frete: 120,          // R$ 120/cabeça (frete médio 100-200km)
    camaraFria: 35,      // R$ 5/dia × 7 dias médios
    funrural: 2.3,       // 2.3% sobre valor da compra
    icms: 0,             // 0% com diferimento na Bahia
    margensDesejada: 22  // 22% margem bruta mínima
};

// Constantes do mercado
const RENDIMENTO_MEDIO = 0.53;     // 53% rendimento de carcaça (Nelore)
const KG_POR_ARROBA = 15;          // 1 arroba = 15kg de carcaça
const SPREAD_VCA_SP = 30;          // Diferença média VCA vs SP (R$/@)
const PRECO_VENDA_MEDIO_KG = 26.5; // Preço médio venda carcaça (R$/kg)
const CUSTOS_FIXOS_MENSAIS = 85000; // Custos fixos operacionais mensais

export async function calcularPrecificacao(
    precoArrobaOfertado?: number,
    rendimento?: number,
    custos?: Partial<CustosOperacionais>
): Promise<ResultadoPrecificacao> {

    // 1. Buscar dados ao vivo
    const marketData = await fetchAllMarketData();
    const dolarAtual = marketData.dolar.valor;
    const cepeaAtual = marketData.cepeaBoi.valor;
    const mesAtual = new Date().getMonth() + 1;
    const proximoMes = mesAtual === 12 ? 1 : mesAtual + 1;

    // 2. Calcular preço V4 projetado
    const abateEstimado = 38.0; // milhões cabeças/ano
    const bezerroEstimado = 3200; // R$/cabeça
    const precoV4Atual = calcularPrecoMensalV4(dolarAtual, abateEstimado, bezerroEstimado, mesAtual);
    const precoV4Proximo = calcularPrecoMensalV4(dolarAtual, abateEstimado, bezerroEstimado, proximoMes);

    // 3. Calcular preço regional (VCA = CEPEA - spread)
    const precoRegional = precoArrobaOfertado || (cepeaAtual - SPREAD_VCA_SP);
    const spreadReal = cepeaAtual - precoRegional;

    // 4. Tendência
    const tendencia: 'ALTA' | 'BAIXA' | 'LATERAL' = precoV4Proximo > precoV4Atual * 1.02 ? 'ALTA'
        : precoV4Proximo < precoV4Atual * 0.98 ? 'BAIXA' : 'LATERAL';

    // 5. Custos operacionais
    const c = { ...CUSTOS_PADRAO, ...custos };
    const rend = rendimento || RENDIMENTO_MEDIO;

    // Boi de 500kg vivo → ~17 arrobas de carcaça
    const arrobasPorCabeca = (500 * rend) / KG_POR_ARROBA;
    const valorCompraCabeca = precoRegional * arrobasPorCabeca;
    const funruralValor = valorCompraCabeca * (c.funrural / 100);
    const custoTotalCabeca = valorCompraCabeca + funruralValor + c.abate + c.frete + c.camaraFria;
    const custoTotalPorArroba = custoTotalCabeca / arrobasPorCabeca;

    // 6. Custo real por kg de carcaça
    const kgCarcacaPorCabeca = 500 * rend;
    const custoRealPorKg = custoTotalCabeca / kgCarcacaPorCabeca;

    // 7. Margem
    const receitaPorCabeca = kgCarcacaPorCabeca * PRECO_VENDA_MEDIO_KG;
    const margemBruta = ((receitaPorCabeca - custoTotalCabeca) / receitaPorCabeca) * 100;
    const margemLiquida = margemBruta - 5; // Estimativa de custos indiretos

    // 8. Preço máximo por arroba
    const receitaPorArroba = (PRECO_VENDA_MEDIO_KG * KG_POR_ARROBA);
    const custoFixoPorArroba = (c.abate + c.frete + c.camaraFria) / arrobasPorCabeca;
    const precoMaximoArroba = (receitaPorArroba / (1 + c.margensDesejada / 100)) - custoFixoPorArroba;
    const precoIdealArroba = precoMaximoArroba * 0.92; // 8% abaixo do max = ideal

    // 9. Lucro por cabeça
    const lucroEstimadoPorCabeca = receitaPorCabeca - custoTotalCabeca;

    // 10. Ponto de equilíbrio
    const lucroPorArroba = receitaPorArroba - custoTotalPorArroba;
    const pontoEquilibrio = lucroPorArroba > 0 ? Math.ceil(CUSTOS_FIXOS_MENSAIS / lucroPorArroba) : 999;

    // 11. Semáforo de decisão
    let sinal: 'COMPRAR' | 'ESPERAR' | 'NAO_COMPRAR';
    let corSinal: string;
    let justificativa: string;

    if (precoRegional <= precoIdealArroba && tendencia !== 'BAIXA' && margemBruta >= c.margensDesejada) {
        sinal = 'COMPRAR';
        corSinal = 'bg-green-500';
        justificativa = `Preço R$ ${precoRegional.toFixed(0)}/@ está ${((precoMaximoArroba - precoRegional)).toFixed(0)} abaixo do máximo. Margem de ${margemBruta.toFixed(1)}%. Tendência V4: ${tendencia}. COMPRE AGORA!`;
    } else if (precoRegional <= precoMaximoArroba && margemBruta >= (c.margensDesejada * 0.7)) {
        sinal = 'ESPERAR';
        corSinal = 'bg-yellow-500';
        justificativa = `Preço R$ ${precoRegional.toFixed(0)}/@ está perto do limite. Margem de ${margemBruta.toFixed(1)}% (abaixo do ideal ${c.margensDesejada}%). ${tendencia === 'BAIXA' ? 'Tendência de queda — espere mais.' : 'Negocie desconto de R$5-10/@.'}`;
    } else {
        sinal = 'NAO_COMPRAR';
        corSinal = 'bg-red-500';
        justificativa = `Preço R$ ${precoRegional.toFixed(0)}/@ acima do máximo R$ ${precoMaximoArroba.toFixed(0)}/@. Margem de ${margemBruta.toFixed(1)}% (abaixo do mínimo ${c.margensDesejada}%). NÃO COMPRE a este preço.`;
    }

    return {
        precoArrobaRegional: precoRegional,
        precoArrobaCepea: cepeaAtual,
        dolarAtual,
        spreadRegional: spreadReal,
        precoV4Projetado: precoV4Atual,
        precoV4ProximoMes: precoV4Proximo,
        tendencia,
        custoTotalPorArroba,
        custoRealPorKg,
        precoVendaMedioKg: PRECO_VENDA_MEDIO_KG,
        margemBruta,
        margemLiquida,
        precoMaximoArroba,
        precoIdealArroba,
        economiaVsMax: precoMaximoArroba - precoRegional,
        sinal,
        corSinal,
        justificativa,
        pontoEquilibrio,
        lucroEstimadoPorCabeca
    };
}
