'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, ShieldCheck, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

function CreatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL'den token'ı al ve bileşen ilk yüklendiğinde kaybolmaması için ref içinde sakla
  const rawToken = searchParams.get('token');
  const tokenRef = useRef<string | null>(null);

  if (rawToken && !tokenRef.current) {
    tokenRef.current = rawToken;
  }

  const activeToken = tokenRef.current || rawToken;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!activeToken) {
      setErrorMsg("URL'de aktivasyon token'ı bulunamadı! Lütfen mailinizdeki bağlantıya doğrudan tıklayın.");
    } else {
      setErrorMsg('');
    }
  }, [activeToken]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!activeToken) {
      setErrorMsg('Geçersiz veya eksik aktivasyon bağlantısı. Lütfen e-postadaki linke tekrar tıklayın.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Şifreniz en az 6 karakter olmalıdır.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const API_BASE_URL = (
        process.env.NEXT_PUBLIC_API_URL || 
        'http://192.168.3.17:5000/api'
      ).replace(/\/$/, '');

      const response = await fetch(`${API_BASE_URL}/auth/create-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          token: activeToken.trim(), 
          password: password.trim() 
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
      } else {
        setErrorMsg(data.message || 'Şifre oluşturulurken bir hata oluştu.');
      }
    } catch (err: any) {
      console.error('❌ Bağlantı hatası:', err);
      setErrorMsg('Backend sunucusuna bağlanılamadı. Lütfen sunucunun aktif olduğunu kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
        
        {/* HEADER */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isSuccess ? 'Şifre Oluşturuldu!' : 'Yeni Şifre Belirleyin'}
          </h1>
          <p className="text-xs text-slate-400">
            {isSuccess ? 'İşlem başarıyla tamamlandı' : 'Hesabınız için güvenli bir şifre tanımlayın'}
          </p>
        </div>

        {/* HATA UYARISI */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* BAŞARILI DURUMU */}
        {isSuccess ? (
          <div className="space-y-6 text-center py-2">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl text-xs leading-relaxed flex items-start gap-3 text-left">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-emerald-200 text-sm font-semibold mb-1">Tebrikler!</strong>
                Şifreniz başarıyla kaydedildi. Yeni şifrenizle sisteme veya mobil uygulamaya giriş yapabilirsiniz.
              </div>
            </div>

            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-900/30 cursor-pointer text-xs"
            >
              Giriş Ekranına Git
            </button>
          </div>
        ) : (
          /* ŞİFRE FORMU */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Yeni Şifre</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  disabled={loading || !activeToken}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Şifreyi Tekrar Girin</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  disabled={loading || !activeToken}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !activeToken}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Şifreyi Kaydet'
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

export default function CreatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
      </div>
    }>
      <CreatePasswordContent />
    </Suspense>
  );
}