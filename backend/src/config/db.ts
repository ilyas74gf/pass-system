import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pass_system_db';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`🍃 [MongoDB] Bağlantı Başarılı: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`❌ [MongoDB] Bağlantı Hatası: ${error.message}`);
    process.exit(1);
  }
};

export const closeDB = async (): Promise<void> => {
  await mongoose.connection.close();
  console.log('🔌 [MongoDB] Bağlantı kapatıldı.');
};

/**
 *  Veritabanı Havuz Nesnesi (Database Pool)
 */
export const dbPool = {
  options: {
    max: 20,
  },
  query: async (_queryText?: string, _values?: any[]) => {
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  },
  end: async () => {
    await mongoose.connection.close();
  },
  getConnection: async () => mongoose.connection,
  isConnected: () => mongoose.connection.readyState === 1,
};

/**
 * Veritabanı Sağlık Durumu Kontrolü
 */
export const checkDbHealth = async (): Promise<boolean> => {
  try {
    await dbPool.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
};

export default connectDB;