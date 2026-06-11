"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import BulkUploadModal from "@/components/users/BulkUploadModal";
import FilterBar from "@/components/users/FilterBar";
import UserModal, { UserFormValues } from "@/components/users/UserModal";
import UserProfileDrawer from "@/components/users/UserProfileDrawer";
import UserStatCard from "@/components/users/UserStatCard";
import UserTable from "@/components/users/UserTable";
import { departments, ManagedUser, roles, statuses } from "@/data/usersData";
import { Download, MailQuestion, Plus, Trash2, Upload, UserCheck, UserCog, UserX, Users, X } from "lucide-react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";

interface ToastState {
  message: string;
  type: "success" | "error";
}

interface BackendUser {
  _id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  employeeId?: string;
  role: string;
  department?: string;
  isActive?: boolean;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
}

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users`;
const avatarColors = [
  "from-blue-600 to-cyan-500",
  "from-indigo-600 to-blue-500",
  "from-emerald-600 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-600 to-pink-500",
];

const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const mapUser = (user: BackendUser, index = 0): ManagedUser => ({
  id: user._id,
  fullName: user.name,
  username: user.username || user.email.split("@")[0],
  employeeId: user.employeeId || `USR-${user._id.slice(-6).toUpperCase()}`,
  email: user.email,
  phone: user.phone || "",
  department: user.department || "Administration",
  role: user.role,
  status: user.isActive === false ? "Inactive" : "Active",
  lastLogin: "Google sign-in",
  avatarColor: avatarColors[index % avatarColors.length],
  permissions: (user.permissions?.length ? user.permissions : ["Meetings"]) as ManagedUser["permissions"],
  recentActivity: [`Created ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "in the system"}`],
});

const buildPayload = (values: UserFormValues) => ({
  name: values.fullName.trim(),
  username: values.username.trim(),
  email: values.email.trim().toLowerCase(),
  phone: values.phone.trim(),
  employeeId: values.employeeId.trim(),
  role: values.role,
  department: values.department,
  isActive: values.status === "Active",
  permissions: values.permissions,
});

export default function UsersPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [role, setRole] = useState("All Roles");
  const [status, setStatus] = useState("All Statuses");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [drawerUser, setDrawerUser] = useState<ManagedUser | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("User");

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const userRole = parsed.role || 'User';
        setCurrentUserRole(userRole);
        
        if (userRole !== 'SuperAdmin' && userRole !== 'Admin') {
          router.replace('/unauthorized?reason=ACCESS_DENIED');
        }
      } else {
        router.replace('/login');
      }
    } catch (e) {
      console.error(e);
      router.replace('/login');
    }
  }, [router]);

  const notify = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(API_BASE, { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load users.");
      setUsers(data.map((user: BackendUser, index: number) => mapUser(user, index)));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to load users.", "error");
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.employeeId.toLowerCase().includes(query);
      const matchesDepartment = department === "All Departments" || user.department === department;
      const matchesRole = role === "All Roles" || user.role === role;
      const matchesStatus = status === "All Statuses" || user.status === status;
      return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
    });
  }, [department, role, searchQuery, status, users]);

  const dynamicStats = useMemo(() => [
    {
      title: "Total Users",
      value: users.length,
      description: "Created accounts in MongoDB",
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
  ], [users]);

  const saveUser = async (values: UserFormValues) => {
    const isEditing = Boolean(editingUser);
    const url = isEditing ? `${API_BASE}/${editingUser?.id}` : API_BASE;
    const response = await fetch(url, {
      method: isEditing ? "PUT" : "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(buildPayload(values)),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.message || "Unable to save user.", "error");
      return;
    }

    const mapped = mapUser(data, users.length);
    setUsers((current) => (
      isEditing
        ? current.map((user) => (user.id === mapped.id ? mapped : user))
        : [mapped, ...current]
    ));
    setIsUserModalOpen(false);
    setEditingUser(null);
    notify(isEditing ? `${mapped.fullName} updated successfully.` : `${mapped.fullName} created successfully.`);
  };

  const completeBulkUpload = (message: string, type: "success" | "error" = "success") => {
    notify(message, type);
    if (type === "success" && message.startsWith("Bulk upload complete")) loadUsers();
  };

  const exportUsers = () => {
    const exportRows = filteredUsers.map((user) => ({
      Name: user.fullName,
      Email: user.email,
      Role: user.role,
      Username: user.username,
      Phone: user.phone,
      "Employee ID": user.employeeId,
      Department: user.department,
      Status: user.status,
      Permissions: user.permissions.join(", "),
      "Last Login": user.lastLogin,
    }));

    if (exportRows.length === 0) {
      notify("No users available to export.", "error");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 30 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 },
      { wch: 14 },
      { wch: 42 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, `users-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify(`Exported ${exportRows.length} user${exportRows.length === 1 ? "" : "s"}.`);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setDepartment("All Departments");
    setRole("All Roles");
    setStatus("All Statuses");
    setPage(1);
    notify("Filters reset.");
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleAllVisible = () => {
    const startIndex = (page - 1) * rowsPerPage;
    const visibleIds = filteredUsers.slice(startIndex, startIndex + rowsPerPage).map((user) => user.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => (allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))));
  };

  const openAddUser = () => {
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const openEditUser = (user: ManagedUser) => {
    setEditingUser(user);
    setDrawerUser(null);
    setIsUserModalOpen(true);
  };

  const confirmDelete = (user: ManagedUser) => {
    if (window.confirm(`Delete ${user.fullName}? This action cannot be undone.`)) {
      deleteUser(user);
    }
  };

  const deleteUser = async (user: ManagedUser) => {
    try {
      const response = await fetch(`${API_BASE}/${user.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete user.");
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setSelectedIds((current) => current.filter((id) => id !== user.id));
      notify(`${user.fullName} deleted.`, "error");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete user.", "error");
    }
  };

  const runBulkAction = (label: string) => {
    notify(`${label} applied to ${selectedIds.length} selected user${selectedIds.length === 1 ? "" : "s"}.`);
    if (label === "Delete Selected") setSelectedIds([]);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} userRole={currentUserRole} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 p-4 dark:bg-gray-950/50 md:p-8">
          <div className="mx-auto max-w-7xl space-y-6 pb-24">
            <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 shadow-lg shadow-blue-500/10 md:p-8">
              <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white opacity-10 blur-3xl" />
              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">User Management</h1>
                  <p className="mt-2 max-w-2xl text-sm text-blue-100 md:text-base">Manage users, departments, permissions, and access control.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <HeaderButton icon={Plus} label="Add User" onClick={openAddUser} primary />
                  <HeaderButton icon={Upload} label="Bulk Upload" onClick={() => setIsBulkUploadOpen(true)} />
                  <HeaderButton icon={Download} label="Export Users" onClick={exportUsers} />
                </div>
              </div>
            </header>

            <FilterBar
              search={searchQuery}
              department={department}
              role={role}
              status={status}
              departments={departments}
              roles={roles}
              statuses={statuses}
              onSearchChange={(value) => {
                setSearchQuery(value);
                setPage(1);
              }}
              onDepartmentChange={(value) => {
                setDepartment(value);
                setPage(1);
              }}
              onRoleChange={(value) => {
                setRole(value);
                setPage(1);
              }}
              onStatusChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              onReset={resetFilters}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {dynamicStats.map((stat) => (
                <UserStatCard key={stat.title} {...stat} />
              ))}
            </div>

            <UserTable
              users={filteredUsers}
              selectedIds={selectedIds}
              page={page}
              rowsPerPage={rowsPerPage}
              isLoading={isLoading}
              onSelect={toggleSelected}
              onSelectAll={toggleAllVisible}
              onView={setDrawerUser}
              onEdit={openEditUser}
              onDelete={confirmDelete}
              onNotify={notify}
              onPageChange={setPage}
              onRowsPerPageChange={(value) => {
                setRowsPerPage(value);
                setPage(1);
              }}
            />
          </div>
        </main>
      </div>

      <BulkActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} onAction={runBulkAction} />
      <UserModal isOpen={isUserModalOpen} user={editingUser} onClose={() => setIsUserModalOpen(false)} onSave={saveUser} />
      <BulkUploadModal isOpen={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} onComplete={completeBulkUpload} />
      <UserProfileDrawer user={drawerUser} onClose={() => setDrawerUser(null)} onEdit={openEditUser} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function HeaderButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
        primary
          ? "bg-white text-blue-700 shadow-md hover:bg-blue-50"
          : "border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20"
      }`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}

function BulkActionBar({
  selectedCount,
  onClear,
  onAction,
}: {
  selectedCount: number;
  onClear: () => void;
  onAction: (label: string) => void;
}) {
  if (selectedCount === 0) return null;

  const actions = [
    { label: "Activate Selected", icon: UserCheck },
    { label: "Deactivate Selected", icon: UserX },
    { label: "Assign Department", icon: UserCog },
    { label: "Delete Selected", icon: Trash2, danger: true },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 rounded-2xl border border-blue-200 bg-white/95 p-3 shadow-2xl shadow-blue-900/10 backdrop-blur transition-all dark:border-blue-900/50 dark:bg-gray-900/95">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{selectedCount} selected</span>
          <button onClick={onClear} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Clear selection">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onAction(action.label)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  action.danger
                    ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <Icon size={16} />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className={`fixed right-4 top-20 z-[90] max-w-sm rounded-2xl border p-4 shadow-xl ${
      type === "success"
        ? "border-green-200 bg-white text-green-700 dark:border-green-800 dark:bg-gray-900 dark:text-green-400"
        : "border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-gray-900 dark:text-red-400"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-1 h-2 w-2 rounded-full ${type === "success" ? "bg-green-500" : "bg-red-500"}`} />
        <p className="text-sm font-semibold">{message}</p>
        <button onClick={onClose} className="ml-2 rounded p-1 opacity-70 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Dismiss notification">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
