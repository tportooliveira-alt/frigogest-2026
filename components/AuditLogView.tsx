import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Search, ShieldCheck, Clock, FileText, Activity, Filter, User, Users, Wifi, WifiOff, RefreshCw, Calendar } from 'lucide-react';
import { AuditLogEntry } from '../types';
import { fetchAuditLogs } from '../utils/audit';

interface AuditLogViewProps {
    onBack: () => void;
}

const ACTION_LABELS: Record<string, string> = {
    CREATE: 'CRIOU',
    UPDATE: 'EDITOU',
    DELETE: 'EXCLUIU',
    LOGIN: 'ENTROU',
    LOGOUT: 'SAIU',
    OTHER: 'OUTRO'
};

const ENTITY_LABELS: Record<string, string> = {
    CLIENT: 'Cliente',
    BATCH: 'Lote',
    STOCK: 'Estoque',
    SALE: 'Venda',
    TRANSACTION: 'Financeiro',
    ORDER: 'Pedido',
    SYSTEM: 'Sistema',
    OTHER: 'Outro'
};

const AuditLogView: React.FC<AuditLogViewProps> = ({ onBack }) => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEntity, setFilterEntity] = useState<string>('ALL');
    const [filterUser, setFilterUser] = useState<string>('ALL');
    const [filterAction, setFilterAction] = useState<string>('ALL');
    const [filterDate, setFilterDate] = useState<string>('');

    useEffect(() => { loadLogs(); }, []);

    const loadLogs = async () => {
        setLoading(true);
        const data = await fetchAuditLogs(500);
        setLogs(data);
        setLoading(false);
    };

    // Extrair usuários únicos dos logs
    const uniqueUsers = useMemo(() => {
        const userMap = new Map<string, { name: string; email: string; lastActive: string; actions: number }>();
        logs.forEach(log => {
            const existing = userMap.get(log.userId);
            if (!existing || log.timestamp > existing.lastActive) {
                userMap.set(log.userId, {
                    name: log.userName || log.userEmail?.split('@')[0] || 'Desconhecido',
                    email: log.userEmail,
                    lastActive: log.timestamp,
                    actions: (existing?.actions || 0) + 1
                });
            } else {
                existing.actions += 1;
            }
        });
        return Array.from(userMap.entries()).map(([id, data]) => ({ id, ...data }));
    }, [logs]);

    // Verificar quem está "online" (ativo nos últimos 15 min)
    const now = new Date();
    const onlineUsers = uniqueUsers.filter(u => {
        const diff = (now.getTime() - new Date(u.lastActive).getTime()) / 1000 / 60;
        return diff < 15;
    });

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = !searchTerm ||
                log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                log.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesEntity = filterEntity === 'ALL' || log.entity === filterEntity;
            const matchesUser = filterUser === 'ALL' || log.userId === filterUser;
            const matchesAction = filterAction === 'ALL' || log.action === filterAction;
            const matchesDate = !filterDate || log.timestamp.startsWith(filterDate);
            return matchesSearch && matchesEntity && matchesUser && matchesAction && matchesDate;
        });
    }, [logs, searchTerm, filterEntity, filterUser, filterAction, filterDate]);

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'CREATE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'UPDATE': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'DELETE': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'LOGIN': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'LOGOUT': return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-slate-50 text-slate-400 border-slate-100';
        }
    };

    const getEntityIcon = (entity: string) => {
        switch (entity) {
            case 'SALE': return '💰';
            case 'CLIENT': return '👤';
            case 'BATCH': return '🐂';
            case 'STOCK': return '📦';
            case 'TRANSACTION': return '💳';
            case 'ORDER': return '📋';
            case 'SYSTEM': return '⚙️';
            default: return '📝';
        }
    };

    const timeAgo = (timestamp: string) => {
        const diff = (now.getTime() - new Date(timestamp).getTime()) / 1000;
        if (diff < 60) return 'agora';
        if (diff < 3600) return `${Math.floor(diff / 60)}min`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20 font-sans">

            {/* HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex flex-col gap-3">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-xl">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-gray-900">
                                Auditoria <span className="text-blue-600">Geral</span>
                            </h1>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                                Todas atividades • Todos usuários • Tempo real
                            </p>
                        </div>
                    </div>
                </div>
                <button onClick={loadLogs} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-sm">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
                </button>
            </div>

            {/* PAINEL DE USUÁRIOS ONLINE / ATIVOS */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <Users size={16} className="text-blue-600" />
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Colaboradores</h3>
                        <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                            {onlineUsers.length} Online
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {uniqueUsers.map(user => {
                            const isOnline = onlineUsers.some(u => u.id === user.id);
                            return (
                                <div key={user.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all cursor-pointer ${filterUser === user.id ? 'bg-blue-50 border-blue-300 shadow-md' :
                                        isOnline ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50/50 border-slate-100'
                                    }`} onClick={() => setFilterUser(filterUser === user.id ? 'ALL' : user.id)}>
                                    <div className="relative">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        {isOnline && (
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800 uppercase leading-none">{user.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {isOnline ? (
                                                <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-600 uppercase">
                                                    <Wifi size={8} /> Online
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase">
                                                    <WifiOff size={8} /> {timeAgo(user.lastActive)}
                                                </span>
                                            )}
                                            <span className="text-[8px] font-bold text-slate-300">• {user.actions} ações</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {uniqueUsers.length === 0 && (
                            <p className="text-[10px] font-bold text-slate-300 uppercase">Nenhum usuário registrado nos logs</p>
                        )}
                    </div>
                </div>
            </div>

            {/* FILTROS */}
            <div className="max-w-7xl mx-auto mb-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                        type="text"
                        placeholder="Pesquisar atividade, usuário..."
                        className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-xl px-2 py-1 shadow-sm">
                    <Calendar size={12} className="text-blue-500 ml-1" />
                    <input
                        type="date"
                        className="text-[10px] font-bold text-slate-600 bg-transparent outline-none px-1"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                    />
                    {filterDate && <button onClick={() => setFilterDate('')} className="text-[9px] font-black text-rose-400 px-1">✕</button>}
                </div>
                <div className="flex p-0.5 bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                    {[
                        { label: 'Todos', value: 'ALL' },
                        { label: '👤 Cliente', value: 'CLIENT' },
                        { label: '🐂 Lote', value: 'BATCH' },
                        { label: '💰 Venda', value: 'SALE' },
                        { label: '💳 Financeiro', value: 'TRANSACTION' },
                        { label: '📦 Estoque', value: 'STOCK' },
                        { label: '⚙️ Sistema', value: 'SYSTEM' },
                    ].map(f => (
                        <button key={f.value} onClick={() => setFilterEntity(f.value)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${filterEntity === f.value ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:bg-slate-50'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex p-0.5 bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                    {[
                        { label: 'Todos', value: 'ALL' },
                        { label: 'Entrou', value: 'LOGIN' },
                        { label: 'Criou', value: 'CREATE' },
                        { label: 'Editou', value: 'UPDATE' },
                        { label: 'Excluiu', value: 'DELETE' },
                    ].map(f => (
                        <button key={f.value} onClick={() => setFilterAction(f.value)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${filterAction === f.value ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:bg-slate-50'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTADOR */}
            <div className="max-w-7xl mx-auto mb-3 flex items-center gap-3 px-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    {filteredLogs.length} registros {filterUser !== 'ALL' && `• Filtrando por usuário`} {filterDate && `• Data: ${filterDate}`}
                </span>
            </div>

            {/* TIMELINE / TABELA */}
            <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center gap-4">
                        <Activity className="animate-spin text-blue-600" size={40} />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Carregando registros...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse" style={{ fontSize: '11px' }}>
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider w-36">Quando</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">Quem</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-center w-24">Ação</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider text-center w-28">Módulo</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">O que fez</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center">
                                            <FileText size={48} className="mx-auto mb-3 text-slate-200" />
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Nenhum registro encontrado</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => {
                                        const isOnline = onlineUsers.some(u => u.id === log.userId);
                                        return (
                                            <tr key={log.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-4 py-2.5">
                                                    <p className="text-[10px] font-bold text-slate-600">{new Date(log.timestamp).toLocaleDateString('pt-BR')}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <Clock size={9} /> {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                                                    </p>
                                                    <p className="text-[8px] font-bold text-blue-400 mt-0.5">{timeAgo(log.timestamp)} atrás</p>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="relative">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                                                {(log.userName || log.userEmail?.split('@')[0] || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                            {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-800 uppercase leading-none">{log.userName || log.userEmail?.split('@')[0] || 'Sistema'}</p>
                                                            <p className="text-[8px] font-bold text-slate-400 mt-0.5 truncate max-w-[140px]">{log.userEmail}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-wider ${getActionBadge(log.action)}`}>
                                                        {ACTION_LABELS[log.action] || log.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className="text-sm mr-1">{getEntityIcon(log.entity)}</span>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase">{ENTITY_LABELS[log.entity] || log.entity}</span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <p className="text-xs font-bold text-slate-700 leading-relaxed max-w-xl">{log.details}</p>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* RODAPÉ */}
            <div className="max-w-7xl mx-auto mt-6 flex flex-wrap justify-between items-center gap-3 border-t border-slate-100 pt-6 opacity-40">
                <div className="flex gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> {onlineUsers.length} Online Agora</span>
                    <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> {logs.length} Logs Carregados</span>
                </div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">THIAGO 704 // Auditoria em Tempo Real</p>
            </div>
        </div>
    );
};

export default AuditLogView;
