import React, { useState, useEffect } from 'react';
import { auth } from '../firebaseClient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Lock, Mail, Loader2, ShieldAlert, Activity, ShieldCheck, Fingerprint, ScanFace } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Verifica se há credenciais salvas e se biometria está disponível
  useEffect(() => {
    // Carregar credenciais salvas
    const savedEmail = localStorage.getItem('fg_saved_email');
    const savedPassword = localStorage.getItem('fg_saved_password');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
      if (savedPassword) setPassword(savedPassword);
    }

    // Verificar suporte à biometria
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setBiometricAvailable(available));
    }
  }, []);

  useEffect(() => { if (error) setError(null); }, [email, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!auth) throw new Error("FIREBASE_CORE_OFFLINE");
      await signInWithEmailAndPassword(auth, email.trim(), password);

      // Salvar credenciais se "Lembrar-me" estiver ativo
      if (rememberMe) {
        localStorage.setItem('fg_saved_email', email);
        localStorage.setItem('fg_saved_password', password);
      } else {
        localStorage.removeItem('fg_saved_email');
        localStorage.removeItem('fg_saved_password');
      }

      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.code?.includes('auth/') ? "CREDENCIAIS INVÁLIDAS" : "ERRO DE PROTOCOLO DE REDE");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Verificar se há credenciais salvas
      const savedEmail = localStorage.getItem('fg_saved_email');
      const savedPassword = localStorage.getItem('fg_saved_password');

      if (!savedEmail || !savedPassword) {
        setError("Faça login normal primeiro para habilitar biometria");
        setLoading(false);
        return;
      }

      // Tentar autenticação biométrica WebAuthn
      const publicKeyCredentialOptions: PublicKeyCredentialRequestOptions = {
        challenge: new Uint8Array(32), // Normalmente viria do servidor
        rpId: window.location.hostname,
        timeout: 60000,
        userVerification: "required"
      };

      await navigator.credentials.get({
        publicKey: publicKeyCredentialOptions
      });

      // Se passou pela biometria, fazer login com credenciais salvas
      if (!auth) throw new Error("FIREBASE_CORE_OFFLINE");
      await signInWithEmailAndPassword(auth, savedEmail, savedPassword);
      onLoginSuccess();

    } catch (err: any) {
      console.error(err);
      setError("Autenticação biométrica falhou. Use login normal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfdff] technical-grid flex items-center justify-center p-6 relative overflow-hidden font-sans">

      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-40 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-100 rounded-full blur-[120px] opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[48px] w-full max-w-lg shadow-[0_32px_64px_-16px_rgba(37,99,235,0.1)] relative overflow-hidden animate-reveal p-1">
        <div className="p-10 md:p-14">

          {/* Header Section */}
          <div className="mb-12 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full mb-6">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Acesso Restrito</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 leading-none">
              Frigo<span className="text-blue-600">Gest</span><span className="text-emerald-500">.</span>
            </h1>
            <p className="text-sm font-medium text-slate-400 mt-4 leading-relaxed max-w-sm">
              Entre com suas credenciais para gerenciar a inteligência operacional do seu frigorífico.
            </p>
          </div>

          {error && (
            <div className="mb-8 border border-red-100 bg-red-50 p-4 rounded-2xl flex items-center gap-4 animate-reveal">
              <ShieldAlert size={20} className="text-red-600" />
              <div>
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Falha na Autenticação</p>
                <p className="text-xs font-bold text-red-800">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">E-mail Corporativo</label>
              <div className="relative group">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ex: admin@sistema.com"
                  className="modern-input h-14 pl-12 bg-slate-50 border-slate-200 focus:bg-white transition-all text-slate-900 font-semibold"
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Senha de Acesso</label>
              <div className="relative group">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="modern-input h-14 pl-12 bg-slate-50 border-slate-200 focus:bg-white transition-all text-slate-900 font-semibold"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
              </div>
            </div>

            {/* Checkbox Lembrar-me */}
            <div className="flex items-center gap-3 px-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-5 h-5 rounded-lg accent-blue-600 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                Lembrar minhas credenciais neste dispositivo
              </label>
            </div>

            <div className="pt-6 space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 rounded-2xl shadow-xl shadow-blue-200 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Activity size={18} />
                    <span>Acessar Painel</span>
                  </>
                )}
              </button>

              {/* Botão Biometria */}
              {biometricAvailable && (
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-14 rounded-2xl shadow-xl shadow-emerald-200 hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Fingerprint size={20} />
                      <ScanFace size={18} />
                      <span>Login Biométrico</span>
                    </>
                  )}
                </button>
              )}

              <div className="mt-8 flex items-center justify-center gap-3 opacity-30">
                <div className="h-px w-8 bg-slate-300" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">v2.6.5 Enterprise</span>
                <div className="h-px w-8 bg-slate-300" />
              </div>
            </div>
          </form>
        </div>
      </div >
    </div >
  );
};

export default Login;