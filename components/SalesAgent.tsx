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
    sales?: Sale[];
    stock?: StockItem[];
    batches?: Batch[];
}

type SegmentFilter = 'TODOS' | 'VIP' | 'ESFRIANDO' | 'DEVEDOR' | 'NOVO' | 'INATIVO';
type ScriptType = 'OFERTA' | 'COBRANCA' | 'REATIVACAO' | 'VIP_MIMO' | 'PROMO_RELAMPAGO' | 'SAC';

const SalesAgent: React.FC<SalesAgentProps> = ({ onBack, clients, sales = [], stock = [], batches = [] }) => {
    const [activeTab, setActiveTab] = useState<'disparo' | 'campaign' | 'config' | 'test'>('disparo');
    const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('TODOS');
    const [scriptType, setScriptType] = useState<ScriptType>('OFERTA');
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [isCampaignRunning, setIsCampaignRunning] = useState(false);
    const [campaignProgress, setCampaignProgress] = useState({ sent: 0, total: 0, current: '' });
    const [preparedMessages, setPreparedMessages] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Config State
    const [activeAgentId, setActiveAgentId] = useState('vendas');
    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [userSimInput, setUserSimInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // ═══ INTELIGÊNCIA DE DADOS REAIS ═══
    const now = new Date();
    const msDay = 86400000;
    const validSales = useMemo(() => sales.filter(s => s.status_pagamento !== 'ESTORNADO'), [sales]);
    const estoqueDisp = useMemo(() => stock.filter(s => s.status === 'DISPONIVEL'), [stock]);

    // Segmentação RFM dos clientes
    const clientSegments = useMemo(() => {
        return clients.map(c => {
            const cs = validSales.filter(s => s.id_cliente === c.id_ferro);
            const sortedSales = [...cs].sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime());
            const lastSale = sortedSales[0];
            const diasSemCompra = lastSale ? Math.floor((now.getTime() - new Date(lastSale.data_venda).getTime()) / msDay) : 999;
            const kgTotal = cs.reduce((sum, s) => sum + s.peso_real_saida, 0);
            const faturado = cs.reduce((sum, s) => sum + (s.peso_real_saida * s.preco_venda_kg), 0);
            const pago = cs.reduce((sum, s) => sum + ((s as any).valor_pago || 0), 0);
            const divida = faturado - pago;
            const frequencia = cs.length;

            let segmento: SegmentFilter = 'TODOS';
            if (frequencia === 0) segmento = 'NOVO';
            else if (divida > 50) segmento = 'DEVEDOR';
            else if (diasSemCompra <= 15 && frequencia >= 3) segmento = 'VIP';
            else if (diasSemCompra > 60) segmento = 'INATIVO';
            else if (diasSemCompra > 30) segmento = 'ESFRIANDO';

            return { ...c, diasSemCompra, kgTotal, divida, frequencia, segmento, faturado, pago };
        });
    }, [clients, validSales, now]);

    // Filtrar clientes
    const filteredClients = useMemo(() => {
        let result = clientSegments;
        if (segmentFilter !== 'TODOS') result = result.filter(c => c.segmento === segmentFilter);
        if (searchTerm) result = result.filter(c =>
            c.nome_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.whatsapp?.includes(searchTerm)
        );
        return result;
    }, [clientSegments, segmentFilter, searchTerm]);

    // KPIs Dinâmicos
    const kpis = useMemo(() => {
        const total = clientSegments.length;
        const vips = clientSegments.filter(c => c.segmento === 'VIP').length;
        const esfriando = clientSegments.filter(c => c.segmento === 'ESFRIANDO').length;
        const devedores = clientSegments.filter(c => c.segmento === 'DEVEDOR').length;
        const inativos = clientSegments.filter(c => c.segmento === 'INATIVO').length;
        const novos = clientSegments.filter(c => c.segmento === 'NOVO').length;
        const dividaTotal = clientSegments.reduce((sum, c) => sum + Math.max(0, c.divida), 0);
        const estoqueKg = estoqueDisp.reduce((sum, s) => sum + s.peso_entrada, 0);
        const estoqueVelho = estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / msDay) > 6).length;
        return { total, vips, esfriando, devedores, inativos, novos, dividaTotal, estoqueKg, estoqueVelho };
    }, [clientSegments, estoqueDisp, now]);

    // ═══ GERADOR DE SCRIPTS INTELIGENTES ═══
    const gerarScript = (client: any, tipo: ScriptType): string => {
        const nome = client.nome_social || 'Cliente';
        const diasLabel = client.diasSemCompra < 999 ? `${client.diasSemCompra} dias` : 'muito tempo';
        const dianteiros = estoqueDisp.filter(s => s.tipo === 2);
        const traseiros = estoqueDisp.filter(s => s.tipo === 3);

        switch (tipo) {
            case 'OFERTA':
                return `Olá *${nome}*! 👋🥩\n\n*ESTOQUE FRESCO CHEGOU!*\n\n📦 Disponível agora:\n🔸 ${traseiros.length} Traseiros (${traseiros.reduce((s, e) => s + e.peso_entrada, 0).toFixed(0)}kg)\n🔸 ${dianteiros.length} Dianteiros (${dianteiros.reduce((s, e) => s + e.peso_entrada, 0).toFixed(0)}kg)\n\n✅ Acabamento premium\n🚚 Entrega em 24h\n💰 Condição especial pra você!\n\nQuer reservar? Me chama aqui! 📱`;

            case 'COBRANCA':
                if ((client.divida || 0) <= 0) return `Olá *${nome}*! Tudo certo por aqui, sem pendências. 😊`;
                return `Olá *${nome}*, tudo bem? 🤝\n\n📋 *Lembrete Amigável*\n\nIdentifiquei um saldo pendente de *R$ ${(client.divida || 0).toFixed(2)}* em nossa base.\n\n💡 *Formas de pagamento:*\n• PIX (mais rápido ⚡)\n• Transferência bancária\n• Dinheiro na entrega\n\n🎁 Quitando hoje, você garante *condição especial* no próximo pedido!\n\nPrecisa de ajuda? Estou aqui! 🤝\n\n_Equipe FrigoGest_`;

            case 'REATIVACAO':
                return `*${nome}*, sentimos sua falta! 😢\n\nFaz *${diasLabel}* que não te abastecemos.\n\n🔥 *Oferta de Reativação:*\n✅ Primeiro pedido de volta com *desconto especial*\n🚚 Frete cortesia na primeira entrega\n📦 Estoque fresco: ${estoqueDisp.length} peças disponíveis (${estoqueDisp.reduce((s, e) => s + e.peso_entrada, 0).toFixed(0)}kg)\n\n*O que rolou?* Se foi preço, qualidade ou entrega, me conta que resolvo na hora! 💪\n\nBora voltar a fazer negócio? 🤝`;

            case 'VIP_MIMO':
                return `*${nome}*, você é ESPECIAL pra nós! 👑\n\n🏆 *Cliente VIP FrigoGest*\n${(client.kgTotal || 0).toFixed(0)}kg comprados | ${client.frequencia || 0} pedidos\n\n🎁 *Benefício Exclusivo VIP:*\n• Acesso antecipado aos melhores lotes\n• Condição de pagamento diferenciada\n• Entrega prioritária\n\n📦 *Novidade da semana:*\nLote premium disponível, reservei um corte especial pra você!\n\nQuer que eu separe? 🥩`;

            case 'PROMO_RELAMPAGO': {
                const velhos = estoqueDisp.filter(s => Math.floor((now.getTime() - new Date(s.data_entrada).getTime()) / msDay) > 6);
                return `⚡ *PROMO RELÂMPAGO* ⚡\n\nOlá *${nome}*!\n\n🔥 *Só hoje - Estoque com preço especial:*\n${velhos.length > 0 ? velhos.slice(0, 3).map(s => `• ${s.tipo === 2 ? 'Dianteiro' : s.tipo === 3 ? 'Traseiro' : 'Inteiro'} - ${s.peso_entrada.toFixed(1)}kg`).join('\n') : '• Peças selecionadas com desconto'}\n\n💰 *Desconto de até 10%* pra quem fechar AGORA\n⏰ Válido só hoje!\n🚚 Entrega imediata\n\nInteressou? Responde aqui! 📱`;
            }

            case 'SAC':
                return `Olá *${nome}*! 👋\n\nComo foi sua última compra conosco?\n\n📋 Queremos saber:\n✅ A qualidade estava boa?\n✅ A entrega foi no prazo?\n✅ Alguma sugestão?\n\nSua opinião é muito importante! 🙏\n\n_Equipe FrigoGest_`;

            default:
                return `Olá *${nome}*! 👋\nTemos novidades pra você! Entre em contato. 📱`;
        }
    };

    // ═══ DISPARO EM MASSA ═══
    const handleBulkSend = async () => {
        if (preparedMessages.length === 0) return;
        setIsCampaignRunning(true);
        setCampaignProgress({ sent: 0, total: preparedMessages.length, current: '' });

        for (let i = 0; i < preparedMessages.length; i++) {
            const msg = preparedMessages[i];
            if (msg.status === 'sent' || !msg.client?.whatsapp) continue;

            setCampaignProgress({ sent: i, total: preparedMessages.length, current: msg.client.nome_social });

            await handleManualSend(msg.client.whatsapp, msg.message);

            const nm = [...preparedMessages];
            nm[i].status = 'sent';
            setPreparedMessages(nm);

            // Delay entre mensagens (3 segundos pra não ser banido)
            if (i < preparedMessages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        setCampaignProgress({ sent: preparedMessages.length, total: preparedMessages.length, current: 'Concluído!' });
        setIsCampaignRunning(false);
    };

    // ═══ ENVIAR INDIVIDUAL ═══
    const handleManualSend = async (phone: string, message: string) => {
        const result = await sendWhatsAppMessage(phone, message);
        if (result.success) return true;
        console.warn('Usando fallback: WhatsApp Web');
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
        return true;
    };

    const openWhatsApp = (phone: string, message: string) => {
        const clean = phone.replace(/\D/g, '');
        const num = clean.startsWith('55') ? clean : `55${clean}`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Preparar mensagens para campanha
    const prepareMessages = () => {
        const msgs = filteredClients
            .filter(c => selectedClients.includes(c.id_ferro) && c.whatsapp)
            .map(c => ({
                clientId: c.id_ferro,
                client: c,
                status: 'pending',
                message: gerarScript(c, scriptType)
            }));
        setPreparedMessages(msgs);
        setActiveTab('campaign');
    };

    // Segment badges
    const getSegmentColor = (seg: string) => {
        switch (seg) {
            case 'VIP': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'ESFRIANDO': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'DEVEDOR': return 'bg-red-100 text-red-700 border-red-200';
            case 'NOVO': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'INATIVO': return 'bg-gray-100 text-gray-500 border-gray-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };
    const getSegmentIcon = (seg: string) => {
        switch (seg) {
            case 'VIP': return <Crown size={12} />;
            case 'ESFRIANDO': return <Clock size={12} />;
            case 'DEVEDOR': return <AlertTriangle size={12} />;
            case 'NOVO': return <Sparkles size={12} />;
            case 'INATIVO': return <X size={12} />;
            default: return <Users size={12} />;
        }
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-[#f8fafc] animate-reveal pb-20 font-sans">
            {/* HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex flex-col gap-3">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-emerald-700 hover:border-emerald-100 transition-all shadow-sm">
                        <ArrowLeft size={14} /> Voltar
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-xl relative">
                            <Zap size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
                                Robô de <span className="text-emerald-600">Vendas</span>
                            </h1>
                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-0.5">
                                WhatsApp Inteligente · {kpis.total} Clientes · {estoqueDisp.length} Peças
                            </p>
                        </div>
                    </div>
                </div>

                <nav className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                    {[
                        { id: 'disparo', icon: Rocket, label: 'Disparo' },
                        { id: 'campaign', icon: Target, label: 'Campanha' },
                        { id: 'config', icon: Settings, label: 'Config' },
                        { id: 'test', icon: MessageCircle, label: 'Simular' }
                    ].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* ═══ TAB: DISPARO INTELIGENTE ═══ */}
                {activeTab === 'disparo' && (
                    <div className="animate-reveal space-y-6">
                        {/* KPIs */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                                { label: 'VIPs', value: kpis.vips, icon: Crown, color: 'text-purple-600 bg-purple-50 border-purple-100', filter: 'VIP' as SegmentFilter },
                                { label: 'Esfriando', value: kpis.esfriando, icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-100', filter: 'ESFRIANDO' as SegmentFilter },
                                { label: 'Devedores', value: kpis.devedores, icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-100', filter: 'DEVEDOR' as SegmentFilter },
                                { label: 'Novos', value: kpis.novos, icon: Sparkles, color: 'text-blue-600 bg-blue-50 border-blue-100', filter: 'NOVO' as SegmentFilter },
                                { label: 'Inativos', value: kpis.inativos, icon: X, color: 'text-gray-500 bg-gray-50 border-gray-100', filter: 'INATIVO' as SegmentFilter },
                            ].map(kpi => (
                                <button key={kpi.label} onClick={() => setSegmentFilter(segmentFilter === kpi.filter ? 'TODOS' : kpi.filter)}
                                    className={`p-4 rounded-2xl border-2 transition-all text-left ${segmentFilter === kpi.filter ? 'ring-2 ring-emerald-400 scale-[1.02]' : ''} ${kpi.color}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <kpi.icon size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{kpi.label}</span>
                                    </div>
                                    <p className="text-2xl font-black">{kpi.value}</p>
                                </button>
                            ))}
                        </div>

                        {/* Dívida Total + Estoque */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 flex items-center gap-4">
                                <DollarSign size={24} className="text-red-600 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Dívida Total Carteira</p>
                                    <p className="text-xl font-black text-red-700">R$ {kpis.dividaTotal.toFixed(2)}</p>
                                </div>
                                <button onClick={() => { setSegmentFilter('DEVEDOR'); setScriptType('COBRANCA'); }}
                                    className="ml-auto px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-red-700 transition-all shrink-0">
                                    Cobrar
                                </button>
                            </div>
                            <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 flex items-center gap-4">
                                <Package size={24} className="text-emerald-600 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Estoque Disponível</p>
                                    <p className="text-xl font-black text-emerald-700">{estoqueDisp.length} peças · {kpis.estoqueKg.toFixed(0)}kg</p>
                                </div>
                                {kpis.estoqueVelho > 0 && (
                                    <button onClick={() => { setSegmentFilter('TODOS'); setScriptType('PROMO_RELAMPAGO'); }}
                                        className="ml-auto px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-amber-600 transition-all animate-pulse shrink-0">
                                        ⚡ {kpis.estoqueVelho} Urgentes
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Script Type Selector */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tipo de Script</p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: 'OFERTA' as ScriptType, label: '🥩 Oferta', desc: 'Venda ativa' },
                                    { id: 'COBRANCA' as ScriptType, label: '💰 Cobrança', desc: 'Dívida pendente' },
                                    { id: 'REATIVACAO' as ScriptType, label: '🔄 Reativação', desc: 'Cliente sumiu' },
                                    { id: 'VIP_MIMO' as ScriptType, label: '👑 VIP Mimo', desc: 'Fidelizar VIP' },
                                    { id: 'PROMO_RELAMPAGO' as ScriptType, label: '⚡ Promo Flash', desc: 'Estoque urgente' },
                                    { id: 'SAC' as ScriptType, label: '📋 Pós-Venda', desc: 'Feedback' },
                                ].map(st => (
                                    <button key={st.id} onClick={() => setScriptType(st.id)}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${scriptType === st.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                                        {st.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Filter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar cliente por nome ou WhatsApp..."
                                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 text-sm font-medium focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                        </div>

                        {/* Client List */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-slate-900 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" className="w-5 h-5 rounded accent-emerald-600"
                                        onChange={e => setSelectedClients(e.target.checked ? filteredClients.map(c => c.id_ferro) : [])}
                                        checked={selectedClients.length === filteredClients.length && filteredClients.length > 0} />
                                    <span className="text-white text-xs font-bold">{filteredClients.length} clientes · {selectedClients.length} selecionados</span>
                                </div>
                                <button disabled={selectedClients.length === 0}
                                    onClick={prepareMessages}
                                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-30 transition-all flex items-center gap-2 shadow-lg">
                                    <Send size={14} /> Preparar Disparo ({selectedClients.length})
                                </button>
                            </div>

                            <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                                {filteredClients.map(c => (
                                    <div key={c.id_ferro}
                                        className={`flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer ${selectedClients.includes(c.id_ferro) ? 'bg-emerald-50/30' : ''}`}
                                        onClick={() => {
                                            const ns = new Set(selectedClients);
                                            if (ns.has(c.id_ferro)) ns.delete(c.id_ferro);
                                            else ns.add(c.id_ferro);
                                            setSelectedClients(Array.from(ns));
                                        }}>
                                        <input type="checkbox" checked={selectedClients.includes(c.id_ferro)} readOnly
                                            className="w-4 h-4 rounded accent-emerald-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-slate-900 truncate">{c.nome_social}</span>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${getSegmentColor(c.segmento)}`}>
                                                    {getSegmentIcon(c.segmento)} {c.segmento}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400 font-medium flex-wrap">
                                                <span>{c.kgTotal.toFixed(0)}kg</span>
                                                <span>·</span>
                                                <span>{c.diasSemCompra < 999 ? `${c.diasSemCompra}d atrás` : 'Nunca'}</span>
                                                {c.divida > 0 && <><span>·</span><span className="text-red-500 font-bold">R${c.divida.toFixed(2)}</span></>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {c.whatsapp ? (
                                                <>
                                                    <button onClick={e => { e.stopPropagation(); copyToClipboard(gerarScript(c, scriptType), c.id_ferro); }}
                                                        className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-all"
                                                        title="Copiar Script">
                                                        {copiedId === c.id_ferro ? <CheckCircle size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); openWhatsApp(c.whatsapp, gerarScript(c, scriptType)); }}
                                                        className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all"
                                                        title="Abrir WhatsApp">
                                                        <ExternalLink size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-300 uppercase">Sem WA</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {filteredClients.length === 0 && (
                                    <div className="p-12 text-center text-slate-400">
                                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-medium">Nenhum cliente neste segmento</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TAB: CAMPANHA (REVIEW/SEND) ═══ */}
                {activeTab === 'campaign' && (
                    <div className="animate-reveal space-y-6">
                        {preparedMessages.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
                                <Target size={48} className="mx-auto text-slate-300 mb-4" />
                                <h3 className="text-lg font-bold text-slate-600 mb-2">Nenhuma Campanha Preparada</h3>
                                <p className="text-sm text-slate-400 mb-6">Vá para <b>Disparo</b>, selecione clientes e clique em "Preparar Disparo".</p>
                                <button onClick={() => setActiveTab('disparo')} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-500 transition-all">
                                    Ir para Disparo
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Campaign Header */}
                                <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div>
                                        <h3 className="text-lg font-black uppercase tracking-tight">Campanha Pronta</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            {preparedMessages.filter(m => m.status === 'sent').length} / {preparedMessages.length} enviadas
                                        </p>
                                    </div>
                                    <div className="flex gap-3 flex-wrap">
                                        <button onClick={() => { setPreparedMessages([]); setActiveTab('disparo'); }}
                                            className="px-4 py-2.5 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase hover:bg-white/20 transition-all flex items-center gap-1">
                                            <ArrowLeft size={14} /> Voltar
                                        </button>
                                        <button disabled={isCampaignRunning || preparedMessages.every(m => m.status === 'sent')}
                                            onClick={handleBulkSend}
                                            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500 disabled:opacity-30 transition-all flex items-center gap-2 shadow-lg">
                                            {isCampaignRunning ? <><RefreshCw size={14} className="animate-spin" /> Enviando... {campaignProgress.sent}/{campaignProgress.total}</> :
                                                <><Rocket size={14} /> Disparar TODOS</>}
                                        </button>
                                    </div>
                                </div>

                                {isCampaignRunning && (
                                    <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <RefreshCw size={16} className="text-emerald-600 animate-spin" />
                                            <span className="text-sm font-bold text-emerald-700">Enviando para: {campaignProgress.current}</span>
                                        </div>
                                        <div className="w-full bg-emerald-200 h-2 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-600 transition-all rounded-full" style={{ width: `${(campaignProgress.sent / campaignProgress.total) * 100}%` }} />
                                        </div>
                                    </div>
                                )}

                                {/* Message Cards */}
                                <div className="space-y-4">
                                    {preparedMessages.map((msg, i) => (
                                        <div key={i} className={`bg-white rounded-2xl border p-5 transition-all ${msg.status === 'sent' ? 'opacity-50 border-emerald-200 bg-emerald-50/30' : 'border-slate-100 hover:border-emerald-200'}`}>
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${msg.status === 'sent' ? 'bg-emerald-600' : 'bg-slate-900'}`}>
                                                        {msg.status === 'sent' ? <CheckCircle size={20} /> : (msg.client?.nome_social || '?').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-sm text-slate-900">{msg.client?.nome_social}</h4>
                                                        <p className="text-[10px] text-slate-400 font-medium">{msg.client?.whatsapp}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => { const nm = [...preparedMessages]; nm[i].message = gerarScript(msg.client, scriptType); setPreparedMessages(nm); }}
                                                        className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-all">
                                                        <RefreshCw size={14} />
                                                    </button>
                                                    <button disabled={msg.status === 'sent'}
                                                        onClick={() => { openWhatsApp(msg.client?.whatsapp || '', msg.message); const nm = [...preparedMessages]; nm[i].status = 'sent'; setPreparedMessages(nm); }}
                                                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-500 disabled:opacity-30 transition-all flex items-center gap-1.5">
                                                        {msg.status === 'sent' ? <>✅ Enviado</> : <><Send size={12} /> Enviar</>}
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea disabled={msg.status === 'sent'} value={msg.message}
                                                onChange={e => { const nm = [...preparedMessages]; nm[i].message = e.target.value; setPreparedMessages(nm); }}
                                                className="w-full h-32 p-4 rounded-xl border border-slate-100 text-sm font-medium text-slate-700 bg-slate-50/50 resize-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none transition-all" />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ═══ TAB: CONFIG ═══ */}
                {activeTab === 'config' && (
                    <div className="animate-reveal grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Cpu size={16} className="text-emerald-600" /> Agentes Disponíveis
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { id: 'vendas', name: 'BOIADEIRO DIGITAL', desc: 'Vendas e ofertas', icon: Zap },
                                    { id: 'cobranca', name: 'COBRADOR AMIGÁVEL', desc: 'Dívidas pendentes', icon: DollarSign },
                                    { id: 'sac', name: 'SUPORTE FG', desc: 'Pós-venda e SAC', icon: Heart },
                                ].map(a => (
                                    <button key={a.id} onClick={() => setActiveAgentId(a.id)}
                                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 text-left transition-all ${activeAgentId === a.id ? 'border-emerald-600 bg-emerald-50/30' : 'border-slate-100 hover:border-slate-200'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeAgentId === a.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <a.icon size={20} />
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-xs uppercase ${activeAgentId === a.id ? 'text-emerald-600' : 'text-slate-500'}`}>{a.name}</h4>
                                            <p className="text-[10px] text-slate-400">{a.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl">
                            <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6">Estatísticas de Vendas</h3>
                            <div className="space-y-6">
                                {[
                                    { label: 'Total em Carteira', value: `${clients.length} clientes`, color: 'text-white' },
                                    { label: 'Com WhatsApp', value: `${clients.filter(c => c.whatsapp).length} contactáveis`, color: 'text-emerald-400' },
                                    { label: 'Vendas Últimos 30d', value: `${validSales.filter(s => Math.floor((now.getTime() - new Date(s.data_venda).getTime()) / msDay) <= 30).length} vendas`, color: 'text-blue-400' },
                                    { label: 'Estoque em Risco (>6 dias)', value: `${kpis.estoqueVelho} peças`, color: kpis.estoqueVelho > 0 ? 'text-red-400' : 'text-emerald-400' },
                                    { label: 'Dívida Total', value: `R$ ${kpis.dividaTotal.toFixed(2)}`, color: kpis.dividaTotal > 0 ? 'text-red-400' : 'text-emerald-400' },
                                ].map(stat => (
                                    <div key={stat.label}>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                                        <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TAB: SIMULAR ═══ */}
                {activeTab === 'test' && (
                    <div className="animate-reveal max-w-3xl mx-auto h-[700px] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center"><Bot size={20} /></div>
                                <div>
                                    <h4 className="text-lg font-black uppercase tracking-tight">Simulador de Chat</h4>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Teste os scripts antes de enviar</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[9px] font-black text-emerald-500 uppercase">Script: {scriptType}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                            {chatHistory.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-10">
                                    <Bot size={100} className="text-slate-900" />
                                    <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-900">Envie uma mensagem</p>
                                </div>
                            )}
                            {chatHistory.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`p-4 rounded-2xl max-w-[85%] ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-900 border border-slate-100 shadow-sm'}`}>
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex gap-1 items-center text-emerald-600 font-bold text-xs animate-pulse">
                                    <div className="flex gap-0.5">
                                        <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
                                    </div>
                                    Digitando...
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                            <input value={userSimInput} onChange={e => setUserSimInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && userSimInput) {
                                        const input = userSimInput;
                                        setChatHistory(prev => [...prev, { role: 'user', content: input }]);
                                        setUserSimInput('');
                                        setIsTyping(true);
                                        setTimeout(() => {
                                            setChatHistory(prev => [...prev, {
                                                role: 'assistant',
                                                content: gerarScript({ nome_social: 'Simulador', diasSemCompra: 15, kgTotal: 500, divida: 250, frequencia: 5 }, scriptType)
                                            }]);
                                            setIsTyping(false);
                                        }, 1200);
                                    }
                                }}
                                placeholder="Simule uma conversa de venda..."
                                className="flex-1 h-12 px-4 rounded-xl border border-slate-200 text-sm font-medium focus:border-emerald-400 outline-none transition-all" />
                            <button onClick={() => {
                                if (userSimInput) {
                                    const input = userSimInput;
                                    setChatHistory(prev => [...prev, { role: 'user', content: input }]);
                                    setUserSimInput('');
                                    setIsTyping(true);
                                    setTimeout(() => {
                                        setChatHistory(prev => [...prev, {
                                            role: 'assistant',
                                            content: gerarScript({ nome_social: 'Simulador', diasSemCompra: 15, kgTotal: 500, divida: 250, frequencia: 5 }, scriptType)
                                        }]);
                                        setIsTyping(false);
                                    }, 1200);
                                }
                            }}
                                className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 transition-all shrink-0">
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesAgent;
