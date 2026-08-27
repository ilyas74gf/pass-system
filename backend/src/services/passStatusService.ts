import prisma from '../config/prisma';
import SocketService from './socketService';
import { UserPassStatus } from '../models/userStatus.model';

export class PassStatusService {
  /**
   * Kullanıcının anlık geçiş durumunu getirir (Kayıt/Durum yoksa OUTSIDE varsayar)
   */
  public static async getUserStatus(userId: string): Promise<UserPassStatus> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });

      if (!user || !user.status) {
        return UserPassStatus.OUTSIDE;
      }

      return user.status === 'INSIDE' ? UserPassStatus.INSIDE : UserPassStatus.OUTSIDE;
    } catch (err: any) {
      console.error(`❌ [PassStatusService.getUserStatus Hata]:`, err.message);
      return UserPassStatus.OUTSIDE;
    }
  }

  /**
   *  Başarılı geçiş sonrası kullanıcının durumunu veritabanında günceller (INSIDE <-> OUTSIDE)
   *
   */
  public static async updateUserStatus(userId: string, direction: 'ENTRY' | 'EXIT'): Promise<void> {
    try {
      const newStatus = direction === 'ENTRY' ? 'INSIDE' : 'OUTSIDE';
      const now = new Date();

      // Veritabanındaki User tablosunu güncelle
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { 
          status: newStatus,
        },
        select: { id: true, name: true, email: true, status: true },
      });

      const formattedTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      const socketPayload = {
        id: updatedUser.id,
        userId: updatedUser.id,
        userName: updatedUser.name || updatedUser.email || 'Bilinmeyen Kullanıcı',
        newStatus: updatedUser.status,
        status: updatedUser.status,
        direction,
        type: direction,
        lastPass: formattedTime,
        updatedAt: now.toISOString(),
      };

      //  CANLI DASHBOARD BİLDİRİMLERİ (Farklı isimlendirmeleri kapsamak için çoklu yayın)
      SocketService.emitEvent('user_status_changed', socketPayload);
      SocketService.emitEvent('userStatusChanged', socketPayload);
      SocketService.emitEvent('USER_STATUS_CHANGED', socketPayload);

    } catch (err: any) {
      console.error(`❌ [PassStatusService.updateUserStatus Hata]:`, err.message);
    }
  }

  /**
   *  Manuel Durum Sıfırlama (Yönetici Paneli / Acil Durumlar İçin)
   */
  public static async resetUserStatus(
    userId: string, 
    targetStatus: UserPassStatus = UserPassStatus.OUTSIDE
  ): Promise<void> {
    try {
      const now = new Date();

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { status: targetStatus },
        select: { id: true, name: true, email: true, status: true },
      });

      const socketPayload = {
        id: updatedUser.id,
        userId: updatedUser.id,
        userName: updatedUser.name || updatedUser.email || 'Bilinmeyen Kullanıcı',
        newStatus: updatedUser.status,
        status: updatedUser.status,
        updatedAt: now.toISOString(),
      };

      //  Canlı Dashboard Bildirimi
      SocketService.emitEvent('user_status_changed', socketPayload);
      SocketService.emitEvent('userStatusChanged', socketPayload);
      SocketService.emitEvent('USER_STATUS_CHANGED', socketPayload);

    } catch (err: any) {
      console.error(`❌ [PassStatusService.resetUserStatus Hata]:`, err.message);
    }
  }
}

export { UserPassStatus };
export default PassStatusService;