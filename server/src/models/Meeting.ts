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
  General    = 'General',
  Board      = 'Board',
  Department = 'Department',
  Emergency  = 'Emergency',
  Recurring  = 'Recurring',
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
  participants: Types.ObjectId[];
  attendance:   Types.ObjectId[];
  status:       MeetingStatus;
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
      default: MeetingType.General 
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
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    }],
    attendance: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    }],
    status: { 
      type: String, 
      enum: Object.values(MeetingStatus), 
      default: MeetingStatus.Scheduled 
    }
  },
  { 
    timestamps: true 
  }
);

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
