"use client";

import { MomAgendaItem, MomBlock, MomBlockType } from "./types";

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
const hasText = (value: string) => stripHtml(String(value || "")).length > 0;

const blockLabels: Record<MomBlockType, string> = {
  backgroundNote: "Background Note",
  decision: "Decision",
  actionRequired: "Action Required",
  responsiblePerson: "Responsible Person",
  targetDate: "Target Date",
  annexureReference: "Annexure Reference",
  status: "Status",
  table: "Table",
  customField: "Custom Field",
};

function blocksForItem(item: MomAgendaItem): MomBlock[] {
  if (Array.isArray(item.blocks) && item.blocks.length) return item.blocks;
  return [
    { type: "decision", label: blockLabels.decision, value: item.decision || "" },
    { type: "actionRequired", label: blockLabels.actionRequired, value: item.actionRequired || "" },
    { type: "responsiblePerson", label: blockLabels.responsiblePerson, value: item.responsiblePerson || "" },
    { type: "targetDate", label: blockLabels.targetDate, value: item.targetDate || "" },
  ];
}

function blockText(item: MomAgendaItem, type: MomBlockType) {
  const value = blocksForItem(item).find((block) => block.type === type)?.value;
  return typeof value === "string" ? value : "";
}

export default function SummaryTable({ items }: { items: MomAgendaItem[] }) {
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const optionalColumns = [
    {
      key: "decision",
      label: "Decision",
      visible: sortedItems.some((item) => hasText(blockText(item, "decision"))),
      render: (item: MomAgendaItem) => stripHtml(blockText(item, "decision")),
    },
    {
      key: "actionRequired",
      label: "Action Required",
      visible: sortedItems.some((item) => hasText(blockText(item, "actionRequired"))),
      render: (item: MomAgendaItem) => blockText(item, "actionRequired").trim(),
    },
    {
      key: "responsiblePerson",
      label: "Responsible Person",
      visible: sortedItems.some((item) => hasText(blockText(item, "responsiblePerson"))),
      render: (item: MomAgendaItem) => blockText(item, "responsiblePerson").trim(),
    },
    {
      key: "targetDate",
      label: "Target Date",
      visible: sortedItems.some((item) => hasText(blockText(item, "targetDate"))),
      render: (item: MomAgendaItem) => formatDate(blockText(item, "targetDate")),
    },
  ].filter((column) => column.visible);
  const columnCount = 3 + optionalColumns.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 p-4 dark:border-gray-800">
        <h2 className="font-bold text-gray-900 dark:text-white">Agenda to Action Summary</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Live tracker generated from MoM agenda items.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <tr>
              <th className="border border-gray-200 px-4 py-3 dark:border-gray-800">Sl. No.</th>
              <th className="border border-gray-200 px-4 py-3 dark:border-gray-800">Agenda No.</th>
              <th className="border border-gray-200 px-4 py-3 dark:border-gray-800">Subject</th>
              {optionalColumns.map((column) => (
                <th key={column.key} className="border border-gray-200 px-4 py-3 dark:border-gray-800">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => (
              <tr key={item._id || `${item.itemNumber}-${index}`}>
                <td className="border border-gray-200 px-4 py-3 font-semibold text-gray-900 dark:border-gray-800 dark:text-white">{String(index + 1).padStart(2, "0")}</td>
                <td className="border border-gray-200 px-4 py-3 text-gray-600 dark:border-gray-800 dark:text-gray-300">{item.itemNumber || String(index + 1).padStart(2, "0")}</td>
                <td className="border border-gray-200 px-4 py-3 text-gray-600 dark:border-gray-800 dark:text-gray-300">{item.subject || "-"}</td>
                {optionalColumns.map((column) => (
                  <td key={column.key} className="border border-gray-200 px-4 py-3 text-gray-600 dark:border-gray-800 dark:text-gray-300">
                    {column.render(item) || "-"}
                  </td>
                ))}
              </tr>
            ))}
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="border border-gray-200 px-4 py-8 text-center text-gray-500 dark:border-gray-800 dark:text-gray-400">No agenda items added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
