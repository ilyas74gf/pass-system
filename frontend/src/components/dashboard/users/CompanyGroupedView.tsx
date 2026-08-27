'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  LogIn, 
  LogOut, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X,
  User as UserIcon,
  Layers,
  Hash,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { fetchCompanies, saveCompaniesApi, updateUser, CompanyItem } from '@/lib/api';
import { UserItem, CompanyInfo, CompanyGroupedViewProps } from '@/types';

const LOCAL_STORAGE_KEY = 'pass_system_company_details';

const getLocalCompanyDetails = (): Record<string, { floor: string; doorNo: string }> => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveLocalCompanyDetails = (name: string, floor: string, doorNo: string) => {
  if (typeof window === 'undefined') return;
  const current = getLocalCompanyDetails();
  current[name.toLowerCase()] = { floor, doorNo };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
};

const deleteLocalCompanyDetails = (name: string) => {
  if (typeof window === 'undefined') return;
  const current = getLocalCompanyDetails();
  delete current[name.toLowerCase()];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
};

export function CompanyGroupedView({ 
  users, 
  onDeleteUser, 
  onEditUser, 
  onUpdateUserCompany, 
  onDeleteCompany 
}: CompanyGroupedViewProps) {
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyInput, setNewCompanyInput] = useState('');
  const [newFloorInput, setNewFloorInput] = useState('');
  const [newDoorNoInput, setNewDoorNoInput] = useState('');

  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState('');
  const [editFloorInput, setEditFloorInput] = useState('');
  const [editDoorNoInput, setEditDoorNoInput] = useState('');

  const [companyToDelete, setCompanyToDelete] = useState<{ name: string; personnelCount: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const fetchedCompanies = await fetchCompanies();
        const dbCompanies = Array.isArray(fetchedCompanies) ? fetchedCompanies : [];
        const localDetails = getLocalCompanyDetails();

        const parsedList: CompanyInfo[] = dbCompanies.map((c: any, idx: number) => {
          const compName = typeof c === 'string' ? c : (c?.name || String(c));
          const savedDetail = localDetails[compName.toLowerCase()];

          return {
            name: compName,
            floor: c?.floor || savedDetail?.floor || `${(idx % 3) + 1}. Kat`,
            doorNo: c?.doorNo || savedDetail?.doorNo || `No: ${101 + idx}`
          };
        });

        setCompanies(parsedList);
      } catch (err) {
        console.error('Şirketler yüklenemedi:', err);
      }
    };

    loadCompanies();
  }, []);

  const toggleExpand = (companyName: string) => {
    setExpandedCompanies((prev) => ({ ...prev, [companyName]: !prev[companyName] }));
  };

  const handleAddCompany = async () => {
    const trimmed = newCompanyInput.trim();
    if (!trimmed) return;
    if (companies.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Bu şirket zaten mevcut.');
      return;
    }

    const formattedFloor = newFloorInput.trim() ? `${newFloorInput.trim()}${newFloorInput.includes('Kat') ? '' : '. Kat'}` : 'Belirtilmedi';
    const formattedDoor = newDoorNoInput.trim() ? `${newDoorNoInput.trim().startsWith('No:') ? '' : 'No: '}${newDoorNoInput.trim()}` : 'Belirtilmedi';

    const newCompanyObj: CompanyInfo = {
      name: trimmed,
      floor: formattedFloor,
      doorNo: formattedDoor,
    };

    try {
      const updatedList = [...companies, newCompanyObj];
      const ok = await saveCompaniesApi(updatedList);
      if (!ok) {
        alert('Şirket veritabanına kaydedilemedi.');
        return;
      }

      saveLocalCompanyDetails(trimmed, formattedFloor, formattedDoor);
      setCompanies(updatedList);
    } catch (err) {
      console.error('Şirket kaydedilirken hata oluştu:', err);
    }

    setNewCompanyInput('');
    setNewFloorInput('');
    setNewDoorNoInput('');
    setShowAddCompany(false);
  };

  const startEditing = (comp: CompanyInfo) => {
    setEditingCompany(comp.name);
    setEditNameInput(comp.name);
    setEditFloorInput(comp.floor);
    setEditDoorNoInput(comp.doorNo);
  };

  const saveEditing = async (oldName: string) => {
    const trimmedName = editNameInput.trim();
    if (!trimmedName) return;

    const formattedFloor = editFloorInput.trim() || 'Belirtilmedi';
    const formattedDoor = editDoorNoInput.trim() || 'Belirtilmedi';

    const updatedCompanies = companies.map((c) =>
      c.name === oldName
        ? { name: trimmedName, floor: formattedFloor, doorNo: formattedDoor }
        : c
    );

    try {
      const ok = await saveCompaniesApi(updatedCompanies);
      if (!ok) {
        alert('Şirket veritabanında güncellenemedi.');
        return;
      }

      if (oldName !== trimmedName) {
        deleteLocalCompanyDetails(oldName);
      }
      saveLocalCompanyDetails(trimmedName, formattedFloor, formattedDoor);

      setCompanies(updatedCompanies);

      if (onUpdateUserCompany && trimmedName !== oldName) {
        onUpdateUserCompany(oldName, trimmedName);
      }
    } catch (err) {
      console.error('Şirket güncellenirken hata oluştu:', err);
    }

    setEditingCompany(null);
  };

  const openDeleteModal = (compName: string, personnelCount: number) => {
    setCompanyToDelete({ name: compName, personnelCount });
  };

  const handleConfirmDelete = async () => {
    if (!companyToDelete) return;
    setIsDeleting(true);

    const targetCompany = companyToDelete.name;

    try {
      const updatedList = companies.filter(
        (c) => c.name.trim().toLowerCase() !== targetCompany.trim().toLowerCase()
      );
      
      const saved = await saveCompaniesApi(updatedList);
      if (!saved) {
        throw new Error('Veritabanına kaydetme başarısız oldu.');
      }

      deleteLocalCompanyDetails(targetCompany);

      const targetUsers = users.filter((u) => {
        const uComp = typeof u.company === 'string' ? u.company : (u.company as any)?.name;
        return uComp?.trim().toLowerCase() === targetCompany.trim().toLowerCase();
      });

      if (targetUsers.length > 0) {
        await Promise.allSettled(
          targetUsers.map((u) => updateUser(u.id, { company: 'Diğer' }))
        );

        if (onUpdateUserCompany) {
          onUpdateUserCompany(targetCompany, 'Diğer');
        }
      }

      setCompanies(updatedList);

      if (onDeleteCompany) {
        onDeleteCompany(targetCompany);
      }
    } catch (err: any) {
      console.error('Silme işleminde hata oluştu:', err);
      alert(`Şirket veritabanından silinemedi: ${err.message || 'Sunucu hatası'}`);
    } finally {
      setIsDeleting(false);
      setCompanyToDelete(null);
    }
  };

  const companyData = useMemo(() => {
    return companies.map((comp) => {
      const companyUsers = users.filter((u) => {
        const uComp = typeof u.company === 'string' ? u.company : (u.company as any)?.name;
        return uComp?.trim().toLowerCase() === comp.name.trim().toLowerCase();
      });

      const insideCount = companyUsers.filter((u) => u.status === 'INSIDE').length;
      const outsideCount = companyUsers.length - insideCount;

      return {
        ...comp,
        users: companyUsers,
        totalPersonnel: companyUsers.length,
        insideCount,
        outsideCount,
      };
    }).filter((group) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchComp = group.name.toLowerCase().includes(q) || group.floor.toLowerCase().includes(q) || group.doorNo.toLowerCase().includes(q);
      const matchUser = group.users.some(
        (u) => u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
      return matchComp || matchUser;
    });
  }, [companies, users, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Şirket adı, kat, kapı no veya personel ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <button
          onClick={() => setShowAddCompany(!showAddCompany)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-lg shadow-blue-900/30 cursor-pointer w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Yeni Şirket & Kat Ekle
        </button>
      </div>

      {showAddCompany && (
        <div className="bg-slate-900 border border-blue-500/30 p-4 rounded-2xl space-y-3 animate-in fade-in duration-150">
          <div className="text-xs font-semibold text-blue-400 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Yeni Şirket ve Konum Tanımla
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Şirket Adı..."
              value={newCompanyInput}
              onChange={(e) => setNewCompanyInput(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Kat Bilgisi (Örn: 2. Kat)"
              value={newFloorInput}
              onChange={(e) => setNewFloorInput(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Kapı / Ofis No (Örn: No: 204)"
              value={newDoorNoInput}
              onChange={(e) => setNewDoorNoInput(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowAddCompany(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              İptal
            </button>
            <button
              onClick={handleAddCompany}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {companyData.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs font-mono">
            Kayıtlı şirket veya arama kriterine uygun sonuç bulunamadı.
          </div>
        ) : (
          companyData.map((group, groupIdx) => {
            const isExpanded = !!expandedCompanies[group.name];
            const isEditing = editingCompany === group.name;

            return (
              <div
                key={`${group.name}-${groupIdx}`}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition"
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 hover:bg-slate-800/50 transition">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                      <Building2 className="w-5 h-5" />
                    </div>

                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1 max-w-xl">
                        <input
                          type="text"
                          value={editNameInput}
                          onChange={(e) => setEditNameInput(e.target.value)}
                          placeholder="Şirket Adı"
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={editFloorInput}
                          onChange={(e) => setEditFloorInput(e.target.value)}
                          placeholder="Kat (Örn: 1. Kat)"
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editDoorNoInput}
                            onChange={(e) => setEditDoorNoInput(e.target.value)}
                            placeholder="Kapı No"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => saveEditing(group.name)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                            title="Kaydet"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingCompany(null)}
                            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                            title="İptal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-sm">{group.name}</h4>
                          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                            {group.totalPersonnel} Personel
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800/80 text-blue-300">
                            <Layers className="w-3 h-3 text-blue-400" /> {group.floor}
                          </span>
                          <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800/80 text-amber-300 font-mono">
                            <Hash className="w-3 h-3 text-amber-400" /> {group.doorNo}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        <LogIn className="w-3.5 h-3.5" /> {group.insideCount} İçeride
                      </span>
                      <span className="flex items-center gap-1 text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                        <LogOut className="w-3.5 h-3.5" /> {group.outsideCount} Dışarıda
                      </span>
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
                      <button
                        onClick={() => startEditing(group)}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        title="Şirket & Konum Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => openDeleteModal(group.name, group.totalPersonnel)}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        title="Şirketi Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {group.totalPersonnel > 0 && (
                        <button
                          onClick={() => toggleExpand(group.name)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          title="Personel Listesini Göster/Gizle"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && group.totalPersonnel > 0 && (
                  <div className="border-t border-slate-800/80 bg-slate-950/60 p-4 divide-y divide-slate-800/50">
                    {group.users.map((user, userIdx) => (
                      <div 
                        key={user.id ? `${user.id}-${userIdx}` : `user-${groupIdx}-${userIdx}`} 
                        className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                            {user.profilePicture ? (
                              <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200">{user.name}</span>
                            <span className="text-slate-500 ml-2 font-mono">({user.role || 'Mühendis'})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-slate-400">{user.email}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            user.status === 'INSIDE' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {user.status === 'INSIDE' ? 'İçeride' : 'Dışarıda'}
                          </span>
                          {onEditUser && (
                            <button
                              onClick={() => onEditUser(user)}
                              className="p-1 text-slate-400 hover:text-blue-400 transition"
                              title="Personeli Düzenle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteUser && (
                            <button
                              onClick={() => onDeleteUser(user.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 transition"
                              title="Personeli Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Şirketi Sil</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-white">{companyToDelete.name}</strong> şirketini veritabanından silmek istediğinize emin misiniz?
            </p>

            {companyToDelete.personnelCount > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-300">
                ⚠️ Bu şirkete kayıtlı <strong>{companyToDelete.personnelCount} personel</strong> veritabanında 'Diğer' şirketine aktarılacaktır.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCompanyToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-lg shadow-rose-900/30"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Veritabanından Siliniyor...
                  </>
                ) : (
                  'Evet, Sil'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { CompanyGroupedView as CompanyGroupPage };
export default CompanyGroupedView;