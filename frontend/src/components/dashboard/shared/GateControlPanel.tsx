'use client';

import { useState, useEffect, useRef } from 'react';
import { DoorClosed, DoorOpen, ShieldAlert, Lock, Unlock, Camera, CameraOff, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { GateStatus } from '@/types';
import { verifyQrPassApi } from '@/lib/api';

const INITIAL_GATES: GateStatus[] = [
  { id: 'gate_01', name: 'Turnike 1 (Ana Giriş)', location: 'A Blok Lobi', isLocked: true, statusText: 'CLOSED', lastActivity: '10:40:05' },
  { id: 'gate_02', name: 'Turnike 2 (Ana Çıkış)', location: 'A Blok Lobi', isLocked: true, statusText: 'CLOSED', lastActivity: '10:30:15' },
  { id: 'gate_03', name: 'Bariyer 1 (Otopark Giriş)', location: 'Açık Otopark', isLocked: true, statusText: 'CLOSED', lastActivity: '09:15:22' },
  { id: 'gate_04', name: 'Turnike 3 (VIP Pass)', location: 'B Blok Yönetim', isLocked: true, statusText: 'CLOSED', lastActivity: '08:50:00' },
];

export const GateControlPanel = () => {
  const [gates, setGates] = useState<GateStatus[]>(INITIAL_GATES);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [confirmEmergency, setConfirmEmergency] = useState(false);

  // 📷 Canlı Kamera & QR Okuyucu State'leri
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [selectedGate, setSelectedGate] = useState('Turnike 1 (Ana Giriş)');
  const [simDirection, setSimDirection] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedQrRef = useRef<string | null>(null);
  const scanCoolDownRef = useRef<boolean>(false);

  // 🔄 Kamera Okuyucuyu Başlatma / Durdurma
  const startCamera = async () => {
    try {
      setScanStatus({ type: 'info', message: 'Kamera erişimi başlatılıyor...' });
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'user' }, // Bilgisayar ön kamerası için 'user', harici webcam için 'environment'
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onQrCodeScanned,
        () => {} // Okuma hatası durumunda sessiz kal
      );

      setIsCameraActive(true);
      setScanStatus({ type: 'info', message: 'Turnike Kamerası Aktif. Telefonsuz/Telefondan QR kodunu kameraya gösterin.' });
    } catch (err: any) {
      console.error('Kamera başlatılamadı:', err);
      setScanStatus({
        type: 'error',
        message: 'Kamera başlatılamadı. İzin verildiğinden ve başka bir uygulamanın kamerayı kullanmadığından emin olun.',
      });
      setIsCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Kamera durdurma hatası:', err);
      }
    }
    setIsCameraActive(false);
    setScanStatus(null);
  };

  // 🎯 Kamera Tarafından QR Kod Algılandığında Çalışacak Fonksiyon
  const onQrCodeScanned = async (decodedText: string) => {
    // Üst üste birden fazla istek atılmasını engellemek için 3 saniye bekleme süresi (Cool-down)
    if (scanCoolDownRef.current || isProcessing) return;

    scanCoolDownRef.current = true;
    setIsProcessing(true);
    lastScannedQrRef.current = decodedText;

    try {
      setScanStatus({ type: 'info', message: 'QR Kod Okundu, Turnike Geçişi Doğrulanıyor...' });

      // Backend API'sine QR Payload doğrulama isteği
      const result = await verifyQrPassApi({
        qrPayload: decodedText,
        direction: simDirection,
        gateName: selectedGate,
      });

      // Esnek Başarı Kontrolü (success: true veya error olmaması durumu)
      const isSuccess = result && result.success !== false && !result.error;

      if (isSuccess) {
        setScanStatus({
          type: 'success',
          message: result?.message || `GEÇİŞ ONAYLANDI! Kapı Açıldı (${simDirection === 'ENTRY' ? 'Giriş' : 'Çıkış'})`,
        });

        // İlgili turnikenin kilidini geçici olarak açık göster
        setGates((prev) =>
          prev.map((g) =>
            g.name === selectedGate
              ? { ...g, isLocked: false, statusText: 'OPEN', lastActivity: new Date().toLocaleTimeString('tr-TR') }
              : g
          )
        );

        // 3 saniye sonra turnikeyi otomatik kapat
        setTimeout(() => {
          setGates((prev) =>
            prev.map((g) => (g.name === selectedGate ? { ...g, isLocked: true, statusText: 'CLOSED' } : g))
          );
        }, 3000);
      } else {
        // Anti-Passback veya Diğer Mantıksal Hatalar UI Kutusunda Gösterilir
        setScanStatus({
          type: 'error',
          message: result?.message || 'GEÇİŞ REDDEDİLDİ! Yetkisiz QR veya Anti-Passback İhlali.',
        });
      }
    } catch (err: any) {
      // Ağ veya Ağır İstisna Hatalarını Yakala ve Ekranda Yakala
      setScanStatus({
        type: 'error',
        message: err?.message || 'Geçiş Hatası: Sunucuyla iletişim kurulamadı.',
      });
    } finally {
      setIsProcessing(false);
      // 3 saniye sonra yeni QR okumaya tekrar izin ver
      setTimeout(() => {
        scanCoolDownRef.current = false;
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const toggleGateLock = (gateId: string) => {
    if (isEmergencyMode) return;

    setGates((prev) =>
      prev.map((gate) => {
        if (gate.id === gateId) {
          const nextLocked = !gate.isLocked;
          return {
            ...gate,
            isLocked: nextLocked,
            statusText: nextLocked ? 'CLOSED' : 'OPEN',
            lastActivity: new Date().toLocaleTimeString('tr-TR'),
          };
        }
        return gate;
      })
    );
  };

  const handleEmergencyTrigger = () => {
    const nextEmergencyState = !isEmergencyMode;
    setIsEmergencyMode(nextEmergencyState);
    setConfirmEmergency(false);

    setGates((prev) =>
      prev.map((gate) => ({
        ...gate,
        isLocked: !nextEmergencyState,
        statusText: nextEmergencyState ? 'EMERGENCY_OPEN' : 'CLOSED',
        lastActivity: new Date().toLocaleTimeString('tr-TR'),
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* 🚨 Acil Durum Tahliye Paneli */}
      <div
        className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
          isEmergencyMode
            ? 'bg-rose-950/90 border-rose-600 animate-pulse shadow-2xl shadow-rose-900/50'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-xl ${isEmergencyMode ? 'bg-rose-600 text-white' : 'bg-slate-800 text-rose-400'}`}>
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                ACİL DURUM TAHLİYE SİSTEMİ
                {isEmergencyMode && (
                  <span className="bg-rose-600 text-white text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold animate-bounce">
                    SİSTEM TAHLİYE MODUNDA
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-400 mt-0.5">
                {isEmergencyMode
                  ? 'Tüm turnikeler ve kapı kilitleri devredışı bırakıldı. Serbest geçiş aktif!'
                  : 'Yangın veya panik anında tüm kapıları uzaktan serbest bırakabilirsiniz.'}
              </p>
            </div>
          </div>

          {!confirmEmergency ? (
            <button
              onClick={() => setConfirmEmergency(true)}
              className={`px-5 py-3 rounded-xl font-bold text-sm transition shadow-lg cursor-pointer ${
                isEmergencyMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
              }`}
            >
              {isEmergencyMode ? 'Normal Moda Dön' : '🚨 ACİL TAHLİYE BAŞLAT'}
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-rose-900/80 p-2 rounded-xl border border-rose-600">
              <span className="text-xs font-bold text-white px-2">Emin misiniz?</span>
              <button
                onClick={handleEmergencyTrigger}
                className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer"
              >
                EVET, UYGULA
              </button>
              <button
                onClick={() => setConfirmEmergency(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                İptal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 📹 CANLI KAMERA TURNİKE QR OKUYUCU PANELİ */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Canlı Kamera Turnike QR Okuyucusu
                {isCameraActive && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    Kamera Canlı
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Telefon ekranından oluşturulan QR kodları bilgisayar kamerasından taratın.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isCameraActive ? (
              <button
                onClick={startCamera}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-900/30"
              >
                <Camera className="w-4 h-4" />
                Kamerayı Başlat (QR Okuyucu)
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="w-full sm:w-auto px-5 py-2.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <CameraOff className="w-4 h-4" />
                Kamerayı Kapat
              </button>
            )}
          </div>
        </div>

        {/* Yön ve Turnike Seçim Kontrolleri */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1">Simüle Edilecek Turnike / Kapı</label>
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {gates.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name} ({g.location})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-semibold mb-1">Okutma Yönü</label>
            <select
              value={simDirection}
              onChange={(e) => setSimDirection(e.target.value as 'ENTRY' | 'EXIT')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ENTRY">📥 GİRİŞ YÖNÜ (ENTRY)</option>
              <option value="EXIT">📤 ÇIKIŞ YÖNÜ (EXIT)</option>
            </select>
          </div>
        </div>

        {/* 📷 Kamera Önizleme Kutusu & QR Kadrajı */}
        <div className="relative w-full min-h-[300px] max-h-[450px] bg-slate-950 border-2 border-dashed border-slate-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center">
          <div id="qr-reader" className="w-full h-full text-slate-300"></div>

          {!isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-10 space-y-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
                <Camera className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Turnike Kamerası Kapalı</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Telefondaki geçiş QR kodunu okutmak için yukarıdaki <strong>&quot;Kamerayı Başlat&quot;</strong> butonuna basın.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 📢 Canlı Okuma Durum Bildirim Alanı */}
        {scanStatus && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center gap-3 border transition-all ${
              scanStatus.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                : scanStatus.type === 'error'
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                : 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
            }`}
          >
            {scanStatus.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {scanStatus.type === 'error' && <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            {scanStatus.type === 'info' && <RefreshCw className="w-5 h-5 text-indigo-400 shrink-0 animate-spin" />}
            <span className="font-medium leading-relaxed">{scanStatus.message}</span>
          </div>
        )}
      </div>

      {/* 🚪 Manuel Kapı & Turnike Kilit Listesi */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {gates.map((gate) => (
          <div
            key={gate.id}
            className={`bg-slate-900 border rounded-xl p-5 space-y-4 transition ${
              isEmergencyMode
                ? 'border-rose-900/80 bg-rose-950/20'
                : gate.isLocked
                ? 'border-slate-800'
                : 'border-emerald-500/40 bg-emerald-950/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-white">{gate.name}</h4>
                <p className="text-xs text-slate-400">{gate.location}</p>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  gate.statusText === 'EMERGENCY_OPEN'
                    ? 'bg-rose-500/20 text-rose-400'
                    : gate.isLocked
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {gate.isLocked ? <DoorClosed className="w-5 h-5" /> : <DoorOpen className="w-5 h-5" />}
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-800/80 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Kilit Durumu:</span>
                <span
                  className={`font-semibold ${
                    gate.statusText === 'EMERGENCY_OPEN'
                      ? 'text-rose-400'
                      : gate.isLocked
                      ? 'text-slate-300'
                      : 'text-emerald-400'
                  }`}
                >
                  {gate.statusText === 'EMERGENCY_OPEN'
                    ? 'ACİL AÇIK'
                    : gate.isLocked
                    ? 'KİLİTLİ'
                    : 'GEÇİCİ AÇIK'}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                <span>Son Komut:</span>
                <span>{gate.lastActivity}</span>
              </div>
            </div>

            <button
              disabled={isEmergencyMode}
              onClick={() => toggleGateLock(gate.id)}
              className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                isEmergencyMode
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : gate.isLocked
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20'
              }`}
            >
              {gate.isLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" /> Kapıyı Uzaktan Aç
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> Kapıyı Yeniden Kilitle
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};