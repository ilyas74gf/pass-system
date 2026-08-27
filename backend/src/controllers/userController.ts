import { Request, Response } from 'express';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../config/prisma';
import { redisClient } from '../config/redis';
import { sendPasswordCreateEmail } from '../utils/mailer';
import { PassLogService } from '../services/passLogService';
import SocketService from '../services/socketService';
import { AlertService, AlertType, AlertSeverity } from '../services/alertService';

/**
 * İstek Parametrelerinden veya Gövdesinden Kullanıcı ID'sini Çıkarır
 */
const getParamId = (req: Request): string | null => {
  const rawId = req.params.id || req.params.userId || req.body.userId || req.body.id;
  if (!rawId) return null;
  if (Array.isArray(rawId)) return rawId[0];
  if (typeof rawId === 'string') return rawId;
  return String(rawId);
};

/**
 * Tüm Kullanıcıları Listele (GET /api/users)
 */
export const getUsers = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const users = await prisma.user.findMany({
      include: {
        company: { select: { id: true, name: true, floor: true, doorNo: true } },
        passLogs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, type: true, status: true },
        },
        accessLogs: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, direction: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedUsers = users.map((u) => {
      const lastPassLog = u.passLogs && u.passLogs.length > 0 ? u.passLogs[0] : null;
      const lastAccessLog = u.accessLogs && u.accessLogs.length > 0 ? u.accessLogs[0] : null;

      let lastDate: Date | null = null;
      if (lastPassLog && lastPassLog.createdAt) {
        lastDate = new Date(lastPassLog.createdAt);
      } else if (lastAccessLog && lastAccessLog.createdAt) {
        lastDate = new Date(lastAccessLog.createdAt);
      }

      let lastPassTime = '--:--';
      if (lastDate) {
        lastPassTime = lastDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      }

      return {
        ...u,
        lastPass: lastPassTime,
        status: u.status || 'OUTSIDE',
        isBlocked: Boolean(u.isBlocked),
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Kullanıcı listesi getirildi.',
      data: formattedUsers,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Kullanıcı listesi alınamadı.',
      error: error.message,
    });
  }
};

/**
 * Tek Bir Kullanıcı Detayını Getir (GET /api/users/:id)
 */
export const getUserById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = getParamId(req);
    if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID.' });

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, floor: true, doorNo: true } },
        passLogs: { take: 10, orderBy: { createdAt: 'desc' } },
        accessLogs: { take: 10, orderBy: { createdAt: 'desc' } },
        violations: { take: 10, orderBy: { createdAt: 'desc' } },
        securityAlerts: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

    return res.status(200).json({
      success: true,
      message: 'Kullanıcı detayları getirildi.',
      data: user,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Kullanıcı detayı alınamadı.',
      error: error.message,
    });
  }
};

/**
 * Yeni Kullanıcı Oluştur (POST /api/users)
 */
export const createUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, role, company, companyId, deviceId, deviceUuid, employeeId, profilePicture } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'İsim ve e-posta zorunludur.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'E-posta adresi zaten kayıtlı.' });
    }

    let userRole: Role = Role.USER;
    if (role && Object.values(Role).includes(role.toUpperCase() as Role)) {
      userRole = role.toUpperCase() as Role;
    }

    let targetCompanyId: string | null = null;
    if (companyId) {
      targetCompanyId = companyId;
    } else if (company && String(company).trim() !== '') {
      const cleanCompanyName = String(company).split('(')[0].trim();
      if (cleanCompanyName) {
        let existingComp = await prisma.company.findFirst({
          where: { name: { equals: cleanCompanyName, mode: 'insensitive' } },
        });
        if (!existingComp) {
          existingComp = await prisma.company.create({ data: { name: cleanCompanyName } });
        }
        targetCompanyId = existingComp.id;
      }
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const inputDevice = deviceId !== undefined ? deviceId : deviceUuid;
    const cleanDeviceId = inputDevice && String(inputDevice).trim() !== '' ? String(inputDevice).trim() : null;
    const cleanEmployeeId = employeeId && String(employeeId).trim() !== '' ? String(employeeId).trim() : null;

    const newUser = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        role: userRole,
        password: null,
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
        deviceId: cleanDeviceId,
        deviceIds: cleanDeviceId ? [cleanDeviceId] : [],
        employeeId: cleanEmployeeId,
        profilePicture: profilePicture || null,
        status: 'OUTSIDE',
        isBlocked: false,
        isActive: false,
        companyId: targetCompanyId,
      },
      include: { company: true },
    });

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(`reset:${resetToken}`, 86400, newUser.id);
      } catch (rErr) {
        console.warn('⚠️ Redis token kayıt hatası:', rErr);
      }
    }

    try {
      await sendPasswordCreateEmail(normalizedEmail, name, resetToken);
    } catch (mailErr) {
      console.error('⚠️ Şifre davet e-postası gönderilemedi:', mailErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Kullanıcı oluşturuldu ve şifre oluşturma e-postası gönderildi.',
      data: newUser,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Kullanıcı oluşturulamadı.',
      error: error.message,
    });
  }
};

/**
 * Kullanıcı Güncelle (PUT/PATCH /api/users/:id)
 */
export const updateUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = getParamId(req);
    if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID.' });

    const {
      name,
      email,
      role,
      isBlocked,
      isActive,
      company,
      companyId,
      deviceId,
      deviceUuid,
      resetDevice,
      employeeId,
      profilePicture,
      status,
    } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

    let userRole: Role | undefined = undefined;
    if (role && Object.values(Role).includes(role.toUpperCase() as Role)) {
      userRole = role.toUpperCase() as Role;
    }

    let targetCompanyId: string | null | undefined = undefined;

    if ('companyId' in req.body || 'company' in req.body) {
      if (companyId === null || company === null || company === '' || company === 'Yok') {
        targetCompanyId = null;
      } else if (companyId) {
        targetCompanyId = companyId;
      } else if (company) {
        const cleanCompanyName = String(company).split('(')[0].trim();
        if (cleanCompanyName) {
          let existingComp = await prisma.company.findFirst({
            where: {
              OR: [
                { id: String(company) },
                { name: { equals: cleanCompanyName, mode: 'insensitive' } },
              ],
            },
          });
          if (!existingComp) {
            existingComp = await prisma.company.create({ data: { name: cleanCompanyName } });
          }
          targetCompanyId = existingComp.id;
        } else {
          targetCompanyId = null;
        }
      }
    }

    const updatePayload: any = {
      ...(name && { name: String(name).trim() }),
      ...(email && { email: String(email).toLowerCase().trim() }),
      ...(userRole && { role: userRole }),
      ...(status && { status }),
      ...(typeof isBlocked === 'boolean' && { isBlocked }),
      ...(typeof isActive === 'boolean' && { isActive }),
      ...(profilePicture !== undefined && { profilePicture }),
      ...(targetCompanyId !== undefined && { companyId: targetCompanyId }),
    };

    if (employeeId !== undefined) {
      updatePayload.employeeId = employeeId && String(employeeId).trim() !== '' ? String(employeeId).trim() : null;
    }

    // Cihaz Kilidi İşlemleri (Kesin Sıfırlama Garantisi)
    const hasDeviceKey = 'deviceId' in req.body || 'deviceUuid' in req.body || resetDevice !== undefined;
    if (hasDeviceKey) {
      const rawDevice = deviceId !== undefined ? deviceId : deviceUuid;
      if (resetDevice === true || rawDevice === null || rawDevice === '' || String(rawDevice).trim() === '') {
        updatePayload.deviceId = null;
        updatePayload.deviceIds = [];
      } else {
        const cleanDeviceId = String(rawDevice).trim();
        updatePayload.deviceId = cleanDeviceId;
        updatePayload.deviceIds = [cleanDeviceId];
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updatePayload,
      include: { company: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Kullanıcı bilgileri başarıyla güncellendi.',
      data: updatedUser,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Kullanıcı güncellenirken bir hata oluştu.',
      error: error.message,
    });
  }
};

/**
 * Kullanıcının Cihaz Kilidini Sıfırla (POST /api/users/:id/reset-device)
 */
export const resetUserDevice = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = getParamId(req);
    if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID.' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        deviceId: null,
        deviceIds: [],
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Cihaz kilidi başarıyla sıfırlandı. Kullanıcı yeni cihazıyla giriş yapabilir.',
      data: updatedUser,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Cihaz kilidi sıfırlanamadı.',
      error: error.message,
    });
  }
};

/**
 * Turnike / Kapı Geçiş Durum Değişimi (POST /api/users/:id/toggle-status)
 */
export const toggleUserStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = getParamId(req);
    if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID.' });

    const { gateId, status } = req.body || {};
    const user = await prisma.user.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

    let targetGateName = 'Ana Kapı';
    let targetGateId = gateId;

    if (gateId) {
      const gate = await prisma.gate.findUnique({ where: { id: gateId } });
      if (gate && gate.name) targetGateName = gate.name;
    } else {
      const defaultGate = await prisma.gate.findFirst();
      if (defaultGate) {
        targetGateId = defaultGate.id;
        if (defaultGate.name) targetGateName = defaultGate.name;
      }
    }

    const nowIso = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = new Date().toLocaleDateString('tr-TR');

    // 🚨 ENGELLİ VEYA PASİF KULLANICI GEÇİŞ İHLALİ
    if (user.isBlocked || user.isActive === false) {
      const violationReason = user.isBlocked
        ? 'Engelli Kullanıcı Geçiş Denemesi'
        : 'Pasif Kullanıcı Geçiş Denemesi';

      const logMessage = `${user.name || 'Kullanıcı'} - ${violationReason}`;

      // 1️⃣ PassLog Kaydı
      const createdLog = await PassLogService.createLog({
        userId: user.id,
        userName: user.name,
        type: 'BLOCKED',
        status: 'BLOCKED_VIOLATION',
        gateName: targetGateName,
        message: logMessage,
      });

      // 2️⃣ Violation Kaydı
      try {
        await prisma.violation.create({
          data: { userId: user.id },
        });
      } catch (_) {}

      // 3️⃣ Alert Kaydı
      await AlertService.emitSecurityAlert({
        type: AlertType.UNAUTHORIZED_ACCESS_ATTEMPT,
        severity: AlertSeverity.HIGH,
        userId: user.id,
        message: `${user.name || 'Kullanıcı'} (${user.email}) engelli/pasif durumdayken geçiş yapmaya çalıştı.`,
        details: { gateName: targetGateName, gateId: targetGateId },
      });

      // 4️⃣ FRONTEND MODAL & TABLO EŞLEŞTİRME PAYLOAD'I
      const socketPayload = {
        id: createdLog?.id || String(Date.now()),
        _id: createdLog?.id || String(Date.now()),
        userId: user.id,
        userName: user.name || 'Bilinmeyen Kullanıcı',
        email: user.email,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          employeeId: user.employeeId || '',
        },
        type: 'BLOCKED_USER_VIOLATION', // Frontend getViolationMeta ile eşleşmesi için
        status: 'BLOCKED_VIOLATION',
        gateName: targetGateName,
        message: logMessage,
        description: logMessage,
        date: createdLog?.date || dateStr,
        timestamp: createdLog?.timestamp || timeStr,
        time: createdLog?.timestamp || timeStr,
        createdAt: createdLog?.createdAt || nowIso,
      };

      // 5️⃣ SOKET YAYINLARI (Tüm Dinleyiciler İçin)
      SocketService.emitEvent('newPassLog', socketPayload);
      SocketService.emitEvent('new_pass_log', socketPayload);
      SocketService.emitEvent('newViolation', socketPayload);
      SocketService.emitEvent('SECURITY_ALERT', socketPayload);
      SocketService.emitEvent('REFRESH_VIOLATIONS', {});
      SocketService.emitEvent('REFRESH_ALL_DATA', {});

      return res.status(403).json({
        success: false,
        isViolation: true,
        message: `Geçiş Engellendi: ${violationReason}`,
        data: socketPayload,
      });
    }

    const newStatus = status ? status : user.status === 'INSIDE' ? 'OUTSIDE' : 'INSIDE';
    const direction = newStatus === 'INSIDE' ? 'ENTRY' : 'EXIT';

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: newStatus },
      include: { company: true },
    });

    const successLog = await PassLogService.createLog({
      userId: user.id,
      userName: user.name,
      type: direction,
      status: 'SUCCESS',
      gateName: targetGateName,
      message: `${user.name || 'Kullanıcı'} kapıdan ${direction === 'ENTRY' ? 'giriş' : 'çıkış'} yaptı.`,
    });

    try {
      await prisma.accessLog.create({
        data: { userId: user.id, gateId: targetGateId || null, direction, type: direction },
      });
    } catch (logErr: any) {
      console.warn('⚠️ AccessLog oluşturulamadı:', logErr.message);
    }

    const successPayload = {
      id: successLog?.id || String(Date.now()),
      userId: user.id,
      userName: user.name,
      email: user.email,
      type: direction,
      status: 'SUCCESS',
      gateName: targetGateName,
      timestamp: successLog?.timestamp || timeStr,
      date: successLog?.date || dateStr,
      createdAt: successLog?.createdAt || nowIso,
      newStatus,
    };

    SocketService.emitEvent('newPassLog', successPayload);
    SocketService.emitEvent('new_pass_log', successPayload);

    return res.status(200).json({
      success: true,
      message: `Geçiş başarılı. Durum '${newStatus}' olarak güncellendi.`,
      data: updatedUser,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Geçiş işlemi gerçekleştirilemedi.',
      error: error.message,
    });
  }
};

/**
 * Kullanıcı Sil (DELETE /api/users/:id)
 */
export const deleteUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = getParamId(req);
    if (!id) return res.status(400).json({ success: false, message: 'Geçersiz ID.' });

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });

    await prisma.user.delete({ where: { id } });
    return res.status(200).json({ success: true, message: 'Kullanıcı başarıyla silindi.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Kullanıcı silinemedi.', error: error.message });
  }
};

/**
 * Şirket Listesini Getir (GET /api/companies)
 */
export const getCompanies = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const rawCompanies = await prisma.company.findMany({
      select: { id: true, name: true, floor: true, doorNo: true },
      orderBy: { name: 'asc' },
    });

    const uniqueMap = new Map<string, { id: string; name: string; floor?: string | null; doorNo?: string | null }>();
    rawCompanies.forEach((c) => {
      const cleanName = c.name.split('(')[0].trim();
      if (cleanName && !uniqueMap.has(cleanName.toLowerCase())) {
        uniqueMap.set(cleanName.toLowerCase(), {
          id: c.id,
          name: cleanName,
          floor: c.floor,
          doorNo: c.doorNo,
        });
      }
    });

    const list = Array.from(uniqueMap.values());

    return res.status(200).json({
      success: true,
      companies: list.map((c) => c.name),
      data: list,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Şirket listesi alınamadı.', error: error.message });
  }
};

/**
 * Toplu Şirket Listesi Kaydet / Senkronize Et (POST /api/companies/bulk)
 */
export const saveCompanies = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companies } = req.body || {};
    if (!Array.isArray(companies)) {
      return res.status(400).json({ success: false, message: 'Geçersiz şirket verisi.' });
    }

    const inputItems = companies
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          return {
            id: item.id ? String(item.id) : undefined,
            name: String(item.name || '').split('(')[0].trim(),
            floor: item.floor ? String(item.floor).trim() : null,
            doorNo: item.doorNo ? String(item.doorNo).trim() : null,
          };
        }
        return {
          id: undefined,
          name: String(item).split('(')[0].trim(),
          floor: null,
          doorNo: null,
        };
      })
      .filter((item) => item.name);

    const inputNames = inputItems.map((i) => i.name.toLowerCase());
    const inputIds = inputItems.map((i) => i.id).filter(Boolean) as string[];

    const dbCompanies = await prisma.company.findMany();

    const toDelete = dbCompanies.filter((dbc) => {
      const matchById = inputIds.includes(dbc.id);
      const matchByName = inputNames.includes(dbc.name.toLowerCase());
      return !matchById && !matchByName;
    });

    if (toDelete.length > 0) {
      const deleteIds = toDelete.map((c) => c.id);
      await prisma.user.updateMany({
        where: { companyId: { in: deleteIds } },
        data: { companyId: null },
      });
      await prisma.company.deleteMany({
        where: { id: { in: deleteIds } },
      });
    }

    for (const item of inputItems) {
      if (item.id) {
        await prisma.company
          .update({
            where: { id: item.id },
            data: {
              name: item.name,
              floor: item.floor,
              doorNo: item.doorNo,
            },
          })
          .catch(() => null);
      } else {
        const existing = await prisma.company.findFirst({
          where: { name: { equals: item.name, mode: 'insensitive' } },
        });
        if (existing) {
          await prisma.company.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              floor: item.floor,
              doorNo: item.doorNo,
            },
          });
        } else {
          await prisma.company.create({
            data: {
              name: item.name,
              floor: item.floor,
              doorNo: item.doorNo,
            },
          });
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Şirket listesi başarıyla güncellendi.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Şirketler kaydedilemedi.', error: error.message });
  }
};

/**
 * Tek Bir Şirket Bilgisini Güncelle (PUT /api/companies/:id)
 */
export const updateCompany = async (req: Request, res: Response): Promise<Response> => {
  try {
    const id = getParamId(req) || req.body.id;
    const { name, floor, doorNo } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Şirket ID zorunludur.' });
    }

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = String(name).split('(')[0].trim();
    if (floor !== undefined) dataToUpdate.floor = floor ? String(floor).trim() : null;
    if (doorNo !== undefined) dataToUpdate.doorNo = doorNo ? String(doorNo).trim() : null;

    const updated = await prisma.company.update({
      where: { id },
      data: dataToUpdate,
    });

    return res.status(200).json({ success: true, message: 'Şirket güncellendi.', data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Şirket güncellenemedi.', error: error.message });
  }
};

/**
 * Şirket Sil (DELETE /api/companies)
 */
export const deleteCompany = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyName, companyId } = req.body || {};
    const targetName = companyName || req.query.name;
    const targetId = companyId || req.query.id;

    if (!targetName && !targetId) {
      return res.status(400).json({ success: false, message: 'Şirket adı veya ID zorunludur.' });
    }

    const cleanName = targetName ? String(targetName).split('(')[0].trim() : undefined;

    const targetComp = await prisma.company.findFirst({
      where: {
        OR: [
          ...(targetId ? [{ id: String(targetId) }] : []),
          ...(cleanName ? [{ name: { equals: cleanName, mode: 'insensitive' as const } }] : []),
        ],
      },
    });

    if (targetComp) {
      await prisma.user.updateMany({
        where: { companyId: targetComp.id },
        data: { companyId: null },
      });

      await prisma.company.delete({
        where: { id: targetComp.id },
      });
    }

    return res.status(200).json({ success: true, message: 'Şirket veritabanından silindi.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Şirket silinemedi.', error: error.message });
  }
};

/**
 * Unvan Listesini Getir (GET /api/titles)
 */
export const getTitles = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const users = await prisma.user.findMany({
      where: { title: { not: null } },
      select: { title: true },
      distinct: ['title'],
    });

    const titles = users
      .map((u) => u.title)
      .filter((t): t is string => Boolean(t && t.trim()));

    return res.status(200).json({ success: true, titles });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Unvan listesi alınamadı.', error: error.message });
  }
};

/**
 * Unvan Kaydet (POST /api/titles)
 */
export const saveTitles = async (_req: Request, res: Response): Promise<Response> => {
  try {
    return res.status(200).json({ success: true, message: 'Unvanlar güncellendi.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Unvanlar kaydedilemedi.', error: error.message });
  }
};