import mongoose from 'mongoose';

const RubricSchema = new mongoose.Schema({
  marks: { type: Number, required: true },
  description: { type: String, required: true },
  wordCount: { type: Number },
  requirements: [String], // e.g. "Includes diagrams", "Bullet points"
});

export const Rubric = mongoose.model('Rubric', RubricSchema);
