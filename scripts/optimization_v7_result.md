
# Backtest Histórico: Otimização Global USD/Rabobank - V7
**Margem de Erro Média Final (MAE):** R$ 0.42 por arroba.

Variáveis Integradas da Pesquisa Mundial:
- Exportação (Fator Demanda Global, Rabobank).
- Preço do Frango (Fator Substituição, USDA).
- Selic (Custo de Carregamento / Juros).

## Fórmula Otimizada V7
```math
Arroba = 288.14 + 
         (-31.43 * Dolar) + 
         (0.4343 * Milho) + 
         (-4.36 * Abate_Milhoes) + 
         (0.0475 * Bezerro) + 
         (4.08 * Consumo_Anual) + 
         (-0.67 * Selic_Meta) + 
         (3.22 * Frango_Atacado) + 
         (7.05 * Exportacao_Mi_Tons)
```

## Relatório Ano a Ano (2020 - 2026)
- **2020:** Real R$ 260.00 | Calculado V7: R$ 260.13 | Diferença: +R$ 0.13
- **2021:** Real R$ 305.00 | Calculado V7: R$ 305.27 | Diferença: +R$ 0.27
- **2022:** Real R$ 295.00 | Calculado V7: R$ 293.42 | Diferença: R$ -1.58
- **2023:** Real R$ 245.00 | Calculado V7: R$ 245.38 | Diferença: +R$ 0.38
- **2024:** Real R$ 235.00 | Calculado V7: R$ 234.75 | Diferença: R$ -0.25
- **2025:** Real R$ 290.00 | Calculado V7: R$ 290.26 | Diferença: +R$ 0.26
- **2026:** Real R$ 350.00 | Calculado V7: R$ 350.08 | Diferença: +R$ 0.08
