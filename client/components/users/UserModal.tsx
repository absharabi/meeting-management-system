"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Camera, Check, ShieldCheck, X } from "lucide-react";
import { departments, ManagedUser, PermissionModule, permissionModules, roles, UserStatus } from "@/data/usersData";

export interface UserFormValues {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  employeeId: string;
  department: string;
  role: string;
  status: UserStatus;
  permissions: PermissionModule[];
}

interface UserModalProps {
  isOpen: boolean;
  user?: ManagedUser | null;
  onClose: () => void;
  onSave: (values: UserFormValues) => Promise<void> | void;
}

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400";

const fieldDepartments = departments.filter((department) => department !== "All Departments");
const fieldRoles = roles.filter((role) => role !== "All Roles" && role !== "SuperAdmin");

export default function UserModal({ isOpen, user, onClose, onSave }: UserModalProps) {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    employeeId: "",
    department: fieldDepartments[0],
    role: "User",
    status: "Active" as UserStatus,
    permissions: [] as PermissionModule[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const title = user ? "Edit User" : "Add User";

  useEffect(() => {
    if (!isOpen) return;
    if (user) {
      setForm({
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        employeeId: user.employeeId,
        department: user.department,
        role: user.role,
        status: user.status,
        permissions: user.permissions,
      });
    } else {
      setForm({
        fullName: "",
        username: "",
        email: "",
        phone: "",
        employeeId: "",
        department: fieldDepartments[0],
        role: "User",
        status: "Active",
        permissions: ["Meetings"],
      });
    }
    setErrors({});
    setIsSaving(false);
  }, [isOpen, user]);

  const canSubmit = useMemo(() => {
    return Boolean(form.fullName.trim() && form.email.includes("@") && form.employeeId.trim() && form.role);
  }, [form]);

  if (!isOpen) return null;

  const update = (key: keyof typeof form, value: string | string[]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const togglePermission = (module: PermissionModule) => {
    update(
      "permissions",
      form.permissions.includes(module)
        ? form.permissions.filter((item) => item !== module)
        : [...form.permissions, module],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!form.email.includes("@")) nextErrors.email = "Enter a valid email address.";
    if (!form.employeeId.trim()) nextErrors.employeeId = "Employee ID is required.";
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      setIsSaving(true);
      try {
        await onSave(form);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex animate-[fadeIn_.2s_ease-out] items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Create Google-authenticated users, assign department roles, and configure permissions.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-81px)] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950/50">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-2xl font-bold text-white shadow-lg shadow-blue-500/20">
                  {form.fullName ? form.fullName.split(" ").map((name) => name[0]).join("").slice(0, 2) : "U"}
                </div>
                <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-900/20">
                  <Camera size={16} />
                  Upload Image
                </button>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">PNG or JPG up to 2MB.</p>
              </div>

              <div className="mt-6 rounded-2xl bg-white p-4 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Account Status</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enable platform access</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => update("status", form.status === "Active" ? "Inactive" : "Active")}
                    className={`relative h-7 w-12 rounded-full transition-colors ${form.status === "Active" ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
                    aria-pressed={form.status === "Active"}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.status === "Active" ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>
            </aside>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Full Name" error={errors.fullName}>
                  <input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} className={inputClass} placeholder="Full name" />
                </Field>
                <Field label="Username">
                  <input value={form.username} onChange={(event) => update("username", event.target.value)} className={inputClass} placeholder="username" />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} className={inputClass} placeholder="name@nitc.ac.in" />
                </Field>
                <Field label="Phone Number">
                  <input value={form.phone} onChange={(event) => update("phone", event.target.value)} className={inputClass} placeholder="+91 ..." />
                </Field>
                <Field label="Employee ID" error={errors.employeeId}>
                  <input value={form.employeeId} onChange={(event) => update("employeeId", event.target.value)} className={inputClass} placeholder="NITC-..." />
                </Field>
                <Field label="Department">
                  <select value={form.department} onChange={(event) => update("department", event.target.value)} className={inputClass}>
                    {fieldDepartments.map((department) => (
                      <option key={department}>{department}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Role">
                  <select value={form.role} onChange={(event) => update("role", event.target.value)} className={inputClass}>
                    {fieldRoles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Permissions</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Choose modules this user can access.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {permissionModules.map((module) => {
                    const checked = form.permissions.includes(module);
                    return (
                      <button
                        type="button"
                        key={module}
                        onClick={() => togglePermission(module)}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm font-semibold transition-all ${
                          checked
                            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-300 dark:hover:bg-gray-800"
                        }`}
                      >
                        {module}
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${checked ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 dark:border-gray-700"}`}>
                          {checked && <Check size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit || isSaving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {isSaving ? "Saving..." : "Save User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}
