import express from 'express';
import { ChatOllama } from '@langchain/ollama';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Settings } from '../models/Settings.ts';
import { getRelevantContext } from '../utils/vectorStore.ts';

const router = express.Router();

// Initialize Local Ollama Model
const llm = new ChatOllama({
  model: 'llama3.2',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
});

const searchTool = new DuckDuckGoSearch({ maxResults: 3 });

async function getSystemPrompt(baseInstruction: string) {
  try {
    const settings = await Settings.findOne();
    if (settings && settings.aiPersona) {
      return `${settings.aiPersona}\n\n${baseInstruction}`;
    }
  } catch (e) {
    console.error("Failed to fetch settings", e);
  }
  return `You are an expert GATE exam tutor.\n\n${baseInstruction}`;
}

// Helper: Robust JSON Extractor
function extractJSON(text: string): any {
  let cleanContent = text.trim();
  // Strip markdown code blocks
  if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // Attempt to fix common trailing comma issue before closing brace/bracket
  cleanContent = cleanContent.replace(/,\s*([\]}])/g, '$1');

  try {
      return JSON.parse(cleanContent);
  } catch (e) {
      console.error("JSON Parse Failed on content:", cleanContent);
      throw e;
  }
}

// Generate Questions (Infinite Exam Engine)
router.post('/questions', async (req, res) => {
  try {
    const { topic, count = 5, types = ['MCQ', 'MSQ', 'NAT'], prepType = 'GATE', syllabusContext = '' } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    console.log(`Generating questions for: ${topic} (Mode: ${prepType})`);

    const localContext = await getRelevantContext(topic);
    let searchResults = '';
    try {
      searchResults = await searchTool.invoke(`GATE previous year questions ${topic} ${types.join(' ')}`);
    } catch (e) {
      console.log('Search unavailable');
    }

    let systemInstruction = "";
    let formatInstruction = "";

    if (prepType === 'College') {
        systemInstruction = "You are an exhaustive exam generator. Generate a comprehensive set of unique questions covering the ENTIRE topic. Output MUST contain 2-mark, 5-mark, and 8-mark questions. Classify each by difficulty (Easy/Medium/Hard). Do not stop until all sub-concepts are covered.";
        formatInstruction = `
          Format Requirements:
          - 2-mark questions: Answer approx 40-50 words.
          - 5-mark questions: Answer approx 150-200 words.
          - 8-mark questions: Answer approx 300-400 words.

          Strictly limit scope to provided syllabus context.

          Strict JSON Format:
          [
            {
              "type": "2-mark" | "5-mark" | "8-mark",
              "question": "Question text...",
              "answer": "Detailed solution...",
              "difficulty": "Easy" | "Medium" | "Hard"
            }
          ]
        `;
    } else {
        // GATE Default
        systemInstruction = "You are an exhaustive GATE exam generator. Generate a comprehensive set of unique questions covering the ENTIRE topic. Formats MUST be MCQ, MSQ, and NAT. Classify each by difficulty: Easy, Medium, Hard, and Topper. Do not stop until all mathematical and theoretical sub-concepts are covered.";
        formatInstruction = `
          Must generate: MCQ (Multiple Choice), MSQ (Multiple Select), and NAT (Numerical Answer Type).
          Difficulty Levels: Easy, Medium, Hard, and Topper level.
          Exhaustive: Must cover every mathematical and theoretical sub-concept in the provided topic context.

          Strict JSON Format:
          [
            {
              "type": "MCQ" | "MSQ" | "NAT",
              "question": "Question text...",
              "options": ["A", "B", "C", "D"], // Empty for NAT
              "answer": "Correct Answer",
              "explanation": "Detailed solution...",
              "difficulty": "Easy" | "Medium" | "Hard" | "Topper"
            }
          ]
        `;
    }

    const systemPrompt = await getSystemPrompt(systemInstruction);
    const prompt = `
      Topic: ${topic}

      Syllabus Context:
      ${syllabusContext}

      Context from Notes:
      ${localContext || "No specific notes found."}
      ${searchResults}

      Task:
      Generate ${count} distinct questions for "${topic}".
      ${formatInstruction}

      IMPORTANT: You MUST output ONLY valid JSON. Every key and every string MUST be enclosed in double quotes. Do not output markdown backticks.
    `;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt)
    ]);

    let questions;
    try {
      questions = extractJSON(response.content.toString());
      if (!Array.isArray(questions)) questions = [];
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      questions = [];
    }

    res.json({ topic, questions });

  } catch (error: any) {
    console.error('Question Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate questions. Ensure Ollama is running.' });
  }
});

// Visualize Concept
router.post('/visualize', async (req, res) => {
  try {
    const { concept } = req.body;
    if (!concept) return res.status(400).json({ error: 'Concept is required' });

    const localContext = await getRelevantContext(concept);
    const systemPrompt = await getSystemPrompt("You are a technical diagram generator using Mermaid.js.");

    const prompt = `
      Context: ${localContext || "No specific notes found."}

      Task: Create a Mermaid.js flowchart for: "${concept}".

      STRICT SYNTAX RULES:
      1. Use ONLY standard arrow syntax: A --> B
      2. NEVER use ->> or -->> or -.- (these cause render errors).
      3. Start with 'graph TD' or 'graph LR'.
      4. Use simple node names like A[Node Label]. Avoid special chars inside [].
      5. Keep the graph simple and hierarchical.

      Return ONLY the valid Mermaid code. No markdown.
    `;

    const response = await llm.invoke([
       new SystemMessage(systemPrompt),
       new HumanMessage(prompt)
    ]);

    let mermaidCode = response.content.toString().trim();
    if (mermaidCode.startsWith('```mermaid')) mermaidCode = mermaidCode.replace(/^```mermaid\s*/, '').replace(/\s*```$/, '');
    else if (mermaidCode.startsWith('```')) mermaidCode = mermaidCode.replace(/^```\s*/, '').replace(/\s*```$/, '');

    if (mermaidCode.includes('->>')) {
        mermaidCode = mermaidCode.replace(/->>/g, '-->');
    }

    res.json({ mermaid: mermaidCode });

  } catch (error: any) {
    console.error('Visualizer error:', error);
    res.status(500).json({ error: 'Visualization generation failed.' });
  }
});

// Chat / Explain
router.post('/chat', async (req, res) => {
    try {
      const { message, topic, mode = 'standard' } = req.body;
      if (!message) return res.status(400).json({ error: 'Message is required' });

      const localContext = await getRelevantContext(`${topic} ${message}`);
      let searchResults = '';
      try {
          searchResults = await searchTool.invoke(`GATE ${topic} ${message}`);
      } catch(e) {
          console.log("Search failed for chat context");
      }

      let systemInstruction = "You are an interactive tutor. Answer the student's question directly.";
      if (mode === 'socratic') {
          systemInstruction = "You are a Socratic tutor. DO NOT give the answer directly. Instead, ask guiding questions to help the student derive the answer themselves. Give hints if they are stuck.";
      }

      // Fetch settings and apply to system prompt
      const finalSystemPrompt = await getSystemPrompt(systemInstruction);

      const prompt = `
        Current Topic: ${topic}
        Context:
        ${localContext || "No specific notes found."}
        ${searchResults}

        Student Question: ${message}

        Response Guideline:
        ${mode === 'socratic' ? 'Provide a hint or a follow-up question. Do not reveal the full answer.' : 'Provide a clear, direct answer.'}
      `;

      const response = await llm.invoke([
         new SystemMessage(finalSystemPrompt),
         new HumanMessage(prompt)
      ]);

      res.json({ reply: response.content });
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({ error: 'Chat service unavailable.' });
    }
  });

router.post('/explain', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const localContext = await getRelevantContext(topic);
    let searchResults = '';
    try {
        searchResults = await searchTool.invoke(`${topic} GATE computer science explanation tutorial`);
    } catch(e) {
        console.log("Search failed for explanation context");
    }

    const systemPrompt = await getSystemPrompt("You are an expert tutor explaining concepts clearly.");
    const prompt = `
      Context:
      ${localContext || "No specific notes found."}
      ${searchResults}

      Explain the concept "${topic}" in detail.
      Synthesize information from the Context.
      Use examples and keep the tone consistent.
      Structure the response with Markdown headers and bullet points.
    `;

    const response = await llm.invoke([
       new SystemMessage(systemPrompt),
       new HumanMessage(prompt)
    ]);

    res.json({ explanation: response.content });
  } catch (error: any) {
    console.error('Explanation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
      // Forward to /questions with defaults
      req.body.count = 4;
      req.body.types = ['MCQ'];
      return res.redirect(307, '/api/agent/questions');
});

export default router;
