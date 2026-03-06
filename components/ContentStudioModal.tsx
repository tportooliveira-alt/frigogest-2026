// ═══ CONTENT STUDIO MODAL — FrigoGest 2026 ═══
// Modal de aprovação: dono vê imagem + copy antes de qualquer envio
// Isabela gera → dono aprova → WhatsApp abre com mensagem pronta

import React, { useState } from 'react';
import { GeneratedContent } from '../services/contentStudioService';
import { generateWhatsAppLink } from '../services/actionParserService';
import {
    Sparkles, CheckCircle2, X, MessageCircle, Copy, Download,
    Instagram, RefreshCw, Loader2, Image as ImageIcon, AlertCircle
} from 'lucide-react';

interface ContentStudioModalProps {
    content: GeneratedContent;
    onClose: () => void;
    onRegenerate: () => void;
    isRegenerating?: boolean;
}

const ContentStudioModal: React.FC<ContentStudioModalProps> = ({
    content, onClose, onRegenerate, isRegenerating = false
}) => {
    const [copyTab, setCopyTab] = useState<'whatsapp' | 'instagram'>('whatsapp');
    const [copied, setCopied] = useState(false);
    const [whatsappSent, setWhatsappSent] = useState(false);

    const handleCopy = async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadImage = () => {
        if (!content.imageUrl) return;
        const a = document.createElement('a');
        a.href = content.imageUrl;
        a.download = `frigogest-${content.type.toLowerCase()}-${Date.now()}.jpg`;
        a.click();
    };

    const handleWhatsApp = () => {
        const phone = content.clientPhone || '';
        const msg = content.copyWhatsApp + '\n\n' + content.hashtags;
        if (phone) {
            window.open(generateWhatsAppLink(phone, content.copyWhatsApp), '_blank');
        } else {
            // Sem número específico: abre WhatsApp Web sem destinatário
            window.open(`https://wa.me/?text=${encodeURIComponent(content.copyWhatsApp)}`, '_blank');
        }
        setWhatsappSent(true);
    };

    const typeLabels: Record<string, string> = {
        PROMO_ESCASSEZ: '🔥 Promoção Relâmpago',
        REATIVACAO: '💌 Reativação de Cliente',
        LANCAMENTO: '🚀 Lançamento',
        COMBO: '📦 Oferta Combo',
        BASTIDORES: '🎬 Bastidores',
        DICA_TECNICA: '💡 Dica Técnica',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-[#0f1117] border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-r from-fuchsia-900/30 to-purple-900/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
                            <Sparkles size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">Isabela — Content Studio</p>
                            <p className="text-white font-bold text-sm">{typeLabels[content.type] || 'Conteúdo Gerado'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-5">

                    {/* IMAGEM GERADA */}
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <ImageIcon size={12} /> Imagem Gerada
                        </p>
                        <div className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10 aspect-square max-h-64 flex items-center justify-center">
                            {isRegenerating ? (
                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                    <Loader2 size={32} className="animate-spin text-fuchsia-400" />
                                    <p className="text-[11px] font-bold">Gerando nova imagem...</p>
                                </div>
                            ) : content.imageUrl ? (
                                <>
                                    <img
                                        src={content.imageUrl}
                                        alt={content.subject}
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        onClick={handleDownloadImage}
                                        className="absolute bottom-3 right-3 p-2.5 rounded-xl bg-black/60 backdrop-blur-sm border border-white/20 hover:bg-black/80 transition-all"
                                        title="Baixar imagem"
                                    >
                                        <Download size={14} className="text-white" />
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-slate-500 p-8 text-center">
                                    <AlertCircle size={28} />
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400">Imagem não gerada</p>
                                        <p className="text-[10px] text-slate-600 mt-1">Verifique a chave VITE_AI_API_KEY no .env</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COPY */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex-1">Copy Pronto</p>
                            <div className="flex bg-white/5 rounded-lg p-0.5">
                                <button
                                    onClick={() => setCopyTab('whatsapp')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${copyTab === 'whatsapp' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    📱 WhatsApp
                                </button>
                                <button
                                    onClick={() => setCopyTab('instagram')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${copyTab === 'instagram' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    📸 Instagram
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                                {copyTab === 'whatsapp' ? content.copyWhatsApp : content.copyInstagram}
                            </p>
                            {copyTab === 'instagram' && (
                                <p className="text-fuchsia-400/70 text-[11px] mt-3 pt-3 border-t border-white/5 leading-relaxed">
                                    {content.hashtags}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* AVISO DE APROVAÇÃO */}
                    {!whatsappSent && (
                        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-amber-400 text-[11px] font-black uppercase tracking-wider">Aguardando sua aprovação</p>
                                <p className="text-amber-400/70 text-[11px] mt-1">
                                    {content.clientName
                                        ? `Revise o conteúdo antes de enviar para ${content.clientName}.`
                                        : 'Revise o conteúdo antes de publicar ou enviar.'}
                                    {' '}Nada foi enviado ainda.
                                </p>
                            </div>
                        </div>
                    )}

                    {whatsappSent && (
                        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <p className="text-emerald-400 text-[11px] font-black">WhatsApp aberto — finalize o envio no app! ✅</p>
                        </div>
                    )}

                    {/* AÇÕES */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                            onClick={onRegenerate}
                            disabled={isRegenerating}
                            className="px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/10 transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                            Gerar de Novo
                        </button>
                        <button
                            onClick={() => handleCopy(copyTab === 'whatsapp' ? content.copyWhatsApp : content.copyInstagram + '\n\n' + content.hashtags)}
                            className="px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                        >
                            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                            {copied ? 'Copiado!' : 'Copiar Texto'}
                        </button>
                        <button
                            onClick={handleWhatsApp}
                            className="col-span-2 px-4 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[12px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-900/30"
                        >
                            <MessageCircle size={16} />
                            {content.clientName ? `✅ Aprovar e Enviar para ${content.clientName}` : '✅ Aprovar e Abrir WhatsApp'}
                        </button>
                    </div>

                    <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                        Gerado em {content.generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Nada é enviado sem sua aprovação
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ContentStudioModal;
