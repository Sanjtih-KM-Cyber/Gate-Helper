import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  aiName: { type: String, default: 'GATE Tutor' },
  aiPersona: { type: String, default: 'You are a helpful and knowledgeable GATE exam tutor.' },
  updatedAt: { type: Date, default: Date.now }
});

export const Settings = mongoose.model('Settings', SettingsSchema);
