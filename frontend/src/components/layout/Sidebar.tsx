'use client';

import { 
  ShieldCheck, 
  Eye, 
  ShieldAlert, 
  History, 
  Users, 
  Building2, 
  DoorClosed, 
  Settings,
  LogOut
} from 'lucide-react';
import { TabType, SidebarProps } from '@/types';

export function Sidebar({ activeTab = 'MONITOR', setActiveTab }: SidebarProps) {
  const menuItems = [
    {
      id: 'MONITOR' as TabType,
      label: 'Canlı İzleme',
      icon: Eye,
      activeClass: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'USERS' as TabType,
      label: 'Kullanıcı Yönetimi',
      icon: Users,
      activeClass: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30',
    },
    {
      id: 'COMPANIES' as TabType,
      label: 'Şirketler & Personel',
      icon: Building2,
      activeClass: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
    },
    {
      id: 'VIOLATIONS' as TabType,
      label: 'İhlal Alarmları',
      icon: ShieldAlert,
      activeClass: 'bg-rose-600/20 text-rose-400 border-rose-500/30',
    },
    {
      id: 'PASS_LOGS' as TabType,
      label: 'Geçiş Logları',
      icon: History,
      activeClass: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
    },
    {
      id: 'GATES' as TabType,
      label: 'Kapı Kontrolü',
      icon: DoorClosed,
      activeClass: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
    },
    {
      id: 'SETTINGS' as TabType,
      label: 'Sistem Ayarları',
      icon: Settings,
      activeClass: 'bg-slate-700/50 text-slate-200 border-slate-600/50',
    },
  ];

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();

    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 min-h-screen p-5 flex flex-col justify-between">
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-white tracking-wide text-base">PASS SYSTEM</h1>
            <p className="text-[11px] text-slate-400">Güvenlik Kontrol Paneli</p>
          </div>
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab?.(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  isActive
                    ? item.activeClass
                    : 'text-slate-400 border-transparent hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? '' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800/80 space-y-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition cursor-pointer"
          title="Oturumu kapat ve giriş ekranına dön"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span>Oturumu Kapa</span>
        </button>

        <div className="text-[11px] text-slate-500 px-2 font-mono">
          v1.2.0 • Pass System
        </div>
      </div>
    </aside>
  );
}