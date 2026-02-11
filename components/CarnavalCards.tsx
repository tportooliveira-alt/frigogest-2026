import React, { useRef, useState } from 'react';
import { ArrowLeft, Download, Sun, Coffee, Edit3, Wand2, Palette, Sparkles, Image as ImageIcon, Share2, Copy, Check, User, FolderDown, MessageCircle } from 'lucide-react';
import html2canvas from 'html2canvas';

import { Client } from '../types';

interface CarnavalCardsProps {
    onBack: () => void;
    clients?: Client[];
}

const CarnavalCards: React.FC<CarnavalCardsProps> = ({ onBack, clients = [] }) => {
    const cardRef1 = useRef<HTMLDivElement>(null);
    const cardRef2 = useRef<HTMLDivElement>(null);
    const cardRef3 = useRef<HTMLDivElement>(null);
    const cardRefWeek1 = useRef<HTMLDivElement>(null);
    const cardRefWeek2 = useRef<HTMLDivElement>(null);
    const cardRefAI = useRef<HTMLDivElement>(null);

    const [clientName, setClientName] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatedCard, setGeneratedCard] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // MODAL: Imagem final gerada
    const [showModal, setShowModal] = useState(false);
    const [finalImageSrc, setFinalImageSrc] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState('');
    const [copiedOk, setCopiedOk] = useState(false);

    // ========================================
    // FUNÇÃO PRINCIPAL: Gera a imagem e abre o modal
    // ========================================
    const gerarEAbrir = async (ref: React.RefObject<HTMLDivElement>, nomeArquivo: string) => {
        if (!ref.current) return;

        setIsProcessing(true);
        setShowModal(true);
        setFinalImageSrc(null);
        setSavedMessage('');
        setCopiedOk(false);

        try {
            await new Promise(r => setTimeout(r, 300));

            const canvas = await html2canvas(ref.current, {
                scale: 3,
                backgroundColor: null,
                useCORS: true,
                allowTaint: true,
                logging: false,
            });

            const dataUrl = canvas.toDataURL('image/png', 1.0);
            setFinalImageSrc(dataUrl);
        } catch (err) {
            console.error('Erro ao gerar:', err);
            alert('Erro ao gerar a imagem.');
            setShowModal(false);
        } finally {
            setIsProcessing(false);
        }
    };

    // ========================================
    // SALVAR NA PASTA DOWNLOADS
    // ========================================
    const salvarNaPasta = () => {
        if (!finalImageSrc) return;
        const nome = clientName ? clientName.replace(/[^a-z0-9]/gi, '_') : 'thiago704';
        const fileName = `cartao_${nome}_${Date.now()}.png`;

        const link = document.createElement('a');
        link.href = finalImageSrc;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSavedMessage(`✅ Salvo na pasta Downloads como "${fileName}"`);
    };

    // ========================================
    // COPIAR PARA ÁREA DE TRANSFERÊNCIA (Ctrl+V no WhatsApp)
    // ========================================
    const copiarImagem = async () => {
        if (!finalImageSrc) return;
        try {
            const res = await fetch(finalImageSrc);
            const blob = await res.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
            setCopiedOk(true);
            setTimeout(() => setCopiedOk(false), 3000);
        } catch (err) {
            console.error('Erro ao copiar:', err);
            alert('Não foi possível copiar. Tente "Salvar" e depois anexe no WhatsApp.');
        }
    };

    // ========================================
    // COMPARTILHAR (Mobile - abre direto o WhatsApp)
    // ========================================
    const compartilhar = async () => {
        if (!finalImageSrc) return;
        try {
            const res = await fetch(finalImageSrc);
            const blob = await res.blob();
            const nome = clientName ? clientName.replace(/[^a-z0-9]/gi, '_') : 'thiago704';
            const file = new File([blob], `cartao_${nome}.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Cartão Carnaval',
                    text: `Feliz Carnaval, ${clientName || 'amigo'}! 🎭`
                });
            } else {
                alert('Compartilhamento direto não disponível neste dispositivo.\n\nUse "SALVAR" para baixar a imagem, depois envie pelo WhatsApp.');
            }
        } catch (err) {
            console.error('Erro:', err);
        }
    };

    // ========================================
    // IA LOCAL: Gera estilos por palavra-chave
    // ========================================
    const handleGenerateAI = () => {
        if (!aiPrompt) return;
        setIsGenerating(true);
        setTimeout(() => {
            const p = aiPrompt.toLowerCase();
            let s: any = { bg: 'bg-white', icon: <Sparkles size={48} />, title: 'BOAS FESTAS', subtitle: 'Aproveite!', textColor: 'text-slate-800', borderColor: 'border-slate-200' };

            if (p.includes('boi') || p.includes('gado') || p.includes('carne'))
                s = { bg: 'bg-gradient-to-br from-emerald-800 to-slate-900', icon: <div className="text-5xl">🐂</div>, title: 'QUALIDADE', subtitle: 'O melhor para sua família', textColor: 'text-emerald-100', borderColor: 'border-emerald-600' };
            else if (p.includes('festa') || p.includes('alegria') || p.includes('carnaval'))
                s = { bg: 'bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500', icon: <div className="text-5xl">🎭</div>, title: 'FOLIA TOTAL', subtitle: 'Curta cada momento!', textColor: 'text-white', borderColor: 'border-white/50' };
            else if (p.includes('azul') || p.includes('céu') || p.includes('paz'))
                s = { bg: 'bg-gradient-to-b from-sky-400 to-blue-600', icon: <div className="text-5xl">☁️</div>, title: 'TRANQUILIDADE', subtitle: 'Paz e sossego', textColor: 'text-white', borderColor: 'border-blue-300' };
            else if (p.includes('ouro') || p.includes('luxo') || p.includes('rico'))
                s = { bg: 'bg-[#1a1a1a]', icon: <div className="text-5xl">👑</div>, title: 'EXCLUSIVO', subtitle: 'Você merece o melhor', textColor: 'text-[#D4AF37]', borderColor: 'border-[#D4AF37]' };
            else if (p.includes('amor') || p.includes('carinho'))
                s = { bg: 'bg-gradient-to-r from-rose-400 to-red-500', icon: <div className="text-5xl">❤️</div>, title: 'COM CARINHO', subtitle: 'Da nossa família para a sua', textColor: 'text-white', borderColor: 'border-rose-200' };

            setGeneratedCard(s);
            setIsGenerating(false);
        }, 1000);
    };

    // ========================================
    // RENDER
    // ========================================
    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans pb-32 relative">

            {/* ============ MODAL: IMAGEM PRONTA ============ */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center p-4 overflow-y-auto">
                    <div className="w-full max-w-lg my-auto">

                        {/* Título */}
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-white text-lg font-black flex items-center gap-2">
                                {isProcessing ? <Sparkles className="animate-spin text-yellow-400" size={20} /> : <Check className="text-green-400" size={20} />}
                                {isProcessing ? 'Gerando...' : 'Imagem Pronta!'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white p-2">
                                <ArrowLeft size={20} />
                            </button>
                        </div>

                        {/* A IMAGEM */}
                        <div className="bg-white/5 rounded-2xl p-3 mb-4 min-h-[250px] flex items-center justify-center border border-white/10">
                            {isProcessing ? (
                                <div className="text-white/50 text-center">
                                    <Sparkles className="animate-spin mx-auto mb-2" size={32} />
                                    <p className="text-sm">Criando sua arte em alta qualidade...</p>
                                </div>
                            ) : finalImageSrc ? (
                                <img src={finalImageSrc} alt="Cartão" className="max-h-[50vh] w-auto rounded-lg shadow-2xl" />
                            ) : (
                                <p className="text-red-400">Erro. Tente novamente.</p>
                            )}
                        </div>

                        {/* BOTÕES DE AÇÃO (só aparecem quando a imagem está pronta) */}
                        {finalImageSrc && !isProcessing && (
                            <div className="space-y-3">

                                {/* BOTÃO 1: SALVAR NA PASTA DOWNLOADS */}
                                <button onClick={salvarNaPasta} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95">
                                    <FolderDown size={24} /> SALVAR NA PASTA
                                </button>
                                {savedMessage && (
                                    <div className="bg-green-900/50 text-green-300 text-sm p-3 rounded-xl border border-green-700 font-bold text-center animate-fade-in">
                                        {savedMessage}
                                        <br /><span className="text-green-500/70 text-xs">Agora abra o WhatsApp e envie como imagem!</span>
                                    </div>
                                )}

                                {/* BOTÃO 2: COPIAR (Cola no WhatsApp Web com Ctrl+V) */}
                                <button onClick={copiarImagem} className={`w-full py-3 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 ${copiedOk ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`}>
                                    {copiedOk ? <><Check size={20} /> COPIADO! Cole no WhatsApp (Ctrl+V)</> : <><Copy size={20} /> COPIAR IMAGEM</>}
                                </button>

                                {/* BOTÃO 3: COMPARTILHAR (Mobile) */}
                                <button onClick={compartilhar} className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95">
                                    <MessageCircle size={20} /> ENVIAR VIA WHATSAPP
                                </button>

                                <p className="text-white/30 text-center text-[11px] mt-2">
                                    💡 <strong>Dica:</strong> Clique em "Salvar na Pasta", depois abra o WhatsApp e envie a imagem que estará na pasta <strong>Downloads</strong>.
                                </p>
                            </div>
                        )}

                        {/* Fechar */}
                        <button onClick={() => setShowModal(false)} className="w-full mt-4 text-white/40 text-sm font-bold hover:text-white transition-colors py-2">
                            ← Voltar
                        </button>
                    </div>
                </div>
            )}

            {/* ============ HEADER ============ */}
            <div className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="bg-white/80 backdrop-blur-sm p-3 rounded-full shadow-sm hover:bg-white transition-all border border-slate-200">
                            <ArrowLeft size={24} className="text-slate-600" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-2">
                                <Palette className="text-orange-500" size={28} /> ATELIÊ CRIATIVO
                            </h1>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Thiago 704</p>
                        </div>
                    </div>

                    <div className="w-full md:w-auto relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <User size={20} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Nome do Cliente..."
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="pl-12 pr-6 py-4 w-full md:w-80 rounded-2xl border-2 border-slate-200 bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all font-black text-slate-700 shadow-lg placeholder:text-slate-400 text-lg"
                        />
                    </div>
                </div>

                {/* ============ SEÇÃO IA ============ */}
                <div className="mb-12 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 shadow-2xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-10"><Wand2 size={180} /></div>
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                        <div>
                            <h2 className="text-3xl font-black mb-4">Crie com IA 🎨</h2>
                            <p className="text-white/70 mb-6">Digite: "boi", "luxo", "festa", "amor", "azul"...</p>
                            <div className="flex gap-2">
                                <input
                                    type="text" placeholder="Ex: festa luxo..."
                                    value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateAI()}
                                    className="flex-1 px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-bold outline-none focus:bg-white/20 placeholder:text-white/40"
                                />
                                <button onClick={handleGenerateAI} disabled={isGenerating || !aiPrompt}
                                    className="bg-white text-purple-600 px-6 py-3 rounded-xl font-black disabled:opacity-50 flex items-center gap-2">
                                    {isGenerating ? <Sparkles className="animate-spin" /> : <Wand2 />} CRIAR
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            {generatedCard ? (
                                <div className="flex flex-col gap-3 w-full max-w-[280px]">
                                    <div ref={cardRefAI} data-card-id="arte_ia"
                                        className={`aspect-[4/5] rounded-2xl p-6 flex flex-col items-center justify-between text-center border-4 shadow-2xl ${generatedCard.bg} ${generatedCard.borderColor}`}>
                                        <div className="mt-6">
                                            <div className="mb-3">{generatedCard.icon}</div>
                                            <h3 className={`font-black text-2xl ${generatedCard.textColor}`}>
                                                {clientName ? clientName.toUpperCase() : generatedCard.title}
                                            </h3>
                                        </div>
                                        <p className={`text-base opacity-90 ${generatedCard.textColor}`}>{generatedCard.subtitle}</p>
                                        <img src="/logo-thiago704-premium.png" alt="THIAGO 704" className="h-12 object-contain mt-auto mx-auto opacity-90" />
                                    </div>
                                    <button onClick={() => gerarEAbrir(cardRefAI, 'arte_ia')}
                                        className="bg-white text-purple-900 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-purple-50 shadow-lg w-full">
                                        <FolderDown size={18} /> SALVAR / ENVIAR
                                    </button>
                                </div>
                            ) : (
                                <div className="aspect-[4/5] w-64 bg-white/10 border-2 border-dashed border-white/30 rounded-2xl flex flex-col items-center justify-center text-white/40 p-6 text-center">
                                    <ImageIcon size={40} className="mb-3 opacity-50" />
                                    <p className="font-bold text-sm">Sua arte aqui</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ============ MODELOS PRONTOS ============ */}
                <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                    <Sun className="text-orange-500" size={24} /> MODELOS PRONTOS
                </h2>
                <p className="text-slate-500 mb-8 font-medium">Clique no cartão para <strong>Salvar</strong> ou <strong>Enviar</strong>.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">

                    {/* CARD 1: LUXO */}
                    <div className="cursor-pointer group" onClick={() => gerarEAbrir(cardRef1, 'luxo')}>
                        <div ref={cardRef1} data-card-id="luxo" className="aspect-[4/5] bg-[#0F172A] p-6 flex flex-col items-center justify-center text-center border-[5px] border-[#D4AF37] rounded-xl overflow-hidden shadow-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl relative">
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#D4AF37 1px, transparent 1px)', backgroundSize: '12px 12px' }}></div>
                            <div className="z-10 relative">
                                {clientName && <h3 className="text-[#D4AF37] text-lg font-serif mb-1 tracking-widest">{clientName}</h3>}
                                <h2 className="text-white font-serif text-4xl mb-1">BOAS</h2>
                                <h2 className="text-[#D4AF37] font-serif text-4xl mb-4">FESTAS</h2>
                                <div className="w-10 h-0.5 bg-[#D4AF37] mx-auto mb-4"></div>
                                <img src="/logo-thiago704-premium.png" alt="THIAGO 704" className="h-10 object-contain mt-auto opacity-90 mx-auto" />
                            </div>
                        </div>
                        <p className="text-center text-slate-400 text-xs mt-2 font-bold group-hover:text-orange-500 transition-colors">Clique para Salvar ↗</p>
                    </div>

                    {/* CARD 2: FESTIVO */}
                    <div className="cursor-pointer group" onClick={() => gerarEAbrir(cardRef2, 'festivo')}>
                        <div ref={cardRef2} data-card-id="festivo" className="aspect-[4/5] bg-gradient-to-tr from-yellow-400 via-red-500 to-pink-500 p-5 flex flex-col items-center justify-center text-center rounded-xl shadow-xl transition-all duration-300 group-hover:-translate-y-1 border-4 border-white">
                            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl border border-white/30 w-full h-full flex flex-col justify-center items-center">
                                {clientName && <div className="bg-white text-pink-600 px-3 py-0.5 rounded-full font-black text-sm mb-2">{clientName}!</div>}
                                <h2 className="text-white font-black text-3xl mb-1 drop-shadow-md">FELIZ</h2>
                                <h2 className="text-yellow-200 font-black text-4xl mb-3 drop-shadow-md">CARNAVAL</h2>
                                <div className="bg-white px-2 py-1 rounded-lg mt-auto shadow-sm">
                                    <img src="/logo-thiago704-premium.png" alt="THIAGO 704" className="h-6 object-contain" />
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-slate-400 text-xs mt-2 font-bold group-hover:text-orange-500 transition-colors">Clique para Salvar ↗</p>
                    </div>

                    {/* CARD 3: CLEAN */}
                    <div className="cursor-pointer group" onClick={() => gerarEAbrir(cardRef3, 'clean')}>
                        <div ref={cardRef3} data-card-id="clean" className="aspect-[4/5] bg-white p-6 flex flex-col items-center justify-between text-center border border-slate-200 rounded-xl shadow-xl transition-all duration-300 group-hover:-translate-y-1">
                            <div className="w-10 h-1 bg-slate-800 mx-auto"></div>
                            <div className="my-auto">
                                {clientName && <h3 className="text-slate-500 font-bold text-base mb-1">{clientName},</h3>}
                                <h2 className="text-slate-900 font-black text-3xl leading-tight">BOM<br />DESCANSO</h2>
                            </div>
                            <img src="/logo-thiago704-premium.png" alt="THIAGO 704" className="h-10 object-contain mx-auto mt-4 opacity-90" />
                        </div>
                        <p className="text-center text-slate-400 text-xs mt-2 font-bold group-hover:text-orange-500 transition-colors">Clique para Salvar ↗</p>
                    </div>

                    {/* CARD 4: FDS AZUL */}
                    <div className="cursor-pointer group" onClick={() => gerarEAbrir(cardRefWeek1, 'fds_azul')}>
                        <div ref={cardRefWeek1} data-card-id="fds_azul" className="aspect-[4/5] bg-blue-600 p-6 flex flex-col items-center justify-center text-center rounded-xl shadow-xl transition-all duration-300 group-hover:-translate-y-1 overflow-hidden relative">
                            <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-400 rounded-full blur-2xl opacity-50"></div>
                            <div className="relative z-10 border-2 border-blue-400/40 p-4 rounded-lg w-full h-full flex flex-col justify-center items-center">
                                {clientName && <h3 className="text-blue-200 font-bold text-lg mb-3">{clientName}</h3>}
                                <h2 className="text-white font-black text-3xl mb-1">ÓTIMO</h2>
                                <h2 className="text-blue-200 font-black text-3xl leading-none">FIM DE<br />SEMANA</h2>
                                <div className="bg-white px-2 py-1 rounded mt-auto shadow-sm">
                                    <img src="/logo-thiago704-premium.png" alt="THIAGO 704" className="h-6 object-contain" />
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-slate-400 text-xs mt-2 font-bold group-hover:text-orange-500 transition-colors">Clique para Salvar ↗</p>
                    </div>

                    {/* CARD 5: FDS CLEAN */}
                    <div className="cursor-pointer group" onClick={() => gerarEAbrir(cardRefWeek2, 'fds_clean')}>
                        <div ref={cardRefWeek2} data-card-id="fds_clean" className="aspect-[4/5] bg-[#f5f5f7] p-6 flex flex-col items-center justify-between text-center border-2 border-slate-200 rounded-xl shadow-xl transition-all duration-300 group-hover:-translate-y-1">
                            <div className="mt-4">
                                <Coffee size={36} className="text-slate-400 mx-auto mb-3" />
                                {clientName && <h2 className="text-slate-600 font-bold text-lg mb-0.5">{clientName},</h2>}
                                <h2 className="text-slate-800 font-serif text-3xl italic">Bom Descanso</h2>
                            </div>
                            <p className="text-slate-600 font-medium text-base leading-relaxed">"Que seu fim de semana<br />seja revigorante!"</p>
                            <div className="mb-2">
                                <div className="h-px w-16 bg-slate-300 mx-auto mb-3"></div>
                                <img src="/logo-thiago704-premium.png" alt="THIAGO 704" className="h-10 object-contain mx-auto" />
                            </div>
                        </div>
                        <p className="text-center text-slate-400 text-xs mt-2 font-bold group-hover:text-orange-500 transition-colors">Clique para Salvar ↗</p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CarnavalCards;
