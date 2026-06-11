import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Meeting from '../models/Meeting';
import Agenda from '../models/Agenda';
import { protect } from '../middleware/auth.middleware';
import { populateMeeting, withDerivedMomMembers } from '../controllers/momController';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `meeting-${req.params.id}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Excel files are allowed.'));
    }
  }
});

const agendaDocUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const agendaDir = path.join(uploadDir, 'agenda-docs');
      if (!fs.existsSync(agendaDir)) fs.mkdirSync(agendaDir, { recursive: true });
      cb(null, agendaDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `agenda-${req.params.agendaId}-${uniqueSuffix}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, Word, Excel, JPEG, PNG.'));
    }
  }
});

const momUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word files are allowed.'));
    }
  }
});

router.use(protect);

router.post('/:id/upload-report', upload.single('reportFile'), async (req: Request, res: Response) => {
  try {
    const meetingId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded or invalid file type.' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      // Remove uploaded file if meeting not found
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Only allow Organizer, Admin, SuperAdmin
    const user = (req as any).user;
    const isOrganizer = meeting.organizerId.toString() === user.id;
    const isAdmin = ['Admin', 'SuperAdmin'].includes(user.role);

    if (!isOrganizer && !isAdmin) {
      fs.unlinkSync(file.path);
      return res.status(403).json({ message: 'Only the organizer or an admin can upload reports.' });
    }

    // Create a relative URL path to serve the file
    const fileUrl = `/uploads/${file.filename}`;
    
    // If there was an old file, we could optionally delete it here to save space
    if (meeting.offlineReportFileUrl) {
      const oldPath = path.join(__dirname, '../../', meeting.offlineReportFileUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    meeting.offlineReportFileUrl = fileUrl;
    await meeting.save();

    res.status(200).json({ 
      message: 'File uploaded successfully', 
      offlineReportFileUrl: fileUrl 
    });

  } catch (error) {
    res.status(500).json({ message: 'Error uploading file', error: (error as any).message });
  }
});

router.post('/:id/upload-mom', momUpload.single('momFile'), async (req: Request, res: Response) => {
  try {
    const meetingId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded or invalid file type.' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Only allow Organizer, Admin, SuperAdmin
    const user = (req as any).user;
    const isOrganizer = meeting.organizerId.toString() === user.id;
    const isAdmin = ['Admin', 'SuperAdmin'].includes(user.role);

    if (!isOrganizer && !isAdmin) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(403).json({ message: 'Only the organizer or an admin can upload offline MoM files.' });
    }

    // Create a relative URL path to serve the file
    const fileUrl = `/uploads/${file.filename}`;
    
    // Delete old file if present to save space
    if (meeting.offlineMomFileUrl) {
      const oldPath = path.join(__dirname, '../../', meeting.offlineMomFileUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    meeting.offlineMomFileUrl = fileUrl;
    await meeting.save();

    const updatedMeeting = await populateMeeting(meetingId as string);
    res.status(200).json({ 
      message: 'MoM file uploaded successfully', 
      offlineMomFileUrl: fileUrl,
      meeting: withDerivedMomMembers(updatedMeeting)
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error uploading MoM file', error: (error as any).message });
  }
});

router.delete('/:id/upload-mom', async (req: Request, res: Response) => {
  try {
    const meetingId = req.params.id;
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Only allow Organizer, Admin, SuperAdmin
    const user = (req as any).user;
    const isOrganizer = meeting.organizerId.toString() === user.id;
    const isAdmin = ['Admin', 'SuperAdmin'].includes(user.role);

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ message: 'Only the organizer or an admin can delete the MoM file.' });
    }

    if (meeting.offlineMomFileUrl) {
      const filePath = path.join(__dirname, '../../', meeting.offlineMomFileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      meeting.offlineMomFileUrl = undefined;
      await meeting.save();
    }

    const updatedMeeting = await populateMeeting(meetingId as string);
    res.status(200).json({ 
      message: 'MoM file deleted successfully', 
      meeting: withDerivedMomMembers(updatedMeeting)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting MoM file', error: (error as any).message });
  }
});

// ─── Agenda Supporting Document Routes ─────────────────────────────────────

// POST /api/meetings/:meetingId/agendas/:agendaId/upload-document
router.post(
  '/:meetingId/agendas/:agendaId/upload-document',
  agendaDocUpload.single('document'),
  async (req: Request, res: Response) => {
    try {
      const { meetingId, agendaId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: 'No file uploaded or invalid file type.' });
      }

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ message: 'Meeting not found' });
      }

      const user = (req as any).user;
      const isOrganizer = meeting.organizerId.toString() === user.id;
      const isAdmin = ['Admin', 'SuperAdmin'].includes(user.role);
      const isParticipant = meeting.participants.some(
        (p: any) => p.user.toString() === user.id
      );

      // Allow organizer, admin, or any invited participant
      if (!isOrganizer && !isAdmin && !isParticipant) {
        fs.unlinkSync(file.path);
        return res.status(403).json({ message: 'You must be part of this meeting to upload documents.' });
      }

      const agenda = await Agenda.findById(agendaId);
      if (!agenda) {
        fs.unlinkSync(file.path);
        return res.status(404).json({ message: 'Agenda item not found' });
      }

      const fileUrl = `/uploads/agenda-docs/${file.filename}`;
      agenda.documents.push({
        fileName: file.originalname,
        fileUrl,
        uploadedAt: new Date(),
        uploadedBy: user.id,
      });
      await agenda.save();

      // Populate uploadedBy for the response
      const populated = await Agenda.findById(agendaId).populate('documents.uploadedBy', 'name email');

      res.status(200).json({
        message: 'Document uploaded successfully',
        documents: populated?.documents ?? agenda.documents,
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ message: 'Error uploading document', error: (error as any).message });
    }
  }
);

// DELETE /api/meetings/:meetingId/agendas/:agendaId/documents/:docIndex
router.delete(
  '/:meetingId/agendas/:agendaId/documents/:docIndex',
  async (req: Request, res: Response) => {
    try {
      const { meetingId, agendaId, docIndex } = req.params;
      const idx = parseInt(docIndex as string, 10);

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

      const user = (req as any).user;
      const isOrganizer = meeting.organizerId.toString() === user.id;
      const isAdmin = ['Admin', 'SuperAdmin'].includes(user.role);

      const agenda = await Agenda.findById(agendaId);
      if (!agenda) return res.status(404).json({ message: 'Agenda item not found' });

      if (isNaN(idx) || idx < 0 || idx >= agenda.documents.length) {
        return res.status(400).json({ message: 'Invalid document index' });
      }

      const doc = agenda.documents[idx];
      const isUploader = doc.uploadedBy?.toString() === user.id;

      // Allow: the person who uploaded it, or organizer/admin
      if (!isUploader && !isOrganizer && !isAdmin) {
        return res.status(403).json({ message: 'You can only delete documents you uploaded.' });
      }

      // Remove physical file
      const filePath = path.join(__dirname, '../../', doc.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      agenda.documents.splice(idx, 1);
      await agenda.save();

      // Populate uploadedBy for the response
      const populated = await Agenda.findById(agendaId).populate('documents.uploadedBy', 'name email');

      res.status(200).json({ message: 'Document deleted successfully', documents: populated?.documents ?? agenda.documents });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting document', error: (error as any).message });
    }
  }
);

export default router;
