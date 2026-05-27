"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";

const reasonMessages: Record<string, string> = {
  ACCESS_DENIED: "Your Google account is not linked to an active user in this system.",
};

export default function UnauthorizedPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") || "ACCESS_DENIED";
  const message = reasonMessages[reason] || "You do not have permission to access this application.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <ShieldAlert size={28} />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{message}</p>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Ask an admin to add your email as an active user, then sign in again.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-700"
          >
            Back to login
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
