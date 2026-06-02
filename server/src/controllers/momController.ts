import { Request, Response } from 'express';
import Meeting, { MomStatus } from '../models/Meeting';
import { generateMomPdf } from '../utils/generateMomPdf';
import { AuthRequest } from '../middleware/auth.middleware';

const populateMeeting = (id: string) => Meeting.findById(id)
  .populate('organizerId', 'name email department')
  .populate('participants.user', 'name email department')
  .populate('momApprovals.user', 'name email department')
  .populate('attendance', 'name email department');

const getUserId = (user: any) => user?._id?.toString?.() || user?.id?.toString?.() || user?.toString?.() || '';

const getMomReviewers = (meeting: any) => {
  const reviewers = new Map<string, any>();
  const addUser = (user: any) => {
    const userId = getUserId(user);
    if (!userId || reviewers.has(userId)) return;
    reviewers.set(userId, {
      userId,
      name: user?.name || user?.email || 'Unnamed participant',
      email: user?.email || '',
      department: user?.department || '',
    });
  };

  addUser(meeting.organizerId);
  (meeting.participants || []).forEach((participant: any) => addUser(participant.user));

  return [...reviewers.values()];
};

const buildApprovalStatus = (meeting: any) => {
  const approvedBy = new Map(
    (meeting.momApprovals || []).map((approval: any) => [
      getUserId(approval.user),
      approval.approvedAt,
    ])
  );

  return getMomReviewers(meeting).map((reviewer) => ({
    ...reviewer,
    approved: approvedBy.has(reviewer.userId),
    approvedAt: approvedBy.get(reviewer.userId) || null,
  }));
};

const getPendingApprovals = (meeting: any) => buildApprovalStatus(meeting)
  .filter((approval) => !approval.approved);

const hasEveryoneApproved = (meeting: any) => {
  const approvalStatus = buildApprovalStatus(meeting);
  return approvalStatus.length > 0 && approvalStatus.every((approval) => approval.approved);
};

const deriveMembersFromParticipants = (meeting: any) => {
  const mode = meeting.mode === 'Online' ? 'Online' : meeting.mode === 'Hybrid' ? 'Hybrid' : 'In person';

  return (meeting.participants || [])
    .map((participant: any) => {
      const user = participant.user;
      if (!user || typeof user === 'string') return null;

      return {
        name: user.name || user.email || 'Unnamed participant',
        designation: user.department || 'Invited participant',
        attendanceMode: mode,
      };
    })
    .filter(Boolean);
};

const withDerivedMomMembers = (meeting: any) => {
  if (!meeting) return meeting;
  const meetingObject = typeof meeting.toObject === 'function' ? meeting.toObject() : meeting;
  return {
    ...meetingObject,
    membersPresent: deriveMembersFromParticipants(meetingObject),
    momCoverDetails: buildCoverDetailsFromMeeting(meetingObject, meetingObject.momCoverDetails),
    momApprovalStatus: buildApprovalStatus(meetingObject),
  };
};

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

const comparableAgendaItems = (items: any[] = []) => normalizeAgendaItems(items).map((item) => ({
  sourceAgendaId: item.sourceAgendaId?.toString?.() || item.sourceAgendaId || null,
  itemNumber: item.itemNumber || '',
  sectionTag: item.sectionTag || '',
  sectionGroup: item.sectionGroup || 'Procedural',
  subject: item.subject || '',
  backgroundNote: item.backgroundNote || '',
  decision: item.decision || '',
  actionRequired: item.actionRequired || '',
  responsiblePerson: item.responsiblePerson || '',
  targetDate: item.targetDate ? new Date(item.targetDate).toISOString().slice(0, 10) : null,
  order: item.order,
}));

const comparableCoverDetails = (details: any) => ({
  meetingNumber: details?.meetingNumber || '',
  meetingBody: details?.meetingBody || '',
  instituteName: details?.instituteName || '',
  dateLine: details?.dateLine || '',
  venueLine: details?.venueLine || '',
});

const hasSameMomContent = (target: any, agendaItems: any[] = [], momCoverDetails: any = {}) => {
  const incomingCover = buildCoverDetailsFromMeeting(target, momCoverDetails);
  const savedCover = buildCoverDetailsFromMeeting(target, target.momCoverDetails);

  return JSON.stringify(comparableAgendaItems(agendaItems)) === JSON.stringify(comparableAgendaItems(target.agendaItems || []))
    && JSON.stringify(comparableCoverDetails(incomingCover)) === JSON.stringify(comparableCoverDetails(savedCover));
};

const normalizeCoverDetails = (details: any = {}) => ({
  meetingNumber: details.meetingNumber || '',
  meetingBody: details.meetingBody || 'Board of Governors',
  instituteName: details.instituteName || 'National Institute of Technology Calicut',
  dateLine: details.dateLine || '',
  venueLine: details.venueLine || '',
});

function buildCoverDetailsFromMeeting(meeting: any, details: any = {}) {
  return {
    ...normalizeCoverDetails(details),
    dateLine: `on ${new Date(meeting.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} from ${meeting.startTime || 'start time'} to ${meeting.endTime || 'end time'}`,
    venueLine: `${meeting.mode || 'Meeting'} mode at ${meeting.venue || meeting.link || 'the notified venue'}`,
  };
}

export const getMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await populateMeeting(req.params.id as string);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    res.json(withDerivedMomMembers(meeting));
  } catch (error) {
    res.status(500).json({ message: 'Server error while loading MoM', error });
  }
};

export const saveMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agendaItems, momCoverDetails, momStatus } = req.body;
    const target = await populateMeeting(req.params.id as string);
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (target.momStatus === MomStatus.Confirmed) {
      res.status(423).json({ message: 'This MoM is confirmed and can no longer be changed.' });
      return;
    }
    if (momStatus === MomStatus.Confirmed && !hasEveryoneApproved(target)) {
      const pending = getPendingApprovals(target).map((approval) => approval.name).join(', ');
      res.status(400).json({ message: `All meeting members must approve before confirmation. Pending: ${pending || 'No reviewers found'}.` });
      return;
    }
    if (momStatus === MomStatus.Confirmed && !hasSameMomContent(target, agendaItems, momCoverDetails)) {
      res.status(400).json({ message: 'Save the latest draft first, then collect approvals again before confirmation.' });
      return;
    }

    const update = {
      membersPresent: deriveMembersFromParticipants(target),
      agendaItems: normalizeAgendaItems(agendaItems),
      momCoverDetails: buildCoverDetailsFromMeeting(target, momCoverDetails),
      momStatus: momStatus === MomStatus.Confirmed ? MomStatus.Confirmed : MomStatus.Draft,
      ...(momStatus === MomStatus.Confirmed ? {} : { momApprovals: [] }),
    };

    const meeting = await Meeting.findByIdAndUpdate(req.params.id as string, update, {
      new: true,
      runValidators: true,
    });

    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    res.json(withDerivedMomMembers(await populateMeeting(req.params.id as string)));
  } catch (error) {
    res.status(500).json({ message: 'Server error while saving MoM', error });
  }
};

export const patchMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const update: any = {};
    const target = await populateMeeting(req.params.id as string);
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (target.momStatus === MomStatus.Confirmed) {
      res.status(423).json({ message: 'This MoM is confirmed and can no longer be changed.' });
      return;
    }

    update.membersPresent = deriveMembersFromParticipants(target);
    if (Array.isArray(req.body.agendaItems)) update.agendaItems = normalizeAgendaItems(req.body.agendaItems);
    if (req.body.momCoverDetails) update.momCoverDetails = buildCoverDetailsFromMeeting(target, req.body.momCoverDetails);
    if (req.body.momStatus) update.momStatus = req.body.momStatus;

    const meeting = await Meeting.findByIdAndUpdate(req.params.id as string, update, {
      new: true,
      runValidators: true,
    });

    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }

    res.json(withDerivedMomMembers(await populateMeeting(req.params.id as string)));
  } catch (error) {
    res.status(500).json({ message: 'Server error while updating MoM', error });
  }
};

export const approveMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const currentUserId = authReq.user?.id;
    if (!currentUserId) {
      res.status(401).json({ message: 'Log in before approving the MoM.' });
      return;
    }

    const target = await populateMeeting(req.params.id as string);
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (target.momStatus === MomStatus.Confirmed) {
      res.status(423).json({ message: 'This MoM is already confirmed and locked.' });
      return;
    }

    const reviewerIds = new Set(getMomReviewers(target).map((reviewer) => reviewer.userId));
    if (!reviewerIds.has(currentUserId)) {
      res.status(403).json({ message: 'Only meeting members can approve this MoM.' });
      return;
    }

    const alreadyApproved = (target.momApprovals || []).some((approval: any) => getUserId(approval.user) === currentUserId);
    if (!alreadyApproved) {
      await Meeting.findByIdAndUpdate(req.params.id as string, {
        $push: { momApprovals: { user: currentUserId, approvedAt: new Date() } },
      });
    }

    res.json(withDerivedMomMembers(await populateMeeting(req.params.id as string)));
  } catch (error) {
    res.status(500).json({ message: 'Server error while approving MoM', error });
  }
};

export const exportMom = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await populateMeeting(req.params.id as string);
    if (!meeting) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (meeting.momStatus !== MomStatus.Confirmed) {
      res.status(400).json({ message: 'Confirm the MoM before exporting.' });
      return;
    }
    if (!hasEveryoneApproved(meeting)) {
      const pending = getPendingApprovals(meeting).map((approval) => approval.name).join(', ');
      res.status(400).json({ message: `All meeting members must approve before export. Pending: ${pending || 'No reviewers found'}.` });
      return;
    }

    const pdf = await generateMomPdf(withDerivedMomMembers(meeting) as any);
    const filename = `${meeting.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'mom'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ message: 'Server error while exporting MoM', error });
  }
};
