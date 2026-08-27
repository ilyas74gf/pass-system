import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 *  İstekten En Doğru IP Adresini Çeker
 * Proxy arkasında (Nginx, Cloudflare) virgülle ayrılan ilk istemci IP'sini alır.
 */
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
};

/**
 * Standart Rate Limit Yanıt Oluşturucu
 */
const createLimitHandler = (customMessage: string) => {
  return (_req: Request, res: Response): void => {
    res.status(429).json({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message: customMessage,
    });
  };
};

/**
 * QR Kod İşlemleri İçin Rate Limiter
 * 1 Dakikada maksimum 10 istek
 */
export const qrRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  validate: { keyGeneratorIpFallback: false },
  handler: createLimitHandler('Çok fazla QR doğrulama isteği gönderdiniz. Lütfen 1 dakika sonra tekrar deneyin.'),
});

/**
 * Auth / Login İşlemleri İçin Rate Limiter (Brute-Force Koruması)
 * 15 Dakikada maksimum 5 başarısız/deneme isteği
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  validate: { keyGeneratorIpFallback: false },
  handler: createLimitHandler('Çok fazla hatalı giriş denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.'),
});

/**
 * Genel API Rotaları İçin Rate Limiter
 * 1 Dakikada maksimum 100 istek
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  validate: { keyGeneratorIpFallback: false },
  handler: createLimitHandler('Çok fazla istek gönderdiniz. Lütfen bir süre sonra tekrar deneyin.'),
});

export default {
  qrRateLimiter,
  authRateLimiter,
  apiRateLimiter,
};