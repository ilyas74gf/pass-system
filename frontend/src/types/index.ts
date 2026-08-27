import { ReactNode } from 'react';

// ==========================================
// 🚨 ALARM VE GÜVENLİK (ALARMS) TİPLERİ
// ==========================================

export interface SecurityAlertData {
  id?: string;
  userId: string;
  type: string;
  message: string;
  timestamp: string;
}

export interface AlarmModalProps {
  alert: SecurityAlertData | null;
  onClose: () => void;
}

export interface ActiveAlarmData {
  message: string;
  userName?: string;
  time: string;
}

export interface AlarmOverlayProps {
  activeAlarm: ActiveAlarmData | null;
  onDismiss: () => void;
}

// ==========================================
// 📊 LOGLAR VE GEÇMİŞ (HISTORY) TİPLERİ
// ==========================================

export interface PassLog {
  id: string;
  userName: string;
  type: 'ENTRY' | 'EXIT' | string;
  timestamp: string;
  gateName: string;
  createdAt?: string;
  date?: string;
  message?: string;
}

export interface AlertsHistoryProps {
  logs: PassLog[];
  onSelectUser?: (userName: string) => void;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
}

export interface ViolationLog {
  id?: string;
  userId?: string;
  userName?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
  type: 'BLOCKED_USER_VIOLATION' | 'BLOCKED_USER_LOGIN_ATTEMPT' | 'BLOCKED_USER_ATTEMPT' | 'UNAUTHORIZED_DEVICE_ATTEMPT' | 'ANTI_PASSBACK_VIOLATION' | string;
  message?: string;
  description?: string; // 🚀 Backend description uyumu için eklendi
  deviceId?: string | null;
  ipAddress?: string | null;
  timestamp?: string;
  createdAt?: string | Date;
  date?: string;
}

export interface ViolationLogsHistoryProps {
  logs: ViolationLog[];
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
}

// ==========================================
// 🧩 ORTAK BİLEŞENLER (SHARED) TİPLERİ
// ==========================================

export interface GateStatus {
  id: string;
  name: string;
  location: string;
  isLocked: boolean;
  statusText: 'CLOSED' | 'OPEN' | 'EMERGENCY_OPEN';
  lastActivity: string;
}

export interface ListManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: (string | CompanyItem)[];
  titles: string[];
  onUpdateCompanies: (newList: any[]) => void;
  onUpdateTitles: (newList: string[]) => void;
  initialTab?: 'companies' | 'titles';
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBgColor?: string;
  textColor?: string;
}

export interface InfoTooltipProps {
  text: string;
}

export interface ToastNotification {
  id?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// ==========================================
// 👥 KULLANICI YÖNETİMİ (USERS) TİPLERİ
// ==========================================

export type LocationStatus = 'INSIDE' | 'OUTSIDE';

export interface UserItem {
  id: string;
  name: string;
  email?: string;
  role?: string;
  company?: any;
  deviceUUID?: string;
  deviceId?: string; // 🚀 Mobil cihaz kimliği uyumu için eklendi
  employeeId?: string;
  profilePicture?: string;
  status?: LocationStatus;
  lastPass?: string;
  isBlocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExtendedUserItem extends UserItem {
  lastPassRaw?: string | Date | null;
}

export interface UserTableProps {
  users: UserItem[];
  onSelectUser?: (user: UserItem) => void;
  onUsersChange?: (users: UserItem[]) => void;
}

export interface CompanyInfo {
  name: string;
  floor: string;
  doorNo: string;
}

export interface CompanyItem {
  name: string;
  floor?: string;
  doorNo?: string;
}

export interface CompanyGroupedViewProps {
  users: UserItem[];
  onDeleteUser?: (userId: string) => void;
  onEditUser?: (user: UserItem) => void;
  onUpdateUserCompany?: (oldCompany: string, newCompany: string) => void;
  onDeleteCompany?: (companyName: string) => void;
}

export interface EditUserModalProps {
  isOpen: boolean;
  user: UserItem | null;
  onClose: () => void;
  onSave: (updatedUser: UserItem) => void;
}

export interface PassHistoryItem {
  time: string;
  direction: 'ENTRY' | 'EXIT';
  status: string;
}

export interface UserDetail {
  id: string;
  name: string;
  role: string;
  status: 'INSIDE' | 'OUTSIDE';
  deviceUUID?: string;
  deviceId?: string; // 🚀 Mobil cihaz kimliği uyumu için eklendi
  employeeId?: string;
  profilePicture?: string;
  totalPasses: number;
  violationCount: number;
  lastLocation: string;
  history: PassHistoryItem[];
}

export interface UserDetailModalProps {
  user: UserDetail | null;
  onClose: () => void;
}

export interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUser: (user: UserItem) => void;
}

// ==========================================
// ⚙️ AYARLAR VE SAYFA GÖRÜNÜMLERİ (SETTINGS & VIEWS)
// ==========================================

export interface AdminProfile {
  name?: string;
  email?: string;
  title?: string;
  phone?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  role?: string;
  avatar?: string;
  [key: string]: any;
}

export interface SecuritySettings {
  antiPassbackTimeout?: number;
  maxFrequencyAttempts?: number;
  autoBlockViolations?: boolean;
  emailAlerts?: boolean;
  qrExpirySeconds?: number;
  maxQrGenerationCount?: number;
  qrLimitWindowMinutes?: number;
  qrCooldownMinutes?: number;
  twoFactorEnabled?: boolean;
  passwordLastChanged?: string;
  sessionTimeout?: number;
  [key: string]: any;
}

export interface SystemSettings {
  maintenanceMode?: boolean;
  autoBackup?: boolean;
  maxUsers?: number;
  [key: string]: any;
}

export interface SettingsPageProps {
  onRefreshData?: () => void;
}

export interface UsersPageProps {
  users: UserItem[];
  onSelectUser?: (user: UserItem) => void;
  onToggleStatus?: (userId: string) => void;
  onToggleBlock?: (userId: string) => void;
  onDeleteUser?: (userId: string) => void;
  onEditUser?: (user: UserItem) => void;
  onAddUser?: () => void;
}

// ==========================================
// 🧭 MENÜ VE YERLEŞİM (LAYOUT/SIDEBAR) TİPLERİ
// ==========================================

export type TabType = 
  | 'MONITOR' 
  | 'USERS' 
  | 'COMPANIES' 
  | 'PASS_LOGS' 
  | 'VIOLATIONS' 
  | 'GATES' 
  | 'SETTINGS';

export interface SidebarProps {
  activeTab?: TabType;
  setActiveTab?: (tab: TabType) => void;
}