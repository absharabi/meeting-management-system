import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  type: string;
  message: string;
  isRead: boolean;
  relatedMeeting?: mongoose.Types.ObjectId;
  actionUrl?: string;
  isClearedFromDropdown: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  isClearedFromDropdown: { type: Boolean, default: false },
  relatedMeeting: { type: Schema.Types.ObjectId, ref: 'Meeting' },
  actionUrl: { type: String }
}, {
  timestamps: true
});

export default mongoose.model<INotification>('Notification', NotificationSchema);
