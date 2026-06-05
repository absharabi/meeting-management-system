"use client";

import { MomAgendaItem, MomBlock, MomMeeting } from "./types";

const groups = ["Procedural", "Consideration & Approval", "Reporting", "Any Other Matter"];

export default function MomPreview({ meeting }: { meeting: MomMeeting }) {
  const agendaItems = [...(meeting.agendaItems || [])].sort((a, b) => a.order - b.order);
  const cover = meeting.momCoverDetails;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex min-h-[760px] max-w-[720px] flex-col items-center px-10 py-10 text-center text-black">
        <img src="/mom/nitc-logo.png" onError={(event) => { event.currentTarget.src = "/mom/nitc-logo.png.png"; }} alt="NIT Calicut logo" className="h-24 w-24 object-contain" />
        <div className="mt-12 space-y-2 font-serif">
          <p className="text-3xl font-bold text-sky-500">Minutes</p>
          <p className="text-4xl font-bold text-red-700">of the {cover?.meetingNumber || "Nth"}</p>
          <p className="pt-3 text-2xl text-red-700">Meeting of the</p>
          <p className="text-4xl font-bold text-green-600">{cover?.meetingBody || "Board of Governors"}</p>
          <p className="text-2xl text-red-700">of the {cover?.instituteName || "National Institute of Technology Calicut"}</p>
          <p className="pt-6 text-2xl text-sky-500">{cover?.dateLine || `on ${new Date(meeting.date).toLocaleDateString()} at meeting time`}</p>
        </div>
        <p className="mt-14 font-serif text-lg">{cover?.venueLine || `Through ${meeting.venue || meeting.link || "the notified venue"}`}</p>
        <img src="/mom/nitc-building.jpg" onError={(event) => { event.currentTarget.src = "/mom/nitc-building.jpeg"; }} alt="NIT Calicut building" className="mt-6 h-48 w-[430px] object-cover" />
      </div>

      <div className="border-t border-gray-200 p-6 dark:border-gray-800">
        <h3 className="font-bold text-gray-900 dark:text-white">Members Present</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Designation</th>
                <th className="px-3 py-2">Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {meeting.membersPresent.map((member, index) => (
                <tr key={`${member.name}-${index}`}>
                  <td className="px-3 py-2">{member.name || "-"}</td>
                  <td className="px-3 py-2">{member.designation || "-"}</td>
                  <td className="px-3 py-2">{member.attendanceMode || "-"}</td>
                </tr>
              ))}
              {meeting.membersPresent.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">No members recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {groups.map((group) => {
          const groupItems = agendaItems.filter((item) => item.sectionGroup === group);
          if (!groupItems.length) return null;

          return (
            <div key={group}>
              <h3 className="rounded-lg bg-gray-100 px-3 py-2 font-bold text-gray-900 dark:bg-gray-800 dark:text-white">{group}</h3>
              <div className="mt-3 space-y-4">
                {groupItems.map((item, index) => (
                  <article key={item._id || `${item.itemNumber}-${index}`} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{[item.sectionTag, item.itemNumber].filter(Boolean).join(" / ")}</p>
                    <h4 className="mt-1 font-bold text-gray-900 dark:text-white">{item.subject}</h4>
                    {blocksForItem(item).map((block, blockIndex) => (
                      block.type === "table"
                        ? <PreviewTable key={`${block.label}-${blockIndex}`} block={block} />
                        : <PreviewBlock key={`${block.label}-${blockIndex}`} title={block.label} html={block.type === "backgroundNote" || block.type === "decision" ? String(block.value || "") : `<p>${String(block.value || "-")}</p>`} />
                    ))}
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PreviewBlock({ title, html }: { title: string; html: string }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      <div className="prose prose-sm mt-1 max-w-none text-gray-600 dark:prose-invert dark:text-gray-300" dangerouslySetInnerHTML={{ __html: html || "<p>-</p>" }} />
    </div>
  );
}

function blocksForItem(item: MomAgendaItem): MomBlock[] {
  if (Array.isArray(item.blocks) && item.blocks.length) return item.blocks;
  return [
    { type: "backgroundNote", label: "Background Note", value: item.backgroundNote || "" },
    { type: "decision", label: "Decision", value: item.decision || "" },
    { type: "actionRequired", label: "Action Required", value: item.actionRequired || "" },
    { type: "responsiblePerson", label: "Responsible Person", value: item.responsiblePerson || "" },
    { type: "targetDate", label: "Target Date", value: item.targetDate || "" },
  ];
}

function PreviewTable({ block }: { block: MomBlock }) {
  const value = typeof block.value === "object" && block.value ? block.value : { columns: [], rows: [] };

  return (
    <div className="mt-3 overflow-x-auto">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{block.label}</p>
      <table className="mt-2 w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <tr>{value.columns.map((column, index) => <th key={`${column}-${index}`} className="px-3 py-2">{column || "-"}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {value.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>{value.columns.map((_, columnIndex) => <td key={`cell-${rowIndex}-${columnIndex}`} className="px-3 py-2">{row[columnIndex] || "-"}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
