import React, { useState, useMemo } from 'react';
import { Client, Sale, Transaction, Batch } from '../types';
import { formatCurrency } from '../utils/helpers';
import {
  Search,
  UserPlus,
  X,
  Wallet,
  ArrowLeft,
  MapPin,
  Smartphone,
  Contact,
  ChevronRight,
  Save,
  Edit3,
  ShieldCheck,
  DollarSign,
  Star,
  AlertTriangle,
  Flame,
  Award,
  Trash2,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  History,
  Banknote,
  CreditCard,
  Zap,
  ExternalLink,
  Package
} from 'lucide-react';
import { calculateCreditScore } from '../utils/helpers';
import { CURRENT_DATE } from '../constants';

interface ClientsProps {
  clients: Client[];
  addClient: (c: Client) => void;
  updateClient?: (c: Client) => void;
  onBack: () => void;
  onGoToFinancial?: () => void;
  sales: Sale[];
  transactions: Transaction[];
  batches: Batch[];
}

const Clients: React.FC<ClientsProps> = ({ clients, addClient, updateClient, onBack, onGoToFinancial, sales, transactions, batches }) => {
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
    saldo_devedor: 0,
    perfil_compra: 'MISTO',
    padrao_gordura: 'MEDIO',
    objecoes_frequentes: '',
    preferencias: ''
  });

  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'history' | 'behavior'>('overview');

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
      setNewClient({ id_ferro: '', nome_social: '', whatsapp: '', cpf_cnpj: '', telefone_residencial: '', endereco: '', bairro: '', cidade: '', cep: '', observacoes: '', limite_credito: 0, saldo_devedor: 0, perfil_compra: 'MISTO', padrao_gordura: 'MEDIO', objecoes_frequentes: '', preferencias: '' });
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

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleanPhone}`;
  }

  // ===== ANALYTICS DO CLIENTE SELECIONADO =====
  const clientAnalytics = useMemo(() => {
    if (!selectedClientForDetails) return null;
    const clientId = selectedClientForDetails.id_ferro;

    // Vendas do cliente (excluindo estornadas)
    const clientSales = sales.filter(s => s.id_cliente === clientId && s.status_pagamento !== 'ESTORNADO');

    // Total faturado
    const totalFaturado = clientSales.reduce((sum, s) => sum + (s.peso_real_saida * s.preco_venda_kg), 0);

    // Total pago
    const totalPago = clientSales.reduce((sum, s) => sum + ((s as any).valor_pago || 0), 0);

    // Saldo devedor DINÂMICO
    const saldoDevedor = totalFaturado - totalPago;

    // Lucro gerado pelo cliente
    const totalLucro = clientSales.reduce((sum, s) => {
      const receita = s.peso_real_saida * s.preco_venda_kg;
      const batch = batches.find(b => s.id_completo.startsWith(b.id_lote));
      const custoKg = batch ? (batch.custo_real_kg || 0) : 0;
      const custo = s.peso_real_saida * custoKg;
      const extras = (s as any).custo_extras_total || 0;
      return sum + (receita - custo - extras);
    }, 0);

    // Volume total comprado (kg)
    const totalKg = clientSales.reduce((sum, s) => sum + s.peso_real_saida, 0);

    // Vendas pagas (para análise de comportamento)
    const salesPagas = clientSales.filter(s => s.status_pagamento === 'PAGO');
    const salesPendentes = clientSales.filter(s => s.status_pagamento === 'PENDENTE');

    // Análise de pontualidade
    const today = new Date(CURRENT_DATE);
    let pagasEmDia = 0;
    let pagasAtrasadas = 0;
    let totalDiasAtraso = 0;

    salesPagas.forEach(s => {
      // Buscar transação de recebimento para ver data real do pagamento
      const txRecebimento = transactions.find(t =>
        (t.referencia_id === s.id_venda || t.id.includes(s.id_venda)) &&
        t.tipo === 'ENTRADA' && t.categoria === 'VENDA'
      );
      const dataPagamento = txRecebimento ? new Date(txRecebimento.data) : today;
      const dataVencimento = new Date(s.data_vencimento || s.data_venda);

      if (dataPagamento <= dataVencimento) {
        pagasEmDia++;
      } else {
        pagasAtrasadas++;
        totalDiasAtraso += Math.ceil((dataPagamento.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24));
      }
    });

    // Vendas pendentes vencidas
    const vendasVencidas = salesPendentes.filter(s => s.data_vencimento && s.data_vencimento < CURRENT_DATE);

    const percEmDia = salesPagas.length > 0 ? (pagasEmDia / salesPagas.length) * 100 : 100;
    const mediaDiasAtraso = pagasAtrasadas > 0 ? totalDiasAtraso / pagasAtrasadas : 0;

    // Métodos de pagamento usados
    const metodos: Record<string, number> = {};
    const txCliente = transactions.filter(t =>
      t.tipo === 'ENTRADA' && t.categoria === 'VENDA' &&
      clientSales.some(s => t.referencia_id === s.id_venda || t.id.includes(s.id_venda))
    );
    txCliente.forEach(t => {
      const m = t.metodo_pagamento || 'OUTROS';
      metodos[m] = (metodos[m] || 0) + 1;
    });
    const metodoPreferido = Object.entries(metodos).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const totalTxMetodo = Object.values(metodos).reduce((s, v) => s + v, 0);

    return {
      clientSales: clientSales.sort((a, b) => new Date(b.data_venda).getTime() - new Date(a.data_venda).getTime()),
      totalFaturado,
      totalPago,
      saldoDevedor,
      totalLucro,
      totalKg,
      salesPagas: salesPagas.length,
      salesPendentes: salesPendentes.length,
      pagasEmDia,
      pagasAtrasadas,
      percEmDia,
      mediaDiasAtraso,
      vendasVencidas: vendasVencidas.length,
      metodos,
      metodoPreferido,
      totalTxMetodo,
      totalVendas: clientSales.length
    };
  }, [selectedClientForDetails, sales, transactions, batches]);

  // Calcular saldo devedor dinâmico para a tabela
  const getSaldoDinamico = (clientId: string) => {
    const cs = sales.filter(s => s.id_cliente === clientId && s.status_pagamento !== 'ESTORNADO');
    const faturado = cs.reduce((sum, s) => sum + (s.peso_real_saida * s.preco_venda_kg), 0);
    const pago = cs.reduce((sum, s) => sum + ((s as any).valor_pago || 0), 0);
    return faturado - pago;
  };

  const formatWeight = (kg: number) => `${kg.toFixed(1)} kg`;

  return (
    <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">

      {/* PREMIUM HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex flex-col gap-4">
          <button onClick={onBack} className="group self-start flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
            <ArrowLeft size={14} /> Voltar ao Início
          </button>
          <div className="flex items-center gap-5">
            <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-xl shadow-emerald-100">
              <Contact size={28} />
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16} />
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
            <UserPlus size={18} /> Novo Cliente
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
                <X size={20} />
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

              {/* ═══ CAMPOS CRM ═══ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Perfil de Compra (Boi/Novilha)</label>
                  <select className="modern-input" value={newClient.perfil_compra} onChange={e => setNewClient({ ...newClient, perfil_compra: e.target.value as any })}>
                    <option value="BOI">Boi</option>
                    <option value="NOVILHA">Novilha</option>
                    <option value="MISTO">Misto</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Padrão de Gordura</label>
                  <select className="modern-input" value={newClient.padrao_gordura} onChange={e => setNewClient({ ...newClient, padrao_gordura: e.target.value as any })}>
                    <option value="MAGRO">Magro</option>
                    <option value="MEDIO">Médio</option>
                    <option value="GORDO">Gordo</option>
                    <option value="EXPORTACAO">Exportação</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Objeções Frequentes</label>
                  <input type="text" className="modern-input" placeholder="Ex: Acha o preço caro, reclama de osso" value={newClient.objecoes_frequentes} onChange={e => setNewClient({ ...newClient, objecoes_frequentes: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Preferências Especiais</label>
                  <input type="text" className="modern-input" placeholder="Ex: Só compra maturada, cortes específicos" value={newClient.preferencias} onChange={e => setNewClient({ ...newClient, preferencias: e.target.value })} />
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
              {filteredClients.map(client => {
                const saldoDinamico = getSaldoDinamico(client.id_ferro);
                return (
                  <tr key={client.id_ferro} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="text-center">
                      <div
                        onClick={() => { setSelectedClientForDetails(client); setIsEditing(false); setDetailTab('overview'); }}
                        className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center font-mono font-bold text-gray-500 group-hover:bg-blue-600 group-hover:text-white transition-all cursor-pointer mx-auto"
                      >
                        {client.id_ferro}
                      </div>
                    </td>
                    <td>
                      <div onClick={() => { setSelectedClientForDetails(client); setIsEditing(false); setDetailTab('overview'); }} className="cursor-pointer">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors uppercase">{client.nome_social}</p>
                          {['HEITOR PEDRO DA SILVA NETO', 'GILNEI BRITO SANTOS', 'JOÃO BATISTA TEIXEIRA DE OLIVEIRA', 'JOAO BATISTA TEIXEIRA DE OLIVEIRA'].includes(client.nome_social.toUpperCase()) && (
                            <span className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest uppercase flex items-center gap-1">
                              <Award size={10} /> VIP
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium tracking-wider">{client.cpf_cnpj || 'SEM DOCUMENTO'}</p>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      {client.cidade ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1"><MapPin size={12} className="text-blue-500" /> {client.cidade}</span>
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
                          <div className="flex flex-col items-center gap-1">
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
                        <span className={`text-sm font-bold ${saldoDinamico > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatCurrency(saldoDinamico)}
                        </span>
                        {saldoDinamico > 0.01 && <span className="text-[9px] font-bold text-rose-300 uppercase tracking-tighter">Em Aberto</span>}
                      </div>
                    </td>
                    <td className="text-center">
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-all transform group-hover:translate-x-1" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════ DETAIL MODAL — DASHBOARD ANALÍTICO ═══════ */}
      {selectedClientForDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-reveal">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col relative border border-white">

            {/* Header */}
            <div className={`p-8 flex justify-between items-center ${isEditing ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-800 font-black text-3xl shadow-sm border border-slate-100">
                  {selectedClientForDetails.id_ferro}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">{selectedClientForDetails.nome_social}</h2>
                    {['HEITOR PEDRO DA SILVA NETO', 'GILNEI BRITO SANTOS', 'JOÃO BATISTA TEIXEIRA DE OLIVEIRA', 'JOAO BATISTA TEIXEIRA DE OLIVEIRA'].includes(selectedClientForDetails.nome_social.toUpperCase()) && (
                      <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-[0.2em] uppercase flex items-center gap-1 shadow-lg shadow-amber-500/30">
                        <Award size={12} /> Cliente VIP
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {isEditing ? 'Editor de Registro Master' : `Matrícula #${selectedClientForDetails.cpf_cnpj || '---'}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedClientForDetails(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors shadow-sm border border-slate-100">
                <X size={24} />
              </button>
            </div>

            {/* TABS */}
            {!isEditing && (
              <div className="px-8 pt-4 flex gap-2 border-b border-slate-100">
                {(['overview', 'history', 'behavior'] as const).map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className={`px-5 py-3 rounded-t-2xl text-[10px] font-black uppercase tracking-widest transition-all ${detailTab === tab ? 'bg-white text-slate-900 border border-b-0 border-slate-100 -mb-px' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {tab === 'overview' ? '📊 Visão Geral' : tab === 'history' ? '📋 Histórico' : '⏱️ Comportamento'}
                  </button>
                ))}
              </div>
            )}

            <div className="p-8 overflow-y-auto bg-white flex-1">
              {isEditing ? (
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
                  {/* CRM FIELDS */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Perfil de Compra</label>
                    <select className="modern-input" value={editingClient?.perfil_compra || 'MISTO'} onChange={e => setEditingClient(prev => prev ? ({ ...prev, perfil_compra: e.target.value as any }) : null)}>
                      <option value="BOI">Boi</option>
                      <option value="NOVILHA">Novilha</option>
                      <option value="MISTO">Misto</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Padrão de Gordura</label>
                    <select className="modern-input" value={editingClient?.padrao_gordura || 'MEDIO'} onChange={e => setEditingClient(prev => prev ? ({ ...prev, padrao_gordura: e.target.value as any }) : null)}>
                      <option value="MAGRO">Magro</option>
                      <option value="MEDIO">Médio</option>
                      <option value="GORDO">Gordo</option>
                      <option value="EXPORTACAO">Exportação</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Objeções</label>
                    <input type="text" className="modern-input" value={editingClient?.objecoes_frequentes || ''} onChange={e => setEditingClient(prev => prev ? ({ ...prev, objecoes_frequentes: e.target.value }) : null)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Preferências</label>
                    <input type="text" className="modern-input" value={editingClient?.preferencias || ''} onChange={e => setEditingClient(prev => prev ? ({ ...prev, preferencias: e.target.value }) : null)} />
                  </div>
                </form>
              ) : clientAnalytics && (
                <>
                  {/* ═══ TAB: VISÃO GERAL ═══ */}
                  {detailTab === 'overview' && (
                    <div className="space-y-8 animate-reveal">
                      {/* KPIs FINANCEIROS */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-emerald-50/80 rounded-3xl p-6 border border-emerald-100">
                          <div className="flex items-center gap-2 mb-2"><DollarSign size={14} className="text-emerald-600" /><p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Total Faturado</p></div>
                          <p className="text-2xl font-extrabold text-emerald-700">{formatCurrency(clientAnalytics.totalFaturado)}</p>
                          <p className="text-[9px] font-bold text-emerald-500 mt-1">{clientAnalytics.totalVendas} vendas • {formatWeight(clientAnalytics.totalKg)}</p>
                        </div>
                        <div className="bg-blue-50/80 rounded-3xl p-6 border border-blue-100">
                          <div className="flex items-center gap-2 mb-2"><TrendingUp size={14} className="text-blue-600" /><p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Lucro Gerado</p></div>
                          <p className="text-2xl font-extrabold text-blue-700">{formatCurrency(clientAnalytics.totalLucro)}</p>
                          <p className="text-[9px] font-bold text-blue-500 mt-1">{clientAnalytics.totalFaturado > 0 ? ((clientAnalytics.totalLucro / clientAnalytics.totalFaturado) * 100).toFixed(1) : 0}% margem</p>
                        </div>
                        <div className={`rounded-3xl p-6 border ${clientAnalytics.saldoDevedor > 0.01 ? 'bg-rose-50/80 border-rose-100' : 'bg-emerald-50/80 border-emerald-100'}`}>
                          <div className="flex items-center gap-2 mb-2"><Wallet size={14} className={clientAnalytics.saldoDevedor > 0.01 ? 'text-rose-600' : 'text-emerald-600'} /><p className={`text-[9px] font-black uppercase tracking-widest ${clientAnalytics.saldoDevedor > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>Saldo Devedor</p></div>
                          <p className={`text-2xl font-extrabold ${clientAnalytics.saldoDevedor > 0.01 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(clientAnalytics.saldoDevedor)}</p>
                          <p className={`text-[9px] font-bold mt-1 ${clientAnalytics.saldoDevedor > 0.01 ? 'text-rose-500' : 'text-emerald-500'}`}>{clientAnalytics.salesPendentes} venda(s) pendente(s)</p>
                        </div>
                      </div>

                      {/* COMPORTAMENTO RESUMO */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2"><CheckCircle2 size={14} className="text-emerald-500" /><p className="text-[9px] font-black text-slate-400 uppercase">Em Dia</p></div>
                          <p className="text-xl font-black text-slate-900">{clientAnalytics.percEmDia.toFixed(0)}%</p>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2"><Clock size={14} className="text-amber-500" /><p className="text-[9px] font-black text-slate-400 uppercase">Média Atraso</p></div>
                          <p className="text-xl font-black text-slate-900">{clientAnalytics.mediaDiasAtraso.toFixed(0)} dias</p>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2"><CreditCard size={14} className="text-blue-500" /><p className="text-[9px] font-black text-slate-400 uppercase">Método Preferido</p></div>
                          <p className="text-xl font-black text-slate-900">{clientAnalytics.metodoPreferido}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2"><Package size={14} className="text-purple-500" /><p className="text-[9px] font-black text-slate-400 uppercase">Volume Total</p></div>
                          <p className="text-xl font-black text-slate-900">{formatWeight(clientAnalytics.totalKg)}</p>
                        </div>
                      </div>

                      {/* CONTATO + CREDIT SCORE */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Canais de Contato</h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Smartphone size={18} /></div>
                              <div>
                                <p className="text-sm font-bold text-slate-700">{selectedClientForDetails.whatsapp || 'Não cadastrado'}</p>
                                <a href={getWhatsAppLink(selectedClientForDetails.whatsapp)} target="_blank" className="text-[10px] text-blue-500 font-bold hover:underline">Abrir WhatsApp</a>
                              </div>
                            </div>
                            {selectedClientForDetails.telefone_residencial && (
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><Smartphone size={18} /></div>
                                <p className="text-sm font-bold text-slate-700">{selectedClientForDetails.telefone_residencial}</p>
                              </div>
                            )}
                            {selectedClientForDetails.endereco && (
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400"><MapPin size={18} /></div>
                                <div>
                                  <p className="text-sm font-bold text-slate-700">{selectedClientForDetails.endereco}</p>
                                  <p className="text-[10px] text-slate-400">{selectedClientForDetails.bairro}{selectedClientForDetails.cidade ? `, ${selectedClientForDetails.cidade}` : ''}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Credit Score Card */}
                        <div className="bg-slate-900 rounded-[24px] p-6 text-white relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck size={60} /></div>
                          {(() => {
                            const score = calculateCreditScore(selectedClientForDetails, sales, CURRENT_DATE);
                            return (
                              <div className="relative z-10">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mb-3">Análise de Crédito</p>
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-3xl font-black italic">CLASSE {score.tier}</h3>
                                  {score.tier === 'F' && <Flame className="text-rose-500 animate-pulse" size={20} />}
                                  {score.tier === 'AAA' && <Award className="text-amber-500" size={20} />}
                                </div>
                                <p className={`text-xs font-bold ${score.tier === 'F' ? 'text-rose-400' : 'text-slate-400'}`}>{score.reason}</p>
                                <div className="flex gap-1.5 mt-3">
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={18} className={i < score.stars ? "fill-amber-400 text-amber-400" : "text-white/10"} />
                                  ))}
                                </div>
                                {score.tier === 'F' && (
                                  <div className="bg-rose-500/20 border border-rose-500/30 p-3 rounded-xl flex items-center gap-3 mt-3">
                                    <AlertTriangle className="text-rose-500" size={16} />
                                    <span className="text-[9px] font-black uppercase text-rose-100">Crédito Bloqueado</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* CRM & PREFERÊNCIAS */}
                      <div className="bg-indigo-50/50 rounded-[24px] p-6 border border-indigo-100/50">
                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Star size={14} /> CRM & Inteligência Comercial</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Perfil de Compra</p>
                            <p className="text-sm font-black text-indigo-900">{selectedClientForDetails.perfil_compra || 'MISTO'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Padrão de Gordura</p>
                            <p className="text-sm font-black text-indigo-900">{selectedClientForDetails.padrao_gordura || 'MEDIO'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Objeções Anotadas</p>
                            <p className="text-xs font-semibold text-slate-700">{selectedClientForDetails.objecoes_frequentes || 'Nenhuma objeção registrada.'}</p>
                          </div>
                          <div className="col-span-2 md:col-span-4 mt-2">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Preferências Especiais</p>
                            <p className="text-xs font-semibold text-slate-700">{selectedClientForDetails.preferencias || 'Nenhuma preferência registrada.'}</p>
                          </div>
                        </div>
                      </div>

                      {/* MÉTODOS DE PAGAMENTO */}
                      {clientAnalytics.totalTxMetodo > 0 && (
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><BarChart3 size={14} /> Distribuição de Métodos</h4>
                          <div className="space-y-3">
                            {Object.entries(clientAnalytics.metodos).sort((a, b) => b[1] - a[1]).map(([metodo, count]) => {
                              const perc = (count / clientAnalytics.totalTxMetodo) * 100;
                              const color = metodo === 'PIX' ? 'bg-emerald-500' : metodo === 'DINHEIRO' ? 'bg-amber-500' : metodo === 'TRANSFERENCIA' ? 'bg-blue-500' : 'bg-slate-400';
                              return (
                                <div key={metodo} className="flex items-center gap-4">
                                  <span className="text-[10px] font-black text-slate-600 uppercase w-28">{metodo}</span>
                                  <div className="flex-1 h-3 bg-white rounded-full overflow-hidden border border-slate-100">
                                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${perc}%` }} />
                                  </div>
                                  <span className="text-[10px] font-black text-slate-500 w-16 text-right">{count}x ({perc.toFixed(0)}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ TAB: HISTÓRICO ═══ */}
                  {detailTab === 'history' && (
                    <div className="space-y-4 animate-reveal">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={14} /> Histórico de Compras</h4>
                        <span className="text-[10px] font-black text-slate-300">{clientAnalytics.totalVendas} registro(s)</span>
                      </div>
                      {clientAnalytics.clientSales.length === 0 ? (
                        <div className="text-center py-16 text-slate-300">
                          <Package size={48} className="mx-auto mb-4 opacity-30" />
                          <p className="text-sm font-bold">Nenhuma venda registrada</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Data</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase">Item</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Peso</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Valor</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-right">Pago</th>
                                <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientAnalytics.clientSales.map((sale, idx) => {
                                const total = sale.peso_real_saida * sale.preco_venda_kg;
                                const pago = (sale as any).valor_pago || 0;
                                const status = sale.status_pagamento;
                                return (
                                  <tr key={idx} className="border-t border-slate-50 hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3 text-xs font-bold text-slate-600">{new Date(sale.data_venda).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-4 py-3">
                                      <p className="text-xs font-bold text-slate-700">{sale.id_completo}</p>
                                      <p className="text-[9px] text-slate-400">{sale.preco_venda_kg.toFixed(2)}/kg</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">{formatWeight(sale.peso_real_saida)}</td>
                                    <td className="px-4 py-3 text-xs font-bold text-slate-800 text-right">{formatCurrency(total)}</td>
                                    <td className="px-4 py-3 text-xs font-bold text-emerald-600 text-right">{formatCurrency(pago)}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${status === 'PAGO' ? 'bg-emerald-50 text-emerald-600' : status === 'PENDENTE' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ TAB: COMPORTAMENTO ═══ */}
                  {detailTab === 'behavior' && (
                    <div className="space-y-8 animate-reveal">
                      {/* Pontualidade */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-emerald-50/80 rounded-3xl p-6 border border-emerald-100 text-center">
                          <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
                          <p className="text-4xl font-black text-emerald-700">{clientAnalytics.pagasEmDia}</p>
                          <p className="text-[10px] font-black text-emerald-600 uppercase mt-1">Pagas em Dia</p>
                        </div>
                        <div className="bg-rose-50/80 rounded-3xl p-6 border border-rose-100 text-center">
                          <XCircle size={32} className="text-rose-500 mx-auto mb-3" />
                          <p className="text-4xl font-black text-rose-700">{clientAnalytics.pagasAtrasadas}</p>
                          <p className="text-[10px] font-black text-rose-600 uppercase mt-1">Pagas com Atraso</p>
                        </div>
                        <div className="bg-amber-50/80 rounded-3xl p-6 border border-amber-100 text-center">
                          <Clock size={32} className="text-amber-500 mx-auto mb-3" />
                          <p className="text-4xl font-black text-amber-700">{clientAnalytics.mediaDiasAtraso.toFixed(0)}</p>
                          <p className="text-[10px] font-black text-amber-600 uppercase mt-1">Média Dias Atraso</p>
                        </div>
                      </div>

                      {/* Barra de Pontualidade */}
                      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Taxa de Pontualidade</h4>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${clientAnalytics.percEmDia}%` }} />
                          </div>
                          <span className="text-2xl font-black text-slate-900">{clientAnalytics.percEmDia.toFixed(0)}%</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                          {clientAnalytics.percEmDia >= 90 ? '🟢 Excelente pagador — confiança máxima' :
                            clientAnalytics.percEmDia >= 70 ? '🟡 Bom pagador — pequenos atrasos' :
                              clientAnalytics.percEmDia >= 50 ? '🟠 Atenção — atrasos frequentes' :
                                '🔴 Alto risco — maioria das vendas com atraso'}
                        </p>
                      </div>

                      {/* Vendas vencidas agora */}
                      {clientAnalytics.vendasVencidas > 0 && (
                        <div className="bg-rose-50 rounded-2xl p-6 border border-rose-200 flex items-center gap-4">
                          <AlertTriangle size={24} className="text-rose-500" />
                          <div>
                            <p className="text-sm font-black text-rose-700">{clientAnalytics.vendasVencidas} venda(s) vencida(s) agora</p>
                            <p className="text-[10px] text-rose-500 mt-1">Cobrar imediatamente ou renegociar</p>
                          </div>
                        </div>
                      )}

                      {/* Resumo financeiro */}
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Resumo Financeiro</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Total Faturado</span><span className="text-sm font-black text-slate-900">{formatCurrency(clientAnalytics.totalFaturado)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-emerald-500">Total Pago</span><span className="text-sm font-black text-emerald-600">-{formatCurrency(clientAnalytics.totalPago)}</span></div>
                          <div className="border-t border-slate-200 pt-3 flex justify-between items-center"><span className="text-xs font-black text-slate-700">Saldo Devedor</span><span className={`text-lg font-black ${clientAnalytics.saldoDevedor > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(clientAnalytics.saldoDevedor)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-blue-500">Lucro Gerado</span><span className="text-sm font-black text-blue-600">{formatCurrency(clientAnalytics.totalLucro)}</span></div>
                          <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">Limite de Crédito</span><span className="text-sm font-black text-slate-600">{formatCurrency(selectedClientForDetails.limite_credito)}</span></div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* FOOTER ACTIONS */}
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="text-slate-400 font-bold text-sm px-6">Descartar</button>
                  <button form="edit-form" type="submit" className="btn-modern btn-brand px-10 bg-amber-600 hover:bg-amber-700 flex items-center gap-2"><Save size={18} /> Salvar Alterações</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingClient(selectedClientForDetails); setIsEditing(true); }} className="flex items-center gap-2 text-slate-400 font-bold text-sm hover:text-slate-800 transition-colors">
                    <Edit3 size={18} /> Editar Cadastro
                  </button>
                  {clientAnalytics && clientAnalytics.saldoDevedor > 0.01 && onGoToFinancial && (
                    <button onClick={() => { setSelectedClientForDetails(null); onGoToFinancial(); }} className="btn-modern btn-brand px-10 bg-blue-600 hover:bg-blue-700 flex items-center gap-3 shadow-lg shadow-blue-100">
                      <Wallet size={20} /> Receber Pagamento
                      <ExternalLink size={14} className="opacity-60" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;