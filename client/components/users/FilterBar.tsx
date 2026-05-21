import React from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

interface FilterBarProps {
  search: string;
  department: string;
  role: string;
  status: string;
  departments: string[];
  roles: string[];
  statuses: string[];
  onSearchChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

const selectClass =
  "h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:border-blue-400";

export default function FilterBar({
  search,
  department,
  role,
  status,
  departments,
  roles,
  statuses,
  onSearchChange,
  onDepartmentChange,
  onRoleChange,
  onStatusChange,
  onReset,
}: FilterBarProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <SlidersHorizontal size={17} />
        </div>
        Search & Filters
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.7fr_1fr_1fr_1fr_auto]">
        <label className="relative">
          <span className="sr-only">Search users</span>
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name, email, employee ID..."
            className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400"
          />
        </label>

        <select value={department} onChange={(event) => onDepartmentChange(event.target.value)} className={selectClass} aria-label="Filter by department">
          {departments.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select value={role} onChange={(event) => onRoleChange(event.target.value)} className={selectClass} aria-label="Filter by role">
          {roles.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select value={status} onChange={(event) => onStatusChange(event.target.value)} className={selectClass} aria-label="Filter by status">
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-900/20"
        >
          <RotateCcw size={16} />
          Reset
        </button>
      </div>
    </section>
  );
}
