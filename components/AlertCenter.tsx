import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, BellOff, CheckCircle, AlertTriangle, XCircle, Info, Trash2, RefreshCw, Loader2, Settings, Volume2, VolumeX } from 'lucide-react';
import { checkMarketAlerts, getAllAlerts, markAlertAsRead, clearAllAlerts, getUnreadCount, requestPushPermission, getAlertConfig, saveAlertConfig, MarketAlert, AlertSeverity } from '../services/alertService';

interface AlertCenterProps {
    onBack: () => void;
}

const severityConfig: Record<AlertSeverity, { cor: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
    CRITICO: { cor: 'text-red-400', bg: 'bg-red-900/40', border: 'border-red-700/40', icon: XCircle },
    ALTO: { cor: 'text-orange-400', bg: 'bg-orange-900/40', border: 'border-orange-700/40', icon: AlertTriangle },
    MEDIO: { cor: 'text-yellow-400', bg: 'bg-yellow-900/40', border: 'border-yellow-700/40', icon: Info },
    INFO: { cor: 'text-blue-400', bg: 'bg-blue-900/40', border: 'border-blue-700/40', icon: Info },
};

const AlertCenter: React.FC<AlertCenterProps> = ({ onBack }) => {
    const [alerts, setAlerts] = useState<MarketAlert[]>([]);
    const [isChecking, setIsChecking] = useState(false);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [config, setConfig] = useState(getAlertConfig());

    useEffect(() => {
        // Carregar alertas existentes
        setAlerts(getAllAlerts());
        setPushEnabled(getAlertConfig().pushEnabled);
        // Verificar novos alertas ao abrir
        verificarNovos();
    }, []);

    const verificarNovos = async () => {
        setIsChecking(true);
        try {
            const novos = await checkMarketAlerts();
            setAlerts(getAllAlerts()); // Recarregar todos
            if (novos.length > 0) {
                // Feedback visual
            }
        } catch (err) {
            console.error('Erro ao verificar alertas:', err);
        }
        setIsChecking(false);
    };

    const handleMarkRead = (id: string) => {
        markAlertAsRead(id);
        setAlerts(getAllAlerts());
    };

    const handleClearAll = () => {
        clearAllAlerts();
        setAlerts([]);
    };

    const handleTogglePush = async () => {
        if (!pushEnabled) {
            const granted = await requestPushPermission();
            if (granted) {
                setPushEnabled(true);
                saveAlertConfig({ pushEnabled: true });
            }
        } else {
            setPushEnabled(false);
            saveAlertConfig({ pushEnabled: false });
        }
    };

    const handleToggleSound = () => {
        const newVal = !config.somEnabled;
        setConfig({ ...config, somEnabled: newVal });
        saveAlertConfig({ somEnabled: newVal });
    };

    const unreadCount = alerts.filter(a => !a.lida).length;
    const criticalCount = alerts.filter(a => !a.lida && (a.severity === 'CRITICO' || a.severity === 'ALTO')).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-4 md:p-8">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                    <ArrowLeft size={18} /> Voltar
                </button>
                <div className="flex items-center gap-3">
                    <button onClick={verificarNovos} disabled={isChecking} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5 hover:bg-gray-700 transition-colors">
                        <RefreshCw size={12} className={`text-gray-400 ${isChecking ? 'animate-spin' : ''}`} />
                        <span className="text-[10px] text-gray-400">{isChecking ? 'Verificando...' : 'Verificar Agora'}</span>
                    </button>
                    <button onClick={handleTogglePush} className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 transition-colors ${pushEnabled ? 'bg-green-900/40 border-green-700/40' : 'bg-gray-800 border-gray-700'}`}>
                        {pushEnabled ? <Bell size={12} className="text-green-400" /> : <BellOff size={12} className="text-gray-500" />}
                        <span className={`text-[10px] ${pushEnabled ? 'text-green-400' : 'text-gray-500'}`}>{pushEnabled ? 'Push ON' : 'Push OFF'}</span>
                    </button>
                    <button onClick={handleToggleSound} className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 transition-colors ${config.somEnabled ? 'bg-blue-900/40 border-blue-700/40' : 'bg-gray-800 border-gray-700'}`}>
                        {config.somEnabled ? <Volume2 size={12} className="text-blue-400" /> : <VolumeX size={12} className="text-gray-500" />}
                        <span className={`text-[10px] ${config.somEnabled ? 'text-blue-400' : 'text-gray-500'}`}>Som</span>
                    </button>
                    <div className="text-right">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                            🔔 Central de <span className="text-orange-400">Alertas</span>
                        </h1>
                        <p className="text-gray-500 text-xs mt-1">Monitoramento Automático de Mercado</p>
                    </div>
                </div>
            </div>

            {/* RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-red-900/30 to-red-800/10 border border-red-800/30 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-black text-red-400">{criticalCount}</div>
                    <p className="text-gray-500 text-xs">Críticos / Altos</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/10 border border-yellow-800/30 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-black text-yellow-400">{unreadCount}</div>
                    <p className="text-gray-500 text-xs">Não Lidos</p>
                </div>
                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 border border-blue-800/30 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-black text-blue-400">{alerts.length}</div>
                    <p className="text-gray-500 text-xs">Total de Alertas</p>
                </div>
            </div>

            {/* LISTA DE ALERTAS */}
            <div className="space-y-3">
                {alerts.length === 0 ? (
                    <div className="text-center py-12">
                        <Bell size={48} className="text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 text-sm">Nenhum alerta no momento</p>
                        <p className="text-gray-700 text-xs mt-1">Os alertas aparecerão aqui quando marcos de preço forem rompidos</p>
                    </div>
                ) : (
                    <>
                        {alerts.map((alert) => {
                            const sev = severityConfig[alert.severity];
                            const Icon = sev.icon;
                            return (
                                <div
                                    key={alert.id}
                                    className={`${sev.bg} border ${sev.border} rounded-2xl p-4 ${alert.lida ? 'opacity-50' : ''} transition-all hover:opacity-100`}
                                    onClick={() => !alert.lida && handleMarkRead(alert.id)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            <Icon size={20} className={sev.cor} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-sm font-bold ${sev.cor}`}>{alert.titulo}</span>
                                                {!alert.lida && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse flex-shrink-0" />}
                                            </div>
                                            <p className="text-gray-300 text-xs">{alert.mensagem}</p>
                                            <div className="mt-2 bg-gray-900/40 rounded-lg p-2">
                                                <p className="text-[10px] text-gray-400">
                                                    <span className="text-amber-400 font-bold">📋 AÇÃO:</span> {alert.acao}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[9px] text-gray-600">
                                                    {alert.timestamp.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className={`text-[9px] px-2 py-0.5 rounded-full ${sev.bg} ${sev.cor} font-bold`}>
                                                    {alert.severity}
                                                </span>
                                                <span className="text-[9px] text-gray-600">{alert.category}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="text-center mt-4">
                            <button onClick={handleClearAll} className="flex items-center gap-2 text-red-500/60 hover:text-red-400 text-xs mx-auto transition-colors">
                                <Trash2 size={12} /> Limpar todos os alertas
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* FOOTER */}
            <div className="mt-8 text-center">
                <p className="text-gray-700 text-[9px]">
                    Monitoramento: CEPEA marcos (R$ 330-380) • Dólar (R$ 5.30-6.00) • Margem mínima 18% • Variação diária 1.5%+ • Tendência V4
                </p>
            </div>
        </div>
    );
};

export default AlertCenter;
