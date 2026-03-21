import React from 'react';
import { Thermometer, Settings, LayoutDashboard, Users, Package, Truck, Scale, Beef, DollarSign, LogOut, FileText, Zap, Calendar, Bot, Database, ShieldCheck, Sheet, Brain, MessageCircle, Megaphone, PlayCircle, ClipboardCheck, BarChart3, Target, Bell, TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react';
import { APP_VERSION_SHORT, APP_BUILD_DATE } from '../constants';

interface HomeKpis {
  saldoCaixa: number;
  aReceber: number;
  aPagar: number;
  stockValue: number;
  recebimentosMes: number;
  despesasMes: number;
  margemMes: number;
  vencidas: number;
}

interface SidebarProps {
  setView: (view: string) => void;
  onLogout: () => void;
  onSyncSheets?: () => void;
  sheetsSyncStatus?: 'idle' | 'syncing' | 'ok' | 'error';
  kpis?: HomeKpis;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const Sidebar: React.FC<SidebarProps> = ({ setView, onLogout, onSyncSheets, sheetsSyncStatus, kpis }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Painel Geral', description: 'Visão Macro & KPIs', icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50', glow: 'group-hover:shadow-lg' },
    { id: 'clients', label: 'Clientes', description: 'Agenda & Contatos', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', glow: 'group-hover:shadow-lg' },
    { id: 'suppliers', label: 'Fornecedores', description: 'Cadastro Rural', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50', glow: 'group-hover:shadow-lg' },
    { id: 'batches', label: 'Cadastro de Lotes', description: 'Entrada de Gado', icon: Package, color: 'text-purple-600', bg: 'bg-purple-50', glow: 'group-hover:shadow-lg' },
    { id: 'gta', label: 'GTA de Gado', description: 'Guia de Trânsito Animal', icon: ClipboardCheck, color: 'text-green-600', bg: 'bg-green-50', glow: 'group-hover:shadow-green-500/50' },
    { id: 'stock', label: 'Estoque', description: 'Auditoria Fria', icon: Beef, color: 'text-emerald-600', bg: 'bg-emerald-50', glow: 'group-hover:shadow-lg' },
    { id: 'expedition', label: 'Vendas', description: 'Venda de Peças', icon: Scale, color: 'text-amber-600', bg: 'bg-amber-50', glow: 'group-hover:shadow-lg' },
    { id: 'sales_history', label: 'Histórico', description: 'Relatórios de Venda', icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50', glow: 'group-hover:shadow-lg' },
    { id: 'financial', label: 'Financeiro', description: 'Fluxo de Caixa', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', glow: 'group-hover:shadow-lg' },
    { id: 'scheduled_orders', label: 'Agendamentos', description: 'Pedidos Futuros', icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50', glow: 'group-hover:shadow-lg' },
    { id: 'heifers', label: 'Gestão Abate', description: 'Novilhas Diárias', icon: Beef, color: 'text-emerald-700', bg: 'bg-emerald-100', glow: 'group-hover:shadow-lg' },
    { id: 'ai_agents', label: 'Central IA', description: 'Agentes Inteligentes', icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50', glow: 'group-hover:shadow-lg' },
    { id: 'market_dashboard', label: 'Mercado', description: 'Análise V4 Monte Carlo', icon: BarChart3, color: 'text-cyan-600', bg: 'bg-cyan-50', glow: 'group-hover:shadow-cyan-500/50' },
    { id: 'pricing_engine', label: 'Precificação', description: 'Motor V4 Compra', icon: Target, color: 'text-amber-600', bg: 'bg-amber-50', glow: 'group-hover:shadow-amber-500/50' },
    { id: 'alert_center', label: 'Alertas', description: 'Monitoramento Mercado', icon: Bell, color: 'text-orange-600', bg: 'bg-orange-50', glow: 'group-hover:shadow-orange-500/50' },
    { id: 'ai_chat', label: 'Chat IA', description: 'Fale com Gerentes', icon: MessageCircle, color: 'text-indigo-600', bg: 'bg-indigo-50', glow: 'group-hover:shadow-lg' },
    { id: 'ai_meeting', label: 'Sala de Guerra', description: 'Reunião Diretoria', icon: Users, color: 'text-rose-600', bg: 'bg-rose-100', glow: 'group-hover:shadow-rose-500/50' },
    { id: 'marketing', label: 'Marketing', description: 'Stitch IA & Studio', icon: Megaphone, color: 'text-fuchsia-600', bg: 'bg-fuchsia-100', glow: 'group-hover:shadow-fuchsia-500/50' },
    { id: 'meeting_chat', label: 'Chat Equipe', description: 'Fale com Funcionários', icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', glow: 'group-hover:shadow-emerald-500/50' },
    { id: 'sales_agent', label: 'Agente IA', description: 'Robô de Vendas', icon: Bot, color: 'text-purple-600', bg: 'bg-purple-100', glow: 'group-hover:shadow-lg' },
    { id: 'report', label: 'Relatório', description: 'Resumo Diário', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', glow: 'group-hover:shadow-lg' },
    { id: 'scenario_simulator', label: 'Simulação IA', description: 'Modo Teste: Auge→Crise→Recuperação', icon: PlayCircle, color: 'text-violet-600', bg: 'bg-violet-50', glow: 'group-hover:shadow-violet-500/50' },
    { id: 'agent_editor', label: 'Editor de Agentes', description: 'Personalize os Especialistas IA', icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50', glow: 'group-hover:shadow-lg' },
    { id: 'temperature', label: 'Temp. Câmara', description: 'Monitor de Temperatura e Umidade', icon: Thermometer, color: 'text-blue-600', bg: 'bg-blue-50', glow: 'group-hover:shadow-blue-500/50' },
    { id: 'audit', label: 'Auditoria', description: 'Quem Fez O Quê', icon: ShieldCheck, color: 'text-rose-600', bg: 'bg-rose-50', glow: 'group-hover:shadow-lg' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-hidden font-sans text-white">

      {/* MODERN GRID & BACKGROUND */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-6xl z-10 animate-fade-in flex flex-col items-center gap-12">

        {/* Brand Header Modern */}
        <div className="text-center space-y-4 relative">
          <div className="absolute -top-6 -right-12 bg-white/20 text-white text-[8px] font-black px-2 py-0.5 rounded border border-white/30 uppercase tracking-[0.2em] animate-pulse">
            Sistema Ativo
          </div>

          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/10 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/20 mb-4 transform hover:scale-110 transition-all duration-700 group cursor-default">
            <Truck size={48} className="text-white group-hover:text-blue-100 transition-colors" />
            <div className="absolute inset-0 rounded-[2rem] border border-white/20 animate-ping opacity-20" />
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-none drop-shadow-2xl">
            Frigo<span className="text-blue-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">Gest</span>
          </h1>

          <div className="flex items-center justify-center gap-4">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-white/30" />
            <p className="text-white/70 font-black text-[10px] uppercase tracking-[0.4em] flex items-center gap-2">
              <Zap size={12} className="text-blue-200" /> Sistema Avançado {APP_VERSION_SHORT} • {APP_BUILD_DATE}
            </p>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-white/30" />
          </div>
        </div>

        {/* KPI Bar */}
        {kpis && (
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Saldo Caixa', value: fmt(kpis.saldoCaixa), icon: Wallet, color: kpis.saldoCaixa >= 0 ? 'text-blue-200' : 'text-rose-300', sub: null },
              { label: 'A Receber', value: fmt(kpis.aReceber), icon: TrendingUp, color: 'text-emerald-300', sub: null },
              { label: 'A Pagar', value: fmt(kpis.aPagar), icon: TrendingDown, color: kpis.vencidas > 0 ? 'text-rose-300' : 'text-orange-300', sub: kpis.vencidas > 0 ? `${kpis.vencidas} vencida${kpis.vencidas > 1 ? 's' : ''}` : null },
              { label: 'Estoque', value: fmt(kpis.stockValue), icon: Beef, color: 'text-amber-300', sub: null },
              { label: 'Recebimentos Mês', value: fmt(kpis.recebimentosMes), icon: BarChart3, color: 'text-cyan-300', sub: null },
              { label: 'Margem Mês', value: `${kpis.margemMes.toFixed(1)}%`, icon: kpis.margemMes >= 0 ? TrendingUp : TrendingDown, color: kpis.margemMes >= 10 ? 'text-emerald-300' : kpis.margemMes >= 0 ? 'text-amber-300' : 'text-rose-300', sub: null },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 flex flex-col gap-1 hover:bg-white/15 transition-all">
                  <div className="flex items-center gap-1.5">
                    <Icon size={11} className={`${kpi.color} shrink-0`} />
                    <span className="text-[9px] font-black text-white/50 uppercase tracking-widest truncate">{kpi.label}</span>
                  </div>
                  <span className={`text-sm font-black tracking-tight ${kpi.color}`}>{kpi.value}</span>
                  {kpi.sub && (
                    <span className="text-[8px] font-black text-rose-300 uppercase animate-pulse">{kpi.sub}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Menu Grid Modern */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 w-full">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`group relative flex flex-col items-start justify-between p-8 h-48 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] hover:border-white/40 hover:bg-white/15 transition-all duration-500 shadow-2xl active:scale-[0.98] text-left overflow-hidden ${item.glow}`}
              >
                {/* Internal Decorative Scanline */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center ${item.color} group-hover:scale-110 transition-all duration-500 border border-white/10 shadow-lg`}>
                  <Icon size={28} />
                </div>

                <div className="relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                  <h3 className="text-lg font-black text-white group-hover:text-blue-100 transition-colors uppercase tracking-tight">
                    {item.label}
                  </h3>
                  <p className="text-[10px] text-white/60 font-black mt-1 tracking-widest uppercase opacity-60 group-hover:opacity-100">
                    {item.description}
                  </p>
                </div>

                {/* Index Decal */}
                <div className="absolute bottom-8 right-8 flex items-center gap-2 opacity-20 group-hover:opacity-100 transition-all">
                  <div className="h-[1px] w-4 bg-white/30 group-hover:bg-white/60 transition-colors" />
                  <span className="text-[10px] font-mono font-bold text-white/40 group-hover:text-white/80 transition-colors">0{menuItems.indexOf(item) + 1}</span>
                </div>

                {/* Hover Visual Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>

        {/* Action Bar Modern */}
        <div className="mt-4 flex flex-col items-center gap-8 relative">
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (confirm('🔄 Atualizar para nova versão?\n\nSeus dados não serão perdidos!')) {
                  window.location.reload();
                }
              }}
              className="flex items-center gap-3 px-8 py-5 rounded-[2rem] text-white/80 font-black text-xs uppercase tracking-[0.2em] bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 hover:border-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/30 transition-all hover:shadow-lg active:scale-95 group"
            >
              <Zap size={16} className="group-hover:rotate-180 transition-transform" />
              ATUALIZAR
            </button>
            {onSyncSheets && (
              <button
                onClick={onSyncSheets}
                disabled={sheetsSyncStatus === 'syncing'}
                className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] backdrop-blur-md border transition-all hover:shadow-lg active:scale-95 group ${sheetsSyncStatus === 'syncing'
                  ? 'text-amber-300/80 bg-amber-500/20 border-amber-400/30 cursor-wait'
                  : sheetsSyncStatus === 'ok'
                    ? 'text-emerald-300/80 bg-emerald-500/20 border-emerald-400/30'
                    : sheetsSyncStatus === 'error'
                      ? 'text-rose-300/80 bg-rose-500/20 border-rose-400/30'
                      : 'text-white/80 bg-white/10 border-white/20 hover:border-blue-400 hover:text-blue-300 hover:bg-blue-500/20'
                  }`}
              >
                <Sheet size={16} className={sheetsSyncStatus === 'syncing' ? 'animate-spin' : 'group-hover:scale-110 transition-transform'} />
                {sheetsSyncStatus === 'syncing' ? 'SINCRONIZANDO...' : sheetsSyncStatus === 'ok' ? '✅ SINCRONIZADO' : 'SYNC PLANILHA'}
              </button>
            )}
            <button
              onClick={onLogout}
              className="flex items-center gap-3 px-8 py-5 rounded-[2rem] text-white/80 font-black text-xs uppercase tracking-[0.2em] bg-white/10 backdrop-blur-md border border-white/20 hover:border-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-all hover:shadow-lg active:scale-95 group"
            >
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
              SAIR
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-4 text-white/40 font-bold text-[8px] uppercase tracking-[0.5em]">
              <span>Status: Online</span>
              <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
              <span>Enc: 256-Bit</span>
            </div>
            <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.4em]">
              &copy; FRIGOGEST 2026 &bull; SYS_ID: FG-PRO-X
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;