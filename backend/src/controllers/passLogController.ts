import { Request, Response } from 'express';
import { PassLogService } from '../services/passLogService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import SocketService from '../services/socketService';

const parseLimitParam = (rawLimit: any): number => {
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    return 10000;
  }
  if (rawLimit === '0' || rawLimit === 0 || rawLimit === 'all' || rawLimit === '-1') {
    return 10000;
  }
  const parsed = parseInt(String(rawLimit), 10);
  return isNaN(parsed) ? 10000 : parsed;
};

export const getPassLogsHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseLimitParam(req.query.limit);
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const userId = req.query.userId as string | undefined;

    // Esnek Tarih Parametresi Yakalama
    const date = (req.query.date || req.query.day || req.query.filterDate) as string | undefined;
    const startDate = (req.query.startDate as string) || (req.query.start as string) || date;
    const endDate = (req.query.endDate as string) || (req.query.end as string) || (date ? date : undefined);

    const isViolationRoute = req.originalUrl.includes('violation') || req.query.isViolation === 'true';

    const result = await PassLogService.getLogs({
      page,
      limit,
      status,
      type,
      userId,
      date,
      startDate,
      endDate,
      isViolation: isViolationRoute,
    });

    return res.status(200).json({
      success: true,
      message: 'Geçiş logları başarıyla getirildi.',
      data: result.logs,
      logs: result.logs,
      items: result.logs,
      total: result.total,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
        limit: limit,
      },
    });
  } catch (error: any) {
    console.error('❌ [PassLogController Error]:', error);

    return res.status(500).json({
      success: false,
      message: 'Geçiş logları getirilirken sunucu hatası oluştu.',
      error: error.message,
    });
  }
};

export const createPassLogHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, userName, type, timestamp, date, gateName, message, status, isViolation } = req.body;

    const isViolationLog = isViolation === true || status === 'VIOLATION' || status === 'REJECTED';

    const newLog = await PassLogService.createLog({
      userId,
      userName,
      type,
      status: status || (isViolationLog ? 'VIOLATION' : type),
      timestamp: timestamp || new Date().toISOString(),
      date,
      gateName,
      message,
      isViolation: isViolationLog,
    });

    // WEBSOCKET CANLI YAYINI: Panellerin ve canlı akışın anında güncellenmesi için push yayını
    SocketService.emitEvent('newPassLog', {
      id: (newLog as any)?.id,
      userId,
      userName,
      type,
      status: status || (isViolationLog ? 'VIOLATION' : type),
      timestamp: timestamp || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      gateName,
      message,
      isViolation: isViolationLog,
    });

    return res.status(201).json({
      success: true,
      message: 'Log başarıyla veritabanına kaydedildi.',
      data: newLog,
    });
  } catch (error: any) {
    console.error('❌ [CreatePassLog Error]:', error);

    return res.status(500).json({
      success: false,
      message: 'Log kaydedilirken sunucu hatası oluştu.',
      error: error.message,
    });
  }
};

export const getUserPassLogsHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = (req.user?.userId || req.user?.id || req.query.userId || req.params.userId) as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı kimliği (userId) eksik.',
      });
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseLimitParam(req.query.limit);

    // Mobil Tarih Sorgu Parametreleri
    const date = (req.query.date || req.query.day || req.query.filterDate) as string | undefined;
    const startDate = (req.query.startDate as string) || (req.query.start as string) || date;
    const endDate = (req.query.endDate as string) || (req.query.end as string) || (date ? date : undefined);

    const result = await PassLogService.getLogs({
      page,
      limit,
      userId: userId,
      date,
      startDate,
      endDate,
      isViolation: false,
    });

    return res.status(200).json({
      success: true,
      message: 'Geçiş geçmişiniz başarıyla getirildi.',
      data: result.logs,
      logs: result.logs,
      total: result.total,
    });
  } catch (error: any) {
    console.error('❌ [GetUserPassLogs Error]:', error);

    return res.status(500).json({
      success: false,
      message: 'Geçiş geçmişi alınırken sunucu hatası oluştu.',
      error: error.message,
    });
  }
};