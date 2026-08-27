import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export class SocketService {
  private static io: SocketIOServer;

  public static init(server: HTTPServer): SocketIOServer {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*', // Tüm originlere izin ver
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.on('connection', (socket) => {
      console.log(`⚡ [WEBSOCKET] İstemci bağlandı: ${socket.id} | Toplam Bağlantı: ${this.io.engine.clientsCount}`);

      socket.on('disconnect', (reason) => {
        console.log(`❌ [WEBSOCKET] Bağlantı kesildi: ${socket.id} | Nedeni: ${reason}`);
      });
    });

    return this.io;
  }

  public static getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.io henüz başlatılmadı!');
    }
    return this.io;
  }

  /**
   *  Canlı Bildirim Yayımlayıcı (Çift Etkinlik & İstemci Kontrollü)
   */
  public static emitEvent(event: string, data: any): void {
    if (!this.io) {
      console.warn(`⚠️ [WEBSOCKET] Socket.io henüz başlatılmadığı için "${event}" gönderilemedi.`);
      return;
    }

    try {
      const activeClients = this.io.engine.clientsCount;
      console.log(`📡 [WEBSOCKET EMIT] Event: "${event}" -> ${activeClients} aktif istemciye gönderiliyor.`);

      // Bağlı tüm istemcilere yay
      this.io.emit(event, data);

      // Event ismi uyuşmazlığı riskine karşı alternatifi de tetikle
      if (event === 'newPassLog') this.io.emit('new_pass_log', data);
      if (event === 'new_pass_log') this.io.emit('newPassLog', data);

      // Dashboard listelerini zorunlu yenileme tetikleyicisi
      this.io.emit('REFRESH_ALL_DATA', { timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.error(`❌ [WEBSOCKET EMIT HATA]: "${event}" olayı gönderilirken hata:`, err?.message || err);
    }
  }
}

export default SocketService;