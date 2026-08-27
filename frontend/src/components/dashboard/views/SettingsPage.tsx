'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Shield,
  KeyRound,
  Save,
  Globe,
  Sliders,
  QrCode,
  MapPin,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Smartphone,
} from 'lucide-react';
import {
  AdminProfile,
  SecuritySettings,
  SystemSettings,
  ToastNotification,
  SettingsPageProps,
  InfoTooltipProps,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <div className="relative inline-flex items-center group">
      <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-rose-400 cursor-pointer transition-colors ml-1" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col w-60 p-2.5 bg-slate-950 text-slate-200 text-[11px] font-normal leading-relaxed rounded-xl border border-slate-700 shadow-2xl z-50 pointer-events-none transition-all">
        <span>{text}</span>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950" />
      </div>
    </div>
  );
}

export function SettingsPage({ onRefreshData }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'system'>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [toast, setToast] = useState<ToastNotification | null>(null);

  const [adminProfile, setAdminProfile] = useState<AdminProfile>({
    name: '',
    email: '',
    title: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    antiPassbackTimeout: 60,
    maxFrequencyAttempts: 3,
    autoBlockViolations: true,
    emailAlerts: true,
    qrExpirySeconds: 30,
    maxQrGenerationCount: 5,
    qrLimitWindowMinutes: 5,
    qrCooldownMinutes: 3,
    deviceBindingEnabled: true,
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    systemName: 'Güvenli QR Geçiş Kontrol Sistemi',
    timezone: 'Europe/Istanbul (UTC+3)',
    logRetentionDays: 90,
    maintenanceMode: false,
    latitude: '41.0082',
    longitude: '28.9784',
    geofenceRadiusMeters: 150,
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('adminToken') || localStorage.getItem('token');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('settings_active_tab') as 'profile' | 'security' | 'system';
      if (savedTab && ['profile', 'security', 'system'].includes(savedTab)) {
        setActiveTab(savedTab);
      }
    }

    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const res = await fetch(`${API_BASE_URL}/settings`, { headers });
        if (!res.ok) throw new Error('Güncel ayarlar çekilemedi.');

        const data = await res.json();
        const profData = data.profile || data.user || data;

        if (profData) {
          setAdminProfile((prev) => ({
            ...prev,
            name: profData.name ?? prev.name,
            email: profData.email ?? prev.email,
            title: profData.title ?? prev.title,
            phone: profData.phone ?? prev.phone,
          }));
        }
        
        // 🛠️ DÜZELTME 1: Veritabanındaki enforceDeviceBinding alanını deviceBindingEnabled ile eşleştirdik
        if (data.security) {
          setSecuritySettings((prev) => ({
            ...prev,
            ...data.security,
            deviceBindingEnabled: data.security.enforceDeviceBinding ?? data.security.deviceBindingEnabled ?? true,
          }));
        }
        
        if (data.system) setSystemSettings((prev) => ({ ...prev, ...data.system }));
      } catch (err: any) {
        showToast('error', err.message || 'Sunucu bağlantı hatası.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleTabChange = (tab: 'profile' | 'security' | 'system') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('settings_active_tab', tab);
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAdminProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (activeTab === 'profile' && adminProfile.newPassword) {
      if (adminProfile.newPassword !== adminProfile.confirmPassword) {
        showToast('error', 'Yeni şifreler birbiriyle eşleşmiyor!');
        setIsSaving(false);
        return;
      }
    }

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      let payload: any = {};
      if (activeTab === 'profile') {
        const cleanedProfile: Record<string, any> = {
          name: adminProfile.name,
          email: adminProfile.email,
          title: adminProfile.title,
          phone: adminProfile.phone,
        };
        if (adminProfile.currentPassword) cleanedProfile.currentPassword = adminProfile.currentPassword;
        if (adminProfile.newPassword) cleanedProfile.newPassword = adminProfile.newPassword;

        payload = { ...cleanedProfile, profile: cleanedProfile };
      } else if (activeTab === 'security') {
        // 🛠️ DÜZELTME 2: Backend/Prisma'nın beklediği enforceDeviceBinding parametresini ekledik
        const securityPayload = {
          ...securitySettings,
          enforceDeviceBinding: securitySettings.deviceBindingEnabled,
        };
        payload = { security: securityPayload, ...securityPayload };
      } else {
        payload = { system: systemSettings, ...systemSettings };
      }

      const res = await fetch(`${API_BASE_URL}/settings/${activeTab}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(responseData.message || 'Veriler kaydedilemedi.');
      }

      const messages = {
        profile: 'Profil bilgileri başarıyla güncellendi.',
        security: 'Güvenlik ve QR parametreleri başarıyla kaydedildi.',
        system: 'Sistem parametreleri başarıyla güncellendi.',
      };
      showToast('success', messages[activeTab]);

      if (activeTab === 'profile') {
        const savedProf = responseData.profile || responseData.user || responseData.data || responseData;
        setAdminProfile((prev) => ({
          ...prev,
          name: savedProf.name ?? prev.name,
          email: savedProf.email ?? prev.email,
          title: savedProf.title ?? prev.title,
          phone: savedProf.phone ?? prev.phone,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }));
      }
    } catch (err: any) {
      showToast('error', err.message || 'İşlem sırasında bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        <p className="text-xs font-semibold">Ayarlar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-[1200px] mx-auto relative">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-5 duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200 shadow-emerald-950/80'
              : 'bg-rose-950/95 border-rose-500 text-rose-200 shadow-rose-950/80'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-bold tracking-wide">{toast.message}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <Settings className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Sistem Ayarları</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Admin profili, QR güvenlik kuralları ve sistem tercihlerini yönetin
            </p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => handleTabChange('profile')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'profile'
              ? 'border-rose-500 text-rose-400 bg-rose-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" /> Admin Profili
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('security')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'security'
              ? 'border-rose-500 text-rose-400 bg-rose-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" /> Güvenlik & QR Kuralları
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('system')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'system'
              ? 'border-rose-500 text-rose-400 bg-rose-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" /> Genel Sistem
        </button>
      </div>

      {activeTab === 'profile' && (
        <form onSubmit={handleSave} autoComplete="off" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-rose-400" /> Kişisel Bilgiler
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Ad Soyad
                <InfoTooltip text="Sistem yöneticisinin ad ve soyad bilgisidir. İşlem loglarında bu isim görünür." />
              </label>
              <input
                type="text"
                name="name"
                placeholder="Örn: İlyas Çetin"
                value={adminProfile.name}
                onChange={handleProfileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                E-Posta
                <InfoTooltip text="Yönetici hesabına ait giriş adresi ve kritik sistem bildirimlerinin iletileceği e-posta adresidir." />
              </label>
              <input
                type="email"
                name="email"
                placeholder="admin@test.com"
                value={adminProfile.email}
                onChange={handleProfileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Unvan
                <InfoTooltip text="Yöneticinin kurum içindeki pozisyonunu veya görev unvanını belirtir." />
              </label>
              <input
                type="text"
                name="title"
                placeholder="Örn: Sistem Yöneticisi"
                value={adminProfile.title}
                onChange={handleProfileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Telefon
                <InfoTooltip text="Acil durumlarda veya sistem uyarılarında iletişim kurulacak telefon numarasıdır." />
              </label>
              <input
                type="text"
                name="phone"
                placeholder="Örn: 0555 555 5555"
                value={adminProfile.phone}
                onChange={handleProfileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 border-b pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-rose-400" /> Şifre Değiştir
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Mevcut Şifre
                <InfoTooltip text="Şifrenizi güncelleyebilmeniz için doğrulanması gereken aktif şifreniz." />
              </label>
              <input
                type="password"
                name="currentPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={adminProfile.currentPassword}
                onChange={handleProfileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Yeni Şifre
                <InfoTooltip text="Tüm yönetim paneli girişlerinde geçerli olacak yeni şifreniz." />
              </label>
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={adminProfile.newPassword}
                onChange={handleProfileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Yeni Şifre (Tekrar)
                <InfoTooltip text="Hatalı yazımı önlemek için yeni şifrenizi tekrar giriniz." />
              </label>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={adminProfile.confirmPassword}
                onChange={handleProfileChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 transition cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Profil Değişikliklerini Kaydet
            </button>
          </div>
        </form>
      )}

      {activeTab === 'security' && (
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400" /> Anti-Passback ve Frekans Parametreleri
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Anti-Passback Bekleme Süresi (Saniye)
                <InfoTooltip text="Geçiş yapıldıktan sonra aynı kullanıcının tekrar geçiş yapabilmesi için beklemesi gereken süredir. Mükerrer / arkadan adam geçirmeyi engeller." />
              </label>
              <input
                type="number"
                value={securitySettings.antiPassbackTimeout}
                onChange={(e) => setSecuritySettings({ ...securitySettings, antiPassbackTimeout: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Maksimum İhlal Denemesi
                <InfoTooltip text="Kullanıcının anti-passback kuralını kaç kez ihlal edebileceğini belirler. Limit dolduğunda sistem otomatik olarak Güvenlik Alarmı fırlatır." />
              </label>
              <input
                type="number"
                value={securitySettings.maxFrequencyAttempts}
                onChange={(e) => setSecuritySettings({ ...securitySettings, maxFrequencyAttempts: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 border-b pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-rose-400" /> Cihaz Eşleştirme & UUID Doğrulama Kuralları
            </h3>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white">Mobil Cihaz (UUID) Doğrulaması</span>
                <InfoTooltip text="Kapatıldığında, kullanıcılar uygulamaya giriş yaparken cihaz UUID karşılaştırması yapılmaz. Herhangi bir cihazdan kısıtlamasız giriş yapabilirler." />
              </div>
              <p className="text-[11px] text-slate-400">
                Giriş esnasında mobil cihaz kimliğinin (UUID) kullanıcı hesabıyla eşleşmesini zorunlu kılar.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={securitySettings.deviceBindingEnabled ?? true}
                onChange={(e) =>
                  setSecuritySettings({
                    ...securitySettings,
                    deviceBindingEnabled: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          <div className="border-t border-slate-800 pt-6 border-b pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <QrCode className="w-4 h-4 text-rose-400" /> QR Kod Üretim ve Güvenlik Kuralları
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                QR Sonlanma Süresi (Saniye)
                <InfoTooltip text="Üretilen dinamik QR kodun turnikede geçerlilik süresidir. Ekran görüntüsü paylaşımını önlemek için kısa (örn. 10-30 sn) tutulmalıdır." />
              </label>
              <input
                type="number"
                value={securitySettings.qrExpirySeconds}
                onChange={(e) => setSecuritySettings({ ...securitySettings, qrExpirySeconds: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Maksimum Arka Arkaya QR Üretimi
                <InfoTooltip text="Kullanıcının ceza kilitlenmesi almadan önce belirlenen pencere süresinde üretebileceği maksimum QR kod adedidir." />
              </label>
              <input
                type="number"
                value={securitySettings.maxQrGenerationCount}
                onChange={(e) => setSecuritySettings({ ...securitySettings, maxQrGenerationCount: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Üretim Kontrol Penceresi (Dakika)
                <InfoTooltip text="Maksimum QR üretim sayısının takip edildiği zaman dilimidir (Örn: 5 dakika içinde maksimum 4 QR üretilebilir)." />
              </label>
              <input
                type="number"
                value={securitySettings.qrLimitWindowMinutes}
                onChange={(e) => setSecuritySettings({ ...securitySettings, qrLimitWindowMinutes: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Limit Aşımı Bekleme Süresi (Dakika)
                <InfoTooltip text="Maksimum QR üretme sınırını aşan kullanıcının hesabının geçici olarak kilitleneceği ceza süresidir." />
              </label>
              <input
                type="number"
                value={securitySettings.qrCooldownMinutes}
                onChange={(e) => setSecuritySettings({ ...securitySettings, qrCooldownMinutes: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 transition cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Güvenlik Kurallarını Kaydet
            </button>
          </div>
        </form>
      )}

      {activeTab === 'system' && (
        <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-rose-400" /> Sistem Parametreleri
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Sistem / Tesis Adı
                <InfoTooltip text="Mobil uygulamada, başlık alanlarında ve sistem raporlarında görünecek resmi tesis/sistem adıdır." />
              </label>
              <input
                type="text"
                value={systemSettings.systemName}
                onChange={(e) => setSystemSettings({ ...systemSettings, systemName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Log Saklama Süresi (Gün)
                <InfoTooltip text="Geçiş ve ihlal kayıtlarının veritabanında saklanacağı süredir. Bu süreden eski loglar sistem tarafından otomatik temizlenir." />
              </label>
              <input
                type="number"
                value={systemSettings.logRetentionDays}
                onChange={(e) => setSystemSettings({ ...systemSettings, logRetentionDays: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 border-b pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-400" /> Tesis Konum & Geofence (Yarıçap) Ayarları
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Tesis Enlemi (Latitude)
                <InfoTooltip text="Mobil uygulamanın konum doğrulaması (Geofence) yapabilmesi için tesisin enlem koordinatıdır." />
              </label>
              <input
                type="text"
                value={systemSettings.latitude}
                onChange={(e) => setSystemSettings({ ...systemSettings, latitude: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                Tesis Boylamı (Longitude)
                <InfoTooltip text="Mobil uygulamanın konum doğrulaması (Geofence) yapabilmesi için tesisin boylam koordinatıdır." />
              </label>
              <input
                type="text"
                value={systemSettings.longitude}
                onChange={(e) => setSystemSettings({ ...systemSettings, longitude: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div>
              <label className="flex items-center text-xs font-semibold text-slate-300 mb-1.5">
                İzin Verilen Yarıçap (Metre)
                <InfoTooltip text="Kullanıcının QR kod üretebilmesi için tesis koordinatlarına olan maksimum uzaklık sınırıdır. Bu alanın dışındaki QR üretme istekleri reddedilir." />
              </label>
              <input
                type="number"
                value={systemSettings.geofenceRadiusMeters}
                onChange={(e) => setSystemSettings({ ...systemSettings, geofenceRadiusMeters: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-rose-600/20 transition cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sistem Ayarlarını Kaydet
            </button>
          </div>
        </form>
      )}
    </div>
  );
}