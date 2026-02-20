import express from 'express';
import { Settings } from '../models/Settings.ts';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { aiName, aiPersona } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings({ aiName, aiPersona });
    } else {
        settings.aiName = aiName;
        settings.aiPersona = aiPersona;
        settings.updatedAt = new Date();
    }
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: (err as any).message });
  }
});

export default router;
