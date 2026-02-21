import express from 'express';
import { Mistake } from '../models/Mistake.ts';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
const router = express.Router();
// Prose generation
const llm = new ChatOllama({
  model: 'qwen2.5-coder:7b',
  baseUrl: 'http://localhost:11434',
  temperature: 0.3,
  maxRetries: 2,
});

router.get('/', async (req, res) => { try { const mistakes = await Mistake.find().sort({ createdAt: -1 }); res.json(mistakes); } catch (err) { res.status(500).json({ error: (err as any).message }); } });
router.post('/', async (req, res) => { try { const mistake = new Mistake(req.body); await mistake.save(); res.json(mistake); } catch (err) { res.status(400).json({ error: (err as any).message }); } });
router.delete('/:id', async (req, res) => { try { await Mistake.findByIdAndDelete(req.params.id); res.json({ message: 'Mistake deleted' }); } catch (err) { res.status(500).json({ error: (err as any).message }); } });

// Task 4: AI Solver
router.post('/solve-mistake', async (req, res) => {
  const { question, userAnswer, correctAnswer } = req.body;
  try {
    const prompt = `
      You are an expert tutor. Here is a question the student got wrong:

      Question: ${question}
      Student's Wrong Answer: ${userAnswer}
      Correct Answer: ${correctAnswer}

      Please explain step-by-step why the student's answer is wrong and how to arrive at the correct answer.
      Structure the answer clearly:
      1. Why it was wrong.
      2. Step-by-step solution.
      3. Key takeaway.

      Keep it concise and clear.
    `;

    const response = await llm.invoke([
      new SystemMessage('You are a helpful AI tutor.'),
      new HumanMessage(prompt)
    ]);

    res.json({ explanation: response.content });
  } catch (error) {
    console.error('AI Solver Error:', error);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

export default router;
