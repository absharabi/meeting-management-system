import mongoose, { Document, Schema } from 'mongoose';

export enum Role {
  SuperAdmin  = 'SuperAdmin',
  Admin       = 'Admin',
  Organizer   = 'Organizer',
  Participant = 'Participant',
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
  createdAt:  Date;
  updatedAt:  Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId:   { type: String, sparse: true },
    name:       { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    avatar:     { type: String },
    role:       { type: String, enum: Object.values(Role), default: Role.Participant },
    department: { type: String, default: '' },
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);