'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ShieldCheck, Loader2, X, CheckCircle2 } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.3.17:5000/api';

export default function LoginPage() {
  const router = useRouter();
  
  // Giriş State'leri
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Şifremi Unuttum Modal State'leri
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        throw new Error(data.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.');
      }

      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('token', data.token);

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sunucuya bağlanırken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Şifre Sıfırlama İsteği
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setResetLoading(true);
    setResetInfo(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await res.json();
      setResetInfo(
        data.message || 'E-posta adresi sistemde kayıtlıysa, bu adrese şifre yenileme bağlantısı iletilecektir.'
      );
    } catch (err) {
      // Güvenlik uyarısı: Hata olsa dahi aynı bilgi mesajı gösterilir
      setResetInfo('E-posta adresi sistemde kayıtlıysa, bu adrese şifre yenileme bağlantısı iletilecektir.');
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotModal = () => {
    setIsForgotModalOpen(false);
    setResetEmail('');
    setResetInfo(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Geçiş Sistem Portalı</h1>
          <p className="text-xs text-slate-400">Yönetici paneline erişmek için oturum açın</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">E-Posta Adresi</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pass.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-300 font-medium">Şifre</label>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline transition cursor-pointer"
              >
                Şifremi Unuttum?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Giriş Yapılıyor...
              </>
            ) : (
              'Sisteme Giriş Yap'
            )}
          </button>
        </form>
      </div>

      {/* ŞİFREMİ UNUTTUM POP-UP (MODAL) */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" /> Şifre Yenileme
              </h3>
              <button 
                onClick={closeForgotModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetInfo ? (
              <div className="space-y-4 text-center py-2">
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-xl text-xs leading-relaxed flex items-start gap-2.5 text-left">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>{resetInfo}</span>
                </div>
                <button
                  onClick={closeForgotModal}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
                <p className="text-slate-400 leading-relaxed">
                  Sistemde kayıtlı e-posta adresinizi giriniz. Şifre yenileme bağlantısı bu adrese iletilecektir.
                </p>

                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="ornek@domain.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="px-4 py-2 rounded-xl font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {resetLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Gönder</span>
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}