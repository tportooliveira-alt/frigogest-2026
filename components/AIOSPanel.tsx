import React, { useState } from 'react';
import { AutoTriggerResult } from '../services/autoTriggerService';
import { X, ChevronDown, ChevronUp, Zap, Bell } from 'lucide-react';

interface AIOSPanelProps {
    alerts: AutoTriggerResult[];
    onDismiss: (triggerId: string) => void;
    onNavigate?: (target: string) => void;
}

const SEVERITY_CONFIG = {
    BLOQUEIO: { bg: 'bg-red-600', text: 'text-white', badge: 'bg-red-700', dot: '🔴', border: 'border-red-300' },
    CRITICO: { bg: 'bg-rose-500', text: 'text-white', badge: 'bg-rose-700', dot: '🔴', border: 'border-rose-300' },
    ALERTA: { bg: 'bg-amber-500', text: 'text-white', badge: 'bg-amber-700', dot: '🟡', border: 'border-amber-300' },
    INFO: { bg: 'bg-blue-600', text: 'text-white', badge: 'bg-blue-800', dot: '🟢', border: 'border-blue-300' },
};

export const AIOSPanel: React.FC<AIOSPanelProps> = ({ alerts, onDismiss, onNavigate }) => {
    const [expanded, setExpanded] = useState(true);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const visible = alerts.filter(a => !dismissed.has(a.triggerId));
    if (visible.length === 0) return null;

    const criticals = visible.filter(a => a.severity === 'BLOQUEIO' || a.severity === 'CRITICO').length;
    const warnings = visible.filter(a => a.severity === 'ALERTA').length;

    const handleDismiss = (id: string) => {
        setDismissed(prev => new Set([...prev, id]));
        onDismiss(id);
    };

    return (
        <div className="mb-6 rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
            {/* Header */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white"
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full">
                        <Zap size={14} className="text-yellow-400" />
                        <span className="text-xs font-black tracking-widest">AIOS SENTINELA</span>
                    </div>
                    {criticals > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-500 text-xs font-black animate-pulse">
                            🔴 {criticals} CRÍTICO{criticals > 1 ? 'S' : ''}
                        </span>
                    )}
                    {warnings > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-xs font-black">
                            🟡 {warnings} ALERTA{warnings > 1 ? 'S' : ''}
                        </span>
                    )}
                    <Bell size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-400">{visible.length} agente{visible.length > 1 ? 's' : ''} ativo{visible.length > 1 ? 's' : ''}</span>
                </div>
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {/* Alerts */}
            {expanded && (
                <div className="divide-y divide-slate-100 bg-white">
                    {visible.map(alert => {
                        const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;
                        return (
                            <div key={alert.triggerId} className={`flex items-start gap-4 px-5 py-4 border-l-4 ${cfg.border} hover:bg-slate-50 transition-colors`}>
                                {/* Agent emoji */}
                                <div className="text-2xl shrink-0 mt-0.5">{alert.agentEmoji}</div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${cfg.bg} ${cfg.text}`}>
                                            {alert.severity}
                                        </span>
                                        <span className="text-xs font-bold text-slate-500">{alert.agentName}</span>
                                        <span className="text-[10px] text-slate-300">
                                            {alert.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 leading-tight">{alert.title}</p>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{alert.message}</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {alert.actionLabel && onNavigate && (
                                        <button
                                            onClick={() => onNavigate(alert.actionTarget || '')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${cfg.bg} ${cfg.text} hover:opacity-90 transition-opacity`}
                                        >
                                            {alert.actionLabel}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDismiss(alert.triggerId)}
                                        className="p-1 text-slate-300 hover:text-slate-600 transition-colors"
                                        title="Dispensar"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AIOSPanel;
