import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, Target,
    Zap, Beef, Wheat, DollarSign, Percent, RefreshCw, Loader2, Wifi,
    Edit3, Check, X, AlertTriangle, Clock
} from 'lucide-react';
import { fetchMarketPrices, saveMarketPrices, MarketPrices } from '../services/marketPricesService';
import { calcularPrecoV4, getIndiceSazonal } from '../services/marketDataService';

interface MarketDashboardProps {
    onBack: () => void;
}

const mesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const MarketDashboard: React.FC<MarketDashboardProps> = ({ onBack }) => {
    const [prices, setPrices] = useState<MarketPrices | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [editando, setEditando] = useState(false);
    const [inputSP, setInputSP] = useState('');
    const [inputBA, setInputBA] = useState('');
    const [inputVDC, setInputVDC] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [msgSalvo, setMsgSalvo] = useState('');

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const p = await fetchMarketPrices();
            setPrices(p);
        } catch (e) { console.error('MarketDashboard:', e); }
        setIsLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAbrirEdicao = () => {
        setInputSP(prices?.arroba_sp?.toFixed(2) ?? '');
        setInputBA(prices?.arroba_ba?.toFixed(2) ?? '');
        setInputVDC(prices?.arroba_vdc?.toFixed(2) ?? '');
        setEditando(true);
        setMsgSalvo('');
    };

    const handleSalvar = async () => {
        const sp = parseFloat(inputSP.replace(',', '.'));
        const ba = parseFloat(inputBA.replace(',', '.'));
        const vdc = parseFloat(inputVDC.replace(',', '.'));
        if (isNaN(sp) || sp < 200 || sp > 700) { alert('Preço SP inválido (R$200–700)'); return; }
        if (isNaN(ba) || ba < 180 || ba > 680) { alert('Preço BA inválido (R$180–680)'); return; }
        if (!isNaN(vdc) && (vdc < 180 || vdc > 680)) { alert('Preço VDC inválido (R$180–680)'); return; }
        setSalvando(true);
        const ok = await saveMarketPrices(sp, ba, 'SUPABASE_MANUAL', 'DONO', 0, isNaN(vdc) ? undefined : vdc);
        if (ok) {
            setMsgSalvo(`Salvo! Agentes usam R$${ba.toFixed(2)}/@`);
            setEditando(false);
            await load();
        } else {
            setMsgSalvo('Erro ao salvar. Tente novamente.');
        }
        setSalvando(false);
    };

    const arrobaSP = prices?.arroba_sp ?? 362;
    const arrobaVDC = prices?.arroba_vdc ?? (prices?.arroba_ba ? prices.arroba_ba - 4 : 336);
    const arrobaBA = prices?.arroba_ba ?? 335;
    const arrobaKg = prices?.arroba_kg_carcaca ?? (335 / 15);
    const dolar = prices?.dolar ?? 5.82;
    const selic = prices?.selic ?? 13.75;
    const variacao = prices?.arroba_variacao ?? 0;
    const abate = 38.0;
    const bezerro = 3200;
    const femeasPct = 41.1;
    const precoBase = calcularPrecoV4(dolar, abate, bezerro);
    const mesAtual = new Date().getMonth() + 1;

    const projecaoMensal = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1;
        const is = getIndiceSazonal(mes);
        const central = precoBase * (is / 100);
        return { mes, nome: mesNomes[i], central, pessimista: central * 0.94, otimista: central * 1.06, isAtual: mes === mesAtual };
    });
    const maxBar = Math.max(...projecaoMensal.map(p => p.otimista));
    const monteCarlo = { p5: 328.68, p25: 340.53, p50: 349.32, p75: 358.01, p95: 370.43, media: 349.44 };

    const faseAtual = femeasPct < 44
        ? { fase: 'RETENÇÃO', cor: 'text-green-400', bg: 'bg-green-900/50', desc: 'Pecuaristas segurando fêmeas → falta gado → preço SOBE' }
        : femeasPct > 47
            ? { fase: 'LIQUIDAÇÃO', cor: 'text-red-400', bg: 'bg-red-900/50', desc: 'Pecuaristas vendendo matrizes → excesso → preço CAI' }
            : { fase: 'TRANSIÇÃO', cor: 'text-yellow-400', bg: 'bg-yellow-900/50', desc: 'Mercado em inflexão' };

    const fonteOk = prices?.arroba_fonte === 'CEPEA_AO_VIVO';
    const fonteManual = prices?.arroba_fonte === 'SUPABASE_MANUAL';
    const fonteFallback = !prices || prices.arroba_fonte === 'FALLBACK';
    const horasDesde = prices?.atualizado_em ? Math.floor((Date.now() - new Date(prices.atualizado_em).getTime()) / 3600000) : null;
    const dolarLabel = prices?.dolar_fonte === 'BCB_AO_VIVO' ? '✅ BCB' : '⚠️ fallback';
    const selicLabel = prices?.selic_fonte === 'BCB_AO_VIVO' ? '✅ BCB' : '⚠️ fallback';

    const ranking = [
        { nome: 'Milho (Saca 60kg)', pct: 18.6, cor: 'bg-yellow-500', icon: Wheat, valor: 'R$ 69,53' },
        { nome: 'Bezerro (Cabeça)', pct: 17.0, cor: 'bg-green-500', icon: Beef, valor: `R$ ${bezerro.toLocaleString('pt-BR')}` },
        { nome: 'Frango (Atacado)', pct: 14.7, cor: 'bg-orange-500', icon: Activity, valor: 'R$ 8,20/kg' },
        { nome: 'Dólar (USD/BRL)', pct: 13.1, cor: 'bg-blue-500', icon: DollarSign, valor: `R$ ${dolar.toFixed(4)}` },
        { nome: 'Consumo Per Capita', pct: 9.2, cor: 'bg-purple-500', icon: BarChart3, valor: '31,9 kg/hab' },
        { nome: 'Taxa Selic', pct: 9.0, cor: 'bg-red-500', icon: Percent, valor: `${selic.toFixed(2)}%` },
        { nome: '% Fêmeas Abate', pct: 7.1, cor: 'bg-pink-500', icon: Target, valor: `${femeasPct}%` },
        { nome: 'Vol. Abate Total', pct: 5.9, cor: 'bg-indigo-500', icon: BarChart3, valor: `${abate}M cab` },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-4 md:p-8">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                    <ArrowLeft size={18} /> Voltar
                </button>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1 ${fonteOk ? 'bg-green-900/40 border-green-700/40' : fonteManual ? 'bg-blue-900/40 border-blue-700/40' : 'bg-yellow-900/40 border-yellow-700/40'}`}>
                        {fonteOk ? <Wifi size={12} className="text-green-400" /> : fonteManual ? <Edit3 size={12} className="text-blue-400" /> : <AlertTriangle size={12} className="text-yellow-400" />}
                        <span className={`text-[10px] font-bold ${fonteOk ? 'text-green-400' : fonteManual ? 'text-blue-400' : 'text-yellow-400'}`}>
                            {fonteOk ? 'CEPEA ao vivo' : fonteManual ? 'Digitado pelo dono' : 'Fallback'}
                        </span>
                    </div>
                    {horasDesde !== null && (
                        <div className="flex items-center gap-1 text-gray-600">
                            <Clock size={10} />
                            <span className="text-[9px]">{horasDesde === 0 ? 'Agora' : `${horasDesde}h atrás`}{horasDesde > 24 ? <span className="text-yellow-600 ml-1"> DESATUALIZADO</span> : null}</span>
                        </div>
                    )}
                    <button onClick={load} disabled={isLoading} className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors">
                        <RefreshCw size={12} className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="text-right">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight">📊 Dashboard de <span className="text-blue-400">Mercado</span></h1>
                        <p className="text-gray-500 text-xs mt-1">Ana V4 • Monte Carlo • Cotações ao Vivo</p>
                    </div>
                </div>
            </div>

            {/* WIDGET ATUALIZAÇÃO */}
            {!editando ? (
                <div className={`mb-6 rounded-2xl p-5 border flex items-center justify-between gap-4 flex-wrap ${fonteFallback ? 'bg-yellow-900/30 border-yellow-700/50' : 'bg-gray-800/40 border-gray-700/40'}`}>
                    <div>
                        <p className="text-sm font-bold text-gray-200">
                            {fonteOk ? '🟢 Preço da arroba atualizado automaticamente via CEPEA'
                                : fonteManual ? '📝 Preço salvo manualmente — veja o CEPEA hoje e atualize se mudou'
                                : '⚠️ Usando preço de emergência — atualize com o valor do CEPEA de hoje'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Atualizado por: {prices?.atualizado_por ?? '—'} em {prices?.arroba_data ?? '—'}
                            {msgSalvo && <span className="ml-3 text-green-400 font-bold"> {msgSalvo}</span>}
                        </p>
                    </div>
                    <button onClick={handleAbrirEdicao} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors">
                        <Edit3 size={14} /> Digitar preço do dia
                    </button>
                </div>
            ) : (
                <div className="mb-6 rounded-2xl p-5 bg-blue-900/30 border border-blue-700/50">
                    <p className="text-sm font-bold text-blue-200 mb-4">📝 Digite o preço que você viu hoje (CEPEA, WhatsApp do mercado, etc.)</p>
                    <div className="flex items-end gap-4 flex-wrap">
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Arroba SP (R$/@)</label>
                            <input type="number" step="0.01" value={inputSP} onChange={e => setInputSP(e.target.value)} placeholder="ex: 362.00"
                                className="w-36 bg-gray-900 border border-blue-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Arroba Feira de Santana BA (R$/@)</label>
                            <input type="number" step="0.01" value={inputBA} onChange={e => setInputBA(e.target.value)} placeholder="ex: 340.00"
                                className="w-36 bg-gray-900 border border-blue-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400" />
                        </div>
                        <div>
                            <label className="text-xs text-blue-300 mb-1 block font-bold">⭐ Arroba VDC/Sudoeste BA (R$/@)</label>
                            <input type="number" step="0.01" value={inputVDC} onChange={e => setInputVDC(e.target.value)} placeholder="ex: 336.00"
                                className="w-36 bg-gray-900 border border-blue-400 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-300" />
                            {inputVDC && !isNaN(parseFloat(inputVDC)) && (
                                <p className="text-[10px] text-blue-400 mt-1 font-bold">→ R${(parseFloat(inputVDC)/15).toFixed(2)}/kg carcaça</p>
                            )}
                            {!inputVDC && inputBA && !isNaN(parseFloat(inputBA)) && (
                                <p className="text-[10px] text-gray-500 mt-1">vazio = BA - R$4 automaticamente</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSalvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar
                            </button>
                            <button onClick={() => setEditando(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-xl transition-colors">
                                <X size={14} /> Cancelar
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-blue-400/70 mt-3">
                        💡 VDC: peça ao seu comprador de gado ou veja no grupo do Acrioeste/sindicato rural. Feira de Santana: Cooperfeira publica toda semana. CEPEA SP: cepea.esalq.usp.br às 18h30.
                    </p>
                </div>
            )}

            {/* GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-6">
                    {/* Arroba */}
                    <div className="bg-gradient-to-br from-emerald-900/60 to-emerald-800/30 border border-emerald-700/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Arroba Boi Gordo SP</span>
                            {variacao >= 0 ? <TrendingUp className="text-emerald-400" size={20} /> : <TrendingDown className="text-red-400" size={20} />}
                        </div>
                        <div className="flex items-end gap-3">
                            <div>
                                <div className="text-[10px] text-emerald-300/60 mb-0.5">VDC / Sudoeste BA ⭐</div>
                                <div className="text-4xl font-black text-white">{isLoading ? <Loader2 size={32} className="animate-spin text-gray-500" /> : `R$ ${arrobaVDC.toFixed(2)}`}</div>
                            </div>
                            {variacao !== 0 && <span className={`text-sm font-bold mb-1 ${variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>{variacao >= 0 ? '+' : ''}{variacao.toFixed(2)}%</span>}
                        </div>
                        <div className="mt-2 pt-2 border-t border-emerald-700/30">
                            <div className="grid grid-cols-3 gap-1 text-xs">
                                <span className="text-emerald-300/60">SP: <strong className="text-white">R${arrobaSP.toFixed(0)}</strong></span>
                                <span className="text-emerald-300/60">BA/FSA: <strong className="text-white">R${arrobaBA.toFixed(0)}</strong></span>
                                <span className="text-emerald-300/60">→ <strong className="text-white">R${arrobaKg.toFixed(2)}/kg</strong></span>
                            </div>
                        </div>
                    </div>
                    {/* Dólar + Selic */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-900/30 border border-blue-800/50 rounded-2xl p-4">
                            <DollarSign size={16} className="text-blue-400 mb-2" />
                            <div className="text-xl font-black text-white">R$ {dolar.toFixed(2)}</div>
                            <p className="text-[9px] text-gray-500 mt-1">Dólar PTAX</p>
                            <p className="text-[8px] text-gray-600">{dolarLabel}</p>
                        </div>
                        <div className="bg-red-900/30 border border-red-800/50 rounded-2xl p-4">
                            <Percent size={16} className="text-red-400 mb-2" />
                            <div className="text-xl font-black text-white">{selic.toFixed(2)}%</div>
                            <p className="text-[9px] text-gray-500 mt-1">Selic a.a.</p>
                            <p className="text-[8px] text-gray-600">{selicLabel}</p>
                        </div>
                    </div>
                    {/* Fase */}
                    <div className={`${faseAtual.bg} border border-white/10 rounded-2xl p-6`}>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Fase do Ciclo Pecuário</span>
                        <div className={`text-2xl font-black mt-2 ${faseAtual.cor}`}>🔄 {faseAtual.fase}</div>
                        <p className="text-gray-400 text-xs mt-2">{faseAtual.desc}</p>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Fêmeas no abate:</span>
                            <span className={`text-sm font-bold ${faseAtual.cor}`}>{femeasPct}%</span>
                        </div>
                    </div>
                    {/* Equação V4 */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Equação Mestra V4</span>
                        <div className="mt-3 font-mono text-xs text-blue-300 bg-gray-900/80 p-3 rounded-lg">
                            <div>P = 125 + (20 × Dólar)</div>
                            <div className="ml-4">+ (-3 × Abate)</div>
                            <div className="ml-4">+ (0.07 × Bezerro)</div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                            <Zap size={12} className="text-yellow-400" />
                            <span className="text-xs text-gray-400">Erro médio: <span className="text-yellow-400 font-bold">R$ 2,19</span>/arroba</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">Previsão: <span className="text-white font-bold">R$ {precoBase.toFixed(2)}/@</span></div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {/* Monte Carlo */}
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
                            {[{l:'5%',v:monteCarlo.p5,c:'text-red-400'},{l:'25%',v:monteCarlo.p25,c:'text-yellow-400'},{l:'50%',v:monteCarlo.p50,c:'text-green-400'},{l:'75%',v:monteCarlo.p75,c:'text-blue-400'},{l:'95%',v:monteCarlo.p95,c:'text-purple-400'}].map((p,i) => (
                                <div key={i} className="bg-gray-900/60 rounded-xl p-3">
                                    <div className="text-[10px] text-gray-500 mb-1">{p.l}</div>
                                    <div className={`text-sm font-bold ${p.c}`}>R$ {p.v.toFixed(0)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Projeção */}
                    <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 block">📅 Projeção Mensal 2026 (Faixa 80%)</span>
                        <div className="space-y-2">
                            {projecaoMensal.map(p => {
                                const wC=(p.central/maxBar)*100, wP=(p.pessimista/maxBar)*100, wO=(p.otimista/maxBar)*100;
                                return (
                                    <div key={p.mes} className={`flex items-center gap-3 ${p.isAtual ? 'opacity-100' : 'opacity-75'}`}>
                                        <span className={`text-xs font-mono w-10 ${p.isAtual ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>{p.nome}</span>
                                        <div className="flex-1 relative h-7 bg-gray-900/60 rounded-lg overflow-hidden">
                                            <div className="absolute h-full bg-blue-900/30" style={{left:`${wP*0.7}%`,width:`${(wO-wP)*0.7}%`}} />
                                            <div className={`absolute h-full rounded-lg ${p.isAtual ? 'bg-gradient-to-r from-blue-500 to-cyan-400' : 'bg-gradient-to-r from-blue-600/60 to-blue-500/40'}`} style={{width:`${wC*0.7}%`}} />
                                            <div className="absolute inset-0 flex items-center px-2">
                                                <span className="text-[10px] font-bold text-white/90 ml-auto">R$ {p.pessimista.toFixed(0)} — <span className="text-blue-200">[{p.central.toFixed(0)}]</span> — {p.otimista.toFixed(0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Ranking */}
                    <div className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-6">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 block">🏆 Ranking: O Que Mais Afeta o Preço (Pearson)</span>
                        <div className="space-y-3">
                            {ranking.map((r,i) => {
                                const Icon = r.icon;
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs text-gray-500 w-5 text-right font-bold">{i+1}º</span>
                                        <Icon size={14} className="text-gray-400" />
                                        <span className="text-xs text-gray-300 w-36">{r.nome}</span>
                                        <div className="flex-1 h-4 bg-gray-900/60 rounded-full overflow-hidden">
                                            <div className={`h-full ${r.cor} rounded-full`} style={{width:`${r.pct*5}%`}} />
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

            <div className="mt-8 text-center space-y-1">
                <p className="text-gray-600 text-[10px]">Ana V4 • Erro R$ 2,19/@ • Monte Carlo 10k cenários</p>
                {prices?.erros && prices.erros.length > 0 && <p className="text-yellow-700 text-[9px]">⚠️ {prices.erros.join(' | ')}</p>}
                <div className="flex items-center justify-center gap-4 text-[8px] text-gray-700 flex-wrap">
                    <span>🐄 Arroba: {fonteOk ? 'CEPEA ao vivo' : fonteManual ? 'Manual' : 'Fallback'}</span>
                    <span>💵 Dólar: {dolarLabel}</span>
                    <span>📊 Selic: {selicLabel}</span>
                    {prices?.atualizado_por && <span>👤 Por: {prices.atualizado_por}</span>}
                </div>
            </div>
        </div>
    );
};

export default MarketDashboard;
