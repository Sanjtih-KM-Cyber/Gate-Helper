import mongoose, { Document, Schema } from 'mongoose';

export interface ITopic {
  name: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  confidence: 'Red' | 'Yellow' | 'Green';
  code?: string; // For manual code entry in Labs
}

export interface IUnit {
  title: string;
  topics: ITopic[];
}

export interface ISubject extends Document {
  name: string;
  description?: string;
  category: 'College Prep' | 'GATE Prep';
  type: 'Theory' | 'Lab'; // New Field
  syllabus: IUnit[];
  status: 'Not Started' | 'In Progress' | 'Completed';
  createdAt: Date;
}

const TopicSchema = new Schema<ITopic>({
  name: { type: String, required: true },
  status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'Not Started' },
  confidence: { type: String, enum: ['Red', 'Yellow', 'Green'], default: 'Red' },
  code: { type: String }
});

const UnitSchema = new Schema<IUnit>({
  title: { type: String, required: true },
  topics: [TopicSchema]
});

const SubjectSchema = new Schema<ISubject>({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true, enum: ['College Prep', 'GATE Prep'], default: 'College Prep' },
  type: { type: String, enum: ['Theory', 'Lab'], default: 'Theory' },
  syllabus: [UnitSchema],
  status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'Not Started' },
  createdAt: { type: Date, default: Date.now }
});

export const Subject = mongoose.model<ISubject>('Subject', SubjectSchema);
