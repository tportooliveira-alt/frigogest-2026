/**
 * ═══════════════════════════════════════════════════════════════
 * FRIGOGEST — CONTEXTO COMPARTILHADO ENTRE AGENTES
 * ═══════════════════════════════════════════════════════════════
 * Dados e referências que antes estavam duplicados em 3-5 prompts
 * agora são importados sob demanda por cada agente que precisa.
 */

// ── DADOS CEPEA/B3 — Mercado de Boi Gordo ──
export const CEPEA_CONTEXT = `
📊 BOI GORDO SP: R$351,00/@ (alta 7,1% no mês). Em dólares: US$68,5/@.
📊 BEZERRO NELORE MS: Alta 4,56% na parcial de fevereiro.
📊 PREVISÃO ANALISTAS: R$360-400/@ até fim 2026. Oferta restrita + demanda aquecida.
📊 EXPORTAÇÃO: China = principal destino. Recordes Jan/2026. RISCO: possível embargo chinês.
📊 SAZONALIDADE: Março pós-Carnaval/Quaresma = demanda cai. Maio-Julho inverno = demanda sobe.
📊 CORRELAÇÃO PROTEÍNAS: Frango sobe → boi ganha share. Suíno sobe → boi ganha share.
📊 B3: Contratos futuros BGIK26 (mai), BGIM26 (jun), BGIN26 (jul).
📊 ÍNDICE REPOSIÇÃO: Bezerro/Boi > 1,0 = compra desfavorável. Ideal < 0,95.
📊 ARROBA FEV/2026: SP R$351/@, MT R$320-340/@, MS R$310-330/@, GO R$315-335/@.
`;

// ── EMBRAPA — Dados de Raças e Rendimento ──
export const EMBRAPA_BREEDS_CONTEXT = `
📊 RENDIMENTO POR RAÇA + SEXO:
  MACHOS: Nelore 52-54%, Angus 55-57%, Senepol 53-55%, Tabapuã 51-53%, Cruzamento 53-56%.
  FÊMEAS: Nelore 48-51%, Angus 50-53%, Senepol 49-52%, Tabapuã 47-50%, Cruzamento 49-52%.
  REGRA: Fêmeas rendem 3-5% MENOS (mais gordura cavitária, menor musculatura).
  PESO VIVO vs RENDIMENTO: <400kg = rendimento menor. 400-500kg = ótimo. >550kg = rendimento cai.
  VACA DE DESCARTE: Rendimento 45-49%. Preço 30-40% menor.
📊 ACABAMENTO GORDURA (1-5): Score 3+ = ágio. Abaixo = deságio 5-10%.
📊 DRIP LOSS: 0,3%/dia em 0-4°C. A 5°C+ → 0,6%/dia. A 7°C+ → risco sanitário.
📊 DESOSSA: Traseiro (nobres) = 48%. Dianteiro = 38%. Miúdos/ossos = 14%.
📊 CORTES NOBRES: Picanha 1,2-1,8%, Maminha 0,8-1,2%, Alcatra 4-6%, Filé Mignon 1,5-2%.
📊 CONDENAÇÕES: Normal < 2%. Acima = investigar fornecedor/transporte.
`;

// ── MARGENS DO FRIGORÍFICO — Realidade Financeira ──
export const MARGINS_CONTEXT = `
💰 MARGEM BRUTA FRIGORÍFICO PEQUENO: 15-25%.
💰 MARGEM LÍQUIDA: 3-8% (apertadíssima!). Cada R$0,50/kg IMPORTA.
💰 MAIORES CUSTOS: 65-75% matéria-prima | 8-12% mão de obra | 5-8% logística | 3-5% energia | 2-3% embalagem.
💰 ONDE GANHAR MARGEM: Desossa própria (+15-25%), Subprodutos (sebo, osso = R$2/kg extra), Giro rápido, Venda direta.
💰 CARCAÇA INTEIRA margem 8-12%. DESOSSADA margem 18-28%.
💰 SUBPRODUTOS: Sebo R$1,5-3/kg, Osso R$0,5-1/kg, Couro R$15-40/peça, Miúdos R$8-25/kg.
`;

// ── GATILHOS MENTAIS (Cialdini + Voss) ──
export const SALES_TRIGGERS_CONTEXT = `
📚 CIALDINI — 6 Princípios: Escassez, Urgência, Reciprocidade, Prova Social, Autoridade, Comprometimento.
📚 CHRIS VOSS — Espelhamento (repita últimas 3 palavras), Rotulagem emocional, Âncora extrema.
📚 SPIN SELLING — Situação → Problema → Implicação → Necessidade antes de dar preço.
📚 AIDA — Atenção → Interesse → Desejo → Ação.
📚 PAS — Problema → Agitação → Solução.
`;

// ── CADEIA DE FRIO — Regras de Câmara ──
export const COLD_CHAIN_CONTEXT = `
❄️ TEMPERATURA: 0-4°C ideal. 5-7°C atenção. >7°C risco. >10°C emergência.
❄️ UMIDADE: 85-90% ideal. <80% ressecamento. >95% bolor.
❄️ DRIP LOSS: 1 ton perde 3kg/dia a 0-4°C. Em 7 dias = 21kg = ~R$700 de prejuízo.
❄️ GIRO: <5 dias = excelente. 5-7 dias = aceitável. >7 dias = VENDER URGENTE.
❄️ FIFO/FEFO: 0-7 dias ✅ | 8-11 dias ⚠️ | 12+ dias 🔴 BLOQUEADO.
❄️ ENERGIA: Câmara = 15-25% da conta de luz. Porta aberta < 3min por acesso.
❄️ CAPACIDADE: 70-85% = eficiente. <50% = desperdício. >90% = circulação comprometida.
`;

// ── LOGÍSTICA E ENTREGAS ──
export const LOGISTICS_CONTEXT = `
🚚 ROTEIRIZAÇÃO: Por zona geográfica. Nunca cruzar cidade. Economia 30% combustível.
🚚 JANELA: 6h-11h. Segunda + Quinta = maiores dias. Evitar sexta (trânsito).
🚚 CUSTO: Meta < R$25/parada. Se > R$30 → aumentar pedido mínimo.
🚚 FRETE GADO: R$3-5/km. Preferir fornecedores < 200km.
🚚 OCUPAÇÃO: Nunca < 70% da capacidade.
🚚 PEDIDO MÍNIMO: R$150 para entrega. Entrega grátis > R$300.
`;

// ── PRECIFICAÇÃO POR CORTE ──
export const PRICING_CONTEXT = `
💰 MARKUP DINÂMICO: Custo / (1 − margem_desejada).
💰 Traseiro (nobres): markup 35%. Dianteiro: 25%. Miúdos: 15%. Kit Churrasco: 40%.
💰 NEVER precifique corte isolado. Cubra prejuízo do dianteiro com lucro da picanha.
💰 MIX: Nobres (margem 35%) + Dianteiro (15%) → média ponderada > 22%.
💰 BENCHMARKS FEV/2026: Picanha R$65-75/kg, Alcatra R$38-48/kg, Dianteiro R$22-32/kg, Carcaça R$19-25/kg.
`;
