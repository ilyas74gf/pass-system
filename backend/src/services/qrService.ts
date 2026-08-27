import crypto from 'crypto';
import { AlertService, AlertType, AlertSeverity } from './alertService';
import CacheService from './cacheService';
import prisma from '../config/prisma';
import PassStatusService from './passStatusService';
import PassLogService from './passLogService';
import SocketService from './socketService';
import { UserPassStatus } from '../models/userStatus.model';

const SECRET_KEY = process.env.QR_SECRET_KEY || 'TRAKYA_TEKNOPARK_SUPER_SECRET_KEY_2026';
const CLOCK_DRIFT_TOLERANCE_MS = 3 * 1000;

export interface IQrState {
  userId: string;
  activeQrPayload?: string | null;
  activeQrExpiresAt?: Date | null;
  generationTimestamps: Date[];
  lockedUntil?: Date | null;
  usedSignatures: string[];
}

export interface IQrGenerateOptions {
  qrExpirySeconds?: number;
  maxQrGenerationCount?: number;
  qrLimitWindowMinutes?: number;
  qrCooldownMinutes?: number;
}

//  Anlık Bellek (In-Memory) Hafızası
const qrStateStore = new Map<string, IQrState>();

function getOrCreateQrState(userId: string): IQrState {
  let state = qrStateStore.get(userId);
  if (!state) {
    state = {
      userId,
      activeQrPayload: null,
      activeQrExpiresAt: null,
      generationTimestamps: [],
      lockedUntil: null,
      usedSignatures: []
    };
    qrStateStore.set(userId, state);
  }
  return state;
}

export class QrService {

  /**
   *  Veritabanından Güncel Panel Ayarlarını Okur (Fallback İle)
   */
  private static async getSystemSettings() {
    try {
      const settings = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
      return {
        qrExpirySeconds: settings?.qrExpirySeconds ?? 30,
        maxQrGenerationCount: settings?.maxQrGenerationCount ?? 5,
        qrLimitWindowMinutes: settings?.qrLimitWindowMinutes ?? 5,
        qrCooldownMinutes: settings?.qrCooldownMinutes ?? 3,
      };
    } catch {
      return {
        qrExpirySeconds: 30,
        maxQrGenerationCount: 5,
        qrLimitWindowMinutes: 5,
        qrCooldownMinutes: 3,
      };
    }
  }

  /**
   *  Kullanıcı için QR Üretir (Dinamik Ayarlarla)
   */
  public static async generateQrForUser(userId: string | number, options?: IQrGenerateOptions) {
    if (!userId) {
      throw { status: 400, message: 'userId alanı boş olamaz.' };
    }

    const uId = String(userId).trim();
    const now = Date.now();

    const settings = await this.getSystemSettings();
    const qrTtlMs = (options?.qrExpirySeconds ?? settings.qrExpirySeconds) * 1000;
    const maxGenerations = options?.maxQrGenerationCount ?? settings.maxQrGenerationCount;
    const limitWindowMinutes = options?.qrLimitWindowMinutes ?? settings.qrLimitWindowMinutes;
    const cooldownMinutes = options?.qrCooldownMinutes ?? settings.qrCooldownMinutes;

    const windowMs = limitWindowMinutes * 60 * 1000;
    const cooldownMs = cooldownMinutes * 60 * 1000;

    const state = getOrCreateQrState(uId);

    //  1. Kilit Süresi Kontrolü
    if (state.lockedUntil && state.lockedUntil.getTime() > now) {
      const remainingSec = Math.ceil((state.lockedUntil.getTime() - now) / 1000);
      throw {
        status: 429,
        message: `Çok fazla QR üretme denemesi yaptınız. Hesabınız ${remainingSec} saniye kilitlendi.`
      };
    }

    // ⏱ 2. Zaman Penceresi Kontrolü
    let recentGenerations = (state.generationTimestamps || []).filter(
      (ts: Date) => now - ts.getTime() < windowMs
    );

    if (recentGenerations.length >= maxGenerations) {
      state.lockedUntil = new Date(now + cooldownMs);
      state.generationTimestamps = [];
      
      const alertMsg = `${limitWindowMinutes} dakika içerisinde ${maxGenerations} adet QR üretme sınırı aşıldı! Hesabınız ${cooldownMinutes} dakika boyunca kilitlendi.`;

      AlertService.emitSecurityAlert({
        type: AlertType.EXCESSIVE_QR_LIMIT,
        severity: AlertSeverity.CRITICAL,
        userId: uId,
        message: alertMsg,
        details: { recentCount: recentGenerations.length, limitWindowMinutes, cooldownMinutes }
      });

      throw { status: 429, message: alertMsg };
    }

    //  3. QR Şifreleme ve Üretim İşlemi
    const timestamp = now;
    const nonce = Math.random().toString(36).substring(2, 10);
    const rawData = `${uId}|${timestamp}|${nonce}`;
    const signature = crypto.createHmac('sha256', SECRET_KEY).update(rawData).digest('hex');
    const payload = `${rawData}|${signature}`;

    const expiresAt = new Date(now + qrTtlMs);

    recentGenerations.push(new Date(now));
    state.activeQrPayload = payload;
    state.activeQrExpiresAt = expiresAt;
    state.generationTimestamps = recentGenerations;

    return {
      payload,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: qrTtlMs / 1000
    };
  }

  /**
   *  QR Doğrulama (Dinamik Süre Kontrolü ile)
   */
  public static async verifyQrPayload(qrPayload: string): Promise<{ isValid: boolean; message: string; userId?: string }> {
    if (!qrPayload || typeof qrPayload !== 'string') {
      return { isValid: false, message: 'Bozuk QR veri formatı.' };
    }

    const parts = qrPayload.split('|');
    if (parts.length !== 4) {
      return { isValid: false, message: 'Bozuk QR veri formatı.' };
    }

    const [userId, timestampStr, nonce, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return { isValid: false, message: 'Bozuk QR veri formatı.' };
    }

    const rawData = `${userId}|${timestampStr}|${nonce}`;
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(rawData).digest('hex');

    if (signature !== expectedSignature) {
      AlertService.emitSecurityAlert({
        type: AlertType.INVALID_SIGNATURE,
        severity: AlertSeverity.HIGH,
        userId,
        message: 'Geçersiz QR imzası veya sahte QR denemesi tespit edildi!',
        details: { rawData, receivedSignature: signature }
      });
      return { isValid: false, userId, message: 'Geçersiz QR imzası! Güvenlik ihlali tespit edildi.' };
    }

    const state = getOrCreateQrState(userId);
    if (state && state.usedSignatures && state.usedSignatures.includes(signature)) {
      AlertService.emitSecurityAlert({
        type: AlertType.BURNED_QR_REUSE,
        severity: AlertSeverity.HIGH,
        userId,
        message: 'Yakılmış/Kullanılmış bir QR kod tekrar okutulmaya çalışıldı!',
        details: { signature }
      });
      return { isValid: false, userId, message: 'Güvenlik ihlali: Bu QR kod zaten kullanıldı (Burn-on-Read)!' };
    }

    const now = Date.now();
    
    const settings = await this.getSystemSettings();
    const qrTtlMs = settings.qrExpirySeconds * 1000;
    const maxAllowedAge = qrTtlMs + CLOCK_DRIFT_TOLERANCE_MS;

    if (timestamp > now + CLOCK_DRIFT_TOLERANCE_MS) {
      return { isValid: false, userId, message: 'Cihaz saati sunucu saati ile uyumsuz (Gelecek zaman damgası).' };
    }

    if (now - timestamp > maxAllowedAge) {
      const diffSec = Math.floor((now - timestamp) / 1000);
      return { isValid: false, userId, message: `QR kodun süresi dolmuş (${diffSec} sn önce üretilmiş).` };
    }

    state.usedSignatures.push(signature);
    if (state.usedSignatures.length > 100) {
      state.usedSignatures.shift();
    }

    return {
      isValid: true,
      userId,
      message: 'QR Kod başarıyla doğrulandı ve yakıldı (Burned).'
    };
  }

  /**
   *  Turnike Geçiş Doğrulaması (Otomatik Durum Güncelleme ve Socket Tetikleme Dahil)
   */
  public static async verifyGatePass(data: { qrToken: string; gateId?: string; direction?: 'ENTRY' | 'EXIT' }) {
    if (!data || !data.qrToken) {
      return { success: false, errorCode: 'INVALID_INPUT', message: 'QR Token bilgisi boş olamaz.' };
    }

    // 1️ Replay Attack Kontrolü
    const isReplay = await CacheService.checkAndSetNonce(data.qrToken);
    if (isReplay) {
      return {
        success: false,
        errorCode: 'REPLAY_ATTACK',
        message: 'Replay Attack Engellendi: Bu QR kod daha önce kullanılmış.'
      };
    }

    // 2️ QR Kriptografik Doğrulama
    const verifyResult = await this.verifyQrPayload(data.qrToken);
    if (!verifyResult.isValid || !verifyResult.userId) {
      return {
        success: false,
        errorCode: 'INVALID_QR',
        message: verifyResult.message,
        userId: verifyResult.userId
      };
    }

    const userId = verifyResult.userId;

    // 3️ Kullanıcı Anlık Durum Tespiti & Yön Belirleme
    const currentStatus = await PassStatusService.getUserStatus(userId);
    let direction = data.direction;
    if (!direction) {
      direction = currentStatus === UserPassStatus.INSIDE ? 'EXIT' : 'ENTRY';
    }

    // 4️ Veritabanında Durum Güncelleme ve Log Oluşturma
    await this.clearActiveQr(userId);
    await PassStatusService.updateUserStatus(userId, direction);
    await PassLogService.createLog(
      userId,
      'SUCCESS',
      `Turnike geçişi onaylandı (${direction === 'ENTRY' ? 'GİRİŞ' : 'ÇIKIŞ'}).`,
      'TURNSTILE_DEVICE',
      direction
    );

    //  5. Canlı Socket Bildirimi Gönderme (Ekrana Anında Yansıması İçin)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    }).catch(() => null);

    const passPayload = {
      userId,
      userName: user?.name || 'Kullanıcı',
      email: user?.email,
      type: direction,
      direction,
      status: 'SUCCESS',
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };

    SocketService.emitEvent('newPassLog', passPayload);
    SocketService.emitEvent('new_pass_log', passPayload);

    return {
      success: true,
      userId,
      direction,
      message: 'Geçiş onaylandı ve canlı panelle senkronize edildi.'
    };
  }

  /**
   *  Active QR Temizleme
   */
  public static async clearActiveQr(userId: string | number) {
    if (userId) {
      const uId = String(userId).trim();
      const state = getOrCreateQrState(uId);
      state.activeQrPayload = null;
      state.activeQrExpiresAt = null;
    }
  }
}

export default QrService;