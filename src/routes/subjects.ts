import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { search } from 'duck-duck-scrape';
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

// POST /gate-prep - Automated Web Scraping
router.post('/gate-prep', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required' });

    let subject = await Subject.findOne({ name, category: 'GATE Prep' });
    if (subject) return res.json(subject);

    console.log(`Auto-generating GATE syllabus for: ${name}`);

    const query = `official GATE computer science syllabus for ${name} topics units`;
    let combinedContent = '';
    try {
        const searchResults = await search(query, { safeSearch: 0 });
        const topResults = searchResults.results.slice(0, 2);
        for (const result of topResults) {
            try {
                const page = await axios.get(result.url, { timeout: 5000 });
                const $ = cheerio.load(page.data);
                $('script, style, nav, footer, header').remove();
                const text = $('body').text().replace(/\s+/g, ' ').trim();
                combinedContent += `\n--- Source: ${result.url} ---\n${text.substring(0, 5000)}`;
            } catch (scrapeErr) {
                console.error(`Failed to scrape ${result.url}`, scrapeErr);
            }
        }
    } catch (searchErr) {
        console.error("Search failed", searchErr);
    }

    if (!combinedContent) combinedContent = "Search failed. Use internal knowledge.";

    const systemPrompt = `You are an expert GATE Exam Tutor.`;
    const userPrompt = `
      Subject: ${name}
      Context: ${combinedContent}

      Task: Generate a comprehensive GATE syllabus JSON.
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

// Update Topic Status / Confidence
router.put('/:id/topic', async (req, res) => {
    try {
        const { unitName, topicName, status, confidence } = req.body;
        const subject = await Subject.findById(req.params.id);

        if(!subject) return res.status(404).json({error: 'Subject not found'});

        let updated = false;
        if (subject.syllabus) {
            for (const unit of subject.syllabus) {
                // simple loop to find topic
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
            // markModified is needed because we modified nested array
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

router.delete('/:id', async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

export default router;
