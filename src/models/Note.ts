import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, enum: ['Cybersecurity', 'College'], default: 'College' },
  createdAt: { type: Date, default: Date.now }
});

export const Note = mongoose.model('Note', NoteSchema);
