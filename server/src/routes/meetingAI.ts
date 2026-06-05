import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import Meeting, { MomStatus } from '../models/Meeting';
import Agenda from '../models/Agenda';
import { protect } from '../middleware/auth.middleware';
import { summarizeTranscript } from '../ai/summarizer';
import { generateMomPdf } from '../utils/generateMomPdf';

const router = Router();
const execAsync = promisify(exec);

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExtensions = new Set(['.txt', '.wav', '.mp3', '.m4a', '.mp4', '.mov', '.webm']);
const audioExtensions = new Set(['.wav', '.mp3', '.m4a']);
const videoExtensions = new Set(['.mp4', '.mov', '.webm']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ai-meeting-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      cb(new Error('Unsupported file type. Upload txt, wav, mp3, m4a, mp4, mov, or webm.'));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 250 * 1024 * 1024,
  },
});

const quotePath = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

const normalizeToWav = async (inputPath: string): Promise<string> => {
  const parsed = path.parse(inputPath);
  const outputPath = path.join(parsed.dir, `${parsed.name}-normalized.wav`);
  const command = `ffmpeg -y -i ${quotePath(inputPath)} -vn -acodec pcm_s16le -ar 16000 -ac 1 ${quotePath(outputPath)}`;
  await execAsync(command, { maxBuffer: 1024 * 1024 * 20 });
  return outputPath;
};

const transcribeAudio = async (audioPath: string): Promise<string> => {
  const scriptPath = path.resolve(process.cwd(), 'src', 'ai', 'transcribe.py');
  const pythonCommand = process.env.PYTHON_COMMAND || 'python';
  const whisperModel = process.env.WHISPER_MODEL || 'base';
  const command = `${pythonCommand} ${quotePath(scriptPath)} ${quotePath(audioPath)} ${whisperModel}`;
  const { stdout, stderr } = await execAsync(command, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 50,
  });

  const transcript = stdout.trim();
  if (!transcript) {
    throw new Error(stderr.trim() || 'Whisper did not detect any transcript in this file.');
  }

  return transcript;
};

const getTranscriptFromUpload = async (filePath: string, ext: string): Promise<string> => {
  if (ext === '.txt') {
    return fs.promises.readFile(filePath, 'utf8');
  }

  if (audioExtensions.has(ext) || videoExtensions.has(ext)) {
    const wavPath = await normalizeToWav(filePath);
    return transcribeAudio(wavPath);
  }

  throw new Error('Unsupported file type.');
};

const toCleanStringArray = (value: any) => (Array.isArray(value) ? value : [])
  .map((item) => String(item).trim())
  .filter(Boolean);

const parseDeadline = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildAgendaItemsFromModule = async (meetingId: string) => {
  const agendas = await Agenda.find({ meetingId }).sort({ sequence: 1 });
  return agendas.map((agenda: any, index) => ({
    sourceAgendaId: agenda._id,
    itemNumber: String(agenda.sequence || index + 1).padStart(2, '0'),
    sectionTag: '',
    sectionGroup: 'Procedural',
    subject: agenda.title || '',
    backgroundNote: agenda.description || '',
    decision: '',
    actionRequired: '',
    responsiblePerson: '',
    targetDate: null,
    order: index,
  }));
};

router.use(protect);

router.post('/:id/summary', upload.single('meetingFile'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No transcript, audio, or video file uploaded.' });
      return;
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found.' });
      return;
    }
    if (meeting.momStatus === MomStatus.Confirmed) {
      res.status(423).json({ message: 'This MoM is confirmed and can no longer be changed.' });
      return;
    }

    const requestingUser = (req as any).user;
    if (
      meeting.organizerId.toString() !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'Only the organizer or an admin can generate an AI summary.' });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const transcript = (await getTranscriptFromUpload(req.file.path, ext)).trim();
    if (!transcript) {
      res.status(400).json({ message: 'No transcript text could be detected from this file.' });
      return;
    }

    const summary = await summarizeTranscript(transcript);

    meeting.aiTranscript = transcript;
    meeting.aiSummary = summary.summary;
    meeting.aiKeyPoints = summary.keyPoints;
    meeting.aiDecisions = summary.decisions;
    meeting.aiActionItems = summary.actionItems;
    meeting.aiRisks = summary.risks;
    meeting.aiSummaryGeneratedAt = new Date();

    await meeting.save();

    res.json({
      message: 'AI summary generated successfully.',
      meeting,
      ai: {
        transcript: meeting.aiTranscript,
        summary: meeting.aiSummary,
        keyPoints: meeting.aiKeyPoints,
        decisions: meeting.aiDecisions,
        actionItems: meeting.aiActionItems,
        risks: meeting.aiRisks,
        generatedAt: meeting.aiSummaryGeneratedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate AI meeting summary.',
    });
  }
});

router.post('/:id/mom-draft', async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found.' });
      return;
    }

    const requestingUser = (req as any).user;
    if (
      meeting.organizerId.toString() !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'Only the organizer or an admin can modify the MoM.' });
      return;
    }

    const summaryText = typeof req.body?.summary === 'string' ? req.body.summary.trim() : meeting.aiSummary;
    const keyPoints = Array.isArray(req.body?.keyPoints) ? req.body.keyPoints : meeting.aiKeyPoints;
    const decisions = Array.isArray(req.body?.decisions) ? req.body.decisions : meeting.aiDecisions;
    const risks = Array.isArray(req.body?.risks) ? req.body.risks : meeting.aiRisks;
    const actionItems = Array.isArray(req.body?.actionItems) ? req.body.actionItems : meeting.aiActionItems;

    if (!summaryText && !keyPoints?.length && !decisions?.length && !actionItems?.length) {
      res.status(400).json({ message: 'Generate an AI summary before creating a MoM draft.' });
      return;
    }

    meeting.aiSummary = summaryText || '';
    meeting.aiKeyPoints = toCleanStringArray(keyPoints);
    meeting.aiDecisions = toCleanStringArray(decisions);
    meeting.aiRisks = toCleanStringArray(risks);
    meeting.aiActionItems = actionItems
      .map((item: any) => ({
        task: String(item.task || '').trim(),
        owner: String(item.owner || '').trim(),
        deadline: String(item.deadline || '').trim(),
      }))
      .filter((item: any) => item.task);

    const existingAgendaItems = meeting.agendaItems?.length
      ? [...meeting.agendaItems].sort((a: any, b: any) => a.order - b.order)
      : await buildAgendaItemsFromModule(meeting._id.toString());

    const fallbackBackground = [
      meeting.aiSummary,
      meeting.aiKeyPoints?.length ? meeting.aiKeyPoints.map((point) => `- ${point}`).join('\n') : '',
      meeting.aiRisks?.length ? `Risks / blockers:\n${meeting.aiRisks.map((risk) => `- ${risk}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const agendaItemsToFill = existingAgendaItems.length ? existingAgendaItems : [{
      itemNumber: '01',
      sectionTag: '',
      sectionGroup: 'Reporting',
      subject: 'AI-generated meeting overview',
      backgroundNote: '',
      decision: '',
      actionRequired: '',
      responsiblePerson: '',
      targetDate: null,
      order: 0,
    }];

    const filledAgendaItems = agendaItemsToFill.map((item: any, index) => {
      const actionItem = meeting.aiActionItems?.[index];
      const decision = meeting.aiDecisions?.[index] || (index === 0 ? meeting.aiDecisions?.join('\n') : '');
      const targetDate = item.targetDate || parseDeadline(actionItem?.deadline);

      return {
        sourceAgendaId: item.sourceAgendaId || null,
        itemNumber: item.itemNumber || String(index + 1).padStart(2, '0'),
        sectionTag: item.sectionTag || '',
        sectionGroup: item.sectionGroup || 'Procedural',
        subject: item.subject || actionItem?.task || `Agenda item ${index + 1}`,
        backgroundNote: item.backgroundNote || fallbackBackground,
        decision: item.decision || decision || '',
        actionRequired: item.actionRequired || actionItem?.task || '',
        responsiblePerson: item.responsiblePerson || actionItem?.owner || '',
        targetDate,
        order: index,
      };
    });

    meeting.agendaItems = filledAgendaItems as any;
    meeting.momApprovals = [] as any;
    await meeting.save();

    res.json({
      message: 'MoM remaining fields filled from AI summary.',
      meeting,
      agendaItems: filledAgendaItems,
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate MoM draft from AI summary.',
    });
  }
});

router.get('/:id/ai-mom-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizerId', 'name email department')
      .populate('participants.user', 'name email department')
      .populate('attendance', 'name email department');

    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found.' });
      return;
    }

    if (!meeting.agendaItems?.length) {
      res.status(400).json({ message: 'Approve the AI draft before exporting MoM PDF.' });
      return;
    }

    const pdf = await generateMomPdf(meeting as any);
    const filename = `${meeting.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'mom'}-ai-draft.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to export MoM PDF.',
    });
  }
});

export default router;
