import { CompanyItem } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.3.17:5000/api';

/**
 * 🔑 Authorization Header Oluşturucu
 */
const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * 🛠️ Güvenli API Yanıt İşleyici (Next.js Dev Overlay Ekranını Engeller)
 */
const handleResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json().catch(() => ({})) : {};

  if (response.status === 401 || response.status === 403) {
    return {
      success: false,
      error: true,
      message: data.message || 'Yetkisiz Erişim / Oturum Süresi Doldu',
      status: response.status,
    };
  }

  // HTTP 400, 409, 500 vb. hatalarda 'throw' etmek yerine güvenli nesne dönüyoruz
  if (!response.ok) {
    return {
      success: false,
      error: true,
      message: data.message || `İşlem Başarısız (${response.status})`,
      status: response.status,
      ...data,
    };
  }

  return data;
};

/* ==========================================================================
   👤 KULLANICI VE YÖNETİM İŞLEMLERİ (USERS)
   ========================================================================== */

export async function getUsers() {
  try {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'GET',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error('getUsers Error:', error);
    return { success: false, error: true, message: error?.message || 'Kullanıcılar getirilemedi.' };
  }
}

/**
 * 🚀 Kullanıcı Güncelleme İşlemi (Cihaz UUID / DeviceId Uyumu Sağlandı)
 */
export async function updateUser(userId: string, userData: Partial<any>) {
  try {
    const rawDeviceId = userData.deviceId ?? userData.deviceUUID ?? null;
    const cleanDeviceId = rawDeviceId && String(rawDeviceId).trim() !== '' ? String(rawDeviceId).trim() : null;

    const payload = {
      ...userData,
      deviceId: cleanDeviceId,
      deviceUUID: cleanDeviceId,
    };

    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    return await handleResponse(response);
  } catch (error: any) {
    console.error(`updateUser Error (${userId}):`, error);
    return { success: false, error: true, message: error?.message || 'Kullanıcı güncellenemedi.' };
  }
}

/**
 * 🚀 Mobil Cihaz Kilidini Doğrudan Sıfırlama API Metodu
 */
export async function resetUserDeviceApi(userId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/reset-device`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ deviceId: null, deviceUUID: null }),
    });

    const result = await handleResponse(response);

    if (result.error) {
      return await updateUser(userId, { deviceId: null, deviceUUID: null });
    }

    return result;
  } catch (error: any) {
    console.error(`resetUserDeviceApi Error (${userId}):`, error);
    return await updateUser(userId, { deviceId: null, deviceUUID: null });
  }
}

export async function toggleUserStatusApi(userId: string, currentStatus?: string) {
  const newStatus = currentStatus === 'INSIDE' ? 'OUTSIDE' : 'INSIDE';
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });
    const result = await handleResponse(response);

    if (result && result.success !== false && !result.error && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pass-event-success', {
          detail: {
            userId,
            direction: newStatus === 'INSIDE' ? 'ENTRY' : 'EXIT',
            timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          },
        })
      );
    }

    return result;
  } catch (error: any) {
    console.error(`toggleUserStatusApi Error (${userId}):`, error);
    return { success: false, error: true, message: error?.message || 'Durum değiştirilemedi.' };
  }
}

export async function toggleUserBlockApi(userId: string, isCurrentlyBlocked: boolean = false) {
  const isBlocked = !isCurrentlyBlocked;
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/block`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isBlocked }),
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error(`toggleUserBlockApi Error (${userId}):`, error);
    return { success: false, error: true, message: error?.message || 'Bloke durumu güncellenemedi.' };
  }
}

export async function deleteUser(userId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error(`deleteUser Error (${userId}):`, error);
    return { success: false, error: true, message: error?.message || 'Kullanıcı silinemedi.' };
  }
}

export async function registerUserByAdmin(userData: any) {
  try {
    const isFormData = userData instanceof FormData;
    const headers = getAuthHeaders();
    if (isFormData) delete headers['Content-Type'];

    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers,
      body: isFormData ? userData : JSON.stringify(userData),
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error('registerUserByAdmin Error:', error);
    return { success: false, error: true, message: error?.message || 'Kullanıcı kaydı oluşturulamadı.' };
  }
}

/* ==========================================================================
   📊 GEÇİŞ VE GÜVENLİK LOGLARI (PASS LOGS & ALERTS)
   ========================================================================== */

export async function getPassLogs(limit: number = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/logs?limit=${limit}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error('getPassLogs Error:', error);
    return { success: false, error: true, data: [], logs: [] };
  }
}

export async function getSecurityAlerts() {
  try {
    const response = await fetch(`${API_BASE_URL}/security/alerts`, {
      method: 'GET',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error('getSecurityAlerts Error:', error);
    return { success: false, error: true, alerts: [] };
  }
}

/**
 * 🔒 Turnike / QR Okuyucu Geçiş Doğrulama (Anti-Passback Uyumlu & No-Throw)
 */
export async function verifyQrPassApi(payload: {
  qrPayload?: string;
  userId?: string;
  direction: 'ENTRY' | 'EXIT';
  gateName?: string;
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/qr/verify`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await handleResponse(response);

    if (result && result.success !== false && !result.error && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pass-event-success', {
          detail: {
            userId: result.userId || payload.userId,
            direction: payload.direction,
            timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          },
        })
      );
    }

    return result;
  } catch (error: any) {
    console.error('verifyQrPassApi Error:', error);
    return {
      success: false,
      error: true,
      message: error?.message || 'Geçiş doğrulanırken bir hata oluştu.',
    };
  }
}

/* ==========================================================================
   🔑 KİMLİK DOĞRULAMA & PAROLA (AUTH)
   ========================================================================== */

export async function forgotPasswordApi(email: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error('forgotPasswordApi Error:', error);
    return { success: false, error: true, message: error?.message || 'Sıfırlama e-postası gönderilemedi.' };
  }
}

export async function createPasswordApi(token: string, password: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/create-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error('createPasswordApi Error:', error);
    return { success: false, error: true, message: error?.message || 'Şifre oluşturulamadı.' };
  }
}

/* ==========================================================================
   🏢 ŞİRKET VE UNVAN TANIMLARI (COMPANIES & TITLES)
   ========================================================================== */

export async function fetchCompanies(): Promise<(string | CompanyItem)[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/companies`, {
      method: 'GET',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    const data = await handleResponse(response);
    return data.companies || (Array.isArray(data) ? data : []);
  } catch (error: any) {
    console.error('fetchCompanies Error:', error);
    return [];
  }
}

export async function fetchTitles(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/titles`, {
      method: 'GET',
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    const data = await handleResponse(response);
    return data.titles || (Array.isArray(data) ? data : []);
  } catch (error: any) {
    console.error('fetchTitles Error:', error);
    return [];
  }
}

export async function saveCompaniesApi(companies: (string | CompanyItem)[]): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/companies`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ companies }),
    });
    const res = await handleResponse(response);
    return res.success !== false && !res.error;
  } catch (error: any) {
    console.error('saveCompaniesApi Error:', error);
    return false;
  }
}

export async function saveTitlesApi(titles: string[]): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/titles`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ titles }),
    });
    const res = await handleResponse(response);
    return res.success !== false && !res.error;
  } catch (error: any) {
    console.error('saveTitlesApi Error:', error);
    return false;
  }
}