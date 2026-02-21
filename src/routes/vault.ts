import express from 'express';
import { Mistake } from '../models/Mistake.ts';

const router = express.Router();

router.post('/save', async (req, res) => {
  try {
    const { question, answer, subjectId, topicName, difficulty } = req.body;

    const newMistake = new Mistake({
      question,
      correctAnswer: answer,
      subjectId,
      topic: topicName,
      difficulty,
      userAnswer: '', // Saved items might not have a user answer yet
      tags: ['saved']
    });

    await newMistake.save();
    res.json({ success: true, message: "Saved to Vault" });
  } catch (err: any) {
    console.error('Vault save error:', err);
    res.status(500).json({ success: false, message: "Failed to save" });
  }
});

export default router;
