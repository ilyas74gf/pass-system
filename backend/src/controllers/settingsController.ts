import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';

/**
 * Profil Güncelleme (PUT /api/settings/profile)
 */
export const updateProfileSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const authUser = (req as any).user;

    // 🔴 GÜVENLİK KONTROLÜ: Doğrulanmış oturum yoksa işlem engellenir.
    if (!authUser || (!authUser.id && !authUser.userId)) {
      return res.status(401).json({
        success: false,
        message: 'Yetkisiz erişim. Lütfen tekrar giriş yapın.',
      });
    }

    const userId = authUser.id || authUser.userId;
    const bodyData = req.body.profile || req.body || {};

    // 1. İşlem sadece oturum açmış kullanıcıya uygulanır (Fallback sorguları kaldırıldı)
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı.',
      });
    }

    const newEmail = bodyData.email ? String(bodyData.email).toLowerCase().trim() : undefined;
    const newName = bodyData.name || bodyData.fullName;
    const newTitle = bodyData.title;
    const newPhone = bodyData.phone;

    // E-posta benzersizlik kontrolü
    if (newEmail && newEmail !== existingUser.email.toLowerCase()) {
      const emailCheck = await prisma.user.findFirst({
        where: {
          email: { equals: newEmail, mode: 'insensitive' },
          id: { not: existingUser.id },
        },
      });
      if (emailCheck) {
        return res.status(400).json({
          success: false,
          message: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.',
        });
      }
    }

    // Güncelleme verisinin hazırlanması
    const updatePayload: any = {};

    if (newName) updatePayload.name = String(newName).trim();
    if (newEmail) updatePayload.email = newEmail;
    if (newTitle !== undefined) updatePayload.title = newTitle ? String(newTitle).trim() : null;
    if (newPhone !== undefined) updatePayload.phone = newPhone ? String(newPhone).trim() : null;
    
    if (bodyData.employeeId !== undefined) {
      updatePayload.employeeId = bodyData.employeeId ? String(bodyData.employeeId).trim() : null;
    }
    if (bodyData.profilePicture !== undefined) {
      updatePayload.profilePicture = bodyData.profilePicture || null;
    }

    // Şifre Güncelleme
    const newPasswordToSet = bodyData.newPassword || bodyData.password;
    if (newPasswordToSet && String(newPasswordToSet).trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updatePayload.password = await bcrypt.hash(String(newPasswordToSet).trim(), salt);
    }

    const savedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: updatePayload,
    });

    return res.status(200).json({
      success: true,
      message: 'Profil bilgileri veritabanına başarıyla kaydedildi.',
      profile: {
        id: savedUser.id,
        name: savedUser.name || '',
        email: savedUser.email || '',
        title: savedUser.title || '',
        phone: savedUser.phone || '',
        employeeId: savedUser.employeeId || '',
        profilePicture: savedUser.profilePicture || null,
      },
    });
  } catch (error: any) {
    console.error('❌ updateProfileSettings Hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Profil güncellenirken bir sunucu hatası oluştu.',
      error: error.message,
    });
  }
};

/**
 * Tüm Ayarları Getir (GET /api/settings)
 */
export const getSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const authUser = (req as any).user;
    const userId = authUser?.id || authUser?.userId;

    let profileData: any = null;

    if (userId) {
      profileData = await prisma.user.findUnique({
        where: { id: userId },
      });
    }

    // Ayarların çekilmesi veya varsayılan oluşturulması
    let settings = await prisma.systemSetting.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await prisma.systemSetting.create({ data: { id: 'default' } });
    }

    return res.status(200).json({
      success: true,
      profile: profileData
        ? {
            id: profileData.id,
            name: profileData.name || '',
            email: profileData.email || '',
            title: profileData.title || '',
            phone: profileData.phone || '',
            employeeId: profileData.employeeId || '',
            profilePicture: profileData.profilePicture || null,
          }
        : null,
      security: {
        antiPassbackTimeout: settings.antiPassbackTimeout,
        maxFrequencyAttempts: settings.maxFrequencyAttempts,
        qrExpirySeconds: settings.qrExpirySeconds,
        maxQrGenerationCount: settings.maxQrGenerationCount,
        qrLimitWindowMinutes: settings.qrLimitWindowMinutes,
        qrCooldownMinutes: settings.qrCooldownMinutes,
        enforceDeviceBinding: settings.enforceDeviceBinding ?? true,
        maxDevicesPerUser: settings.maxDevicesPerUser ?? 1,
      },
      system: {
        systemName: settings.systemName,
        logRetentionDays: settings.logRetentionDays,
        latitude: settings.latitude,
        longitude: settings.longitude,
        geofenceRadiusMeters: settings.geofenceRadiusMeters,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Ayarlar alınamadı.', error: error.message });
  }
};

/**
 * Güvenlik ve QR Kurallarını Güncelle (PUT /api/settings/security)
 */
export const updateSecuritySettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { security } = req.body;
    const data = security || req.body;

    const updated = await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {
        ...(data.antiPassbackTimeout !== undefined && { antiPassbackTimeout: Number(data.antiPassbackTimeout) }),
        ...(data.maxFrequencyAttempts !== undefined && { maxFrequencyAttempts: Number(data.maxFrequencyAttempts) }),
        ...(data.qrExpirySeconds !== undefined && { qrExpirySeconds: Number(data.qrExpirySeconds) }),
        ...(data.maxQrGenerationCount !== undefined && { maxQrGenerationCount: Number(data.maxQrGenerationCount) }),
        ...(data.qrLimitWindowMinutes !== undefined && { qrLimitWindowMinutes: Number(data.qrLimitWindowMinutes) }),
        ...(data.qrCooldownMinutes !== undefined && { qrCooldownMinutes: Number(data.qrCooldownMinutes) }),
        ...(data.enforceDeviceBinding !== undefined && { enforceDeviceBinding: Boolean(data.enforceDeviceBinding) }),
        ...(data.maxDevicesPerUser !== undefined && { maxDevicesPerUser: Number(data.maxDevicesPerUser) }),
      },
      create: {
        id: 'default',
        enforceDeviceBinding: data.enforceDeviceBinding !== undefined ? Boolean(data.enforceDeviceBinding) : true,
        maxDevicesPerUser: data.maxDevicesPerUser !== undefined ? Number(data.maxDevicesPerUser) : 1,
      },
    });

    return res.status(200).json({ success: true, message: 'Güvenlik ve cihaz ayarları güncellendi.', data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Güvenlik ayarları güncellenemedi.', error: error.message });
  }
};

/**
 * Sistem ve Geofence Ayarlarını Güncelle (PUT /api/settings/system)
 */
export const updateSystemSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { system } = req.body;
    const data = system || req.body;

    const updated = await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {
        ...(data.systemName && { systemName: String(data.systemName).trim() }),
        ...(data.logRetentionDays !== undefined && { logRetentionDays: Number(data.logRetentionDays) }),
        ...(data.latitude && { latitude: String(data.latitude) }),
        ...(data.longitude && { longitude: String(data.longitude) }),
        ...(data.geofenceRadiusMeters !== undefined && { geofenceRadiusMeters: Number(data.geofenceRadiusMeters) }),
      },
      create: { id: 'default' },
    });

    return res.status(200).json({ success: true, message: 'Sistem ayarları güncellendi.', data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Sistem ayarları güncellenemedi.', error: error.message });
  }
};