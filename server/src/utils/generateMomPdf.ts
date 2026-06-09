import { IMeeting } from '../models/Meeting';

type PdfLine = {
  text: string;
  size?: number;
  bold?: boolean;
  indent?: number;
  table?: {
    columns: string[];
    rows: string[][];
  };
};

type SimpleTable = {
  columns: string[];
  rows: string[][];
};

const stripHtml = (value = '') => value
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const escapePdf = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const formatDate = (value?: Date | string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const blockLabels: Record<string, string> = {
  backgroundNote: 'Background Note',
  decision: 'Decision',
  actionRequired: 'Action Required',
  responsiblePerson: 'Responsible Person',
  targetDate: 'Target Date',
  annexureReference: 'Annexure Reference',
  status: 'Status',
  table: 'Table',
  customField: 'Custom Field',
};

const normalizeTable = (value: any): SimpleTable => ({
  columns: Array.isArray(value?.columns) && value.columns.length ? value.columns.map(String) : ['Column 1', 'Column 2'],
  rows: Array.isArray(value?.rows) && value.rows.length ? value.rows.map((row: any) => Array.isArray(row) ? row.map(String) : []) : [['', '']],
});

const compactTable = (value: any): SimpleTable => {
  const table = normalizeTable(value);
  const visibleColumnIndexes = table.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => column.trim() || table.rows.some((row) => String(row[index] || '').trim()))
    .map(({ index }) => index);
  const rows = table.rows
    .map((row) => visibleColumnIndexes.map((index) => String(row[index] || '')))
    .filter((row) => row.some((cell) => cell.trim()));

  return {
    columns: visibleColumnIndexes.map((index) => table.columns[index] || `Column ${index + 1}`),
    rows,
  };
};

const normalizeBlocks = (item: any) => {
  if (Array.isArray(item.blocks) && item.blocks.length) {
    return item.blocks.map((block: any) => ({
      type: block.type || 'customField',
      label: block.label || blockLabels[block.type] || 'Field',
      value: block.type === 'table' ? normalizeTable(block.value) : String(block.value || ''),
    }));
  }

  return [
    { type: 'backgroundNote', label: 'Background Note', value: item.backgroundNote || '' },
    { type: 'decision', label: 'Decision', value: item.decision || '' },
    { type: 'actionRequired', label: 'Action Required', value: item.actionRequired || '' },
    { type: 'responsiblePerson', label: 'Responsible Person', value: item.responsiblePerson || '' },
    { type: 'targetDate', label: 'Target Date', value: item.targetDate || '' },
  ];
};

const blockDisplayValue = (block: any) => {
  if (block.type === 'backgroundNote' || block.type === 'decision') return stripHtml(block.value);
  if (block.type === 'targetDate') return formatDate(block.value);
  return String(block.value || '').trim();
};

const hasBlockValue = (block: any) => {
  if (block.type === 'table') {
    const table = compactTable(block.value);
    return table.columns.length > 0 && table.rows.length > 0;
  }
  return blockDisplayValue(block).length > 0;
};

const wrapText = (text: string, maxChars: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const buildLines = (meeting: IMeeting): PdfLine[] => {
  const agendaItems = [...(meeting.agendaItems || [])].sort((a, b) => a.order - b.order);
  const groups = ['Procedural', 'Consideration & Approval', 'Reporting', 'Any Other Matter'];
  const lines: PdfLine[] = [
    { text: 'NATIONAL INSTITUTE OF TECHNOLOGY CALICUT', size: 15, bold: true },
    { text: 'Board of Governors', size: 13, bold: true },
    { text: `Minutes of Meeting: ${meeting.title}`, size: 16, bold: true },
    { text: `Date: ${formatDate(meeting.date)}`, size: 11 },
    { text: `Venue: ${meeting.venue || meeting.link || 'Not specified'}`, size: 11 },
    { text: ' ' },
    { text: 'Members Present', size: 13, bold: true },
  ];

  if (meeting.membersPresent?.length) {
    meeting.membersPresent.forEach((member, index) => {
      lines.push({
        text: `${index + 1}. ${member.name || '-'} | ${member.designation || '-'} | ${member.attendanceMode || '-'}`,
        size: 10,
      });
    });
  } else {
    lines.push({ text: 'No members present recorded.', size: 10 });
  }

  lines.push({ text: ' ' }, { text: 'Agenda Items', size: 13, bold: true });

  groups.forEach((group) => {
    const groupItems = agendaItems.filter((item) => item.sectionGroup === group);
    if (!groupItems.length) return;

    lines.push({ text: group, size: 12, bold: true });
    groupItems.forEach((item) => {
      const agendaNo = [item.sectionTag, item.itemNumber].filter(Boolean).join(' / ');
      lines.push({ text: `Item ${agendaNo || String(item.order + 1).padStart(2, '0')} - ${item.subject}`, size: 11, bold: true });
      normalizeBlocks(item).filter(hasBlockValue).forEach((block: any) => {
        if (block.type === 'table') {
          const table = compactTable(block.value);
          lines.push({ text: block.label, size: 10, bold: true, indent: 12 });
          lines.push({ text: '', size: 9, indent: 24, table });
          return;
        }
        lines.push({ text: block.label, size: 10, bold: true, indent: 12 });
        lines.push({ text: blockDisplayValue(block), size: 10, indent: 24 });
      });

      if (item.comments && item.comments.length > 0) {
        lines.push({ text: 'Participant Comments', size: 10, bold: true, indent: 12 });
        item.comments.forEach((comment: any) => {
          const dateStr = new Date(comment.createdAt).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });
          lines.push({ text: `${comment.userName} (${dateStr}):`, size: 10, bold: true, indent: 24 });
          lines.push({ text: comment.text, size: 10, indent: 36 });
        });
      }

      lines.push({ text: ' ' });
    });
  });

  lines.push({ text: ' ' });
  lines.push({ text: 'The meeting ended with thanks to the Chair.', size: 10 });
  lines.push({ text: ' ' });
  lines.push({ text: 'Approved By', size: 13, bold: true });

  const approvalStatus = (meeting as any).momApprovalStatus || [];
  const approvedMembers = approvalStatus.filter((a: any) => a.approved);

  if (approvedMembers.length > 0) {
    approvedMembers.forEach((member: any) => {
      lines.push({ text: `${member.name} (${member.department || 'Member'})`, size: 10, indent: 12 });
    });
  } else {
    lines.push({ text: 'No approvals recorded.', size: 10, indent: 12 });
  }

  return lines;
};

const buildPageContent = (lines: PdfLine[], pageNumber: number, totalPages: number, meeting: IMeeting) => {
  const commands = [
    '0.08 0.18 0.31 rg',
    '0 796 595 46 re f',
    'BT',
    '/F2 10 Tf',
    '1 1 1 rg',
    '50 822 Td',
    `(National Institute of Technology Calicut) Tj`,
    'ET',
    'BT',
    '/F1 8 Tf',
    '0.25 0.30 0.36 rg',
    '50 32 Td',
    `(Minutes of the ${escapePdf(meeting.title)} Page ${pageNumber} of ${totalPages}) Tj`,
    'ET',
  ];

  let y = 760;
  lines.forEach((line) => {
    if (line.table) {
      const columns = line.table.columns.length ? line.table.columns : ['Column 1'];
      const rows = line.table.rows.length ? line.table.rows : [columns.map(() => '')];
      const indent = line.indent || 0;
      const x = 50 + indent;
      const tableWidth = 500 - indent;
      const cellWidth = tableWidth / columns.length;
      const rowHeight = 18;

      const drawRow = (cells: string[], bold = false) => {
        cells.forEach((cell, index) => {
          const cellX = x + index * cellWidth;
          commands.push('0.92 0.95 0.98 rg', `${cellX} ${y - 4} ${cellWidth} ${rowHeight} re ${bold ? 'f' : 'S'}`);
          commands.push('0.72 0.76 0.80 RG', `${cellX} ${y - 4} ${cellWidth} ${rowHeight} re S`);
          commands.push('BT', `/${bold ? 'F2' : 'F1'} 8 Tf`, '0 0 0 rg', `${cellX + 4} ${y + 6} Td`, `(${escapePdf(wrapText(String(cell || '-'), Math.max(8, Math.floor(cellWidth / 5)))[0] || '-')}) Tj`, 'ET');
        });
        y -= rowHeight;
      };

      drawRow(columns, true);
      rows.forEach((row) => drawRow(columns.map((_, index) => row[index] || ''), false));
      y -= 8;
      return;
    }

    const size = line.size || 10;
    const font = line.bold ? 'F2' : 'F1';
    const indent = line.indent || 0;
    const maxChars = Math.max(40, Math.floor((92 - indent / 7) * (10 / size)));
    const wrapped = wrapText(line.text, maxChars);

    wrapped.forEach((part) => {
      commands.push('BT', `/${font} ${size} Tf`, '0 0 0 rg', `${50 + indent} ${y} Td`, `(${escapePdf(part)}) Tj`, 'ET');
      y -= size + 5;
    });
    y -= 3;
  });

  return commands.join('\n');
};

const buildCoverPageContent = (meeting: IMeeting) => {
  const cover = {
    meetingNumber: meeting.momCoverDetails?.meetingNumber || 'Nth',
    meetingBody: meeting.momCoverDetails?.meetingBody || 'Board of Governors',
    instituteName: meeting.momCoverDetails?.instituteName || 'National Institute of Technology Calicut',
    dateLine: meeting.momCoverDetails?.dateLine || `on ${formatDate(meeting.date)}`,
    venueLine: meeting.momCoverDetails?.venueLine || meeting.venue || meeting.link || 'Venue not specified',
  };

  return [
    '1 1 1 rg',
    '0 0 595 842 re f',
    '0.88 0.92 0.97 rg',
    '266 746 64 64 re f',
    'BT',
    '/F2 8 Tf',
    '0.08 0.28 0.52 rg',
    '297 776 Td',
    `(NITC) Tj`,
    'ET',
    'BT',
    '/F2 26 Tf',
    '0 0.68 0.94 rg',
    '297 666 Td',
    `(Minutes) Tj`,
    'ET',
    'BT',
    '/F2 32 Tf',
    '0.80 0 0 rg',
    '297 622 Td',
    `(of the ${escapePdf(cover.meetingNumber)}) Tj`,
    'ET',
    'BT',
    '/F2 20 Tf',
    '0.80 0 0 rg',
    '297 572 Td',
    `(Meeting of the) Tj`,
    'ET',
    'BT',
    '/F2 32 Tf',
    '0 0.62 0.25 rg',
    '297 528 Td',
    `(${escapePdf(cover.meetingBody)}) Tj`,
    'ET',
    'BT',
    '/F1 18 Tf',
    '0.80 0 0 rg',
    '297 492 Td',
    `(of the ${escapePdf(cover.instituteName)}) Tj`,
    'ET',
    'BT',
    '/F1 20 Tf',
    '0 0.68 0.94 rg',
    '297 414 Td',
    `(${escapePdf(cover.dateLine)}) Tj`,
    'ET',
    'BT',
    '/F1 14 Tf',
    '0 0 0 rg',
    '297 330 Td',
    `(${escapePdf(cover.venueLine)}) Tj`,
    'ET',
    '0.88 0.92 0.97 rg',
    '143 52 310 118 re f',
    'BT',
    '/F1 10 Tf',
    '0.35 0.42 0.50 rg',
    '297 108 Td',
    `(NIT Calicut campus image area) Tj`,
    'ET',
  ].join('\n');
};

export const generateMomPdf = async (meeting: IMeeting): Promise<Buffer> => {
  const sourceLines = buildLines(meeting);
  const pages: PdfLine[][] = [];
  let current: PdfLine[] = [];
  let usedHeight = 0;

  sourceLines.forEach((line) => {
    const size = line.size || 10;
    const wrappedCount = line.table ? (line.table.rows.length + 1) : wrapText(line.text, 92).length;
    const height = line.table ? wrappedCount * 18 + 12 : wrappedCount * (size + 5) + 3;
    if (usedHeight + height > 700 && current.length) {
      pages.push(current);
      current = [];
      usedHeight = 0;
    }
    current.push(line);
    usedHeight += height;
  });
  if (current.length) pages.push(current);

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [5 0 R ${pages.map((_, index) => `${7 + index * 2} 0 R`).join(' ')}] /Count ${pages.length + 1} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>',
    `<< /Length ${Buffer.byteLength(buildCoverPageContent(meeting))} >>\nstream\n${buildCoverPageContent(meeting)}\nendstream`,
  ];

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = 7 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const content = buildPageContent(pageLines, index + 2, pages.length + 1, meeting);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf);
};
