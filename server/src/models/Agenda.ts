import mongoose, { Document, Schema, Types } from 'mongoose';

export enum AgendaStatus {
  Pending = 'Pending',
  Approved = 'Approved',
}

export interface IAgendaDocument {
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: Types.ObjectId;
}

export interface IAgenda extends Document {
  meetingId: Types.ObjectId;
  title: string;
  description?: string;
  timeAllocated?: number; // in minutes
  proposedBy: Types.ObjectId;
  status: AgendaStatus;
  isConfirmedByProposer: boolean;
  isEmergency: boolean;
  sequence: number;
  documents: IAgendaDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const AgendaSchema = new Schema<IAgenda>(
  {
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: 'Meeting',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    timeAllocated: {
      type: Number,
      default: 15,
    },
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AgendaStatus),
      default: AgendaStatus.Pending,
    },
    isConfirmedByProposer: {
      type: Boolean,
      default: false,
    },
    isEmergency: {
      type: Boolean,
      default: false,
    },
    sequence: {
      type: Number,
      default: 0,
    },
    documents: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IAgenda>('Agenda', AgendaSchema);
