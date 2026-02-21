import express from 'express';
import { Subject, ISubject } from '../models/Subject.ts';
import { Mistake } from '../models/Mistake.ts';
import { SemesterPlan } from '../models/SemesterPlan.ts';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const subjectCount = await Subject.countDocuments();
    const mistakesCount = await Mistake.countDocuments();

    // Calculate total topics across all subjects
    const subjects = await Subject.find();
    const topicCount = subjects.reduce((acc, sub) => {
       // @ts-ignore - syllabus might be undefined in old records, but schema has it
       if (sub.syllabus) {
           // @ts-ignore
           return acc + sub.syllabus.reduce((uAcc, unit) => uAcc + (unit.topics?.length || 0), 0);
       }
       return acc;
    }, 0);

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
