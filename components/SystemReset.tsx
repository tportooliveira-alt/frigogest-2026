import React, { useState } from 'react';
import {
    Trash2,
    AlertTriangle,
    ShieldAlert,
    CheckCircle,
    RefreshCcw,
    ArrowLeft,
    Zap,
    Activity,
    Shield,
    Lock,
    Key,
    ShieldOff,
    Target,
    Sword,
    Database
} from 'lucide-react';
import { db } from '../firebaseClient';
import { collection, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { StockType } from '../types';

interface SystemResetProps {
    onBack: () => void;
    refreshData: () => void;
}

const SystemReset: React.FC<SystemResetProps> = ({ onBack, refreshData }) => {
    const [status, setStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [confirmText, setConfirmText] = useState('');
    const [showWarning, setShowWarning] = useState(true); // Mostra aviso de risco primeiro

    const handleReset = async () => {
        if (confirmText !== 'ZERAR SISTEMA') return alert('Confirmação incorreta');
        if (!window.confirm("AÇÃO CRÍTICA: Deseja realmente apagar todos os dados de operação?")) return;

        setLoading(true); setStatus('Inicializando sequência de limpeza...');
        try {
            const collections = ['batches', 'sales', 'stock_items', 'transactions', 'scheduled_orders', 'daily_reports', 'payables'];
            for (const colName of collections) {
                setStatus(`Limpando base: ${colName.toUpperCase()}...`);
                const snap = await getDocs(collection(db, colName));
                if (snap.empty) continue;
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            alert('Sistema reiniciado com sucesso. Cadastros preservados.');
            refreshData();
            setStep(1); setConfirmText('');
            onBack();
        } catch (e) { setStatus('Erro durante a operação de limpeza'); }
        finally { setLoading(false); }
    };

    const handleCleanTestData = async () => {
        if (!window.confirm("🧹 Limpar dados de teste?\n\nIsto removerá:\n• Todos os lotes\n• Todo o estoque\n• Todas as vendas\n• Todas as transações\n\nMas MANTERÁ:\n✅ Clientes\n✅ Fornecedores\n\nDeseja continuar?")) return;

        setLoading(true); setStatus('Limpando dados de teste...');
        try {
            const collections = ['batches', 'sales', 'stock_items', 'transactions', 'scheduled_orders', 'daily_reports', 'payables'];
            for (const colName of collections) {
                setStatus(`Limpando: ${colName.toUpperCase()}...`);
                const snap = await getDocs(collection(db, colName));
                if (snap.empty) continue;
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            setStatus('✅ Sistema limpo! Clientes e fornecedores preservados.');
            alert('✅ Dados de teste removidos!\n\nSistema pronto para produção.\nClientes e fornecedores foram preservados.');
            refreshData();
            onBack();
        } catch (e) {
            console.error(e);
            setStatus('❌ Erro durante limpeza');
        }
        finally { setLoading(false); }
    };

    const handleSimulation = async () => {
        if (!window.confirm("Protocolo de Simulação: Deseja carregar o cenário de teste estratégico (Guerra)?")) return;
        setLoading(true); setStatus('Injetando dados de guerra no FG-CORE...');

        try {
            const batch = writeBatch(db);
            const today = new Date();
            const past25 = new Date(today.getTime() - (25 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
            const past15 = new Date(today.getTime() - (15 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
            const past5 = new Date(today.getTime() - (5 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
            const tomorrow = new Date(today.getTime() + (24 * 60 * 60 * 1000)).toISOString().split('T')[0];

            // 1. LOTES COM RENDIMENTOS DISTINTOS
            const loteBom = {
                id_lote: 'L-TOP-01', fornecedor: 'FAZENDA ELITE', data_recebimento: past15,
                peso_total_romaneio: 500, valor_compra_total: 10000, frete: 200, gastos_extras: 0, custo_real_kg: 20.4, status: 'FECHADO'
            };
            const loteRuim = {
                id_lote: 'L-LOSS-02', fornecedor: 'FORNECEDOR C', data_recebimento: past5,
                peso_total_romaneio: 500, valor_compra_total: 10000, frete: 200, gastos_extras: 0, custo_real_kg: 20.4, status: 'FECHADO'
            };
            const loteAntigo = {
                id_lote: 'L-OLD-99', fornecedor: 'ESTOQUE ESQUECIDO', data_recebimento: past25,
                peso_total_romaneio: 1000, valor_compra_total: 20000, frete: 500, gastos_extras: 0, custo_real_kg: 20.5, status: 'FECHADO'
            };
            batch.set(doc(db, 'batches', loteBom.id_lote), loteBom);
            batch.set(doc(db, 'batches', loteRuim.id_lote), loteRuim);
            batch.set(doc(db, 'batches', loteAntigo.id_lote), loteAntigo);

            // 2. ESTOQUE (Mistura de Vendidos e Disponíveis)
            const item1 = { id_completo: 'L-TOP-01-01-INTEIRO', id_lote: 'L-TOP-01', sequencia: 1, tipo: StockType.INTEIRO, peso_entrada: 250, status: 'VENDIDO', data_entrada: past15 };
            const item2 = { id_completo: 'L-LOSS-02-01-INTEIRO', id_lote: 'L-LOSS-02', sequencia: 1, tipo: StockType.INTEIRO, peso_entrada: 250, status: 'VENDIDO', data_entrada: past5 };
            const item3 = { id_completo: 'L-OLD-99-01-INTEIRO', id_lote: 'L-OLD-99', sequencia: 1, tipo: StockType.INTEIRO, peso_entrada: 245, status: 'DISPONIVEL', data_entrada: past25 }; // OLD STOCK!
            const item4 = { id_completo: 'L-OLD-99-02-BANDA_A', id_lote: 'L-OLD-99', sequencia: 2, tipo: StockType.BANDA_A, peso_entrada: 122, status: 'DISPONIVEL', data_entrada: past25 }; // OLD STOCK!

            batch.set(doc(db, 'stock_items', item1.id_completo), item1);
            batch.set(doc(db, 'stock_items', item2.id_completo), item2);
            batch.set(doc(db, 'stock_items', item3.id_completo), item3);
            batch.set(doc(db, 'stock_items', item4.id_completo), item4);

            // 3. VENDAS (Uma atrasada para gerar FUMO, uma boa para Ranking)
            const vendaFumo = {
                id_venda: 'V-FUMO-01', id_cliente: '77', id_completo: item2.id_completo,
                peso_real_saida: 230, preco_venda_kg: 35, data_venda: past15, data_vencimento: past5, // ATRASADA 10 DIAS -> YIELD 92%
                status_pagamento: 'PENDENTE', quebra_kg: 20, lucro_liquido_unitario: 10, forma_pagamento: 'OUTROS', valor_pago: 0
            };
            const vendaElite = {
                id_venda: 'V-ELITE-01', id_cliente: '15', id_completo: item1.id_completo,
                peso_real_saida: 248, preco_venda_kg: 38, data_venda: past5, data_vencimento: tomorrow, // EM DIA
                status_pagamento: 'PAGO', quebra_kg: 2, lucro_liquido_unitario: 15, forma_pagamento: 'PIX', valor_pago: 248 * 38
            };
            batch.set(doc(db, 'sales', vendaFumo.id_venda), vendaFumo);
            batch.set(doc(db, 'sales', vendaElite.id_venda), vendaElite);

            // 4. TRANSAÇÃO INICIAL CAIXA
            batch.set(doc(db, 'transactions', 'TR-SIM-01'), {
                id: 'TR-SIM-01', data: past15, descricao: 'Saldo Inicial Simulação', tipo: 'ENTRADA', categoria: 'OUTROS', valor: 50000
            });

            await batch.commit();
            refreshData();
            alert('Cenário de Guerra atualizado: IA detectará Risco de Crédito, Quebra Industrial e Estoque Antigo!');
            onBack();
        } catch (e) {
            console.error(e);
            setStatus('Falha na injeção de dados');
        } finally { setLoading(false); }
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid flex items-center justify-center animate-reveal">

            {/* MODAL DE AVISO DE ALTO RISCO */}
            {showWarning && (
                <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] max-w-lg w-full overflow-hidden shadow-2xl border-4 border-rose-500">
                        {/* Header Vermelho */}
                        <div className="bg-gradient-to-r from-rose-600 to-red-700 p-8 text-center">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <AlertTriangle size={48} className="text-white" />
                            </div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tight">⚠️ ALTO RISCO ⚠️</h1>
                            <p className="text-rose-100 text-sm font-bold mt-2">ÁREA RESTRITA - ACESSO ADMINISTRATIVO</p>
                        </div>

                        {/* Conteúdo do Aviso */}
                        <div className="p-8 space-y-6">
                            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6">
                                <h3 className="text-rose-700 font-black text-sm uppercase mb-3">⛔ ATENÇÃO - LEIA COM CUIDADO:</h3>
                                <ul className="space-y-3 text-sm text-slate-700">
                                    <li className="flex items-start gap-2">
                                        <span className="text-rose-500 font-bold">•</span>
                                        <span>Esta área <strong className="text-rose-600">APAGA DADOS PERMANENTEMENTE</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-rose-500 font-bold">•</span>
                                        <span>Pode <strong className="text-rose-600">BAGUNÇAR TODO O FLUXO DE CAIXA</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-rose-500 font-bold">•</span>
                                        <span>Dados apagados <strong className="text-rose-600">NÃO PODEM SER RECUPERADOS</strong></span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                                <h3 className="text-blue-700 font-black text-sm uppercase mb-3">💡 RECOMENDAÇÃO:</h3>
                                <p className="text-sm text-slate-700">
                                    Para limpezas de dados, use o <strong className="text-blue-600">Firebase Console</strong> diretamente:
                                </p>
                                <p className="text-xs text-blue-600 font-mono mt-2 bg-blue-100 p-2 rounded-lg">
                                    console.firebase.google.com
                                </p>
                            </div>

                            {/* Botão para solicitar limpeza via WhatsApp */}
                            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
                                <h3 className="text-green-700 font-black text-sm uppercase mb-3">📱 SOLICITAR LIMPEZA:</h3>
                                <p className="text-sm text-slate-700 mb-4">
                                    Envie uma solicitação para o administrador limpar os dados pelo Firebase:
                                </p>
                                <button
                                    onClick={() => {
                                        const msg = encodeURIComponent(`🚨 *SOLICITAÇÃO DE LIMPEZA - FRIGOGEST*\n\n⚠️ Um usuário está solicitando limpeza de dados do sistema.\n\n📅 Data: ${new Date().toLocaleString('pt-BR')}\n\n❓ Por favor, acesse o Firebase Console e verifique se é necessário limpar alguma collection.\n\n🔗 console.firebase.google.com`);
                                        window.open(`https://wa.me/5577999226268?text=${msg}`, '_blank');
                                        alert('✅ Solicitação enviada!\n\nO administrador irá verificar e limpar os dados pelo Firebase se necessário.');
                                        onBack();
                                    }}
                                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black text-sm uppercase rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    📲 Solicitar Limpeza via WhatsApp
                                </button>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={onBack}
                                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase rounded-2xl transition-all shadow-lg"
                                >
                                    ✅ SAIR (RECOMENDADO)
                                </button>
                                <button
                                    onClick={() => setShowWarning(false)}
                                    className="flex-1 py-4 bg-slate-200 hover:bg-rose-600 hover:text-white text-slate-600 font-black text-sm uppercase rounded-2xl transition-all"
                                >
                                    Continuar mesmo assim
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[48px] border border-slate-100 w-full max-w-xl shadow-2xl overflow-hidden relative">

                {/* STATUS BAR */}
                <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-900/40">
                            <ShieldAlert size={16} />
                        </div>
                        <span className="text-[10px] font-black tracking-widest uppercase">Autorização de Nível 05</span>
                    </div>
                    <div className="flex gap-1.5 translate-x-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    </div>
                </div>

                <div className="p-10 md:p-16">
                    {step === 1 ? (
                        <div className="space-y-10">
                            <div className="text-center">
                                <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">
                                    Zona de <span className="text-rose-600">Perigo</span>
                                </h1>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Protocolo de Expurgo FG-CORE</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="rounded-[32px] border border-rose-100 p-8 bg-rose-50/20">
                                    <label className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4 block px-1">Dados a Apagar</label>
                                    <ul className="text-[10px] font-black text-slate-900 space-y-3 uppercase tracking-tighter">
                                        <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-rose-600" /> Lotes Ativos</li>
                                        <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-rose-600" /> Estoque Frio</li>
                                        <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-rose-600" /> Histórico de Vendas</li>
                                        <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-rose-600" /> Fluxo Financeiro</li>
                                    </ul>
                                </div>
                                <div className="rounded-[32px] border border-emerald-100 p-8 bg-emerald-50/20">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 block px-1">Dados Preservados</label>
                                    <ul className="text-[10px] font-black text-slate-900 space-y-3 uppercase tracking-tighter">
                                        <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-emerald-600" /> Clientes</li>
                                        <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-emerald-600" /> Fornecedores</li>
                                        <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-emerald-600" /> Contas e Bancos</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <button onClick={() => setStep(2)} className="w-full btn-modern bg-white border border-rose-100 text-rose-600 py-4 rounded-2xl hover:bg-rose-50 gap-4 shadow-sm transition-all font-black text-[10px] uppercase tracking-[0.2em]">
                                    <Trash2 size={16} /> Protocolo de Expurgo
                                </button>

                                <button onClick={handleCleanTestData} className="w-full btn-modern bg-white border border-blue-100 text-blue-600 py-4 rounded-2xl hover:bg-blue-50 gap-4 shadow-sm transition-all font-black text-[10px] uppercase tracking-[0.2em]">
                                    <Database size={16} /> Limpar Dados de Teste
                                </button>

                                <div className="relative py-4">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                                    <div className="relative flex justify-center text-[8px] font-black uppercase text-slate-300 bg-white px-4 tracking-[0.4em]">Ou</div>
                                </div>

                                <button onClick={handleSimulation} className="w-full btn-modern bg-slate-900 text-white py-5 rounded-2xl hover:bg-blue-600 gap-4 shadow-xl transition-all font-black text-xs uppercase tracking-[0.2em]">
                                    <Sword size={20} className="text-blue-400" /> Simular Cenário de Guerra
                                </button>

                                <button onClick={onBack} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 hover:text-slate-900 transition-colors flex items-center justify-center gap-2">
                                    <ArrowLeft size={12} /> Abortar e Voltar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-10 animate-reveal">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <Lock size={32} />
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Confirmação de Segurança Requerida</p>
                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-slate-900 uppercase tracking-widest mb-8 text-sm">
                                    "ZERAR SISTEMA"
                                </div>
                                <input
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    className="modern-input h-16 text-center font-black text-2xl uppercase"
                                    placeholder="DIGITAR CADEIA"
                                />
                            </div>

                            {loading ? (
                                <div className="text-center py-8">
                                    <Activity className="animate-spin text-rose-600 mx-auto mb-6" size={48} />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{status}</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <button
                                        onClick={handleReset}
                                        disabled={confirmText !== 'ZERAR SISTEMA'}
                                        className="w-full btn-modern bg-rose-600 text-white py-6 rounded-2xl hover:bg-slate-900 disabled:opacity-20 transition-all font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-rose-900/30"
                                    >
                                        <Zap size={20} /> Confirmar Expurgo
                                    </button>
                                    <button onClick={() => setStep(1)} disabled={loading} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 hover:text-slate-900 transition-colors">
                                        &larr; Voltar ao Início
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemReset;
