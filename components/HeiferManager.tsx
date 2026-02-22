import React, { useState } from 'react';
import {
    Calendar,
    MessageCircle,
    Link as LinkIcon,
    Check,
    Activity,
    AlertTriangle,
    ArrowLeft,
    Zap,
    TrendingUp,
    ChevronRight,
    Users
} from 'lucide-react';
import { ScheduledOrder } from '../types';

interface HeiferManagerProps {
    onBack?: () => void;
    onAddOrder?: (order: any) => Promise<void>;
    existingOrders: ScheduledOrder[];
}

const HeiferManager: React.FC<HeiferManagerProps> = ({ onBack, onAddOrder, existingOrders }) => {
    const [targetDate, setTargetDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    const [myWhatsapp, setMyWhatsapp] = useState('');
    const [clientName, setClientName] = useState('');
    const [quantity, setQuantity] = useState<number | ''>('');
    const [whatsappLink, setWhatsappLink] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);

    const TOTAL_BATCH = 25;
    const tomorrowOrders = existingOrders.filter(order => order.data_entrega === targetDate && order.status !== 'CANCELADO');
    const totalSold = tomorrowOrders.reduce((acc, order) => {
        const match = order.itens.match(/(\d+)/);
        return acc + (match ? parseInt(match[0]) : 1);
    }, 0);

    const remaining = Math.max(0, TOTAL_BATCH - totalSold);
    const progress = Math.min(100, (totalSold / TOTAL_BATCH) * 100);

    const generateLink = () => {
        if (!myWhatsapp || !quantity) return;
        const message = `Quero confirmar o agendamento de ${quantity} novilhas para o abate dia ${new Date(targetDate).toLocaleDateString()}`;
        setWhatsappLink(`https://wa.me/55${myWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`);
    };

    const handleConfirm = async () => {
        if (!onAddOrder || !clientName || !quantity) return;
        setIsConfirming(true);
        try {
            await onAddOrder({
                id: `ORD-${Date.now()}`,
                id_cliente: 'TEMP-' + Date.now(),
                nome_cliente: clientName,
                data_entrega: targetDate,
                hora_entrega: '08:00',
                itens: `${quantity} Novilhas (Agendamento Rápido)`,
                status: 'CONFIRMADO',
                data_criacao: new Date().toISOString(),
                alerta_madrugada: false
            });
            setClientName(''); setQuantity(''); setWhatsappLink('');
        } finally {
            setIsConfirming(false);
        }
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">
            {/* PREMIUM HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex flex-col gap-4">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-red-700 hover:border-red-100 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar ao Início
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="bg-rose-600 p-3 rounded-2xl text-white shadow-xl shadow-rose-100">
                            <Activity size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                Controle de <span className="text-rose-600">Abate</span>
                            </h1>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                Planejamento e Escala / ID-ABT
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Escala para o dia</p>
                        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="text-sm font-bold text-slate-900 outline-none bg-transparent cursor-pointer" />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                {/* COUNTER PANEL */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-8">
                    <div className="bg-slate-900 rounded-[48px] p-12 text-white relative shadow-2xl overflow-hidden min-h-[300px] flex flex-col justify-center">
                        <div className="absolute top-[-10%] right-[-5%] opacity-10 pointer-events-none transform rotate-12"><Zap size={200} /></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Vagas Disponíveis no Lote</p>
                            <h2 className="text-8xl font-black tracking-tighter text-blue-400">{remaining}</h2>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-2">Novilhas por alocar</p>
                        </div>

                        <div className="mt-12 bg-white/5 h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between mt-4 text-[10px] font-black uppercase tracking-widest">
                            <span className="text-blue-400">{totalSold} Alocadas</span>
                            <span className="text-slate-500">{TOTAL_BATCH} Limite Diário</span>
                        </div>
                    </div>

                    <div className="premium-card p-8">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Users size={16} className="text-rose-600" /> Parceiros Confirmados
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {tomorrowOrders.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aguardando Lançamentos</p>
                                </div>
                            ) : (
                                tomorrowOrders.map(order => (
                                    <div key={order.id} className="p-4 rounded-2xl bg-white border border-slate-50 flex justify-between items-center group hover:border-rose-100 transition-all shadow-sm">
                                        <div>
                                            <h4 className="font-extrabold text-slate-900 uppercase text-sm">{order.nome_cliente}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{order.itens}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <Check size={14} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="premium-card p-8 bg-blue-600 text-white border-none shadow-xl shadow-blue-200">
                        <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Zap size={16} /> Manual do Colaborador
                        </h3>
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-black text-[10px]">1</div>
                                <p className="text-[11px] font-bold leading-relaxed">Selecione a **DATA DO ABATE** no topo da tela.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-black text-[10px]">2</div>
                                <p className="text-[11px] font-bold leading-relaxed">Verifique o painel **VAGAS DISPONÍVEIS**. Limite: 25 cabeças/dia.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-black text-[10px]">3</div>
                                <p className="text-[11px] font-bold leading-relaxed">Insira o nome do produtor e a quantidade. Clique em **CRIAR LINK**.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-black text-[10px]">4</div>
                                <p className="text-[11px] font-bold leading-relaxed">Envie o link via WhatsApp para o produtor confirmar a entrega.</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-black text-[10px]">5</div>
                                <p className="text-[11px] font-bold leading-relaxed">Após a resposta dele, clique em **VALIDAR NO SISTEMA** para reservar a vaga.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LOG ENTRY PANEL */}
                <div className="lg:col-span-12 xl:col-span-7 premium-card overflow-hidden h-full">
                    <div className="bg-slate-900 p-8 flex items-center gap-4 text-white">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                            <MessageCircle size={20} />
                        </div>
                        <div>
                            <h3 className="font-black uppercase tracking-tight text-lg">Agendamento Remoto</h3>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Terminal via Web/Whatsapp</p>
                        </div>
                    </div>
                    <div className="p-10 space-y-8">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1">Seu número de Whatsapp</label>
                            <input type="text" placeholder="DDD + Número" value={myWhatsapp} onChange={(e) => setMyWhatsapp(e.target.value)} className="modern-input h-14 font-bold text-lg" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Identificador do Parceiro</label>
                                <input type="text" placeholder="Nome ou ID" value={clientName} onChange={(e) => setClientName(e.target.value)} className="modern-input h-14" />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Quantidade de Cabeças</label>
                                <input type="text" inputMode="numeric" placeholder="Qtd" value={quantity === '' ? '' : quantity} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setQuantity(v === '' ? '' : parseInt(v)); }} className="modern-input h-14 font-black text-lg" />
                            </div>
                        </div>

                        <button onClick={generateLink} disabled={!myWhatsapp || !quantity} className="w-full btn-modern bg-slate-900 text-white py-5 rounded-2xl hover:bg-blue-600 gap-3 shadow-xl transition-all disabled:opacity-20 active:scale-95">
                            <LinkIcon size={18} /> Criar Link de Confirmação
                        </button>

                        {whatsappLink && (
                            <div className="animate-reveal space-y-6 pt-10 border-t border-slate-50">
                                <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-5 font-mono text-[10px] text-blue-600 break-all leading-relaxed shadow-inner">
                                    {whatsappLink}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="bg-[#25D366] text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-center flex items-center justify-center gap-3 shadow-xl shadow-[rgba(37,211,102,0.2)] hover:bg-[#128C7E] transition-all">
                                        <MessageCircle size={18} /> Enviar Mensagem
                                    </a>
                                    <button onClick={handleConfirm} disabled={isConfirming} className="bg-rose-600 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-[rgba(225,29,72,0.2)] hover:bg-slate-900 transition-all">
                                        {isConfirming ? <Activity size={18} className="animate-spin" /> : <Check size={18} />} Validar no Sistema
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeiferManager;
