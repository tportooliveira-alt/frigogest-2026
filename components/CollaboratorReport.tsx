import React, { useState, useRef, useEffect } from 'react';
import {
    Mic,
    MicOff,
    CheckCircle,
    Activity,
    ArrowLeft,
    Zap,
    Save,
    History,
    FileText,
    AlertCircle,
    BrainCircuit,
    Video,
    VideoOff,
    Upload,
    Loader2
} from 'lucide-react';
import { DailyReport } from '../types';
import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface CollaboratorReportProps {
    onBack?: () => void;
    onSubmit?: (data: {
        intensity: string;
        notes: string;
        type: 'RELATORIO' | 'RECLAMACAO';
        extra_movement: boolean;
        technical_issues: boolean;
        audio_url?: string;
        client_complaint_audio_url?: string;
        video_url?: string;
    }) => Promise<void>;
    reports?: DailyReport[];
}

const WaveVisualizer: React.FC<{ isRecording: boolean; color: string; stream: MediaStream | null }> = ({ isRecording, color, stream }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();

    useEffect(() => {
        if (!isRecording || !stream || !canvasRef.current) return;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const width = canvas.width;
            const height = canvas.height;

            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, width, height);

            const barWidth = (width / bufferLength) * 1.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height * 0.8;

                ctx.fillStyle = color;
                // Draw mirrored bars for more symmetry
                ctx.fillRect(x, (height - barHeight) / 2, barWidth - 2, barHeight);
                x += barWidth;
            }
            requestRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            audioContext.close();
        };
    }, [isRecording, stream, color]);

    if (!isRecording) return null;

    return (
        <canvas
            ref={canvasRef}
            width={300}
            height={60}
            className="w-full h-12 animate-reveal"
        />
    );
};

const CollaboratorReport: React.FC<CollaboratorReportProps> = ({ onBack, onSubmit, reports = [] }) => {
    const [intensity, setIntensity] = useState<'tranquilo' | 'normal' | 'intenso'>('normal');
    const [openText, setOpenText] = useState('');
    const [technicalIssues, setTechnicalIssues] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // MULTIMEDIA STATES
    const [isRecordingJourney, setIsRecordingJourney] = useState(false);
    const [isRecordingClient, setIsRecordingClient] = useState(false);
    const [isRecordingVideo, setIsRecordingVideo] = useState(false);

    const [journeyAudio, setJourneyAudio] = useState<string | null>(null);
    const [clientAudio, setClientAudio] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<{ [key: string]: boolean }>({});
    const [recordingTime, setRecordingTime] = useState(0);
    const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Speech recognition states and effects are removed as per instruction
    // const [isListening, setIsListening] = useState(false);
    // const recognitionRef = useRef<any>(null);

    // useEffect(() => {
    //     if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    //         const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    //         recognitionRef.current = new SpeechRecognition();
    //         recognitionRef.current.continuous = true;
    //         recognitionRef.current.interimResults = true;
    //         recognitionRef.current.lang = 'pt-BR';
    //         recognitionRef.current.onresult = (event: any) => {
    //             let final = '';
    //             for (let i = event.resultIndex; i < event.results.length; ++i) if (event.results[i].isFinal) final += event.results[i][0].transcript;
    //             if (final) setOpenText(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + final);
    //         };
    //         recognitionRef.current.onend = () => setIsListening(false);
    //     }
    // }, []);

    // const toggleListening = () => {
    //     if (!recognitionRef.current) return alert('Seu navegador não suporta reconhecimento de voz.');
    //     if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    //     else { recognitionRef.current.start(); setIsListening(true); }
    // };

    const uploadToFirebase = async (blob: Blob, type: string): Promise<string> => {
        if (!storage) throw new Error('Firebase Storage não configurado');
        const fileName = `reports/${Date.now()}_${type}.${blob.type.split('/')[1]}`;
        const storageRef = ref(storage, fileName);
        setIsUploading(prev => ({ ...prev, [type]: true }));
        try {
            const snapshot = await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } finally {
            setIsUploading(prev => ({ ...prev, [type]: false }));
        }
    };

    const startRecording = async (type: 'journey' | 'client' | 'video') => {
        try {
            const constraints: MediaStreamConstraints = {
                audio: true,
                video: type === 'video' ? { facingMode: 'user' } : false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setActiveStream(stream);

            if (type === 'video' && videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = stream;
            }

            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const mimeType = type === 'video' ? 'video/webm' : 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type: mimeType });

                try {
                    const downloadUrl = await uploadToFirebase(blob, type);
                    if (type === 'journey') setJourneyAudio(downloadUrl);
                    else if (type === 'client') setClientAudio(downloadUrl);
                    else setVideoUrl(downloadUrl);
                } catch (err) {
                    alert('Erro ao salvar no servidor. Tente novamente.');
                    console.error(err);
                }

                stream.getTracks().forEach(track => track.stop());
                setActiveStream(null);
                if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
            };

            recorder.start();
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            if (type === 'journey') setIsRecordingJourney(true);
            else if (type === 'client') setIsRecordingClient(true);
            else setIsRecordingVideo(true);
        } catch (err) {
            alert('Erro ao acessar câmera/microfone. Verifique as permissões.');
        }
    };

    const stopRecording = (type: 'journey' | 'client' | 'video') => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            if (type === 'journey') setIsRecordingJourney(false);
            else if (type === 'client') setIsRecordingClient(false);
            else setIsRecordingVideo(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'journey' | 'client' | 'video') => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const downloadUrl = await uploadToFirebase(file, type);
            if (type === 'journey') setJourneyAudio(downloadUrl);
            else if (type === 'client') setClientAudio(downloadUrl);
            else setVideoUrl(downloadUrl);
        } catch (err) {
            alert('Erro ao fazer upload do arquivo.');
        }
    };

    const handleSubmit = async (type: 'RELATORIO' | 'RECLAMACAO') => {
        if (!onSubmit) return;
        setIsSubmitting(true);
        try {
            await onSubmit({
                intensity,
                notes: openText,
                type,
                extra_movement: false,
                technical_issues: technicalIssues,
                audio_url: journeyAudio || undefined,
                client_complaint_audio_url: clientAudio || undefined,
                video_url: videoUrl || undefined
            });
            setSuccessMessage('Sucesso');
            setOpenText(''); setTechnicalIssues(false); setIntensity('normal');
            setJourneyAudio(null); setClientAudio(null); setVideoUrl(null);
            setTimeout(() => setSuccessMessage(null), 2500);
        } finally { setIsSubmitting(false); }
    };

    const sortedReports = [...reports].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (successMessage) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-emerald-50 flex items-center justify-center p-8 animate-reveal">
                <div className="bg-white rounded-[48px] p-16 text-center shadow-[0_32px_64px_-16px_rgba(251,191,36,0.2)] max-w-sm w-full border border-yellow-100">
                    <div className="w-24 h-24 bg-gradient-to-tr from-emerald-400 to-teal-500 text-white rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-200">
                        <CheckCircle size={56} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2 italic">Tudo Certo!</h2>
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mt-4">Sua jornada multimídia foi registrada ✨</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-10 min-h-screen bg-gradient-to-b from-slate-50 to-orange-50/30 technical-grid animate-reveal pb-40 font-sans">

            {/* SUN-INSPIRED HEADER */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
                <div className="flex flex-col gap-6">
                    <button onClick={onBack} className="group self-start flex items-center gap-3 px-6 py-2 bg-white/80 backdrop-blur-md border border-amber-100 rounded-full text-[10px] font-black text-amber-600 uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all shadow-sm">
                        <ArrowLeft size={14} /> Início
                    </button>
                    <div className="flex items-center gap-6">
                        <div className="bg-gradient-to-tr from-amber-400 to-orange-500 p-4 rounded-[28px] text-white shadow-2xl shadow-orange-200 hover:rotate-6 transition-transform">
                            <BrainCircuit size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tight text-slate-800 leading-none">
                                Meu Diário de <span className="text-orange-500 italic">Jornada</span>
                            </h1>
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-[0.3em] mt-2">
                                Registro Multimídia & Energia
                            </p>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 border-none">
                    Operador Oficial
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                <div className="lg:col-span-12 xl:col-span-5 space-y-10">
                    <div className="bg-white rounded-[40px] p-10 shadow-2xl shadow-orange-100/50 space-y-12 border border-white">
                        <div className="space-y-5">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                <Activity size={14} className="text-emerald-500" /> Como está a operação?
                            </label>
                            <div className="flex p-1.5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                <button onClick={() => setTechnicalIssues(false)} className={`flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${!technicalIssues ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-emerald-600'}`}>Tudo Perfeito</button>
                                <button onClick={() => setTechnicalIssues(true)} className={`flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${technicalIssues ? 'bg-gradient-to-r from-rose-500 to-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-rose-600'}`}>Houve Falhas</button>
                            </div>
                        </div>

                        {/* VIDEO SECTION */}
                        <div className="space-y-5 p-8 bg-indigo-50/50 rounded-[32px] border border-indigo-100/50">
                            <label className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                <Video size={14} /> Registro em Vídeo (Opcional)
                            </label>

                            {isRecordingVideo && (
                                <div className="rounded-2xl overflow-hidden bg-black aspect-video mb-4 shadow-inner">
                                    <video ref={videoPreviewRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                </div>
                            )}

                            <div className="flex flex-col gap-4">
                                {isRecordingVideo && (
                                    <div className="flex items-center justify-between px-4 py-2 bg-indigo-900 rounded-2xl animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                                            <span className="font-mono text-xs font-bold text-indigo-100 uppercase tracking-widest">Gravando</span>
                                        </div>
                                        <span className="font-mono text-sm font-black text-white">{formatTime(recordingTime)}</span>
                                    </div>
                                )}

                                {!videoUrl ? (
                                    <>
                                        <button
                                            disabled={isUploading['video']}
                                            onClick={() => isRecordingVideo ? stopRecording('video') : startRecording('video')}
                                            className={`flex-1 min-w-[150px] py-4 rounded-[20px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${isRecordingVideo ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100'} ${isUploading['video'] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isUploading['video'] ? <Loader2 className="animate-spin" size={18} /> : (isRecordingVideo ? <VideoOff size={18} /> : <Video size={18} />)}
                                            {isUploading['video'] ? 'Salvando...' : (isRecordingVideo ? 'Parar Vídeo' : 'Gravar Vídeo')}
                                        </button>
                                        {!isRecordingVideo && (
                                            <label className={`cursor-pointer flex items-center justify-center px-6 py-4 rounded-[20px] bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 transition-all ${isUploading['video'] ? 'opacity-50' : ''}`}>
                                                <Upload size={18} />
                                                <input disabled={isUploading['video']} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
                                                <span className="ml-2 text-[10px] font-black uppercase tracking-widest">Upload</span>
                                            </label>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex-1 space-y-4">
                                        <video src={videoUrl} controls className="w-full rounded-2xl shadow-lg" />
                                        <button onClick={() => setVideoUrl(null)} className="w-full py-3 rounded-xl bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 flex items-center justify-center gap-2">
                                            <Zap size={14} /> Trocar Vídeo
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AUDIO JOURNEY SECTION */}
                        <div className="space-y-5 p-8 bg-blue-50/50 rounded-[32px] border border-blue-100/50">
                            <label className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                <Mic size={14} /> Relato da Jornada (Áudio)
                            </label>
                            <div className="flex flex-col gap-4">
                                {isRecordingJourney && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center font-mono text-xs font-black text-blue-600 uppercase tracking-widest">
                                            <span>Captação Ativa</span>
                                            <span>{formatTime(recordingTime)}</span>
                                        </div>
                                        <div className="bg-blue-100/30 rounded-2xl p-4 border border-blue-200/50">
                                            <WaveVisualizer isRecording={isRecordingJourney} color="#2563eb" stream={activeStream} />
                                        </div>
                                    </div>
                                )}

                                {!journeyAudio ? (
                                    <div className="flex items-center gap-4">
                                        <button
                                            disabled={isUploading['journey']}
                                            onClick={() => isRecordingJourney ? stopRecording('journey') : startRecording('journey')}
                                            className={`flex-1 py-4 rounded-[20px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${isRecordingJourney ? 'bg-rose-500 text-white animate-pulse' : 'bg-blue-600 text-white shadow-xl shadow-blue-100'} ${isUploading['journey'] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isUploading['journey'] ? <Loader2 className="animate-spin" size={18} /> : (isRecordingJourney ? <MicOff size={18} /> : <Mic size={18} />)}
                                            {isUploading['journey'] ? 'Salvando...' : (isRecordingJourney ? 'Parar Gravação' : 'Gravar Áudio')}
                                        </button>
                                        {!isRecordingJourney && (
                                            <label className={`cursor-pointer flex items-center justify-center px-6 py-4 rounded-[20px] bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 transition-all ${isUploading['journey'] ? 'opacity-50' : ''}`}>
                                                <Upload size={18} />
                                                <input disabled={isUploading['journey']} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'journey')} />
                                            </label>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center gap-4">
                                        <audio src={journeyAudio} controls className="flex-1 h-12" />
                                        <button onClick={() => setJourneyAudio(null)} className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100"><Mic size={18} /></button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CLIENT COMPLAINT AUDIO SECTION */}
                        <div className="space-y-5 p-8 bg-rose-50/50 rounded-[32px] border border-rose-100/50">
                            <label className="text-[11px] font-black text-rose-600 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                <AlertCircle size={14} /> Reclamação de Cliente (Áudio)
                            </label>
                            <div className="flex flex-col gap-4">
                                {isRecordingClient && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center font-mono text-xs font-black text-rose-600 uppercase tracking-widest">
                                            <span>Relato Crítico</span>
                                            <span>{formatTime(recordingTime)}</span>
                                        </div>
                                        <div className="bg-rose-100/30 rounded-2xl p-4 border border-rose-200/50">
                                            <WaveVisualizer isRecording={isRecordingClient} color="#e11d48" stream={activeStream} />
                                        </div>
                                    </div>
                                )}

                                {!clientAudio ? (
                                    <div className="flex items-center gap-4">
                                        <button
                                            disabled={isUploading['client']}
                                            onClick={() => isRecordingClient ? stopRecording('client') : startRecording('client')}
                                            className={`flex-1 py-4 rounded-[20px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${isRecordingClient ? 'bg-rose-600 text-white animate-pulse shadow-xl shadow-rose-200' : 'bg-white border-2 border-rose-100 text-rose-600 hover:bg-rose-50'} ${isUploading['client'] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isUploading['client'] ? <Loader2 className="animate-spin" size={18} /> : (isRecordingClient ? <Save size={18} /> : <Mic size={18} />)}
                                            {isUploading['client'] ? 'Salvando...' : (isRecordingClient ? 'Parar Cliente' : 'Gravar Cliente')}
                                        </button>
                                        {!isRecordingClient && (
                                            <label className={`cursor-pointer flex items-center justify-center px-6 py-4 rounded-[20px] bg-white border-2 border-rose-100 text-rose-600 hover:bg-rose-50 transition-all ${isUploading['client'] ? 'opacity-50' : ''}`}>
                                                <Upload size={18} />
                                                <input disabled={isUploading['client']} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'client')} />
                                            </label>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center gap-4">
                                        <audio src={clientAudio} controls className="flex-1 h-12" />
                                        <button onClick={() => setClientAudio(null)} className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100"><Mic size={18} /></button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-5">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                <Zap size={14} className="text-amber-500" /> Ritmo de Trabalho
                            </label>
                            <div className="grid grid-cols-3 p-1.5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                {(['tranquilo', 'normal', 'intenso'] as const).map(l => (
                                    <button
                                        key={l}
                                        onClick={() => setIntensity(l)}
                                        className={`py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${intensity === l ?
                                            (l === 'tranquilo' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' :
                                                l === 'normal' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' :
                                                    'bg-orange-600 text-white shadow-lg shadow-orange-100')
                                            : 'text-slate-400 hover:bg-white/50'}`}
                                    >
                                        {l === 'tranquilo' ? 'Leve' : l === 'normal' ? 'Normal' : 'Intenso'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="flex justify-between items-center px-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Observações (Texto Opcional)</label>
                            </div>
                            <div className="relative">
                                <textarea
                                    value={openText}
                                    onChange={e => setOpenText(e.target.value)}
                                    className={`w-full h-40 p-8 rounded-[32px] font-bold text-slate-700 bg-slate-50/50 border-2 border-slate-100 outline-none transition-all placeholder:text-slate-300 focus:border-amber-400 focus:bg-white focus:shadow-xl focus:shadow-amber-100/50`}
                                    placeholder="Caso queira escrever algo mais..."
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => handleSubmit('RELATORIO')}
                                disabled={isSubmitting}
                                className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-5 rounded-[24px] hover:shadow-2xl hover:shadow-orange-200 transition-all font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95"
                            >
                                {isSubmitting ? <Activity size={18} className="animate-spin" /> : <Save size={18} />} Enviar Jornada Completa ☀️
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-12 xl:col-span-7 space-y-8">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-2 flex items-center gap-3">
                        <History size={18} className="text-orange-500" /> Histórico Operacional
                    </h3>
                    <div className="grid grid-cols-1 gap-6">
                        {sortedReports.length === 0 ? (
                            <div className="py-40 flex flex-col items-center justify-center bg-white rounded-[48px] border-2 border-dashed border-slate-100 shadow-sm">
                                <Zap size={80} className="mb-6 text-amber-100" />
                                <p className="text-[11px] font-black uppercase text-slate-300 tracking-[0.4em]">Aguardando primeiro registro multimídia</p>
                            </div>
                        ) : (
                            sortedReports.map(item => (
                                <div key={item.id} className="bg-white rounded-[32px] p-8 flex flex-col gap-6 shadow-xl shadow-slate-100 border-l-[8px] border-amber-400 hover:border-orange-500 transition-all hover:-translate-x-1 group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 flex items-center justify-center group-hover:from-orange-500 group-hover:to-orange-600 group-hover:text-white transition-all shadow-sm">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-tight">{item.userName || "Operador Feliz"}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${item.type === 'RECLAMACAO' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>{item.type === 'RECLAMACAO' ? 'Ocorrência' : 'Tudo Ok'}</span>
                                                    <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-blue-50 text-blue-500`}>{item.intensity.toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] font-black text-slate-700">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            <p className="text-[9px] font-bold text-slate-300 uppercase">{new Date(item.timestamp).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    {/* MULTIMEDIA PLAYERS IN HISTORY IF EXISTS */}
                                    <div className="space-y-4">
                                        {/* @ts-ignore */}
                                        {item.video_url && (
                                            <div className="rounded-2xl overflow-hidden shadow-lg border border-indigo-100">
                                                <video src={item.video_url} controls className="w-full" />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* @ts-ignore */}
                                            {item.audio_url && (
                                                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100/50">
                                                    <Mic size={14} className="text-blue-500" />
                                                    <audio src={item.audio_url} controls className="flex-1 h-8" />
                                                </div>
                                            )}
                                            {/* @ts-ignore */}
                                            {item.client_complaint_audio_url && (
                                                <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-2xl border border-rose-100/50">
                                                    <AlertCircle size={14} className="text-rose-500" />
                                                    <audio src={item.client_complaint_audio_url} controls className="flex-1 h-8" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {item.notes && (
                                        <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                                            <p className="text-sm font-bold text-slate-600 leading-relaxed italic">"{item.notes}"</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CollaboratorReport;
