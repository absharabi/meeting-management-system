export type SectionGroup = "Procedural" | "Consideration & Approval" | "Reporting" | "Any Other Matter";
export type MomStatus = "Draft" | "Confirmed";

export interface MemberPresent {
  name: string;
  designation: string;
  attendanceMode: string;
}

export interface MomUser {
  _id: string;
  name: string;
  email?: string;
  department?: string;
}

export interface MomParticipant {
  user?: MomUser | string | null;
  status?: string;
}

export interface MomAgendaItem {
  _id?: string;
  sourceAgendaId?: string | null;
  itemNumber: string;
  sectionTag?: string;
  sectionGroup: SectionGroup;
  subject: string;
  backgroundNote: string;
  decision: string;
  actionRequired: string;
  responsiblePerson: string;
  targetDate?: string;
  order: number;
}

export interface MomCoverDetails {
  meetingNumber: string;
  meetingBody: string;
  instituteName: string;
  dateLine: string;
  venueLine: string;
}

export interface MomMeeting {
  _id: string;
  title: string;
  date: string;
  venue?: string;
  link?: string;
  startTime?: string;
  endTime?: string;
  meetingType?: string;
  mode?: string;
  participants?: MomParticipant[];
  membersPresent: MemberPresent[];
  agendaItems: MomAgendaItem[];
  momCoverDetails?: MomCoverDetails;
  momStatus: MomStatus;
}
