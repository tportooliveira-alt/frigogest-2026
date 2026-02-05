import React, { useState } from 'react';
import { Supplier } from '../types';
import {
    Search as SearchIcon,
    UserPlus as UserPlusIcon,
    Truck as TruckIcon,
    X as XIcon,
    MapPin as MapPinIcon,
    Phone as PhoneIcon,
    ChevronRight as ChevronRightIcon,
    Trash2 as TrashIcon,
    Save as SaveIcon,
    Edit3 as EditIcon,
    Wallet as WalletIcon,
    ArrowLeft as ArrowLeftIcon
} from 'lucide-react';

interface SuppliersProps {
    suppliers: Supplier[];
    addSupplier: (s: Supplier) => void;
    updateSupplier?: (s: Supplier) => void;
    deleteSupplier: (id: string) => void;
    onBack: () => void;
}

const Suppliers: React.FC<SuppliersProps> = ({ suppliers, addSupplier, updateSupplier, deleteSupplier, onBack }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
        id: '',
        nome_fantasia: '',
        cpf_cnpj: '',
        inscricao_estadual: '',
        telefone: '',
        endereco: '',
        cidade: '',
        estado: '',
        dados_bancarios: '',
        observacoes: ''
    });

    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const filteredSuppliers = suppliers.filter(s =>
        s.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.cpf_cnpj.includes(searchTerm)
    ).sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia));

    const handleSubmitNewSupplier = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSupplier.nome_fantasia) {
            addSupplier({ ...newSupplier, id: Date.now().toString() } as Supplier);
            setShowAddForm(false);
            setNewSupplier({
                id: '',
                nome_fantasia: '',
                cpf_cnpj: '',
                inscricao_estadual: '',
                telefone: '',
                endereco: '',
                cidade: '',
                estado: '',
                dados_bancarios: '',
                observacoes: ''
            });
        }
    };

    const handleUpdateSupplier = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingSupplier && updateSupplier) {
            updateSupplier(editingSupplier);
            setSelectedSupplier(editingSupplier);
            setIsEditing(false);
        }
    };

    const getWhatsAppLink = (phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        return `https://wa.me/55${cleanPhone}`;
    }

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">

            {/* PREMIUM HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="flex flex-col gap-4">
                    <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
                        <ArrowLeftIcon size={14} /> Voltar ao Início
                    </button>
                    <div className="flex items-center gap-5">
                        <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-100">
                            <TruckIcon size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                                Gestão de <span className="text-indigo-600">Fornecedores</span>
                            </h1>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                                Unidade de Cadeia de Suprimentos / ID-SUP
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
                    <div className="relative group w-full sm:w-80">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar parceiro ou documento..."
                            className="modern-input pl-12 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="btn-modern btn-brand px-8 py-3.5 gap-3 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                    >
                        <UserPlusIcon size={18} /> Novo Fornecedor
                    </button>
                </div>
            </div>

            {/* TABLE SECTION - PREMIUM */}
            <div className="max-w-7xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-reveal">
                <div className="overflow-x-auto">
                    <table className="technical-table">
                        <thead>
                            <tr>
                                <th>Origem / Parceiro</th>
                                <th className="hidden md:table-cell">Documentação</th>
                                <th className="hidden sm:table-cell">Geolocalização</th>
                                <th className="hidden sm:table-cell">Contato</th>
                                <th className="w-32 text-center">Operações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSuppliers.map(supplier => (
                                <tr key={supplier.id} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td>
                                        <div
                                            onClick={() => { setSelectedSupplier(supplier); setIsEditing(false); }}
                                            className="cursor-pointer"
                                        >
                                            <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{supplier.nome_fantasia}</p>
                                            {supplier.cpf_cnpj && <p className="text-[10px] text-gray-400 font-medium tracking-wider">{supplier.cpf_cnpj}</p>}
                                        </div>
                                    </td>
                                    <td className="hidden md:table-cell">
                                        <div className="flex flex-col text-[10px] font-bold text-slate-500 uppercase">
                                            <span>IE: {supplier.inscricao_estadual || 'ISENTO'}</span>
                                        </div>
                                    </td>
                                    <td className="hidden sm:table-cell">
                                        {supplier.cidade ? (
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-gray-600 flex items-center gap-1"><MapPinIcon size={12} className="text-indigo-500" /> {supplier.cidade} - {supplier.estado}</span>
                                                <span className="text-[10px] text-gray-400">{supplier.endereco}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-gray-300 italic font-medium">NÃO MAPEADO</span>
                                        )}
                                    </td>
                                    <td className="hidden sm:table-cell">
                                        {supplier.telefone ? (
                                            <div className="flex flex-col">
                                                <p className="text-xs font-bold text-gray-700">{supplier.telefone}</p>
                                                <a href={getWhatsAppLink(supplier.telefone)} target="_blank" className="text-[10px] text-emerald-600 font-bold hover:underline">WhatsApp Link</a>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-gray-300 italic font-medium">SEM CONTATO</span>
                                        )}
                                    </td>
                                    <td className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => { setSelectedSupplier(supplier); setIsEditing(false); }}
                                                className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                title="Ver Detalhes"
                                            >
                                                <ChevronRightIcon size={20} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (confirm('Confirmar exclusão de registro?')) deleteSupplier(supplier.id); }}
                                                className="p-2 text-gray-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                title="Excluir"
                                            >
                                                <TrashIcon size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL - NOVO FORNECEDOR */}
            {showAddForm && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-reveal">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden relative border border-white">
                        <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">Registro de Parceiro</h3>
                                <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-widest mt-1">Buffer de Entrada / SUP-01</p>
                            </div>
                            <button onClick={() => setShowAddForm(false)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
                                <XIcon size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitNewSupplier} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                <div className="md:col-span-12 space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Nome Social da Entidade / Fazenda</label>
                                    <input required type="text" className="modern-input font-bold text-lg" placeholder="EX: FAZENDA BOI GORDO" value={newSupplier.nome_fantasia} onChange={e => setNewSupplier({ ...newSupplier, nome_fantasia: e.target.value.toUpperCase() })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">CPF / CNPJ</label>
                                    <input type="text" className="modern-input" placeholder="000.000.000-00" value={newSupplier.cpf_cnpj} onChange={e => setNewSupplier({ ...newSupplier, cpf_cnpj: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Ins. Estadual</label>
                                    <input type="text" className="modern-input" placeholder="IE Number" value={newSupplier.inscricao_estadual} onChange={e => setNewSupplier({ ...newSupplier, inscricao_estadual: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Contato Principal</label>
                                    <input type="text" className="modern-input" placeholder="(00) 00000-0000" value={newSupplier.telefone} onChange={e => setNewSupplier({ ...newSupplier, telefone: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
                                <div className="md:col-span-8 space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Endereço Fiscal / Operacional</label>
                                    <input type="text" className="modern-input" value={newSupplier.endereco} onChange={e => setNewSupplier({ ...newSupplier, endereco: e.target.value.toUpperCase() })} />
                                </div>
                                <div className="md:col-span-4 space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Cidade / UF</label>
                                    <input type="text" className="modern-input" placeholder="CIDADE - UF" value={newSupplier.cidade} onChange={e => setNewSupplier({ ...newSupplier, cidade: e.target.value.toUpperCase() })} />
                                </div>
                            </div>

                            <div className="pt-4 space-y-2">
                                <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-1">Dados Bancários / PIX</label>
                                <textarea className="modern-input bg-emerald-50 border-emerald-100 font-mono text-xs h-32 resize-none" placeholder="BANCO / AGÊNCIA / CONTA / CHAVE PIX" value={newSupplier.dados_bancarios} onChange={e => setNewSupplier({ ...newSupplier, dados_bancarios: e.target.value.toUpperCase() })} />
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setShowAddForm(false)} className="btn-modern bg-gray-100 text-gray-500 hover:bg-gray-200 px-8">Cancelar</button>
                                <button type="submit" className="btn-modern btn-brand px-12 bg-indigo-600 hover:bg-indigo-700">Confirmar Registro</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL - GLASS UI */}
            {selectedSupplier && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-reveal">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative border border-white">

                        {/* Modal Header */}
                        <div className={`p-8 flex justify-between items-center ${isEditing ? 'bg-amber-50' : 'bg-slate-50'}`}>
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-800 shadow-sm border border-slate-100">
                                    <TruckIcon size={32} />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{isEditing ? 'Editor de Fornecedor' : selectedSupplier.nome_fantasia}</h2>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {isEditing ? 'Protocolo de Alteração Master' : `Registro Industrial #${selectedSupplier.cpf_cnpj || '---'}`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedSupplier(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors shadow-sm border border-slate-100">
                                <XIcon size={24} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-10 overflow-y-auto bg-white flex-1">
                            {!isEditing ? (
                                <div className="space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Comunicação e Suporte</h4>
                                                <div>
                                                    <a href={getWhatsAppLink(selectedSupplier.telefone)} target="_blank" className="text-2xl font-extrabold text-slate-900 hover:text-indigo-600 transition-colors block tracking-tight">
                                                        {selectedSupplier.telefone || 'SEM TELEFONE'}
                                                    </a>
                                                    <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Canal Primário WhatsApp</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Dados de Localidade</h4>
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mt-1"><MapPinIcon size={18} /></div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 leading-tight uppercase">{selectedSupplier.endereco || 'Endereço não informado'}</p>
                                                        <p className="text-xs text-slate-400 font-bold uppercase mt-1 tracking-widest">
                                                            {selectedSupplier.cidade} - {selectedSupplier.estado}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-indigo-50/50 rounded-3xl p-8 border border-indigo-100 flex flex-col h-full">
                                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                <WalletIcon size={16} /> Liquidação Financeira
                                            </h4>
                                            <div className="font-mono text-xs text-indigo-900 font-bold whitespace-pre-wrap uppercase leading-relaxed h-full overflow-y-auto pr-2">
                                                {selectedSupplier.dados_bancarios || 'NENHUM DADO BANCÁRIO REGISTRADO NO SISTEMA'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form id="edit-form" onSubmit={handleUpdateSupplier} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Identificação / Razão Social</label>
                                        <input required type="text" className="modern-input font-bold" value={editingSupplier?.nome_fantasia || ''} onChange={e => setEditingSupplier(prev => prev ? ({ ...prev, nome_fantasia: e.target.value.toUpperCase() }) : null)} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Documento</label>
                                            <input type="text" className="modern-input" value={editingSupplier?.cpf_cnpj || ''} onChange={e => setEditingSupplier(prev => prev ? ({ ...prev, cpf_cnpj: e.target.value }) : null)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Insc. Estadual</label>
                                            <input type="text" className="modern-input" value={editingSupplier?.inscricao_estadual || ''} onChange={e => setEditingSupplier(prev => prev ? ({ ...prev, inscricao_estadual: e.target.value }) : null)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Telefone</label>
                                            <input type="text" className="modern-input" value={editingSupplier?.telefone || ''} onChange={e => setEditingSupplier(prev => prev ? ({ ...prev, telefone: e.target.value }) : null)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Cidade - UF</label>
                                            <input type="text" className="modern-input" value={editingSupplier?.cidade || ''} onChange={e => setEditingSupplier(prev => prev ? ({ ...prev, cidade: e.target.value.toUpperCase() }) : null)} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Logradouro</label>
                                        <input type="text" className="modern-input" value={editingSupplier?.endereco || ''} onChange={e => setEditingSupplier(prev => prev ? ({ ...prev, endereco: e.target.value.toUpperCase() }) : null)} />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-1">Dados Bancários / Fluxo Financeiro</label>
                                        <textarea className="modern-input h-32 resize-none bg-emerald-50 border-emerald-100 font-mono text-xs font-bold text-emerald-900" value={editingSupplier?.dados_bancarios || ''} onChange={e => setEditingSupplier(prev => prev ? ({ ...prev, dados_bancarios: e.target.value.toUpperCase() }) : null)} />
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center z-20">
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="text-slate-400 font-bold text-sm px-6">Descartar</button>
                                    <button form="edit-form" type="submit" className="btn-modern btn-brand px-10 bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"><SaveIcon size={18} /> Salvar Alterações</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => { setEditingSupplier(selectedSupplier); setIsEditing(true); }} className="flex items-center gap-2 text-slate-400 font-bold text-sm hover:text-slate-800 transition-colors">
                                        <EditIcon size={18} /> Substituir Dados
                                    </button>
                                    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">Última Sincronização: Hoje</div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Suppliers;
