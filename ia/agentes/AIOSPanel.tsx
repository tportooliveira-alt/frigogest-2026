/**
 * AIOS PANEL — FrigoGest 2026
 * Exibe alertas automáticos dos sentinelas. Dismiss individual e navegação.
 */

import React from 'react';
import { X, AlertCircle, AlertTriangle, Info, ShieldAlert, ChevronRight } from 'lucide-react';
import { AutoTriggerResult, TriggerSeverity } from '../nucleo/autoTriggerService';

interface AIOSPanelProps {
  alerts: AutoTriggerResult[];
  onDismiss: (triggerId: string) => void;
  onNavigate: (target: string) => void;
}

const severityConfig: Record<TriggerSeverity, { bg: string; border: string; icon: any; iconColor: string; badge: string }> = {
  BLOQUEIO: { bg: 'bg-red-950',    border: 'border-red-800',    icon: ShieldAlert,     iconColor: 'text-red-400',    badge: 'bg-red-600 text-white' },
  CRITICO:  { bg: 'bg-rose-950',   border: 'border-rose-800',   icon: AlertCircle,     iconColor: 'text-rose-400',   badge: 'bg-rose-500 text-white' },
  ALERTA:   { bg: 'bg-amber-950',  border: 'border-amber-800',  icon: AlertTriangle,   iconColor: 'text-amber-400',  badge: 'bg-amber-500 text-white' },
  INFO:     { bg: 'bg-slate-800',  border: 'border-slate-700',  icon: Info,            iconColor: 'text-blue-400',   badge: 'bg-blue-600 text-white' },
};

export const AIOSPanel: React.FC<AIOSPanelProps> = ({ alerts, onDismiss, onNavigate }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pt-4 space-y-2">
      {alerts.map(alert => {
        const cfg = severityConfig[alert.severity] || severityConfig.INFO;
        const Icon = cfg.icon;
        return (
          <div
            key={alert.triggerId}
            className={`flex items-start gap-3 p-3 rounded-2xl border ${cfg.bg} ${cfg.border} animate-reveal`}
          >
            <Icon size={18} className={`${cfg.iconColor} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.badge}`}>
                  {alert.severity}
                </span>
                <p className="text-xs font-black text-white">{alert.title}</p>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{alert.message}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {alert.navigateTo && (
                <button
                  onClick={() => onNavigate(alert.navigateTo!)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                  title="Ver detalhes"
                >
                  <ChevronRight size={14} className="text-white" />
                </button>
              )}
              <button
                onClick={() => onDismiss(alert.triggerId)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                title="Dispensar"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AIOSPanel;
