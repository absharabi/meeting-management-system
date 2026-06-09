const fs = require('fs');

const file = fs.readFileSync('client/app/meetings/[id]/mom/page.tsx', 'utf-8');
const lines = file.split('\n');

const startIndex = lines.findIndex(l => l.startsWith('function deriveMembersFromParticipants'));
const imports = `import jsPDF from "jspdf";
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
  dateLine: meeting ? \`on \${formatDate(meeting.date)} from \${meeting.startTime || "start time"} to \${meeting.endTime || "end time"}\` : "",
  venueLine: meeting ? \`\${meeting.mode || "Meeting"} mode at \${meeting.venue || meeting.link || "the notified venue"}\` : "",
});

`;

let contentToExtract = lines.slice(startIndex).join('\n');
contentToExtract = contentToExtract.replace(/function /g, 'export function ');
contentToExtract = contentToExtract.replace(/const blockLabels/g, 'export const blockLabels');
contentToExtract = contentToExtract.replace(/const presetBlockTypes/g, 'export const presetBlockTypes');

fs.writeFileSync('client/utils/pdfExport.ts', imports + contentToExtract);
console.log('done');
