'use client';

import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, Building2, Clock, User as UserIcon } from 'lucide-react';
import { subscribeToPassLogs } from '@/lib/socket';
import { LocationStatus, UserItem, UserTableProps } from '@/types';

export const UserTable: React.FC<UserTableProps> = ({
  users: initialUsers,
  onSelectUser,
  onUsersChange,
}) => {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    const unsubscribe = subscribeToPassLogs((newLog) => {
      if (!newLog) return;

      setUsers((prevUsers) => {
        const updatedUsers = prevUsers.map((user) => {
          if (user.id === newLog.userId || user.email === newLog.email) {
            const isEntry = newLog.type === 'ENTRY';
            return {
              ...user,
              status: isEntry ? ('INSIDE' as LocationStatus) : ('OUTSIDE' as LocationStatus),
              lastPass: newLog.timestamp || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            };
          }
          return user;
        });

        if (onUsersChange) {
          onUsersChange(updatedUsers);
        }
        return updatedUsers;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [onUsersChange]);

  const renderCompany = (company: any) => {
    if (!company) return 'Genel Tesis';
    if (typeof company === 'string') return company;
    if (typeof company === 'object' && company !== null) {
      return company.name || company.title || 'Genel Tesis';
    }
    return String(company);
  };

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-4 px-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <h3 className="text-sm font-bold text-slate-100 tracking-wide">
            Canlı Takip Listesi
          </h3>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 font-mono">
          {users.length} Personel
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-3.5 px-6">Kullanıcı / Personel</th>
              <th className="py-3.5 px-6">Anlık Konum</th>
              <th className="py-3.5 px-6">Son İşlem & Zaman</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-12 text-center text-slate-500 font-medium text-xs">
                  Kayıtlı kullanıcı bulunamadı.
                </td>
              </tr>
            ) : (
              users.map((user, index) => {
                const isInside = user.status === 'INSIDE';
                const uniqueKey = user?.id ? `${user.id}-${index}` : `user-row-${index}`;
                const displayName = user.name ? String(user.name) : 'İsimsiz Kullanıcı';
                const companyName = renderCompany(user.company);

                return (
                  <tr
                    key={uniqueKey}
                    onClick={() => onSelectUser && onSelectUser(user)}
                    className="transition-colors duration-150 hover:bg-slate-800/50 cursor-pointer group"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center font-bold text-slate-200 group-hover:border-blue-500/50 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-all overflow-hidden shadow-inner flex-shrink-0">
                          {user.profilePicture ? (
                            <img src={user.profilePicture} alt={displayName} className="w-full h-full object-cover" />
                          ) : user.name ? (
                            displayName.charAt(0).toUpperCase()
                          ) : (
                            <UserIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-100 group-hover:text-blue-300 transition-colors flex items-center gap-2 min-w-0">
                            <span className="truncate max-w-[180px]" title={displayName}>
                              {displayName}
                            </span>
                            {user.employeeId && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                                #{String(user.employeeId)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate max-w-[200px]" title={companyName}>
                              {companyName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${
                          isInside
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700/80'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isInside ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                          }`}
                        />
                        {isInside ? 'İçeride' : 'Dışarıda'}
                      </span>
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl border flex-shrink-0 ${
                            isInside
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}
                        >
                          {isInside ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${isInside ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isInside ? 'Son İşlem: Giriş' : 'Son İşlem: Çıkış'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <span>{user.lastPass || '--:--'}</span>
                          </div>
                        </div>
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
  );
};