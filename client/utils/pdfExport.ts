import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MemberPresent, MomAgendaItem, MomApprovalStatus, MomBlock, MomBlockType, MomCoverDetails, MomMeeting, MomStatus } from "@/components/mom/types";

export const logoPaths = ["/mom/nitc-logo.png", "/mom/nitc-logo.png.png"];
export const buildingPaths = ["/mom/nitc-building.jpg", "/mom/nitc-building.jpeg"];

export interface MeetingAgenda {
  _id: string;
  title: string;
  description?: string;
  status?: string;
  sequence?: number;
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

export const defaultCoverDetails = (meeting?: MomMeeting | null): MomCoverDetails => ({
  meetingNumber: "71st",
  meetingBody: "Board of Governors",
  instituteName: "National Institute of Technology Calicut",
  dateLine: meeting ? `on ${formatDate(meeting.date)} from ${meeting.startTime || "start time"} to ${meeting.endTime || "end time"}` : "",
  venueLine: meeting ? `${meeting.mode || "Meeting"} mode at ${meeting.venue || meeting.link || "the notified venue"}` : "",
});

export function deriveMembersFromParticipants(meeting: MomMeeting): MemberPresent[] {
  return meeting.membersPresent || [];
}

export function mergeCoverDetails(meeting: MomMeeting, details?: Partial<MomCoverDetails> | null): MomCoverDetails {
  const derived = defaultCoverDetails(meeting);
  return {
    ...derived,
    ...(details || {}),
    dateLine: derived.dateLine,
    venueLine: derived.venueLine,
  };
}

export function isCoverComplete(details: MomCoverDetails) {
  return Boolean(
    details.meetingNumber?.trim() &&
    details.meetingBody?.trim() &&
    details.instituteName?.trim() &&
    details.dateLine?.trim() &&
    details.venueLine?.trim()
  );
}

export function getOrganizerId(organizer: MomMeeting["organizerId"]) {
  return typeof organizer === "string" ? organizer : organizer?._id || organizer?.id || "";
}

export const blockLabels: Record<MomBlockType, string> = {
  backgroundNote: "Background Note",
  decision: "Decision",
  resolution: "Resolution",
  actionRequired: "Action Required",
  actionTaken: "Action Taken",
  responsiblePerson: "Responsible Person",
  targetDate: "Target Date",
  annexureReference: "Annexure Reference",
  status: "Status",
  table: "Table",
  customField: "Custom Field",
};

export const presetBlockTypes: Record<MomAgendaItem["sectionGroup"], MomBlockType[]> = {
  "Procedural": ["backgroundNote", "decision"],
  "Consideration & Approval": ["backgroundNote", "decision", "actionRequired", "responsiblePerson", "targetDate"],
  "Reporting": ["backgroundNote", "decision", "status"],
  "Any Other Matter": ["backgroundNote", "decision"],
};

export function createPresetBlocks(sectionGroup: MomAgendaItem["sectionGroup"], values: Partial<Record<MomBlockType, string>> = {}) {
  return presetBlockTypes[sectionGroup].map((type) => ({
    type,
    label: blockLabels[type],
    value: values[type] || (type === "status" ? "Pending" : ""),
  }));
}

export function normalizeBlocks(item: MomAgendaItem): MomBlock[] {
  if (Array.isArray(item.blocks) && item.blocks.length) {
    return item.blocks.map((block) => ({
      type: block.type,
      label: block.label || blockLabels[block.type] || "Field",
      value: block.type === "table" ? normalizeTableValue(block.value) : String(block.value || ""),
    }));
  }

  return createPresetBlocks(item.sectionGroup || "Procedural", {
    backgroundNote: item.backgroundNote || "",
    decision: item.decision || "",
    actionRequired: item.actionRequired || "",
    responsiblePerson: item.responsiblePerson || "",
    targetDate: item.targetDate || "",
  });
}

export function normalizeAgendaItemForBlocks(item: MomAgendaItem): MomAgendaItem {
  const blocks = normalizeBlocks(item);
  const getBlockValue = (type: MomBlockType) => String(blocks.find((block) => block.type === type)?.value || "");

  return {
    ...item,
    blocks,
    backgroundNote: getBlockValue("backgroundNote"),
    decision: getBlockValue("decision"),
    actionRequired: getBlockValue("actionRequired"),
    responsiblePerson: getBlockValue("responsiblePerson"),
    targetDate: getBlockValue("targetDate"),
  };
}

export function normalizeAgendaItems(items: MomAgendaItem[]) {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => normalizeAgendaItemForBlocks({ ...item, order: index }));
}

export function normalizeTableValue(value: MomBlock["value"]) {
  if (typeof value === "object" && value && Array.isArray(value.columns) && Array.isArray(value.rows)) {
    return {
      columns: value.columns.map(String),
      rows: value.rows.map((row) => Array.isArray(row) ? row.map(String) : []),
    };
  }

  return { columns: ["Column 1", "Column 2"], rows: [["", ""]] };
}

export function compactTableValue(value: MomBlock["value"]) {
  const table = normalizeTableValue(value);
  const visibleColumnIndexes = table.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => column.trim() || table.rows.some((row) => String(row[index] || "").trim()))
    .map(({ index }) => index);
  const rows = table.rows
    .map((row) => visibleColumnIndexes.map((index) => String(row[index] || "")))
    .filter((row) => row.some((cell) => cell.trim()));

  return {
    columns: visibleColumnIndexes.map((index) => table.columns[index] || `Column ${index + 1}`),
    rows,
  };
}

export function hasBlockDisplayValue(block: MomBlock) {
  if (block.type === "table") {
    const table = compactTableValue(block.value);
    return table.columns.length > 0 && table.rows.length > 0;
  }
  return stripHtml(String(block.value || "")).length > 0;
}

export function visibleBlocks(item: MomAgendaItem) {
  return normalizeBlocks(item).filter(hasBlockDisplayValue);
}

export function getBlockText(item: MomAgendaItem, type: MomBlockType) {
  const block = normalizeBlocks(item).find((currentBlock) => currentBlock.type === type);
  if (!block || block.type === "table") return "";
  return String(block.value || "");
}

export function getBlockDisplayValue(block: MomBlock) {
  if (block.type === "table") return "";
  if (block.type === "backgroundNote" || block.type === "decision") return stripHtml(String(block.value || ""));
  if (block.type === "targetDate") return formatDate(String(block.value || ""));
  return String(block.value || "").trim();
}

export function mergeAgendaModuleItems(existingItems: MomAgendaItem[], agendaModuleItems: MeetingAgenda[]) {
  const agendaById = new Map(agendaModuleItems.map((agenda) => [agenda._id, agenda]));
  const sortedExisting = [...existingItems]
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const sourceAgendaKey = item.sourceAgendaId ? String(item.sourceAgendaId) : "";
      const sourceAgenda = sourceAgendaKey ? agendaById.get(sourceAgendaKey) : null;
      if (!sourceAgenda) return normalizeAgendaItemForBlocks(item);

      const updatedBlocks = normalizeBlocks(item).map((block) => (
        block.type === "backgroundNote"
          ? { ...block, value: sourceAgenda.description || String(block.value || "") }
          : block
      ));
      return normalizeAgendaItemForBlocks({
        ...item,
        itemNumber: item.itemNumber || String(sourceAgenda.sequence || item.order + 1).padStart(2, "0"),
        subject: sourceAgenda.title || item.subject,
        backgroundNote: sourceAgenda.description || item.backgroundNote,
        blocks: updatedBlocks,
      });
    });
  const existingBySource = new Set(sortedExisting.map((item) => item.sourceAgendaId ? String(item.sourceAgendaId) : "").filter(Boolean));
  const agendaItems = [...agendaModuleItems].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const importedItems = agendaItems
    .filter((agenda) => !existingBySource.has(agenda._id))
    .map((agenda, index) => normalizeAgendaItemForBlocks({
      _id: `local-agenda-${agenda._id}`,
      sourceAgendaId: agenda._id,
      itemNumber: String((agenda.sequence || index + 1)).padStart(2, "0"),
      sectionTag: "",
      sectionGroup: "Procedural" as const,
      subject: agenda.title || "",
      backgroundNote: agenda.description || "",
      decision: "",
      actionRequired: "",
      responsiblePerson: "",
      targetDate: "",
      order: sortedExisting.length + index,
    }));

  return [...sortedExisting, ...importedItems].map((item, index) => ({ ...item, order: index }));
}

export async function loadImage(paths: string[]) {
  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return dataUrl;
    } catch {
      continue;
    }
  }

  return null;
}

export async function exportMomPdf(meeting: MomMeeting) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cover = { ...defaultCoverDetails(meeting), ...(meeting.momCoverDetails || {}) };
  const logo = await loadImage(logoPaths);
  const building = await loadImage(buildingPaths);
  const margin = 48;
  const agendaItems = [...(meeting.agendaItems || [])].sort((a, b) => a.order - b.order);

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

  drawOfficialCover(doc, {
    pageWidth,
    pageHeight,
    cover,
    meeting,
    logo,
    building,
  });

  doc.addPage();
  drawPageHeader(doc, meeting, 2);
  let y = 94;
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 35, 60);
  doc.text("Minutes of Meeting", margin, y);
  y += 24;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { font: "times", fontSize: 10, cellPadding: 6, lineColor: [180, 190, 200], lineWidth: 0.5, textColor: [20, 35, 60] },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [242, 246, 250], cellWidth: 135 },
      1: { cellWidth: pageWidth - margin * 2 - 135 },
    },
    body: [
      ["Meeting", `${cover.meetingNumber || "Nth"} Meeting of the ${cover.meetingBody || "Board of Governors"}`],
      ["Institute", cover.instituteName || "National Institute of Technology Calicut"],
      ["Date", cover.dateLine || formatDate(meeting.date)],
      ["Venue / Mode", cover.venueLine || meeting.venue || meeting.link || "Not specified"],
      ["Status", meeting.momStatus || "Draft"],
    ],
  });

  y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || y) + 30;
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("Members Present", margin, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: margin, right: margin },
    head: [["Sl. No.", "Name", "Designation", "Mode"]],
    body: meeting.membersPresent.length
      ? meeting.membersPresent.map((member, index) => [
          String(index + 1),
          member.name || "-",
          member.designation || "-",
          member.attendanceMode || "-",
        ])
      : [["-", "No members recorded", "-", "-"]],
    styles: { font: "times", fontSize: 9.5, cellPadding: 5, lineColor: [190, 198, 208], lineWidth: 0.4, textColor: [25, 35, 50] },
    headStyles: { fillColor: [21, 45, 78], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 50, halign: "center" }, 3: { cellWidth: 80 } },
    didDrawPage: () => drawPageHeader(doc, meeting, doc.getNumberOfPages()),
  });

  y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || y) + 30;

  const groups: MomAgendaItem["sectionGroup"][] = ["Procedural", "Consideration & Approval", "Reporting", "Any Other Matter"];
  groups.forEach((group, groupIndex) => {
    const groupItems = numberedItems.filter((item) => item.sectionGroup === group);
    if (!groupItems.length) return;

    y = ensureSpace(doc, y, 64, meeting);
    
    // Group Header
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 35, 60);
    doc.text(`Section ${groupIndex + 1} (${group} Items)`, pageWidth / 2, y, { align: "center" });
    y += 16;
    
    if (groupIndex === 0) {
       doc.setFontSize(11);
       doc.text(`Brief Notes on the Agenda Points for ${rawMeetingNo} Meeting of BoG`, pageWidth / 2, y, { align: "center" });
       y += 16;
    }

    groupItems.forEach((item) => {
      y = ensureSpace(doc, y, 100, meeting);
      
      if (item.isActionTakenReport) {
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        const titleLines = doc.splitTextToSize(item.subject || "Untitled", pageWidth - margin * 2);
        doc.text(titleLines, margin, y);
        y += titleLines.length * 14 + 6;

        const decisionText = stripHtml(getBlockText(item, "decision"));
        const actionTakenText = stripHtml(getBlockText(item, "actionTaken") || getBlockText(item, "status"));
        
        autoTable(doc, {
          startY: y,
          theme: "grid",
          margin: { left: margin, right: margin },
          head: [["SlNo", "BG No.", "Decision", "Action Taken"]],
          body: [
            ["1", item.computedNumber, decisionText, actionTakenText]
          ],
          styles: { font: "times", fontSize: 9.5, cellPadding: 5, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0], valign: "top" },
          headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.5, lineColor: [0,0,0] },
          columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 70 }, 2: { cellWidth: 200 } },
          didDrawPage: () => drawPageHeader(doc, meeting, doc.getNumberOfPages()),
        });
        
        y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || y) + 20;

      } else {
        const blocks = visibleBlocks(item);
        const decisionBlock = blocks.find((b) => b.type === "decision" || b.type === "actionRequired");
        const resolutionBlock = blocks.find((b) => b.type === "resolution");
        
        let subjectRight = item.subject + "\n";
        blocks.forEach((block) => {
           if (block.type !== "decision" && block.type !== "actionRequired" && block.type !== "resolution" && block.type !== "actionTaken" && block.type !== "table") {
             subjectRight += "\n" + block.label + ": " + getBlockDisplayValue(block);
           }
        });

        const rows = [
          [`Subject\n${item.computedNumber}`, subjectRight.trim()]
        ];

        if (decisionBlock || !resolutionBlock) {
          rows.push(["Decision", stripHtml(String(decisionBlock?.value || "No decision recorded."))]);
        }
        if (resolutionBlock) {
          rows.push(["Resolution", stripHtml(String(resolutionBlock.value || ""))]);
        }

        autoTable(doc, {
          startY: y,
          theme: "grid",
          margin: { left: margin, right: margin },
          body: rows,
          styles: { font: "times", fontSize: 10, cellPadding: 6, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0], valign: "top" },
          columnStyles: {
            0: { fontStyle: "bold", fillColor: [242, 246, 250], cellWidth: 80 },
            1: { cellWidth: pageWidth - margin * 2 - 80 },
          },
          didDrawPage: () => drawPageHeader(doc, meeting, doc.getNumberOfPages()),
        });

        y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || y) + 20;
      }
    });
  });

  if (!agendaItems.length) {
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text("No agenda items recorded.", margin, y);
    y += 20;
  }

  y = ensureSpace(doc, y, 120, meeting);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(25, 35, 50);
  doc.text("The meeting ended with thanks to the Chair.", margin, y);
  y += 64;
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 35, 60);
  doc.text("Approved By", margin, y + 16);

  y += 36;
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(25, 35, 50);

  const approvalStatus = meeting.momApprovalStatus || [];
  const approvedMembers = approvalStatus.filter((a) => a.approved);

  if (approvedMembers.length > 0) {
    approvedMembers.forEach((member) => {
      y = ensureSpace(doc, y, 16, meeting);
      doc.text(`${member.name} (${member.department || "Member"})`, margin, y);
      y += 16;
    });
  } else {
    doc.text("No approvals recorded.", margin, y);
  }

  addPageNumbers(doc, meeting);

  doc.save(`${meeting.title.replace(/[^a-z0-9]+/gi, "-") || "mom"}.pdf`);
}

export function exportMomWord(meeting: MomMeeting) {
  const cover = { ...defaultCoverDetails(meeting), ...(meeting.momCoverDetails || {}) };
  const agendaItems = [...(meeting.agendaItems || [])].sort((a, b) => a.order - b.order);
  const groups: MomAgendaItem["sectionGroup"][] = ["Procedural", "Consideration & Approval", "Reporting", "Any Other Matter"];
  const approvalStatus = meeting.momApprovalStatus || [];
  const approvedMembers = approvalStatus.filter((approval) => approval.approved);

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

  const agendaHtml = groups.map((group, groupIndex) => {
    const groupItems = numberedItems.filter((item) => item.sectionGroup === group);
    if (!groupItems.length) return "";

    return `
      <div style="text-align: center; margin-bottom: 24pt;">
        <h2 style="background: none; text-decoration: underline; margin-bottom: 4pt; color: black;">Section ${groupIndex + 1}</h2>
        <p style="margin: 0; font-weight: bold; color: black;">(${escapeHtml(group)} Items)</p>
        ${groupIndex === 0 ? `<p style="margin-top: 12pt; text-transform: uppercase; font-weight: bold;">Brief Notes on the Agenda Points for ${escapeHtml(rawMeetingNo)} Meeting of BoG</p>` : ""}
      </div>
      ${groupItems.map((item) => {
        if (item.isActionTakenReport) {
          const decisionBlock = visibleBlocks(item).find((b) => b.type === "decision");
          const actionTakenBlock = visibleBlocks(item).find((b) => b.type === "actionTaken" || b.type === "status");
          return `
            <div style="page-break-inside: avoid; margin-bottom: 24pt;">
              <h4 style="margin-bottom: 8pt;">${escapeHtml(item.subject)}</h4>
              <table class="bog-table" style="width: 100%;">
                <tr>
                  <th style="width: 8%;">SlNo</th>
                  <th style="width: 15%;">BG No.</th>
                  <th style="width: 45%;">Decision</th>
                  <th style="width: 32%;">Action Taken</th>
                </tr>
                <tr>
                  <td>1</td>
                  <td>${escapeHtml(item.computedNumber)}</td>
                  <td>${String(decisionBlock?.value || "").replace(/\n/g, "<br>")}</td>
                  <td>${String(actionTakenBlock?.value || "").replace(/\n/g, "<br>")}</td>
                </tr>
              </table>
            </div>
          `;
        }

        const blocks = visibleBlocks(item);
        const decisionBlock = blocks.find((b) => b.type === "decision" || b.type === "actionRequired");
        const resolutionBlock = blocks.find((b) => b.type === "resolution");
        
        return `
          <table class="bog-table" style="width: 100%; margin-bottom: 24pt; page-break-inside: avoid;">
            <tr>
              <td class="bog-left">Subject<br>${escapeHtml(item.computedNumber)}</td>
              <td>
                <p><strong>${escapeHtml(item.subject)}</strong></p>
                ${blocks.map((block) => {
                  if (block.type !== "decision" && block.type !== "actionRequired" && block.type !== "resolution" && block.type !== "actionTaken" && block.type !== "table") {
                     return `<p><strong>${escapeHtml(block.label)}:</strong> ${String(block.value || "").replace(/\n/g, "<br>")}</p>`;
                  }
                  return "";
                }).join("")}
              </td>
            </tr>
            ${(decisionBlock || !resolutionBlock) ? `
            <tr>
              <td class="bog-left">Decision</td>
              <td>${String(decisionBlock?.value || "No decision recorded.").replace(/\n/g, "<br>")}</td>
            </tr>
            ` : ""}
            ${resolutionBlock ? `
            <tr>
              <td class="bog-left">Resolution</td>
              <td>${String(resolutionBlock.value || "").replace(/\n/g, "<br>")}</td>
            </tr>
            ` : ""}
          </table>
        `;
      }).join("")}
    `;
  }).join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0.7in; }
          body { font-family: "Times New Roman", serif; color: #000; font-size: 11pt; line-height: 1.35; text-align: justify; }
          h1 { font-size: 18pt; text-align: center; margin: 0 0 18pt; }
          h2 { font-size: 13pt; text-align: center; margin: 18pt 0 8pt; }
          h3 { font-size: 12pt; margin: 12pt 0 6pt; }
          h4 { font-size: 11pt; font-weight: bold; margin: 12pt 0 6pt; }
          .header { text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 18pt; }
          .meta, .members { border-collapse: collapse; width: 100%; margin: 8pt 0 16pt; }
          .meta td, .members th, .members td { border: 1px solid #000; padding: 5pt; vertical-align: top; }
          .meta td:first-child, .members th { font-weight: bold; background: #f2f6fa; }
          .bog-table { border-collapse: collapse; width: 100%; border: 1px solid #000; }
          .bog-table td, .bog-table th { border: 1px solid #000; padding: 6pt; vertical-align: top; }
          .bog-table th { font-weight: bold; }
          .bog-left { width: 15%; background: #f2f6fa; font-weight: bold; }
          .footer { mso-element: footer; text-align: center; color: #5b6472; font-size: 9pt; }
        </style>
      </head>
      <body>
        <div class="header">National Institute of Technology Calicut</div>
        <h1>Minutes of Meeting</h1>
        <table class="meta">
          <tr><td>Meeting</td><td>${escapeHtml(`${cover.meetingNumber || "Nth"} Meeting of the ${cover.meetingBody || "Board of Governors"}`)}</td></tr>
          <tr><td>Institute</td><td>${escapeHtml(cover.instituteName || "National Institute of Technology Calicut")}</td></tr>
          <tr><td>Date</td><td>${escapeHtml(cover.dateLine || formatDate(meeting.date))}</td></tr>
          <tr><td>Venue / Mode</td><td>${escapeHtml(cover.venueLine || meeting.venue || meeting.link || "Not specified")}</td></tr>
          <tr><td>Status</td><td>${escapeHtml(meeting.momStatus || "Draft")}</td></tr>
        </table>
        <h2>Members Present</h2>
        <table class="members">
          <tr><th>Sl. No.</th><th>Name</th><th>Designation</th><th>Mode</th></tr>
          ${(meeting.membersPresent.length ? meeting.membersPresent : [{ name: "No members recorded", designation: "-", attendanceMode: "-" }]).map((member, index) => `
            <tr><td>${index + 1}</td><td>${escapeHtml(member.name || "-")}</td><td>${escapeHtml(member.designation || "-")}</td><td>${escapeHtml(member.attendanceMode || "-")}</td></tr>
          `).join("")}
        </table>
        ${agendaHtml || "<p>No agenda items recorded.</p>"}
        <p>The meeting ended with thanks to the Chair.</p>
        <h2>Approved By</h2>
        ${approvedMembers.length ? approvedMembers.map((member) => `<p>${escapeHtml(`${member.name} (${member.department || "Member"})`)}</p>`).join("") : "<p>No approvals recorded.</p>"}
        <div class="footer">Minutes of Meeting</div>
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${meeting.title.replace(/[^a-z0-9]+/gi, "-") || "mom"}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function tableBlockToHtml(block: MomBlock) {
  const table = compactTableValue(block.value);
  if (!table.columns.length || !table.rows.length) return "";
  return `
    <p class="block"><strong>${escapeHtml(block.label)}:</strong></p>
    <table class="data-table">
      <tr>${table.columns.map((column) => `<th>${escapeHtml(column || "-")}</th>`).join("")}</tr>
      ${table.rows.map((row) => `<tr>${table.columns.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`).join("")}
    </table>
  `;
}

export function stripHtml(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function drawOfficialCover(
  doc: jsPDF,
  options: {
    pageWidth: number;
    pageHeight: number;
    cover: MomCoverDetails;
    meeting: MomMeeting;
    logo: string | null;
    building: string | null;
  }
) {
  const { pageWidth, pageHeight, cover, meeting, logo, building } = options;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  if (logo) {
    doc.addImage(logo, "PNG", pageWidth / 2 - 34, 28, 68, 68);
  }

  doc.setFont("times", "bold");
  doc.setFontSize(25);
  doc.setTextColor(0, 174, 239);
  doc.text("Minutes", pageWidth / 2, 175, { align: "center" });

  doc.setTextColor(205, 0, 0);
  doc.setFontSize(31);
  doc.text(`of the ${cover.meetingNumber || "Nth"}`, pageWidth / 2, 220, { align: "center" });

  doc.setFontSize(20);
  doc.text("Meeting of the", pageWidth / 2, 270, { align: "center" });

  doc.setFontSize(31);
  doc.setTextColor(0, 175, 75);
  doc.text(cover.meetingBody || "Board of Governors", pageWidth / 2, 314, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(18);
  doc.setTextColor(205, 0, 0);
  doc.text(`of the ${cover.instituteName || "National Institute of Technology Calicut"}`, pageWidth / 2, 352, {
    align: "center",
    maxWidth: 520,
  });

  doc.setTextColor(0, 174, 239);
  doc.setFontSize(20);
  doc.text(cover.dateLine || `on ${formatDate(meeting.date)}`, pageWidth / 2, 430, { align: "center", maxWidth: 520 });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(cover.venueLine || meeting.venue || meeting.link || "Venue not specified", pageWidth / 2, 515, {
    align: "center",
    maxWidth: 500,
  });

  if (building) {
    doc.addImage(building, "JPEG", pageWidth / 2 - 155, pageHeight - 155, 310, 118);
  }
}

export function drawPageHeader(doc: jsPDF, meeting: MomMeeting, pageNumber: number) {
  if (pageNumber === 1) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(21, 45, 78);
  doc.rect(0, 0, pageWidth, 46, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("National Institute of Technology Calicut", 48, 20);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(`Minutes of Meeting: ${meeting.title}`, 48, 34, { maxWidth: pageWidth - 96 });
}

export function ensureSpace(doc: jsPDF, y: number, requiredHeight: number, meeting: MomMeeting) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + requiredHeight <= pageHeight - 70) return y;
  doc.addPage();
  drawPageHeader(doc, meeting, doc.getNumberOfPages());
  return 86;
}

export function writeOfficialBlock(doc: jsPDF, label: string, value: string, margin: number, y: number, pageWidth: number, meeting: MomMeeting) {
  y = ensureSpace(doc, y, 84, meeting);
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(80, 90, 105);
  doc.text(label, margin, y);
  y += 5;
  doc.setDrawColor(210, 218, 228);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(25, 35, 50);
  const lines = doc.splitTextToSize(value, pageWidth - margin * 2);
  lines.forEach((line: string) => {
    y = ensureSpace(doc, y, 18, meeting);
    doc.text(line, margin, y);
    y += 13;
  });

  return y + 6;
}

export function writeOfficialTable(doc: jsPDF, block: MomBlock, margin: number, y: number, pageWidth: number, meeting: MomMeeting) {
  const table = compactTableValue(block.value);
  if (!table.columns.length || !table.rows.length) return y;
  y = ensureSpace(doc, y, 90, meeting);
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(80, 90, 105);
  doc.text(block.label, margin - 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: margin, right: 48 },
    head: [table.columns.map((column) => column || "-")],
    body: table.rows.length ? table.rows.map((row) => table.columns.map((_, index) => row[index] || "")) : [table.columns.map(() => "")],
    styles: { font: "times", fontSize: 9, cellPadding: 4, lineColor: [190, 198, 208], lineWidth: 0.4, textColor: [25, 35, 50] },
    headStyles: { fillColor: [242, 246, 250], textColor: [25, 35, 50], fontStyle: "bold" },
    tableWidth: pageWidth - margin - 48,
    didDrawPage: () => drawPageHeader(doc, meeting, doc.getNumberOfPages()),
  });

  return ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || y) + 12;
}

export function addPageNumbers(doc: jsPDF, meeting: MomMeeting) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 2; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 98, 110);
    doc.text(`Minutes of ${meeting.title} | Page ${page - 1} of ${pageCount - 1}`, pageWidth / 2, pageHeight - 28, { align: "center" });
  }
}

export async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
