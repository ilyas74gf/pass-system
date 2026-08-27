'use client';

import { useEffect } from 'react';
import { AlertTriangle, X, ShieldAlert, Clock, User } from 'lucide-react';
import { AlarmModalProps } from '@/types';

export const AlarmModal = ({ alert, onClose }: AlarmModalProps) => {
  useEffect(() => {
    if (!alert) return;

    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + duration);
      };

      playBeep(880, 0, 0.2);
      playBeep(698, 0.25, 0.2);
      playBeep(880, 0.5, 0.2);
      playBeep(698, 0.75, 0.2);
    } catch (e) {
      console.warn('Ses çalınamadı:', e);
    }
  }, [alert]);

  if (!alert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-rose-950 border-2 border-rose-600 rounded-2xl p-6 shadow-2xl shadow-rose-950/50 space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-rose-300 hover:text-white bg-rose-900/40 p-1.5 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-600 text-white rounded-xl animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> GÜVENLİK İHLALİ ALARMI
            </div>
            <h3 className="text-xl font-bold text-white leading-tight">İhlal Tespit Edildi!</h3>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-rose-900/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <User className="w-4 h-4 text-rose-400" /> Kullanıcı / Cihaz ID:
            </span>
            <span className="font-mono font-bold text-slate-100">{alert.userId}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> İhlal Türü:
            </span>
            <span className="font-bold text-rose-400">{alert.type}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-400" /> Zaman Damgası:
            </span>
            <span className="font-mono text-xs text-slate-300">{new Date(alert.timestamp).toLocaleTimeString('tr-TR')}</span>
          </div>

          <div className="pt-2 border-t border-rose-900/40">
            <p className="text-xs text-slate-400 mb-1">Açıklama / Mesaj:</p>
            <p className="text-sm font-semibold text-rose-200 bg-rose-950/80 p-2.5 rounded-lg border border-rose-900">
              {alert.message}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-rose-600/30"
          >
            Anlaşıldı (Alarmı Sustur)
          </button>
        </div>
      </div>
    </div>
  );
};