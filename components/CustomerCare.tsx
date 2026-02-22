import React, { useState } from 'react';
import {
    ArrowLeft,
    Gift,
    Star,
    Zap,
    Heart,
    TrendingUp,
    Send,
    Users,
    Calendar,
    Award,
    Target
} from 'lucide-react';
import { Client } from '../types';
import {
    sendBirthdayMessage,
    sendVIPUpgrade,
    sendPointsBalance,
    sendGiftNotification,
    sendFlashPromo,
    sendThankYouMessage,
    sendPersonalizedOffer,
    SEASONAL_TEMPLATES
} from '../utils/customerRelationship';

interface CustomerCareProps {
    onBack?: () => void;
    clients: Client[];
}

const CustomerCare: React.FC<CustomerCareProps> = ({ onBack, clients }) => {
    const [activeTab, setActiveTab] = useState<'campaigns' | 'loyalty' | 'seasonal'>('campaigns');
    const [selectedClient, setSelectedClient] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Dados de exemplo para pontos
    const [points, setPoints] = useState(250);
    const [discountPercent, setDiscountPercent] = useState(10);
    const [giftItem, setGiftItem] = useState('');

    const handleSendBirthday = async () => {
        const client = clients.find(c => c.id_ferro === selectedClient);
        if (!client?.whatsapp) return alert('Cliente sem WhatsApp cadastrado!');

        setIsSending(true);
        await sendBirthdayMessage(client.nome_social, client.whatsapp, discountPercent);
        setIsSending(false);
        alert('✅ Mensagem de aniversário enviada!');
    };

    const handleSendVIP = async () => {
        const client = clients.find(c => c.id_ferro === selectedClient);
        if (!client?.whatsapp) return alert('Cliente sem WhatsApp cadastrado!');

        setIsSending(true);
        await sendVIPUpgrade(client.nome_social, client.whatsapp);
        setIsSending(false);
        alert('✅ Cliente promovido a VIP!');
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-10">
                <button
                    onClick={onBack}
                    className="group flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-700 hover:border-blue-100 transition-all shadow-sm mb-6"
                >
                    <ArrowLeft size={14} /> Voltar
                </button>

                <div className="flex items-center gap-5">
                    <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-3 rounded-2xl text-white shadow-xl shadow-rose-900/40">
                        <Heart size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                            Relacionamento com <span className="text-rose-600">Clientes</span>
                        </h1>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                            Fidelização e Engajamento
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <nav className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm mt-8 overflow-x-auto">
                    {[
                        { id: 'campaigns', icon: Target, label: 'Campanhas' },
                        { id: 'loyalty', icon: Award, label: 'Fidelidade' },
                        { id: 'seasonal', icon: Calendar, label: 'Sazonais' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
                                }`}
                        >
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto">
                {activeTab === 'campaigns' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Birthday */}
                        <div className="premium-card p-8 bg-white">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
                                    <Gift size={28} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Aniversário</h3>
                                    <p className="text-xs text-slate-400 font-bold">Com desconto especial</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Cliente
                                    </label>
                                    <select
                                        value={selectedClient}
                                        onChange={e => setSelectedClient(e.target.value)}
                                        className="modern-input h-12"
                                    >
                                        <option value="">Selecione...</option>
                                        {clients.map(c => (
                                            <option key={c.id_ferro} value={c.id_ferro}>
                                                {c.nome_social}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Desconto (%)
                                    </label>
                                    <input
                                        type="text" inputMode="numeric"
                                        value={discountPercent || ''}
                                        onChange={e => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setDiscountPercent(Number(v) || 0); }}
                                        placeholder="Ex: 10"
                                        className="modern-input h-12"
                                    />
                                </div>

                                <button
                                    onClick={handleSendBirthday}
                                    disabled={!selectedClient || isSending}
                                    className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold h-14 rounded-2xl shadow-xl shadow-pink-200 hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <Send size={18} /> Enviar Parabéns
                                </button>
                            </div>
                        </div>

                        {/* VIP Upgrade */}
                        <div className="premium-card p-8 bg-white">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                    <Star size={28} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Cliente VIP</h3>
                                    <p className="text-xs text-slate-400 font-bold">Upgrade especial</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Cliente
                                    </label>
                                    <select
                                        value={selectedClient}
                                        onChange={e => setSelectedClient(e.target.value)}
                                        className="modern-input h-12"
                                    >
                                        <option value="">Selecione...</option>
                                        {clients.map(c => (
                                            <option key={c.id_ferro} value={c.id_ferro}>
                                                {c.nome_social}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                                    <p className="text-xs font-bold text-amber-900">
                                        ⭐ Benefícios VIP:
                                    </p>
                                    <ul className="text-[11px] text-amber-700 mt-2 space-y-1">
                                        <li>✅ Prioridade nas entregas</li>
                                        <li>✅ Descontos progressivos</li>
                                        <li>✅ Atendimento preferencial</li>
                                    </ul>
                                </div>

                                <button
                                    onClick={handleSendVIP}
                                    disabled={!selectedClient || isSending}
                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-14 rounded-2xl shadow-xl shadow-amber-200 hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <Star size={18} /> Promover a VIP
                                </button>
                            </div>
                        </div>

                        {/* Gift */}
                        <div className="premium-card p-8 bg-white">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <Gift size={28} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Brinde</h3>
                                    <p className="text-xs text-slate-400 font-bold">Presente surpresa</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Cliente
                                    </label>
                                    <select
                                        value={selectedClient}
                                        onChange={e => setSelectedClient(e.target.value)}
                                        className="modern-input h-12"
                                    >
                                        <option value="">Selecione...</option>
                                        {clients.map(c => (
                                            <option key={c.id_ferro} value={c.id_ferro}>
                                                {c.nome_social}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Item do Brinde
                                    </label>
                                    <input
                                        type="text"
                                        value={giftItem}
                                        onChange={e => setGiftItem(e.target.value)}
                                        placeholder="Ex: 2kg de Picanha"
                                        className="modern-input h-12"
                                    />
                                </div>

                                <button
                                    onClick={async () => {
                                        const client = clients.find(c => c.id_ferro === selectedClient);
                                        if (!client?.whatsapp || !giftItem) return alert('Preencha todos os campos!');
                                        setIsSending(true);
                                        await sendGiftNotification(client.nome_social, client.whatsapp, giftItem);
                                        setIsSending(false);
                                        alert('✅ Brinde anunciado!');
                                    }}
                                    disabled={!selectedClient || !giftItem || isSending}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-14 rounded-2xl shadow-xl shadow-emerald-200 hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <Send size={18} /> Enviar Brinde
                                </button>
                            </div>
                        </div>

                        {/* Flash Promo */}
                        <div className="premium-card p-8 bg-white">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                    <Zap size={28} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Promoção Relâmpago</h3>
                                    <p className="text-xs text-slate-400 font-bold">Oferta rápida</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 mb-4">
                                💡 Em breve! Configure promoções automáticas aqui.
                            </p>

                            <button
                                disabled
                                className="w-full bg-slate-200 text-slate-400 font-bold h-14 rounded-2xl cursor-not-allowed"
                            >
                                Em Desenvolvimento
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'loyalty' && (
                    <div className="premium-card p-10 bg-white text-center">
                        <TrendingUp size={64} className="mx-auto text-blue-600 mb-6" />
                        <h3 className="text-2xl font-black text-slate-900 mb-4">
                            Programa de Fidelidade
                        </h3>
                        <p className="text-slate-600 mb-8">
                            Sistema de pontos e cashback para recompensar clientes fiéis.
                        </p>
                        <button className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl">
                            Configurar Programa
                        </button>
                    </div>
                )}

                {activeTab === 'seasonal' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { id: 'natal', title: 'Natal', emoji: '🎄', color: 'red' },
                            { id: 'ano_novo', title: 'Ano Novo', emoji: '🎊', color: 'purple' },
                            { id: 'pascoa', title: 'Páscoa', emoji: '🐰', color: 'yellow' },
                            { id: 'dia_do_cliente', title: 'Dia do Cliente', emoji: '🏆', color: 'blue' }
                        ].map(event => (
                            <div key={event.id} className="premium-card p-8 bg-white">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">{event.emoji}</div>
                                    <h3 className="text-xl font-black text-slate-900 mb-2">{event.title}</h3>
                                    <p className="text-xs text-slate-400 mb-6">Campanha sazonal automática</p>
                                    <button className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-600 transition-all text-sm">
                                        Enviar para Todos
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerCare;
