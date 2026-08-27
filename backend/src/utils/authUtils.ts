import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_JWT_KEY_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export interface TokenPayload {
  userId: string | number;
  role: string;
  deviceUuid?: string;
  [key: string]: any;
}

export class AuthUtils {
  /**
   *  Şifreyi bcrypt ile hash'ler.
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   *  Düz metin şifre ile hash'lenmiş şifreyi karşılaştırır.
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   *  Kullanıcı bilgileriyle JWT Token üretir.
   */
  static generateToken(payload: TokenPayload): string {
    const options: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
    };
    return jwt.sign(payload, JWT_SECRET, options);
  }

  /**
   *  JWT Token'ı doğrular ve çözer. Geçersizse null döner.
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      return null;
    }
  }
}

export default AuthUtils;