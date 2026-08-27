import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
  statusCode?: number;
  code?: string | number;
  errors?: any;
}

/**
 *  Global Hata Yakalama Middleware'i
 */
export const globalErrorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  
  if (res.headersSent) {
    return next(err);
  }

  console.error('💥 [GLOBAL UNHANDLED ERROR]:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // 1. Mongoose / MongoDB Bağlantı Kesintisi Hataları (503)
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
    res.status(503).json({
      success: false,
      code: 'DATABASE_DISCONNECTED',
      message: 'Veritabanı bağlantı hatası! Sistem geçici olarak hizmet veremiyor.',
    });
    return;
  }

  // 2. Mongoose Validasyon ve Format Hataları (400)
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Geçersiz veri biçimi veya eksik alanlar var.',
      details: err.errors || err.message,
    });
    return;
  }

  // 3. Mongoose Duplicate Key (Çift Kayıt) Hatası (409)
  if (err.code === 11000) {
    res.status(409).json({
      success: false,
      code: 'DUPLICATE_ENTRY',
      message: 'Bu veri zaten sistemde kayıtlı.',
    });
    return;
  }

  // 4. JWT Hataları (401)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: err.name === 'TokenExpiredError' ? 'Oturum süresi doldu.' : 'Geçersiz token.',
    });
    return;
  }

  // 5. Gateway Timeout (Ağ Zaman Aşımı) Hataları (504)
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) {
    res.status(504).json({
      success: false,
      code: 'GATEWAY_TIMEOUT',
      message: 'Ağ zaman aşımı gerçekleşti, lütfen tekrar deneyin.',
    });
    return;
  }

  // 6. Genel / Özel Tanımlı Sunucu Hataları (4xx - 5xx)
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  res.status(status).json({
    success: false,
    code: typeof err.code === 'string' ? err.code : 'INTERNAL_SERVER_ERROR',
    message: isProd && status === 500 ? 'Sunucuda beklenmeyen bir hata oluştu.' : err.message || 'Sunucuda beklenmeyen bir hata oluştu.',
  });
};

export default globalErrorHandler;