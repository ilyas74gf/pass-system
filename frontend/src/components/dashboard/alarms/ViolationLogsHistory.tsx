'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  AlertOctagon, 
  RefreshCw, 
  ShieldAlert, 
  Clock, 
  Calendar,
  KeyRound,
  RotateCcw,
  MapPin,
  Filter,
  Smartphone
} from 'lucide-react';
import { ViolationLogsHistoryProps, ViolationLog } from '@/types';
import { io } from 'socket.io-client';

export function ViolationLogsHistory({ 
  logs: initialLogs = [], 
  selectedDate = '', 
  onDateChange,
  startDate: propStartDate,
  endDate: propEndDate,
  onStartDateChange,
  onEndDateChange
}: ViolationLogsHistoryProps) {
  // Canlı verileri tutmak için state
  const [localLogs, setLocalLogs] = useState<ViolationLog[]>(initialLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Prop güncellenirse yerel state'i senkronize et
  useEffect(() => {
    setLocalLogs(initialLogs);
  }, [initialLogs]);

  // 🚀 CANLI SOKET DİNLEYİCİSİ (Veri anında ekrana düşsün diye)
  useEffect(() => {
    // Projendeki Socket URL veya portuna göre gerekirse ayarla (örn: process.env.NEXT_PUBLIC_SOCKET_URL)
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket', 'polling'],
    });

    const handleNewViolation = (newLog: any) => {
      // Sadece ihlal içeren logları listeye ekle
      const isViolationType = 
        newLog.status === 'BLOCKED_VIOLATION' ||
        newLog.type === 'BLOCKED' ||
        newLog.type === 'BLOCKED_USER_VIOLATION' ||
        newLog.type?.includes('VIOLATION') ||
        newLog.type?.includes('ANTI_PASSBACK') ||
        newLog.message?.toLowerCase().includes('engelli') ||
        newLog.message?.toLowerCase().includes('geçiş engellendi');

      if (isViolationType) {
        setLocalLogs((prevLogs) => {
          // Mükerrer eklemeyi önle
          if (prevLogs.some(l => l.id === newLog.id)) return prevLogs;
          return [newLog, ...prevLogs];
        });
      }
    };

    socket.on('newPassLog', handleNewViolation);
    socket.on('new_pass_log', handleNewViolation);
    socket.on('newViolation', handleNewViolation);
    socket.on('SECURITY_ALERT', handleNewViolation);

    return () => {
      socket.off('newPassLog', handleNewViolation);
      socket.off('new_pass_log', handleNewViolation);
      socket.off('newViolation', handleNewViolation);
      socket.off('SECURITY_ALERT', handleNewViolation);
      socket.disconnect();
    };
  }, []);

  const currentStartDate = propStartDate !== undefined ? propStartDate : selectedDate;
  const currentEndDate = propEndDate !== undefined ? propEndDate : '';

  const getViolationMeta = (log: ViolationLog) => {
    const type = log.type || '';
    const status = (log as any).status || '';
    const msg = (log.message || log.description || '').toLowerCase();

    // 1. CİHAZ İHLALİ
    if (
      type === 'UNAUTHORIZED_DEVICE_ATTEMPT' || 
      type === 'DEVICE_MISMATCH' || 
      msg.includes('farklı cihaz') || 
      msg.includes('cihaz kilit')
    ) {
      return {
        label: 'Cihaz Kilidi İhlali',
        category: 'DEVICE',
        colorClass: 'bg-red-500/10 text-red-400 border-red-500/20',
        textColor: '#ef4444',
        icon: <Smartphone className="w-3.5 h-3.5" />
      };
    }

    // 2. BLOKE / ENGEL İHLALİ
    if (
      type === 'BLOCKED' ||
      type === 'BLOCKED_VIOLATION' ||
      type === 'BLOCKED_USER_VIOLATION' || 
      type === 'BLOCKED_USER_LOGIN_ATTEMPT' || 
      type === 'BLOCKED_USER_ATTEMPT' || 
      status === 'BLOCKED_VIOLATION' ||
      msg.includes('engelli') ||
      msg.includes('engellenmiş') ||
      msg.includes('pasif') ||
      msg.includes('bloke')
    ) {
      return {
        label: 'Bloke/Pasif Kullanıcı İhlali',
        category: 'BLOCKED',
        colorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        textColor: '#e11d48',
        icon: <AlertOctagon className="w-3.5 h-3.5" />
      };
    }

    if (type.includes('ANTI_PASSBACK') || msg.includes('anti-passback')) {
      return {
        label: 'Anti-Passback İhlali',
        category: 'ANTI_PASSBACK',
        colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        textColor: '#d97706',
        icon: <RotateCcw className="w-3.5 h-3.5" />
      };
    }

    if (type === 'EXCESSIVE_QR_LIMIT' || type === 'RATE_LIMIT_EXCEEDED' || msg.includes('limit') || msg.includes('kilit')) {
      return {
        label: 'Aşırı QR Limiti',
        category: 'LIMIT',
        colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        textColor: '#9333ea',
        icon: <RefreshCw className="w-3.5 h-3.5" />
      };
    }

    if (type === 'BURNED_QR_REUSE' || msg.includes('zaten kullanıldı')) {
      return {
        label: 'Mükerrer QR Kullanımı',
        category: 'SECURITY',
        colorClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        textColor: '#ea580c',
        icon: <KeyRound className="w-3.5 h-3.5" />
      };
    }

    if (type === 'INVALID_SIGNATURE' || msg.includes('imza')) {
      return {
        label: 'Geçersiz QR İmza',
        category: 'SECURITY',
        colorClass: 'bg-red-500/10 text-red-400 border-red-500/20',
        textColor: '#dc2626',
        icon: <ShieldAlert className="w-3.5 h-3.5" />
      };
    }

    if (type === 'GEOFENCE_VIOLATION' || msg.includes('konum')) {
      return {
        label: 'Konum İhlali',
        category: 'GEOFENCE',
        colorClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        textColor: '#0891b2',
        icon: <MapPin className="w-3.5 h-3.5" />
      };
    }

    return {
      label: 'Güvenlik İhlali',
      category: 'OTHER',
      colorClass: 'bg-slate-800 text-slate-300 border-slate-700',
      textColor: '#64748b',
      icon: <ShieldAlert className="w-3.5 h-3.5" />
    };
  };

  const filteredLogs = useMemo(() => {
    return localLogs.filter((log) => {
      const searchLower = searchTerm.toLowerCase();
      const messageText = log.message || log.description || '';
      const userNameText = log.userName || log.user?.name || log.userId || '';

      const matchesSearch = !searchTerm || 
        userNameText.toLowerCase().includes(searchLower) ||
        messageText.toLowerCase().includes(searchLower);

      const meta = getViolationMeta(log);
      const matchesType = 
        filterType === 'ALL' || 
        meta.category === filterType || 
        log.type === filterType;

      return matchesSearch && matchesType;
    });
  }, [localLogs, searchTerm, filterType]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const columns = [
      { name: 'Sıra No', width: '80px' },
      { name: 'Kullanıcı Adı Soyadı', width: '260px' },
      { name: 'İhlal Türü', width: '220px' },
      { name: 'Tarih', width: '120px' },
      { name: 'Saat', width: '100px' },
      { name: 'Açıklama / Detay', width: '480px' },
    ];

    const rowsHtml = filteredLogs.map((log, index) => {
      const meta = getViolationMeta(log);
      const messageText = log.message || log.description || '-';
      const userNameText = log.userName || log.user?.name || log.userId || '-';

      return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td>${userNameText}</td>
          <td style="font-weight: bold; color: ${meta.textColor};">
            ${meta.label}
          </td>
          <td style="text-align: center;">${log.date || (log.createdAt ? new Date(log.createdAt).toLocaleDateString('tr-TR') : '-')}</td>
          <td style="text-align: center;">${log.timestamp || (log.createdAt ? new Date(log.createdAt).toLocaleTimeString('tr-TR') : '-')}</td>
          <td>${messageText}</td>
        </tr>
      `;
    }).join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11pt; }
          th { background-color: #881337; color: #ffffff; font-weight: bold; padding: 10px 16px; border: 1px solid #4c0519; }
          td { padding: 8px 14px; border: 1px solid #cbd5e1; vertical-align: middle; }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            ${columns.map((c) => `<col style="width: ${c.width};" />`).join('')}
          </colgroup>
          <thead>
            <tr>
              ${columns.map((c) => `<th style="width: ${c.width};">${c.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ihlal_Raporu_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-bold text-white">Güvenlik İhlal Logları</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">Sistemdeki tüm güvenlik ihlallerinin canlı ve detaylı dökümü</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filteredLogs.length === 0}
          className="flex items-center justify-center gap-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>İhlal Raporu İndir ({filteredLogs.length})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Kullanıcı veya ihlal detay ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
          />
        </div>
        <div className="relative">
          <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 transition appearance-none cursor-pointer"
          >
            <option value="ALL">Tüm İhlal Türleri</option>
            <option value="DEVICE">Cihaz Kilidi İhlalleri</option>
            <option value="ANTI_PASSBACK">Anti-Passback İhlalleri</option>
            <option value="BLOCKED">Bloke / Pasif İhlalleri</option>
            <option value="LIMIT">Aşırı QR Limit İhlalleri</option>
            <option value="SECURITY">Sahte / Mükerrer QR İhlalleri</option>
          </select>
        </div>
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="date"
            value={currentStartDate}
            onChange={(e) => {
              onStartDateChange?.(e.target.value);
              onDateChange?.(e.target.value);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 transition [color-scheme:dark]"
          />
        </div>
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="date"
            value={currentEndDate}
            onChange={(e) => onEndDateChange?.(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500 transition [color-scheme:dark]"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/60">
              <th className="p-3.5">Kullanıcı</th>
              <th className="p-3.5">İhlal Türü</th>
              <th className="p-3.5">Detay / Mesaj</th>
              <th className="p-3.5">Tarih / Saat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldAlert className="w-8 h-8 text-slate-600" />
                    <p>Kayıtlı ihlal verisi bulunamadı veya filtreye uymuyor.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => {
                const meta = getViolationMeta(log);
                const messageText = log.message || log.description || '-';
                const userNameText = log.userName || log.user?.name || log.userId || 'Bilinmeyen Kullanıcı';
                
                let formattedTime = log.timestamp || '';
                if (!formattedTime && log.createdAt) {
                  formattedTime = new Date(log.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                }

                let formattedDate = log.date || '';
                if (!formattedDate && log.createdAt) {
                  formattedDate = new Date(log.createdAt).toLocaleDateString('tr-TR');
                }

                return (
                  <tr key={log.id || idx} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-bold text-white">{userNameText}</td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.colorClass}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300">{messageText}</td>
                    <td className="p-3.5 text-slate-400 font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {formattedDate ? `${formattedDate} - ` : ''}
                      <span className="text-white font-bold">{formattedTime}</span>
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
}