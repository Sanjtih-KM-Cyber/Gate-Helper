import mongoose from 'mongoose';

const SemesterPlanSchema = new mongoose.Schema({
  title: { type: String, required: true }, // Subject Name
  semester: { type: String, required: true }, // "Semester 5", "Semester 6", "Backlog"
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export const SemesterPlan = mongoose.model('SemesterPlan', SemesterPlanSchema);
