import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { AuthService } from '../services/authService';
import { redisClient } from '../config/redis';
import { sendPasswordResetEmail } from '../utils/mailer';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import prisma from '../config/prisma';
import { AlertService, AlertType, AlertSeverity } from '../services/alertService';

/**
 * Kullanıcı Giriş İşlemi (POST /api/auth/login)
 */
export const loginHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const identifier = req.body.email || req.body.username || req.body.userId;
    const rawDeviceId = req.body.deviceUuid || req.body.deviceId;
    const { password, isWeb, platform } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'E-posta / Kullanıcı Adı ve Şifre alanları zorunludur.',
      });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    // 🚀 GELİŞMİŞ WEB İSTEMCİ TESPİTİ
    const userAgent = (req.headers['user-agent'] || '').toString();
    const platformHeader = (req.headers['x-platform'] || req.headers['platform'] || '').toString().toLowerCase();
    const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari') || userAgent.includes('Edge');

    const isWebLogin =
      isWeb === true ||
      isWeb === 'true' ||
      String(platform).toLowerCase() === 'web' ||
      platformHeader === 'web' ||
      (!rawDeviceId && isBrowser);

    // 1. KULLANICIYI VERİTABANINDAN KONTROL ET
    const userCheck = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { name: { equals: cleanIdentifier, mode: 'insensitive' } },
          { employeeId: { equals: cleanIdentifier, mode: 'insensitive' } },
          { id: cleanIdentifier },
        ],
      },
      include: {
        company: true,
      },
    });

    if (!userCheck || !userCheck.password) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz kullanıcı bilgileri veya şifre.',
      });
    }

    // 2. ENGELLİ KULLANICI KONTROLÜ
    const isBlockedUser =
      userCheck.status === 'BLOCKED' ||
      userCheck.status === 'INACTIVE' ||
      userCheck.isBlocked === true ||
      userCheck.isActive === false;

    if (isBlockedUser) {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';

      // 🛠️ DÜZELTME: Prisma relation (user -> connect) kullanıldı
      try {
        await prisma.violation.create({
          data: {
            user: { connect: { id: userCheck.id } },
            type: 'BLOCKED_USER_ATTEMPT',
            description: `Engellenmiş kullanıcı (${userCheck.name || userCheck.email}) uygulamaya giriş yapmaya çalıştı!`,
            deviceId: rawDeviceId || null,
            ipAddress: clientIp,
          },
        });
      } catch (vErr) {
        console.error('⚠️ Engelli kullanıcı ihlal logu yazma hatası:', vErr);
      }

      await AlertService.emitSecurityAlert({
        type: AlertType.BLOCKED_USER_LOGIN_ATTEMPT,
        severity: AlertSeverity.HIGH,
        userId: userCheck.id,
        message: `Engellenmiş kullanıcı (${userCheck.name || userCheck.email}) uygulamaya giriş yapmaya çalıştı!`,
        details: {
          email: userCheck.email,
          deviceId: rawDeviceId,
          clientIp,
        },
      });

      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_BLOCKED',
        showModal: true,
        title: 'Erişim Engellendi',
        message: 'Hesabınız engellenmiştir. Lütfen yönetimle iletişime geçiniz.',
      });
    }

    // 3. ŞİFRE DOĞRULAMA
    const isPasswordValid = await bcrypt.compare(String(password).trim(), userCheck.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz kullanıcı bilgileri veya şifre.',
      });
    }

    // 4. CİHAZ UUID KİLİDİ KONTROLÜ (Sadece Mobil Uygulama İçin)
    if (!isWebLogin) {
      const systemSettings = await prisma.systemSetting.findFirst();

      const enforceDeviceBinding = systemSettings?.enforceDeviceBinding ?? true;

      if (enforceDeviceBinding) {
        const cleanDeviceId = rawDeviceId ? String(rawDeviceId).trim() : null;

        if (!cleanDeviceId || cleanDeviceId === 'null' || cleanDeviceId === 'undefined') {
          return res.status(400).json({
            success: false,
            message: 'Mobil cihaz kilit sistemi aktif. Cihaz UUID bilgisi alınamadı.',
          });
        }

        const currentDeviceId = userCheck.deviceId ? String(userCheck.deviceId).trim() : '';

        // A) İLK GİRİŞ VEYA SIFIRLANMIŞ CİHAZ
        if (!currentDeviceId) {
          const existingDevices = Array.isArray(userCheck.deviceIds) ? userCheck.deviceIds : [];
          const updatedDeviceIds = Array.from(new Set([...existingDevices, cleanDeviceId]));

          await prisma.user.update({
            where: { id: userCheck.id },
            data: {
              deviceId: cleanDeviceId,
              deviceIds: { set: updatedDeviceIds },
            },
          });

          userCheck.deviceId = cleanDeviceId;
          userCheck.deviceIds = updatedDeviceIds;
        } else {
          // B) CİHAZ KİLİDİ UYUŞMAZLIK KONTROLÜ
          const registeredDevices = Array.isArray(userCheck.deviceIds) ? userCheck.deviceIds : [];
          const isDeviceMatch =
            currentDeviceId === cleanDeviceId || registeredDevices.includes(cleanDeviceId);

          if (!isDeviceMatch) {
            const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';

            // 🛠️ DÜZELTME: Prisma relation (user -> connect) kullanıldı
            try {
              await prisma.violation.create({
                data: {
                  user: { connect: { id: userCheck.id } },
                  type: 'UNAUTHORIZED_DEVICE_ATTEMPT',
                  description: `Farklı cihazdan giriş engellendi! (Giriş Denenen UUID: ${cleanDeviceId})`,
                  deviceId: cleanDeviceId,
                  ipAddress: clientIp,
                },
              });
            } catch (vErr) {
              console.error('⚠️ Cihaz ihlali logu yazma hatası:', vErr);
            }

            await AlertService.emitSecurityAlert({
              type: AlertType.UNAUTHORIZED_DEVICE_ATTEMPT,
              severity: AlertSeverity.HIGH,
              userId: userCheck.id,
              message: `Farklı cihazdan giriş engellendi! (Giriş Denenen UUID: ${cleanDeviceId})`,
              details: {
                email: userCheck.email,
                attemptedDeviceId: cleanDeviceId,
                registeredDeviceId: currentDeviceId,
                clientIp,
              },
            });

            return res.status(403).json({
              success: false,
              code: 'DEVICE_MISMATCH',
              showModal: true,
              title: 'Cihaz Kilidi İhlali',
              message:
                'Hesabınız ilk giriş yaptığınız cihaza kilitlenmiştir. Farklı bir cihazdan giriş yapamazsınız. Sıfırlama için yöneticinizle iletişime geçiniz.',
            });
          }
        }
      }
    }

    // 5. AUTH SERVICE İLE OTURUM/TOKEN OLUŞTURMA
    const result = await AuthService.login(identifier, password, rawDeviceId, isWebLogin);

    if (result && result.user && result.user.id) {
      try {
        await prisma.accessLog.create({
          data: {
            user: { connect: { id: result.user.id } },
            type: 'LOGIN',
            direction: 'IN',
            deviceId: rawDeviceId || null,
          },
        });
      } catch (logErr) {
        console.error('⚠️ [ACCESS LOG HATASI]:', logErr);
      }
    }

    const finalDeviceId = userCheck.deviceId || (result.user ? result.user.deviceId : null);

    const userData = {
      id: userCheck.id,
      email: userCheck.email,
      name: userCheck.name,
      role: userCheck.role,
      status: userCheck.status,
      employeeId: userCheck.employeeId || null,
      profilePicture: userCheck.profilePicture || null,
      companyId: userCheck.companyId || null,
      company: userCheck.company || null,
      deviceId: finalDeviceId,
    };

    return res.status(200).json({
      success: true,
      message: 'Giriş başarılı.',
      token: result.token,
      user: userData,
      data: {
        token: result.token,
        user: userData,
      },
    });
  } catch (error: any) {
    console.error('❌ GİRİŞ HATASI:', error);

    if (error.status === 403 || error.code === 'ACCOUNT_BLOCKED' || error.isBlocked) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_BLOCKED',
        showModal: true,
        title: 'Erişim Engellendi',
        message: 'Hesabınız engellenmiştir. Lütfen yönetimle iletişime geçiniz.',
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Giriş sırasında bir sunucu hatası oluştu.',
    });
  }
};

/**
 * Oturum Kapatma İşlemi (POST /api/auth/logout)
 */
export const logoutHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (userId) {
      await AuthService.logout(userId);

      try {
        await prisma.accessLog.create({
          data: {
            user: { connect: { id: userId } },
            type: 'LOGOUT',
            direction: 'OUT',
          },
        });
      } catch (logErr) {
        console.error('⚠️ Çıkış log hatası:', logErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Oturum başarıyla kapatıldı.',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Çıkış yapılırken bir sunucu hatası oluştu.',
    });
  }
};

/**
 * Mail Üzerinden İlk Şifreyi Oluşturma (POST /api/auth/create-password)
 */
export const createPasswordHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const token = req.body.token;
    const rawPassword = req.body.password || req.body.newPassword;

    if (!token || !rawPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token ve yeni şifre alanları zorunludur.',
      });
    }

    const cleanToken = String(token).trim();
    const cleanPassword = String(rawPassword).trim();

    let userId: string | null = null;

    if (redisClient && redisClient.isOpen) {
      try {
        userId = await redisClient.get(`reset:${cleanToken}`);
      } catch (rErr) {
        console.warn('⚠️ Redis okuma hatası:', rErr);
      }
    }

    let user = null;

    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else {
      user = await prisma.user.findFirst({
        where: { resetPasswordToken: cleanToken },
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz veya kullanılmış aktivasyon bağlantısı.',
      });
    }

    if (user.resetPasswordExpires && new Date(user.resetPasswordExpires) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Bağlantının süresi dolmuş. Lütfen yeni bir aktivasyon bağlantısı isteyin.',
      });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isActive: true,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.del(`reset:${cleanToken}`);
      } catch (rErr) {
        console.warn('⚠️ Redis silme hatası:', rErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Şifreniz başarıyla oluşturuldu.',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Şifre oluşturulurken bir sunucu hatası oluştu.',
      error: error.message,
    });
  }
};

/**
 * E-posta ile Şifre Sıfırlama Talebi (POST /api/auth/request-reset)
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'E-posta adresi zorunludur.',
      });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'E-posta adresi sistemde kayıtlıysa şifre sıfırlama bağlantısı iletilecektir.',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(`reset:${resetToken}`, 86400, user.id);
      } catch (rErr) {
        console.warn('⚠️ Redis kayıt hatası:', rErr);
      }
    }

    await sendPasswordResetEmail(cleanEmail, resetToken);

    return res.status(200).json({
      success: true,
      message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Şifre sıfırlama e-postası gönderilemedi.',
      error: error.message,
    });
  }
};

/**
 * Şifre Sıfırlama Onayı (POST /api/auth/reset-password)
 */
export const resetPasswordHandler = async (req: Request, res: Response): Promise<Response> => {
  return createPasswordHandler(req, res);
};