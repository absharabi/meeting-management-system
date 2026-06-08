"use client";

import { MomAgendaItem, MomBlock, MomMeeting, MomTableValue } from "./types";

const groups = ["Procedural", "Consideration & Approval", "Reporting", "Any Other Matter"];
const stripHtml = (value: string) => value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

export default function MomPreview({ meeting }: { meeting: MomMeeting }) {
  const agendaItems = [...(meeting.agendaItems || [])].sort((a, b) => a.order - b.order);
  const cover = meeting.momCoverDetails;
  // Use raw meeting number for header, but clean number for agenda items
  const rawMeetingNo = cover?.meetingNumber || "XX";
  const cleanMeetingNo = rawMeetingNo.replace(/\D/g, "") || rawMeetingNo;
  let currentMainNumber = 0;
  let currentSubLetterIndex = 0;

  const numberedItems = agendaItems.map((item) => {
    if (!item.isSubItem) {
      currentMainNumber++;
      currentSubLetterIndex = 0;
      return { ...item, computedNumber: `BG.${cleanMeetingNo}.${String(currentMainNumber).padStart(2, "0")}` };
    } else {
      const letter = String.fromCharCode(97 + currentSubLetterIndex);
      currentSubLetterIndex++;
      return { ...item, computedNumber: `BG.${cleanMeetingNo}.${String(currentMainNumber || 1).padStart(2, "0")}(${letter})` };
    }
  });

  return (
    <div className="bg-white shadow-md">
      {/* A4 Container */}
      <div 
        className="mx-auto w-full max-w-[210mm] bg-white p-[20mm] text-black"
        style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', lineHeight: '1.4' }}
      >
        {/* Cover Section (Simplified to blend into the document) */}
        <div className="mb-12 text-center">
          <h1 className="text-xl font-bold uppercase underline">
            {cover?.instituteName || "National Institute of Technology Calicut"}
          </h1>
          <p className="mt-4 font-bold">
            Minutes of the {rawMeetingNo} Meeting of the {cover?.meetingBody || "Board of Governors"}
          </p>
          <p className="mt-2">
            {cover?.dateLine || `Date: ${new Date(meeting.date).toLocaleDateString()}`} | {cover?.venueLine || `Venue: ${meeting.venue || "TBA"}`}
          </p>
        </div>

        {/* Section Iteration */}
        {groups.map((group, groupIndex) => {
          const groupItems = numberedItems.filter((item) => item.sectionGroup === group);
          if (!groupItems.length) return null;

          return (
            <div key={group} className="mb-8">
              <div className="mb-6 text-center font-bold">
                <p className="underline decoration-1 underline-offset-2">Section {groupIndex + 1}</p>
                <p>({group} Items)</p>
                {groupIndex === 0 && (
                  <p className="mt-4 uppercase">
                    Brief Notes on the Agenda Points for {rawMeetingNo} Meeting of BoG
                  </p>
                )}
              </div>

              <div className="space-y-6">
                {groupItems.map((item) => {
                  if (item.isActionTakenReport) {
                    return <ActionTakenTable key={item._id || item.computedNumber} item={item} />;
                  }
                  return <AgendaTable key={item._id || item.computedNumber} item={item} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaTable({ item }: { item: MomAgendaItem & { computedNumber: string } }) {
  const blocks = visibleBlocksForItem(item);
  const decisionBlock = blocks.find((b) => b.type === "decision" || b.type === "actionRequired");
  const resolutionBlock = blocks.find((b) => b.type === "resolution");

  return (
    <table className="w-full border-collapse border border-black text-left break-inside-avoid" style={{ fontSize: '11pt' }}>
      <tbody>
        {/* Subject Row */}
        <tr>
          <td className="w-[15%] border border-black bg-gray-100 p-2 align-top font-bold">
            Subject<br />{item.computedNumber}
          </td>
          <td className="border border-black p-2 align-top font-bold text-justify">
            {item.subject}
            {blocks.map((block, i) => {
               if (block.type !== "decision" && block.type !== "actionRequired" && block.type !== "resolution" && block.type !== "actionTaken") {
                 if (block.type === "table") {
                   return <PreviewTable key={i} block={block} />;
                 }
                 return (
                   <div key={i} className="mt-2 font-normal">
                     {block.type === "backgroundNote" ? (
                       <div dangerouslySetInnerHTML={{ __html: String(block.value || "") }} className="prose-sm" />
                     ) : (
                       <p><strong>{block.label}:</strong> {String(block.value || "")}</p>
                     )}
                   </div>
                 );
               }
               return null;
            })}
          </td>
        </tr>

        {/* Decision Row */}
        {(decisionBlock || !resolutionBlock) && (
          <tr>
            <td className="w-[15%] border border-black bg-gray-100 p-2 align-top font-bold">
              Decision
            </td>
            <td className="border border-black p-2 align-top text-justify">
              {decisionBlock ? (
                <div dangerouslySetInnerHTML={{ __html: String(decisionBlock.value || "") }} className="prose-sm" />
              ) : (
                <p>No decision recorded.</p>
              )}
            </td>
          </tr>
        )}

        {/* Resolution Row */}
        {resolutionBlock && (
          <tr>
            <td className="w-[15%] border border-black bg-gray-100 p-2 align-top font-bold">
              Resolution
            </td>
            <td className="border border-black p-2 align-top text-justify">
              <div dangerouslySetInnerHTML={{ __html: String(resolutionBlock.value || "") }} className="prose-sm" />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function ActionTakenTable({ item }: { item: MomAgendaItem & { computedNumber: string } }) {
  const blocks = visibleBlocksForItem(item);
  const decisionBlock = blocks.find((b) => b.type === "decision");
  const actionTakenBlock = blocks.find((b) => b.type === "actionTaken" || b.type === "status");

  return (
    <div className="break-inside-avoid">
      <h4 className="mb-2 font-bold">{item.subject}</h4>
      <table className="w-full border-collapse border border-black text-left" style={{ fontSize: '11pt' }}>
        <thead>
          <tr>
            <th className="w-[8%] border border-black p-2 font-bold">SlNo</th>
            <th className="w-[15%] border border-black p-2 font-bold">BG No.</th>
            <th className="w-[45%] border border-black p-2 font-bold">Decision</th>
            <th className="w-[32%] border border-black p-2 font-bold">Action Taken</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2 align-top">1</td>
            <td className="border border-black p-2 align-top">{item.computedNumber}</td>
            <td className="border border-black p-2 align-top text-justify">
              <div dangerouslySetInnerHTML={{ __html: String(decisionBlock?.value || "") }} className="prose-sm" />
            </td>
            <td className="border border-black p-2 align-top text-justify">
              <div dangerouslySetInnerHTML={{ __html: String(actionTakenBlock?.value || "") }} className="prose-sm" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function visibleBlocksForItem(item: MomAgendaItem): MomBlock[] {
  return blocksForItem(item).filter(hasBlockValue);
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
  const value = compactTableValue(typeof block.value === "object" && block.value ? block.value : { columns: [], rows: [] });
  if (!value.columns.length) return null;

  return (
    <div className="mt-3">
      <p className="font-semibold">{block.label}</p>
      <table className="mt-2 w-full border-collapse border border-black text-left" style={{ fontSize: '11pt' }}>
        <thead>
          <tr>{value.columns.map((column, index) => <th key={`${column}-${index}`} className="border border-black p-2">{column || `Column ${index + 1}`}</th>)}</tr>
        </thead>
        <tbody>
          {value.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>{value.columns.map((_, columnIndex) => <td key={`cell-${rowIndex}-${columnIndex}`} className="border border-black p-2">{row[columnIndex] || "-"}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hasBlockValue(block: MomBlock) {
  if (block.type === "table") {
    const table = compactTableValue(typeof block.value === "object" && block.value ? block.value : { columns: [], rows: [] });
    return table.columns.length > 0 && table.rows.length > 0;
  }
  return stripHtml(String(block.value || "")).length > 0;
}

function compactTableValue(value: Partial<MomTableValue>) {
  const columns = Array.isArray(value.columns) ? value.columns.map(String) : [];
  const rows = Array.isArray(value.rows) ? value.rows.map((row: unknown) => Array.isArray(row) ? row.map(String) : []) : [];
  const visibleColumnIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => column.trim() || rows.some((row) => String(row[index] || "").trim()))
    .map(({ index }) => index);
  const compactRows = rows
    .map((row) => visibleColumnIndexes.map((index) => String(row[index] || "")))
    .filter((row) => row.some((cell) => cell.trim()));

  return {
    columns: visibleColumnIndexes.map((index) => columns[index] || `Column ${index + 1}`),
    rows: compactRows,
  };
}
