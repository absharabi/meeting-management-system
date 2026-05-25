import mongoose, { Document, Schema } from 'mongoose';

export enum Role {
  SuperAdmin  = 'SuperAdmin',
  Admin       = 'Admin',
  User        = 'User',
  Reviewer    = 'Reviewer',
}

export interface IUser extends Document {
  googleId?:  string;
  name:       string;
  email:      string;
  avatar?:    string;
  role:       Role;
  department: string;
  isActive:   boolean;
  notificationPreferences: {
    enabled: boolean;
    meetingUpdates: boolean;
    reminders: boolean;
    agendaUpdates: boolean;
  };
  mutedMeetings: mongoose.Types.ObjectId[];
  createdAt:  Date;
  updatedAt:  Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId:   { type: String, sparse: true },
    name:       { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    avatar:     { type: String },
    role:       { type: String, enum: Object.values(Role), default: Role.User },
    department: { type: String, default: '' },
    isActive:   { type: Boolean, default: true },
    notificationPreferences: {
      enabled: { type: Boolean, default: true },
      meetingUpdates: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true },
      agendaUpdates: { type: Boolean, default: true }
    },
    mutedMeetings: [{ type: Schema.Types.ObjectId, ref: 'Meeting' }]
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);