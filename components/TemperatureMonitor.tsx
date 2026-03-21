/**
 * TEMPERATURE MONITOR — FrigoGest 2026
 * Registro manual de temperatura e umidade da câmara fria.
 * Alertas visuais por faixa. Histórico salvo no Supabase.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Thermometer, Droplets, Plus, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { todayBR } from '../utils/helpers';

interface TemperatureReading {
  id: string;
  camara: string;
  temperatura: number;
  umidade?: number;
  registrado_em: string;
  operador?: string;
  obs?: string;
}

interface TemperatureMonitorProps {
  onBack: () => void;
}

const CAMARAS = ['Câmara 1 — Resfriados', 'Câmara 2 — Congelados', 'Antecâmara', 'Sala de Corte'];

const getTempStatus = (temp: number) => {
  if (temp < -1)  return { label: 'MUITO FRIO', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: '🧊' };
  if (temp <= 4)  return { label: 'IDEAL',      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '✅' };
  if (temp <= 7)  return { label: 'ATENÇÃO',    color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: '⚠️' };
  return           { label: 'CRÍTICO',           color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-200',   icon: '🚨' };
};

const TemperatureMonitor: React.FC<TemperatureMonitorProps> = ({ onBack }) => {
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    camara: CAMARAS[0],
    temperatura: '',
    umidade: '',
    operador: '',
    obs: ''
  });

  useEffect(() => { loadReadings(); }, []);

  const loadReadings = async () => {
    if (!supabase) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('temperature_log')
        .select('*')
        .order('registrado_em', { ascending: false })
        .limit(50);
      setReadings((data || []) as TemperatureReading[]);
    } catch { setReadings([]); }
    setLoading(false);
  };

  const handleSave = async () => {
    const temp = parseFloat(form.temperatura);
    if (isNaN(temp)) return alert('⚠️ Informe a temperatura');
    setSaving(true);
    try {
      const record = {
        id: `TEMP-${Date.now()}`,
        camara: form.camara,
        temperatura: temp,
        umidade: form.umidade ? parseFloat(form.umidade) : null,
        registrado_em: new Date().toISOString(),
        operador: form.operador || 'Operador',
        obs: form.obs || null
      };
      if (supabase) {
        await supabase.from('temperature_log').insert(record);
      }
      setReadings(prev => [record as TemperatureReading, ...prev]);
      setForm({ camara: CAMARAS[0], temperatura: '', umidade: '', operador: '', obs: '' });
      setShowForm(false);

      const status = getTempStatus(temp);
      if (status.label === 'CRÍTICO' || status.label === 'ATENÇÃO') {
        alert(`${status.icon} ALERTA: Temperatura ${status.label}!\n${form.camara}: ${temp}°C\nVerifique o equipamento imediatamente.`);
      }
    } catch (e) {
      alert('Erro ao salvar. Tente novamente.');
    }
    setSaving(false);
  };

  // Últimas leituras por câmara
  const ultimasPorCamara = CAMARAS.reduce((acc, cam) => {
    acc[cam] = readings.find(r => r.camara === cam);
    return acc;
  }, {} as Record<string, TemperatureReading | undefined>);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 pb-20">
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-800 mb-6 transition-all text-sm font-bold">
          <ArrowLeft size={16} /> Voltar
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <Thermometer size={24} className="text-blue-600" /> Monitor de Temperatura
            </h1>
            <p className="text-xs text-slate-400 mt-1">Câmara fria — Registro manual de temperatura e umidade</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/30">
            <Plus size={16} /> Registrar
          </button>
        </div>

        {/* Cards das câmaras */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {CAMARAS.map(cam => {
            const ultima = ultimasPorCamara[cam];
            const status = ultima ? getTempStatus(ultima.temperatura) : null;
            return (
              <div key={cam} className={`premium-card p-5 ${status ? `${status.bg} border ${status.border}` : 'bg-white'}`}>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 truncate">{cam}</p>
                {ultima ? (
                  <>
                    <div className="flex items-end gap-2">
                      <span className={`text-3xl font-black ${status!.color}`}>{ultima.temperatura}°C</span>
                      {ultima.umidade && (
                        <span className="text-sm font-bold text-blue-500 mb-1 flex items-center gap-1">
                          <Droplets size={12} />{ultima.umidade}%
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full mt-1 ${status!.color} ${status!.bg}`}>
                      {status!.icon} {status!.label}
                    </span>
                    <p className="text-[9px] text-slate-400 mt-2 flex items-center gap-1">
                      <Clock size={9} /> {new Date(ultima.registrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {ultima.operador && ` · ${ultima.operador}`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">Sem registro hoje</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Formulário de registro */}
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-8 shadow-sm">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5">Novo Registro</p>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Câmara</label>
                <select className="modern-input h-12 appearance-none w-full text-sm"
                  value={form.camara} onChange={e => setForm(p => ({...p, camara: e.target.value}))}>
                  {CAMARAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Temperatura (°C) *</label>
                  <input type="number" step="0.1" placeholder="-2.5"
                    className={`modern-input h-14 text-2xl font-black text-center ${
                      form.temperatura
                        ? getTempStatus(parseFloat(form.temperatura)).color + ' ' + getTempStatus(parseFloat(form.temperatura)).bg
                        : ''
                    }`}
                    value={form.temperatura} onChange={e => setForm(p => ({...p, temperatura: e.target.value}))} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Umidade (%)</label>
                  <input type="number" step="1" placeholder="80"
                    className="modern-input h-14 text-2xl font-black text-center"
                    value={form.umidade} onChange={e => setForm(p => ({...p, umidade: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Operador</label>
                  <input className="modern-input h-11 text-sm" placeholder="Seu nome"
                    value={form.operador} onChange={e => setForm(p => ({...p, operador: e.target.value}))} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Observação</label>
                  <input className="modern-input h-11 text-sm" placeholder="Opcional"
                    value={form.obs} onChange={e => setForm(p => ({...p, obs: e.target.value}))} />
                </div>
              </div>
              {form.temperatura && (
                <div className={`flex items-center gap-2 p-3 rounded-2xl text-sm font-black ${getTempStatus(parseFloat(form.temperatura)).bg} ${getTempStatus(parseFloat(form.temperatura)).color}`}>
                  {getTempStatus(parseFloat(form.temperatura)).icon}
                  {getTempStatus(parseFloat(form.temperatura)).label} — {parseFloat(form.temperatura)}°C
                  {parseFloat(form.temperatura) > 4 && ' — VERIFICAR EQUIPAMENTO'}
                </div>
              )}
              <button onClick={handleSave} disabled={saving || !form.temperatura}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-500 disabled:opacity-30 transition-all">
                {saving ? 'Salvando...' : '✅ Salvar Registro'}
              </button>
            </div>
          </div>
        )}

        {/* Histórico */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Histórico de Registros</p>
          </div>
          {loading ? (
            <p className="text-center py-8 text-xs text-slate-400">Carregando...</p>
          ) : readings.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400">Nenhum registro ainda</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {readings.map(r => {
                const st = getTempStatus(r.temperatura);
                return (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="text-lg">{st.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{r.camara}</p>
                      <p className="text-[9px] text-slate-400">
                        {new Date(r.registrado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {r.operador && ` · ${r.operador}`}
                        {r.obs && ` · ${r.obs}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-black ${st.color}`}>{r.temperatura}°C</span>
                      {r.umidade && <p className="text-[9px] text-blue-500 font-bold">{r.umidade}% UR</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemperatureMonitor;
