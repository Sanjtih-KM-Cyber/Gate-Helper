import mongoose from 'mongoose';

const MistakeSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  topic: { type: String, required: true },
  question: { type: String, required: true },
  userAnswer: { type: String },
  correctAnswer: { type: String, required: true },
  explanation: { type: String }, // AI explanation
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

export const Mistake = mongoose.model('Mistake', MistakeSchema);
