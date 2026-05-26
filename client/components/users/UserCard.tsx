import React from "react";
import { Edit3, Eye, MoreHorizontal, Power, Trash2 } from "lucide-react";
import { ManagedUser } from "@/data/usersData";
import StatusBadge from "./StatusBadge";

interface UserCardProps {
  user: ManagedUser;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onView: (user: ManagedUser) => void;
  onEdit: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
  onNotify: (message: string, type?: "success" | "error") => void;
}

export default function UserCard({
  user,
  isSelected,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onNotify,
}: UserCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(user.id)}
            aria-label={`Select ${user.fullName}`}
            className="mt-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
          />
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${user.avatarColor} text-sm font-bold text-white shadow-md`}>
            {user.fullName.split(" ").map((name) => name[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">{user.fullName}</h3>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <div className="mt-2">
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>
        <button
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title="More actions"
          onClick={() => onNotify("More actions are available from the desktop table.")}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Employee ID</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{user.employeeId}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Role</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{user.role}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Department</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{user.department}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Last Login</p>
          <p className="font-medium text-gray-800 dark:text-gray-200">{user.lastLogin}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <button title="View" onClick={() => onView(user)} className="rounded-xl bg-blue-50 p-2 text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40">
          <Eye size={17} className="mx-auto" />
        </button>
        <button title="Edit" onClick={() => onEdit(user)} className="rounded-xl bg-gray-50 p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
          <Edit3 size={17} className="mx-auto" />
        </button>
        <button title="Activate or deactivate" onClick={() => onNotify(`${user.fullName} status queued for update.`)} className="rounded-xl bg-green-50 p-2 text-green-600 transition-colors hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40">
          <Power size={17} className="mx-auto" />
        </button>
        <button title="Delete" onClick={() => onDelete(user)} className="rounded-xl bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40">
          <Trash2 size={17} className="mx-auto" />
        </button>
      </div>
    </article>
  );
}
