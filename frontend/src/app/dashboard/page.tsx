'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  Users, LogIn, LogOut, ShieldAlert, Menu, 
  UserCheck, AlertTriangle, RefreshCw 
} from 'lucide-react';
import { socket } from '@/lib/socket';
import { playSecurityAlarmSound } from '@/lib/audio';
import { getUsers, deleteUser, toggleUserStatusApi, toggleUserBlockApi, updateUser } from '@/lib/api';

import { AlarmModal } from '@/components/dashboard/alarms/AlarmModal';
import { UserTable } from '@/components/dashboard/users/UserTable';
import { AlertsHistory } from '@/components/dashboard/alarms/AlertsHistory';
import { ViolationLogsHistory } from '@/components/dashboard/alarms/ViolationLogsHistory';
import { UserDetailModal } from '@/components/dashboard/users/UserDetailModal';
import { GateControlPanel } from '@/components/dashboard/shared/GateControlPanel';
import { UserManagementModal } from '@/components/dashboard/users/UserManagementModal';
import { CompanyGroupedView } from '@/components/dashboard/users/CompanyGroupedView';
import { EditUserModal } from '@/components/dashboard/users/EditUserModal';
import { UsersPage } from '@/components/dashboard/views/UsersPage';
import { SettingsPage } from '@/components/dashboard/views/SettingsPage';

import { 
  SecurityAlertData, UserItem, ExtendedUserItem, PassLog, 
  ViolationLog, UserDetail 
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.3.17:5000/api';

const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeToYYYYMMDD = (val?: string | Date | null): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const dateOnlyStr = str.split(' ')[0];

  if (dateOnlyStr.includes('T')) return dateOnlyStr.split('T')[0];

  if (dateOnlyStr.includes('.')) {
    const parts = dateOnlyStr.split('.');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }

  if (dateOnlyStr.includes('-')) {
    const parts = dateOnlyStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return '';
};

const getLogTimestampMs = (log: any): number => {
  if (log.createdAt) {
    const t = new Date(log.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (log.rawTimestamp) {
    const t = new Date(log.rawTimestamp).getTime();
    if (!isNaN(t)) return t;
  }
  const dateStr = normalizeToYYYYMMDD(log.date);
  if (dateStr && log.timestamp) {
    const t = new Date(`${dateStr}T${log.timestamp}`).getTime();
    if (!isNaN(t)) return t;
  }
  if (dateStr) {
    const t = new Date(dateStr).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
};

const parseTimeToSeconds = (timeVal?: string | Date | null): number => {
  if (!timeVal || timeVal === '--:--' || timeVal === '--:--:--') return -1;
  if (typeof timeVal === 'string' && (timeVal.includes('T') || timeVal.includes('-'))) {
    const timestamp = new Date(timeVal).getTime();
    if (!isNaN(timestamp)) return Math.floor(timestamp / 1000);
  }
  if (typeof timeVal === 'string' && timeVal.includes(':')) {
    const parts = timeVal.split(':').map((p) => parseInt(p, 10));
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return -1;
};

export default function DashboardPage() {
  const router = useRouter();

  const [users, setUsers] = useState<ExtendedUserItem[]>([]);
  const [logs, setLogs] = useState<PassLog[]>([]);
  const [violationLogs, setViolationLogs] = useState<ViolationLog[]>([]);

  // 🔹 Geçiş Logları İçin Bağımsız Tarih State'i
  const [passLogsStartDate, setPassLogsStartDate] = useState<string>('2026-08-17');
  const [passLogsEndDate, setPassLogsEndDate] = useState<string>(getTodayDateString());

  // 🔹 Güvenlik İhlalleri İçin Bağımsız Tarih State'i
  const [violationStartDate, setViolationStartDate] = useState<string>('2026-08-17');
  const [violationEndDate, setViolationEndDate] = useState<string>(getTodayDateString());

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeAlert, setActiveAlert] = useState<SecurityAlertData | null>(null);
  const [activeTab, setActiveTab] = useState<'MONITOR' | 'COMPANIES' | 'PASS_LOGS' | 'VIOLATIONS' | 'GATES' | 'USERS' | 'SETTINGS'>('MONITOR');
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState<boolean>(false);

  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [userToEdit, setUserToEdit] = useState<UserItem | null>(null);

  // 🔹 Sadece Geçiş Loglarını Çeken Fonksiyon
  const fetchPassLogs = useCallback(async (start: string, end: string) => {
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('adminToken') || localStorage.getItem('token'))
        : null;

      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const logsRes = await fetch(`${API_BASE_URL}/logs?startDate=${start}&endDate=${end}`, { headers, cache: 'no-store' });
      if (logsRes.ok) {
        const result = await logsRes.json();
        const fetchedLogs: PassLog[] = Array.isArray(result) 
          ? result 
          : (result.logs || result.data || result.items || []);
        setLogs(fetchedLogs);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.warn('⚠️ Geçiş Logları çekilirken hata:', err);
    }
  }, []);

  // 🔹 Sadece İhlal Loglarını Çeken Fonksiyon
  const fetchViolationLogs = useCallback(async (start: string, end: string) => {
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('adminToken') || localStorage.getItem('token'))
        : null;

      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const violRes = await fetch(`${API_BASE_URL}/violations?startDate=${start}&endDate=${end}`, { headers, cache: 'no-store' });
      if (violRes.ok) {
        const result = await violRes.json();
        const fetchedViols: ViolationLog[] = Array.isArray(result) 
          ? result 
          : (result.logs || result.data || result.items || []);
        setViolationLogs(fetchedViols);
      } else {
        setViolationLogs([]);
      }
    } catch (err) {
      console.warn('⚠️ İhlal Logları çekilirken hata:', err);
    }
  }, []);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setErrorMessage(null);

      const result = await getUsers();

      if (result?.error || result?.message === 'Unauthorized') {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('token');
        setErrorMessage('Oturum süreniz doldu veya yetkisiz erişim.');
        setUsers([]);
        return;
      }

      const rawUsers = Array.isArray(result) ? result : (result?.data || []);

      const formattedUsers: ExtendedUserItem[] = rawUsers.map((u: any) => ({
        id: u.id || u._id,
        name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'İsimsiz Kullanıcı',
        email: u.email || 'E-posta Yok',
        role: u.role || u.title || 'USER',
        company: typeof u.company === 'object' ? u.company?.name || 'Sistem' : u.company || 'Pass System',
        deviceUUID: u.deviceUUID || u.deviceId || u.employeeId || 'Atanmadı',
        employeeId: u.employeeId || '',
        profilePicture: u.profilePicture || '',
        status: u.status === 'INSIDE' ? 'INSIDE' : 'OUTSIDE',
        lastPassRaw: u.lastPass || u.updatedAt || null,
        lastPass: u.lastPass 
          ? (typeof u.lastPass === 'string' && u.lastPass.includes(':') && u.lastPass.length <= 8
              ? u.lastPass 
              : new Date(u.lastPass).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })) 
          : '--:--',
        isBlocked: Boolean(u.isBlocked || u.status === 'BLOCKED'),
      }));

      setUsers(formattedUsers);
      await Promise.all([
        fetchPassLogs(passLogsStartDate, passLogsEndDate),
        fetchViolationLogs(violationStartDate, violationEndDate)
      ]);
    } catch (error: any) {
      console.error('❌ Fetch Hatası:', error);
      setErrorMessage(`Veriler çekilemedi (${API_BASE_URL}).`);
      setUsers([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [passLogsStartDate, passLogsEndDate, violationStartDate, violationEndDate, fetchPassLogs, fetchViolationLogs]);

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  // Tarih değişimlerinde bağımsız istek atma
  useEffect(() => {
    fetchPassLogs(passLogsStartDate, passLogsEndDate);
  }, [passLogsStartDate, passLogsEndDate, fetchPassLogs]);

  useEffect(() => {
    fetchViolationLogs(violationStartDate, violationEndDate);
  }, [violationStartDate, violationEndDate, fetchViolationLogs]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const timeA = parseTimeToSeconds(a.lastPass || a.lastPassRaw);
      const timeB = parseTimeToSeconds(b.lastPass || b.lastPassRaw);
      return timeB - timeA;
    });
  }, [users]);

  // 🔹 Geçiş Loglarını Kendi Tarihine Göre Filtrele ve Sırala
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (passLogsStartDate || passLogsEndDate) {
      result = result.filter((log) => {
        const targetDate = normalizeToYYYYMMDD(log.date || (log as any).createdAt || (log as any).rawTimestamp);
        if (!targetDate) return true;
        if (passLogsStartDate && targetDate < passLogsStartDate) return false;
        if (passLogsEndDate && targetDate > passLogsEndDate) return false;
        return true;
      });
    }

    return result.sort((a, b) => getLogTimestampMs(b) - getLogTimestampMs(a));
  }, [logs, passLogsStartDate, passLogsEndDate]);

  // 🔹 İhlal Loglarını Kendi Tarihine Göre Filtrele ve Sırala
  const filteredViolationLogs = useMemo(() => {
    let result = [...violationLogs];

    if (violationStartDate || violationEndDate) {
      result = result.filter((log) => {
        const targetDate = normalizeToYYYYMMDD(log.date || (log as any).createdAt || (log as any).rawTimestamp);
        if (!targetDate) return true;
        if (violationStartDate && targetDate < violationStartDate) return false;
        if (violationEndDate && targetDate > violationEndDate) return false;
        return true;
      });
    }

    return result.sort((a, b) => getLogTimestampMs(b) - getLogTimestampMs(a));
  }, [violationLogs, violationStartDate, violationEndDate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (socket && !socket.connected) {
      socket.connect();
    }

    const refreshAllRealtime = () => {
      fetchDashboardData(true);
    };

    const handleSecurityAlert = (alertData: any) => {
      const alertPayload: SecurityAlertData = {
        userId: alertData?.userId || 'UNKNOWN',
        type: alertData?.type || 'BLOCKED_USER_VIOLATION',
        message: alertData?.message || 'GÜVENLİK İHLALİ TESPİT EDİLDİ!',
        timestamp: new Date().toISOString(),
      };

      setActiveAlert(alertPayload);
      playSecurityAlarmSound();
      refreshAllRealtime();
    };

    if (socket) {
      socket.on('SECURITY_ALERT', handleSecurityAlert);
      socket.on('security_alert', handleSecurityAlert);
      socket.on('PASS_LOG_ADDED', refreshAllRealtime);
      socket.on('pass_event', refreshAllRealtime);
      socket.on('NEW_PASS_LOG', refreshAllRealtime);
      socket.on('REFRESH_VIOLATIONS', refreshAllRealtime);
      socket.on('REFRESH_ALL_DATA', refreshAllRealtime);
    }

    return () => {
      if (socket) {
        socket.off('SECURITY_ALERT', handleSecurityAlert);
        socket.off('security_alert', handleSecurityAlert);
        socket.off('PASS_LOG_ADDED', refreshAllRealtime);
        socket.off('pass_event', refreshAllRealtime);
        socket.off('NEW_PASS_LOG', refreshAllRealtime);
        socket.off('REFRESH_VIOLATIONS', refreshAllRealtime);
        socket.off('REFRESH_ALL_DATA', refreshAllRealtime);
      }
    };
  }, [fetchDashboardData]);

  const handleToggleStatus = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const nextStatus = targetUser.status === 'INSIDE' ? 'OUTSIDE' : 'INSIDE';
    const currentTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === userId ? { ...u, status: nextStatus, lastPass: currentTime } : u
      )
    );

    try {
      await toggleUserStatusApi(userId, targetUser.status);
      await fetchDashboardData(true);
    } catch (error) {
      console.error('Status güncellenemedi:', error);
      fetchDashboardData(true);
    }
  };

  const handleToggleBlock = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const nextBlockStatus = !targetUser.isBlocked;

    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === userId ? { ...u, isBlocked: nextBlockStatus } : u
      )
    );

    try {
      await toggleUserBlockApi(userId, targetUser.isBlocked ?? false);
      await fetchDashboardData(true);
    } catch (error) {
      console.error('Blok güncellenemedi:', error);
      fetchDashboardData(true);
    }
  };

  const handleSelectUser = (userOrQuery: UserItem | string) => {
    const query = typeof userOrQuery === 'string' ? userOrQuery : userOrQuery.id;
    const targetUser = users.find((u) => u.id === query || u.name === query);

    if (targetUser) {
      const safeStatus: 'INSIDE' | 'OUTSIDE' = targetUser.status === 'INSIDE' ? 'INSIDE' : 'OUTSIDE';
      setSelectedUser({
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role || 'USER',
        status: safeStatus,
        deviceUUID: targetUser.deviceUUID || 'Atanmadı',
        totalPasses: 0,
        violationCount: targetUser.isBlocked ? 1 : 0,
        lastLocation: 'Ana Giriş Turnike 1',
        history: [
          { time: targetUser.lastPass || '--:--', direction: safeStatus === 'INSIDE' ? 'ENTRY' : 'EXIT', status: 'SUCCESS' },
        ],
      });
    }
  };

  const handlePromptDelete = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser) setUserToDelete(targetUser);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    const targetId = userToDelete.id;

    setUsers((prev) => prev.filter((u) => u.id !== targetId));
    if (selectedUser?.id === targetId) setSelectedUser(null);

    try {
      await deleteUser(targetId);
    } catch {
      fetchDashboardData(true);
    } finally {
      setUserToDelete(null);
    }
  };

  const handleUpdateUserCompany = async (oldCompany: string, newCompany: string) => {
    const affectedUsers = users.filter((u) => {
      const uComp = typeof u.company === 'string' ? u.company : u.company?.name;
      return uComp === oldCompany;
    });

    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        const uComp = typeof u.company === 'string' ? u.company : u.company?.name;
        if (uComp === oldCompany) {
          return {
            ...u,
            company: typeof u.company === 'object' && u.company !== null
              ? { ...u.company, name: newCompany }
              : newCompany,
          };
        }
        return u;
      })
    );

    try {
      await Promise.all(
        affectedUsers.map((u) =>
          updateUser(u.id, {
            ...u,
            company: typeof u.company === 'object' && u.company !== null
              ? { ...u.company, name: newCompany }
              : newCompany,
          })
        )
      );
    } catch (error) {
      console.error('❌ Şirket ismi veritabanında güncellenirken hata oluştu:', error);
    }
  };

  const handleDeleteCompany = async (companyName: string) => {
    const affectedUsers = users.filter((u) => {
      const uComp = typeof u.company === 'string' ? u.company : u.company?.name;
      return uComp === companyName;
    });

    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        const uComp = typeof u.company === 'string' ? u.company : u.company?.name;
        if (uComp === companyName) {
          return {
            ...u,
            company: typeof u.company === 'object' && u.company !== null
              ? { ...u.company, name: 'Diğer' }
              : 'Diğer',
          };
        }
        return u;
      })
    );

    try {
      await Promise.all(
        affectedUsers.map((u) =>
          updateUser(u.id, {
            ...u,
            company: typeof u.company === 'object' && u.company !== null
              ? { ...u.company, name: 'Diğer' }
              : 'Diğer',
          })
        )
      );
    } catch (error) {
      console.error('❌ Şirket silinirken kullanıcılar güncellenemedi:', error);
    }
  };

  const insideCount = useMemo(() => users.filter((u) => u.status === 'INSIDE').length, [users]);
  const dailyEntriesCount = useMemo(() => logs.filter((log) => log.type === 'ENTRY').length, [logs]);
  const dailyExitsCount = useMemo(() => logs.filter((log) => log.type === 'EXIT').length, [logs]);

  return (
    <div className="flex bg-slate-950 text-slate-100 min-h-screen relative overflow-x-hidden">
      
      <AlarmModal alert={activeAlert} onClose={() => setActiveAlert(null)} />
      <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      <UserManagementModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        onAddUser={() => fetchDashboardData(true)}
      />
      <EditUserModal
        isOpen={!!userToEdit}
        user={userToEdit}
        onClose={() => setUserToEdit(null)}
        onSave={async (updatedUser) => {
          setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
          await updateUser(updatedUser.id, updatedUser);
          await fetchDashboardData(true);
        }}
      />

      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Kullanıcı Silinsin mi?</h3>
                <p className="text-xs text-slate-400">Bu işlem geri alınamaz.</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-6 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed">
              <strong className="text-white">{userToDelete.name}</strong> isimli kullanıcıyı silmek istediğinize emin misiniz?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`fixed inset-0 z-40 lg:hidden bg-black/70 backdrop-blur-sm transition-opacity ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <div className="w-64 h-full bg-slate-900" onClick={(e) => e.stopPropagation()}>
          <Sidebar 
            activeTab={activeTab as any} 
            setActiveTab={(tab) => {
              setActiveTab(tab as any);
              setIsMobileMenuOpen(false);
            }} 
          />
        </div>
      </div>

      <div className="hidden lg:block">
        <Sidebar activeTab={activeTab as any} setActiveTab={(tab) => setActiveTab(tab as any)} />
      </div>

      <main className="flex-1 p-4 md:p-8 space-y-6 w-full max-w-7xl mx-auto">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl md:text-2xl font-bold">
                {activeTab === 'MONITOR' && 'Tesis Canlı Durum Göstergesi'}
                {activeTab === 'USERS' && 'Kullanıcı Yönetimi'}
                {activeTab === 'COMPANIES' && 'Şirketler & Personel Listesi'}
                {activeTab === 'PASS_LOGS' && 'Tüm Geçiş Logları'}
                {activeTab === 'VIOLATIONS' && 'Güvenlik İhlal Geçmişi'}
                {activeTab === 'GATES' && 'Manuel Kapı & Turnike Yönetimi'}
                {activeTab === 'SETTINGS' && 'Sistem Ayarları & Yapılandırma'}
              </h2>
              <p className="text-xs md:text-sm text-slate-400">
                Genel Tesis & Kampüs Güvenlik Kontrol Paneli
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDashboardData(false)}
              title="Verileri Yenile"
              className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Yenile</span>
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-200 text-xs font-mono flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button 
              onClick={() => fetchDashboardData(false)}
              className="underline font-bold hover:text-white ml-2 cursor-pointer"
            >
              Tekrar Denetle
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm animate-pulse">
            Veriler yükleniyor...
          </div>
        ) : (
          <>
            {activeTab === 'MONITOR' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Toplam Kayıtlı</p>
                      <h3 className="text-2xl font-bold mt-1 text-white">{users.length}</h3>
                    </div>
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                      <UserCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">İçerideki Kişi</p>
                      <h3 className="text-2xl font-bold mt-1 text-emerald-400">{insideCount}</h3>
                    </div>
                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Giriş Sayısı</p>
                      <h3 className="text-2xl font-bold mt-1 text-emerald-400">{dailyEntriesCount}</h3>
                    </div>
                    <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <LogIn className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Çıkış Sayısı</p>
                      <h3 className="text-2xl font-bold mt-1 text-slate-300">{dailyExitsCount}</h3>
                    </div>
                    <div className="p-2.5 bg-slate-800 text-slate-300 rounded-lg">
                      <LogOut className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Güvenlik İhlali</p>
                      <h3 className="text-2xl font-bold mt-1 text-rose-500">{filteredViolationLogs.length}</h3>
                    </div>
                    <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-lg">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <UserTable
                  users={sortedUsers}
                  onSelectUser={handleSelectUser}
                  onUsersChange={setUsers}
                />
              </div>
            )}

            {activeTab === 'USERS' && (
              <UsersPage
                users={sortedUsers}
                onSelectUser={handleSelectUser}
                onToggleStatus={handleToggleStatus}
                onToggleBlock={handleToggleBlock}
                onDeleteUser={handlePromptDelete}
                onEditUser={setUserToEdit}
                onAddUser={() => setIsAddUserOpen(true)}
              />
            )}

            {activeTab === 'COMPANIES' && (
              <CompanyGroupedView
                users={users}
                onDeleteUser={handlePromptDelete}
                onEditUser={(user) => setUserToEdit(user)}
                onUpdateUserCompany={handleUpdateUserCompany}
                onDeleteCompany={handleDeleteCompany}
              />
            )}

            {/* Geçiş Logları (Özel State'lerini Kullanıyor) */}
            {activeTab === 'PASS_LOGS' && (
              <AlertsHistory 
                logs={filteredLogs} 
                onSelectUser={handleSelectUser} 
                startDate={passLogsStartDate}
                endDate={passLogsEndDate}
                onStartDateChange={setPassLogsStartDate}
                onEndDateChange={setPassLogsEndDate}
              />
            )}

            {/* İhlal Logları (Özel State'lerini Kullanıyor) */}
            {activeTab === 'VIOLATIONS' && (
              <ViolationLogsHistory 
                logs={filteredViolationLogs} 
                startDate={violationStartDate}
                endDate={violationEndDate}
                onStartDateChange={setViolationStartDate}
                onEndDateChange={setViolationEndDate}
              />
            )}

            {activeTab === 'GATES' && <GateControlPanel />}

            {activeTab === 'SETTINGS' && (
              <SettingsPage 
                onRefreshData={() => fetchDashboardData(true)} 
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}