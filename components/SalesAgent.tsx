import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Bot,
    Send,
    Settings,
    MessageCircle,
    Play,
    Save,
    RefreshCw,
    Calendar,
    Smartphone,
    Image as ImageIcon,
    Upload,
    Mic,
    CheckCircle,
    ArrowLeft,
    Trash2,
    X,
    ChevronRight,
    Activity,
    Zap,
    ShieldCheck,
    Cpu,
    Target,
    Waves,
    Globe,
    Terminal,
    Sparkles,
    DollarSign,
    Package,
    User,
    Filter,
    Users,
    AlertTriangle,
    Crown,
    Clock,
    Phone,
    ExternalLink,
    Copy,
    Rocket,
    Heart,
    TrendingUp,
    ShoppingCart
} from 'lucide-react';
import { Client, Sale, StockItem, Batch } from '../types';
import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendWhatsAppMessage, sendWhatsAppMedia, checkWhatsAppAPIStatus, sendBulkMessages } from '../utils/whatsappAPI';

interface SalesAgentProps {
    onBack?: () => void;
    clients: Client[];
}

const SalesAgent: React.FC<SalesAgentProps> = ({ onBack, clients }) => {
    const [activeTab, setActiveTab] = useState<'config' | 'test' | 'voice' | 'campaign'>('config');

    // Campaign State
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [isCampaignRunning, setIsCampaignRunning] = useState(false);
    const [currentCampaignIndex, setCurrentCampaignIndex] = useState(0);
    const [preparedMessages, setPreparedMessages] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'selection' | 'review'>('selection');

    // Intelligent Agents State
    const [agents] = useState([
        { id: 'vendas', name: 'BOIADEIRO_DIGITAL', prompt: 'Você é o "Boiadeiro Digital", focado em vendas de gado. Seu tom é rústico e negociador. Use gírias do campo.' },
        { id: 'cobranca', name: 'AGENTE_COBRANÇA', prompt: 'Você é um assistente financeiro educado, mas firme. Seu objetivo é lembrar o cliente sobre pagamentos pendentes, oferecendo opções de PIX.' },
        { id: 'sac', name: 'SUPORTE_FG_CORE', prompt: 'Você é o suporte ao cliente. Tire dúvidas sobre entregas e notas fiscais com muita paciência e educação.' }
    ]);
    const [activeAgentId, setActiveAgentId] = useState('vendas');
    const [knowledgeBase, setKnowledgeBase] = useState({ price: 'R$ 210,00', stock: '500 cabeças', delivery: '3 DIAS ÚTEIS', payment: 'À VISTA / 30 DIAS' });
    const [deliveryMode, setDeliveryMode] = useState<'manual' | 'auto'>('manual');
    const [aiPersona, setAiPersona] = useState(agents[0].prompt);

    useEffect(() => {
        setAiPersona(agents.find(a => a.id === activeAgentId)?.prompt || '');
    }, [activeAgentId, agents]);

    // Media & Voice State
    const [mediaUrl, setMediaUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [audioBlobs, setAudioBlobs] = useState<Record<string, string>>({});
    const [isRecording, setIsRecording] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Chat Sim State
    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [userSimInput, setUserSimInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [apiInstance] = useState('6728'); // Simulated
    const [apiToken] = useState('TOKEN_B838'); // Simulated

    const gerarMensagemIA = (nomeCliente: string) => {
        if (activeAgentId === 'vendas') {
            const templates = [
                `Olá *${nomeCliente}*! 👋\n\n🥩 *OFERTA ESPECIAL DO DIA*\n\nEstoque fresco, gado premium:\n💰 Preço: *${knowledgeBase.price}*\n📦 Disponível: ${knowledgeBase.stock}\n🚚 Entrega: ${knowledgeBase.delivery}\n\nGaranta já! Estoque limitado. 🔥`,

                `Boa tarde, *${nomeCliente}*! 🐂\n\n*Acabou de chegar:*\nLote premium com acabamento perfeito\n\n✅ Qualidade garantida\n💵 Condições especiais: ${knowledgeBase.payment}\n📍 Entrega em ${knowledgeBase.delivery}\n\nInteresse? Responda aqui! 📱`,

                `*${nomeCliente}*, oportunidade! 🎯\n\n🥩 Carne de primeira\n💰 *${knowledgeBase.price}* /kg\n📦 Lote de ${knowledgeBase.stock}\n\nPreço para CLIENTE VIP!\nReservo para você? 🤝`
            ];
            const template = templates[Math.floor(Math.random() * templates.length)];
            return template;
        } else if (activeAgentId === 'cobranca') {
            return `Olá *${nomeCliente}*! 👋\n\n📋 *Lembrete Amigável*\n\nIdentificamos um pagamento pendente em nossa base.\n\n💡 *Formas de pagamento:*\n• PIX (instantâneo)\n• Transferência bancária\n• Boleto\n\nPrecisa de ajuda? Estamos à disposição! 🤝\n\nAtenciosamente,\nEquipe FrigoGest`;
        } else {
            return `Olá *${nomeCliente}*! 👋\n\nComo podemos ajudar hoje?\n\n📞 Suporte FrigoGest\n⏰ Atendimento: Seg-Sex, 8h-18h`;
        }
    };

    const handleManualSend = async (phone: string, message: string) => {
        // Se tiver mídia (foto/vídeo), envia com mídia
        if (mediaUrl) {
            const mediaType = mediaUrl.includes('.mp4') || mediaUrl.includes('video') ? 'video' : 'image';
            const result = await sendWhatsAppMedia({
                phone,
                message,
                mediaUrl,
                mediaType
            });

            if (result.success) {
                alert('✅ Mensagem com mídia enviada!');
                return true;
            } else {
                alert('⚠️ Erro ao enviar: ' + result.error);
                return false;
            }
        }

        // Senão, envia só texto
        const result = await sendWhatsAppMessage(phone, message);

        if (result.success) {
            return true;
        } else {
            // Se a API falhar, abre WhatsApp Web como backup
            console.warn('Usando fallback: WhatsApp Web');
            window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
            return true;
        }
    };

    const startRecording = async (type: string) => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr; chunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => setAudioBlobs(prev => ({ ...prev, [type]: URL.createObjectURL(new Blob(chunksRef.current, { type: 'audio/mp3' })) }));
        mr.start(); setIsRecording(type);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); setIsRecording(null); }
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20 font-sans">

            {/* PREMIUM HEADER - AI EDITION */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex flex-col gap-4">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-700 hover:border-blue-100 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar ao Início
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="bg-slate-900 p-3 rounded-2xl text-blue-400 shadow-xl shadow-blue-900/40 relative group">
                            <Bot size={28} />
                            <div className="absolute inset-0 bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                Agente <span className="text-blue-600">Cognitivo</span>
                            </h1>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                Automação e Inteligência de Vendas / ID-AI
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                    <nav className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        {[
                            { id: 'config', icon: Settings, label: 'Parâmetros' },
                            { id: 'campaign', icon: Target, label: 'Campanha' },
                            { id: 'voice', icon: Waves, label: 'Voz/Media' },
                            { id: 'test', icon: MessageCircle, label: 'Simular' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                            >
                                <t.icon size={14} /> {t.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* MAIN INTERFACE */}
            <div className="max-w-7xl mx-auto">
                {activeTab === 'config' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-reveal">
                        <div className="lg:col-span-7 space-y-8">
                            <div className="premium-card p-10 bg-white">
                                <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-50">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Cpu size={16} className="text-blue-600" /> Núcleo de Personalidade
                                    </h3>
                                    <div className="flex gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                                    {agents.map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => setActiveAgentId(a.id)}
                                            className={`p-5 rounded-[24px] border-2 transition-all flex flex-col gap-3 text-left ${activeAgentId === a.id ? 'border-blue-600 bg-blue-50/30' : 'border-slate-50 bg-slate-50/20 hover:border-slate-200'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeAgentId === a.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-200 text-slate-400'}`}>
                                                {a.id === 'vendas' ? <Zap size={16} /> : a.id === 'cobranca' ? <DollarSign size={16} /> : <Activity size={16} />}
                                            </div>
                                            <div>
                                                <h4 className={`font-black text-[10px] uppercase tracking-tighter ${activeAgentId === a.id ? 'text-blue-600' : 'text-slate-400'}`}>{a.id}</h4>
                                                <p className={`font-bold text-xs ${activeAgentId === a.id ? 'text-slate-900' : 'text-slate-400'}`}>{a.name}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Instruções de Sistema (Prompt)</label>
                                    <div className="relative">
                                        <div className="absolute top-4 left-4 text-blue-500 opacity-20"><Terminal size={20} /></div>
                                        <textarea
                                            value={aiPersona}
                                            onChange={e => setAiPersona(e.target.value)}
                                            className="w-full h-40 modern-input p-10 font-medium text-slate-700 bg-slate-50/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="premium-card p-10 bg-white">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                                    <Globe size={16} className="text-blue-600" /> Protocolo de Conexão
                                </h3>
                                <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
                                    <button
                                        onClick={() => setDeliveryMode('manual')}
                                        className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${deliveryMode === 'manual' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        Disparo Individual (WA)
                                    </button>
                                    <button
                                        onClick={() => setDeliveryMode('auto')}
                                        className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${deliveryMode === 'auto' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        Z-API Automático
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Instância ID</label>
                                        <input type="text" placeholder="i.e. 6728" className="modern-input h-12 text-sm bg-slate-50/30" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Token de Acesso</label>
                                        <input type="password" placeholder="••••••••••••" className="modern-input h-12 text-sm bg-slate-50/30" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-5 space-y-8">
                            <div className="bg-slate-900 rounded-[40px] p-10 text-white relative shadow-2xl overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><Sparkles size={120} /></div>
                                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-10">Base de Conhecimento Dinâmica</h3>
                                <div className="space-y-8 relative z-10">
                                    {[
                                        { l: 'Preço de Referência (Arroba)', v: knowledgeBase.price, k: 'price', icon: DollarSign },
                                        { l: 'Capacidade em Estoque', v: knowledgeBase.stock, k: 'stock', icon: Package },
                                        { l: 'Prazo Logístico Médio', v: knowledgeBase.delivery, k: 'delivery', icon: Calendar },
                                        { l: 'Flexibilidade de Pagamento', v: knowledgeBase.payment, k: 'payment', icon: Activity }
                                    ].map(kb => (
                                        <div key={kb.k} className="group/item">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1 flex items-center gap-2">
                                                <kb.icon size={10} className="text-blue-500" /> {kb.l}
                                            </label>
                                            <input
                                                type="text"
                                                value={kb.v}
                                                onChange={e => setKnowledgeBase({ ...knowledgeBase, [kb.k]: e.target.value })}
                                                className="bg-white/5 border-none w-full px-4 py-3 rounded-xl font-black text-blue-400 uppercase italic tracking-tighter outline-none focus:bg-white/10 transition-all border border-white/5"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="premium-card p-10 bg-white">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                                    <ImageIcon size={16} className="text-blue-600" /> Ativos Visuais (Mídia)
                                </h3>
                                <div className="border-2 border-dashed border-slate-100 rounded-[32px] p-12 text-center relative group hover:border-blue-600 transition-all bg-slate-50/30">
                                    <input
                                        type="file"
                                        onChange={e => {
                                            if (e.target.files) {
                                                setIsUploading(true);
                                                setTimeout(() => { setMediaUrl('https://fg-media.cloud/temp_001.mp4'); setIsUploading(false); }, 1500);
                                            }
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6 text-slate-400 group-hover:scale-110 group-hover:text-blue-600 transition-all">
                                        <Upload size={28} />
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isUploading ? 'Processando arquivo...' : 'Arraste uma foto ou vídeo para a campanha'}</p>
                                </div>
                                {mediaUrl && (
                                    <div className="mt-6 bg-blue-50 rounded-2xl p-4 flex justify-between items-center border border-blue-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><ImageIcon size={14} /></div>
                                            <span className="text-[10px] font-black text-blue-700 truncate max-w-[200px]">{mediaUrl}</span>
                                        </div>
                                        <button onClick={() => setMediaUrl('')} className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all">
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'campaign' && (
                    <div className="animate-reveal max-w-7xl mx-auto">
                        {viewMode === 'selection' ? (
                            <div className="premium-card p-0 overflow-hidden bg-white">
                                <div className="bg-slate-900 p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Seleção de Alvos Ativos</h3>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Sincronizando com Base CRM ({clients.length} entidades detectadas)</p>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Entidades Selecionadas</p>
                                            <p className="text-2xl font-black text-blue-400 leading-none">{selectedClients.length}</p>
                                        </div>
                                        <button
                                            disabled={selectedClients.length === 0}
                                            onClick={() => {
                                                setPreparedMessages(selectedClients.map(id => ({
                                                    clientId: id,
                                                    client: clients.find(c => c.id_ferro === id),
                                                    status: 'pending',
                                                    message: gerarMensagemIA(clients.find(c => c.id_ferro === id)?.nome_social || 'NONE')
                                                })));
                                                setViewMode('review');
                                            }}
                                            className="btn-modern bg-blue-600 text-white px-8 py-4 rounded-2xl hover:bg-blue-500 gap-3 shadow-xl shadow-blue-900/40 disabled:opacity-20 transition-all font-black text-xs uppercase tracking-widest"
                                        >
                                            Iniciar Campanha <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="technical-table">
                                        <thead>
                                            <tr>
                                                <th className="w-16 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 rounded-lg accent-blue-600"
                                                        onChange={e => setSelectedClients(e.target.checked ? clients.map(c => c.id_ferro) : [])}
                                                        checked={selectedClients.length === clients.length && clients.length > 0}
                                                    />
                                                </th>
                                                <th>Parceiro de Negócios</th>
                                                <th>Protocolo ID</th>
                                                <th>Contato Digital</th>
                                                <th className="text-center">Vínculo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clients.map(c => (
                                                <tr
                                                    key={c.id_ferro}
                                                    onClick={() => {
                                                        const ns = new Set(selectedClients);
                                                        if (ns.has(c.id_ferro)) ns.delete(c.id_ferro);
                                                        else ns.add(c.id_ferro);
                                                        setSelectedClients(Array.from(ns));
                                                    }}
                                                    className={`cursor-pointer transition-colors ${selectedClients.includes(c.id_ferro) ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                                                >
                                                    <td className="text-center">
                                                        <div className={`w-6 h-6 mx-auto rounded-lg border-2 flex items-center justify-center transition-all ${selectedClients.includes(c.id_ferro) ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200'}`}>
                                                            {selectedClients.includes(c.id_ferro) && <CheckCircle size={14} />}
                                                        </div>
                                                    </td>
                                                    <td className="font-extrabold text-slate-900 uppercase text-xs">{c.nome_social}</td>
                                                    <td className="font-mono text-[10px] text-slate-400"># {c.id_ferro}</td>
                                                    <td className="font-black text-slate-900 text-[11px]">{c.whatsapp || 'SEM_DADO'}</td>
                                                    <td className="text-center">
                                                        <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${c.whatsapp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                                                            {c.whatsapp ? 'Online' : 'Offline'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 max-w-5xl mx-auto">
                                <div className="bg-slate-900 rounded-[40px] p-8 text-white flex flex-col md:flex-row justify-between items-center shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-rose-500 animate-gradient-x" />
                                    <button onClick={() => setViewMode('selection')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors mb-4 md:mb-0">
                                        <ArrowLeft size={14} /> Voltar à Seleção
                                    </button>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Revisão do Manifesto IA</h3>
                                    <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                        <span className="text-[10px] font-black text-blue-400">{preparedMessages.filter(m => m.status === 'sent').length} / {preparedMessages.length} ENTREGUES</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    {preparedMessages.map((msg, i) => (
                                        <div key={i} className={`premium-card p-8 group transition-all ${msg.status === 'sent' ? 'opacity-50 grayscale bg-slate-50/50 cursor-default' : 'bg-white hover:border-blue-200'}`}>
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${msg.status === 'sent' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'}`}>
                                                        {msg.status === 'sent' ? <CheckCircle size={24} /> : msg.client?.nome_social.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{msg.client?.nome_social}</h4>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{msg.client?.whatsapp || 'PEND_CONNECTION'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 w-full md:w-auto">
                                                    <button onClick={() => { const nm = [...preparedMessages]; nm[i].message = gerarMensagemIA(msg.client?.nome_social || ''); setPreparedMessages(nm); }} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shrink-0 shadow-sm"><RefreshCw size={18} /></button>
                                                    <button
                                                        disabled={msg.status === 'sent'}
                                                        onClick={() => { handleManualSend(msg.client?.whatsapp || '', msg.message); const nm = [...preparedMessages]; nm[i].status = 'sent'; setPreparedMessages(nm); }}
                                                        className="flex-1 md:flex-none btn-modern bg-slate-900 text-white px-8 py-3.5 rounded-2xl hover:bg-emerald-600 shadow-xl gap-3 text-xs"
                                                    >
                                                        {msg.status === 'sent' ? 'Mensagem Entregue' : <><Send size={16} /> Enviar agora</>}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <div className="absolute top-4 left-4 text-blue-500/20"><MessageCircle size={18} /></div>
                                                <textarea
                                                    disabled={msg.status === 'sent'}
                                                    value={msg.message}
                                                    onChange={e => { const nm = [...preparedMessages]; nm[i].message = e.target.value; setPreparedMessages(nm); }}
                                                    className="w-full h-32 modern-input p-10 font-medium text-slate-700 bg-slate-50/30"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'voice' && (
                    <div className="animate-reveal max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[
                            { id: 'saudacao', l: "Abertura / Saudação", d: "Primeiro contato cognitivo", icon: Mic },
                            { id: 'preco', l: "Fluxo de Negociação", d: "Defesa de margens e preços", icon: DollarSign },
                            { id: 'qualidade', l: "Engajamento Técnico", d: "Rendimento e qualidade de carcaça", icon: Activity },
                            { id: 'fechamento', l: "Commit de Reserva", d: "Confirmação de abate/compra", icon: ShieldCheck }
                        ].map(s => (
                            <div key={s.id} className="premium-card p-10 group bg-white">
                                <div className="flex justify-between items-start mb-10">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center transition-all group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 shadow-sm">
                                        <s.icon size={28} />
                                    </div>
                                    <div className="text-right">
                                        <h4 className="text-xl font-black text-slate-900 tracking-tight uppercase">{s.l}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">{s.d}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {isRecording === s.id ? (
                                        <button onClick={stopRecording} className="flex-1 bg-rose-600 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 animate-pulse shadow-xl shadow-rose-900/20">Parar Gravação</button>
                                    ) : (
                                        <button onClick={() => startRecording(s.id)} className="flex-1 bg-white border-2 border-slate-100 text-slate-600 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all flex items-center justify-center gap-3 shadow-sm">Iniciar Captura</button>
                                    )}
                                    {audioBlobs[s.id] && (
                                        <button onClick={() => new Audio(audioBlobs[s.id]).play()} className="w-20 h-[68px] rounded-2xl bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/20"><Play size={24} fill="currentColor" /></button>
                                    )}
                                </div>
                                {audioBlobs[s.id] && <div className="mt-5 flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /><span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Ativo Digitalizado</span></div>}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'test' && (
                    <div className="animate-reveal max-w-4xl mx-auto h-[800px] flex flex-col bg-white rounded-[48px] shadow-2xl border border-slate-100 overflow-hidden relative">
                        {/* TERMINAL HEADER */}
                        <div className="bg-slate-900 p-8 flex justify-between items-center text-white relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-600/30" />
                            <div className="flex items-center gap-5">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                                    <Bot size={20} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black uppercase tracking-tight">Debug de Simulação</h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Interface Terminal v2.5 / Session Active</p>
                                </div>
                            </div>
                            <div className="flex gap-1.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-black text-emerald-500 uppercase">Live Sinc</span>
                            </div>
                        </div>

                        {/* MESSAGES LIST */}
                        <div className="flex-1 overflow-y-auto p-10 space-y-8 flex flex-col bg-slate-50/30 no-scrollbar">
                            {chatHistory.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-05 py-32">
                                    <Bot size={160} className="text-slate-900" />
                                    <p className="mt-8 text-xs font-black uppercase tracking-[0.8em] text-slate-900">Aguardando Input</p>
                                </div>
                            ) : (
                                chatHistory.map((m, i) => (
                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`p-6 rounded-[32px] max-w-[85%] shadow-sm ${m.role === 'user' ? 'bg-white text-slate-900 border border-slate-100 font-medium' : 'bg-slate-900 text-blue-50 font-medium shadow-xl shadow-slate-900/20'}`}>
                                            <div className={`flex items-center gap-2 mb-3 text-[8px] font-black uppercase tracking-widest ${m.role === 'user' ? 'text-slate-400' : 'text-blue-400'}`}>
                                                {m.role === 'user' ? <><User size={10} /> Humano</> : <><Bot size={10} /> Agente Cognitivo</>}
                                            </div>
                                            {m.audio ? (
                                                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                                                    <button onClick={() => new Audio(m.audio).play()} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center hover:scale-110 transition-all"><Play size={16} fill="currentColor" /></button>
                                                    <div className="flex-1 h-0.5 bg-white/10 rounded-full" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Stream Voz</span>
                                                </div>
                                            ) : (
                                                <p className="leading-relaxed text-sm">{m.content}</p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isTyping && (
                                <div className="flex gap-2 items-center text-blue-600 font-black text-[10px] uppercase tracking-widest animate-pulse ml-2">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                                    </div>
                                    IA Processando...
                                </div>
                            )}
                        </div>

                        {/* INPUT AREA */}
                        <div className="p-10 bg-white border-t border-slate-100 flex gap-4">
                            <div className="flex-1 relative">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"><Terminal size={18} /></div>
                                <input
                                    value={userSimInput}
                                    onChange={e => setUserSimInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && userSimInput && (
                                        setChatHistory([...chatHistory, { role: 'user', content: userSimInput }]),
                                        setUserSimInput(''),
                                        setIsTyping(true),
                                        setTimeout(() => {
                                            setChatHistory(prev => [...prev, { role: 'assistant', content: gerarMensagemIA('Simulador') }]);
                                            setIsTyping(false);
                                        }, 1500)
                                    )}
                                    placeholder="Simule uma objeção ou pergunta do cliente..."
                                    className="w-full h-16 modern-input pl-14 text-sm"
                                />
                            </div>
                            <button
                                onClick={() => userSimInput && (
                                    setChatHistory([...chatHistory, { role: 'user', content: userSimInput }]),
                                    setUserSimInput(''),
                                    setIsTyping(true),
                                    setTimeout(() => {
                                        setChatHistory(prev => [...prev, { role: 'assistant', content: gerarMensagemIA('Simulador') }]);
                                        setIsTyping(false);
                                    }, 1500)
                                )}
                                className="w-16 h-16 rounded-[24px] bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 hover:scale-105 transition-all shadow-xl shadow-slate-900/20 shrink-0"
                            >
                                <Send size={24} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesAgent;
