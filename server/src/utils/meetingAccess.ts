export const getMeetingUserId = (value: any): string => (
  value?._id?.toString?.() ||
  value?.id?.toString?.() ||
  value?.toString?.() ||
  ''
);

export const isGlobalMeetingAdmin = (role?: string): boolean => (
  role === 'Admin' || role === 'SuperAdmin'
);

export const getParticipantRecord = (meeting: any, userId: string) => (
  meeting?.participants?.find((participant: any) => getMeetingUserId(participant.user) === userId)
);

export const hasAcceptedParticipantAccess = (meeting: any, userId: string): boolean => (
  getParticipantRecord(meeting, userId)?.status === 'Accepted'
);

export const isMeetingOrganizer = (meeting: any, userId: string): boolean => (
  getMeetingUserId(meeting?.organizerId) === userId
);

export const canManageMeeting = (meeting: any, user: any): boolean => (
  isGlobalMeetingAdmin(user?.role) || isMeetingOrganizer(meeting, user?.id)
);

