import mongoose, { Document, Schema } from 'mongoose';

export enum Role {
  SuperAdmin  = 'SuperAdmin',
  Admin       = 'Admin',
  User        = 'User',
  Reviewer    = 'Reviewer',
}

export const permissionModules = ['Meetings', 'Reports', 'User Management', 'Audit Logs', 'Settings'];

export const roleDefaultPermissions: Record<Role, string[]> = {
  [Role.SuperAdmin]: permissionModules,
  [Role.Admin]: ['Meetings', 'Reports', 'User Management', 'Audit Logs', 'Settings'],
  [Role.Reviewer]: ['Meetings', 'Reports', 'Audit Logs'],
  [Role.User]: ['Meetings'],
};

export const getDefaultPermissionsForRole = (role: Role): string[] => roleDefaultPermissions[role] || roleDefaultPermissions[Role.User];

export interface IUser extends Document {
  googleId?:  string;
  name:       string;
  username?:  string;
  email:      string;
  phone?:     string;
  employeeId?: string;
  avatar?:    string;
  role:       Role;
  department: string;
  permissions: string[];
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
    username:   { type: String, trim: true, default: '' },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:      { type: String, trim: true, default: '' },
    employeeId: { type: String, trim: true, default: '' },
    avatar:     { type: String },
    role:       { type: String, enum: Object.values(Role), default: Role.User },
    department: { type: String, default: '' },
    permissions: { type: [String], default: undefined },
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

UserSchema.pre('validate', function (next: any) {
  if (this.isNew && (!this.permissions || this.permissions.length === 0)) {
    this.permissions = getDefaultPermissionsForRole(this.role);
  }
  if (typeof next === 'function') next();
});

export default mongoose.model<IUser>('User', UserSchema);
