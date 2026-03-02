import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ArrowLeft, Send, Users, Mic, MicOff, Phone, PhoneOff,
    MessageCircle, Hash, Volume2, VolumeX, Plus, X, Check, CheckCheck,
    Loader2, Wifi, WifiOff, Video, VideoOff, Monitor, Share2
} from 'lucide-react';
import { db } from '../firebaseClient';
import {
    collection, addDoc, onSnapshot, query, orderBy,
    serverTimestamp, limit, Timestamp, doc, setDoc, deleteDoc, getDocs, where
} from 'firebase/firestore';

// ═══ TYPES ═══
interface ChatMessage {
    id: string;
    text: string;
    senderName: string;
    senderRole: string;
    senderColor: string;
    timestamp: Timestamp | null;
    type: 'message' | 'system';
}

interface OnlineUser {
    id: string;
    name: string;
    role: string;
    color: string;
    lastSeen: Timestamp | null;
}

interface MeetingChatProps {
    onBack: () => void;
}

// ═══ EMPLOYEE COLORS ═══
const COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
];

const ROLES = ['Dono', 'Gerente', 'Açougueiro', 'Vendedor', 'Estoquista', 'Motorista', 'Administrador', 'Outro'];

const MeetingChat: React.FC<MeetingChatProps> = ({ onBack }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [myName, setMyName] = useState('');
    const [myRole, setMyRole] = useState('Dono');
    const [myColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
    const [myId] = useState(`user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
    const [joined, setJoined] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [showParticipants, setShowParticipants] = useState(false);
    const [videoCallActive, setVideoCallActive] = useState(false);
    const [jitsiRoomId] = useState(`frigogest-suporte-${Date.now().toString(36)}`);
    const MANAGER_WHATSAPP = '5577999226268';

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);
    const unsubMessagesRef = useRef<(() => void) | null>(null);
    const unsubUsersRef = useRef<(() => void) | null>(null);
    const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const ROOM_ID = 'sala-principal';
    const MESSAGES_COLLECTION = `meetingRooms/${ROOM_ID}/messages`;
    const PRESENCE_COLLECTION = `meetingRooms/${ROOM_ID}/presence`;

    // ═══ SCROLL TO BOTTOM ═══
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // ═══ SETUP MIC ═══
    const toggleMic = useCallback(() => {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            alert('Seu navegador não suporta reconhecimento de voz.');
            return;
        }
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            const text = event.results[0][0].transcript;
            setInputText(prev => (prev ? prev + ' ' + text : text));
        };
        recognition.onerror = () => setIsListening(false);
        recognition.start();
    }, [isListening]);

    // ═══ PRESENCE: JOIN MEETING ═══
    const joinMeeting = useCallback(async () => {
        if (!myName.trim()) return;
        if (!db) { alert('Firebase não configurado.'); return; }

        setIsLoading(true);
        try {
            // Register presence
            await setDoc(doc(db, PRESENCE_COLLECTION, myId), {
                id: myId,
                name: myName.trim(),
                role: myRole,
                color: myColor,
                lastSeen: serverTimestamp(),
            });

            // Send join system message
            await addDoc(collection(db, MESSAGES_COLLECTION), {
                text: `${myName.trim()} entrou na reunião.`,
                senderName: 'Sistema',
                senderRole: '',
                senderColor: '#64748b',
                timestamp: serverTimestamp(),
                type: 'system',
            });

            // Update presence every 15s
            presenceIntervalRef.current = setInterval(async () => {
                if (db) {
                    await setDoc(doc(db, PRESENCE_COLLECTION, myId), {
                        id: myId,
                        name: myName.trim(),
                        role: myRole,
                        color: myColor,
                        lastSeen: serverTimestamp(),
                    }, { merge: true });
                }
            }, 15000);

            setJoined(true);
            setIsConnected(true);
        } catch (err) {
            console.error(err);
            alert('Erro ao entrar na reunião. Verifique a conexão.');
        }
        setIsLoading(false);
    }, [myName, myRole, myColor, myId, MESSAGES_COLLECTION, PRESENCE_COLLECTION]);

    // ═══ LISTEN TO MESSAGES ═══
    useEffect(() => {
        if (!joined || !db) return;

        const q = query(
            collection(db, MESSAGES_COLLECTION),
            orderBy('timestamp', 'asc'),
            limit(100)
        );
        unsubMessagesRef.current = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
            setMessages(msgs);
        });

        return () => unsubMessagesRef.current?.();
    }, [joined, MESSAGES_COLLECTION]);

    // ═══ LISTEN TO ONLINE USERS ═══
    useEffect(() => {
        if (!joined || !db) return;

        // Clean stale users (>60s) periodically
        const cleanStale = async () => {
            if (!db) return;
            const cutoff = new Date(Date.now() - 60000);
            try {
                const stale = await getDocs(query(
                    collection(db, PRESENCE_COLLECTION),
                    where('lastSeen', '<', Timestamp.fromDate(cutoff))
                ));
                stale.forEach(d => deleteDoc(d.ref));
            } catch { }
        };

        unsubUsersRef.current = onSnapshot(collection(db, PRESENCE_COLLECTION), (snap) => {
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as OnlineUser));
            setOnlineUsers(users);
        });

        const cleanInterval = setInterval(cleanStale, 30000);

        return () => {
            unsubUsersRef.current?.();
            clearInterval(cleanInterval);
        };
    }, [joined, PRESENCE_COLLECTION]);

    // ═══ LEAVE MEETING ═══
    const leaveMeeting = useCallback(async () => {
        if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
        if (db) {
            try {
                await deleteDoc(doc(db, PRESENCE_COLLECTION, myId));
                await addDoc(collection(db, MESSAGES_COLLECTION), {
                    text: `${myName} saiu da reunião.`,
                    senderName: 'Sistema',
                    senderRole: '',
                    senderColor: '#64748b',
                    timestamp: serverTimestamp(),
                    type: 'system',
                });
            } catch { }
        }
        unsubMessagesRef.current?.();
        unsubUsersRef.current?.();
        setJoined(false);
        setIsConnected(false);
        setMessages([]);
        onBack();
    }, [myId, myName, MESSAGES_COLLECTION, PRESENCE_COLLECTION, onBack]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
            if (db && joined) {
                deleteDoc(doc(db, PRESENCE_COLLECTION, myId)).catch(() => { });
            }
        };
    }, [myId, joined, PRESENCE_COLLECTION]);

    // ═══ SEND MESSAGE ═══
    const sendMessage = useCallback(async () => {
        if (!inputText.trim() || !db) return;
        const text = inputText.trim();
        setInputText('');
        try {
            await addDoc(collection(db, MESSAGES_COLLECTION), {
                text,
                senderName: myName,
                senderRole: myRole,
                senderColor: myColor,
                timestamp: serverTimestamp(),
                type: 'message',
            });
        } catch (err) {
            console.error(err);
            setInputText(text); // restore if failed
        }
    }, [inputText, myName, myRole, myColor, MESSAGES_COLLECTION]);

    const formatTime = (ts: Timestamp | null) => {
        if (!ts) return '';
        const d = ts.toDate();
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    // ═══ JOIN SCREEN ═══
    if (!joined) {
        return (
            <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                    <button onClick={onBack} className="text-slate-300 hover:text-white p-2">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-white font-bold text-base">💬 Sala de Reunião</h1>
                        <p className="text-slate-400 text-xs">Chat com funcionários em tempo real</p>
                    </div>
                </div>

                {/* Join Form */}
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white/5 rounded-3xl border border-white/10 p-8 w-full max-w-sm">
                        {/* Avatar preview */}
                        <div className="flex justify-center mb-6">
                            <div
                                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-2xl"
                                style={{ backgroundColor: myColor }}
                            >
                                {myName ? myName[0]?.toUpperCase() : '?'}
                            </div>
                        </div>

                        <h2 className="text-white text-xl font-bold text-center mb-1">Entrar na Reunião</h2>
                        <p className="text-slate-400 text-sm text-center mb-6">Sala Principal — FrigoGest</p>

                        {/* Name */}
                        <div className="mb-4">
                            <label className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-2 block">Seu Nome</label>
                            <input
                                type="text"
                                value={myName}
                                onChange={e => setMyName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && joinMeeting()}
                                placeholder="Ex: João, Maria, Roberto..."
                                className="w-full bg-white/10 text-white placeholder-slate-500 rounded-xl px-4 py-3 border border-white/20 focus:border-indigo-400 focus:outline-none text-sm"
                                autoFocus
                            />
                        </div>

                        {/* Role */}
                        <div className="mb-6">
                            <label className="text-slate-300 text-xs font-semibold uppercase tracking-wide mb-2 block">Sua Função</label>
                            <select
                                value={myRole}
                                onChange={e => setMyRole(e.target.value)}
                                className="w-full bg-white/10 text-white rounded-xl px-4 py-3 border border-white/20 focus:border-indigo-400 focus:outline-none text-sm"
                            >
                                {ROLES.map(r => (
                                    <option key={r} value={r} className="bg-slate-800">{r}</option>
                                ))}
                            </select>
                        </div>

                        {/* Join button */}
                        <button
                            onClick={joinMeeting}
                            disabled={!myName.trim() || isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Phone size={18} />}
                            {isLoading ? 'Entrando...' : 'Entrar na Reunião'}
                        </button>

                        <p className="text-slate-500 text-xs text-center mt-4">
                            📱 Qualquer funcionário com o app pode entrar
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ═══ CHAT SCREEN ═══
    return (
        <div className="flex flex-col h-screen bg-slate-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 border-b border-white/10 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <button onClick={leaveMeeting} className="text-slate-300 hover:text-red-400 p-1 transition-colors">
                    <PhoneOff size={20} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">💬 Sala Principal</span>
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                    </div>
                    <p className="text-slate-400 text-xs">{onlineUsers.length} na reunião agora</p>
                </div>

                {/* Online avatars */}
                <div className="flex -space-x-2 mr-2">
                    {onlineUsers.slice(0, 4).map(u => (
                        <div
                            key={u.id}
                            title={`${u.name} (${u.role})`}
                            className="w-7 h-7 rounded-full border-2 border-slate-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: u.color }}
                        >
                            {u.name[0]?.toUpperCase()}
                        </div>
                    ))}
                    {onlineUsers.length > 4 && (
                        <div className="w-7 h-7 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
                            +{onlineUsers.length - 4}
                        </div>
                    )}
                </div>

                {/* VIDEO CALL BUTTON */}
                <button
                    onClick={async () => {
                        const newState = !videoCallActive;
                        setVideoCallActive(newState);
                        // Send system message to chat so online users see it
                        if (newState && db) {
                            const jitsiUrl = `https://meet.jit.si/${jitsiRoomId}`;
                            await addDoc(collection(db, MESSAGES_COLLECTION), {
                                text: `📹 ${myName} iniciou uma CHAMADA DE VÍDEO!\n🔗 Clique para entrar: ${jitsiUrl}\n📺 Vídeo + Áudio + Compartilhamento de Tela`,
                                senderName: 'Sistema',
                                senderRole: '',
                                senderColor: '#10b981',
                                timestamp: serverTimestamp(),
                                type: 'system',
                            });
                        }
                    }}
                    title={videoCallActive ? 'Encerrar chamada de vídeo' : 'Iniciar suporte remoto (vídeo + tela)'}
                    className={`p-1.5 rounded-lg transition-all ${videoCallActive
                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                        : 'text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                >
                    {videoCallActive ? <VideoOff size={18} /> : <Video size={18} />}
                </button>

                {/* SEND VIA WHATSAPP */}
                {videoCallActive && (
                    <button
                        onClick={() => {
                            const jitsiUrl = `https://meet.jit.si/${jitsiRoomId}`;
                            const onlineNames = onlineUsers.filter(u => u.id !== myId).map(u => u.name).join(', ');
                            const msg = encodeURIComponent(
                                `🆘 *SUPORTE REMOTO — FrigoGest*\n\n` +
                                `👤 ${myName} (${myRole}) precisa de ajuda!\n` +
                                (onlineNames ? `👥 Online agora: ${onlineNames}\n` : '') +
                                `\n📹 Clique para entrar na chamada:\n${jitsiUrl}\n\n` +
                                `✅ Vídeo + Áudio + Compartilhamento de Tela`
                            );
                            window.open(`https://wa.me/${MANAGER_WHATSAPP}?text=${msg}`, '_blank');
                        }}
                        title='Enviar link da chamada via WhatsApp'
                        className='flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95'
                    >
                        <Share2 size={14} />
                        📱 WhatsApp
                    </button>
                )}

                <button
                    onClick={() => setShowParticipants(!showParticipants)}
                    className="text-slate-300 hover:text-white p-1"
                >
                    <Users size={18} />
                </button>
                <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="text-slate-300 hover:text-white p-1"
                >
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
            </div>

            {/* Participants panel */}
            {showParticipants && (
                <div className="bg-slate-900 border-b border-white/10 px-4 py-3">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Participantes ({onlineUsers.length})</p>
                    <div className="flex flex-wrap gap-2">
                        {onlineUsers.map(u => (
                            <div key={u.id} className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1">
                                <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: u.color }}
                                >
                                    {u.name[0]?.toUpperCase()}
                                </div>
                                <span className="text-white text-xs">{u.name}</span>
                                <span className="text-slate-500 text-xs">· {u.role}</span>
                                {u.id === myId && <span className="text-indigo-400 text-xs">(você)</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ JITSI VIDEO CALL PANEL ═══ */}
            {videoCallActive && (
                <div className="relative border-b border-white/10 bg-slate-950" style={{ height: '45vh' }}>
                    {/* Online Users Sidebar inside video */}
                    <div className="absolute left-2 top-2 bottom-2 z-10 w-36 bg-slate-900/90 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden flex flex-col">
                        <div className="px-3 py-2 border-b border-white/10">
                            <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">🟢 Online ({onlineUsers.length})</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                            {onlineUsers.map(u => (
                                <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="relative flex-shrink-0">
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                            style={{ backgroundColor: u.color }}
                                        >
                                            {u.name[0]?.toUpperCase()}
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white text-xs font-semibold truncate">{u.name}</p>
                                        <p className="text-slate-500 text-[9px] truncate">{u.role}</p>
                                    </div>
                                </div>
                            ))}
                            {onlineUsers.length === 1 && (
                                <p className="text-slate-500 text-[10px] text-center py-2">Aguardando participantes...</p>
                            )}
                        </div>
                    </div>

                    {/* Jitsi iframe */}
                    <iframe
                        src={`https://meet.jit.si/${jitsiRoomId}#config.startWithVideoMuted=false&config.startWithAudioMuted=false&config.prejoinPageEnabled=false&config.toolbarButtons=["microphone","camera","desktop","fullscreen","hangup","chat","recording","tileview"]&interfaceConfig.TOOLBAR_ALWAYS_VISIBLE=true&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_BRAND_WATERMARK=false&interfaceConfig.DEFAULT_BACKGROUND="#0f172a"`}
                        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                        title="Chamada de vídeo FrigoGest"
                        className="w-full h-full"
                        style={{ border: 'none' }}
                    />

                    {/* Overlay bar top-right */}
                    <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600/90 text-white text-xs font-bold rounded-full shadow-lg">
                            <Monitor size={12} /> Suporte Ativo
                        </span>
                        <button
                            onClick={() => setVideoCallActive(false)}
                            className="w-8 h-8 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all shadow-lg"
                            title="Encerrar chamada"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}



            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-40">
                        <MessageCircle size={48} className="text-slate-500 mb-3" />
                        <p className="text-slate-400 text-sm">Nenhuma mensagem ainda.</p>
                        <p className="text-slate-500 text-xs">Comece a conversa com sua equipe!</p>
                    </div>
                )}

                {messages.map((msg, i) => {
                    if (msg.type === 'system') {
                        return (
                            <div key={msg.id || i} className="flex justify-center">
                                <span className="text-slate-500 text-xs bg-white/5 rounded-full px-3 py-1">
                                    {msg.text}
                                </span>
                            </div>
                        );
                    }

                    const isMe = msg.senderName === myName && msg.senderRole === myRole;
                    return (
                        <div key={msg.id || i} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 self-end"
                                style={{ backgroundColor: msg.senderColor }}
                            >
                                {msg.senderName[0]?.toUpperCase()}
                            </div>

                            {/* Bubble */}
                            <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                                {!isMe && (
                                    <span className="text-xs text-slate-400 px-1">
                                        {msg.senderName} · <span className="text-slate-500">{msg.senderRole}</span>
                                    </span>
                                )}
                                <div
                                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isMe
                                        ? 'bg-indigo-600 text-white rounded-br-sm'
                                        : 'bg-white/10 text-slate-100 rounded-bl-sm'
                                        }`}
                                >
                                    {msg.text}
                                </div>
                                <span className="text-xs text-slate-600 px-1 flex items-center gap-1">
                                    {formatTime(msg.timestamp)}
                                    {isMe && <CheckCheck size={12} className="text-indigo-400" />}
                                </span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-slate-900 border-t border-white/10 px-4 py-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                    {/* Mic button */}
                    <button
                        onClick={toggleMic}
                        title={isListening ? 'Parar gravação' : 'Ditado de voz'}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${isListening
                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                            : 'bg-white/10 text-slate-400 hover:bg-indigo-600 hover:text-white'
                            }`}
                    >
                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>

                    {/* Text input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        placeholder={isListening ? '🔴 Ouvindo...' : 'Mensagem para a equipe...'}
                        className={`flex-1 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all ${isListening
                            ? 'bg-red-900/30 ring-2 ring-red-500/50 placeholder-red-400'
                            : 'bg-white/10 focus:bg-white/15 focus:ring-2 focus:ring-indigo-500/50'
                            }`}
                    />

                    {/* Send button */}
                    <button
                        onClick={sendMessage}
                        disabled={!inputText.trim()}
                        className="w-11 h-11 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-xl flex items-center justify-center transition-all active:scale-95"
                    >
                        <Send size={18} />
                    </button>
                </div>

                {isListening && (
                    <p className="text-center text-xs text-red-400 font-semibold mt-1.5 animate-pulse">
                        🔴 Microfone ativo — fale agora!
                    </p>
                )}

                {/* My identity badge */}
                <div className="flex items-center justify-center gap-2 mt-2">
                    <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: myColor }}
                    >
                        {myName[0]?.toUpperCase()}
                    </div>
                    <span className="text-slate-500 text-xs">{myName} · {myRole}</span>
                </div>
            </div>
        </div>
    );
};

export default MeetingChat;
