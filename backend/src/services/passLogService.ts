import prisma from '../config/prisma';
import SocketService from './socketService';

export interface IPassLogFilter {
  userId?: string;
  status?: string;
  type?: string;
  limit?: number | string;
  page?: number | string;
  date?: string;
  startDate?: string;
  endDate?: string;
  isViolation?: boolean;
}

/**
 * Türkiye Saat Dilimine (UTC+3) Göre Tarih/Saat Formatlayıcı
 */
const safeParseDateTime = (createdAtInput: Date | string | null, rawDate?: string | null, rawTime?: string | null) => {
  const d = createdAtInput ? new Date(createdAtInput) : new Date();
  const trDate = new Date(d.getTime() + (3 * 60 * 60 * 1000));

  const day = String(trDate.getUTCDate()).padStart(2, '0');
  const month = String(trDate.getUTCMonth() + 1).padStart(2, '0');
  const year = trDate.getUTCFullYear();
  const hours = String(trDate.getUTCHours()).padStart(2, '0');
  const minutes = String(trDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(trDate.getUTCSeconds()).padStart(2, '0');

  return {
    date: rawDate || `${day}.${month}.${year}`,
    time: rawTime || `${hours}:${minutes}:${seconds}`,
    iso: d.toISOString(),
  };
};

/**
 * Türkiye Saati (UTC+3) Uyumlu Esnek Tarih Çözümleyici
 */
const parseToDateObj = (dateStr?: string, isEndOfDay: boolean = false): Date | null => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '' || dateStr === 'undefined' || dateStr === 'null') {
    return null;
  }

  try {
    const cleanStr = dateStr.split('T')[0].trim();
    let year: number, month: number, day: number;

    if (cleanStr.includes('.')) {
      const parts = cleanStr.split('.');
      if (parts.length !== 3) return null;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    } else if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts.length !== 3) return null;
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    } else {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return null;
      year = parsed.getUTCFullYear();
      month = parsed.getUTCMonth();
      day = parsed.getUTCDate();
    }

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    //  Türkiye (UTC+3) Saat Dilimini Veritabanı UTC Zamanına Dönüştürme (-3 Saat Ofset)
    const OFFSET_MS = 3 * 60 * 60 * 1000;
    if (isEndOfDay) {
      return new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - OFFSET_MS);
    } else {
      return new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - OFFSET_MS);
    }
  } catch (_) {
    return null;
  }
};

export class PassLogService {
  /**
   *  Geçiş Logu Oluşturur ve Canlı Dashboard'a WebSocket Yayını Atar
   */
  public static async createLog(
    payloadOrUserId: any,
    statusParam?: string,
    messageParam?: string,
    _clientIpParam?: string,
    directionParam?: 'ENTRY' | 'EXIT' | string
  ): Promise<any> {
    try {
      let userId: string | null = null;
      let userName: string | null = null;
      let status: string = 'SUCCESS';
      let type: string = 'ENTRY';
      let message: string | null = null;
      let gateName: string = 'Ana Kapı';
      let customDate: string | null = null;
      let customTime: string | null = null;

      const now = new Date();

      if (typeof payloadOrUserId === 'object' && payloadOrUserId !== null) {
        userId = payloadOrUserId.userId || null;
        userName = payloadOrUserId.userName || payloadOrUserId.user?.name || null;
        type = payloadOrUserId.type || payloadOrUserId.direction || 'ENTRY';
        status = payloadOrUserId.status || 'SUCCESS';
        gateName = payloadOrUserId.gateName || 'Ana Kapı';
        customDate = payloadOrUserId.date || null;
        customTime = payloadOrUserId.timestamp || payloadOrUserId.time || null;
        message = payloadOrUserId.message || null;
      } else {
        userId = payloadOrUserId || null;
        status = statusParam || 'SUCCESS';
        message = messageParam || null;
        type = directionParam || 'ENTRY';
      }

      //  Kullanıcı ID var ama Kullanıcı Adı yoksa Veritabanından Çek
      if (userId && !userName) {
        try {
          const userObj = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          if (userObj?.name) {
            userName = userObj.name;
          }
        } catch (_) {}
      }

      if (!message) {
        message = `${userName || 'Kullanıcı'} geçiş yaptı.`;
      }

      const parsedDT = safeParseDateTime(now, customDate, customTime);

      const dataToCreate: any = {
        userName,
        type,
        status,
        gateName,
        message,
        date: parsedDT.date,
        timestamp: parsedDT.time,
        createdAt: now,
      };

      if (userId && typeof userId === 'string' && userId.trim() !== '') {
        dataToCreate.user = { connect: { id: userId } };
      }

      const createdLog = await prisma.passLog.create({
        data: dataToCreate,
      });

      // ⚡ CANLI DASHBOARD İÇİN WEBSOCKET YAYINI
      if (createdLog) {
        const socketPayload = {
          id: createdLog.id,
          userId: createdLog.userId || userId || '',
          userName: createdLog.userName || userName || 'Bilinmeyen Kullanıcı',
          type: createdLog.type || type,
          direction: createdLog.type || type,
          status: createdLog.status || status,
          gateName: createdLog.gateName || gateName,
          message: createdLog.message || message,
          date: createdLog.date,
          timestamp: createdLog.timestamp,
          time: createdLog.timestamp,
          createdAt: createdLog.createdAt,
        };

        SocketService.emitEvent('newPassLog', socketPayload);
        SocketService.emitEvent('new_pass_log', socketPayload);
      }

      return createdLog;
    } catch (err: any) {
      console.error(`❌ [PASS LOG DB HATA]:`, err.message);
      return null;
    }
  }

  /**
   *  Gelişmiş Filtreleme ve Sayfalama ile Geçiş Loglarını Çeker
   */
  public static async getLogs(filters: IPassLogFilter = {}) {
    try {
      const { userId, status, type, limit, page = 1, date, startDate, endDate, isViolation } = filters;

      const isUnlimited = limit === 0 || limit === '0' || limit === -1 || limit === 'all';
      // ⚡ Varsayılan limit 100 yerine 10000 yapıldı
      const parsedLimit = isUnlimited ? undefined : (Number(limit) || 10000);
      const parsedPage = Number(page) || 1;
      const skip = (parsedLimit && parsedLimit > 0) ? (parsedPage - 1) * parsedLimit : undefined;

      const andConditions: any[] = [];

      // Kullanıcı Filtresi
      if (userId && userId.trim() !== '') {
        let matchedName: string | null = null;
        try {
          const userObj = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          matchedName = userObj?.name || null;
        } catch (_) {}

        const userConditions: any[] = [
          { userId: userId },
          { user: { id: userId } }
        ];

        if (matchedName) {
          userConditions.push({
            userName: { equals: matchedName, mode: 'insensitive' }
          });
        }

        andConditions.push({ OR: userConditions });
      }

      const targetStatus = (status || type || '').trim().toUpperCase();
      if (targetStatus && targetStatus !== 'ALL') {
        andConditions.push({
          OR: [
            { type: { equals: targetStatus, mode: 'insensitive' } },
            { status: { equals: targetStatus, mode: 'insensitive' } }
          ]
        });
      }

      // İhlal Filtresi
      if (isViolation === true) {
        andConditions.push({
          OR: [
            { status: { contains: 'VIOLATION', mode: 'insensitive' } },
            { status: { contains: 'BLOCKED', mode: 'insensitive' } },
            { status: { contains: 'FAILED', mode: 'insensitive' } },
            { type: { contains: 'VIOLATION', mode: 'insensitive' } },
            { type: { contains: 'BLOCKED', mode: 'insensitive' } },
          ],
        });
      } else if (isViolation === false) {
        andConditions.push({
          NOT: [
            { status: { contains: 'VIOLATION', mode: 'insensitive' } },
            { status: { contains: 'BLOCKED', mode: 'insensitive' } },
            { status: { contains: 'FAILED', mode: 'insensitive' } },
            { type: { contains: 'VIOLATION', mode: 'insensitive' } },
            { type: { contains: 'BLOCKED', mode: 'insensitive' } },
          ],
        });
      }

      //  TARİH / ZAMAN FİLTRESİ
      const startString = startDate || date;
      const endString = endDate || startDate || date;

      if (startString) {
        const rangeStart = parseToDateObj(startString, false);
        const rangeEnd = parseToDateObj(endString, true);

        if (rangeStart && rangeEnd) {
          andConditions.push({
            createdAt: {
              gte: rangeStart,
              lte: rangeEnd,
            },
          });
        } else {
          andConditions.push({
            date: { contains: startString }
          });
        }
      }

      const where = andConditions.length > 0 ? { AND: andConditions } : {};

      const [rawLogs, total] = await Promise.all([
        prisma.passLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...(parsedLimit ? { take: parsedLimit, skip: skip || 0 } : {}),
          include: {
            user: {
              select: { id: true, name: true, email: true, employeeId: true },
            },
          },
        }),
        prisma.passLog.count({ where }),
      ]);

      const logs = rawLogs.map((log) => {
        const displayName = log.userName || log.user?.name || 'Bilinmeyen Kullanıcı';
        const eventType = log.type || log.status || 'ENTRY';
        const parsedDT = safeParseDateTime(log.createdAt, log.date, log.timestamp);

        return {
          id: log.id,
          _id: log.id,
          userId: log.userId || log.user?.id || '',
          userName: displayName,
          user: {
            id: log.user?.id || log.userId || '',
            name: displayName,
            email: log.user?.email || '',
            employeeId: log.user?.employeeId || '',
          },
          type: eventType,
          direction: eventType,
          status: log.status || 'SUCCESS',
          gateName: log.gateName || 'Ana Kapı',
          message: log.message || `${displayName} geçiş yaptı.`,
          date: parsedDT.date,
          timestamp: parsedDT.time,
          time: parsedDT.time,
          createdAt: parsedDT.iso,
        };
      });

      return {
        logs,
        total,
        page: parsedPage,
        totalPages: parsedLimit ? Math.ceil(total / parsedLimit) || 1 : 1,
      };
    } catch (err: any) {
      console.error(`❌ [PASS LOG GET HATA]:`, err.message);
      throw new Error('Geçiş logları alınırken bir hata oluştu.');
    }
  }
}

export default PassLogService;