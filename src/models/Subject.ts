import mongoose from 'mongoose';

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: 'General' },
  topics: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

export const Subject = mongoose.model('Subject', SubjectSchema);
