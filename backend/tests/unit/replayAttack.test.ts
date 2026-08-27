import { QrService } from '../../src/services/qrService';
import CacheService from '../../src/services/cacheService';
import { connectDB, closeDB } from '../../src/config/db';
import mongoose from 'mongoose';

jest.setTimeout(15000);

// Redis/CacheServisini mock'luyoruz
jest.mock('../../src/services/cacheService');

describe('Replay Attack Engelleme Birim Testleri', () => {
  const MOCK_USER_ID = 'user_test_123';
  let usedNonces: Set<string>;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    const QrState = mongoose.models.QrState;
    if (QrState) {
      await QrState.deleteOne({ userId: MOCK_USER_ID });
    }
    await closeDB();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    usedNonces = new Set<string>();

    // CacheService.checkAndSetNonce metodunu simüle ediyoruz:
    // İlk okutmada false (replay değil), ikinci okutmada true (replay attack) döner.
    (CacheService.checkAndSetNonce as jest.Mock).mockImplementation(async (token: string) => {
      if (usedNonces.has(token)) {
        return true; // Replay attack!
      }
      usedNonces.add(token);
      return false; // İlk kullanım
    });

    // Her test öncesi veritabanındaki QrState kaydını temizle
    const QrState = mongoose.models.QrState;
    if (QrState) {
      await QrState.deleteOne({ userId: MOCK_USER_ID });
    }
  });

  test('Ayni QR kod ilk okutuldugunda gecis onaylanmalidir', async () => {
    // 1. Kullanıcı için geçerli QR üret ({ payload, expiresAt, ttlSeconds } döner)
    const { payload } = await QrService.generateQrForUser(MOCK_USER_ID);

    // 2. Turnike geçiş doğrulaması yap (obje olarak { qrToken: payload } gönderilir)
    const result = await QrService.verifyGatePass({ qrToken: payload });

    // 3. Doğrulama başarılı olmalı
    expect(result.success).toBe(true);
    expect(result.userId).toBe(MOCK_USER_ID);
  });

  test('Ayni QR kod ikinci kez okutuldugunda REPLAY_ATTACK engeli verilmelidir', async () => {
    // 1. Kullanıcı için geçerli QR üret
    const { payload } = await QrService.generateQrForUser(MOCK_USER_ID);

    // 2. İlk Okutma (Başarılı)
    const firstAttempt = await QrService.verifyGatePass({ qrToken: payload });
    expect(firstAttempt.success).toBe(true);

    // 3. İkinci Okutma (Replay Attack Engeli)
    const secondAttempt = await QrService.verifyGatePass({ qrToken: payload });
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.errorCode).toBe('REPLAY_ATTACK');
  });
});