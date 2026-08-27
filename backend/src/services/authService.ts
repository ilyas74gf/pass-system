import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { redisClient } from '../config/redis';

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_JWT_KEY_2026';

export class AuthService {
  /**
   * Cihaz Eşleştirme ve Kullanıcı Aktiflik Doğrulaması
   */
  public static validateDeviceBinding(
    incomingDeviceId?: string,
    registeredDeviceId?: string,
    isActive: boolean = true
  ): boolean {
    if (!isActive) return false;

    if (!incomingDeviceId || !registeredDeviceId || typeof incomingDeviceId !== 'string') {
      return false;
    }

    return incomingDeviceId === registeredDeviceId;
  }

  /**
   * Kullanıcı Giriş İşlemi (Prisma / PostgreSQL Uyumlu)
   */
  public static async login(
    identifier: string,
    passwordInput: unknown,
    deviceId?: string | null,
    isWeb: boolean = false
  ) {
    const cleanIdentifier = String(identifier || '').trim();
    const cleanPassword = String(passwordInput || '').trim();

    console.log('------------------------------------');
    console.log('👉 GİRİŞ TİPİ:', isWeb ? '🌐 WEB' : '📱 MOBİL');
    console.log('👉 GELEN ID:', `"${cleanIdentifier}"`);

    if (!cleanIdentifier || !cleanPassword) {
      throw { status: 400, message: 'E-posta/Kullanıcı adı ve şifre zorunludur.' };
    }

    // Hem e-posta hem de ad ile Prisma üzerinden arama
    const user = await prisma.user.findFirst({
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

    console.log('👉 VERİTABANINDA BULUNAN KULLANICI:', user ? user.email : '❌ KULLANICI BULUNAMADI!');

    if (!user) {
      throw { status: 401, message: 'Kullanıcı veya e-posta bulunamadı.' };
    }

    if (user.isBlocked || user.isActive === false || user.status === 'BLOCKED') {
      throw { status: 403, message: 'Hesabınız engellenmiştir. Lütfen yönetici ile iletişime geçin.' };
    }

    if (!user.password) {
      throw { status: 401, message: 'Bu hesabın henüz tanımlanmış bir şifresi yok. Lütfen mailinizdeki aktivasyon linkiyle şifre oluşturun.' };
    }

    let isMatch = false;

    try {
      // 1. Önce Bcrypt ile karşılaştır
      isMatch = await bcrypt.compare(cleanPassword, user.password);
    } catch (err) {
      console.log('⚠️ Bcrypt kontrol hatası (Muhtemelen hash formatı değil):', err);
      isMatch = false;
    }

    // 2. Eğer Bcrypt false döndüyse ve veritabanında eski/düz metin şifre kaldıysa kontrol et
    if (!isMatch && cleanPassword === user.password.trim()) {
      isMatch = true;

      // Düz metin kalan şifreyi otomatik olarak Bcrypt'e yükselt (Güvenlik yaması)
      const newHashedPassword = await bcrypt.hash(cleanPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: newHashedPassword },
      });
      console.log('🔄 Eski düz metin şifre otomatik olarak Bcrypt hash formatına dönüştürüldü.');
    }

    console.log('👉 ŞİFRE DOĞRU MU?:', isMatch ? '✅ EVET' : '❌ HAYIR (Şifre Yanlış)');
    console.log('------------------------------------');

    if (!isMatch) {
      throw { status: 401, message: 'Giriş bilgileri hatalı (Şifre yanlış).' };
    }

    // Cihaz Kimliği İşleme (Mobil Girişte Ve Cihaz Değeri Varsa)
    let updatedDeviceId = user.deviceId;
    if (!isWeb && deviceId && String(deviceId).trim() !== '' && String(deviceId) !== 'null') {
      const cleanDevId = String(deviceId).trim();
      if (!user.deviceId) {
        const existingDevices = Array.isArray(user.deviceIds) ? user.deviceIds : [];
        const updatedDeviceIds = Array.from(new Set([...existingDevices, cleanDevId]));

        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            deviceId: cleanDevId,
            deviceIds: { set: updatedDeviceIds },
          },
        });
        updatedDeviceId = updatedUser.deviceId;
      }
    }

    // JWT Token Üretimi (24 saat geçerlilik)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role || 'USER',
        deviceId: updatedDeviceId,
        isWeb,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'USER',
        status: user.status || 'OUTSIDE',
        employeeId: user.employeeId || null,
        profilePicture: user.profilePicture || null,
        companyId: user.company?.id || user.companyId || null,
        company: user.company,
        deviceId: updatedDeviceId,
      },
    };
  }

  /**
   * Kullanıcı Oturum Kapatma İşlemi
   */
  public static async logout(userId: string): Promise<void> {
    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.del(`session:${userId}`);
      } catch (err) {
        console.warn('⚠️ Redis oturum silme hatası:', err);
      }
    }
  }
}

export default AuthService;