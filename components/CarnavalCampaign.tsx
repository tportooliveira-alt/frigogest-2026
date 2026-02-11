import React, { useState, useMemo } from 'react';
import { ArrowLeft, Send, CheckSquare, Square, Sparkles, Users, X, Eye } from 'lucide-react';
import { Client } from '../types';
import { gerarCarnavalPersonalizado, gerarCarnavalLuxo, gerarCarnavalSimples, gerarCarnavalAsciiArt } from '../utils/carnavalPersonalizado';
import { sendWhatsAppMessage } from '../utils/whatsappAPI';

interface CarnavalCampaignProps {
    onBack?: () => void;
    clients: Client[];
}

const CarnavalCampaign: React.FC<CarnavalCampaignProps> = ({ onBack, clients }) => {
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [messageStyle, setMessageStyle] = useState<'padrao' | 'luxo' | 'simples' | 'ascii'>('padrao');
    const [isSending, setIsSending] = useState(false);

    // Controls the Preview Modal
    const [previewClientData, setPreviewClientData] = useState<{ id: string, name: string } | null>(null);

    // Filter clients with WhatsApp
    const clientsWithWhatsApp = useMemo(() => {
        return clients.filter(c => c.whatsapp && c.whatsapp.length > 0);
    }, [clients]);

    const toggleClient = (id: string) => {
        setSelectedClients(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedClients.length === clientsWithWhatsApp.length) {
            setSelectedClients([]);
        } else {
            setSelectedClients(clientsWithWhatsApp.map(c => c.id_ferro));
        }
    };

    const getPrimeiroNome = (nomeCompleto: string) => {
        return nomeCompleto.trim().split(' ')[0];
    };

    const generateMessage = (clientName: string) => {
        const firstName = getPrimeiroNome(clientName);

        switch (messageStyle) {
            case 'luxo':
                return gerarCarnavalLuxo(firstName, true);
            case 'simples':
                return gerarCarnavalSimples(firstName, true);
            case 'ascii':
                return gerarCarnavalAsciiArt(firstName, true);
            default:
                return gerarCarnavalPersonalizado(firstName, true);
        }
    };

    const handleSend = async () => {
        if (selectedClients.length === 0) {
            alert('Selecione pelo menos um cliente!');
            return;
        }

        const confirmed = confirm(
            `Enviar mensagem de Carnaval para ${selectedClients.length} cliente(s)?`
        );

        if (!confirmed) return;

        setIsSending(true);
        let successCount = 0;
        let errorCount = 0;

        for (const clientId of selectedClients) {
            const client = clientsWithWhatsApp.find(c => c.id_ferro === clientId);
            if (!client) continue;

            const message = generateMessage(client.nome_social);
            const result = await sendWhatsAppMessage(client.whatsapp!, message);

            if (result.success) {
                successCount++;
            } else {
                errorCount++;
            }

            // Delay to avoid spam
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        setIsSending(false);
        alert(`✅ Enviado. Sucesso: ${successCount}, Erros: ${errorCount}`);
        setSelectedClients([]);
    };

    // Memoized preview message for the modal
    const previewMessageText = useMemo(() => {
        if (!previewClientData) return '';
        return generateMessage(previewClientData.name);
    }, [previewClientData, messageStyle]);

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-fade-in pb-24 relative">

            {/* Header */}
            <div className="max-w-5xl mx-auto mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                    >
                        <ArrowLeft size={16} /> Voltar
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-orange-500 to-pink-600 p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/30">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                                Campanha <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-pink-600">Carnaval</span>
                            </h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Thiago 704 • B2B
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Controls (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Style Selector */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Sparkles size={14} className="text-orange-500" /> Estilo Mensagem
                        </h3>
                        <div className="space-y-3">
                            {[
                                { id: 'padrao', label: 'Padrão (Boas Festas)', emoji: '🎉', desc: 'Ideal para todos' },
                                { id: 'luxo', label: 'Parceiro (Formal)', emoji: '🤝', desc: 'Agradecimento B2B' },
                                { id: 'simples', label: 'Rápido (Direct)', emoji: '⚡', desc: 'Curto e objetivo' },
                                { id: 'ascii', label: 'Visual (Arte)', emoji: '🎨', desc: 'Destaque visual' }
                            ].map(style => (
                                <button
                                    key={style.id}
                                    onClick={() => setMessageStyle(style.id as any)}
                                    className={`w-full p-4 rounded-2xl text-left transition-all border-2 relative overflow-hidden group ${messageStyle === style.id
                                            ? 'bg-orange-50 border-orange-500 text-orange-900 shadow-md transform scale-[1.02]'
                                            : 'bg-white border-slate-100 text-slate-600 hover:border-orange-200 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <div>
                                            <span className="font-bold text-sm block">{style.emoji} {style.label}</span>
                                            <span className={`text-[10px] block mt-0.5 ${messageStyle === style.id ? 'text-orange-700/70' : 'text-slate-400'}`}>
                                                {style.desc}
                                            </span>
                                        </div>
                                        {messageStyle === style.id && (
                                            <div className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Send Action */}
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
                        <button
                            onClick={handleSend}
                            disabled={selectedClients.length === 0 || isSending}
                            className="w-full bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 group"
                        >
                            <div className="flex items-center gap-2">
                                <Send size={20} className={isSending ? 'animate-pulse' : 'group-hover:translate-x-1 transition-transform'} />
                                <span className="text-lg">
                                    {isSending ? 'ENVIANDO...' : 'DISPARAR AGORA'}
                                </span>
                            </div>
                            {!isSending && (
                                <span className="text-[10px] text-white/80 font-medium">
                                    {selectedClients.length} Destinatários Selecionados
                                </span>
                            )}
                        </button>
                        <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
                            ⚠️ Envio com delay de 5s entre mensagens
                        </p>
                    </div>
                </div>

                {/* Right Column: List (8 cols) */}
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                <Users size={16} className="text-slate-400" />
                                LISTA DE CLIENTES ({selectedClients.length}/{clientsWithWhatsApp.length})
                            </h3>
                            <button
                                onClick={toggleAll}
                                className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                {selectedClients.length === clientsWithWhatsApp.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[600px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                            {clientsWithWhatsApp.map(client => {
                                const isSelected = selectedClients.includes(client.id_ferro);
                                const firstName = getPrimeiroNome(client.nome_social);

                                return (
                                    <div
                                        key={client.id_ferro}
                                        onClick={() => toggleClient(client.id_ferro)}
                                        className={`group relative p-4 rounded-2xl cursor-pointer transition-all border-2 flex items-center justify-between gap-4 ${isSelected
                                                ? 'bg-orange-50/50 border-orange-200 shadow-sm'
                                                : 'bg-white border-transparent hover:border-slate-100 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`
                        w-6 h-6 rounded-lg flex items-center justify-center transition-colors
                        ${isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-300 group-hover:bg-white group-hover:border group-hover:border-slate-200'}
                      `}>
                                                {isSelected ? <CheckSquare size={14} strokeWidth={3} /> : <Square size={14} />}
                                            </div>

                                            <div>
                                                <p className={`font-bold text-sm transition-colors ${isSelected ? 'text-orange-900' : 'text-slate-700'}`}>
                                                    {client.nome_social}
                                                </p>
                                                <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                                    📱 {client.whatsapp}
                                                    <span className="text-[9px] px-1.5 bg-slate-100 rounded text-slate-500 font-sans font-bold">
                                                        {firstName}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewClientData({ id: client.id_ferro, name: client.nome_social });
                                            }}
                                            className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm flex items-center gap-2"
                                        >
                                            <Eye size={14} /> VER MENSAGEM
                                        </button>
                                    </div>
                                );
                            })}

                            {clientsWithWhatsApp.length === 0 && (
                                <div className="text-center py-20 text-slate-400">
                                    <p>Nenhum cliente com WhatsApp encontrado.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* PREVIEW MODAL */}
            {previewClientData && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewClientData(null)}>
                    <div
                        className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border-4 border-slate-900 relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Phone Notion Header */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-20" />

                        {/* WhatsApp Header */}
                        <div className="bg-[#075E54] pt-8 pb-3 px-4 text-white flex items-center gap-3 shadow-md relative z-10">
                            <button onClick={() => setPreviewClientData(null)}>
                                <ArrowLeft size={20} />
                            </button>
                            <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold overflow-hidden border border-white/20">
                                👤
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm truncate">{previewClientData.name}</h3>
                                <p className="text-[10px] text-white/80 truncate">visto por último hoje às 14:30</p>
                            </div>
                            <div className="flex gap-4">
                                <span className="opacity-80">📹</span>
                                <span className="opacity-80">📞</span>
                                <span className="opacity-80">⋮</span>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div className="h-[400px] bg-[#E5DDD5] overflow-y-auto p-4 flex flex-col relative" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'soft-light' }}>

                            <div className="bg-[#dcf8c6] p-3 rounded-lg rounded-tr-none shadow-sm self-end max-w-[85%] relative mb-4 animate-slide-up">
                                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                                    {previewMessageText}
                                </p>
                                <div className="text-[10px] text-slate-500 text-right mt-1 flex items-center justify-end gap-1">
                                    15:45 <span className="text-blue-500">✓✓</span>
                                </div>

                                {/* Tail */}
                                <svg className="absolute top-0 -right-2 w-3 h-3 text-[#dcf8c6] fill-current" viewBox="0 0 10 10">
                                    <path d="M0,0 L10,0 L0,10 Z" />
                                </svg>
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview Real</p>
                                <p className="text-xs font-black text-orange-600">THIAGO 704</p>
                            </div>
                            <button
                                onClick={() => setPreviewClientData(null)}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                FECHAR
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
};

export default CarnavalCampaign;
