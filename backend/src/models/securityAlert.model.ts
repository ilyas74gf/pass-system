import mongoose, { Schema, Document } from 'mongoose';

export interface ISecurityAlertDocument extends Document {
  type: string;
  severity: string;
  userId: string;
  message: string;
  details?: any;
  createdAt: Date;
}

const securityAlertSchema = new Schema<ISecurityAlertDocument>({
  type: { type: String, required: true },
  severity: { type: String, required: true },
  userId: { type: String, required: true },
  message: { type: String, required: true },
  details: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

export const SecurityAlert =
  mongoose.models.SecurityAlert ||
  mongoose.model<ISecurityAlertDocument>('SecurityAlert', securityAlertSchema);