import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes';

const app = express();

// 1. İzin Verilen Origin Adresleri
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.3.17:3000',
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

// 2. HTTP CORS Yapılandırması (Preflight Isteklerini Otomatik Karşılar)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'x-platform',
    'x-device-uuid',
    'x-device-id',
    'platform',
    'device-uuid',
    'deviceid'
  ]
}));

// 3. GÖVDE BOYUTU LİMİTLERİ
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    system: 'Güvenli Geçiş Sistemi Sunucusu',
    timestamp: new Date().toISOString()
  });
});

// 5. API Rotaları
app.use('/api', apiRoutes);

// 6. 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Aramış olduğunuz uç nokta bulunamadı: ${req.method} ${req.originalUrl}`
  });
});

// 7. Global Hata Yakalayıcı
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Sunucu Hatası:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Sunucuda beklenmeyen bir hata oluştu.'
  });
});

export default app;