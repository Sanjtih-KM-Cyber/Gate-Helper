import express from 'express';
import { Note } from '../models/Note.ts';
const router = express.Router();
router.get('/', async (req, res) => { try { const notes = await Note.find().sort({ createdAt: -1 }); res.json(notes); } catch (err) { res.status(500).json({ error: (err as any).message }); } });
router.post('/', async (req, res) => { try { const note = new Note(req.body); await note.save(); res.json(note); } catch (err) { res.status(400).json({ error: (err as any).message }); } });
router.put('/:id', async (req, res) => { try { const note = await Note.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(note); } catch (err) { res.status(400).json({ error: (err as any).message }); } });
router.delete('/:id', async (req, res) => { try { await Note.findByIdAndDelete(req.params.id); res.json({ message: 'Note deleted' }); } catch (err) { res.status(500).json({ error: (err as any).message }); } });
export default router;
