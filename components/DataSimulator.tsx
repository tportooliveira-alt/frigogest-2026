import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Eye,
    Database,
    ArrowLeft,
    Trash2,
    PlayCircle
} from 'lucide-react';
import { Client, Batch, StockItem, Sale } from '../types';

interface DataSimulatorProps {
    onBack: () => void;
    onApplySimulation: (type: 'clients' | 'batches' | 'sales' | 'full', data: any) => void;
}

const DataSimulator: React.FC<DataSimulatorProps> = ({ onBack, onApplySimulation }) => {
    const [fileData, setFileData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [importType, setImportType] = useState<'clients' | 'batches' | 'sales' | 'full'>('full');
    const [fileName, setFileName] = useState<string>('');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            // Getting raw data as array of arrays to handle complex headers
            const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            if (rawData.length > 1) {
                // Try to find headers in Row 1 or Row 2
                let headerRow = rawData[0];
                let dataStart = 1;

                // Thiago 704 Special: Header in Row 2 if Row 1 is mostly empty or says "Despesa/Vendas"
                if (headerRow.includes('Despesa') || headerRow.includes('Vendas') || headerRow.filter(x => !!x).length < 5) {
                    headerRow = rawData[1];
                    dataStart = 2;
                }

                setHeaders(headerRow.map(h => String(h || '')));

                // Convert to objects based on the found headerRow
                const objects = rawData.slice(dataStart).map(row => {
                    const obj: any = {};
                    headerRow.forEach((header, idx) => {
                        if (header) obj[header] = row[idx];
                    });
                    return obj;
                });

                setFileData(objects.filter(obj => Object.keys(obj).length > 0));
            }
        };
        reader.readAsBinaryString(file);
    };

    const processFullSimulation = () => {
        const sales: any[] = [];
        const transactions: any[] = [];

        fileData.forEach((row, idx) => {
            // Mapeamento para Thiago 704
            // Col 5: Cliente, Col 14: valor venda
            const cliente = row['Cliente'];
            const valorVendaStr = row['valor venda'];
            const valorVenda = typeof valorVendaStr === 'string' ? parseFloat(valorVendaStr.replace('R$', '').replace('.', '').replace(',', '.')) : valorVendaStr;

            if (cliente && valorVenda > 0) {
                sales.push({
                    id_venda: `SIM-S-${idx}`,
                    id_cliente: cliente.split('-')[0].trim(),
                    nome_cliente: cliente.split('-').slice(1).join('-').trim() || cliente,
                    id_completo: `LOTE-${row['Seq'] || idx}`,
                    peso_real_saida: row['peso'] || 0,
                    preco_venda_kg: typeof row['Venda Kg'] === 'string' ? parseFloat(row['Venda Kg'].replace('R$', '').replace('.', '').replace(',', '.')) : row['Venda Kg'],
                    data_venda: row['data'] || new Date().toISOString().split('T')[0],
                    quebra_kg: 0,
                    lucro_liquido_unitario: 0,
                    custo_extras_total: 0,
                    prazo_dias: 0,
                    data_vencimento: new Date().toISOString().split('T')[0],
                    forma_pagamento: 'OUTROS',
                    status_pagamento: row['sit.'] === 'DV' ? 'PENDENTE' : 'PAGO',
                    valor_total: valorVenda
                });
            }

            // Col 1: Descrição / Fornecedor, Col 2: Valor
            const desc = row['Descrição / Fornecedor'];
            const valorDespesaStr = row['Valor'];
            const valorDespesa = typeof valorDespesaStr === 'string' ? parseFloat(valorDespesaStr.replace('R$', '').replace('.', '').replace(',', '.')) : valorDespesaStr;

            if (desc && valorDespesa > 0) {
                transactions.push({
                    id: `SIM-T-${idx}`,
                    data: row['Data'] || new Date().toISOString().split('T')[0],
                    descricao: desc,
                    tipo: 'SAIDA',
                    categoria: 'OPERACIONAL',
                    valor: valorDespesa
                });
            }
        });

        onApplySimulation('full', { sales, transactions });
    };

    const applyStandardSimulation = () => {
        onApplySimulation(importType, fileData);
    };

    const clearData = () => {
        setFileData([]);
        setHeaders([]);
        setFileName('');
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] animate-reveal pb-20 font-sans">
            <div className="max-w-7xl mx-auto flex flex-col gap-8">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex flex-col gap-4">
                        <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-700 hover:border-blue-100 transition-all shadow-sm">
                            <ArrowLeft size={14} /> Voltar
                        </button>
                        <div className="flex items-center gap-5">
                            <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-xl shadow-emerald-200">
                                <Database size={28} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                    Simulador de <span className="text-emerald-600">Dados Local</span>
                                </h1>
                                <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                    Teste seu Excel antes de salvar no Banco / ID-SIM
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT: UPLOAD & CONFIG */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                                <Upload size={18} className="text-emerald-500" /> 1. Carregar Arquivo
                            </h3>

                            {!fileName ? (
                                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-200 rounded-[32px] cursor-pointer hover:bg-slate-50 transition-all group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <FileSpreadsheet size={32} />
                                        </div>
                                        <p className="text-sm font-black text-slate-900 uppercase">Clique para abrir Excel</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">.XLSX ou .CSV</p>
                                    </div>
                                    <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                                </label>
                            ) : (
                                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[32px] flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <CheckCircle2 className="text-emerald-600" />
                                        <div>
                                            <p className="text-xs font-black text-slate-900 uppercase italic truncate max-w-[150px]">{fileName}</p>
                                            <p className="text-[10px] text-emerald-600 font-bold uppercase">{fileData.length} Linhas detectadas</p>
                                        </div>
                                    </div>
                                    <button onClick={clearData} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            )}

                            <div className="mt-8 space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                                    <Eye size={18} className="text-blue-500" /> 2. Onde simular?
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {([['full', 'Mapeamento Thiago 704 (COMPLETO)'], ['clients', 'Tabela de Clientes'], ['batches', 'Estoque / Lotes'], ['sales', 'Histórico de Vendas']] as const).map(([type, label]) => (
                                        <button
                                            key={type}
                                            onClick={() => setImportType(type)}
                                            className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-left transition-all ${importType === type ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={importType === 'full' ? processFullSimulation : applyStandardSimulation}
                                disabled={fileData.length === 0}
                                className="w-full mt-10 btn-modern bg-emerald-600 text-white py-5 rounded-2xl hover:bg-emerald-500 shadow-2xl shadow-emerald-900/20 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[10px]"
                            >
                                <PlayCircle size={20} /> Aplicar Simulação Local
                            </button>
                            <p className="text-[9px] text-slate-400 font-bold uppercase text-center mt-4 italic leading-relaxed">
                                *Isso não salvará no Firebase. <br /> Apenas mudará sua visão atual no computador.
                            </p>
                        </div>
                    </div>

                    {/* RIGHT: PREVIEW */}
                    <div className="lg:col-span-2">
                        <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 h-full overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Prévia do Arquivo</h3>
                                {fileData.length > 0 && (
                                    <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase">
                                        {headers.length} Colunas Detectadas
                                    </span>
                                )}
                            </div>

                            {fileData.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4 py-20">
                                    <FileSpreadsheet size={64} strokeWidth={1} />
                                    <p className="text-xs font-black uppercase tracking-widest">Nenhum dado carregado</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr>
                                                {headers.map(h => (
                                                    <th key={h} className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 bg-slate-50/50 sticky top-0">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fileData.slice(0, 50).map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                                                    {headers.map(h => (
                                                        <td key={h} className="p-4 text-xs font-bold text-slate-700">
                                                            {String(row[h])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {fileData.length > 50 && (
                                        <p className="p-6 text-center text-[10px] font-bold text-slate-400 uppercase italic">
                                            Mostrando apenas as primeiras 50 de {fileData.length} linhas...
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="mt-10 p-6 bg-blue-50/50 rounded-[32px] border border-blue-100/50">
                                <div className="flex items-start gap-4">
                                    <AlertCircle className="text-blue-500 mt-1" size={20} />
                                    <div>
                                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Dica de Mapeamento</p>
                                        <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                                            Para o simulador funcionar perfeitamente, tente usar nomes de colunas como: <br />
                                            <span className="text-slate-900 font-bold px-1 uppercase tracking-tighter">NOME, CPF, LIMITE, PESO, VALOR, DATA.</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 12px; }
            `}} />
        </div>
    );
};

export default DataSimulator;
