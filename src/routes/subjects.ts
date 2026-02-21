import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import Tesseract from 'tesseract.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { Subject, ISubject, IUnit } from '../models/Subject.ts';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Initialize Local Ollama Model
const llm = new ChatOllama({
  model: 'llama3.2',
  baseUrl: 'http://localhost:11434',
  temperature: 0.3,
});

// Helper: Parse Files
async function parseFile(file: Express.Multer.File): Promise<string> {
  const filePath = file.path;
  let text = '';
  try {
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else if (file.mimetype.startsWith('image/')) {
      const { data: { text: ocrText } } = await Tesseract.recognize(filePath, 'eng');
      text = ocrText;
    } else {
      text = fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error(`Error parsing file ${file.originalname}:`, error);
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  return text;
}

router.get('/', async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

// POST /college-prep - Manual Setup + File Upload
router.post('/college-prep', upload.array('files'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!name) return res.status(400).json({ error: 'Subject name is required' });
    if (!files || files.length === 0) return res.status(400).json({ error: 'Syllabus files are required' });

    console.log(`Processing College Prep subject: ${name}`);

    let combinedText = '';
    for (const file of files) {
      const text = await parseFile(file);
      combinedText += `\n--- File: ${file.originalname} ---\n${text}`;
    }

    const systemPrompt = `You are an academic assistant. Extract a structured syllabus from course documents.`;
    const userPrompt = `
      Subject: ${name}
      Content:
      ${combinedText.substring(0, 15000)}

      Task: Generate a syllabus JSON.
      Structure: { "syllabus": [{ "title": "Unit Name", "topics": [{ "name": "Topic 1", "status": "Not Started", "confidence": "Red" }] }] }
      Return raw JSON only.
    `;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    let cleanContent = response.content.toString().trim();
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (cleanContent.startsWith('```')) cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');

    let syllabusData: { syllabus: IUnit[] };
    try {
      syllabusData = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse AI syllabus:', e);
      syllabusData = { syllabus: [{ title: 'Overview', topics: [{ name: 'Introduction', status: 'Not Started', confidence: 'Red' }] }] };
    }

    const newSubject = new Subject({
      name,
      description,
      category: 'College Prep',
      syllabus: syllabusData.syllabus || []
    });

    await newSubject.save();
    res.json(newSubject);

  } catch (err) {
    console.error('College Prep Error:', err);
    res.status(500).json({ error: (err as any).message });
  }
});

// POST /gate-prep - Automated Web Scraping (Replaced with Tavily API)
router.post('/gate-prep', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required' });

    let subject = await Subject.findOne({ name, category: 'GATE Prep' });
    if (subject) return res.json(subject);

    console.log(`Auto-generating GATE syllabus for: ${name}`);

    let combinedContent = '';

    // Fix 1: Replace duck-duck-scrape with Tavily API
    try {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
             throw new Error("TAVILY_API_KEY not found in environment variables.");
        }

        const query = `Official GATE syllabus units and topics for ${name}`;
        console.log(`Searching Tavily: ${query}`);

        const tavilyResponse = await axios.post('https://api.tavily.com/search', {
            api_key: apiKey,
            query: query,
            search_depth: "advanced",
            include_raw_content: true,
            max_results: 3
        });

        if (tavilyResponse.data.results && tavilyResponse.data.results.length > 0) {
             combinedContent = tavilyResponse.data.results.map((r: any) =>
                 `Source: ${r.url}\nContent: ${r.raw_content || r.content}`
             ).join('\n\n');
        } else {
             console.warn("Tavily returned no results.");
        }

    } catch (searchErr: any) {
        console.warn("Tavily search failed. Falling back to internal knowledge.", searchErr.message);
        combinedContent = ""; // Explicitly clear so AI knows to use internal knowledge
    }

    if (!combinedContent) combinedContent = "Search failed or unavailable. Use internal knowledge to generate the syllabus.";

    const systemPrompt = `You are an expert GATE Exam Tutor.
    IMPORTANT:
    Every topic MUST have a status of exactly 'Not Started'.
    Every topic MUST have a confidence of exactly 'Red'.`;

    const userPrompt = `
      Subject: ${name}
      Context from Web Search:
      ${combinedContent.substring(0, 15000)}

      Task: Generate a comprehensive GATE syllabus JSON based on the context.
      Structure: { "syllabus": [{ "title": "Unit Name", "topics": [{ "name": "Topic 1", "status": "Not Started", "confidence": "Red" }] }] }
      Return raw JSON only.
    `;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    let cleanContent = response.content.toString().trim();
    if (cleanContent.startsWith('```json')) cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (cleanContent.startsWith('```')) cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');

    let syllabusData: { syllabus: IUnit[] };
    try {
      syllabusData = JSON.parse(cleanContent);

      // Fix 2b: Sanitize Enums
      if (syllabusData.syllabus && Array.isArray(syllabusData.syllabus)) {
          syllabusData.syllabus.forEach(unit => {
              if (unit.topics && Array.isArray(unit.topics)) {
                  unit.topics.forEach(topic => {
                      // Force enum values to prevent Mongoose validation errors
                      topic.status = "Not Started";
                      topic.confidence = "Red";
                  });
              }
          });
      }

    } catch (e) {
      console.error('Failed to parse AI syllabus:', e);
      syllabusData = { syllabus: [] };
    }

    subject = new Subject({
      name,
      description: 'Auto-generated GATE Prep Subject',
      category: 'GATE Prep',
      syllabus: syllabusData.syllabus || []
    });

    await subject.save();
    res.json(subject);

  } catch (err) {
    console.error('GATE Prep Error:', err);
    res.status(500).json({ error: (err as any).message });
  }
});

// Update Topic Status / Confidence (Legacy PUT)
router.put('/:id/topic', async (req, res) => {
    try {
        const { topicName, status, confidence } = req.body;
        const subject = await Subject.findById(req.params.id);

        if(!subject) return res.status(404).json({error: 'Subject not found'});

        let updated = false;
        if (subject.syllabus) {
            for (const unit of subject.syllabus) {
                for (const topic of unit.topics) {
                    if (topic.name === topicName) {
                        if (status) topic.status = status;
                        if (confidence) topic.confidence = confidence;
                        updated = true;
                    }
                }
            }
        }

        if (updated) {
            subject.markModified('syllabus');
            await subject.save();
            res.json(subject);
        } else {
            res.status(404).json({error: 'Topic not found in syllabus'});
        }

    } catch (err) {
        res.status(500).json({ error: (err as any).message });
    }
});

// New Endpoint: Update Topic Status & Auto-Complete Subject
router.put('/:id/topic-status', async (req, res) => {
  try {
    const { topicName, status } = req.body;
    if (!topicName || !status) return res.status(400).json({ error: 'Topic name and status are required' });

    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    let topicFound = false;
    let allCompleted = true;

    if (subject.syllabus) {
      for (const unit of subject.syllabus) {
        for (const topic of unit.topics) {
          if (topic.name === topicName) {
            topic.status = status;
            topicFound = true;
          }
          // Check completion status of all topics
          if (topic.status !== 'Completed') {
            allCompleted = false;
          }
        }
      }
    }

    if (!topicFound) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Auto-update Subject Status
    if (allCompleted) {
      subject.status = 'Completed';
    } else if (subject.status === 'Not Started' && status === 'In Progress') {
      subject.status = 'In Progress';
    }

    subject.markModified('syllabus');
    await subject.save();
    res.json(subject);

  } catch (err) {
    console.error('Topic Status Update Error:', err);
    res.status(500).json({ error: (err as any).message });
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
