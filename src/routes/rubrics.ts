import express from 'express';
import { Rubric } from '../models/Rubric.ts';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const router = express.Router();
const llm = new ChatOllama({
  model: 'llama3.2', // Ensure model is pulled
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
});

router.get('/', async (req, res) => {
  try {
    const rubrics = await Rubric.find().sort({ marks: 1 });
    res.json(rubrics);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

router.post('/', async (req, res) => {
  try {
    const rubric = new Rubric(req.body);
    await rubric.save();
    res.json(rubric);
  } catch (err) {
    res.status(400).json({ error: (err as any).message });
  }
});

// Generate Answer based on Marks/Rubric
router.post('/generate-answer', async (req, res) => {
  const { topic, marks } = req.body;

  try {
    // 1. Fetch rubric for these marks
    const rubric = await Rubric.findOne({ marks: parseInt(marks) });
    if (!rubric) {
      return res.status(404).json({ error: `No rubric found for ${marks} marks. Please define it in settings.` });
    }

    const prompt = `
      You are an expert college tutor.
      Topic: "${topic}"
      Marks: ${marks}

      RUBRIC REQUIREMENTS:
      - Length: Approximately ${rubric.wordCount || 'variable'} words.
      - Description: ${rubric.description}
      - Specific Requirements: ${rubric.requirements.join(', ')}

      Task: Write a perfect answer for this topic that strictly follows the rubric above.
    `;

    const response = await llm.invoke([
      new SystemMessage("You are a strict academic grader."),
      new HumanMessage(prompt)
    ]);

    res.json({ answer: response.content });
  } catch (error) {
    console.error('Answer Generator Error:', error);
    res.status(500).json({ error: 'Failed to generate answer' });
  }
});

export default router;
