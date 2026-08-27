'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Upload, Building2, Briefcase, Loader2 } from 'lucide-react';
import { saveCompaniesApi, saveTitlesApi } from '@/lib/api';
import { ListManagerModalProps, CompanyItem } from '@/types';

export function ListManagerModal({
  isOpen,
  onClose,
  companies,
  titles,
  onUpdateCompanies,
  onUpdateTitles,
  initialTab = 'companies',
}: ListManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'companies' | 'titles'>(initialTab);
  const [singleInput, setSingleInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const currentList = activeTab === 'companies' ? companies : titles;

  // Nesne veya metin fark etmeksizin öğe adını alan yardımcı fonksiyon
  const getItemName = (item: string | CompanyItem): string => {
    if (!item) return '';
    return typeof item === 'string' ? item : item.name || '';
  };

  const persistAndSetList = async (newList: (string | CompanyItem)[]) => {
    setLoading(true);
    let success = false;
    if (activeTab === 'companies') {
      success = await saveCompaniesApi(newList);
      if (success) {
        onUpdateCompanies(newList);
      } else {
        alert('Şirket listesi veritabanına kaydedilemedi.');
      }
    } else {
      const stringTitles = newList.map(getItemName);
      success = await saveTitlesApi(stringTitles);
      if (success) {
        onUpdateTitles(stringTitles);
      } else {
        alert('Unvan listesi veritabanına kaydedilemedi.');
      }
    }
    setLoading(false);
    return success;
  };

  const handleAddSingle = async () => {
    const trimmed = singleInput.trim();
    if (!trimmed) return;

    if (currentList.some((item) => getItemName(item).toLowerCase() === trimmed.toLowerCase())) {
      alert('Bu kayıt zaten listede mevcut.');
      return;
    }

    const newList = [...currentList, trimmed];
    const ok = await persistAndSetList(newList);
    if (ok) setSingleInput('');
  };

  const handleAddBulk = async () => {
    const lines = bulkInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return;

    const existingNames = currentList.map(getItemName);
    const uniqueCombinedNames = Array.from(new Set([...existingNames, ...lines]));

    const newList: (string | CompanyItem)[] = uniqueCombinedNames.map((name) => {
      const existing = currentList.find((item) => getItemName(item) === name);
      return existing || name;
    });

    const ok = await persistAndSetList(newList);
    if (ok) {
      setBulkInput('');
      setIsBulkMode(false);
    }
  };

  const handleDelete = async (itemToDelete: string | CompanyItem) => {
    const targetName = getItemName(itemToDelete).trim().toLowerCase();
    const newList = currentList.filter(
      (item) => getItemName(item).trim().toLowerCase() !== targetName
    );
    await persistAndSetList(newList);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            {activeTab === 'companies' ? (
              <Building2 className="w-4 h-4 text-blue-400" />
            ) : (
              <Briefcase className="w-4 h-4 text-emerald-400" />
            )}
            <span>{activeTab === 'companies' ? 'Şirket Listesi Yönetimi' : 'Unvan / Meslek Listesi Yönetimi'}</span>
          </div>
          <button onClick={onClose} disabled={loading} className="text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-950/30">
          <button
            type="button"
            disabled={loading}
            onClick={() => { setActiveTab('companies'); setIsBulkMode(false); }}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'companies'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Şirketler ({companies.length})
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => { setActiveTab('titles'); setIsBulkMode(false); }}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'titles'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Unvanlar / Meslekler ({titles.length})
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">
              {isBulkMode ? 'Toplu Yapıştır (Satır Satır)' : 'Tekli Ekleme ve Düzenleme'}
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={() => setIsBulkMode(!isBulkMode)}
              className="text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {isBulkMode ? 'Listeye Dön' : 'Toplu Yükle'}
            </button>
          </div>

          {isBulkMode ? (
            <div className="space-y-3">
              <textarea
                rows={7}
                disabled={loading}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={
                  activeTab === 'companies'
                    ? "Her satıra bir şirket yazın:\nPass System A.Ş.\nSiber Güvenlik Ltd.\nLojistik & Tedarik A.Ş."
                    : "Her satıra bir meslek/unvan yazın:\nMühendis\nYazılım Uzmanı\nTeknik Personel"
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none font-mono disabled:opacity-50"
              />
              <button
                type="button"
                disabled={loading}
                onClick={handleAddBulk}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-900/30 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Toplu Listeyi Ekle
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={loading}
                  value={singleInput}
                  onChange={(e) => setSingleInput(e.target.value)}
                  placeholder={activeTab === 'companies' ? "Yeni şirket adı..." : "Yeni unvan/meslek..."}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSingle())}
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleAddSingle}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 text-xs font-semibold rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ekle
                </button>
              </div>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {currentList.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-6">Kayıtlı liste boş.</p>
                ) : (
                  currentList.map((item, idx) => {
                    const itemName = getItemName(item);
                    return (
                      <div
                        key={`${itemName}-${idx}`}
                        className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs text-slate-200"
                      >
                        <span className="truncate pr-2">{itemName}</span>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleDelete(item)}
                          className="text-slate-500 hover:text-rose-400 transition p-1 cursor-pointer disabled:opacity-50"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}