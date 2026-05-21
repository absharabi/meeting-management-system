import React from "react";
import { LucideIcon } from "lucide-react";

interface UserStatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  color: string;
}

const colorClasses: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  green: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  red: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function UserStatCard({ title, value, description, icon: Icon, color }: UserStatCardProps) {
  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</h3>
        </div>
        <div className={`rounded-2xl p-3 shadow-sm transition-transform duration-200 group-hover:scale-105 ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}
