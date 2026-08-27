'use client';

import { useState, useEffect } from 'react';
import { X, UserCheck, Building2, Shield, QrCode, Save, IdCard, Image as ImageIcon, Loader2, RotateCcw } from 'lucide-react';
import { updateUser, fetchCompanies, fetchTitles } from '@/lib/api';
import { UserItem, EditUserModalProps } from '@/types';

export function EditUserModal({ isOpen, user, onClose, onSave }: EditUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [customCompany, setCustomCompany] = useState('');
  const [isCustomCompany, setIsCustomCompany] = useState(false);
  const [deviceUUID, setDeviceUUID] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);

  const [companiesList, setCompaniesList] = useState<string[]>([]);
  const [titlesList, setTitlesList] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadDropdownData = async () => {
      try {
        const [fetchedCompanies, fetchedTitles] = await Promise.all([
          fetchCompanies(),
          fetchTitles(),
        ]);

        const compList = Array.isArray(fetchedCompanies) ? fetchedCompanies : [];
        const titleList = Array.isArray(fetchedTitles) ? fetchedTitles : [];

        const userComp = typeof user?.company === 'string' 
          ? user.company 
          : (user?.company as any)?.name || '';
        const userRole = user?.role || '';

        const mergedCompanies = Array.from(new Set([...compList, userComp].filter(Boolean)));
        const mergedTitles = Array.from(new Set([...titleList, userRole].filter(Boolean)));

        setCompaniesList(mergedCompanies);
        setTitlesList(mergedTitles);

        if (user) {
          setName(user.name || '');
          setEmail(user.email || '');
          setRole(userRole || mergedTitles[0] || 'Mühendis');
          setDeviceUUID(user.deviceUUID || user.deviceId || '');
          setEmployeeId(user.employeeId || '');
          setProfilePicture(user.profilePicture || '');
          setIsBlocked(!!user.isBlocked);
          setError(null);

          if (userComp && mergedCompanies.includes(userComp)) {
            setCompany(userComp);
            setIsCustomCompany(false);
            setCustomCompany('');
          } else if (userComp) {
            setIsCustomCompany(true);
            setCustomCompany(userComp);
          } else {
            setCompany(mergedCompanies[0] || '');
            setIsCustomCompany(false);
          }
        }
      } catch (err) {
        console.error('Açılır liste verileri alınamadı:', err);
      }
    };

    loadDropdownData();
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Resim boyutu 2MB den küçük olmalıdır.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) return;

    const selectedCompany = isCustomCompany ? customCompany.trim() : company;

    setLoading(true);
    setError(null);

    const cleanUUID = deviceUUID.trim();

    const updatedData: UserItem = {
      ...user,
      name: trimmedName,
      email: trimmedEmail,
      role,
      company: selectedCompany || 'Diğer',
      deviceUUID: cleanUUID || undefined,
      deviceId: cleanUUID || undefined,
      employeeId: employeeId.trim() || undefined,
      profilePicture: profilePicture || undefined,
      isBlocked,
    };

    try {
      const res = await updateUser(user.id, updatedData);
      if (res.error) throw new Error(res.error || 'Güncelleme hatası');

      onSave(res.data || updatedData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Kullanıcı güncellenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Kullanıcı Bilgilerini Düzenle</h3>
              <p className="text-xs text-slate-400">Personel yetki ve profil detaylarını güncelleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profilePicture ? (
                <img src={profilePicture} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Profil Fotoğrafı</label>
              <input
                type="file"
                accept="image/*"
                disabled={loading}
                onChange={handleImageChange}
                className="block w-full text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Ad Soyad</label>
            <input
              type="text"
              required
              disabled={loading}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Sicil Numarası</label>
            <div className="relative">
              <IdCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                disabled={loading}
                placeholder="Örn: SICIL-9842"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full pl-9 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">E-posta Adresi</label>
            <input
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" /> Şirket / Firma
              </label>
              <button
                type="button"
                disabled={loading}
                onClick={() => setIsCustomCompany(!isCustomCompany)}
                className="text-[11px] text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
              >
                {isCustomCompany ? 'Listeden Seç' : '+ Manuel Şirket Gir'}
              </button>
            </div>

            {isCustomCompany ? (
              <input
                type="text"
                required
                disabled={loading}
                placeholder="Şirket Adı..."
                value={customCompany}
                onChange={(e) => setCustomCompany(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
              />
            ) : (
              <select
                value={company}
                disabled={loading}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer disabled:opacity-50"
              >
                {companiesList.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Unvan / Rol</label>
            <select
              value={role}
              disabled={loading}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer disabled:opacity-50"
            >
              {titlesList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-indigo-400" /> Mobil Cihaz UUID
              </label>
              {deviceUUID && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setDeviceUUID('')}
                  className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" /> Cihaz Kilidini Sıfırla
                </button>
              )}
            </div>
            <input
              type="text"
              disabled={loading}
              placeholder={deviceUUID ? "Örn: a8f9-4b2c-910e" : "Cihaz Kilidi Yok (Serbest)"}
              value={deviceUUID}
              onChange={(e) => setDeviceUUID(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2.5 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
              <input
                type="checkbox"
                disabled={loading}
                checked={isBlocked}
                onChange={(e) => setIsBlocked(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-50"
              />
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Shield className="w-4 h-4 text-rose-500" />
                <span>Geçiş Yetkisini Bloke Et</span>
              </div>
            </label>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800 mt-6">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-900/30 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Değişiklikleri Kaydet
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}