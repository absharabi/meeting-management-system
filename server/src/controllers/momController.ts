import { Request, Response } from 'express';
import Meeting, { MomStatus } from '../models/Meeting';
import { generateMomPdf } from '../utils/generateMomPdf';
import { rejectCancelledMeeting } from '../utils/meetingState';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendEmail } from '../utils/email';
import { canManageMeeting, hasAcceptedParticipantAccess } from '../utils/meetingAccess';

export const populateMeeting = (id: string) => Meeting.findById(id)
  .populate('organizerId', 'name email department')
  .populate('participants.user', 'name email department')
  .populate('momApprovals.user', 'name email department')
  .populate('attendance', 'name email department');

const getUserId = (user: any) => user?._id?.toString?.() || user?.id?.toString?.() || user?.toString?.() || '';

const getMomReviewers = (meeting: any) => {
  const reviewers = new Map<string, any>();
  const addUser = (user: any) => {
    let targetUser = user;
    const userId = getUserId(user);

    // If the attended user is an approved nominee, substitute them with the original participant
    const participantRecord = meeting.participants?.find((p: any) => {
      const nomineeId = p.nominee?._id?.toString() || p.nominee?.toString();
      return nomineeId === userId && p.nomineeStatus === 'Approved';
    });

    if (participantRecord && participantRecord.user) {
      targetUser = participantRecord.user;
    }

    const finalUserId = getUserId(targetUser);
    if (!finalUserId || reviewers.has(finalUserId)) return;

    reviewers.set(finalUserId, {
      userId: finalUserId,
      name: targetUser?.name || targetUser?.email || 'Unnamed participant',
      email: targetUser?.email || '',
      department: targetUser?.department || '',
    });
  };

  addUser(meeting.organizerId);
  (meeting.attendance || []).forEach((user: any) => {
    addUser(user);
  });

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

  const attendees = (meeting.attendance || [])
    .map((user: any) => {
      if (!user || typeof user === 'string') return null;

      const userId = user._id?.toString() || user.id?.toString() || '';
      
      const participantRecord = meeting.participants?.find((p: any) => {
        const nomineeId = p.nominee?._id?.toString() || p.nominee?.toString();
        return nomineeId === userId && p.nomineeStatus === 'Approved';
      });

      let finalUser = user;
      let finalUserId = userId;
      let attendanceMode = mode;

      if (participantRecord && participantRecord.user) {
        // Swap out the nominee for the OG participant
        finalUser = participantRecord.user;
        finalUserId = getUserId(participantRecord.user);
        attendanceMode = 'Nominated';
      }

      return {
        _userId: finalUserId,
        name: finalUser.name || finalUser.email || 'Unnamed participant',
        designation: finalUser.department || 'Attendee',
        attendanceMode,
      };
    })
    .filter(Boolean);

  if (meeting.organizerId && typeof meeting.organizerId !== 'string') {
    const orgId = meeting.organizerId._id?.toString() || meeting.organizerId.id?.toString() || '';
    const orgName = meeting.organizerId.name || meeting.organizerId.email || 'Organizer';
    if (!attendees.some((a: any) => a._userId && orgId && a._userId === orgId)) {
      attendees.unshift({
        _userId: orgId,
        name: orgName,
        designation: meeting.organizerId.department || 'Organizer',
        attendanceMode: mode,
      });
    }
  }

  return attendees.map((a: any) => {
    const { _userId, ...rest } = a;
    return rest;
  });
};

export const withDerivedMomMembers = (meeting: any) => {
  if (!meeting) return meeting;
  const meetingObject = typeof meeting.toObject === 'function' ? meeting.toObject() : meeting;
  return {
    ...meetingObject,
    membersPresent: deriveMembersFromParticipants(meetingObject),
    momCoverDetails: buildCoverDetailsFromMeeting(meetingObject, meetingObject.momCoverDetails),
    momApprovalStatus: buildApprovalStatus(meetingObject),
    isOfflineMomUploaded: !!meetingObject.offlineMomFileUrl,
  };
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

const presetBlockTypes: Record<string, string[]> = {
  Procedural: ['backgroundNote', 'decision'],
  'Consideration & Approval': ['backgroundNote', 'decision', 'actionRequired', 'responsiblePerson', 'targetDate'],
  Reporting: ['backgroundNote', 'decision', 'status'],
  'Any Other Matter': ['backgroundNote', 'decision'],
};

const createPresetBlocks = (sectionGroup: string, values: Record<string, any> = {}) => (
  (presetBlockTypes[sectionGroup] || presetBlockTypes.Procedural).map((type) => ({
    type,
    label: blockLabels[type],
    value: values[type] || (type === 'status' ? 'Pending' : ''),
  }))
);

const normalizeBlockValue = (block: any) => {
  if (block?.type === 'table') {
    const value = block.value && typeof block.value === 'object' ? block.value : {};
    return {
      columns: Array.isArray(value.columns) && value.columns.length ? value.columns.map(String) : ['Column 1', 'Column 2'],
      rows: Array.isArray(value.rows) && value.rows.length ? value.rows.map((row: any) => Array.isArray(row) ? row.map(String) : []) : [['', '']],
    };
  }
  return String(block?.value || '');
};

const normalizeBlocks = (item: any) => {
  if (Array.isArray(item.blocks) && item.blocks.length) {
    return item.blocks.map((block: any) => ({
      type: block.type || 'customField',
      label: block.label || blockLabels[block.type] || 'Field',
      value: normalizeBlockValue(block),
    }));
  }

  return createPresetBlocks(item.sectionGroup || 'Procedural', {
    backgroundNote: item.backgroundNote || '',
    decision: item.decision || '',
    actionRequired: item.actionRequired || '',
    responsiblePerson: item.responsiblePerson || '',
    targetDate: item.targetDate ? new Date(item.targetDate).toISOString().slice(0, 10) : '',
  });
};

const getBlockString = (blocks: any[], type: string) => {
  const value = blocks.find((block) => block.type === type)?.value;
  return typeof value === 'string' ? value : '';
};

const normalizeAgendaItems = (items: any[] = []) => items.map((item, index) => {
  const blocks = normalizeBlocks(item);
  return {
    ...item,
    sourceAgendaId: item.sourceAgendaId || null,
    itemNumber: item.itemNumber,
    sectionTag: item.sectionTag || '',
    sectionGroup: item.sectionGroup || 'Procedural',
    subject: item.subject,
    blocks,
    backgroundNote: getBlockString(blocks, 'backgroundNote') || item.backgroundNote || '',
    decision: getBlockString(blocks, 'decision') || item.decision || '',
    actionRequired: getBlockString(blocks, 'actionRequired') || item.actionRequired || '',
    responsiblePerson: getBlockString(blocks, 'responsiblePerson') || item.responsiblePerson || '',
    targetDate: getBlockString(blocks, 'targetDate') || item.targetDate || null,
    order: typeof item.order === 'number' ? item.order : index,
  };
});

const comparableAgendaItems = (items: any[] = []) => normalizeAgendaItems(items).map((item) => ({
  sourceAgendaId: item.sourceAgendaId?.toString?.() || item.sourceAgendaId || null,
  itemNumber: item.itemNumber || '',
  sectionTag: item.sectionTag || '',
  sectionGroup: item.sectionGroup || 'Procedural',
  subject: item.subject || '',
  blocks: normalizeBlocks(item),
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
  meetingBody: details.meetingBody || '',
  instituteName: details.instituteName || 'National Institute of Technology Calicut',
  dateLine: details.dateLine || '',
  venueLine: details.venueLine || '',
});

function buildCoverDetailsFromMeeting(meeting: any, details: any = {}) {
  const normalizedDetails = normalizeCoverDetails(details);
  return {
    ...normalizedDetails,
    meetingNumber: normalizedDetails.meetingNumber || meeting.title || '',
    meetingBody: normalizedDetails.meetingBody || meeting.meetingType || 'Meeting',
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
    if (rejectCancelledMeeting(res, meeting)) return;

    const authReq = req as AuthRequest;
    const currentUserId = authReq.user?.id;
    const orgId = meeting.organizerId?._id?.toString?.() || meeting.organizerId?.id?.toString?.() || meeting.organizerId?.toString?.();
    const isOrganizerOrAdmin = 
      authReq.user?.role === 'Admin' || 
      authReq.user?.role === 'SuperAdmin' || 
      orgId === currentUserId;
      
    const reviewers = getMomReviewers(meeting);
    const isReviewer = reviewers.some((r) => r.userId === currentUserId);

    if (!isOrganizerOrAdmin && !isReviewer) {
      res.status(403).json({ message: 'You cannot view this MoM because you were not marked present for the meeting.' });
      return;
    }

    // We use membersPresent to determine if the MoM has been saved at least once.
    // If it's empty, the organizer hasn't clicked "Save Draft" yet.
    if (!isOrganizerOrAdmin && isReviewer && (!meeting.membersPresent || meeting.membersPresent.length === 0)) {
      res.status(403).json({ message: 'The organizer has not drafted the MoM yet. Please wait until they save the initial draft.' });
      return;
    }

    const result = withDerivedMomMembers(meeting);
    if (!isOrganizerOrAdmin && meeting.momStatus !== MomStatus.Confirmed) {
      result.offlineMomFileUrl = null;
    }
    res.json(result);
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
    if (rejectCancelledMeeting(res, target)) return;

    const requestingUser = (req as any).user;
    if (
      getUserId(target.organizerId) !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'Only the organizer or an admin can modify the MoM.' });
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

    const populatedMeeting = await populateMeeting(req.params.id as string);

    if (populatedMeeting) {
      const allReviewers = getMomReviewers(populatedMeeting);
      const isConfirmed = momStatus === MomStatus.Confirmed;
      
      const subject = isConfirmed 
        ? `MoM Finalized: ${populatedMeeting.title}` 
        : `MoM Ready for Review: ${populatedMeeting.title}`;
        
      const htmlBody = isConfirmed
        ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Minutes of Meeting Finalized</h1>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #334155;">Hello,</p>
              <p style="font-size: 16px; color: #475569;">The Minutes of Meeting for <strong>${populatedMeeting.title}</strong> have received all approvals and are now finalized and locked.</p>
              <p style="font-size: 16px; color: #475569;">You can now view or download the official PDF document from the dashboard.</p>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL}/meetings/${populatedMeeting._id}/mom" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Final MoM</a>
              </div>
            </div>
          </div>`
        : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Minutes of Meeting Ready for Review</h1>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #334155;">Hello,</p>
              <p style="font-size: 16px; color: #475569;">The organizer has drafted the Minutes of Meeting for <strong>${populatedMeeting.title}</strong>.</p>
              <p style="font-size: 16px; color: #475569;">Please log in to review the details. While reviewing, you can add comments to the agenda items if necessary. Once you are satisfied, please provide your approval.</p>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL}/meetings/${populatedMeeting._id}/mom" style="display: inline-block; background-color: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">Review & Approve MoM</a>
              </div>
            </div>
          </div>`;

      allReviewers.forEach(reviewer => {
        if (reviewer.email) {
          sendEmail(reviewer.email, subject, htmlBody);
        }
      });
    }

    res.json(withDerivedMomMembers(populatedMeeting));
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
    if (rejectCancelledMeeting(res, target)) return;

    const requestingUser = (req as any).user;
    if (
      getUserId(target.organizerId) !== requestingUser.id &&
      requestingUser.role !== 'Admin' &&
      requestingUser.role !== 'SuperAdmin'
    ) {
      res.status(403).json({ message: 'Only the organizer or an admin can modify the MoM.' });
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

    const populatedMeeting = await populateMeeting(req.params.id as string);

    if (populatedMeeting && req.body.momStatus === MomStatus.Confirmed) {
      const allReviewers = getMomReviewers(populatedMeeting);
      const subject = `MoM Finalized: ${populatedMeeting.title}`;
      const htmlBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Minutes of Meeting Finalized</h1>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #334155;">Hello,</p>
              <p style="font-size: 16px; color: #475569;">The Minutes of Meeting for <strong>${populatedMeeting.title}</strong> have received all approvals and are now finalized and locked.</p>
              <p style="font-size: 16px; color: #475569;">You can now view or download the official PDF document from the dashboard.</p>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL}/meetings/${populatedMeeting._id}/mom" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Final MoM</a>
              </div>
            </div>
          </div>`;
      allReviewers.forEach(reviewer => {
        if (reviewer.email) {
          sendEmail(reviewer.email, subject, htmlBody);
        }
      });
    }

    res.json(withDerivedMomMembers(populatedMeeting));
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
    if (rejectCancelledMeeting(res, target)) return;
    if (target.momStatus === MomStatus.Confirmed) {
      res.status(423).json({ message: 'This MoM is already confirmed and locked.' });
      return;
    }

    const reviewerIds = new Set(getMomReviewers(target).map((reviewer) => reviewer.userId));
    if (!reviewerIds.has(currentUserId)) {
      res.status(403).json({ message: 'Only meeting members can approve this MoM.' });
      return;
    }
    if (!canManageMeeting(target, authReq.user) && !hasAcceptedParticipantAccess(target, currentUserId)) {
      res.status(403).json({ message: 'Please accept the meeting invitation before approving the MoM.' });
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
    if (rejectCancelledMeeting(res, meeting)) return;
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

export const addMomAgendaComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const currentUserId = authReq.user?.id;
    if (!currentUserId) {
      res.status(401).json({ message: 'Log in before adding a comment.' });
      return;
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim() === '') {
      res.status(400).json({ message: 'Comment text is required.' });
      return;
    }

    const target = await populateMeeting(req.params.id as string);
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (rejectCancelledMeeting(res, target)) return;

    if (target.momStatus === MomStatus.Confirmed) {
      res.status(423).json({ message: 'This MoM is confirmed and locked. No new comments can be added.' });
      return;
    }

    const allReviewers = getMomReviewers(target);
    const reviewer = allReviewers.find((r) => r.userId === currentUserId);

    if (!reviewer) {
      res.status(403).json({ message: 'Only meeting members can add comments to this MoM.' });
      return;
    }
    if (!canManageMeeting(target, authReq.user) && !hasAcceptedParticipantAccess(target, currentUserId)) {
      res.status(403).json({ message: 'Please accept the meeting invitation before adding MoM comments.' });
      return;
    }

    const agendaId = req.params.agendaId;
    const agendaIndex = target.agendaItems?.findIndex((item: any) => item._id.toString() === agendaId);
    
    if (agendaIndex === undefined || agendaIndex === -1) {
      res.status(404).json({ message: 'Agenda item not found in this MoM.' });
      return;
    }

    const userName = reviewer.name || 'Participant';

    const updatePath = `agendaItems.${agendaIndex}.comments`;
    
    await Meeting.findByIdAndUpdate(req.params.id as string, {
      $push: { 
        [updatePath]: { 
          user: currentUserId, 
          userName: userName,
          text: text.trim(), 
          createdAt: new Date() 
        } 
      },
    });

    res.json(withDerivedMomMembers(await populateMeeting(req.params.id as string)));
  } catch (error) {
    res.status(500).json({ message: 'Server error while adding MoM agenda comment', error });
  }
};

export const addMomGeneralRemark = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const currentUserId = authReq.user?.id;
    if (!currentUserId) {
      res.status(401).json({ message: 'Log in before adding a remark.' });
      return;
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim() === '') {
      res.status(400).json({ message: 'Remark text is required.' });
      return;
    }

    const target = await populateMeeting(req.params.id as string);
    if (!target) {
      res.status(404).json({ message: 'Meeting not found' });
      return;
    }
    if (rejectCancelledMeeting(res, target)) return;

    if (target.momStatus === MomStatus.Confirmed) {
      res.status(423).json({ message: 'This MoM is confirmed and locked. No new remarks can be added.' });
      return;
    }

    const allReviewers = getMomReviewers(target);
    const reviewer = allReviewers.find((r) => r.userId === currentUserId);

    if (!reviewer) {
      res.status(403).json({ message: 'Only meeting members can add remarks to this MoM.' });
      return;
    }
    if (!canManageMeeting(target, authReq.user) && !hasAcceptedParticipantAccess(target, currentUserId)) {
      res.status(403).json({ message: 'Please accept the meeting invitation before adding MoM remarks.' });
      return;
    }

    const userName = reviewer.name || 'Participant';

    await Meeting.findByIdAndUpdate(req.params.id as string, {
      $push: { 
        momGeneralRemarks: { 
          user: currentUserId, 
          userName: userName,
          text: text.trim(), 
          createdAt: new Date() 
        } 
      },
    });

    res.json(withDerivedMomMembers(await populateMeeting(req.params.id as string)));
  } catch (error) {
    res.status(500).json({ message: 'Server error while adding MoM remark', error });
  }
};
