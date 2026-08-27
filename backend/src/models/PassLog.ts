import mongoose, { Schema, Document } from 'mongoose';

export interface IPassLogDocument extends Document {
  userId: string;
  status: 'SUCCESS' | 'FAILED';
  direction?: 'ENTRY' | 'EXIT';
  message?: string;
  clientIp?: string;
  createdAt: Date;
}

const passLogSchema = new Schema<IPassLogDocument>(
  {
    userId: { 
      type: String, 
      required: true,
      trim: true,
    },
    status: { 
      type: String, 
      enum: ['SUCCESS', 'FAILED'], 
      required: true 
    },
    direction: { 
      type: String, 
      enum: ['ENTRY', 'EXIT'],
      default: 'ENTRY'
    },
    message: { 
      type: String,
      trim: true 
    },
    clientIp: { 
      type: String 
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

//  Performans İçin İndeksler (Sorgu Hızlandırma)
passLogSchema.index({ userId: 1, createdAt: -1 }); 
passLogSchema.index({ createdAt: -1 });            
passLogSchema.index({ status: 1 });                 

export const PassLog =
  mongoose.models.PassLog ||
  mongoose.model<IPassLogDocument>('PassLog', passLogSchema);

export default PassLog;