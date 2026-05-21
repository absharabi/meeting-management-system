import React from "react";
import { UserStatus } from "@/data/usersData";

interface StatusBadgeProps {
  status: UserStatus | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles =
    status === "Active"
      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
      : status === "Inactive"
        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800";

  const dot =
    status === "Active"
      ? "bg-green-500"
      : status === "Inactive"
        ? "bg-red-500"
        : "bg-amber-500";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}
