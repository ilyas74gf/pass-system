'use client';

import { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertOctagon, 
  Calendar, 
  History 
} from 'lucide-react';
import { AlertsHistoryProps } from '@/types';

export function AlertsHistory({ 
  logs = [], 
  onSelectUser, 
  selectedDate = '', 
  onDateChange,
  startDate: propStartDate,
  endDate: propEndDate,
  onStartDateChange,
  onEndDateChange
}: AlertsHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ENTRY' | 'EXIT'>('ALL');

  const currentStartDate = propStartDate !== undefined ? propStartDate : selectedDate;
  const currentEndDate = propEndDate !== undefined ? propEndDate : '';

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (log.userName && log.userName.toLowerCase().includes(searchLower)) ||
        (log.message && log.message.toLowerCase().includes(searchLower)) ||
        (log.gateName && log.gateName.toLowerCase().includes(searchLower));

      const matchesType = filterType === 'ALL' || log.type === filterType;

      return matchesSearch && matchesType;
    });
  }, [logs, searchTerm, filterType]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const columns = [
      { name: 'Sıra No', width: '80px' },
      { name: 'Kullanıcı Adı Soyadı', width: '360px' },
      { name: 'İşlem Tipi', width: '130px' },
      { name: 'Tarih', width: '140px' },
      { name: 'Saat', width: '100px' },
      { name: 'Kapı / Turnike', width: '300px' },
    ];

    const rowsHtml = filteredLogs.map((log, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>${log.userName || '-'}</td>
        <td style="text-align: center; font-weight: bold; color: ${log.type === 'ENTRY' ? '#059669' : '#dc2626'};">
          ${log.type === 'ENTRY' ? 'GİRİŞ' : 'ÇIKIŞ'}
        </td>
        <td style="text-align: center;">${log.date || '-'}</td>
        <td style="text-align: center;">${log.timestamp || '-'}</td>
        <td>${log.gateName || '-'}</td>
      </tr>
    `).join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11pt; }
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; padding: 10px 16px; border: 1px solid #334155; }
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
    link.setAttribute('download', `Gecis_Loglari_${new Date().toISOString().slice(0, 10)}.xls`);
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
            <History className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Geçiş Logları</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">Sistemdeki tüm turnike giriş ve çıkış hareketlerinin detaylı dökümü</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filteredLogs.length === 0}
          className="flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel / CSV İndir ({filteredLogs.length})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Kullanıcı veya kapı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
        <div className="relative">
          <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'ALL' | 'ENTRY' | 'EXIT')}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition appearance-none cursor-pointer"
          >
            <option value="ALL">Tüm Hareketler</option>
            <option value="ENTRY">Sadece Girişler</option>
            <option value="EXIT">Sadece Çıkışlar</option>
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
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition [color-scheme:dark]"
          />
        </div>
        <div className="relative">
          <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="date"
            value={currentEndDate}
            onChange={(e) => onEndDateChange?.(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition [color-scheme:dark]"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/60">
              <th className="p-3.5">Kullanıcı</th>
              <th className="p-3.5">İşlem Tipi</th>
              <th className="p-3.5">Kapı / Lokasyon</th>
              <th className="p-3.5">Tarih / Saat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <AlertOctagon className="w-8 h-8 text-slate-600" />
                    <p>Kayıtlı geçiş logu bulunamadı veya filtreye uymuyor.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, index) => (
                <tr key={`${log.id || 'log'}-${index}`} className="hover:bg-slate-800/40 transition group">
                  <td className="p-3.5 font-medium text-slate-200">
                    <button
                      type="button"
                      onClick={() => onSelectUser?.(log.userName)}
                      className="hover:text-emerald-400 hover:underline text-left cursor-pointer transition font-bold"
                    >
                      {log.userName || 'Bilinmeyen Kullanıcı'}
                    </button>
                  </td>
                  <td className="p-3.5">
                    {log.type === 'ENTRY' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ArrowUpRight className="w-3.5 h-3.5" /> Giriş
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Çıkış
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-300">{log.gateName || '-'}</td>
                  <td className="p-3.5 text-slate-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {log.date ? `${log.date} ${log.timestamp || ''}` : log.timestamp}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}