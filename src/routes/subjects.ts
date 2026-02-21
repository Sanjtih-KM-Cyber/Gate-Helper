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
import { jsonrepair } from 'jsonrepair';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Initialize Local Ollama Model
const llm = new ChatOllama({
  model: 'qwen2.5-coder:7b',
  baseUrl: 'http://localhost:11434',
  temperature: 0,
  format: 'json',
  maxRetries: 2,
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

// Helper: Robust JSON Extractor using jsonrepair
function extractJSON(text: string): any {
  let cleanContent = text.trim();
  if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
      const repaired = jsonrepair(cleanContent);
      return JSON.parse(repaired);
  } catch (e) {
      console.error("JSON Repair/Parse Failed on content:", cleanContent);
      return [];
  }
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

// POST /college-prep - Create Subject (Manual Setup + File Upload) - Handles both College and GATE custom uploads
router.post('/college-prep', upload.array('files'), async (req, res) => {
  try {
    // Default to 'College Prep' if category not provided, but allow override (e.g. 'GATE Prep')
    const { name, description, type = 'Theory', category = 'College Prep' } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!name) return res.status(400).json({ error: 'Subject name is required' });

    // Handle Lab Type: Create Empty Subject
    if (type === 'Lab') {
       const newSubject = new Subject({
          name,
          description,
          category, // Use dynamic category
          type: 'Lab',
          syllabus: []
       });
       await newSubject.save();
       return res.json(newSubject);
    }

    // Handle Theory Type: Require Files
    if (!files || files.length === 0) return res.status(400).json({ error: 'Syllabus files are required for Theory subjects' });

    console.log(`Processing ${category} subject: ${name}`);

    let combinedText = '';
    for (const file of files) {
      const text = await parseFile(file);
      combinedText += `\n--- File: ${file.originalname} ---\n${text}`;
    }

    const systemPrompt = `You are an academic assistant. Extract a structured syllabus from course documents. You must output ONLY valid JSON. Do not include any conversational text, introductions, or formatting outside of the JSON block.`;
    const userPrompt = `
      Subject: ${name}
      Category: ${category}
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

    let syllabusData: { syllabus: IUnit[] };
    try {
      syllabusData = extractJSON(response.content.toString());
      if (!syllabusData || !syllabusData.syllabus) {
          throw new Error("Invalid structure");
      }
    } catch (e) {
      console.error('Failed to parse AI syllabus:', e);
      syllabusData = { syllabus: [{ title: 'Overview', topics: [{ name: 'Introduction', status: 'Not Started', confidence: 'Red' }] }] };
    }

    const newSubject = new Subject({
      name,
      description,
      category, // Use dynamic category
      type: 'Theory',
      syllabus: syllabusData.syllabus || []
    });

    await newSubject.save();
    res.json(newSubject);

  } catch (err) {
    console.error('Creation Error:', err);
    res.status(500).json({ error: (err as any).message });
  }
});

// POST /api/subjects/:id/parse-lab-manual - Lab Manual Parser
router.post('/:id/parse-lab-manual', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Lab manual PDF is required' });

    const subject = await Subject.findById(id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    console.log(`Parsing Lab Manual for: ${subject.name}`);
    const text = await parseFile(file);

    const systemPrompt = `You are an expert lab assistant. Extract the list of experiments from this lab manual. You must output ONLY valid JSON.`;
    const userPrompt = `
      Manual Text:
      ${text.substring(0, 20000)}

      Task: Structure the experiments into Main Experiments (Units) and Sub-Experiments (Topics).
      Example: Main: 'Experiment 1: Input/Output', Sub: '1(a) Read Input', '1(b) Print Output'.

      Return JSON:
      {
        "syllabus": [
          {
            "title": "Experiment 1: Name",
            "topics": [
               { "name": "1(a) Sub Experiment Name", "status": "Not Started", "confidence": "Red" }
            ]
          }
        ]
      }
    `;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    let parsedData;
    try {
      parsedData = extractJSON(response.content.toString());
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse lab manual structure' });
    }

    if (parsedData.syllabus) {
       subject.syllabus = parsedData.syllabus;
       subject.markModified('syllabus');
       await subject.save();
    }

    res.json(subject);

  } catch (err) {
    console.error('Lab Parse Error:', err);
    res.status(500).json({ error: (err as any).message });
  }
});

// POST /gate-prep - Automated Web Scraping (Tavily API)
router.post('/gate-prep', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required' });

    let subject = await Subject.findOne({ name, category: 'GATE Prep' });
    if (subject) return res.json(subject);

    console.log(`Auto-generating GATE syllabus for: ${name}`);

    let combinedContent = '';

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
        combinedContent = "";
    }

    if (!combinedContent) combinedContent = "Search failed or unavailable. Use internal knowledge to generate the syllabus.";

    const systemPrompt = `You are an expert GATE Exam Tutor.
    IMPORTANT:
    Every topic MUST have a status of exactly 'Not Started'.
    Every topic MUST have a confidence of exactly 'Red'.
    You must output ONLY valid JSON. Do not include any conversational text.`;

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

    let syllabusData: { syllabus: IUnit[] };
    try {
      syllabusData = extractJSON(response.content.toString());

      if (syllabusData.syllabus && Array.isArray(syllabusData.syllabus)) {
          syllabusData.syllabus.forEach(unit => {
              if (unit.topics && Array.isArray(unit.topics)) {
                  unit.topics.forEach(topic => {
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

// POST /gate-upload - Master GATE Syllabus Upload & Merge
router.post('/gate-upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Syllabus file is required' });

    console.log(`Processing Master GATE Syllabus: ${file.originalname}`);
    const text = await parseFile(file);

    const systemPrompt = `You are a data extraction AI. Extract structured syllabus data from the provided text.
    The text contains syllabus for one or multiple GATE subjects.
    You must output ONLY valid JSON. Do not include any conversational text, introductions, or formatting outside of the JSON block.

    Task: Return a strict JSON object with this structure:
    {
      "subjects": [
        {
          "name": "Subject Name",
          "syllabus": [
             {
               "title": "Unit Name",
               "topics": [ { "name": "Topic 1" }, { "name": "Topic 2" } ]
             }
          ]
        }
      ]
    }

    Ignore non-syllabus text.
    `;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(text.substring(0, 25000)) // Limit context
    ]);

    let extractedData;
    try {
      extractedData = extractJSON(response.content.toString());
    } catch (e) {
      console.error('Failed to parse Master Syllabus JSON:', e);
      return res.status(500).json({ error: 'Failed to extract syllabus structure from AI response.' });
    }

    if (!extractedData || !extractedData.subjects || !Array.isArray(extractedData.subjects)) {
        return res.status(400).json({ error: 'Invalid AI response structure.' });
    }

    const results = [];

    // Merge Logic
    for (const subData of extractedData.subjects) {
       let subject = await Subject.findOne({ name: subData.name, category: 'GATE Prep' });

       if (!subject) {
           // Create New
           // Sanitize new topics
           const sanitizedSyllabus = subData.syllabus.map((unit: any) => ({
               title: unit.title,
               topics: unit.topics.map((t: any) => ({
                   name: t.name,
                   status: 'Not Started',
                   confidence: 'Red'
               }))
           }));

           subject = new Subject({
               name: subData.name,
               description: 'Extracted from Master Syllabus',
               category: 'GATE Prep',
               syllabus: sanitizedSyllabus
           });
       } else {
           // Merge
           subData.syllabus.forEach((newUnit: any) => {
               const existingUnit = subject!.syllabus.find(u => u.title === newUnit.title);
               if (existingUnit) {
                   // Merge topics
                   newUnit.topics.forEach((newTopic: any) => {
                       if (!existingUnit.topics.some(t => t.name === newTopic.name)) {
                           existingUnit.topics.push({
                               name: newTopic.name,
                               status: 'Not Started',
                               confidence: 'Red'
                           });
                       }
                   });
               } else {
                   // Add new unit
                   subject!.syllabus.push({
                       title: newUnit.title,
                       topics: newUnit.topics.map((t: any) => ({
                           name: t.name,
                           status: 'Not Started',
                           confidence: 'Red'
                       }))
                   });
               }
           });
           subject.markModified('syllabus');
       }
       await subject.save();
       results.push(subject.name);
    }

    res.json({ message: `Successfully processed ${results.length} subjects.`, subjects: results });

  } catch (err) {
    console.error('Gate Upload Error:', err);
    res.status(500).json({ error: (err as any).message });
  }
});

// Update Topic Status / Confidence
router.put('/:id/topic', async (req, res) => {
    try {
        const { topicName, status, confidence, code } = req.body;
        const subject = await Subject.findById(req.params.id);

        if(!subject) return res.status(404).json({error: 'Subject not found'});

        let updated = false;
        if (subject.syllabus) {
            for (const unit of subject.syllabus) {
                for (const topic of unit.topics) {
                    if (topic.name === topicName) {
                        if (status) topic.status = status;
                        if (confidence) topic.confidence = confidence;
                        if (code !== undefined) topic.code = code; // Update code if provided
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

// Update Topic Status & Auto-Complete Subject
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
          if (topic.status !== 'Completed') {
            allCompleted = false;
          }
        }
      }
    }

    if (!topicFound) {
      return res.status(404).json({ error: 'Topic not found' });
    }

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
