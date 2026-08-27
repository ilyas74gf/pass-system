import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app';
import { SocketService } from './services/socketService';

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0'; 

// HTTP Server & Socket.io Başlatma
const httpServer = createServer(app);
SocketService.init(httpServer);

/**
 *  Sunucu Başlatıcı (Prisma / PostgreSQL Yapısı)
 */
async function startServer() {
  try {
    httpServer.listen(PORT, HOST, () => {
      const lat = process.env.FACILITY_LATITUDE || '41.668576';
      const lon = process.env.FACILITY_LONGITUDE || '26.575364';
      const radius = process.env.MAX_ALLOWED_GEOFENCE_RADIUS_METERS || '100';

      console.log('=================================');
      console.log(`🚀 Güvenli Geçiş Sistemi Sunucusu http://192.168.3.17:${PORT} (Socket.io Aktif) çalışıyor!`);
      console.log(`📍 Tesis Konumu: Lat ${lat}, Lon ${lon} (Maks Yarıçap: ${radius}m)`);
      console.log(`🔗 Health Check: http://192.168.3.17:${PORT}/api/health`);
      console.log('=================================');
    });

    // Graceful Shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`\n⚠️ ${signal} sinyali alındı. Sunucu kapatılıyor...`);
      httpServer.close(() => {
        console.log('💤 Sunucu ve Socket.io bağlantıları güvenle kapatıldı.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (err) {
    console.error('❌ Sunucu Başlatma Hatası:', err);
    process.exit(1);
  }
}

// Test ortamında sunucunun otomatik başlamasını engeller
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { httpServer };