import { Router } from 'express';
import { QrController } from '../controllers/qrController';
import { 
  getPassLogsHandler, 
  getUserPassLogsHandler, 
  createPassLogHandler 
} from '../controllers/passLogController';
import {
  loginHandler,
  logoutHandler,
  requestPasswordReset,
  resetPasswordHandler,
  createPasswordHandler,
} from '../controllers/authController';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getCompanies,
  saveCompanies,
  updateCompany,
  deleteCompany,
  getTitles,
  saveTitles,
} from '../controllers/userController';
import {
  getSettings,
  updateProfileSettings,
  updateSecuritySettings,
  updateSystemSettings,
} from '../controllers/settingsController';
import { authenticateToken, authenticateAdmin } from '../middlewares/authMiddleware';
import { authRateLimiter, qrRateLimiter } from '../middlewares/rateLimiter';

const router = Router();

// 🔑 Auth Rotaları
router.post('/auth/login', authRateLimiter, loginHandler);
router.post('/auth/logout', authenticateToken, logoutHandler);
router.post('/auth/create-password', createPasswordHandler);
router.post('/auth/forgot-password', authRateLimiter, requestPasswordReset);
router.post('/auth/reset-password', resetPasswordHandler);

// 🏢 Şirket & Unvan Rotaları
router.get('/companies', authenticateToken, getCompanies);
router.post('/companies', authenticateAdmin, saveCompanies);
router.put('/companies', authenticateAdmin, saveCompanies);
router.put('/companies/:id', authenticateAdmin, updateCompany);
router.patch('/companies/:id', authenticateAdmin, updateCompany);
router.delete('/companies', authenticateAdmin, deleteCompany);

router.get('/titles', authenticateToken, getTitles);
router.post('/titles', authenticateAdmin, saveTitles);

// 📱 QR Kod & Turnike Geçiş Rotaları
router.post('/qr/generate', authenticateToken, qrRateLimiter, QrController.generateQR);
router.post('/qr/verify', qrRateLimiter, QrController.verifyQR);

// ⚙️ Sistem & Profil Ayarları Rotaları
router.get('/settings', authenticateToken, getSettings);
router.put('/settings/profile', authenticateToken, updateProfileSettings);
router.patch('/settings/profile', authenticateToken, updateProfileSettings);
router.put('/settings/security', authenticateAdmin, updateSecuritySettings);
router.patch('/settings/security', authenticateAdmin, updateSecuritySettings);
router.put('/settings/system', authenticateAdmin, updateSystemSettings);
router.patch('/settings/system', authenticateAdmin, updateSystemSettings);

// 👥 Kullanıcı Yönetimi Rotaları
router.get('/users', authenticateAdmin, getUsers);
router.get('/users/:id', authenticateAdmin, getUserById);
router.post('/users', authenticateAdmin, createUser);
router.put('/users/:id', authenticateAdmin, updateUser);
router.patch('/users/:id', authenticateAdmin, updateUser);

// 🔄 Kullanıcı Durum & Bloke Rotaları
router.post('/users/:id/toggle-status', authenticateAdmin, toggleUserStatus);
router.patch('/users/:id/toggle-status', authenticateAdmin, toggleUserStatus);
router.put('/users/:id/toggle-status', authenticateAdmin, toggleUserStatus);
router.patch('/users/:id/status', authenticateAdmin, toggleUserStatus);
router.put('/users/:id/status', authenticateAdmin, toggleUserStatus);

router.patch('/users/:id/block', authenticateAdmin, updateUser);
router.put('/users/:id/block', authenticateAdmin, updateUser);

router.delete('/users/:id', authenticateAdmin, deleteUser);

// 📊 Geçiş Log ve İhlal Rotaları
router.get('/pass-logs/user', authenticateToken, getUserPassLogsHandler);
router.get('/logs', authenticateAdmin, getPassLogsHandler);
router.post('/logs', authenticateAdmin, createPassLogHandler);
router.get('/admin/pass-logs', authenticateAdmin, getPassLogsHandler);

// 🚨 Anti-Passback & İhlal Takip Rotaları
router.get('/violations', authenticateAdmin, getPassLogsHandler);
router.post('/violations', authenticateAdmin, createPassLogHandler);

export default router;