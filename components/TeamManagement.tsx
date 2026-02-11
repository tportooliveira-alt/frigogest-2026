import React, { useState } from 'react';
import {
    ArrowLeft,
    Award,
    DollarSign,
    Heart,
    MessageCircle,
    ThumbsUp,
    Trophy,
    Users,
    Sparkles,
    Send,
    Cake
} from 'lucide-react';
import {
    sendEmployeeBirthday,
    sendPerformanceRecognition,
    sendBonusNotification,
    sendOvertimeThanks,
    sendPositiveFeedback,
    sendEmployeeOfTheMonth,
    EMPLOYEE_TEMPLATES
} from '../utils/employeeCommunication';

interface TeamManagementProps {
    onBack?: () => void;
}

// Mock de funcionários (substituir por dados reais depois)
const mockEmployees = [
    { id: '1', name: 'João Silva', phone: '11999998888', role: 'Operador' },
    { id: '2', name: 'Maria Santos', phone: '11988887777', role: 'Atendente' },
    { id: '3', name: 'Carlos Souza', phone: '11977776666', role: 'Motorista' },
];

const TeamManagement: React.FC<TeamManagementProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'recognition' | 'birthday' | 'bonus'>('recognition');
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Dados de formulário
    const [achievement, setAchievement] = useState('');
    const [bonusAmount, setBonusAmount] = useState(0);
    const [bonusReason, setBonusReason] = useState('');
    const [hoursWorked, setHoursWorked] = useState(0);

    const handleSendRecognition = async () => {
        const employee = mockEmployees.find(e => e.id === selectedEmployee);
        if (!employee || !achievement) return alert('Preencha todos os campos!');

        setIsSending(true);
        await sendPerformanceRecognition(employee.name, employee.phone, achievement, bonusAmount || undefined);
        setIsSending(false);
        alert('✅ Reconhecimento enviado!');
        setAchievement('');
        setBonusAmount(0);
    };

    const handleSendBirthday = async () => {
        const employee = mockEmployees.find(e => e.id === selectedEmployee);
        if (!employee) return alert('Selecione um funcionário!');

        setIsSending(true);
        await sendEmployeeBirthday(employee.name, employee.phone);
        setIsSending(false);
        alert('✅ Parabéns enviado!');
    };

    const handleSendBonus = async () => {
        const employee = mockEmployees.find(e => e.id === selectedEmployee);
        if (!employee || !bonusReason || bonusAmount <= 0) return alert('Preencha todos os campos!');

        setIsSending(true);
        await sendBonusNotification(employee.name, employee.phone, bonusAmount, bonusReason);
        setIsSending(false);
        alert('✅ Bônus notificado!');
        setBonusReason('');
        setBonusAmount(0);
    };

    return (
        <div className="p-4 md:p-10 min-h-screen bg-[#f8fafc] technical-grid animate-reveal pb-20">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-10">
                <button
                    onClick={onBack}
                    className="group flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 hover:text-blue-700 hover:border-blue-100 transition-all shadow-sm mb-6"
                >
                    <ArrowLeft size={14} /> Voltar
                </button>

                <div className="flex items-center gap-5">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-blue-900/40">
                        <Users size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                            Gestão de <span className="text-blue-600">Equipe</span>
                        </h1>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-1">
                            Reconhecimento e Motivação
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <nav className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm mt-8 overflow-x-auto">
                    {[
                        { id: 'recognition', icon: Trophy, label: 'Reconhecimento' },
                        { id: 'birthday', icon: Cake, label: 'Aniversários' },
                        { id: 'bonus', icon: DollarSign, label: 'Bônus' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
                                }`}
                        >
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto">
                {activeTab === 'recognition' && (
                    <div className="space-y-6">
                        {/* Performance Recognition */}
                        <div className="premium-card p-8 bg-white">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                    <Trophy size={28} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Reconhecimento de Destaque</h3>
                                    <p className="text-xs text-slate-400 font-bold">Valorize seu time!</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Funcionário
                                    </label>
                                    <select
                                        value={selectedEmployee}
                                        onChange={e => setSelectedEmployee(e.target.value)}
                                        className="modern-input h-12"
                                    >
                                        <option value="">Selecione...</option>
                                        {mockEmployees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name} - {emp.role}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Conquista / Motivo
                                    </label>
                                    <textarea
                                        value={achievement}
                                        onChange={e => setAchievement(e.target.value)}
                                        placeholder="Ex: Bateu meta de vendas do mês com 150%!"
                                        className="modern-input h-24 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                        Bônus (Opcional)
                                    </label>
                                    <input
                                        type="number"
                                        value={bonusAmount || ''}
                                        onChange={e => setBonusAmount(Number(e.target.value))}
                                        placeholder="0.00"
                                        className="modern-input h-12"
                                    />
                                </div>

                                <button
                                    onClick={handleSendRecognition}
                                    disabled={!selectedEmployee || !achievement || isSending}
                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-14 rounded-2xl shadow-xl shadow-amber-200 hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <Send size={18} /> Enviar Reconhecimento
                                </button>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Thank for Overtime */}
                            <div className="premium-card p-6 bg-white">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <ThumbsUp size={20} />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-900">Agradecer Hora Extra</h4>
                                </div>

                                <div className="space-y-3">
                                    <select
                                        value={selectedEmployee}
                                        onChange={e => setSelectedEmployee(e.target.value)}
                                        className="modern-input h-10 text-sm"
                                    >
                                        <option value="">Funcionário...</option>
                                        {mockEmployees.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.name}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        value={hoursWorked || ''}
                                        onChange={e => setHoursWorked(Number(e.target.value))}
                                        placeholder="Horas trabalhadas"
                                        className="modern-input h-10 text-sm"
                                    />

                                    <button
                                        onClick={async () => {
                                            const emp = mockEmployees.find(e => e.id === selectedEmployee);
                                            if (!emp || hoursWorked <= 0) return alert('Preencha os campos!');
                                            setIsSending(true);
                                            await sendOvertimeThanks(emp.name, emp.phone, hoursWorked);
                                            setIsSending(false);
                                            alert('✅ Agradecimento enviado!');
                                            setHoursWorked(0);
                                        }}
                                        disabled={!selectedEmployee || hoursWorked <= 0 || isSending}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl text-sm disabled:opacity-50 transition-all"
                                    >
                                        Agradecer
                                    </button>
                                </div>
                            </div>

                            {/* Positive Feedback */}
                            <div className="premium-card p-6 bg-white">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                                        <Sparkles size={20} />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-900">Feedback Positivo</h4>
                                </div>

                                <p className="text-xs text-slate-600 mb-4">
                                    💡 Envie mensagens rápidas de reconhecimento para ações específicas!
                                </p>

                                <button
                                    disabled
                                    className="w-full bg-slate-200 text-slate-400 font-bold h-10 rounded-xl text-sm cursor-not-allowed"
                                >
                                    Em Breve
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'birthday' && (
                    <div className="premium-card p-8 bg-white">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
                                <Cake size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Aniversário do Time</h3>
                                <p className="text-xs text-slate-400 font-bold">Comemore com a equipe!</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                    Aniversariante
                                </label>
                                <select
                                    value={selectedEmployee}
                                    onChange={e => setSelectedEmployee(e.target.value)}
                                    className="modern-input h-12"
                                >
                                    <option value="">Selecione...</option>
                                    {mockEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} - {emp.role}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-pink-50 rounded-2xl p-6 border border-pink-100">
                                <p className="text-xs font-bold text-pink-900 mb-3">🎂 Mensagem inclui:</p>
                                <ul className="text-[11px] text-pink-700 space-y-2">
                                    <li>✨ Parabéns personalizado</li>
                                    <li>💝 Votos de saúde e felicidade</li>
                                    <li>🎁 Presente surpresa</li>
                                </ul>
                            </div>

                            <button
                                onClick={handleSendBirthday}
                                disabled={!selectedEmployee || isSending}
                                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold h-14 rounded-2xl shadow-xl shadow-pink-200 hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <Cake size={18} /> Enviar Parabéns
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'bonus' && (
                    <div className="premium-card p-8 bg-white">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <DollarSign size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Notificação de Bônus</h3>
                                <p className="text-xs text-slate-400 font-bold">Comunique prêmios e incentivos</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                    Funcionário
                                </label>
                                <select
                                    value={selectedEmployee}
                                    onChange={e => setSelectedEmployee(e.target.value)}
                                    className="modern-input h-12"
                                >
                                    <option value="">Selecione...</option>
                                    {mockEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} - {emp.role}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                    Valor do Bônus (R$)
                                </label>
                                <input
                                    type="number"
                                    value={bonusAmount || ''}
                                    onChange={e => setBonusAmount(Number(e.target.value))}
                                    placeholder="0.00"
                                    className="modern-input h-12"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                                    Motivo do Bônus
                                </label>
                                <textarea
                                    value={bonusReason}
                                    onChange={e => setBonusReason(e.target.value)}
                                    placeholder="Ex: Meta de vendas atingida"
                                    className="modern-input h-24 resize-none"
                                />
                            </div>

                            <button
                                onClick={handleSendBonus}
                                disabled={!selectedEmployee || bonusAmount <= 0 || !bonusReason || isSending}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-14 rounded-2xl shadow-xl shadow-emerald-200 hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <Send size={18} /> Notificar Bônus
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamManagement;
