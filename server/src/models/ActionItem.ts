import mongoose, { Document, Schema, Types } from 'mongoose';

export enum ActionItemStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  DONE = 'Done'
}

export interface IActionItem extends Document {
  title: string;
  description?: string;
  meetingId: Types.ObjectId;
  assigneeId: Types.ObjectId;
  status: ActionItemStatus;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ActionItemSchema = new Schema<IActionItem>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { 
      type: String, 
      enum: Object.values(ActionItemStatus), 
      default: ActionItemStatus.TODO 
    },
    dueDate: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model<IActionItem>('ActionItem', ActionItemSchema);
