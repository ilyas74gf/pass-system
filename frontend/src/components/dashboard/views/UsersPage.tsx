'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  UserPlus, 
  Filter, 
  LogIn, 
  LogOut, 
  Edit, 
  Trash2, 
  Smartphone, 
  Building2,
  ShieldOff,
  ShieldCheck,
  User as UserIcon,
  IdCard
} from 'lucide-react';
import { toggleUserStatusApi, toggleUserBlockApi } from '@/lib/api';
import { UserItem, UsersPageProps } from '@/types';

export function UsersPage({
  users,
  onSelectUser,
  onToggleStatus,
  onToggleBlock,
  onDeleteUser,
  onEditUser,
  onAddUser,
}: UsersPageProps) {
  const [localUsers, setLocalUsers] = useState<UserItem[]>(users);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  const handleToggleLocationStatus = async (id: string) => {
    const targetUser = localUsers.find((u) => u.id === id);
    if (!targetUser) return;

    if (onToggleStatus) {
      onToggleStatus(id);
    } else {
      setLocalUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: u.status === 'INSIDE' ? 'OUTSIDE' : 'INSIDE' } : u))
      );
      try {
        await toggleUserStatusApi(id, targetUser.status);
      } catch (e) {
        console.error('Status güncellenemedi:', e);
      }
    }
  };

  const handleToggleBlockStatus = async (id: string) => {
    const targetUser = localUsers.find((u) => u.id === id);
    if (!targetUser) return;

    if (onToggleBlock) {
      onToggleBlock(id);
    } else {
      setLocalUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isBlocked: !u.isBlocked } : u))
      );
      try {
        await toggleUserBlockApi(id, !!targetUser.isBlocked);
      } catch (e) {
        console.error('Blok durumu güncellenemedi:', e);
      }
    }
  };

  const filteredUsers = useMemo(() => {
    return localUsers.filter((u) => {
      const query = searchQuery.toLowerCase().trim();

      const nameMatch = u.name ? String(u.name).toLowerCase().includes(query) : false;
      const emailMatch = u.email ? String(u.email).toLowerCase().includes(query) : false;

      let companyMatch = false;
      if (u.company) {
        if (typeof u.company === 'string') {
          companyMatch = u.company.toLowerCase().includes(query);
        } else if (typeof u.company === 'object' && u.company !== null) {
          const companyName = (u.company as any).name || (u.company as any).title || '';
          companyMatch = String(companyName).toLowerCase().includes(query);
        } else {
          companyMatch = String(u.company).toLowerCase().includes(query);
        }
      }

      const employeeIdMatch = u.employeeId ? String(u.employeeId).toLowerCase().includes(query) : false;
      const matchesSearch = nameMatch || emailMatch || companyMatch || employeeIdMatch;
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      let matchesStatus = true;
      if (statusFilter === 'INSIDE') matchesStatus = u.status === 'INSIDE';
      if (statusFilter === 'OUTSIDE') matchesStatus = u.status === 'OUTSIDE';
      if (statusFilter === 'BLOCKED') matchesStatus = u.isBlocked === true;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [localUsers, searchQuery, roleFilter, statusFilter]);

  const renderCompanyText = (company: any) => {
    if (!company) return 'Atanmadı';
    if (typeof company === 'string') return company;
    if (typeof company === 'object' && company !== null) {
      return company.name || company.title || 'Atanmadı';
    }
    return String(company);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="İsim, e-posta, sicil no veya şirket ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">Tüm Durumlar</option>
              <option value="INSIDE" className="bg-slate-900">Tesis İçindekiler</option>
              <option value="OUTSIDE" className="bg-slate-900">Tesis Dışındakiler</option>
              <option value="BLOCKED" className="bg-slate-900">Engelli Kullanıcılar</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">Tüm Roller</option>
              <option value="Yönetici" className="bg-slate-900">Yönetici</option>
              <option value="Mühendis" className="bg-slate-900">Mühendis</option>
              <option value="Teknik Personel" className="bg-slate-900">Teknik Personel</option>
              <option value="İnsan Kaynakları" className="bg-slate-900">İnsan Kaynakları</option>
              <option value="Ziyaretçi" className="bg-slate-900">Ziyaretçi</option>
            </select>
          </div>

          {onAddUser && (
            <button
              onClick={onAddUser}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-lg shadow-blue-900/30 cursor-pointer ml-auto md:ml-0"
            >
              <UserPlus className="w-4 h-4" /> Yeni Kullanıcı
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-4 px-6">Kullanıcı Bilgisi</th>
                <th className="py-4 px-6">Sicil No</th>
                <th className="py-4 px-6">Şirket & Rol</th>
                <th className="py-4 px-6">Cihaz UUID</th>
                <th className="py-4 px-6">Tesis Durumu</th>
                <th className="py-4 px-6 text-center">Erişim Yetkisi</th>
                <th className="py-4 px-6 text-right">Eylemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono text-xs">
                    Aranan kriterlere uygun kullanıcı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
                  const isInside = user.status === 'INSIDE';
                  const uniqueKey = user?.id ? `${user.id}-${index}` : `users-page-row-${index}`;
                  
                  const isAdminUser = 
                    user.role === 'ADMIN' || 
                    user.role === 'Yönetici' || 
                    Boolean((user as any).isAdmin);

                  return (
                    <tr
                      key={uniqueKey}
                      className={`transition hover:bg-slate-800/40 ${
                        user.isBlocked ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="py-4 px-6">
                        <div
                          onClick={() => onSelectUser && onSelectUser(user)}
                          className="cursor-pointer group flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {user.profilePicture ? (
                              <img src={user.profilePicture} alt={user.name || 'User'} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-blue-400 transition">
                              {user.name || 'İsimsiz Kullanıcı'}
                            </div>
                            <div className="text-xs text-slate-400">{user.email || 'E-posta Yok'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 font-mono text-xs text-slate-300">
                        {user.employeeId ? (
                          <span className="flex items-center gap-1.5 text-amber-400/90 bg-amber-400/10 px-2 py-1 rounded-md border border-amber-400/20 w-fit">
                            <IdCard className="w-3.5 h-3.5" /> {user.employeeId}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Belirtilmedi</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{renderCompanyText(user.company)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{user.role || 'Mühendis'}</div>
                      </td>

                      <td className="py-4 px-6 font-mono text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[120px]" title={user.deviceUUID || 'Atanmadı'}>
                            {user.deviceUUID || 'Atanmadı'}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleToggleLocationStatus(user.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                            isInside
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {isInside ? (
                            <>
                              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Tesis İçinde</span>
                            </>
                          ) : (
                            <>
                              <LogOut className="w-3.5 h-3.5 text-slate-400" />
                              <span>Tesis Dışında</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleToggleBlockStatus(user.id)}
                          className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                            user.isBlocked
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-rose-400 hover:bg-slate-800'
                          }`}
                        >
                          {user.isBlocked ? (
                            <>
                              <ShieldOff className="w-4 h-4 text-rose-400" />
                              <span>Engelli</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <span>Aktif</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {onEditUser && (
                            isAdminUser ? (
                              <span 
                                className="text-[11px] text-slate-500 bg-slate-950 border border-slate-800 px-2 py-1 rounded-md italic"
                                title="Admin bilgileri Ayarlar sekmesinden değiştirilir."
                              >
                                Ayarlar'dan Yönetilir
                              </span>
                            ) : (
                              <button
                                onClick={() => onEditUser(user)}
                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="Düzenle"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )
                          )}
                          {onDeleteUser && !isAdminUser && (
                            <button
                              onClick={() => onDeleteUser(user.id)}
                              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}