import React, { useState, useEffect } from 'react';
import { ArrowLeft, Target, TrendingUp, TrendingDown, Minus, DollarSign, AlertTriangle, CheckCircle, XCircle, RefreshCw, Loader2, Scale, Beef } from 'lucide-react';
import { calcularPrecificacao, ResultadoPrecificacao } from '../services/pricingEngineService';

interface PricingEngineProps {
    onBack: () => void;
}

const PricingEngine: React.FC<PricingEngineProps> = ({ onBack }) => {
    const [resultado, setResultado] = useState<ResultadoPrecificacao | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [precoInput, setPrecoInput] = useState<string>('');
    const [rendInput, setRendInput] = useState<string>('53');

    useEffect(() => {
        calcular();
    }, []);

    const calcular = async (precoManual?: number, rendimento?: number) => {
        setIsLoading(true);
        try {
            const res = await calcularPrecificacao(
                precoManual || undefined,
                rendimento ? rendimento / 100 : undefined
            );
            setResultado(res);
        } catch (err) {
            console.error('Erro no motor de precificação:', err);
        }
        setIsLoading(false);
    };

    const handleSimular = () => {
        const preco = precoInput ? parseFloat(precoInput) : undefined;
        const rend = rendInput ? parseFloat(rendInput) : undefined;
        calcular(preco, rend);
    };

    if (isLoading && !resultado) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="animate-spin text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Motor V4 calculando precificação...</p>
                </div>
            </div>
        );
    }

    if (!resultado) return null;

    const r = resultado;
    const SinalIcon = r.sinal === 'COMPRAR' ? CheckCircle : r.sinal === 'ESPERAR' ? AlertTriangle : XCircle;
    const sinalTexto = r.sinal === 'COMPRAR' ? '🟢 COMPRAR' : r.sinal === 'ESPERAR' ? '🟡 ESPERAR' : '🔴 NÃO COMPRAR';
    const TendIcon = r.tendencia === 'ALTA' ? TrendingUp : r.tendencia === 'BAIXA' ? TrendingDown : Minus;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-4 md:p-8">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                    <ArrowLeft size={18} /> Voltar
                </button>
                <div className="text-right">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                        🎯 Motor de <span className="text-amber-400">Precificação</span>
                    </h1>
                    <p className="text-gray-500 text-xs mt-1">Equação V4 × Dados ao Vivo × Margem Inteligente</p>
                </div>
            </div>

            {/* SEMÁFORO PRINCIPAL */}
            <div className={`${r.corSinal} bg-opacity-20 border ${r.sinal === 'COMPRAR' ? 'border-green-500/50' : r.sinal === 'ESPERAR' ? 'border-yellow-500/50' : 'border-red-500/50'} rounded-3xl p-6 mb-6`}>
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <SinalIcon size={48} className={`${r.sinal === 'COMPRAR' ? 'text-green-400' : r.sinal === 'ESPERAR' ? 'text-yellow-400' : 'text-red-400'}`} />
                    <div className="flex-1 text-center md:text-left">
                        <div className="text-3xl font-black">{sinalTexto}</div>
                        <p className="text-gray-300 text-sm mt-1">{r.justificativa}</p>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase tracking-widest">Margem Projetada</div>
                        <div className={`text-4xl font-black ${r.margemBruta >= 22 ? 'text-green-400' : r.margemBruta >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {r.margemBruta.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* COLUNA 1: Simulador + Preços */}
                <div className="space-y-6">
                    {/* Simulador */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 block">⚙️ Simulador de Compra</span>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase">Preço ofertado (R$/@)</label>
                                <input
                                    type="number"
                                    placeholder={`Ex: ${r.precoArrobaRegional.toFixed(0)}`}
                                    value={precoInput}
                                    onChange={e => setPrecoInput(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white mt-1 focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase">Rendimento de carcaça (%)</label>
                                <input
                                    type="number"
                                    placeholder="Ex: 53"
                                    value={rendInput}
                                    onChange={e => setRendInput(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white mt-1 focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={handleSimular}
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-amber-600 to-orange-500 text-white font-bold py-2.5 rounded-xl hover:from-amber-500 hover:to-orange-400 transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
                                {isLoading ? 'Calculando...' : 'Simular Compra'}
                            </button>
                        </div>
                    </div>

                    {/* Preços de Referência */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">💵 Preços do Mercado</span>
                        <div className="space-y-2">
                            {[
                                { label: 'CEPEA/SP (ao vivo)', valor: r.precoArrobaCepea, cor: 'text-emerald-400' },
                                { label: 'Regional (VCA-BA)', valor: r.precoArrobaRegional, cor: 'text-blue-400' },
                                { label: 'Spread Regional', valor: r.spreadRegional, cor: 'text-purple-400' },
                                { label: 'V4 Projeção (atual)', valor: r.precoV4Projetado, cor: 'text-cyan-400' },
                                { label: 'V4 Próximo Mês', valor: r.precoV4ProximoMes, cor: 'text-indigo-400' },
                            ].map((p, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">{p.label}</span>
                                    <span className={`text-sm font-bold ${p.cor}`}>R$ {p.valor.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                                <TendIcon size={14} className={r.tendencia === 'ALTA' ? 'text-green-400' : r.tendencia === 'BAIXA' ? 'text-red-400' : 'text-yellow-400'} />
                                <span className={`text-xs font-bold ${r.tendencia === 'ALTA' ? 'text-green-400' : r.tendencia === 'BAIXA' ? 'text-red-400' : 'text-yellow-400'}`}>
                                    Tendência V4: {r.tendencia}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUNA 2: Limites + Custos */}
                <div className="space-y-6">
                    {/* Limites de Preço */}
                    <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/20 border border-amber-700/40 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-4 block">🎯 Limites de Compra</span>
                        <div className="space-y-4">
                            <div className="text-center">
                                <div className="text-[10px] text-gray-500 uppercase">Preço MÁXIMO por @</div>
                                <div className="text-3xl font-black text-red-400">R$ {r.precoMaximoArroba.toFixed(2)}</div>
                                <p className="text-gray-500 text-[9px]">Acima disto = prejuízo</p>
                            </div>
                            <div className="text-center border-t border-amber-800/30 pt-3">
                                <div className="text-[10px] text-gray-500 uppercase">Preço IDEAL por @</div>
                                <div className="text-3xl font-black text-green-400">R$ {r.precoIdealArroba.toFixed(2)}</div>
                                <p className="text-gray-500 text-[9px]">8% abaixo do máximo = margem confortável</p>
                            </div>
                            <div className="bg-gray-900/60 rounded-xl p-3 text-center">
                                <span className="text-xs text-gray-400">Economia vs MAX: </span>
                                <span className={`text-sm font-bold ${r.economiaVsMax >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    R$ {r.economiaVsMax.toFixed(2)}/@ {r.economiaVsMax >= 0 ? '✅' : '❌'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Composição de Custos */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">📋 Composição de Custos</span>
                        <div className="space-y-2">
                            {[
                                { label: 'Custo total / arroba', valor: r.custoTotalPorArroba },
                                { label: 'Custo real / kg carcaça', valor: r.custoRealPorKg },
                                { label: 'Preço venda / kg', valor: r.precoVendaMedioKg },
                            ].map((c, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">{c.label}</span>
                                    <span className="text-sm font-bold text-white">R$ {c.valor.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* COLUNA 3: Resultado Econômico */}
                <div className="space-y-6">
                    {/* Lucro por Cabeça */}
                    <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/20 border border-green-700/40 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-green-300 mb-3 block">💰 Resultado por Cabeça</span>
                        <div className="text-center">
                            <div className="text-4xl font-black text-white">
                                R$ {r.lucroEstimadoPorCabeca.toFixed(2)}
                            </div>
                            <p className="text-gray-500 text-xs mt-1">Lucro bruto estimado / cabeça</p>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="bg-gray-900/60 rounded-xl p-3 text-center">
                                <div className="text-[10px] text-gray-500">Margem Bruta</div>
                                <div className={`text-lg font-bold ${r.margemBruta >= 22 ? 'text-green-400' : r.margemBruta >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {r.margemBruta.toFixed(1)}%
                                </div>
                            </div>
                            <div className="bg-gray-900/60 rounded-xl p-3 text-center">
                                <div className="text-[10px] text-gray-500">Margem Líquida</div>
                                <div className={`text-lg font-bold ${r.margemLiquida >= 15 ? 'text-green-400' : r.margemLiquida >= 8 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {r.margemLiquida.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ponto de Equilíbrio */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">📊 Ponto de Equilíbrio</span>
                        <div className="text-center">
                            <div className="text-3xl font-black text-blue-400">{r.pontoEquilibrio} @/mês</div>
                            <p className="text-gray-500 text-xs mt-1">Arrobas necessárias para cobrir custos fixos mensais</p>
                        </div>
                    </div>

                    {/* Dólar */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                        <div className="flex items-center gap-2">
                            <DollarSign size={16} className="text-blue-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Dólar Atual</span>
                        </div>
                        <div className="text-2xl font-black text-blue-400 mt-2">R$ {r.dolarAtual.toFixed(2)}</div>
                        <p className="text-gray-600 text-[9px] mt-1">BCB PTAX (ao vivo)</p>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <div className="mt-8 text-center">
                <p className="text-gray-700 text-[9px]">
                    Motor V4 • Equação Mestra + Dados ao Vivo • Custos operacionais calibrados para VCA-BA • Rendimento {rendInput}%
                </p>
            </div>
        </div>
    );
};

export default PricingEngine;
