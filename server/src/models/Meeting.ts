import mongoose, { Document, Schema, Types } from 'mongoose';

export enum MeetingMode {
  Online  = 'Online',
  Offline = 'Offline',
  Hybrid  = 'Hybrid',
}

export enum MeetingVisibility {
  Public     = 'Public',
  Private    = 'Private',
  InviteOnly = 'InviteOnly',
}

export enum MeetingStatus {
  Scheduled = 'Scheduled',
  Ongoing   = 'Ongoing',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum MomStatus {
  Draft     = 'Draft',
  Confirmed = 'Confirmed',
}

export enum MeetingType {
  Board      = 'Board Meeting',
  Department = 'Department Meeting',
  Review     = 'Review Meeting',
  OnlineConf = 'Online Conference',
  Committee  = 'Committee Meeting',
  Normal     = 'Normal Meeting',
  Emergency  = 'Emergency Meeting',
  Periodic   = 'Periodic Meeting',
  Scheduled  = 'Scheduled Meeting',
}

export interface IMeeting extends Document {
  title:        string;
  description?: string;
  meetingType:  MeetingType;
  mode:         MeetingMode;
  visibility:   MeetingVisibility;
  date:         Date;
  startTime:    string;
  endTime:      string;
  venue?:       string;
  link?:        string;
  organizerId:  Types.ObjectId;
  participants: { user: Types.ObjectId; status: string }[];
  attendance:   Types.ObjectId[];
  status:       MeetingStatus;
  groupId?:     string;
  recurrencePattern?: string;
  offlineReportFileUrl?: string;
  membersPresent: {
    name: string;
    designation: string;
    attendanceMode: string;
  }[];
  agendaItems: {
    sourceAgendaId?: Types.ObjectId;
    itemNumber: string;
    sectionTag?: string;
    sectionGroup: string;
    subject: string;
    blocks?: {
      type: string;
      label: string;
      value: any;
    }[];
    backgroundNote: string;
    decision: string;
    actionRequired: string;
    responsiblePerson: string;
    targetDate?: Date;
    order: number;
    comments?: {
      user: Types.ObjectId;
      userName: string;
      text: string;
      createdAt: Date;
    }[];
  }[];
  momCoverDetails: {
    meetingNumber: string;
    meetingBody: string;
    instituteName: string;
    dateLine: string;
    venueLine: string;
  };
  momApprovals: {
    user: Types.ObjectId;
    approvedAt: Date;
  }[];
  momStatus: MomStatus;
  aiTranscript?: string;
  aiSummary?: string;
  aiKeyPoints: string[];
  aiDecisions: string[];
  aiRisks: string[];
  aiActionItems: {
    task: string;
    owner: string;
    deadline: string;
  }[];
  aiSummaryGeneratedAt?: Date;
  createdAt:    Date;
  updatedAt:    Date;
}

const MembersPresentSchema = new Schema(
  {
    name: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    attendanceMode: { type: String, enum: ['In person', 'Online', 'Hybrid'], default: 'In person' },
  },
  { _id: false }
);

const AgendaItemSchema = new Schema(
  {
    sourceAgendaId: { type: Schema.Types.ObjectId, ref: 'Agenda', default: null },
    itemNumber: { type: String, trim: true, default: '' },
    sectionTag: { type: String, trim: true, default: '' },
    sectionGroup: {
      type: String,
      enum: ['Procedural', 'Consideration & Approval', 'Reporting', 'Any Other Matter'],
      default: 'Procedural',
    },
    subject: { type: String, trim: true, default: '' },
    blocks: {
      type: [
        {
          type: { type: String, trim: true, default: '' },
          label: { type: String, trim: true, default: '' },
          value: { type: Schema.Types.Mixed, default: '' },
        }
      ],
      default: []
    },
    backgroundNote: { type: String, default: '' },
    decision: { type: String, default: '' },
    actionRequired: { type: String, trim: true, default: '' },
    responsiblePerson: { type: String, trim: true, default: '' },
    targetDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
    comments: {
      type: [
        {
          user: { type: Schema.Types.ObjectId, ref: 'User' },
          userName: { type: String, default: 'Participant' },
          text: { type: String, required: true },
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { _id: true }
);

const MomCoverDetailsSchema = new Schema(
  {
    meetingNumber: { type: String, trim: true, default: '' },
    meetingBody: { type: String, trim: true, default: 'Board of Governors' },
    instituteName: { type: String, trim: true, default: 'National Institute of Technology Calicut' },
    dateLine: { type: String, trim: true, default: '' },
    venueLine: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const MomApprovalSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedAt: { type: Date, default: Date.now },
    comments: { type: String, default: '' },
  },
  { _id: false }
);

const MeetingSchema = new Schema<IMeeting>(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: { 
      type: String, 
      trim: true 
    },
    meetingType: { 
      type: String, 
      enum: Object.values(MeetingType), 
      default: MeetingType.Normal 
    },
    mode: { 
      type: String, 
      enum: Object.values(MeetingMode), 
      default: MeetingMode.Offline 
    },
    visibility: { 
      type: String, 
      enum: Object.values(MeetingVisibility), 
      default: MeetingVisibility.Private 
    },
    date: { 
      type: Date, 
      required: true 
    },
    startTime: { 
      type: String, 
      required: true 
    },
    endTime: { 
      type: String, 
      required: true 
    },
    venue: { 
      type: String,
      trim: true
    },
    link: { 
      type: String,
      trim: true
    },
    organizerId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    participants: [{ 
      user: { type: Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['Pending', 'Accepted', 'Declined'], default: 'Pending' }
    }],
    attendance: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    }],
    status: { 
      type: String, 
      enum: Object.values(MeetingStatus), 
      default: MeetingStatus.Scheduled 
    },
    groupId: {
      type: String,
      default: null
    },
    recurrencePattern: {
      type: String,
      enum: ['None', 'Daily', 'Weekly', 'Bi-Weekly', 'Monthly'],
      default: 'None'
    },
    offlineReportFileUrl: {
      type: String,
      default: null
    },
    membersPresent: {
      type: [MembersPresentSchema],
      default: []
    },
    agendaItems: {
      type: [AgendaItemSchema],
      default: []
    },
    momCoverDetails: {
      type: MomCoverDetailsSchema,
      default: () => ({})
    },
    momApprovals: {
      type: [MomApprovalSchema],
      default: []
    },
    momStatus: {
      type: String,
      enum: Object.values(MomStatus),
      default: MomStatus.Draft
    },
    aiTranscript: {
      type: String,
      default: ''
    },
    aiSummary: {
      type: String,
      default: ''
    },
    aiKeyPoints: {
      type: [String],
      default: []
    },
    aiDecisions: {
      type: [String],
      default: []
    },
    aiRisks: {
      type: [String],
      default: []
    },
    aiActionItems: {
      type: [
        {
          task: { type: String, default: '' },
          owner: { type: String, default: '' },
          deadline: { type: String, default: '' }
        }
      ],
      default: []
    },
    aiSummaryGeneratedAt: {
      type: Date,
      default: null
    }
  },
  { 
    timestamps: true 
  }
);

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
