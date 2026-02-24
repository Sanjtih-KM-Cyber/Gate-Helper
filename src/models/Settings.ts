import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  aiName: { type: String, default: 'GATE Tutor' },
  // Personas
  gatePersona: { type: String, default: 'You are a strategic GATE Exam Coach. Focus on problem-solving, shortcuts, and key formulas.' },
  collegePersona: { type: String, default: 'You are a patient and academic College Professor. Explain concepts step-by-step with theory and examples.' },
  labPersona: { type: String, default: 'You are an expert Coding Assistant. Provide clean, optimized code with comments and explanations.' },

  // Legacy (can remove later or keep for generic fallback)
  aiPersona: { type: String, default: 'You are a helpful AI Assistant.' },

  updatedAt: { type: Date, default: Date.now }
});

export const Settings = mongoose.model('Settings', SettingsSchema);
