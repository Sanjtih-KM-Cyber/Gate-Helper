import express from 'express';
import { Subject } from '../models/Subject.ts';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';

const router = express.Router();
const llm = new ChatOllama({ model: 'llama3.2', baseUrl: 'http://localhost:11434', temperature: 0.7 });
const searchTool = new DuckDuckGoSearch({ maxResults: 3 });

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

// GET /:id/syllabus - Fetches or Generates Syllabus using Web Search + AI
router.get('/:id/syllabus', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    // If topics exist, return them immediately
    if (subject.topics && subject.topics.length > 0) {
      return res.json(subject);
    }

    console.log(`Searching web for syllabus of: ${subject.name}...`);
    let searchResults = '';
    try {
      searchResults = await searchTool.invoke(`GATE Computer Science syllabus for ${subject.name} topics units`);
    } catch (searchError) {
      console.error('Search failed:', searchError);
      searchResults = 'Search unavailable. Relying on internal knowledge.';
    }

    const prompt = `
      Context from Web Search:
      ${searchResults}

      Task:
      Create a comprehensive syllabus for the subject: "${subject.name}" for the GATE Computer Science exam based on the search results.
      Break it down into 8-12 key topics or units.
      Return ONLY a JSON array of strings, where each string is a topic name.
      Example: ["Propositional Logic", "Graph Theory", "Set Theory"]
      Do not include any markdown or extra text.
    `;

    const response = await llm.invoke([
      new SystemMessage('You are a helpful academic assistant.'),
      new HumanMessage(prompt)
    ]);

    let topics = [];
    try {
      let cleanContent = response.content.toString().trim();
      // Clean potential markdown code blocks
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      topics = JSON.parse(cleanContent);

      if (!Array.isArray(topics)) {
        throw new Error('AI response was not an array');
      }

      // Save to database
      subject.topics = topics;
      await subject.save();

      return res.json(subject);

    } catch (parseError) {
      console.error('Failed to parse AI syllabus:', parseError);
      console.log('Raw response:', response.content);
      return res.status(500).json({ error: 'Failed to generate syllabus. Please try again manually.' });
    }

  } catch (err) {
    console.error('Syllabus error:', err);
    res.status(500).json({ error: (err as any).message });
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
