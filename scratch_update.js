const fs = require('fs');

const file = fs.readFileSync('client/app/meetings/[id]/mom/page.tsx', 'utf-8');
const lines = file.split('\n');

const startIndex = lines.findIndex(l => l.startsWith('const logoPaths'));
const endIndex = lines.length;

let topContent = lines.slice(0, startIndex).join('\n');

const newImports = `
import { 
  logoPaths, buildingPaths, defaultCoverDetails, MeetingAgenda, deriveMembersFromParticipants, mergeCoverDetails, isCoverComplete, getOrganizerId, blockLabels, presetBlockTypes, createPresetBlocks, normalizeBlocks, normalizeAgendaItemForBlocks, normalizeAgendaItems, normalizeTableValue, compactTableValue, hasBlockDisplayValue, visibleBlocks, getBlockText, getBlockDisplayValue, mergeAgendaModuleItems, loadImage, exportMomPdf, exportMomWord, tableBlockToHtml, stripHtml, escapeHtml, formatDate, drawOfficialCover, drawPageHeader, ensureSpace, writeOfficialBlock, writeOfficialTable, addPageNumbers
} from "@/utils/pdfExport";

const emptyAgendaItem = (order: number): MomAgendaItem => ({
  _id: \`local-\${Date.now()}-\${order}\`,
  sourceAgendaId: null,
  itemNumber: "",
  sectionTag: "",
  sectionGroup: "Procedural",
  subject: "",
  backgroundNote: "",
  decision: "",
  actionRequired: "",
  responsiblePerson: "",
  targetDate: "",
  blocks: createPresetBlocks("Procedural"),
  order,
});
`;

fs.writeFileSync('client/app/meetings/[id]/mom/page.tsx', topContent + newImports + lines.slice(startIndex, lines.findIndex(l => l.startsWith('async function readJsonResponse'))).join('\n').replace(/const logoPaths = \[.*?\];/g, '').replace(/const buildingPaths = \[.*?\];/g, '').replace(/type JsPdfWithAutoTable.*?};/gs, '').replace(/const defaultCoverDetails =.*?}\);/gs, '').replace(/const emptyAgendaItem =.*?}\);/gs, '').replace(/interface MeetingAgenda \{.*?\}/gs, '') + '\n');
console.log('done');
