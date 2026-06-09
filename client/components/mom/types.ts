export type SectionGroup = "Procedural" | "Consideration & Approval" | "Reporting" | "Any Other Matter";
export type MomStatus = "Draft" | "Confirmed";
export type MomBlockType =
  | "backgroundNote"
  | "decision"
  | "actionRequired"
  | "responsiblePerson"
  | "targetDate"
  | "annexureReference"
  | "status"
  | "table"
  | "customField"
  | "resolution"
  | "actionTaken";

export interface MomTableValue {
  columns: string[];
  rows: string[][];
}

export interface MomBlock {
  type: MomBlockType;
  label: string;
  value: string | MomTableValue;
}

export interface MemberPresent {
  name: string;
  designation: string;
  attendanceMode: string;
}

export interface MomUser {
  _id: string;
  id?: string;
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
  itemNumber: string; // Kept for backwards compatibility but we will compute dynamic numbers in preview
  isSubItem?: boolean;
  isActionTakenReport?: boolean;
  sectionTag?: string;
  sectionGroup: SectionGroup;
  subject: string;
  backgroundNote: string;
  decision: string;
  actionRequired: string;
  responsiblePerson: string;
  targetDate?: string;
  blocks?: MomBlock[];
  order: number;
  comments?: {
    _id?: string;
    user: string;
    userName: string;
    text: string;
    createdAt: string;
  }[];
}

export interface MomCoverDetails {
  meetingNumber: string;
  meetingBody: string;
  instituteName: string;
  dateLine: string;
  venueLine: string;
}

export interface MomApprovalStatus {
  userId: string;
  name: string;
  email?: string;
  department?: string;
  approved: boolean;
  approvedAt?: string;
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
  organizerId?: MomUser | string | null;
  participants?: MomParticipant[];
  membersPresent: MemberPresent[];
  agendaItems: MomAgendaItem[];
  momCoverDetails?: MomCoverDetails;
  momApprovalStatus?: MomApprovalStatus[];
  momStatus: MomStatus;
}
