import React, { useState, useMemo } from 'react';
import { Batch, Supplier } from '../types';
import GTAModal from './GTAModal';
import {
    ArrowLeft as ArrowLeftIcon,
    FileText,
    CheckCircle,
    Clock,
    AlertTriangle,
    Truck,
    Search,
    ExternalLink,
} from 'lucide-react';

interface GTAManagerProps {
    batches: Batch[];
    suppliers: Supplier[];
    onBack: () => void;
}

const statusLabel = (b: Batch) => {
    if (!b.qtd_cabecas) return { label: 'Sem dados', color: '#888', bg: 'rgba(255,255,255,0.06)' };
    if (b.status === 'FECHADO') return { label: 'Lote Encerrado', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' };
    return { label: 'Pendente GTA', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' };
};

const GTAManager: React.FC<GTAManagerProps> = ({ batches, suppliers, onBack }) => {
    const [search, setSearch] = useState('');
    const [gtaBatch, setGtaBatch] = useState<Batch | null>(null);
    const [gtaEmitidos, setGtaEmitidos] = useState<Set<string>>(new Set());

    // Lotes ordenados: mais recentes primeiro
    const lotesVisiveis = useMemo(() => {
        const q = search.toLowerCase();
        return [...batches]
            .sort((a, b) => new Date(b.data_recebimento).getTime() - new Date(a.data_recebimento).getTime())
            .filter(b =>
                !q ||
                b.id_lote.toLowerCase().includes(q) ||
                b.fornecedor.toLowerCase().includes(q) ||
                (b.raca || '').toLowerCase().includes(q)
            );
    }, [batches, search]);

    const pendentes = lotesVisiveis.filter(b => !gtaEmitidos.has(b.id_lote) && b.status !== 'FECHADO').length;

    const getSupplier = (fornecedor: string) =>
        suppliers.find(s => s.nome_fantasia === fornecedor || s.id === fornecedor);

    const formatDate = (iso: string) => {
        if (!iso) return '—';
        return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
    };

    // Sistemas de GTA dos estados
    const sistemas = [
        { label: 'BA — ADAB (e-GTA Bahia)', url: 'https://egta.adab.ba.gov.br', color: '#dc2626' },
        { label: 'MG — IMA', url: 'https://www6.agricultura.mg.gov.br', color: '#7c3aed' },
        { label: 'GO — Agrodefesa', url: 'https://agrodefesa.go.gov.br', color: '#059669' },
        { label: 'ES — IDAF', url: 'https://sistema.idaf.es.gov.br', color: '#d97706' },
        { label: 'SP — CATI', url: 'https://www.cati.sp.gov.br', color: '#2563eb' },
        { label: 'MS — IAGRO', url: 'https://www.iagro.ms.gov.br', color: '#0891b2' },
    ];

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{
                background: 'linear-gradient(160deg, #120606 0%, #1e0a0a 40%, #111827 100%)',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-6 py-4 sticky top-0 z-30"
                style={{ background: 'rgba(18, 6, 6, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(180,48,30,0.3)' }}
            >
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-xl transition-colors hover:bg-white/10"
                    >
                        <ArrowLeftIcon size={20} color="#ffd700" />
                    </button>
                    <div>
                        <h1 className="font-black text-xl flex items-center gap-2" style={{ color: '#ffd700' }}>
                            <Truck size={20} color="#ffd700" />
                            GTA — Guia de Trânsito Animal
                        </h1>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            Prepare e emita GTAs para cada lote de gado recebido
                        </p>
                    </div>
                </div>
                {pendentes > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                        <AlertTriangle size={14} color="#fbbf24" />
                        <span className="text-xs font-bold" style={{ color: '#fbbf24' }}>{pendentes} lote{pendentes > 1 ? 's' : ''} sem GTA emitida</span>
                    </div>
                )}
            </div>

            <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col gap-6">

                {/* Busca */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Search size={16} color="#ffd700" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por lote, fornecedor ou raça…"
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                    />
                    {search && <button onClick={() => setSearch('')} className="text-white/40 hover:text-white/80 text-xs">✕</button>}
                </div>

                {/* Estatísticas rápidas */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total de Lotes', value: batches.length, color: '#60a5fa', icon: <FileText size={16} /> },
                        { label: 'GTA Pendente', value: pendentes, color: '#fbbf24', icon: <Clock size={16} /> },
                        { label: 'GTA Emitida', value: gtaEmitidos.size, color: '#34d399', icon: <CheckCircle size={16} /> },
                    ].map(stat => (
                        <div key={stat.label} className="p-4 rounded-2xl flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ color: stat.color }}>{stat.icon}</span>
                            <p className="text-2xl font-black text-white">{stat.value}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Acesso rápido aos sistemas */}
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#f97316' }}>
                        🌐 Acesso Rápido — Sistemas de GTA por Estado
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                        {sistemas.map(s => (
                            <a
                                key={s.url}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', textDecoration: 'none' }}
                            >
                                <ExternalLink size={12} style={{ color: s.color, flexShrink: 0 }} />
                                {s.label}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Lista de lotes */}
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#ffd700' }}>
                        📦 Lotes Cadastrados
                    </h2>
                    {lotesVisiveis.length === 0
                        ? (
                            <div className="text-center py-16 text-white/30">
                                <Truck size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Nenhum lote encontrado</p>
                            </div>
                        )
                        : (
                            <div className="flex flex-col gap-2">
                                {lotesVisiveis.map(b => {
                                    const emitida = gtaEmitidos.has(b.id_lote);
                                    const st = emitida
                                        ? { label: '✅ GTA Emitida', color: '#34d399', bg: 'rgba(52,211,153,0.08)' }
                                        : statusLabel(b);
                                    const supplier = getSupplier(b.fornecedor);

                                    return (
                                        <div
                                            key={b.id_lote}
                                            className="flex items-center gap-4 p-4 rounded-2xl transition-all"
                                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                                        >
                                            {/* Ícone status */}
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: emitida ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.12)' }}
                                            >
                                                {emitida ? <CheckCircle size={20} color="#34d399" /> : <Truck size={20} color="#fbbf24" />}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-sm text-white">{b.id_lote}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>
                                                        {st.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-white/50 mt-0.5 truncate">
                                                    {supplier?.nome_fantasia || b.fornecedor} • {b.raca || 'Raça não informada'} • {b.qtd_cabecas ? `${b.qtd_cabecas} cabeças` : '—'} • {formatDate(b.data_recebimento)}
                                                </p>
                                            </div>

                                            {/* Ações */}
                                            <div className="flex gap-2 flex-shrink-0">
                                                {emitida ? (
                                                    <button
                                                        onClick={() => setGtaEmitidos(prev => { const n = new Set(prev); n.delete(b.id_lote); return n; })}
                                                        className="text-[10px] px-2 py-1.5 rounded-lg text-white/40 hover:text-white/70 transition-colors"
                                                        style={{ background: 'rgba(255,255,255,0.05)' }}
                                                    >
                                                        Desfazer
                                                    </button>
                                                ) : null}
                                                <button
                                                    onClick={() => setGtaBatch(b)}
                                                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
                                                    style={{
                                                        background: 'linear-gradient(90deg, #7b1d0e, #a03020)',
                                                        color: '#ffd700',
                                                        border: '1px solid rgba(255,215,0,0.25)',
                                                    }}
                                                >
                                                    {emitida ? '📄 Ver Dados' : '📋 Preparar GTA'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    }
                </div>

                {/* Instruções */}
                <div className="p-4 rounded-2xl text-xs leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>
                    <strong className="text-white/70">Como emitir a GTA:</strong><br />
                    1. Clique em <strong className="text-white/60">"Preparar GTA"</strong> no lote desejado<br />
                    2. Copie os dados organizados para o sistema do seu estado<br />
                    3. Acesse o portal da Defesa Agropecuária pelo atalho acima<br />
                    4. Faça login com sua senha normal e preencha o formulário<br />
                    5. Peça a assinatura do veterinário credenciado e emita a GTA
                </div>

            </div>

            {/* Modal GTA */}
            {gtaBatch && (
                <GTAModal
                    batch={gtaBatch}
                    supplier={getSupplier(gtaBatch.fornecedor)}
                    onClose={() => {
                        if (!gtaEmitidos.has(gtaBatch.id_lote)) {
                            if (window.confirm('Marcar GTA deste lote como emitida?')) {
                                setGtaEmitidos(prev => new Set(prev).add(gtaBatch.id_lote));
                            }
                        }
                        setGtaBatch(null);
                    }}
                />
            )}
        </div>
    );
};

export default GTAManager;
