import express from 'express';
import { Rubric } from '../models/Rubric.ts';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getRelevantContext } from '../utils/vectorStore.ts';

const router = express.Router();
const llm = new ChatOllama({ model: 'llama3.2', baseUrl: 'http://localhost:11434', temperature: 0.7 });
router.get('/', async (req, res) => { try { const rubrics = await Rubric.find().sort({ marks: 1 }); res.json(rubrics); } catch (err) { res.status(500).json({ error: (err as any).message }); } });
router.post('/', async (req, res) => { try { const rubric = new Rubric(req.body); await rubric.save(); res.json(rubric); } catch (err) { res.status(400).json({ error: (err as any).message }); } });
router.post('/generate-answer', async (req, res) => {
  const { topic, marks } = req.body;
  try {
    const rubric = await Rubric.findOne({ marks: parseInt(marks) });
    if (!rubric) {
      return res.status(404).json({ error: 'No rubric found for marks.' });
    }

    console.log(`[RAG] Retrieving context for topic: "${topic}"...`);
    const context = await getRelevantContext(topic, 3);

    const prompt = `Topic: ${topic}
Marks: ${marks}
Rubric Description: ${rubric.description}
Rubric Requirements: ${rubric.requirements.join(', ')}

Context from Course Material:
${context || "No specific notes found. Rely on general academic knowledge."}

Task: Write a perfect answer for this topic strictly following the rubric constraints (word count, structure, depth).
Base your answer primarily on the provided Context from Course Material if available.`;

    const response = await llm.invoke([
      new SystemMessage('You are an expert academic tutor and grader. Write high-quality, precise answers tailored to exam rubrics.'),
      new HumanMessage(prompt)
    ]);

    res.json({ answer: response.content });
  } catch (error) {
    console.error('Answer Generator Error:', error);
    res.status(500).json({ error: 'Failed to generate answer' });
  }
});
export default router;
