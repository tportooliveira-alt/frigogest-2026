import React, { useState } from 'react';
import { Batch, Supplier } from '../types';
import {
    X as XIcon,
    ExternalLink as ExternalLinkIcon,
    Copy as CopyIcon,
    CheckCircle as CheckCircleIcon,
    FileText as FileTextIcon,
    AlertTriangle as AlertIcon,
    ClipboardList as ClipboardIcon,
    Truck as TruckIcon,
} from 'lucide-react';

interface GTAModalProps {
    batch: Batch;
    supplier?: Supplier;
    onClose: () => void;
}

const GTAModal: React.FC<GTAModalProps> = ({ batch, supplier, onClose }) => {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [checklistDone, setChecklistDone] = useState<boolean[]>(new Array(7).fill(false));

    const copy = (text: string, id: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(id);
            setTimeout(() => setCopiedField(null), 2000);
        });
    };

    const formatDate = (iso: string) => {
        if (!iso) return '—';
        return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
    };

    const qtdEfetiva = (batch.qtd_cabecas || 0) - (batch.qtd_mortos || 0);

    // Peso vivo total: usa direto se disponível, senão estima (rendimento 52%)
    const pesoVivoTotal = batch.qtd_cabecas && batch.peso_vivo_medio
        ? Math.round(batch.qtd_cabecas * batch.peso_vivo_medio)
        : Math.round((batch.peso_total_romaneio || 0) / 0.52);

    const fields = [
        { id: 'especie', label: 'Espécie Animal', value: 'Bovino — Zebuíno (Bos indicus)', fixed: true },
        { id: 'finalidade', label: 'Finalidade do Trânsito', value: 'Abate industrial', fixed: true },
        { id: 'raca', label: 'Raça / Cruzamento', value: batch.raca || 'Nelore', fixed: false },
        { id: 'sexo', label: 'Sexo', value: 'Macho inteiro / Macho castrado', fixed: false },
        { id: 'qtd', label: 'Quantidade de Cabeças', value: String(qtdEfetiva || batch.qtd_cabecas || '—'), fixed: false },
        { id: 'mortos', label: 'Mortalidade no Transporte', value: String(batch.qtd_mortos || 0), fixed: false },
        { id: 'peso_vivo', label: 'Peso Vivo Total Estimado (kg)', value: pesoVivoTotal > 0 ? `${pesoVivoTotal} kg` : '—', fixed: false },
        { id: 'data', label: 'Data do Trânsito', value: formatDate(batch.data_recebimento), fixed: false },
        { id: 'remetente', label: 'Remetente (Fazenda Origem)', value: supplier?.nome || batch.fornecedor || '—', fixed: false },
        { id: 'origem', label: 'Município de Origem', value: (supplier as any)?.municipio_fazenda || (supplier as any)?.cidade_entrega || 'Verificar cadastro do fornecedor', fixed: false },
        { id: 'destinatario', label: 'Destinatário (Frigorífico)', value: 'FrigoGest Frigorífico Ltda', fixed: false },
        { id: 'destino', label: 'Município de Destino', value: 'Vitória da Conquista — BA', fixed: false },
        { id: 'ref_lote', label: 'Referência do Lote Sistema', value: batch.id_lote, fixed: false },
    ];

    const checklist = [
        'Veterinário credenciado estadual emitiu e assinou a GTA',
        'NF de compra do gado vinculada (DANFE junto com a GTA)',
        'Placa e dados do veículo transportador preenchidos',
        'Número do SISBOV/Brincos (se rastreável) informados',
        'Laudo de vacinação (febre aftosa) e sanidade do lote',
        'GTA tem validade de até 5 dias — data de emissão conferida',
        'Via física da GTA acompanha o veículo durante o trânsito',
    ];

    const allCopied = () => {
        const bloco = fields.map(f => `${f.label}: ${f.value}`).join('\n');
        copy(bloco, 'all');
    };

    // Links dos sistemas estaduais mais comuns
    const sistemas = [
        { label: 'ADAB — Bahia (e-GTA BA)', url: 'https://egta.adab.ba.gov.br' },
        { label: 'IDAF — Espírito Santo', url: 'https://sistema.idaf.es.gov.br' },
        { label: 'IMA — Minas Gerais', url: 'https://www6.agricultura.mg.gov.br' },
        { label: 'Agrodefesa — Goiás', url: 'https://agrodefesa.go.gov.br' },
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div
                className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
                style={{
                    background: 'linear-gradient(160deg, #180808 0%, #2a1010 50%, #0f172a 100%)',
                    border: '1px solid rgba(160,48,32,0.45)',
                    maxHeight: '90vh',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between p-5 flex-shrink-0"
                    style={{ background: 'linear-gradient(90deg, #7b1d0e, #a03020)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
                >
                    <div className="flex items-center gap-3">
                        <TruckIcon size={22} color="#ffd700" />
                        <div>
                            <h2 className="font-bold text-lg" style={{ color: '#ffd700' }}>
                                🐄 GTA — Guia de Trânsito Animal
                            </h2>
                            <p className="text-xs text-white/60">Lote {batch.id_lote} • {formatDate(batch.data_recebimento)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                        <XIcon size={20} color="white" />
                    </button>
                </div>

                <div className="overflow-y-auto p-5 flex flex-col gap-4">
                    {/* Instrução */}
                    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)' }}>
                        <AlertIcon size={16} color="#ffa500" className="mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-300 leading-relaxed">
                            Copie os dados abaixo e cole no sistema de GTA do seu estado. Clique em <strong>"Sistemas de GTA"</strong> para acessar o portal da sua Defesa Agropecuária. Você faz login com sua senha normalmente — sua senha não fica salva aqui.
                        </p>
                    </div>

                    {/* Dados */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#ffd700' }}>
                            <ClipboardIcon size={13} /> Dados para Preenchimento da GTA
                        </h3>
                        <div className="flex flex-col gap-1.5">
                            {fields.map(f => (
                                <div key={f.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-white/50 mb-0.5">{f.label}</p>
                                        <p className="text-sm font-medium text-white truncate">{f.value}</p>
                                    </div>
                                    {f.fixed
                                        ? <span className="text-[10px] px-2 py-1 rounded text-white/30" style={{ background: 'rgba(255,255,255,0.06)' }}>fixo</span>
                                        : <button
                                            onClick={() => copy(f.value, f.id)}
                                            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                            style={{
                                                background: copiedField === f.id ? 'rgba(34,197,94,0.2)' : 'rgba(255,215,0,0.12)',
                                                border: `1px solid ${copiedField === f.id ? 'rgba(34,197,94,0.5)' : 'rgba(255,215,0,0.25)'}`,
                                                color: copiedField === f.id ? '#22c55e' : '#ffd700',
                                            }}
                                        >
                                            {copiedField === f.id ? <><CheckCircleIcon size={11} /> OK</> : <><CopyIcon size={11} /> Copiar</>}
                                        </button>
                                    }
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Copiar tudo */}
                    <button
                        onClick={allCopied}
                        className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                        style={{
                            background: copiedField === 'all' ? 'rgba(34,197,94,0.15)' : 'rgba(255,215,0,0.1)',
                            border: `1px solid ${copiedField === 'all' ? 'rgba(34,197,94,0.4)' : 'rgba(255,215,0,0.25)'}`,
                            color: copiedField === 'all' ? '#22c55e' : '#ffd700',
                        }}
                    >
                        {copiedField === 'all' ? <><CheckCircleIcon size={15} /> Copiado!</> : <><CopyIcon size={15} /> Copiar todos os dados de uma vez</>}
                    </button>

                    {/* Checklist */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#f97316' }}>
                            📋 Checklist — Documentos Obrigatórios
                        </h3>
                        <div className="flex flex-col gap-1.5">
                            {checklist.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => setChecklistDone(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
                                    className="flex items-start gap-3 p-2.5 rounded-lg text-left transition-all w-full"
                                    style={{
                                        background: checklistDone[i] ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${checklistDone[i] ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                    }}
                                >
                                    <div className="w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center" style={{ border: `1.5px solid ${checklistDone[i] ? '#22c55e' : 'rgba(255,165,0,0.5)'}`, background: checklistDone[i] ? 'rgba(34,197,94,0.2)' : 'transparent' }}>
                                        {checklistDone[i] && <CheckCircleIcon size={10} color="#22c55e" />}
                                    </div>
                                    <span className={`text-xs leading-relaxed ${checklistDone[i] ? 'text-green-400 line-through opacity-60' : 'text-white/75'}`}>{item}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Aviso validade */}
                    <div className="p-3 rounded-xl text-center text-xs" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#f87171' }}>
                        ⚠️ GTA válida por <strong>no máximo 5 dias</strong> a partir da emissão. O documento físico deve acompanhar o veículo.
                    </div>
                </div>

                {/* Footer — Sistemas de GTA */}
                <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.25)' }}>
                    <p className="text-xs text-white/40 mb-2 text-center">Selecione o sistema do seu estado:</p>
                    <div className="grid grid-cols-2 gap-2">
                        {sistemas.map(s => (
                            <a
                                key={s.url}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all text-center"
                                style={{
                                    background: 'linear-gradient(90deg, #7b1d0e, #a03020)',
                                    color: '#ffd700',
                                    border: '1px solid rgba(255,215,0,0.25)',
                                    textDecoration: 'none',
                                }}
                            >
                                <ExternalLinkIcon size={12} />
                                {s.label}
                            </a>
                        ))}
                    </div>
                    <button onClick={onClose} className="w-full mt-2 py-2 rounded-xl text-xs text-white/50 hover:text-white/80 transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GTAModal;
