'use client';

import { useState, useEffect } from 'react';
import { UserPlus, X, Building2, Loader2, IdCard, Image as ImageIcon, Settings2 } from 'lucide-react';
import { registerUserByAdmin, fetchCompanies, fetchTitles } from '@/lib/api';
import { ListManagerModal } from '@/components/dashboard/shared/ListManagerModal';
import { UserItem, UserManagementModalProps, CompanyItem } from '@/types';

export const DEFAULT_COMPANIES = [
  'Pass System A.Ş.',
  'Siber Güvenlik Ltd.',
  'Lojistik & Tedarik A.Ş.',
  'Teknoloji Yazılım A.Ş.',
  'Ziyaretçi / Dış Firma',
];

export const DEFAULT_TITLES = [
  'Mühendis',
  'İnsan Kaynakları',
  'Teknik Personel',
  'Yönetici',
  'Ziyaretçi',
];

export function UserManagementModal({ isOpen, onClose, onAddUser }: UserManagementModalProps) {
  // Çözüm 2: State tipini (string | CompanyItem)[] olarak tanımlıyoruz
  const [companiesList, setCompaniesList] = useState<(string | CompanyItem)[]>(DEFAULT_COMPANIES);
  const [titlesList, setTitlesList] = useState<string[]>(DEFAULT_TITLES);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [systemRole, setSystemRole] = useState('USER');
  const [title, setTitle] = useState(DEFAULT_TITLES[0] || 'Mühendis');
  const [employeeId, setEmployeeId] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [company, setCompany] = useState(DEFAULT_COMPANIES[0] || '');

  const [isListManagerOpen, setIsListManagerOpen] = useState(false);
  const [managerInitialTab, setManagerInitialTab] = useState<'companies' | 'titles'>('companies');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loadInitialLists = async () => {
        const [dbCompanies, dbTitles] = await Promise.all([fetchCompanies(), fetchTitles()]);
        if (dbCompanies && dbCompanies.length > 0) {
          // Çözüm 2: Dönen veriyi dönüştürmeden doğrudan state'e yazıyoruz
          setCompaniesList(dbCompanies);

          const firstCompName = typeof dbCompanies[0] === 'string' ? dbCompanies[0] : dbCompanies[0].name;
          setCompany((prev) => {
            const exists = dbCompanies.some((c) => (typeof c === 'string' ? c : c.name) === prev);
            return exists ? prev : firstCompName;
          });
        }
        if (dbTitles && dbTitles.length > 0) {
          setTitlesList(dbTitles);
          setTitle((prev) => (dbTitles.includes(prev) ? prev : dbTitles[0]));
        }
      };
      loadInitialLists();
    }
  }, [isOpen]);

  if (!isOpen) return null;

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

  const resetForm = () => {
    setName('');
    setEmail('');
    setSystemRole('USER');
    setTitle(titlesList[0] || 'Mühendis');
    setEmployeeId('');
    setProfilePicture('');
    const firstComp = companiesList[0];
    setCompany(firstComp ? (typeof firstComp === 'string' ? firstComp : firstComp.name) : '');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const openManager = (tab: 'companies' | 'titles') => {
    setManagerInitialTab(tab);
    setIsListManagerOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) return;

    setLoading(true);
    setError(null);

    try {
      const data = await registerUserByAdmin({
        name: trimmedName,
        email: trimmedEmail,
        role: systemRole,
        title: title,
        company: company || 'Diğer',
        employeeId: employeeId.trim() || undefined,
        profilePicture: profilePicture || undefined,
      });

      if (data.error || data.message?.includes('fail')) {
        throw new Error(data.message || 'Kullanıcı eklenirken bir hata oluştu.');
      }

      const returnedUser = data.data || data.user || data;

      const newUser: UserItem = {
        id: returnedUser.id || returnedUser._id || `usr_${Date.now()}`,
        name: trimmedName,
        email: trimmedEmail,
        role: title,
        company: company || 'Diğer',
        deviceUUID: employeeId.trim() || 'Atanmadı',
        status: 'OUTSIDE',
        lastPass: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      };

      onAddUser(newUser);
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Yeni Kullanıcı Tanımla</h3>
                <p className="text-xs text-slate-400">E-Posta ile davet ve şifre oluşturma bağlantısı gönderilir</p>
              </div>
            </div>
            <button
              onClick={handleClose}
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
                  <img src={profilePicture} alt="Önizleme" className="w-full h-full object-cover" />
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
                  className="block w-full text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Ad Soyad</label>
              <input
                type="text"
                required
                disabled={loading}
                placeholder="Örn: Ahmet Yılmaz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
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
                  className="w-full pl-9 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">E-posta Adresi</label>
              <input
                type="email"
                required
                disabled={loading}
                placeholder="Örn: ahmet@firma.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
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
                  onClick={() => openManager('companies')}
                  className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Settings2 className="w-3 h-3" /> Liste Yönet / Toplu Yükle
                </button>
              </div>

              <select
                value={company}
                disabled={loading}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer disabled:opacity-50"
              >
                {companiesList.map((comp, idx) => {
                  const compName = typeof comp === 'string' ? comp : comp.name;
                  return (
                    <option key={`${compName}-${idx}`} value={compName}>
                      {compName}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Sistem Yetkisi</label>
                <select
                  value={systemRole}
                  disabled={loading}
                  onChange={(e) => setSystemRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer disabled:opacity-50"
                >
                  <option value="USER">Standart Kullanıcı</option>
                  <option value="ADMIN">Yönetici (Admin)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-300">Unvan</label>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => openManager('titles')}
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    + Yönet
                  </button>
                </div>
                <select
                  value={title}
                  disabled={loading}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer disabled:opacity-50"
                >
                  {titlesList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800 mt-6">
              <button
                type="button"
                disabled={loading}
                onClick={handleClose}
                className="px-4 py-2 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-900/30 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  'Kullanıcıyı Kaydet'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ListManagerModal
        isOpen={isListManagerOpen}
        onClose={() => setIsListManagerOpen(false)}
        companies={companiesList as any}
        titles={titlesList}
        onUpdateCompanies={(newList) => {
          setCompaniesList(newList);
          const exists = newList.some((c: any) => (typeof c === 'string' ? c : c.name) === company);
          if (!exists && newList.length > 0) {
            const first = typeof newList[0] === 'string' ? newList[0] : (newList[0] as any).name;
            setCompany(first);
          }
        }}
        onUpdateTitles={(newList) => {
          setTitlesList(newList);
          if (!newList.includes(title) && newList.length > 0) setTitle(newList[0]);
        }}
        initialTab={managerInitialTab}
      />
    </>
  );
}