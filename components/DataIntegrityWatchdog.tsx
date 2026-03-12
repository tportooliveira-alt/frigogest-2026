import React, { useEffect, useState } from 'react';
import { StockItem, Sale, Transaction, Payable, Batch } from '../types';
import { AlertCircle, Trash2, X } from 'lucide-react';

interface WatchdogProps {
    stock: StockItem[];
    sales: Sale[];
    transactions: Transaction[];
    payables: Payable[];
    batches: Batch[];
}

interface Violation {
    id: string;
    type: 'ERROR' | 'WARNING';
    message: string;
    timestamp: string;
}

const DataIntegrityWatchdog: React.FC<WatchdogProps> = ({ stock, sales, transactions, payables, batches }) => {
    const [violations, setViolations] = useState<Violation[]>([]);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        // Run integrity checks
        const checkIntegrity = () => {
            const newViolations: Violation[] = [];

            // CHECK 1: Venda Paga sem dinheiro no Caixa (Fluxo)
            sales.forEach(sale => {
                if (sale.status_pagamento === 'PAGO' || (sale.valor_pago || 0) > 0) {
                    const txExists = transactions.some(t =>
                        // O ID de referência bate OU a string da descrição contém o cliente/venda
                        t.referencia_id === sale.id_venda ||
                        (t.descricao && t.descricao.includes(sale.id_venda)) ||
                        (t.id && t.id.includes(sale.id_venda))
                    );

                    if (!txExists) {
                        const id = `MISSING-TX-${sale.id_venda}`;
                        if (!dismissedIds.has(id)) {
                            newViolations.push({
                                id,
                                type: 'ERROR',
                                message: `Venda ${sale.id_venda} (${sale.nome_cliente}) tem pagamento de R$${sale.valor_pago?.toFixed(2)}, mas não gerou ENTRADA no caixa!`,
                                timestamp: new Date().toLocaleTimeString()
                            });
                        }
                    }
                }
            });

            // CHECK 2: Estoque vendido sem venda associada
            stock.forEach(item => {
                if (item.status === 'VENDIDO') {
                    const saleExists = sales.some(s =>
                        ((s as any).stock_ids_originais && (s as any).stock_ids_originais.includes(item.id_completo)) ||
                        s.id_completo === item.id_completo ||
                        s.id_completo.includes(item.id_completo)
                    );

                    if (!saleExists) {
                        const id = `GHOST-STOCK-${item.id_completo}`;
                        if (!dismissedIds.has(id)) {
                            newViolations.push({
                                id,
                                type: 'ERROR',
                                message: `Peça ${item.id_completo} consta como VENDIDA, mas não encontrei nenhum cupom/venda ligada a ela!`,
                                timestamp: new Date().toLocaleTimeString()
                            });
                        }
                    }
                }
            });

            // CHECK 3: Frete órfão ou pago sem conta correspondente
            batches.forEach(batch => {
                if ((batch.frete || 0) > 0) {
                    // SKIP: Lotes estornados não precisam de alerta de frete
                    if (batch.status === 'ESTORNADO') return;

                    // Verificação 1: Payable com id_lote que menciona frete
                    const hasFretePayable = payables.some(p =>
                        (p.id_lote === batch.id_lote ||
                            (p.id && p.id.includes(batch.id_lote))) &&
                        (p.descricao?.toLowerCase().includes('frete') ||
                            (p.id && p.id.startsWith('PAY-LOTE-FRETE-')))
                    );

                    // Verificação 2: Transação de frete específica (formato novo)
                    const hasFreteTx = transactions.some(t =>
                        (t.referencia_id === batch.id_lote ||
                            (t.id && t.id.includes(batch.id_lote)) ||
                            (t.descricao && t.descricao.includes(batch.id_lote))) &&
                        (t.descricao?.toLowerCase().includes('frete') ||
                            t.categoria === 'FRETE' as any)
                    );

                    // Verificação 3: Transação de compra geral que já inclui o frete no total
                    // (formato antigo: gado+frete+extras tudo numa transação TR-LOTE-xxx)
                    const hasCompraGeralComFrete = transactions.some(t =>
                        t.referencia_id === batch.id_lote &&
                        t.categoria === 'COMPRA_GADO' &&
                        t.tipo === 'SAIDA' &&
                        t.valor >= ((batch.valor_compra_total || 0) + (batch.frete || 0))
                    );

                    if (!hasFretePayable && !hasFreteTx && !hasCompraGeralComFrete) {
                        const id = `MISSING-FREIGHT-${batch.id_lote}`;
                        if (!dismissedIds.has(id)) {
                            newViolations.push({
                                id,
                                type: 'WARNING',
                                message: `Lote ${batch.id_lote} possui frete de R$${batch.frete?.toFixed(2)}, mas não foi lançado no Contas a Pagar/Caixa. Verifique se comprou com a versão antiga.`,
                                timestamp: new Date().toLocaleTimeString()
                            });
                        }
                    }
                }
            });

            // Atualiza estado se mudou
            setViolations(prev => {
                const newIds = newViolations.map(v => v.id);
                const kept = prev.filter(v => newIds.includes(v.id));
                const toAdd = newViolations.filter(nv => !prev.some(pv => pv.id === nv.id));
                return [...kept, ...toAdd];
            });
        };

        const interval = setInterval(checkIntegrity, 5000); // Roda a cada 5s
        checkIntegrity(); // Roda na hora

        return () => clearInterval(interval);
    }, [stock, sales, transactions, payables, batches, dismissedIds]);

    if (violations.length === 0) return null;

    const handleClear = () => {
        setDismissedIds(prev => new Set([...prev, ...violations.map(v => v.id)]));
        setViolations([]);
    };

    return (
        <div className={`fixed bottom-4 left-4 z-[9999] bg-white rounded-2xl shadow-2xl border-2 transition-all ${violations.some(v => v.type === 'ERROR') ? 'border-rose-500 shadow-rose-500/20' : 'border-orange-500 shadow-orange-500/20'} ${isMinimized ? 'w-16 h-16 cursor-pointer hover:scale-105' : 'w-96'}`}>

            {isMinimized ? (
                <div onClick={() => setIsMinimized(false)} className="w-full h-full flex items-center justify-center text-rose-600 bg-rose-50 rounded-xl relative">
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-[10px] text-white font-black shadow-lg shadow-rose-500/50 animate-bounce">{violations.length}</div>
                    <AlertCircle size={28} />
                </div>
            ) : (
                <div className="flex flex-col h-full max-h-[80vh]">
                    <div className="bg-rose-600 text-white p-4 rounded-t-xl flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={20} />
                            <span className="font-black uppercase tracking-widest text-[10px]">IA Auditora (Live)</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleClear} className="p-1 px-3 text-[9px] font-black uppercase tracking-tighter bg-white/20 hover:bg-white/40 rounded transition-colors flex items-center gap-1"><Trash2 size={12} /> Limpar</button>
                            <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-rose-700 rounded transition-colors"><X size={16} /></button>
                        </div>
                    </div>
                    <div className="p-4 overflow-y-auto overflow-x-hidden custom-scrollbar max-h-96 flex flex-col gap-3">
                        <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-widest">Encontrei {violations.length} erro(s) operacionais:</p>
                        {violations.map(v => (
                            <div key={v.id} className={`p-3 rounded-xl border-l-4 shadow-sm text-xs font-bold leading-relaxed relative ${v.type === 'ERROR' ? 'bg-white border-rose-500 text-slate-700' : 'bg-white border-orange-500 text-slate-700'}`}>
                                <span className={`block absolute -top-2 -right-1 px-2 py-0.5 rounded text-[8px] font-black text-white ${v.type === 'ERROR' ? 'bg-rose-500' : 'bg-orange-500'}`}>{v.timestamp}</span>
                                {v.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataIntegrityWatchdog;
