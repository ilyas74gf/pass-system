import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://192.168.3.17:5000';

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'], // Backend ile tam uyumlu websocket ve polling yedeklemesi
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

/**
 * ⚡ Canlı Geçiş Loglarını Dinleme Aboneliği
 */
export const subscribeToPassLogs = (onNewLog: (log: any) => void) => {
  const handler = (data: any) => onNewLog(data);

  socket.on('new_pass_log', handler);
  socket.on('newPassLog', handler);
  socket.on('NEW_PASS_LOG', handler);
  socket.on('PASS_LOG_ADDED', handler);
  socket.on('pass_event', handler);

  return () => {
    socket.off('new_pass_log', handler);
    socket.off('newPassLog', handler);
    socket.off('NEW_PASS_LOG', handler);
    socket.off('PASS_LOG_ADDED', handler);
    socket.off('pass_event', handler);
  };
};

/**
 * 🚨 Güvenlik İhlali ve Alarm Bildirimlerini Dinleme Aboneliği
 */
export const subscribeToSecurityAlerts = (onAlert: (alertData: any) => void) => {
  const handler = (data: any) => onAlert(data);

  socket.on('security_alert', handler);
  socket.on('SECURITY_ALERT', handler);

  return () => {
    socket.off('security_alert', handler);
    socket.off('SECURITY_ALERT', handler);
  };
};

/**
 * 🔄 İhlal Listesini ve Tüm Verileri Yenileme Aboneliği (KRİTİK DÜZELTME)
 * Backend'den gelen REFRESH_VIOLATIONS ve REFRESH_ALL_DATA event'lerini dinler.
 */
export const subscribeToRefreshEvents = (onRefresh: () => void) => {
  const handler = () => onRefresh();

  socket.on('REFRESH_VIOLATIONS', handler);
  socket.on('refresh_violations', handler);
  socket.on('REFRESH_ALL_DATA', handler);
  socket.on('refresh_all_data', handler);

  return () => {
    socket.off('REFRESH_VIOLATIONS', handler);
    socket.off('refresh_violations', handler);
    socket.off('REFRESH_ALL_DATA', handler);
    socket.off('refresh_all_data', handler);
  };
};

/**
 * 👤 Kullanıcı Konum Durumu (INSIDE / OUTSIDE) Değişikliklerini Dinleme Aboneliği
 */
export const subscribeToUserStatusChanges = (onStatusChange: (data: any) => void) => {
  socket.on('user_status_changed', onStatusChange);

  return () => {
    socket.off('user_status_changed', onStatusChange);
  };
};