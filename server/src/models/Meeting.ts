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
  createdAt:    Date;
  updatedAt:    Date;
}

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
    }
  },
  { 
    timestamps: true 
  }
);

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
