'use client';

import {
  X,
  User,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  MapPin,
  Activity,
  IdCard,
} from 'lucide-react';
import { PassHistoryItem, UserDetail, UserDetailModalProps } from '@/types';

export function UserDetailModal({ user, onClose }: UserDetailModalProps) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 overflow-hidden flex-shrink-0">
              {user.profilePicture ? (
                <img src={user.profilePicture} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{user.name}</span>
                {user.employeeId && (
                  <span className="text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-mono font-normal">
                    #{user.employeeId}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <span className="text-slate-400 text-[11px] block mb-1">Mevcut Durum</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${
                user.status === 'INSIDE'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {user.status === 'INSIDE' ? 'Tesis İçinde' : 'Tesis Dışında'}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <span className="text-slate-400 text-[11px] block mb-1">İhlal Sayısı</span>
            <span className="font-bold text-slate-200 flex items-center gap-1">
              <ShieldAlert
                className={`w-3.5 h-3.5 ${
                  user.violationCount > 0 ? 'text-rose-500' : 'text-slate-500'
                }`}
              />
              {user.violationCount} İhlal
            </span>
          </div>
        </div>

        <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80 text-xs">
          {user.employeeId && (
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500 flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5 text-amber-400" /> Sicil Numarası:
              </span>
              <span className="font-mono text-slate-200 font-semibold">{user.employeeId}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" /> Cihaz UUID:
            </span>
            <span className="font-mono text-slate-200">{user.deviceUUID || 'Tanımlanmadı'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Son Konum:
            </span>
            <span className="font-medium text-slate-200">{user.lastLocation}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" /> Toplam Geçiş:
            </span>
            <span className="font-semibold text-slate-200">{user.totalPasses} Kez</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" /> Son Geçiş Hareketleri
          </h4>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {user.history && user.history.length > 0 ? (
              user.history.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800/60 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2">
                    {item.direction === 'ENTRY' ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                        <ArrowUpRight className="w-3.5 h-3.5" /> Giriş
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1 font-semibold">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Çıkış
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{item.time}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs text-center py-2">
                Geçmiş hareket kaydı bulunamadı.
              </p>
            )}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}