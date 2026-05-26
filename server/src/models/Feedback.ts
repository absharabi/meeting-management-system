import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFeedback extends Document {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  rating: number; // 1 to 5
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: 'Meeting',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// A user can only submit one feedback per meeting
FeedbackSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema);
