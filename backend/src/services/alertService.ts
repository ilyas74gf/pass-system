import { SocketService } from './socketService';
import prisma from '../config/prisma';

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertType {
  ANTI_PASSBACK_ENTRY = 'ANTI_PASSBACK_ENTRY',
  ANTI_PASSBACK_EXIT = 'ANTI_PASSBACK_EXIT',
  EXCESSIVE_QR_LIMIT = 'EXCESSIVE_QR_LIMIT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  GEOFENCE_VIOLATION = 'GEOFENCE_VIOLATION',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  BURNED_QR_REUSE = 'BURNED_QR_REUSE',
  BLOCKED_USER_LOGIN_ATTEMPT = 'BLOCKED_USER_LOGIN_ATTEMPT',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  UNAUTHORIZED_DEVICE_ATTEMPT = 'UNAUTHORIZED_DEVICE_ATTEMPT',
  SUSPICIOUS_BEHAVIOR = 'SUSPICIOUS_BEHAVIOR',
  FREQUENCY_EXCEEDED = 'FREQUENCY_EXCEEDED',
  GEO_LOCATION_MISMATCH = 'GEO_LOCATION_MISMATCH',
}

export interface ISecurityAlert {
  type: AlertType | string;
  severity: AlertSeverity | string;
  userId?: string | null;
  message: string;
  timestamp?: string;
  details?: any;
  cooldownMs?: number;
}

export interface IAlertFilter {
  userId?: string;
  severity?: string;
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
}

export class AlertService {
  // Mükerrer ihlalleri engellemek için aktif kilit/cooldown hafızası (Key: "TYPE:userId")
  private static activeAlertCooldowns = new Map<string, number>();

  /**
   * Güvenlik İhlalini Canlı Fırlatır VE PostgreSQL'e Yazar.
   * Mükerrer kayıtları ve bozuk UTC zaman damgalarını engeller.
   */
  public static async emitSecurityAlert(alert: Omit<ISecurityAlert, 'timestamp'>): Promise<void> {
    const targetUserId = alert.userId || 'anonymous';
    const cooldownKey = `${alert.type}:${targetUserId}`;
    const nowMs = Date.now();

    // 1. MÜKERRER İHLAL KONTROLÜ (Kilit süresi devam ediyorsa tekrar yazma)
    if (this.activeAlertCooldowns.has(cooldownKey)) {
      const expiresAt = this.activeAlertCooldowns.get(cooldownKey)!;
      if (nowMs < expiresAt) {
        console.log(`⏳ [ALERT MÜKERRER ENGELLEDİ] ${alert.type} | User: ${targetUserId}`);
        return;
      }
    }

    // 2. COOLDOWN SÜRESİ BELİRLEME (Varsayılan: 3 Dakika = 180,000 ms)
    const cooldownMs = alert.cooldownMs || 3 * 60 * 1000;
    this.activeAlertCooldowns.set(cooldownKey, nowMs + cooldownMs);

    setTimeout(() => {
      if (this.activeAlertCooldowns.get(cooldownKey) === nowMs + cooldownMs) {
        this.activeAlertCooldowns.delete(cooldownKey);
      }
    }, cooldownMs);

    // 3. SAAT VE TARİH DÜZELTMESİ (Yerel Saat HH:mm:ss)
    const nowDate = new Date();
    const formattedTime = nowDate.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const fullAlert: ISecurityAlert = {
      ...alert,
      timestamp: formattedTime,
    };

    console.log(`🚨 [NEW ALARM EMITTED] Type: ${fullAlert.type} | User: ${targetUserId}`);

    // WebSocket üzerinden canlı bildirim yayınlama
    try {
      const socketPayload = {
        ...fullAlert,
        formattedTime,
        createdAt: nowDate.toISOString(),
      };

      SocketService.emitEvent('SECURITY_ALERT', socketPayload);
      SocketService.emitEvent('REFRESH_VIOLATIONS', socketPayload);
      SocketService.emitEvent('REFRESH_ALL_DATA', { source: 'SECURITY_ALERT', type: fullAlert.type });
    } catch (wsErr: any) {
      console.error('❌ [SOCKET EMIT HATA]:', wsErr?.message || wsErr);
    }

    // Veritabanına kaydetme
    try {
      const detailsStr =
        alert.details && typeof alert.details === 'object'
          ? JSON.stringify(alert.details)
          : alert.details
          ? String(alert.details)
          : null;

      await prisma.securityAlert.create({
        data: {
          type: String(fullAlert.type),
          severity: String(fullAlert.severity || AlertSeverity.HIGH),
          userId: fullAlert.userId || null,
          message: fullAlert.message,
          details: detailsStr,
        },
      });

      console.log(`💾 [ALERT DB SAVED] Güvenlik alarmı kaydedildi: ${fullAlert.type}`);
    } catch (err: any) {
      console.error(`⚠️ [ALERT DB HATA]: PostgreSQL kaydı başarısız:`, err?.message || err);
    }
  }

  /**
   * Güvenlik Alarmlarını Listeler (Dashboard ve Güvenlik Ekranı İçin)
   */
  public static async getAlerts(filters: IAlertFilter = {}) {
    try {
      const { userId, severity, type, search, startDate, endDate, limit = 50, page = 1 } = filters;
      const where: any = {};

      if (userId) where.userId = userId;
      if (severity && severity !== 'ALL') where.severity = severity;
      if (type && type !== 'ALL') where.type = type;

      if (search && search.trim() !== '') {
        const term = search.trim();
        where.OR = [
          { message: { contains: term, mode: 'insensitive' } },
          { userId: { contains: term, mode: 'insensitive' } },
          { type: { contains: term, mode: 'insensitive' } },
        ];
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          where.createdAt.gte = start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const skip = (page - 1) * limit;

      const [alerts, total] = await Promise.all([
        prisma.securityAlert.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                employeeId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.securityAlert.count({ where }),
      ]);

      return {
        alerts,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (err: any) {
      console.error(`❌ [ALERT GET HATA]:`, err?.message || err);
      throw new Error('Güvenlik alarmları alınırken bir hata oluştu.');
    }
  }
}

export default AlertService;