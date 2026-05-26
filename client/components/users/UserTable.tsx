"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  MoreHorizontal,
  Power,
  Trash2,
  UserX,
} from "lucide-react";
import { ManagedUser } from "@/data/usersData";
import StatusBadge from "./StatusBadge";
import UserCard from "./UserCard";

interface UserTableProps {
  users: ManagedUser[];
  selectedIds: string[];
  page: number;
  rowsPerPage: number;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onView: (user: ManagedUser) => void;
  onEdit: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
  onNotify: (message: string, type?: "success" | "error") => void;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}

export default function UserTable({
  users,
  selectedIds,
  page,
  rowsPerPage,
  isLoading,
  onSelect,
  onSelectAll,
  onView,
  onEdit,
  onDelete,
  onNotify,
  onPageChange,
  onRowsPerPageChange,
}: UserTableProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(users.length / rowsPerPage));
  const startIndex = (page - 1) * rowsPerPage;
  const visibleUsers = users.slice(startIndex, startIndex + rowsPerPage);
  const allVisibleSelected = visibleUsers.length > 0 && visibleUsers.every((user) => selectedIds.includes(user.id));

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Users</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage user access, roles, status, and permissions.</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {users.length} records
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/80 dark:text-gray-400">
            <tr>
              <th className="px-5 py-4">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={onSelectAll}
                  aria-label="Select visible users"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                />
              </th>
              <th className="px-5 py-4">Profile</th>
              <th className="px-5 py-4">Full Name</th>
              <th className="px-5 py-4">Employee ID</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Department</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Last Login</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading ? (
              Array.from({ length: rowsPerPage }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  {Array.from({ length: 10 }).map((__, cellIndex) => (
                    <td key={cellIndex} className="px-5 py-4">
                      <div className="h-4 rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              visibleUsers.map((user) => (
                <tr key={user.id} className="bg-white transition-colors hover:bg-blue-50/40 dark:bg-gray-900 dark:hover:bg-gray-800/70">
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => onSelect(user.id)}
                      aria-label={`Select ${user.fullName}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${user.avatarColor} text-xs font-bold text-white shadow-md`}>
                      {user.fullName.split(" ").map((name) => name[0]).join("").slice(0, 2)}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{user.fullName}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">{user.employeeId}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">{user.email}</td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{user.department}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{user.role}</span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">{user.lastLogin}</td>
                  <td className="relative px-5 py-4 text-right">
                    <button
                      onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                      className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      aria-haspopup="menu"
                      aria-expanded={openMenu === user.id}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {openMenu === user.id && (
                      <div className="absolute right-5 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        <MenuButton icon={Eye} label="View" onClick={() => { setOpenMenu(null); onView(user); }} />
                        <MenuButton icon={Edit3} label="Edit" onClick={() => { setOpenMenu(null); onEdit(user); }} />
                        <MenuButton icon={Power} label={user.status === "Active" ? "Deactivate" : "Activate"} onClick={() => { setOpenMenu(null); onNotify(`${user.fullName} status queued for update.`); }} />
                        <MenuButton danger icon={Trash2} label="Delete" onClick={() => { setOpenMenu(null); onDelete(user); }} />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 p-4 lg:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)
        ) : visibleUsers.length === 0 ? (
          <EmptyState />
        ) : (
          visibleUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isSelected={selectedIds.includes(user.id)}
              onSelect={onSelect}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              onNotify={onNotify}
            />
          ))
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-100 p-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(event) => onRowsPerPageChange(Number(event.target.value))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {[5, 10, 20].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2 md:justify-end">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: pageCount }).map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  onClick={() => onPageChange(pageNumber)}
                  className={`h-9 w-9 rounded-xl text-sm font-semibold transition-colors ${
                    page === pageNumber
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page === pageCount}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full bg-gray-50 p-4 text-gray-400 dark:bg-gray-800">
        <UserX size={30} />
      </div>
      <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">No users found</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or reset the filters to view all users.</p>
    </div>
  );
}
