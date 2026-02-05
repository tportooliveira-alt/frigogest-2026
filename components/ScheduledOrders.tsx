import React, { useState, useMemo } from 'react';
import { ScheduledOrder, Client } from '../types';
import {
    Calendar,
    PlusCircle,
    X,
    CheckCircle,
    Clock,
    ArrowLeft,
    AlertTriangle,
    Bell,
    MessageCircle,
    Package,
    ChevronRight,
    Activity,
    ShieldCheck,
    Zap,
    Plus,
    Filter,
    Check,
    CalendarDays
} from 'lucide-react';

interface ScheduledOrdersProps {
    scheduledOrders: ScheduledOrder[];
    clients: Client[];
    addScheduledOrder: (order: ScheduledOrder) => Promise<void>;
    updateScheduledOrder: (id: string, updates: Partial<ScheduledOrder>) => Promise<void>;
    deleteScheduledOrder: (id: string) => Promise<void>;
    onViewClientHistory: (clientName: string) => void;
    onBack: () => void;
}

const ScheduledOrders: React.FC<ScheduledOrdersProps> = ({
    scheduledOrders,
    clients,
    addScheduledOrder,
    updateScheduledOrder,
    onViewClientHistory,
    onBack
}) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<ScheduledOrder | null>(null);
    const [newOrder, setNewOrder] = useState<Partial<ScheduledOrder>>({
        id_cliente: '',
        nome_cliente: '',
        data_entrega: new Date().toISOString().split('T')[0],
        hora_entrega: '08:00',
        itens: '',
        alerta_madrugada: true,
        status: 'ABERTO'
    });

    const [filter, setFilter] = useState<'TODOS' | 'ABERTO' | 'CONFIRMADO'>('ABERTO');

    const filteredOrders = useMemo(() => {
        let list = [...scheduledOrders];
        if (filter !== 'TODOS') list = list.filter(o => o.status === filter);
        return list.sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
    }, [scheduledOrders, filter]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrder.id_cliente || !newOrder.data_entrega || !newOrder.itens) return;
        const selectedClient = clients.find(c => c.id_ferro === newOrder.id_cliente);
        const orderToSave: ScheduledOrder = {
            id: `ORD-${Date.now()}`,
            id_cliente: newOrder.id_cliente,
            nome_cliente: selectedClient?.nome_social || 'Desconhecido',
            data_entrega: newOrder.data_entrega,
            hora_entrega: newOrder.hora_entrega,
            itens: newOrder.itens,
            status: 'ABERTO',
            data_criacao: new Date().toISOString(),
            alerta_madrugada: !!newOrder.alerta_madrugada
        };
        await addScheduledOrder(orderToSave);
        setShowAddForm(false);
        setNewOrder({ id_cliente: '', data_entrega: new Date().toISOString().split('T')[0], hora_entrega: '08:00', itens: '', alerta_madrugada: true, status: 'ABERTO' });
    };

    const isUpcoming = (dateStr: string) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const delivery = new Date(dateStr + 'T12:00:00'); delivery.setHours(0, 0, 0, 0);
        const diff = (delivery.getTime() - today.getTime()) / 86400000;
        return diff >= 0 && diff <= 1;
    };

    const sendWhatsApp = (order: ScheduledOrder) => {
        const client = clients.find(c => c.id_ferro === order.id_cliente);
        if (!client || !client.whatsapp) return;
        const date = new Date(order.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR');
        const text = `*CONFIRMACAO DE PEDIDO - FRIGOGEST*%0A%0AALERTA_LOGISTICA PARA *${order.nome_cliente.toUpperCase()}*%0ADATA: *${date}*%0A%0A*📦 ITENS:*%0A${order.itens.replace(/\n/g, '%0A')}%0A%0A*🕒 PREVISAO:* ${order.hora_entrega || '--:--'}%0A%0AFG_CORE_TERMINAL_2026`;
        window.open(`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}?text=${text}`, '_blank');
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">
            {/* PREMIUM HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex flex-col gap-4">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-purple-700 hover:border-purple-100 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar ao Início
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="bg-purple-600 p-3 rounded-2xl text-white shadow-xl shadow-purple-100">
                            <Calendar size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                Agenda <span className="text-purple-600">Logística</span>
                            </h1>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                Planejamento de Entregas / ID-SCH
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        {(['ABERTO', 'CONFIRMADO', 'TODOS'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                                {f.replace('ABERTO', 'Pendentes').replace('CONFIRMADO', 'Concluídos').replace('TODOS', 'Todos')}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowAddForm(true)} className="btn-modern bg-blue-600 text-white hover:bg-blue-500 px-8 py-3.5 rounded-2xl gap-3 shadow-xl shadow-blue-900/40">
                        <Plus size={18} /> Novo Agendamento
                    </button>
                </div>
            </div>

            {/* CRITICAL ALERTS */}
            {scheduledOrders.some(o => o.status === 'ABERTO' && isUpcoming(o.data_entrega)) && (
                <div className="max-w-7xl mx-auto mb-10 bg-orange-600 rounded-[32px] text-white p-8 flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-orange-900/20 animate-pulse-slow">
                    <div className="flex items-center gap-6 mb-4 md:mb-0">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                            <AlertTriangle size={32} />
                        </div>
                        <div>
                            <h4 className="text-2xl font-black tracking-tight uppercase">Expedição Urgente</h4>
                            <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Pedidos pendentes para as próximas 24 horas</p>
                        </div>
                    </div>
                    <div className="px-6 py-2 rounded-full bg-white/10 text-[10px] font-black tracking-widest border border-white/10 uppercase">Prioridade Máxima</div>
                </div>
            )}

            {/* LOG LIST - TECHNICAL VIEW */}
            <div className="max-w-7xl mx-auto space-y-4">
                {filteredOrders.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center bg-white rounded-[40px] border border-dashed border-slate-200">
                        <Package size={80} className="mb-6 opacity-05" />
                        <p className="text-xs font-black text-slate-300 uppercase tracking-[0.4em]">Nenhum agendamento encontrado</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredOrders.map(order => {
                            const upcoming = isUpcoming(order.data_entrega);
                            return (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`premium-card p-0 overflow-hidden group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl ${order.status === 'CONFIRMADO' ? 'opacity-60 grayscale-[0.5]' : ''}`}
                                >
                                    <div className="flex items-center">
                                        <div className={`w-28 h-28 flex flex-col items-center justify-center shrink-0 ${upcoming ? 'bg-orange-600 text-white' : 'bg-slate-50 text-slate-400'} group-hover:scale-105 transition-transform`}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">{new Date(order.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                                            <span className="text-4xl font-black tracking-tighter">{new Date(order.data_entrega + 'T12:00:00').getDate()}</span>
                                            <span className="text-[9px] font-bold opacity-60 uppercase">{new Date(order.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}</span>
                                        </div>
                                        <div className="flex-1 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate max-w-sm">{order.nome_cliente}</h3>
                                                    {upcoming && <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.5)]" />}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-4 mt-2">
                                                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-slate-500 text-[10px] font-black">
                                                        <Clock size={12} />
                                                        {order.hora_entrega || '--:--'}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-lg">{order.itens}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-5">
                                                {order.status === 'ABERTO' ? (
                                                    <>
                                                        <button onClick={(e) => { e.stopPropagation(); updateScheduledOrder(order.id, { status: 'CONFIRMADO' }); }} className="btn-modern bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[10px] hover:bg-emerald-600 shadow-lg">Validar</button>
                                                        <button onClick={(e) => { e.stopPropagation(); sendWhatsApp(order); }} className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all"><MessageCircle size={20} /></button>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                                                        <CheckCircle size={18} /> Concluído
                                                    </div>
                                                )}
                                                <ChevronRight size={20} className="text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODALS */}
            {(showAddForm || selectedOrder) && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-reveal">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-white">
                        <div className="bg-slate-900 p-8 flex justify-between items-center text-white">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">{showAddForm ? 'Agendamento de Fluxo' : 'Detalhes do Evento'}</h3>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Sincronização Logística Pro</p>
                            </div>
                            <button onClick={() => { setShowAddForm(false); setSelectedOrder(null); }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={showAddForm ? handleSubmit : (e) => { e.preventDefault(); updateScheduledOrder(selectedOrder!.id, selectedOrder!); setSelectedOrder(null); }} className="p-10 space-y-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Entidade Cliente</label>
                                {showAddForm ? (
                                    <select required className="modern-input h-14" value={newOrder.id_cliente} onChange={e => setNewOrder({ ...newOrder, id_cliente: e.target.value })}>
                                        <option value="">Selecione um Cliente...</option>
                                        {clients.map(c => <option key={c.id_ferro} value={c.id_ferro}>{c.id_ferro} • {c.nome_social}</option>)}
                                    </select>
                                ) : <div className="text-2xl font-black text-slate-900 uppercase tracking-tight">{selectedOrder?.nome_cliente}</div>}
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Data Prevista</label>
                                    <input required type="date" className="modern-input" value={showAddForm ? newOrder.data_entrega : selectedOrder?.data_entrega} onChange={e => showAddForm ? setNewOrder({ ...newOrder, data_entrega: e.target.value }) : setSelectedOrder({ ...selectedOrder!, data_entrega: e.target.value })} />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Janela de Horário</label>
                                    <input type="time" className="modern-input" value={showAddForm ? newOrder.hora_entrega : selectedOrder?.hora_entrega} onChange={e => showAddForm ? setNewOrder({ ...newOrder, hora_entrega: e.target.value }) : setSelectedOrder({ ...selectedOrder!, hora_entrega: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Manifesto de Carga / Observações</label>
                                <textarea required rows={3} placeholder="Descreva os itens do agendamento..." className="modern-input min-h-[100px] p-4" value={showAddForm ? newOrder.itens : selectedOrder?.itens} onChange={e => showAddForm ? setNewOrder({ ...newOrder, itens: e.target.value }) : setSelectedOrder({ ...selectedOrder!, itens: e.target.value })} />
                            </div>
                            {!showAddForm && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Estado Operacional</label>
                                    <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-100">
                                        <button type="button" onClick={() => setSelectedOrder({ ...selectedOrder!, status: 'ABERTO' })} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedOrder?.status === 'ABERTO' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}>Pendente</button>
                                        <button type="button" onClick={() => setSelectedOrder({ ...selectedOrder!, status: 'CONFIRMADO' })} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedOrder?.status === 'CONFIRMADO' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}>Concluído</button>
                                    </div>
                                </div>
                            )}
                            <button type="submit" className="w-full btn-modern bg-slate-900 text-white py-5 rounded-2xl hover:bg-blue-600 gap-3 shadow-xl transition-all">
                                <Check size={20} /> {showAddForm ? 'Efetivar Agendamento' : 'Confirmar Alterações'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduledOrders;
