// ❌ Hatalı Import (Ayrı fonksiyon gibi çekmeye çalışıyor)
// import { validateDeviceBinding } from '../../src/services/authService';

// ✅ Doğru Import (Sınıfı içe aktarın)
import { AuthService } from '../../src/services/authService';

describe('Device Binding Unit Tests', () => {
  const mockRegisteredUser = {
    userId: 'usr_12345',
    registeredDeviceId: 'UUID-DEVICE-9988-AAAA',
    isActive: true,
  };

  test('Doğru cihaz ID ve aktif kullanıcı için doğrulama başarılı olmalıdır', () => {
    // ✅ AuthService.validateDeviceBinding şeklinde çağırın
    const isValid = AuthService.validateDeviceBinding(
      mockRegisteredUser.registeredDeviceId,
      mockRegisteredUser.registeredDeviceId,
      mockRegisteredUser.isActive
    );
    expect(isValid).toBe(true);
  });

  test('Farklı bir cihaz ID gönderildiğinde doğrulama reddedilmelidir (Yetkisiz Cihaz İhlali)', () => {
    const attackerDeviceId = 'UUID-ATTACKER-6666-BBBB';
    const isValid = AuthService.validateDeviceBinding(
      attackerDeviceId,
      mockRegisteredUser.registeredDeviceId,
      mockRegisteredUser.isActive
    );
    expect(isValid).toBe(false);
  });

  test('Pasif kullanıcı hesabı için doğrulama reddedilmelidir', () => {
    const isValid = AuthService.validateDeviceBinding(
      mockRegisteredUser.registeredDeviceId,
      mockRegisteredUser.registeredDeviceId,
      false // Pasif hesap
    );
    expect(isValid).toBe(false);
  });

  test('Cihaz ID eksik (undefined/null) veya boş metin geldiğinde doğrulama reddedilmelidir', () => {
    expect(
      AuthService.validateDeviceBinding(undefined as any, mockRegisteredUser.registeredDeviceId, true)
    ).toBe(false);

    expect(
      AuthService.validateDeviceBinding('', mockRegisteredUser.registeredDeviceId, true)
    ).toBe(false);

    expect(
      AuthService.validateDeviceBinding(mockRegisteredUser.registeredDeviceId, null as any, true)
    ).toBe(false);
  });
});