import React, { useState } from 'react';
import { Client, PaymentMethod } from '../types';
import { formatCurrency } from '../utils/helpers';
import {
  Search,
  UserPlus,
  CreditCard,
  X,
  Wallet,
  ArrowLeft,
  MapPin,
  Smartphone,
  Contact,
  ChevronRight,
  Mail,
  Save,
  Edit3,
  Activity,
  ShieldCheck,
  DollarSign,
  Search as SearchIcon,
  UserPlus as UserPlusIcon,
  Wallet as WalletIcon,
  ArrowLeft as ArrowLeftIcon,
  MapPin as MapPinIcon,
  Smartphone as PhoneIcon,
  Contact as ContactIcon,
  ChevronRight as ChevronRightIcon,
  X as XIcon,
  Save as SaveIcon,
  Edit3 as EditIcon,
  Activity as ActivityIcon,
  ShieldCheck as ShieldIcon,
  DollarSign as DollarIcon,
  CreditCard as CardIcon,
  Smartphone as SmartphoneIcon,
  Star,
  AlertTriangle,
  Flame,
  Zap,
  Award,
  Trash2
} from 'lucide-react';
import { calculateCreditScore } from '../utils/helpers';
import { CURRENT_DATE } from '../constants';

interface ClientsProps {
  clients: Client[];
  addClient: (c: Client) => void;
  updateClient?: (c: Client) => void;
  deleteClient: (id: string) => void;
  receiveClientPayment: (clientId: string, amount: number, method: PaymentMethod, date: string) => void;
  onBack: () => void;
  sales: any[];
}

const Clients: React.FC<ClientsProps> = ({ clients, addClient, updateClient, deleteClient, receiveClientPayment, onBack, sales }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>({
    id_ferro: '',
    nome_social: '',
    whatsapp: '',
    cpf_cnpj: '',
    telefone_residencial: '',
    endereco: '',
    bairro: '',
    cidade: '',
    cep: '',
    observacoes: '',
    limite_credito: 0,
    saldo_devedor: 0
  });

  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');

  const filteredClients = clients.filter(c =>
    c.status !== 'INATIVO' &&
    (c.id_ferro.includes(searchTerm) ||
      c.nome_social.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => a.nome_social.localeCompare(b.nome_social));

  const handleSubmitNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.id_ferro && newClient.nome_social) {
      addClient(newClient as Client);
      setShowAddForm(false);
      setNewClient({ id_ferro: '', nome_social: '', whatsapp: '', cpf_cnpj: '', telefone_residencial: '', endereco: '', bairro: '', cidade: '', cep: '', observacoes: '', limite_credito: 0, saldo_devedor: 0 });
    }
  };

  const handleUpdateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient && updateClient) {
      updateClient(editingClient);
      setSelectedClientForDetails(editingClient);
      setIsEditing(false);
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClientForDetails && paymentAmount) {
      const amount = parseFloat(paymentAmount);
      if (amount > 0) {
        receiveClientPayment(selectedClientForDetails.id_ferro, amount, paymentMethod, paymentDate);
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentMethod('PIX');
        setSelectedClientForDetails(null);
      }
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
          <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
            <ArrowLeftIcon size={14} /> Voltar ao Início
          </button>
          <div className="flex items-center gap-5">
            <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-xl shadow-emerald-100">
              <ContactIcon size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                Gestão de <span className="text-emerald-600">Clientes</span>
              </h1>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                Central de Relacionamento e Crédito / ID-CRM
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative group w-full sm:w-80">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Pesquisar por nome ou ID..."
              className="modern-input pl-12 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-modern btn-brand px-8 py-3.5 gap-3 shadow-lg shadow-blue-100"
          >
            <UserPlusIcon size={18} /> Novo Cliente
          </button>
        </div>
      </div>

      {/* MODAL - NOVO CLIENTE */}
      {showAddForm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-reveal">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden relative border border-white">
            <div className="bg-emerald-600 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold tracking-tight">Cadastro de Entidade</h3>
                <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-1">Módulo de Entrada Segura / CRM-01</p>
              </div>
              <button onClick={() => setShowAddForm(false)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitNewClient} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-4">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">ID / Marca</label>
                  <input required type="text" className="modern-input font-bold text-lg" placeholder="EX: 77" value={newClient.id_ferro} onChange={e => setNewClient({ ...newClient, id_ferro: e.target.value.toUpperCase() })} />
                </div>
                <div className="md:col-span-8">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Nome Social / Razão Social</label>
                  <input required type="text" className="modern-input font-bold text-lg" placeholder="NOME COMPLETO DO CLIENTE" value={newClient.nome_social} onChange={e => setNewClient({ ...newClient, nome_social: e.target.value.toUpperCase() })} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">CPF / CNPJ</label>
                  <input type="text" className="modern-input" placeholder="000.000.000-00" value={newClient.cpf_cnpj} onChange={e => setNewClient({ ...newClient, cpf_cnpj: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">WhatsApp</label>
                  <input type="text" className="modern-input" placeholder="(00) 00000-0000" value={newClient.whatsapp} onChange={e => setNewClient({ ...newClient, whatsapp: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Telefone Fixo</label>
                  <input type="text" className="modern-input" placeholder="(00) 0000-0000" value={newClient.telefone_residencial} onChange={e => setNewClient({ ...newClient, telefone_residencial: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-gray-50">
                <div className="md:col-span-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">CEP</label>
                  <input type="text" className="modern-input" placeholder="00000-000" value={newClient.cep} onChange={e => setNewClient({ ...newClient, cep: e.target.value })} />
                </div>
                <div className="md:col-span-5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Endereço</label>
                  <input type="text" className="modern-input" value={newClient.endereco} onChange={e => setNewClient({ ...newClient, endereco: e.target.value })} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Bairro</label>
                  <input type="text" className="modern-input" value={newClient.bairro} onChange={e => setNewClient({ ...newClient, bairro: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Cidade / UF</label>
                  <input type="text" className="modern-input" value={newClient.cidade} onChange={e => setNewClient({ ...newClient, cidade: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 block">Limite de Crédito</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-emerald-600 text-sm">R$</span>
                    <input type="text" inputMode="decimal" className="modern-input pl-12 bg-emerald-50 border-emerald-100 text-emerald-700 font-bold" placeholder="Limite" value={newClient.limite_credito || ''} onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setNewClient({ ...newClient, limite_credito: Number(v) || 0 }); }} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setShowAddForm(false)} className="btn-modern bg-gray-100 text-gray-500 hover:bg-gray-200 px-8">Cancelar</button>
                <button type="submit" className="btn-modern btn-brand px-12 bg-emerald-600 hover:bg-emerald-700">Finalizar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLE SECTION - PREMIUM */}
      <div className="max-w-7xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-reveal">
        <div className="overflow-x-auto">
          <table className="technical-table">
            <thead>
              <tr>
                <th className="w-24 text-center">ID</th>
                <th>Titular / Razão Social</th>
                <th className="hidden md:table-cell">Localização</th>
                <th className="hidden sm:table-cell">Contato</th>
                <th className="text-center">Score de Crédito</th>
                <th className="text-right">Saldo Devedor</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id_ferro} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="text-center">
                    <div
                      onClick={() => { setSelectedClientForDetails(client); setIsEditing(false); }}
                      className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-mono font-bold text-gray-500 group-hover:bg-blue-600 group-hover:text-white transition-all cursor-pointer mx-auto"
                    >
                      {client.id_ferro}
                    </div>
                  </td>
                  <td>
                    <div onClick={() => { setSelectedClientForDetails(client); setIsEditing(false); }} className="cursor-pointer">
                      <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{client.nome_social}</p>
                      <p className="text-[10px] text-gray-400 font-medium tracking-wider">{client.cpf_cnpj || 'SEM DOCUMENTO'}</p>
                    </div>
                  </td>
                  <td className="hidden md:table-cell">
                    {client.cidade ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1"><MapPinIcon size={12} className="text-blue-500" /> {client.cidade}</span>
                        <span className="text-[10px] text-gray-400">{client.bairro}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300 italic font-medium">NÃO DEFINIDO</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell">
                    {client.whatsapp ? (
                      <div className="flex flex-col">
                        <p className="text-xs font-bold text-gray-700">{client.whatsapp}</p>
                        <a href={getWhatsAppLink(client.whatsapp)} target="_blank" className="text-[10px] text-emerald-600 font-bold hover:underline">WhatsApp Link</a>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300 italic font-medium">SEM CONTATO</span>
                    )}
                  </td>
                  <td className="text-center">
                    {(() => {
                      const score = calculateCreditScore(client, sales, CURRENT_DATE);
                      return (
                        <div className="flex flex-col items-center gap-1 group/score relative">
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={10} className={i < score.stars ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                            ))}
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${score.color} ${score.bg} ${score.border}`}>
                            NÍVEL {score.tier}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-bold ${client.saldo_devedor > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(client.saldo_devedor)}
                      </span>
                      {client.saldo_devedor > 0 && <span className="text-[9px] font-bold text-rose-300 uppercase tracking-tighter">Em Aberto</span>}
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Inativar cliente ${client.nome_social}?\n\nO registro será mantido no histórico mas não aparecerá mais nas listas.`)) {
                            deleteClient(client.id_ferro);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white transition-all"
                        title="Inativar cliente"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRightIcon size={18} className="text-gray-300 group-hover:text-blue-500 transition-all transform group-hover:translate-x-1" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL - GLASS UI */}
      {selectedClientForDetails && !showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-reveal">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative border border-white">

            {/* Header Detail */}
            <div className={`p-8 flex justify-between items-center ${isEditing ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-800 font-black text-3xl shadow-sm border border-slate-100">
                  {selectedClientForDetails.id_ferro}
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{selectedClientForDetails.nome_social}</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {isEditing ? 'Editor de Registro Master' : `Matrícula #${selectedClientForDetails.cpf_cnpj || '---'}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedClientForDetails(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors shadow-sm border border-slate-100">
                <XIcon size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto bg-white flex-1">
              {!isEditing ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-emerald-50/50 rounded-3xl p-6 border border-emerald-50">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Limite de Crédito</p>
                      <p className="text-3xl font-extrabold text-emerald-700">{formatCurrency(selectedClientForDetails.limite_credito)}</p>
                    </div>
                    <div className="bg-rose-50/50 rounded-3xl p-6 border border-rose-50">
                      <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Saldo devedor Atual</p>
                      <p className="text-3xl font-extrabold text-rose-700">{formatCurrency(selectedClientForDetails.saldo_devedor)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Canais de Contato</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><PhoneIcon size={18} /></div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">{selectedClientForDetails.whatsapp || 'Não cadastrado'}</p>
                            <a href={getWhatsAppLink(selectedClientForDetails.whatsapp)} target="_blank" className="text-[10px] text-blue-500 font-bold hover:underline">Abrir WhatsApp</a>
                          </div>
                        </div>
                        {selectedClientForDetails.telefone_residencial && (
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><SmartphoneIcon size={18} /></div>
                            <p className="text-sm font-bold text-slate-700">{selectedClientForDetails.telefone_residencial}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Informações de Localidade</h4>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mt-1"><MapPinIcon size={18} /></div>
                        <div>
                          <p className="text-sm font-bold text-slate-700 leading-tight">{selectedClientForDetails.endereco || 'Endereço não disponível'}</p>
                          <p className="text-xs text-slate-400 font-medium mt-1">
                            {selectedClientForDetails.bairro}{selectedClientForDetails.cidade ? `, ${selectedClientForDetails.cidade}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <ShieldCheck size={80} />
                      </div>

                      {(() => {
                        const score = calculateCreditScore(selectedClientForDetails, sales, CURRENT_DATE);
                        return (
                          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                            <div className="text-center md:text-left">
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Relatório de Análise de Crédito</p>
                              <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                                <h3 className="text-4xl font-black italic">CLASSE {score.tier}</h3>
                                {score.tier === 'F' && <Flame className="text-rose-500 animate-pulse" size={24} />}
                                {score.tier === 'AAA' && <Award className="text-amber-500 animate-bounce" size={24} />}
                              </div>
                              <p className={`text-sm font-bold uppercase ${score.tier === 'F' ? 'text-rose-400' : 'text-slate-400'}`}>Motivo: {score.reason}</p>
                            </div>

                            <div className="flex flex-col items-center gap-4 bg-white/5 p-6 rounded-[24px] border border-white/5">
                              <div className="flex gap-2">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} size={24} className={i < score.stars ? "fill-amber-400 text-amber-400" : "text-white/10"} />
                                ))}
                              </div>
                              <p className="text-[10px] font-black text-slate-500 uppercase">Score de Confiança Industrial</p>
                            </div>

                            {score.tier === 'F' && (
                              <div className="bg-rose-500/20 border border-rose-500/30 p-4 rounded-2xl flex items-center gap-4 animate-bounce">
                                <AlertTriangle className="text-rose-500" />
                                <span className="text-[10px] font-black uppercase text-rose-100 italic">ALERTA DE FUMO: Crédito Bloqueado</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <form id="edit-form" onSubmit={handleUpdateClient} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Razão Social</label>
                    <input required type="text" className="modern-input font-bold" value={editingClient?.nome_social || ''} onChange={e => setEditingClient(prev => prev ? ({ ...prev, nome_social: e.target.value.toUpperCase() }) : null)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Documento</label>
                    <input type="text" className="modern-input" value={editingClient?.cpf_cnpj || ''} onChange={e => setEditingClient(prev => prev ? ({ ...prev, cpf_cnpj: e.target.value }) : null)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp</label>
                    <input type="text" className="modern-input" value={editingClient?.whatsapp || ''} onChange={e => setEditingClient(prev => prev ? ({ ...prev, whatsapp: e.target.value }) : null)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-emerald-600 uppercase">Limite de Crédito</label>
                    <input type="text" inputMode="decimal" className="modern-input bg-emerald-50 border-emerald-100 font-bold text-emerald-700" placeholder="Limite" value={editingClient?.limite_credito || ''} onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setEditingClient(prev => prev ? ({ ...prev, limite_credito: Number(v) || 0 }) : null); }} />
                  </div>
                </form>
              )}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="text-slate-400 font-bold text-sm px-6">Descartar</button>
                  <button form="edit-form" type="submit" className="btn-modern btn-brand px-10 bg-amber-600 hover:bg-amber-700 flex items-center gap-2"><SaveIcon size={18} /> Salvar Alterações</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingClient(selectedClientForDetails); setIsEditing(true); }} className="flex items-center gap-2 text-slate-400 font-bold text-sm hover:text-slate-800 transition-colors">
                    <EditIcon size={18} /> Editar Cadastro
                  </button>
                  <button onClick={() => { setShowPaymentModal(true); setPaymentAmount(''); }} disabled={(selectedClientForDetails?.saldo_devedor || 0) <= 0} className="btn-modern btn-brand px-12 bg-blue-600 hover:bg-blue-700 flex items-center gap-3 disabled:opacity-30">
                    <WalletIcon size={20} /> Receber Pagamento
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAGAMENTO */}
      {showPaymentModal && selectedClientForDetails && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl animate-reveal">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 relative border border-white">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Receber Valor</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 p-2"><XIcon size={20} /></button>
            </div>

            <div className="bg-blue-50/50 rounded-3xl p-6 flex justify-between items-center mb-8 border border-blue-50">
              <div>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Dívida Total</p>
                <p className="text-2xl font-extrabold text-blue-700">{formatCurrency(selectedClientForDetails.saldo_devedor)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-blue-300 uppercase mb-1">Cliente</p>
                <p className="text-sm font-bold text-slate-700">#{selectedClientForDetails.id_ferro}</p>
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center block">Valor do Recebimento</label>
                <input autoFocus required type="text" inputMode="decimal" className="w-full bg-slate-50 rounded-3xl p-8 text-slate-900 text-4xl font-extrabold text-center focus:bg-blue-50 focus:ring-4 focus:ring-blue-100 transition-all outline-none" placeholder="Valor" value={paymentAmount} onChange={e => { const v = e.target.value.replace(',', '.'); if (v === '' || /^\d*\.?\d*$/.test(v)) setPaymentAmount(v); }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input type="date" className="modern-input text-xs font-bold text-slate-500" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                <select className="modern-input text-xs font-bold text-slate-500 bg-white" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                  <option value="PIX">Pix</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="TRANSFERENCIA">Transferência</option>
                </select>
              </div>

              <button type="submit" className="w-full btn-modern btn-brand py-5 rounded-3xl bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-3 text-sm shadow-xl shadow-blue-100">
                <ShieldIcon size={20} /> Confirmar Recebimento
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;