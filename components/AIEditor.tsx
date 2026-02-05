import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import {
    ArrowLeft,
    Upload,
    Wand2,
    Download,
    Image as ImageIcon,
    Loader2,
    Sparkles,
    AlertCircle,
    Palette,
    Activity,
    Zap,
    Layers,
    Type,
    Frame,
    ChevronRight,
    Search
} from 'lucide-react';

interface AIEditorProps {
    onBack: () => void;
}

const AIEditor: React.FC<AIEditorProps> = ({ onBack }) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'edit' | 'logo'>('edit');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const quickPrompts = mode === 'edit' ?
        ["Remover fundo", "Melhorar iluminação", "Etiqueta 'OFERTA'", "Mesa rústica"] :
        ["Logo touro preto/ouro", "Logo moderno vermelho", "Logo rústico fazenda", "Escudo premium boi"];

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSelectedImage(event.target?.result as string);
                setGeneratedImage(null);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (mode === 'edit' && !selectedImage) return setError("Selecione uma imagem de base");
        if (!prompt.trim()) return setError("Descreva o que deseja criar");
        setLoading(true); setError(null);
        try {
            const apiKey = (import.meta as any).env.VITE_AI_API_KEY || (process.env as any).API_KEY;
            const ai = new GoogleGenAI({ apiKey });
            let contents = mode === 'edit' ?
                { parts: [{ inlineData: { data: selectedImage!.split(',')[1], mimeType: selectedImage!.split(';')[0].split(':')[1] } }, { text: `Edit: ${prompt}` }] } :
                { parts: [{ text: `Create professional agro logo: ${prompt}. High quality, isolated background.` }] };

            const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents,
                config: { imageConfig: { aspectRatio: "1:1" } }
            });

            let found = false;
            if (res.candidates?.[0].content?.parts) {
                for (const part of res.candidates[0].content.parts) {
                    if (part.inlineData) {
                        setGeneratedImage(`data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`);
                        found = true;
                        break;
                    }
                }
            }
            if (!found) setError("A IA não retornou uma imagem. Tente novamente.");
        } catch (err) {
            setError("Erro na conexão com o motor neural.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20 font-sans">

            {/* PREMIUM HEADER - CREATIVE EDITION */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex flex-col gap-4">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-700 hover:border-blue-100 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar ao Início
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="bg-slate-900 p-3 rounded-2xl text-blue-400 shadow-xl shadow-blue-900/40">
                            <Wand2 size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                Creative <span className="text-blue-600">Studio</span>
                            </h1>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                Motor Gráfico Neural / ID-IMG
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => { setMode('edit'); setGeneratedImage(null); }}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${mode === 'edit' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        Edição de Fonte
                    </button>
                    <button
                        onClick={() => { setMode('logo'); setGeneratedImage(null); }}
                        className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${mode === 'logo' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        Gerador de Logos
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8 h-full">
                    {mode === 'edit' && (
                        <div className="premium-card p-10 bg-white">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                                <ImageIcon size={16} className="text-blue-600" /> 1. Buffer de Imagem Base
                            </h3>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative w-full aspect-video rounded-[32px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center cursor-pointer hover:border-blue-600 transition-all overflow-hidden group bg-slate-50/30"
                            >
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                {selectedImage ? (
                                    <img src={selectedImage} alt="src" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-center group-hover:scale-110 transition-all">
                                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-slate-300 group-hover:text-blue-600">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregar arquivo local</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="premium-card p-10 bg-white space-y-8">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={16} className="text-blue-600" /> 2. Descritor da Transformação
                        </h3>
                        <div className="relative">
                            <div className="absolute top-4 left-4 text-blue-500/20"><Type size={18} /></div>
                            <textarea
                                className="w-full h-32 modern-input p-10 text-sm font-medium text-slate-700 bg-slate-50/30"
                                placeholder="Descreva as modificações ou o design desejado..."
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {quickPrompts.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPrompt(p)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all shadow-sm"
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        {error && (
                            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}
                        <button
                            onClick={handleGenerate}
                            disabled={loading || (mode === 'edit' && !selectedImage) || !prompt}
                            className="w-full btn-modern bg-slate-900 text-white py-6 rounded-2xl hover:bg-blue-600 shadow-xl shadow-slate-900/40 gap-4 disabled:opacity-20 transition-all font-black text-xs uppercase tracking-[0.4em]"
                        >
                            {loading ? <Activity size={20} className="animate-spin" /> : <Zap size={20} />}
                            {loading ? 'Processando Redes...' : 'Gerar Criação'}
                        </button>
                    </div>
                </div>

                <div className="premium-card p-0 overflow-hidden bg-white border border-slate-100 flex flex-col min-h-[600px] shadow-2xl">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={16} className="text-emerald-600" /> 3. Resultado de Saída
                        </h3>
                        {generatedImage && (
                            <button
                                onClick={() => {
                                    const l = document.createElement('a');
                                    l.href = generatedImage;
                                    l.download = 'FG_CREATION.png';
                                    l.click();
                                }}
                                className="btn-modern bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 gap-2 shadow-lg"
                            >
                                <Download size={14} /> Salvar Vínculo
                            </button>
                        )}
                    </div>
                    <div className="flex-1 bg-[#fafafa] flex items-center justify-center p-12 overflow-hidden relative">
                        {loading ? (
                            <div className="text-center relative z-10">
                                <div className="w-20 h-20 bg-white rounded-[32px] shadow-xl flex items-center justify-center mx-auto mb-6 relative overflow-hidden">
                                    <Activity size={40} className="animate-spin text-blue-600" />
                                    <div className="absolute inset-0 bg-blue-600/5 animate-pulse" />
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] animate-pulse">Renderizando Visão...</p>
                            </div>
                        ) : generatedImage ? (
                            <div className="relative group/view w-full h-full flex items-center justify-center">
                                <img src={generatedImage} alt="gen" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl relative z-10" />
                                <div className="absolute inset-0 bg-blue-600/20 blur-[100px] opacity-20" />
                            </div>
                        ) : (
                            <div className="text-center opacity-10 grayscale group">
                                <Palette size={100} className="mx-auto mb-6 group-hover:scale-110 transition-transform" />
                                <p className="text-xs font-black uppercase tracking-[0.8em]">Aguardando Dados</p>
                            </div>
                        )}
                        <div className="absolute bottom-6 left-6 text-[8px] font-black text-slate-200 uppercase tracking-[0.4em]">FG-RENDER-CORE v2.5</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIEditor;
