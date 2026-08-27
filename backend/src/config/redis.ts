import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('❌ [Redis] İstemci Hatası:', err));
redisClient.on('connect', () => console.log('🔴 [Redis] Bağlantı Başarılı!'));

/**
 * Redis Başlatma Fonksiyonu (app.ts / index.ts içinde çağrılacak)
 */
export const connectRedis = async (): Promise<void> => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

/**
 * QR Replay Attack Önleme (Nonce Kontrolü)
 * @param nonce QR kod içindeki benzersiz rastgele kimlik
 * @param ttlInSeconds Nonce'un bellekte tutulacağı süre (varsayılan: 5 saniye)
 */
export const checkAndSetNonce = async (nonce: string, ttlInSeconds: number = 5): Promise<boolean> => {
  try {
    if (!redisClient.isOpen) {
      await connectRedis();
    }

    // NX: Sadece anahtar önceden YOKSA kaydet.
    // Zaten varsa 'null' döner, bu da QR'ın tekrar kullanıldığını (saldırı) gösterir.
    const result = await redisClient.set(nonce, 'used', {
      EX: ttlInSeconds,
      NX: true,
    });

    return result === 'OK';
  } catch (error) {
    console.error('❌ [Redis Nonce Check Error]:', error);
    // Redis çökerse veya yanıt vermezse güvenlik için varsayılan olarak geçersiz sayıyoruz
    return false;
  }
};

/**
 * Sunucu Kapanırken Redis Bağlantısını Güvenli Kapatma
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient.isOpen) {
    await redisClient.quit();
    console.log('🔌 [Redis] Bağlantı güvenli bir şekilde kapatıldı.');
  }
};

export default redisClient;