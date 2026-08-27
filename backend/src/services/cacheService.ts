import { createClient } from 'redis';

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => console.error('❌ Redis İstemci Hatası:', err));

async function ensureConnected() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export class CacheService {
  public static async get(key: string): Promise<string | null> {
    try {
      await ensureConnected();
      return await redisClient.get(key);
    } catch (error) {
      console.error(`CacheService.get Hatası (${key}):`, error);
      return null;
    }
  }

  public static async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      await ensureConnected();
      if (ttlSeconds) {
        await redisClient.set(key, value, { EX: ttlSeconds });
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      console.error(`CacheService.set Hatası (${key}):`, error);
    }
  }

  public static async del(key: string): Promise<boolean> {
    try {
      await ensureConnected();
      const result = await redisClient.del(key);
      return result > 0;
    } catch (error) {
      console.error(`CacheService.del Hatası (${key}):`, error);
      return false;
    }
  }

  public static async exists(key: string): Promise<boolean> {
    try {
      await ensureConnected();
      const count = await redisClient.exists(key);
      return count > 0;
    } catch (error) {
      console.error(`CacheService.exists Hatası (${key}):`, error);
      return false;
    }
  }

  /**
   *  Replay Attack Engelleyici (Nonce Kontrolü)
   * True dönerse token daha önce kullanılmıştır (Replay Attack).
   */
  public static async checkAndSetNonce(nonce: string, ttlSeconds: number = 60): Promise<boolean> {
    try {
      await ensureConnected();
      const key = `nonce:${nonce}`;
      // SETNX (Set if Not Exists)
      const isSet = await redisClient.set(key, '1', { NX: true, EX: ttlSeconds });
      return isSet === null; // Null döndüyse anahtar zaten vardı -> Replay var!
    } catch (error) {
      console.error(`CacheService.checkAndSetNonce Hatası:`, error);
      return false;
    }
  }
}

export default CacheService;