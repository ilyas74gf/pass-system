import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_JWT_KEY_2026';

export interface JwtPayload {
 id?: string;
 userId?: string;
 sub?: string;
 _id?: string;
 email?: string;
 role: string;
 [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
 user?: JwtPayload;
}

export const authenticateToken = (
 req: AuthenticatedRequest,
 res: Response,
 next: NextFunction
): void => {
 const authHeader = req.headers.authorization;

 if (!authHeader || !authHeader.startsWith('Bearer ')) {
  res.status(401).json({
  success: false,
   message: "Erişim reddedildi. Yetkilendirme token'ı (Bearer Token) bulunamadı.",
  });
  return;
 }

 const token = authHeader.split(' ')[1];

 try {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

  //  Olası tüm ID anahtarlarını tara (id, userId, sub, _id, user.id)
 const actualId =
 decoded.id ||
 decoded.userId ||
 decoded.sub ||
 decoded._id ||
 decoded.user?.id;

 if (actualId) {
 decoded.id = String(actualId);
 decoded.userId = String(actualId);
 }

 req.user = decoded;
 next();
 } catch (error) {
 res.status(401).json({
 success: false,
message: 'Geçersiz veya süresi dolmuş token.',
 });
 }
};

export const requireRole = (...allowedRoles: string[]) => {
 return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
 if (!req.user) {
 res.status(401).json({
 success: false,
 message: 'Erişim engellendi. Kimlik doğrulaması yapılmamış.',
 });
 return;
 }

 if (!allowedRoles.includes(req.user.role)) {
 res.status(403).json({
 success: false,
 message: 'Erişim engellendi. Bu işlem için yetkiniz yetersiz.',
 });
 return;
 }

 next();
 };
};

export const authenticateAdmin = (
 req: AuthenticatedRequest,
 res: Response,
 next: NextFunction
): void => {
 authenticateToken(req, res, () => {
 if (res.headersSent) return;
 requireRole('ADMIN')(req, res, next);
 });
};

export default {
 authenticateToken,
 requireRole,
 authenticateAdmin,
}; 