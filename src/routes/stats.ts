import express from 'express';
import { Subject } from '../models/Subject.ts';
import { Mistake } from '../models/Mistake.ts';
import { SemesterPlan } from '../models/SemesterPlan.ts';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const subjectCount = await Subject.countDocuments();
    const mistakesCount = await Mistake.countDocuments();

    // Calculate total topics across all subjects
    const subjects = await Subject.find();
    const topicCount = subjects.reduce((acc, sub) => acc + sub.topics.length, 0);

    // Calculate accuracy (dummy logic for now, or based on mistake ratio if we tracked total attempts)
    // For now, let's just return a placeholder or calculate based on resolved mistakes
    const accuracy = 75;

    res.json({
      subjects: subjectCount,
      topics: topicCount,
      mistakes: mistakesCount,
      accuracy
    });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

export default router;
