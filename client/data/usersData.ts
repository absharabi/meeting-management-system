import {
  BarChart3,
  Clock,
  MailQuestion,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

export type UserStatus = "Active" | "Inactive" | "Pending";
export type PermissionModule =
  | "Meetings"
  | "Reports"
  | "User Management"
  | "Audit Logs"
  | "Settings";

export interface ManagedUser {
  id: string;
  fullName: string;
  username: string;
  employeeId: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  status: UserStatus;
  lastLogin: string;
  avatarColor: string;
  permissions: PermissionModule[];
  recentActivity: string[];
}

export interface ImportPreviewRow {
  row: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export const departments = [
  "All Departments",
  "Computer Science",
  "Administration",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Finance",
  "Library",
];

export const roles = [
  "All Roles",
  "Admin",
  "User",
  "Reviewer",
];

export const statuses = ["All Statuses", "Active", "Inactive", "Pending"];

export const permissionModules: PermissionModule[] = [
  "Meetings",
  "Reports",
  "User Management",
  "Audit Logs",
  "Settings",
];

export const roleDefaultPermissions: Record<string, PermissionModule[]> = {
  Admin: ["Meetings", "Reports", "User Management", "Audit Logs", "Settings"],
  Reviewer: ["Meetings", "Reports", "Audit Logs"],
  User: ["Meetings"],
};

export const users: ManagedUser[] = [];

export const userStats = [
  {
    title: "Total Users",
    value: users.length,
    description: "Ready for uploaded records",
    icon: Users,
    color: "blue",
  },
  {
    title: "Active Users",
    value: users.filter((user) => user.status === "Active").length,
    description: "Currently enabled accounts",
    icon: UserCheck,
    color: "green",
  },
  {
    title: "Inactive Users",
    value: users.filter((user) => user.status === "Inactive").length,
    description: "Access temporarily disabled",
    icon: UserX,
    color: "red",
  },
  {
    title: "Pending Invitations",
    value: users.filter((user) => user.status === "Pending").length,
    description: "Awaiting first login",
    icon: MailQuestion,
    color: "amber",
  },
];

export const importPreview: ImportPreviewRow[] = [];

export const activitySummary = [
  { label: "Access reviews due", value: "6", icon: Clock },
  { label: "Permission changes", value: "18", icon: BarChart3 },
];
