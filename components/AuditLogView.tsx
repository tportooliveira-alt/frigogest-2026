import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, ShieldCheck, Clock, FileText, Activity, Filter, ChevronRight, User } from 'lucide-react';
import { AuditLogEntry } from '../types';
import { fetchAuditLogs } from '../utils/audit';

interface AuditLogViewProps {
    onBack: () => void;
}

const AuditLogView: React.FC<AuditLogViewProps> = ({ onBack }) => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEntity, setFilterEntity] = useState<string>('ALL');

    useEffect(() => { loadLogs(); }, []);

    const loadLogs = async () => {
        setLoading(true);
        const data = await fetchAuditLogs(200);
        setLogs(data);
        setLoading(false);
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            log.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesEntity = filterEntity === 'ALL' || log.entity === filterEntity;
        return matchesSearch && matchesEntity;
    });

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'CREATE': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'UPDATE': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'DELETE': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'LOGIN': return 'bg-slate-50 text-slate-800 border-slate-200';
            default: return 'bg-slate-50 text-slate-400 border-slate-100';
        }
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20 font-sans">

            {/* PREMIUM HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex flex-col gap-4">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar ao Início
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-xl">
                            <ShieldCheck size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                Log de <span className="text-blue-600">Auditoria</span>
                            </h1>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                Rastreamento de Atividades / ID-AUD
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
                    <div className="relative group flex-1 md:flex-none md:min-w-[300px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Pesquisar atividades..."
                            className="modern-input pl-12 h-12 text-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm shrink-0 overflow-x-auto no-scrollbar max-w-full">
                        {['Todos', 'Venda', 'Cliente', 'Lote', 'Estoque', 'Sistema'].map((f, i) => {
                            const actual_f = ['ALL', 'SALE', 'CLIENT', 'BATCH', 'STOCK', 'SYSTEM'][i];
                            return (
                                <button key={actual_f} onClick={() => setFilterEntity(actual_f)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterEntity === actual_f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                                    {f}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* AUDIT LIST/TABLE */}
            <div className="max-w-7xl mx-auto premium-card overflow-hidden">
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center gap-6">
                        <Activity className="animate-spin text-blue-600" size={48} />
                        <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">Sincronizando registros de segurança...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="technical-table">
                            <thead>
                                <tr>
                                    <th className="w-48">Timestamp</th>
                                    <th>Operador</th>
                                    <th className="text-center">Tipo Ação</th>
                                    <th className="text-center">Módulo</th>
                                    <th>Detalhamento da Operação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.length === 0 ? (
                                    <tr><td colSpan={5} className="py-24 text-center border-0"><FileText size={64} className="mx-auto mb-4 opacity-05" /><p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em]">Nenhum registro encontrado</p></td></tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="text-[10px] font-bold text-slate-400">
                                                {new Date(log.timestamp).toLocaleDateString()}
                                                <span className="block opacity-40 text-[9px] mt-1">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-9 h-9 bg-slate-100 rounded-xl text-slate-600 flex items-center justify-center transition-all group-hover:bg-blue-600 group-hover:text-white">
                                                        <User size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="font-extrabold text-slate-900 uppercase text-xs">{log.userName || 'Sistema Automático'}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">{log.userEmail}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <span className={`inline-flex px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${getActionBadge(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <span className="inline-flex px-3 py-1 rounded-full text-[9px] font-black text-slate-400 border border-slate-100 uppercase tracking-widest">
                                                    {log.entity}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                <p className="text-slate-700 font-medium text-xs leading-relaxed max-w-2xl">
                                                    {log.details}
                                                </p>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODERN FOOTER */}
            <div className="max-w-7xl mx-auto mt-8 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-slate-100 pt-8 opacity-40">
                <div className="flex gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Buffer Operacional: 200 Logs</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Conexão Segura Ativa</span>
                </div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">Protocolo FG-Shield 2.5</p>
            </div>
        </div>
    );
};

export default AuditLogView;
