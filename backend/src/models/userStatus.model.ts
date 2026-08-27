import mongoose, { Schema, Document } from 'mongoose';

// Durum Tipleri (Enum)
export enum UserPassStatus {
  INSIDE = 'INSIDE',
  OUTSIDE = 'OUTSIDE',
}

// Mongoose Arayüzü (Interface)
export interface IUserStatus extends Document {
  userId: string;
  current_status: UserPassStatus;
  lastStatusChangeAt: Date;
  lastPassDirection?: 'ENTRY' | 'EXIT' | null;
}

// Veritabanı Şeması
const userStatusSchema = new Schema<IUserStatus>(
  {
    userId: { type: String, required: true, unique: true }, // unique: true otomatik olarak indeksi oluşturur

    current_status: { 
      type: String, 
      enum: Object.values(UserPassStatus), 
      default: UserPassStatus.OUTSIDE, // Varsayılan durum: DIŞARIDA
    },
    lastStatusChangeAt: { 
      type: Date, 
      default: Date.now 
    },
    lastPassDirection: { 
      type: String, 
      enum: ['ENTRY', 'EXIT', null], 
      default: null 
    },
  },
  {
    timestamps: true, // createdAt ve updatedAt alanlarını otomatik yönetir
  }
);

export const UserStatusModel =
  mongoose.models.UserStatus ||
  mongoose.model<IUserStatus>('UserStatus', userStatusSchema);

export default UserStatusModel;