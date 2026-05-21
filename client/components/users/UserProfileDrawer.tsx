"use client";

import React from "react";
import { Edit3, Mail, Phone, ShieldCheck, UserRound, X } from "lucide-react";
import { ManagedUser } from "@/data/usersData";
import StatusBadge from "./StatusBadge";

interface UserProfileDrawerProps {
  user: ManagedUser | null;
  onClose: () => void;
  onEdit: (user: ManagedUser) => void;
}

export default function UserProfileDrawer({ user, onClose, onEdit }: UserProfileDrawerProps) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-md animate-[slideIn_.22s_ease-out] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">User Profile</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Close drawer">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white shadow-lg shadow-blue-500/20">
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${user.avatarColor} text-xl font-bold ring-4 ring-white/20`}>
                {user.fullName.split(" ").map((name) => name[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-xl font-bold">{user.fullName}</h3>
                <p className="text-sm text-blue-100">{user.employeeId}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <InfoRow icon={UserRound} label="Department" value={user.department} />
            <InfoRow icon={ShieldCheck} label="Role" value={user.role} />
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow icon={Phone} label="Phone" value={user.phone} />
          </div>

          <section className="mt-5 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Account Status</h3>
              <StatusBadge status={user.status} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Last login: {user.lastLogin}</p>
          </section>

          <section className="mt-5 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white">Permissions</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {user.permissions.map((permission) => (
                <span key={permission} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                  {permission}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white">Recent Activity</h3>
            <div className="mt-3 space-y-3">
              {user.recentActivity.map((activity, index) => (
                <div key={activity} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{activity}</p>
                    <p className="text-xs text-gray-400">{index + 1} day{index === 0 ? "" : "s"} ago</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-gray-100 p-5 dark:border-gray-800">
          <button onClick={() => onEdit(user)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700">
            <Edit3 size={16} />
            Edit User
          </button>
        </div>
      </aside>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="rounded-xl bg-gray-50 p-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
