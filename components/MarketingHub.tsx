import React, { useState, useMemo, useCallback } from 'react';
import { AppState, Client, StockItem, Batch } from '../types';
import { Bot, Megaphone, Target, MessageCircle, Gift, TrendingUp, AlertTriangle, Search, Filter, Phone, Star, Settings, CheckCircle2, Instagram, Link, PlayCircle, BookOpen, Video, QrCode, Sparkles, Wand2, ArrowRight, Zap, Plus, Contact, FileText, Grid, Image, Download, Loader2, Paintbrush, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface MarketingHubProps {
    data: AppState;
}

const MarketingHub: React.FC<MarketingHubProps> = ({ data }) => {
    const [activeTab, setActiveTab] = useState<'campaigns' | 'clients' | 'supplier-vip' | 'stitch' | 'academy' | 'studio'>('studio');
    const [imagenPrompt, setImagenPrompt] = useState('');
    const [imagenLoading, setImagenLoading] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<{ url: string; prompt: string; ts: Date }[]>([]);
    const [imagenError, setImagenError] = useState('');
    const IMAGEN_TEMPLATES = [
        { label: '🥩 Promo Carne', prompt: 'Professional food photography of premium Brazilian beef cuts beautifully arranged on dark wooden board, warm lighting, appetizing' },
        { label: '📦 Kit Churrasco', prompt: 'BBQ kit: premium beef cuts, charcoal, chimichurri in rustic crate, top-down view, professional' },
        { label: '📱 Banner WhatsApp', prompt: 'Clean horizontal banner for Brazilian meat distributor, bold red black, premium feel, minimalist' },
        { label: '🏪 Post Instagram', prompt: 'Square Instagram post: juicy grilled steak on cast iron with smoke, food photography, vibrant' },
        { label: '🎉 Natal/Festas', prompt: 'Christmas promo for meat company: premium beef basket with red ribbons, festive, elegant' },
        { label: '📋 Catalogo Cortes', prompt: 'Professional catalog showing Brazilian beef cuts labeled: Picanha, Alcatra, Patinho, Acem, Costela' },
    ];
    const generateImage = useCallback(async (prompt: string) => {
        const key = (import.meta as any).env.VITE_AI_API_KEY as string || '';
        if (!key) { setImagenError('Chave Gemini nao configurada'); return; }
        if (!prompt.trim()) { setImagenError('Digite um prompt'); return; }
        setImagenLoading(true); setImagenError('');
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const r = await ai.models.generateContent({ model: 'gemini-2.0-flash-exp', contents: { parts: [{ text: `Generate image: ${prompt}. High quality, professional, marketing.` }] }, config: { responseModalities: ['TEXT', 'IMAGE'] as any } });
            const parts = r.candidates?.[0]?.content?.parts || [];
            let found = false;
            for (const p of parts) { if ((p as any).inlineData) { const { mimeType, data: b64 } = (p as any).inlineData; setGeneratedImages(prev => [{ url: `data:${mimeType};base64,${b64}`, prompt, ts: new Date() }, ...prev].slice(0, 12)); found = true; break; } }
            if (!found) setImagenError('IA nao gerou imagem. Tente reformular.');
        } catch (e: any) { setImagenError(`Erro: ${e.message}`); } finally { setImagenLoading(false); }
    }, []);

    // ============================================
    // LOGIC: AI Data Processing (The "Isabela" Brain)
    // ============================================

    // 1. Clientes Quentes vs Esfriando
    const clientStatus = useMemo(() => {
        const today = new Date();

        return data.clients.map(client => {
            // Get all sales for this client
            const clientSales = data.sales.filter(s => s.id_cliente === client.id_ferro);

            // Find the most recent purchase date
            let lastPurchaseDate = new Date(0);
            if (clientSales.length > 0) {
                lastPurchaseDate = new Date(Math.max(...clientSales.map(s => new Date(s.data_venda).getTime())));
            }

            const daysSinceLastPurchase = clientSales.length > 0
                ? Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 3600 * 24))
                : -1;

            const frequencyDays = client.frequencia_ideal_dias || 15; // Default 15

            let status: 'QUENTE' | 'ESFRIANDO' | 'FRIO' | 'NOVO' = 'NOVO';

            if (daysSinceLastPurchase === -1) {
                status = 'NOVO';
            } else if (daysSinceLastPurchase <= frequencyDays) {
                status = 'QUENTE';
            } else if (daysSinceLastPurchase > frequencyDays && daysSinceLastPurchase <= frequencyDays * 2) {
                status = 'ESFRIANDO';
            } else {
                status = 'FRIO';
            }

            return {
                ...client,
                daysSinceLastPurchase,
                status,
                totalPurchases: clientSales.length,
                totalVolumeKg: clientSales.reduce((acc, sale) => acc + sale.peso_real_saida, 0)
            };
        }).sort((a, b) => b.totalVolumeKg - a.totalVolumeKg);
    }, [data.clients, data.sales]);

    const coolingClients = clientStatus.filter(c => c.status === 'ESFRIANDO' || c.status === 'FRIO');
    const hotClients = clientStatus.filter(c => c.status === 'QUENTE');

    // 2. VIP Suppliers
    const vipSuppliers = useMemo(() => {
        const supplierStats = data.suppliers.map(sup => {
            const supBatches = data.batches.filter(b => b.fornecedor === sup.nome_fantasia || b.fornecedor.includes(sup.nome_fantasia));
            const totalHeads = supBatches.reduce((acc, batch) => acc + (batch.qtd_cabecas || 0), 0);
            const totalValue = supBatches.reduce((acc, batch) => acc + (batch.valor_compra_total || 0), 0);

            // Did they receive a gift recently? (Assuming we check metadata or just use mock data for now)
            const needsGift = totalHeads >= 100; // Example rule: 100 heads gets a gift

            return {
                ...sup,
                totalBatches: supBatches.length,
                totalHeads,
                totalValue,
                needsGift
            };
        }).filter(s => s.totalBatches > 0).sort((a, b) => b.totalHeads - a.totalHeads);

        return supplierStats;
    }, [data.suppliers, data.batches]);

    // 3. Problematic Stock -> Actionable Kits
    const stockKits = useMemo(() => {
        const availableStock = data.stock.filter(s => s.status === 'DISPONIVEL');
        const today = new Date();

        // Group by cut type
        let dianteiroCount = 0;
        let traseiroCount = 0;
        let oldStockCount = 0;

        availableStock.forEach(item => {
            const entryDate = new Date(item.data_entrada);
            const daysInColdRoom = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 3600 * 24));

            if (item.tipo === 2) dianteiroCount++;
            if (item.tipo === 3) traseiroCount++;
            if (daysInColdRoom > 5) oldStockCount++;
        });

        const recommendations = [];

        if (dianteiroCount > traseiroCount * 1.5) {
            recommendations.push({
                id: 'promo-dianteiro',
                title: 'Excesso de Dianteiro Detectado',
                description: `Temos ${dianteiroCount} dianteiros contra ${traseiroCount} traseiros. Criar "Kit Mistura da Semana Econômico" B2C.`,
                action: 'Campanha Meta Ads B2C (Raio 30km)',
                priority: 'ALTA'
            });
        }

        if (oldStockCount > 0) {
            recommendations.push({
                id: 'burn-stock',
                title: 'Queima de Estoque Crítica',
                description: `${oldStockCount} peças passando de 5 dias na câmara fria (Quebra de Frio iminente). Acionar WhatsApp com desconto de 5% para clientes inativos.`,
                action: 'Disparo WhatsApp B2B',
                priority: 'CRITICA'
            });
        }

        if (traseiroCount > dianteiroCount * 1.5) {
            recommendations.push({
                id: 'promo-traseiro',
                title: 'Foco em Cortes Nobres',
                description: `Excesso de traseiros. Sugestão: Oferta B2B para Churrascarias VIP e Chefs (Picanha, Mignon).`,
                action: 'Ligacões / Gifting',
                priority: 'MEDIA'
            });
        }

        return recommendations;
    }, [data.stock]);


    // ============================================
    // RENDER HELPERS
    // ============================================

    const renderCampaigns = () => (
        <div className="space-y-6 animate-fade-in relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stockKits.length === 0 ? (
                    <div className="col-span-full p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col items-center justify-center text-center backdrop-blur-md">
                        <Target className="w-12 h-12 text-emerald-400 mb-4 opacity-70" />
                        <h3 className="text-xl font-bold text-emerald-200 uppercase">Estoque Equilibrado</h3>
                        <p className="text-emerald-400/80 mt-2">Nenhuma campanha emergencial sugerida no momento.</p>
                    </div>
                ) : (
                    stockKits.map(kit => (
                        <div key={kit.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors group relative overflow-hidden backdrop-blur-md">
                            <div className={`absolute top-0 left-0 w-1 h-full ${kit.priority === 'CRITICA' ? 'bg-rose-500' : kit.priority === 'ALTA' ? 'bg-amber-500' : 'bg-blue-500'}`} />

                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors uppercase pr-8">
                                    {kit.title}
                                </h3>
                                <span className={`px-2 py-1 text-[10px] uppercase font-black rounded-lg ${kit.priority === 'CRITICA' ? 'bg-rose-500/30 text-rose-300' : kit.priority === 'ALTA' ? 'bg-amber-500/30 text-amber-300' : 'bg-blue-500/30 text-blue-300'}`}>
                                    {kit.priority}
                                </span>
                            </div>

                            <p className="text-white/70 text-sm mb-6 leading-relaxed">
                                {kit.description}
                            </p>

                            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                                <span className="text-xs font-bold text-white/50 flex items-center gap-2">
                                    <Megaphone size={14} className="text-indigo-400" />
                                    {kit.action}
                                </span>
                                <button className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">
                                    Executar
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-3xl p-8 backdrop-blur-xl mt-8">
                <h3 className="text-2xl font-black text-indigo-300 uppercase mb-6 flex items-center gap-3">
                    <MessageCircle className="w-8 h-8 text-indigo-400" />
                    Sugestões de Scripts (Isabela IA)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-black/30 rounded-2xl p-6 border border-white/5">
                        <h4 className="text-sm font-bold text-blue-400 uppercase mb-4">Script Padrão (Reativação B2B)</h4>
                        <p className="text-white/80 font-mono text-sm leading-relaxed">
                            "Oi [Nome do Açougue], notei que você não pega mercadoria com a gente há [Dias] dias. O boi que abateu sexta está com o marmoreio perfeito para a sua vitrine que exige [Padrão de Gordura]. Separei 2 traseiros pra você com 5% off. Fecho o pedido?"
                        </p>
                        <button className="mt-4 text-xs font-bold text-blue-300 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2">
                            Copiar Script <Search size={12} />
                        </button>
                    </div>
                    <div className="bg-black/30 rounded-2xl p-6 border border-white/5">
                        <h4 className="text-sm font-bold text-rose-400 uppercase mb-4">Script Queima de Dianteiro (B2C Ads)</h4>
                        <p className="text-white/80 font-mono text-sm leading-relaxed">
                            "Kit Mistura Econômico: 5kg de Acém + 3kg de Músculo. A carne perfeita para a panela da sua família com preço de atacado direto do Frigorífico! Clique e peça pelo WhatsApp com entrega grátis."
                        </p>
                        <button className="mt-4 text-xs font-bold text-rose-300 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2">
                            Copiar Script <Search size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderClientsTab = () => (
        <div className="space-y-6 animate-fade-in relative z-10">

            <div className="flex gap-6 mb-8">
                <div className="flex-1 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 backdrop-blur-md">
                    <h4 className="text-rose-400 font-bold uppercase text-sm mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Clientes Esfriando</h4>
                    <p className="text-4xl font-black text-rose-200">{coolingClients.length}</p>
                </div>
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-md">
                    <h4 className="text-emerald-400 font-bold uppercase text-sm mb-2 flex items-center gap-2"><TrendingUp size={16} /> Clientes Quentes</h4>
                    <p className="text-4xl font-black text-emerald-200">{hotClients.length}</p>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Radar de Retenção RFM</h3>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-white/50" />
                        <select className="bg-transparent border-none text-white/70 text-sm focus:ring-0 cursor-pointer">
                            <option value="all">Filtro: Maior Risco de Churn</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/30 border-b border-white/10">
                                <th className="py-4 px-6 text-[10px] font-black uppercase text-white/50 tracking-wider">Cliente / Empresa</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase text-white/50 tracking-wider text-center">Status</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase text-white/50 tracking-wider text-center">Dias sem Compra</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase text-white/50 tracking-wider text-center">Perfil Exigido</th>
                                <th className="py-4 px-6 text-[10px] font-black uppercase text-white/50 tracking-wider text-right">Ação Sugerida</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {coolingClients.slice(0, 10).map((client) => (
                                <tr key={client.id_ferro} className="hover:bg-white/5 transition-colors group">
                                    <td className="py-4 px-6">
                                        <div className="font-bold text-white group-hover:text-blue-300 transition-colors uppercase text-sm">{client.nome_social}</div>
                                        <div className="text-xs text-white/50 flex items-center gap-2 mt-1">
                                            <Phone size={10} /> {client.whatsapp}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-[10px] font-black uppercase inline-block">Esfriando</span>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className="text-rose-400 font-bold">{client.daysSinceLastPurchase} dias</span>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="text-xs text-white/70 font-mono">
                                            {client.perfil_compra || 'MISTO'} | {client.padrao_gordura || 'MÉDIO'}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors inline-block">
                                            Acionar Marcos p/ Brinde
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {coolingClients.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-white/40 italic">Nenhum cliente na zona de risco!</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderStitchConfig = () => (
        <div className="space-y-6 animate-fade-in relative z-10 w-full max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-fuchsia-900/40 to-pink-900/40 border border-fuchsia-500/30 rounded-3xl p-8 backdrop-blur-xl mb-8 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-fuchsia-400 uppercase tracking-wider mb-2 flex items-center gap-3">
                        <Settings className="w-8 h-8" /> Configuração Stitch AI & Integrações
                    </h2>
                    <p className="text-fuchsia-200/70 max-w-xl">
                        Painel de controle da integração com a plataforma Stitch para automação avançada de Marketing omni-channel (WhatsApp, Instagram, Ads).
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* STITCH TOKEN */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-8 relative overflow-hidden backdrop-blur-md">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Settings className="w-32 h-32 text-fuchsia-500 animate-spin-slow" />
                    </div>

                    <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-500" /> Webhook Stitch Ativo
                    </h3>

                    <div className="grid gap-6 relative z-10">
                        <div>
                            <label className="block text-xs font-black text-white/50 uppercase tracking-widest mb-2">Token de Oauth (Stitch)</label>
                            <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                <input
                                    type="text"
                                    readOnly
                                    value="AQ.Ab8RN6KeqHg7jTUxUbQIgHt6-dr3Ia07lg3LM5SbG7SEjhIzjw"
                                    className="bg-transparent text-fuchsia-300 font-mono text-sm w-full p-4 outline-none select-all"
                                />
                                <div className="bg-fuchsia-500/20 px-6 font-bold text-fuchsia-400 text-xs flex items-center uppercase border-l border-white/10">
                                    Conectado
                                </div>
                            </div>
                            <p className="text-[10px] text-emerald-400/80 mt-2 font-black uppercase tracking-widest">
                                ✅ O Stitch agora monitora as ações de CRM e Estoque B2B.
                            </p>
                        </div>
                    </div>
                </div>

                {/* SOCIAL MEDIA CONNECTIONS */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-8 backdrop-blur-md flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Canais de Disparo</h3>

                    <button className="flex items-center justify-between p-4 bg-white/5 border border-emerald-500/30 rounded-xl hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <MessageCircle size={20} className="text-emerald-400" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white uppercase tracking-wider">WhatsApp Business API</p>
                                <p className="text-xs text-emerald-400 font-bold">Conectado (+55 11 9999-9999)</p>
                            </div>
                        </div>
                        <Settings size={16} className="text-white/30 group-hover:text-white/80 transition-colors" />
                    </button>

                    <button className="flex items-center justify-between p-4 bg-white/5 border border-rose-500/30 rounded-xl hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                                <Instagram size={20} className="text-rose-400" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white uppercase tracking-wider">Instagram Auto-DM / Ads</p>
                                <p className="text-xs text-rose-400 font-bold">Conectado (@frigogest_oficial)</p>
                            </div>
                        </div>
                        <Settings size={16} className="text-white/30 group-hover:text-white/80 transition-colors" />
                    </button>

                    <button className="flex items-center justify-between p-4 bg-white/5 border border-blue-500/30 rounded-xl hover:bg-white/10 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <Megaphone size={20} className="text-blue-400" />
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white uppercase tracking-wider">Meta Ads Manager</p>
                                <p className="text-xs text-white/40">Clique para conectar</p>
                            </div>
                        </div>
                        <Link size={16} className="text-white/30 group-hover:text-white/80 transition-colors" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderAcademyTab = () => (
        <div className="space-y-6 animate-fade-in relative z-10 w-full max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-3xl p-8 backdrop-blur-xl mb-8">
                <h2 className="text-2xl font-black text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-3">
                    <BookOpen className="w-8 h-8" /> Escola de Marketing Isabela (IA)
                </h2>
                <p className="text-blue-200/70 max-w-2xl">
                    Aprenda a fazer propagandas mortais. A Isabela te ensina passo-a-passo como criar anúncios, gerenciar tráfego e vender cortes encalhados para qualquer público.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors group cursor-pointer">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <PlayCircle size={24} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase mb-2">Como Desovar Dianteiro</h3>
                    <p className="text-sm text-white/60 mb-4">Aprenda a criar a campanha "Kit Mistura" no Instagram para atingir donas de casa em um raio de 5km.</p>
                    <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Assistir Aula &rarr;</span>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors group cursor-pointer">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <MessageCircle size={24} className="text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase mb-2">Scripts Implacáveis no Whats</h3>
                    <p className="text-sm text-white/60 mb-4">Não tome mais vácuo de açougueiro. Estruturas de Copywriting validadas para vender traseiro a prazo.</p>
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Acessar Templates &rarr;</span>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors group cursor-pointer">
                    <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Target size={24} className="text-rose-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase mb-2">Estratégia Sniper B2B</h3>
                    <p className="text-sm text-white/60 mb-4">Como mapear Churrascarias de Luxo na sua região e criar uma oferta irresistível de Picanha/Mignon.</p>
                    <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Inciar Treinamento &rarr;</span>
                </div>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center mt-6">
                <Bot size={48} className="text-blue-500/50 mb-4" />
                <h3 className="text-xl font-black text-white uppercase">Precisa de Ajuda Específica?</h3>
                <p className="text-white/60 mt-2 max-w-md">Pergunte para a Isabela no Chat IA como resolver qualquer problema de vendas ou marketing.</p>
                <button className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl uppercase tracking-widest transition-colors shadow-lg shadow-blue-900/20">
                    Falar com Isabela
                </button>
            </div>
        </div>
    );

    const renderStudioTab = () => (
        <div className="space-y-6 animate-fade-in relative z-10 w-full max-w-lg mx-auto bg-[#faf8f8] rounded-[2.5rem] p-6 text-slate-800 shadow-2xl border border-white/20">
            {/* Header / Logo */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-[#e11d48] font-black text-xl tracking-tighter leading-none">COMANDO CRIATIVO</h2>
                    <p className="text-slate-400 font-bold text-[10px] tracking-widest uppercase mt-1">Estúdio de Marketing IA</p>
                </div>
                <div className="flex gap-2">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                        <Zap size={18} className="text-rose-500" />
                    </div>
                    <div className="w-10 h-10 rounded-full bg-orange-200 overflow-hidden border-2 border-white shadow-sm flex items-center justify-center">
                        <Bot size={20} className="text-orange-900" />
                    </div>
                </div>
            </div>

            {/* GEMINI IMAGEN - Gerador de Artes IA */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-xs">Gerador de Artes IA</h3>
                    <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase shadow-lg shadow-violet-500/30">Gemini Imagen</span>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_rgba(139,92,246,0.12)] border border-violet-50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 via-fuchsia-500 to-rose-500" />
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1 flex items-center gap-2">
                                <Paintbrush size={18} className="text-violet-500" /> Arte Instantanea
                            </h4>
                            <p className="text-slate-400 text-xs">Crie imagens profissionais para marketing</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                            <Image size={18} className="text-violet-600" />
                        </div>
                    </div>

                    {/* Templates */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {IMAGEN_TEMPLATES.map((t, i) => (
                            <button key={i} onClick={() => { setImagenPrompt(t.prompt); generateImage(t.prompt); }}
                                className="px-3 py-1.5 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-full text-[10px] font-bold text-slate-600 hover:text-violet-700 transition-all">
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Prompt Input */}
                    <div className="flex gap-2 mb-4">
                        <input value={imagenPrompt} onChange={e => setImagenPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && generateImage(imagenPrompt)}
                            placeholder="Descreva a imagem que deseja criar..."
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                        <button onClick={() => generateImage(imagenPrompt)} disabled={imagenLoading}
                            className="px-5 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:shadow-lg hover:shadow-violet-500/30 transition-all disabled:opacity-50 flex items-center gap-2">
                            {imagenLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                            {imagenLoading ? 'Criando...' : 'Gerar'}
                        </button>
                    </div>

                    {/* Error */}
                    {imagenError && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold">{imagenError}</div>}

                    {/* Preview */}
                    {generatedImages.length > 0 && (
                        <div className="mb-4">
                            <div className="relative rounded-2xl overflow-hidden border border-violet-100 shadow-lg">
                                <img src={generatedImages[0].url} alt="Arte gerada" className="w-full object-cover" />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                                    <p className="text-white text-[10px] font-bold truncate mb-2">{generatedImages[0].prompt}</p>
                                    <div className="flex gap-2">
                                        <a href={generatedImages[0].url} download={`arte-${Date.now()}.png`}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-[9px] font-black uppercase tracking-widest hover:bg-white/30 transition-all">
                                            <Download size={12} /> Baixar
                                        </a>
                                        <button onClick={() => generateImage(imagenPrompt)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-violet-500/50 backdrop-blur-sm rounded-full text-white text-[9px] font-black uppercase tracking-widest hover:bg-violet-500/70 transition-all">
                                            <RefreshCw size={12} /> Nova
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History Grid */}
                    {generatedImages.length > 1 && (
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Historico ({generatedImages.length})</p>
                            <div className="grid grid-cols-3 gap-2">
                                {generatedImages.slice(1, 7).map((img, i) => (
                                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-slate-100 cursor-pointer hover:shadow-md transition-all">
                                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Corporate Identity Grid */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <Grid size={16} className="text-[#e11d48]" />
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-xs">Identidade Corporativa</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Block 1 */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer relative overflow-hidden">
                        <div className="w-24 h-24 bg-slate-50 rounded-full absolute -top-8 -right-8" />
                        <Sparkles size={24} className="text-[#0f172a] mb-8 relative z-10" />
                        <h4 className="font-black text-slate-900 tracking-tight text-lg leading-none mb-2">Minhas Marcas</h4>
                        <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase leading-tight">Showcase de Produtos</p>
                    </div>

                    {/* Block 2 */}
                    <div className="bg-[#0f172a] rounded-[2rem] p-6 shadow-xl shadow-slate-900/20 hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                        <div className="w-32 h-32 bg-indigo-500/20 rounded-full absolute -bottom-10 -right-10 blur-xl" />
                        <Contact size={24} className="text-[#e11d48] mb-8 relative z-10" />
                        <h4 className="font-black text-white tracking-tight text-lg leading-none mb-2">Cartão B2B</h4>
                        <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase leading-tight">Digital Inteligente</p>
                    </div>

                    {/* Block 3 */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer">
                        <FileText size={24} className="text-[#e11d48] mb-8" />
                        <h4 className="font-black text-slate-900 tracking-tight text-lg leading-none mb-2">Catálogos</h4>
                        <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase leading-tight">PDF Gerado por IA</p>
                    </div>

                    {/* Block 4 */}
                    <div className="bg-rose-50/50 rounded-[2rem] p-6 shadow-sm border border-rose-100 hover:shadow-md transition-all cursor-pointer">
                        <QrCode size={24} className="text-[#e11d48] mb-8" />
                        <h4 className="font-black text-[#e11d48] tracking-tight text-lg leading-none mb-2">Etiquetas</h4>
                        <p className="text-[9px] font-bold text-rose-400/80 tracking-widest uppercase leading-tight">QR & Branding</p>
                    </div>
                </div>
            </div>

            {/* Direct Marketing */}
            <div className="bg-[#e11d48] rounded-[2.5rem] p-8 shadow-2xl shadow-rose-500/30 relative overflow-hidden">
                {/* Floating Add icon */}
                <button className="absolute -top-4 -right-4 w-20 h-20 bg-rose-600 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                    <Plus size={32} className="text-white relative top-2 right-2" />
                </button>
                <div className="absolute right-6 top-16 opacity-30">
                    <Sparkles size={24} className="text-white" />
                </div>

                <h4 className="text-2xl font-black text-white tracking-tight leading-none mb-1">Marketing Direto</h4>
                <p className="text-[10px] font-bold text-rose-200 tracking-widest uppercase mb-8">Acelere suas vendas</p>

                <div className="space-y-3">
                    <button className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 transition-colors rounded-3xl p-4 border border-white/20">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                                <Search size={18} className="text-[#e11d48]" />
                            </div>
                            <div className="text-left">
                                <p className="font-black text-white text-sm tracking-tight">BUSCA DE LEADS</p>
                                <p className="text-[10px] text-rose-200">Encontre novos compradores B2B</p>
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-white/70" />
                    </button>

                    <button className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 transition-colors rounded-3xl p-4 border border-white/20">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                                <Megaphone size={18} className="text-[#e11d48]" />
                            </div>
                            <div className="text-left">
                                <p className="font-black text-white text-sm tracking-tight">DISPARO EM MASSA</p>
                                <p className="text-[10px] text-rose-200">Ofertas diretas no WhatsApp</p>
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-white/70" />
                    </button>
                </div>
            </div>

            {/* AI Active Stats */}
            <div className="mt-8 pt-8 border-t border-slate-200 text-center">
                <p className="text-[9px] font-black text-slate-400 tracking-[0.3em] uppercase mb-6 flex items-center justify-center gap-2">
                    Alta Velocidade <span className="w-1 h-1 rounded-full bg-slate-300" /> IA Ativa
                </p>
                <div className="flex justify-between divide-x divide-slate-200">
                    <div className="flex-1">
                        <p className="text-3xl font-black text-slate-900 leading-none">128</p>
                        <p className="text-[8px] font-bold text-slate-400 tracking-widest uppercase mt-2">Leads Hoje</p>
                    </div>
                    <div className="flex-1">
                        <p className="text-3xl font-black text-slate-900 leading-none">42</p>
                        <p className="text-[8px] font-bold text-slate-400 tracking-widest uppercase mt-2">Vídeos Gerados</p>
                    </div>
                    <div className="flex-1">
                        <p className="text-3xl font-black text-slate-900 leading-none">15</p>
                        <p className="text-[8px] font-bold text-slate-400 tracking-widest uppercase mt-2">Disparos</p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderSuppliersTab = () => (
        <div className="space-y-6 animate-fade-in relative z-10">
            <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/30 rounded-3xl p-8 backdrop-blur-xl mb-8 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-3">
                        <Gift className="w-8 h-8" /> Estratégia de Moat (Gifting)
                    </h2>
                    <p className="text-amber-200/70 max-w-xl">
                        Crie um "fosso competitivo" fidelizando os melhores fornecedores da região. Pecuaristas de elite recebem mimos estratégicos que fecham a porta para os concorrentes.
                    </p>
                </div>
                <div className="hidden lg:block opacity-60">
                    <Star className="w-24 h-24 text-amber-500 p-4 border border-amber-500/30 rounded-full bg-amber-500/10" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vipSuppliers.map((supplier, idx) => (
                    <div key={supplier.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                        {idx === 0 && (
                            <div className="absolute top-4 right-4 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-amber-500/30">
                                TOP #1
                            </div>
                        )}

                        <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors uppercase mb-1 pr-16 truncate">
                            {supplier.nome_fantasia}
                        </h3>
                        <p className="text-xs text-white/50 mb-6 font-mono">{supplier.regiao || 'Região Não Especificada'}</p>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Vol. Negociado</p>
                                <p className="text-lg font-black text-white">{supplier.totalHeads} <span className="text-xs text-white/50 font-normal">cab</span></p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Total (R$)</p>
                                <p className="text-lg font-black text-emerald-400">{((supplier.totalValue || 0) / 1000).toFixed(0)}k</p>
                            </div>
                        </div>

                        {supplier.needsGift ? (
                            <div className="bg-gradient-to-r from-amber-500/10 to-transparent p-4 rounded-xl border border-amber-500/20">
                                <p className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-2"><Gift size={14} /> Ação Recomendada</p>
                                <p className="text-sm text-amber-100/80 mb-4 ">Enviar Kit Faca SG Chef Premium + Vinho.</p>
                                <button className="w-full bg-amber-500/20 text-amber-300 hover:bg-amber-500 text-xs font-black uppercase py-2 rounded-lg transition-colors border border-amber-400/50">
                                    Registrar Envio
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white/5 p-4 rounded-xl text-center border border-white/10">
                                <p className="text-xs text-white/40 uppercase font-bold">Monitorando Volume</p>
                                <div className="w-full bg-black/40 h-2 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-blue-500 h-full" style={{ width: `${Math.min((supplier.totalHeads / 100) * 100, 100)}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {vipSuppliers.length === 0 && (
                    <div className="col-span-full p-12 text-center text-white/40 font-bold bg-white/5 rounded-3xl border border-white/10">
                        Nenhum fornecedor com volume suficiente para análise VIP ainda.
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0a1929] to-indigo-950 p-6 lg:p-12 relative overflow-hidden font-sans">

            {/* BACKGROUND EFFECTS */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-7xl mx-auto flex flex-col items-center">

                {/* HEADER */}
                <div className="text-center space-y-4 mb-12 relative z-10 w-full animate-fade-in-down">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-500/20 backdrop-blur-xl rounded-full shadow-2xl border border-indigo-400/30 mb-2 relative">
                        <Bot size={40} className="text-indigo-400" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-widest uppercase">
                        HUB <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">MARKETING</span>
                    </h1>

                    <p className="text-indigo-200/70 text-sm font-medium tracking-widest max-w-2xl mx-auto uppercase">
                        Inteligência Comercial, CRM Profundo e Relacionamento B2B dirigidos por Isabela (IA)
                    </p>
                </div>

                {/* NAVIGATION TABS */}
                <div className="flex flex-wrap justify-center gap-4 mb-12 relative z-10 animate-fade-in">
                    {[
                        { id: 'campaigns', label: 'Campanhas Sugeridas', icon: Megaphone },
                        { id: 'clients', label: 'CRM B2B', icon: Target },
                        { id: 'studio', label: 'Comando Criativo', icon: Wand2 },
                        { id: 'stitch', label: 'Integrações (Stitch)', icon: Settings },
                        { id: 'academy', label: 'Escola de Vendas (IA)', icon: BookOpen },
                        { id: 'supplier-vip', label: 'Fornecedores VIP', icon: Gift },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isActive
                                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-[0_0_30px_rgba(79,70,229,0.2)]'
                                    : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80'
                                    }`}
                            >
                                <Icon size={16} className={isActive ? 'text-indigo-400' : 'opacity-50'} />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* CONTENT AREA */}
                <div className="w-full relative">
                    {activeTab === 'campaigns' && renderCampaigns()}
                    {activeTab === 'clients' && renderClientsTab()}
                    {activeTab === 'studio' && renderStudioTab()}
                    {activeTab === 'stitch' && renderStitchConfig()}
                    {activeTab === 'academy' && renderAcademyTab()}
                    {activeTab === 'supplier-vip' && renderSuppliersTab()}
                </div>

            </div>
        </div>
    );
};

export default MarketingHub;
