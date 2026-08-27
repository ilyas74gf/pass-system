import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'USER' | 'SECURITY';
  company?: string;
  employeeId?: string; // Sicil No
  profilePicture?: string; // Profil Fotoğrafı (Base64 veya URL)
  isBlocked: boolean;
  deviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'USER', 'SECURITY'], default: 'USER' },
    company: { type: String, default: 'Genel' },
    employeeId: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    isBlocked: { type: Boolean, default: false },
    deviceId: { type: String, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ employeeId: 1 });

export const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
export default User;