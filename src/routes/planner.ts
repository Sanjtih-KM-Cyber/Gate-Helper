import express from 'express';
import { SemesterPlan } from '../models/SemesterPlan.ts';
const router = express.Router();
router.get('/', async (req, res) => { try { const plans = await SemesterPlan.find().sort({ order: 1 }); res.json(plans); } catch (err) { res.status(500).json({ error: (err as any).message }); } });
router.post('/', async (req, res) => { try { const plan = new SemesterPlan(req.body); await plan.save(); res.json(plan); } catch (err) { res.status(400).json({ error: (err as any).message }); } });
router.put('/:id', async (req, res) => { try { const plan = await SemesterPlan.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(plan); } catch (err) { res.status(400).json({ error: (err as any).message }); } });
router.delete('/:id', async (req, res) => { try { await SemesterPlan.findByIdAndDelete(req.params.id); res.json({ message: 'Plan deleted' }); } catch (err) { res.status(500).json({ error: (err as any).message }); } });
export default router;
