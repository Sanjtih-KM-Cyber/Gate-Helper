import mongoose from 'mongoose';

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true, // Assuming one user for offline mode, or distinct users if needed
  },
  syllabusTrack: {
    type: String,
    enum: ['CS', 'DA'],
    required: true,
  },
  completedTopics: [{
    topicName: String,
    completedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  quizScores: [{
    topicName: String,
    score: Number,
    totalQuestions: Number,
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard', 'Topper Level'],
    },
    attemptedAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

export const UserProgress = mongoose.model('UserProgress', userProgressSchema);
