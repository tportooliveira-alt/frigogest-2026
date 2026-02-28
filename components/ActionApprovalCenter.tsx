import React, { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Bell, ExternalLink, Copy, Zap } from 'lucide-react';
import { DetectedAction, generateWhatsAppLink } from '../services/actionParserService';

interface ActionApprovalCenterProps {
    actions: DetectedAction[];
    onApprove: (action: DetectedAction) => void;
    onReject: (actionId: string) => void;
    onClearAll: () => void;
}

const urgencyConfig = {
    ALTA: { label: '🔴 Urgente', badge: 'bg-red-100 text-red-700 border-red-200' },
    MEDIA: { label: '🟡 Normal', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    BAIXA: { label: '🟢 Baixa', badge: 'bg-green-100 text-green-700 border-green-200' },
};

export const ActionApprovalCenter: React.FC<ActionApprovalCenterProps> = ({
    actions, onApprove, onReject, onClearAll
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

    const pending = actions.filter(a => !approvedIds.has(a.id));

    if (actions.length === 0) return null;

    const handleApprove = (action: DetectedAction) => {
        setApprovedIds(prev => new Set([...prev, action.id]));
        onApprove(action);

        // WhatsApp: abrir link direto
        if ((action.type === 'WHATSAPP' || action.type === 'COBRAR' || action.type === 'REATIVAR')
            && action.clientPhone && action.message) {
            const link = generateWhatsAppLink(action.clientPhone, action.message);
            window.open(link, '_blank');
        }
        // Copiar mensagem se tiver
        if (action.message) {
            navigator.clipboard.writeText(action.message).catch(() => { });
        }
    };

    const handleReject = (id: string) => {
        setApprovedIds(prev => new Set([...prev, id]));
        onReject(id);
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 font-sans">
            {/* Badge flutuante */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-3 rounded-2xl shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 transition-all duration-300"
            >
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Bell size={18} />
                        {pending.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold animate-pulse">
                                {pending.length}
                            </span>
                        )}
                    </div>
                    <span className="font-semibold text-sm">Central de Aprovações</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                        {pending.length} pendente{pending.length !== 1 ? 's' : ''}
                    </span>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
            </button>

            {/* Painel de ações */}
            {isOpen && (
                <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-h-[70vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <Zap size={14} className="text-violet-600" />
                            <span className="text-xs font-semibold text-gray-600">
                                Ações sugeridas pelos agentes IA
                            </span>
                        </div>
                        {pending.length > 0 && (
                            <button
                                onClick={onClearAll}
                                className="text-xs text-red-400 hover:text-red-600 transition-colors"
                            >
                                Limpar todas
                            </button>
                        )}
                    </div>

                    {/* Lista de ações */}
                    <div className="divide-y divide-gray-50">
                        {actions.map(action => {
                            const isProcessed = approvedIds.has(action.id);
                            const urg = urgencyConfig[action.urgency];

                            return (
                                <div
                                    key={action.id}
                                    className={`p-4 transition-all duration-300 ${isProcessed ? 'opacity-40 bg-gray-50' : 'bg-white'}`}
                                >
                                    {/* Topo: ícone + label + urgência */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{action.icon}</span>
                                            <span className="font-semibold text-gray-800 text-sm">
                                                {action.label}
                                            </span>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${urg.badge}`}>
                                            {urg.label}
                                        </span>
                                    </div>

                                    {/* Descrição */}
                                    <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">
                                        {action.description}
                                    </p>

                                    {/* Mensagem gerada (se tiver) */}
                                    {action.message && (
                                        <div className="bg-gray-50 rounded-lg p-2 mb-3 text-xs text-gray-600 border border-gray-100 max-h-20 overflow-y-auto">
                                            {action.message}
                                        </div>
                                    )}

                                    {/* Botões */}
                                    {!isProcessed ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(action)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-semibold bg-gradient-to-r ${action.color} hover:opacity-90 active:scale-95 transition-all shadow-sm`}
                                            >
                                                <CheckCircle2 size={14} />
                                                {action.clientPhone ? 'Abrir WhatsApp' : 'Confirmar'}
                                                {action.clientPhone && <ExternalLink size={11} />}
                                            </button>
                                            <button
                                                onClick={() => handleReject(action.id)}
                                                className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-500 text-xs font-medium transition-all"
                                            >
                                                <XCircle size={14} />
                                                Ignorar
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 text-xs text-gray-400 py-1">
                                            <CheckCircle2 size={12} />
                                            <span>Processado</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    {pending.length === 0 && (
                        <div className="text-center py-6 text-gray-400">
                            <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400" />
                            <p className="text-sm">Tudo em dia! ✅</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActionApprovalCenter;
