import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, Target, Zap, Beef, Wheat, DollarSign, Percent, RefreshCw, Loader2, Wifi, WifiOff } from 'lucide-react';
import { fetchAllMarketData, MarketData, calcularPrecoV4 } from '../services/marketDataService';

interface MarketDashboardProps {
    onBack: () => void;
}

const MarketDashboard: React.FC<MarketDashboardProps> = ({ onBack }) => {

    const [marketData, setMarketData] = useState<MarketData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    // Carregar dados ao vivo ao montar o componente
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await fetchAllMarketData();
            setMarketData(data);
            setLastUpdate(data.updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
            console.error('Erro ao carregar dados de mercado:', err);
        }
        setIsLoading(false);
    };

    // ═══════════════════════════════════════════════════
    // DADOS V4 DA ANA (Calibrados com 15 variáveis × 5 anos)
    // ═══════════════════════════════════════════════════
    const equacaoV4 = {
        base: 125,
        wDolar: 20,
        wAbate: -3,
        wBezerro: 0.07,
        erroMedio: 2.19
    };

    const IS: Record<number, number> = { 1: 100.8, 2: 102.3, 3: 99.4, 4: 98.1, 5: 96.7, 6: 95.2, 7: 97.0, 8: 98.5, 9: 100.2, 10: 102.6, 11: 104.1, 12: 103.5 };
    const mesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Usar dados ao vivo se disponíveis, senão fallback
    const dolarAtual = marketData?.dolar.valor ?? 5.75;
    const cepeaHoje = marketData?.cepeaBoi.valor ?? 352.80;
    const selicAtual = marketData?.selic.valor ?? 13.25;
    const milhoAtual = marketData?.milho.valor ?? 69.53;
    const cepeaVariacao = marketData?.cepeaBoi.variacao ?? 0;

    const premissas = {
        dolar: dolarAtual,
        abate: 38.0,
        bezerro: 3200,
        cepeaHoje: cepeaHoje,
        femeasPct: 41.1,
        milho: milhoAtual,
        selic: selicAtual,
        momentum: 6.5
    };

    // Calcular projeção mensal COM DADOS AO VIVO
    const precoBase = calcularPrecoV4(premissas.dolar, premissas.abate, premissas.bezerro);
    const projecaoMensal = Object.entries(IS).map(([mes, is]) => ({
        mes: parseInt(mes),
        nome: mesNomes[parseInt(mes) - 1],
        central: precoBase * (is / 100),
        pessimista: (precoBase * 0.94) * (is / 100),
        otimista: (precoBase * 1.06) * (is / 100)
    }));

    // Contadores de fonte
    const apisAoVivo = marketData ? [marketData.dolar, marketData.cepeaBoi, marketData.selic, marketData.milho].filter(d => d.fonte.startsWith('✅')).length : 0;
    const apisTotal = 4;

    // Ranking de impacto
    const ranking = [
        { nome: 'Milho (Saca 60kg)', pct: 18.6, cor: 'bg-yellow-500', icon: Wheat, valor: `R$ ${premissas.milho}` },
        { nome: 'Bezerro (Cabeça)', pct: 17.0, cor: 'bg-green-500', icon: Beef, valor: `R$ ${premissas.bezerro}` },
        { nome: 'Frango (Atacado)', pct: 14.7, cor: 'bg-orange-500', icon: Activity, valor: 'R$ 8,20/kg' },
        { nome: 'Dólar (USD/BRL)', pct: 13.1, cor: 'bg-blue-500', icon: DollarSign, valor: `R$ ${premissas.dolar}` },
        { nome: 'Consumo Per Capita', pct: 9.2, cor: 'bg-purple-500', icon: BarChart3, valor: '31,9 kg/hab' },
        { nome: 'Taxa Selic', pct: 9.0, cor: 'bg-red-500', icon: Percent, valor: `${premissas.selic}%` },
        { nome: '% Fêmeas Abate', pct: 7.1, cor: 'bg-pink-500', icon: Target, valor: `${premissas.femeasPct}%` },
        { nome: 'Vol. Abate Total', pct: 5.9, cor: 'bg-indigo-500', icon: BarChart3, valor: `${premissas.abate}M cab` },
    ];

    // Fases do ciclo
    const faseAtual = premissas.femeasPct < 44 ? { fase: 'RETENÇÃO', cor: 'text-green-400', bg: 'bg-green-900/50', desc: 'Pecuaristas segurando fêmeas → Falta gado → Preço SOBE' }
        : premissas.femeasPct > 47 ? { fase: 'LIQUIDAÇÃO', cor: 'text-red-400', bg: 'bg-red-900/50', desc: 'Pecuaristas vendendo matrizes → Excesso de gado → Preço CAI' }
            : { fase: 'TRANSIÇÃO', cor: 'text-yellow-400', bg: 'bg-yellow-900/50', desc: 'Mercado em ponto de inflexão' };

    // Monte Carlo resumo
    const monteCarlo = {
        p5: 328.68, p25: 340.53, p50: 349.32, p75: 358.01, p95: 370.43, media: 349.44
    };

    const maxBar = Math.max(...projecaoMensal.map(p => p.otimista));

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-4 md:p-8">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                    <ArrowLeft size={18} /> Voltar
                </button>
                <div className="text-right">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                        📊 Dashboard de <span className="text-blue-400">Mercado</span>
                    </h1>
                    <p className="text-gray-500 text-xs mt-1">Ana V4 • Monte Carlo • 15 Variáveis × 5 Anos</p>
                </div>
            </div>

            {/* GRID PRINCIPAL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* COLUNA 1: Indicadores Macro */}
                <div className="space-y-6">
                    {/* Card CEPEA Hoje */}
                    <div className="bg-gradient-to-br from-emerald-900/60 to-emerald-800/30 border border-emerald-700/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">CEPEA/ESALQ Hoje</span>
                            <TrendingUp className="text-emerald-400" size={20} />
                        </div>
                        <div className="text-4xl font-black text-white">R$ {premissas.cepeaHoje.toFixed(2)}</div>
                        <p className="text-emerald-300/70 text-xs mt-1">Indicador Boi Gordo SP • Recorde Histórico! 🏆</p>
                    </div>

                    {/* Card Fase do Ciclo */}
                    <div className={`${faseAtual.bg} border border-white/10 rounded-2xl p-6`}>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Fase do Ciclo Pecuário</span>
                        <div className={`text-2xl font-black mt-2 ${faseAtual.cor}`}>
                            🔄 {faseAtual.fase}
                        </div>
                        <p className="text-gray-400 text-xs mt-2">{faseAtual.desc}</p>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Fêmeas no abate:</span>
                            <span className={`text-sm font-bold ${faseAtual.cor}`}>{premissas.femeasPct}%</span>
                        </div>
                    </div>

                    {/* Card Momentum */}
                    <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/30 border border-blue-800/50 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Momentum ARIMA</span>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="text-3xl font-black text-green-400">🟢 +{premissas.momentum}%</div>
                        </div>
                        <p className="text-blue-300/60 text-xs mt-2">Inércia de ALTA FORTE. O mercado favorece continuidade de subida.</p>
                        <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(premissas.momentum * 5, 100)}%` }} />
                        </div>
                    </div>

                    {/* Card Equação V4 */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Equação Mestra V4</span>
                        <div className="mt-3 font-mono text-xs text-blue-300 bg-gray-900/80 p-3 rounded-lg">
                            <div>P = {equacaoV4.base} + ({equacaoV4.wDolar}×Dólar)</div>
                            <div className="ml-4">+ ({equacaoV4.wAbate}×Abate)</div>
                            <div className="ml-4">+ ({equacaoV4.wBezerro}×Bezerro)</div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <Zap size={12} className="text-yellow-400" />
                            <span className="text-xs text-gray-400">Erro médio: <span className="text-yellow-400 font-bold">R$ {equacaoV4.erroMedio}</span>/arroba</span>
                        </div>
                    </div>
                </div>

                {/* COLUNA 2: Gráfico de Projeção Mensal */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Monte Carlo Card */}
                    <div className="bg-gradient-to-br from-purple-900/40 to-fuchsia-900/20 border border-purple-700/40 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">🎲 Monte Carlo — 10.000 Cenários</span>
                                <p className="text-gray-500 text-[10px] mt-1">Média Anual 2026 (CEPEA-SP)</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-white">R$ {monteCarlo.media.toFixed(2)}</div>
                                <p className="text-purple-400 text-[10px]">Média dos cenários</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-center">
                            {[
                                { label: '5%', valor: monteCarlo.p5, cor: 'text-red-400' },
                                { label: '25%', valor: monteCarlo.p25, cor: 'text-yellow-400' },
                                { label: '50% (Mediana)', valor: monteCarlo.p50, cor: 'text-green-400' },
                                { label: '75%', valor: monteCarlo.p75, cor: 'text-blue-400' },
                                { label: '95%', valor: monteCarlo.p95, cor: 'text-purple-400' },
                            ].map((p, i) => (
                                <div key={i} className="bg-gray-900/60 rounded-xl p-3">
                                    <div className="text-[10px] text-gray-500 mb-1">{p.label}</div>
                                    <div className={`text-sm font-bold ${p.cor}`}>R$ {p.valor.toFixed(0)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Gráfico de Barras Mensal */}
                    <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 block">📅 Projeção Mensal 2026 (Faixa 80%)</span>
                        <div className="space-y-2">
                            {projecaoMensal.map((p) => {
                                const widthCentral = (p.central / maxBar) * 100;
                                const widthPess = (p.pessimista / maxBar) * 100;
                                const widthOtim = (p.otimista / maxBar) * 100;
                                const mesAtual = new Date().getMonth() + 1;
                                const isAtual = p.mes === 2; // Fev 2026
                                return (
                                    <div key={p.mes} className={`flex items-center gap-3 ${isAtual ? 'opacity-100' : 'opacity-80'}`}>
                                        <span className={`text-xs font-mono w-10 ${isAtual ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>{p.nome}</span>
                                        <div className="flex-1 relative h-7 bg-gray-900/60 rounded-lg overflow-hidden">
                                            {/* Faixa pessimista-otimista */}
                                            <div className="absolute h-full bg-blue-900/30 rounded-lg" style={{ left: `${widthPess * 0.7}%`, width: `${(widthOtim - widthPess) * 0.7}%` }} />
                                            {/* Barra central */}
                                            <div className={`absolute h-full rounded-lg ${isAtual ? 'bg-gradient-to-r from-blue-500 to-cyan-400' : 'bg-gradient-to-r from-blue-600/60 to-blue-500/40'}`} style={{ width: `${widthCentral * 0.7}%` }} />
                                            {/* Label */}
                                            <div className="absolute inset-0 flex items-center px-2">
                                                <span className="text-[10px] font-bold text-white/90 ml-auto">
                                                    R$ {p.pessimista.toFixed(0)} — <span className="text-blue-200">[{p.central.toFixed(0)}]</span> — {p.otimista.toFixed(0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Ranking de Impacto */}
                    <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 block">🏆 Ranking: O Que Mais Afeta o Preço (Pearson)</span>
                        <div className="space-y-3">
                            {ranking.map((r, i) => {
                                const Icon = r.icon;
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-5 text-right font-bold">{i + 1}º</span>
                                        <Icon size={14} className="text-gray-400" />
                                        <span className="text-xs text-gray-300 w-36">{r.nome}</span>
                                        <div className="flex-1 h-4 bg-gray-900/60 rounded-full overflow-hidden">
                                            <div className={`h-full ${r.cor} rounded-full transition-all duration-1000`} style={{ width: `${r.pct * 5}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-white w-12 text-right">{r.pct}%</span>
                                        <span className="text-[10px] text-gray-500 w-24 text-right">{r.valor}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <div className="mt-8 text-center">
                <p className="text-gray-600 text-[10px]">
                    Ana V4 • Calibrada com 15 variáveis × 5 anos • Erro R$ 2,19/@ • Monte Carlo 10k cenários • Momentum ARIMA
                </p>
            </div>
        </div>
    );
};

export default MarketDashboard;
