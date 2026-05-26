import { Request, Response } from 'express';
import Meeting, { MomStatus } from '../models/Meeting';
import { generateMomPdf } from '../utils/generateMomPdf';

const populateMeeting = (id: string) => Meeting.findById(id)
  .populate('organizerId', 'name email department')
  .populate('participants.user', 'name email department')
  .populate('attendance', 'name email department');

const normalizeAgendaItems = (items: any[] = []) => items.map((item, index) => ({
  sourceAgendaId: item.sourceAgendaId || null,
  itemNumber: item.itemNumber,
  sectionTag: item.sectionTag || '',
  sectionGroup: item.sectionGroup || 'Procedural',
  subject: item.subject,
  backgroundNote: item.backgroundNote || '',
  decision: item.decision || '',
  actionRequired: item.actionRequired || '',
  responsiblePerson: item.responsiblePerson || '',
  targetDate: item.targetDate || null,
  order: typeof item.order === 'number' ? item.order : index,
}));

const normalizeCoverDetails = (details: any = {}) => ({
  meetingNumber: details.meetingNumber || '',
  meetingBody: details.meetingBody || 'Board of Governors',
  instituteName: details.instituteName || 'National Institute of Technology Calicut',
  dateLine: details.dateLine || '',
  venueLine: details.venueLine || '',
});

export const getMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await populateMeeting(req.params.id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: 'Server error while loading MoM', error });
  }
};

export const saveMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { membersPresent, agendaItems, momCoverDetails, momStatus } = req.body;
    const update = {
      membersPresent: membersPresent || [],
      agendaItems: normalizeAgendaItems(agendaItems),
      momCoverDetails: normalizeCoverDetails(momCoverDetails),
      momStatus: momStatus === MomStatus.Confirmed ? MomStatus.Confirmed : MomStatus.Draft,
    };

    const meeting = await Meeting.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    res.json(await populateMeeting(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Server error while saving MoM', error });
  }
};

export const patchMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const update: any = {};
    if (Array.isArray(req.body.membersPresent)) update.membersPresent = req.body.membersPresent;
    if (Array.isArray(req.body.agendaItems)) update.agendaItems = normalizeAgendaItems(req.body.agendaItems);
    if (req.body.momCoverDetails) update.momCoverDetails = normalizeCoverDetails(req.body.momCoverDetails);
    if (req.body.momStatus) update.momStatus = req.body.momStatus;

    const meeting = await Meeting.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    res.json(await populateMeeting(req.params.id));
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating MoM', error });
  }
};

export const exportMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await populateMeeting(req.params.id);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    const pdf = await generateMomPdf(meeting);
    const filename = `${meeting.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'mom'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ message: 'Server error while exporting MoM', error });
  }
};
