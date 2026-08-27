import { Request, Response } from 'express';
import { QrService } from '../services/qrService';
import { PassLogService } from '../services/passLogService';
import { PassStatusService } from '../services/passStatusService';
import { UserPassStatus } from '../models/userStatus.model';
import { AlertService, AlertType, AlertSeverity } from '../services/alertService';
import SocketService from '../services/socketService';
import prisma from '../config/prisma';

export class QrController {
  /**
   *  Kullanıcı İçin Dinamik QR Kod Üretme
   */
  public static async generateQR(req: Request, res: Response): Promise<Response> {
    let userId: string | undefined;

    try {
      userId = req.body.userId || (req as any).user?.id || (req as any).user?._id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Kullanıcı kimliği (userId) bulunamadı.',
        });
      }

      // 1 Veritabanındaki Güncel Panel Ayarlarını Çek
      const settings = await prisma.systemSetting.findUnique({ where: { id: 'default' } });

      const qrExpirySeconds = settings?.qrExpirySeconds ?? 30;
      const maxQrGenerationCount = settings?.maxQrGenerationCount ?? 5;
      const qrLimitWindowMinutes = settings?.qrLimitWindowMinutes ?? 5;
      const qrCooldownMinutes = settings?.qrCooldownMinutes ?? 3;

      // 2️ QR Üretimi (Limit aşımında QrService içerisi güvenlik alarmını 1 kez üretir)
      const qrData = await QrService.generateQrForUser(userId, {
        qrExpirySeconds,
        maxQrGenerationCount,
        qrLimitWindowMinutes,
        qrCooldownMinutes,
      });

      return res.status(200).json({
        success: true,
        message: 'Dinamik QR kod başarıyla üretildi.',
        data: qrData,
        qrExpirySeconds,
        maxQrGenerationCount,
        qrLimitWindowMinutes,
        qrCooldownMinutes,
      });
    } catch (error: any) {
      console.error('❌ [QrController.generateQR Error]:', error);


      return res.status(error.status || error.statusCode || 500).json({
        success: false,
        message: error.message || 'QR üretilirken sunucu hatası oluştu.',
      });
    }
  }

  /**
   *  Turnike/Kapı QR Doğrulama ve Otomatik Yön/Anti-Passback Kontrolü
   */
  public static async verifyQR(req: Request, res: Response): Promise<Response> {
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    try {
      const { qrPayload } = req.body;
      let direction = req.body.direction; 

      if (!qrPayload) {
        return res.status(400).json({
          success: false,
          message: 'qrPayload alanı zorunludur.',
        });
      }

      // 1️ KRİPTOGRAFİK VE SÜRE KONTROLÜ (HMAC & TTL)
      const result = await QrService.verifyQrPayload(qrPayload);

      if (!result.isValid) {
        const targetUser = result.userId || 'UNKNOWN_USER';

        //  PassLog Kaydı (Geçersiz geçiş denemesi için)
        await PassLogService.createLog(
          targetUser,
          'FAILED',
          result.message,
          clientIp,
          direction || 'UNKNOWN'
        );

        
        return res.status(401).json({
          success: false,
          message: result.message,
          userId: result.userId,
        });
      }

      const userId = result.userId!;

      // 2️ KULLANICININ ANLIK DURUMUNU AL (İÇERİDE / DIŞARIDA)
      const currentStatus = await PassStatusService.getUserStatus(userId);

      // ⚡ YÖN OTOMATİK BELİRLEME
      if (!direction) {
        direction = currentStatus === UserPassStatus.INSIDE ? 'EXIT' : 'ENTRY';
      }

      // 3️ ANTİ-PASSBACK DURUM KONTROLÜ
      if (direction === 'ENTRY' && currentStatus === UserPassStatus.INSIDE) {
        const failMessage = 'Anti-Passback İhlali! Zaten tesis içinde görünüyorsunuz, mükerrer giriş engellendi.';

        await PassLogService.createLog(userId, 'FAILED', failMessage, clientIp, direction);

        await AlertService.emitSecurityAlert({
          type: AlertType.ANTI_PASSBACK_ENTRY,
          severity: AlertSeverity.HIGH,
          userId,
          message: failMessage,
          details: { direction, currentStatus },
        });

        return res.status(409).json({
          success: false,
          message: failMessage,
          code: 'ANTI_PASSBACK_ENTRY_VIOLATION',
          userId,
        });
      }

      if (direction === 'EXIT' && currentStatus === UserPassStatus.OUTSIDE) {
        const failMessage = 'Anti-Passback İhlali! Tesis dışında görünüyorsunuz, geçersiz çıkış engellendi.';

        await PassLogService.createLog(userId, 'FAILED', failMessage, clientIp, direction);

        await AlertService.emitSecurityAlert({
          type: AlertType.ANTI_PASSBACK_EXIT,
          severity: AlertSeverity.HIGH,
          userId,
          message: failMessage,
          details: { direction, currentStatus },
        });

        return res.status(409).json({
          success: false,
          message: failMessage,
          code: 'ANTI_PASSBACK_EXIT_VIOLATION',
          userId,
        });
      }

      // 4️ BAŞARILI GEÇİŞ
      await QrService.clearActiveQr(userId);
      await PassStatusService.updateUserStatus(userId, direction);

      await PassLogService.createLog(
        userId,
        'SUCCESS',
        `Turnike geçişi onaylandı (${direction === 'ENTRY' ? 'GİRİŞ' : 'ÇIKIŞ'}).`,
        clientIp,
        direction
      );

      //  WEBSOCKET CANLI YAYINI
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      }).catch(() => null);

      const now = new Date();
      const formattedTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      SocketService.emitEvent('newPassLog', {
        userId,
        email: user?.email,
        name: user?.name,
        type: direction,
        timestamp: formattedTime,
        status: 'SUCCESS',
      });

      return res.status(200).json({
        success: true,
        message: 'Geçiş onaylandı.',
        data: {
          userId,
          direction,
          newStatus: direction === 'ENTRY' ? UserPassStatus.INSIDE : UserPassStatus.OUTSIDE,
          verifiedAt: now.toISOString(),
        },
      });
    } catch (error: any) {
      console.error('❌ [QrController.verifyQR Error]:', error);

      return res.status(500).json({
        success: false,
        message: 'QR doğrulama sırasında sunucu hatası oluştu.',
        error: error.message,
      });
    }
  }
}