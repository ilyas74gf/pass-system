'use client';

import { useEffect, useRef } from 'react';
import { VolumeX, AlertOctagon } from 'lucide-react';
import { AlarmOverlayProps } from '@/types';

export function AlarmOverlay({ activeAlarm, onDismiss }: AlarmOverlayProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (activeAlarm) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } catch (e) {
        console.error('Ses çalınamadı:', e);
      }
    }
  }, [activeAlarm]);

  if (!activeAlarm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/80 backdrop-blur-md p-4 animate-pulse">
      <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
        <div className="p-4 bg-rose-600/20 text-rose-500 rounded-full w-20 h-20 mx-auto flex items-center justify-center border border-rose-500/40">
          <AlertOctagon className="w-10 h-10 animate-spin" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-rose-500 tracking-wider uppercase">
            GÜVENLİK ALARMI!
          </h2>
          <p className="text-sm font-semibold text-slate-200">{activeAlarm.message}</p>
          {activeAlarm.userName && (
            <p className="text-xs font-mono text-rose-300">İhlal Eden: {activeAlarm.userName}</p>
          )}
          <p className="text-[10px] text-slate-400 font-mono">{activeAlarm.time}</p>
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-rose-900/50 flex items-center justify-center gap-2"
        >
          <VolumeX className="w-4 h-4" /> ALARMI SUSTUR VE SIFIRLA
        </button>
      </div>
    </div>
  );
}