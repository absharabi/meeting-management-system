"use client";

import { MomAgendaItem } from "./types";

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

export default function SummaryTable({ items }: { items: MomAgendaItem[] }) {
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 p-4 dark:border-gray-800">
        <h2 className="font-bold text-gray-900 dark:text-white">Agenda to Action Summary</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Live tracker generated from MoM agenda items.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3">Sl. No.</th>
              <th className="px-4 py-3">Agenda No.</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Decision</th>
              <th className="px-4 py-3">Action Required</th>
              <th className="px-4 py-3">Responsible Person</th>
              <th className="px-4 py-3">Target Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sortedItems.map((item, index) => (
              <tr key={item._id || `${item.itemNumber}-${index}`}>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{index + 1}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.itemNumber || "-"}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.subject || "-"}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{stripHtml(item.decision) || "-"}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.actionRequired || "-"}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.responsiblePerson || "-"}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.targetDate ? new Date(item.targetDate).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No agenda items added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
