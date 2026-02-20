import express from 'express';
import { Subject } from '../models/Subject.ts';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const subject = new Subject(req.body);
    await subject.save();
    res.json(subject);
  } catch (err) {
    res.status(400).json({ error: (err as any).message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(subject);
  } catch (err) {
    res.status(400).json({ error: (err as any).message });
  }
});

// Add topic to subject
router.post('/:id/topics', async (req, res) => {
  try {
    const { topic } = req.body;
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { $push: { topics: topic } },
      { new: true }
    );
    res.json(subject);
  } catch (err) {
    res.status(400).json({ error: (err as any).message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

export default router;
