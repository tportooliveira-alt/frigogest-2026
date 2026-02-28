import React, { useState } from 'react';
import { Bot, AlertTriangle, CheckCircle, XCircle, ArrowRight, ShieldCheck, Zap, Activity } from 'lucide-react';
import { OrchestrationResult, OrchestrationStep } from '../services/orchestratorService';

interface OrchestratorViewProps {
    result: OrchestrationResult | null;
    onApprove: (decision: string) => void;
    onReject: () => void;
    isLoading: boolean;
}

const statusColors = {
    PENDING: 'bg-gray-100 text-gray-500 border-gray-200',
    RUNNING: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse',
    COMPLETED: 'bg-green-100 text-green-700 border-green-200',
    FAILED: 'bg-red-100 text-red-700 border-red-200',
    VETOED: 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
};

const statusIcons = {
    PENDING: <Activity size={16} className="text-gray-400" />,
    RUNNING: <Activity size={16} className="text-blue-500 animate-spin" />,
    COMPLETED: <CheckCircle size={16} className="text-green-500" />,
    FAILED: <XCircle size={16} className="text-red-500" />,
    VETOED: <AlertTriangle size={16} className="text-amber-600" />
};

export const OrchestratorView: React.FC<OrchestratorViewProps> = ({ result, onApprove, onReject, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border shadow-sm p-6 w-full max-w-4xl mx-auto my-6 animate-pulse font-sans">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                        <Zap className="text-violet-500" />
                    </div>
                    <div>
                        <div className="h-5 w-48 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 w-64 bg-gray-100 rounded"></div>
                    </div>
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0"></div>
                            <div className="flex-1 h-20 bg-gray-50 rounded-xl border border-gray-100"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!result) return null;

    return (
        <div className="bg-white rounded-2xl border shadow-lg overflow-hidden w-full max-w-4xl mx-auto my-6 font-sans">

            {/* HEADER ORQUESTRADOR */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 text-white flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="text-emerald-400" size={20} />
                        <h2 className="text-lg font-bold">Conselho de Agentes (Anti-Alucinação)</h2>
                    </div>
                    <p className="text-slate-300 text-sm">
                        Tópico: "{result.topic}"
                    </p>
                </div>
                <div className="text-right">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${result.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {result.status === 'COMPLETED' ? 'ORQUESTRAÇÃO CONCLUÍDA' : 'FALHA NA CADEIA'}
                    </span>
                    <p className="text-slate-400 text-xs mt-1">
                        Latência: {((result.finishedAt.getTime() - result.startedAt.getTime()) / 1000).toFixed(1)}s
                    </p>
                </div>
            </div>

            {/* CADEIA DE PASSOS (LOG VIEW) */}
            <div className="p-6 bg-slate-50 border-b">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Cadeia de Decisão:</h3>

                <div className="space-y-4">
                    {result.steps.map((step, index) => (
                        <div key={step.id} className="relative">
                            {/* Linha conectora */}
                            {index !== result.steps.length - 1 && (
                                <div className="absolute left-6 top-10 bottom-[-16px] w-[2px] bg-slate-200"></div>
                            )}

                            <div className="flex gap-4 items-start relative z-10">

                                {/* Avatar / Icone Status */}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-4 border-slate-50 bg-white shadow-sm ring-1 ring-slate-100`}>
                                    {step.agent === 'ADMINISTRATIVO' ? <ShieldCheck className="text-violet-600" /> : <Bot className="text-slate-400" />}
                                </div>

                                {/* Caixa de Texto do Agente */}
                                <div className={`flex-1 rounded-xl p-4 border shadow-sm relative ${step.agent === 'ADMINISTRATIVO' ? 'bg-violet-50 border-violet-200' : 'bg-white border-slate-200'
                                    }`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                                {step.agent}
                                                {step.agent === 'ADMINISTRATIVO' && <span className="text-[10px] bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded-md">ORQUESTRADOR</span>}
                                            </span>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Missão: {step.role}</p>
                                        </div>
                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border ${statusColors[step.status]}`}>
                                            {statusIcons[step.status]}
                                            {step.status}
                                        </div>
                                    </div>

                                    <div className={`text-sm leading-relaxed whitespace-pre-wrap ${step.status === 'VETOED' ? 'text-amber-900 font-medium' : 'text-slate-700'}`}>
                                        {step.output || <span className="text-slate-400 italic">Aguardando parecer...</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* PARECER FINAL DO ORQUESTRADOR & BOTÕES HUMANO */}
            {result.status === 'COMPLETED' && (
                <div className="p-6 bg-white">
                    <div className="mb-6 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                        <h3 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                            <CheckCircle size={18} /> Veredito Final (Self-Healing Aplicado)
                        </h3>
                        <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                            {result.finalDecision}
                        </p>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <AlertTriangle size={14} className="text-amber-500" />
                            Processo Crítico: Necessária aprovação humana em caixa/faturamento. (Human-In-The-Loop)
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onReject}
                                className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                VETAR OPÇÃO
                            </button>
                            <button
                                onClick={() => onApprove(result.finalDecision)}
                                className="px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <CheckCircle size={18} />
                                APROVAR E EXECUTAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default OrchestratorView;
