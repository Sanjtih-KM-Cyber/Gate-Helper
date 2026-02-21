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

// Helper to get system prompt
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

router.post('/', async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`Searching for GATE questions on: ${topic}`);

    let searchResults = '';
    try {
      searchResults = await searchTool.invoke(`GATE previous year questions for ${topic}`);
    } catch (searchError) {
      console.error('Search failed:', searchError);
      searchResults = 'Search unavailable. Generating questions based on internal knowledge.';
    }

    // Retrieve local context from vector store
    const localContext = await getRelevantContext(topic);
    console.log(`Retrieved local context length: ${localContext.length}`);

    const baseInstruction = "You generate practice questions for GATE exams.";
    const systemPrompt = await getSystemPrompt(baseInstruction);

    const prompt = `
      Context from Uploaded Notes/Books:
      ${localContext || "No specific notes found. Rely on web search and general knowledge."}

      Context from Web Search:
      ${searchResults}
      
      Task:
      Generate 4 practice questions for the topic "${topic}" based on the context and your knowledge of the GATE syllabus.
      Prioritize information from "Uploaded Notes" if available.
      Categorize them exactly into: 'Easy', 'Medium', 'Hard', 'Topper Level'.
      
      Format the output as a strictly valid JSON array of objects with keys:
      - question (string)
      - options (array of strings)
      - answer (string - correct option)
      - explanation (string)
      - difficulty (string)

      Do not include any markdown formatting (like \`\`\`json). Just return the raw JSON string.
    `;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt),
    ]);

    let cleanContent = response.content.toString().trim();
    if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let questions;
    try {
      questions = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.log('Raw Content:', cleanContent);
      return res.status(500).json({ error: 'Failed to parse AI response', raw: cleanContent });
    }

    res.json({ topic, questions });

  } catch (error: any) {
    console.error('Agent error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/visualize', async (req, res) => {
  try {
    const { concept } = req.body;
    if (!concept) return res.status(400).json({ error: 'Concept is required' });

    // Retrieve local context
    const localContext = await getRelevantContext(concept);

    const systemPrompt = await getSystemPrompt("You are a technical diagram generator using Mermaid.js.");

    const prompt = `
      Context from Notes:
      ${localContext || "No specific notes found."}

      Create a Mermaid.js flowchart to explain the concept: "${concept}".
      Use the context to add specific details if available.

      IMPORTANT SYNTAX RULES:
      1. Use ONLY standard arrow syntax: A --> B
      2. DO NOT use ->> or -->> (these cause render errors).
      3. Start with 'graph TD' or 'graph LR'.
      4. Avoid special characters in node names unless wrapped in quotes (e.g. A["Node Name"]).

      Return ONLY the valid Mermaid code. Do not include markdown backticks.
    `;

    const response = await llm.invoke([
       new SystemMessage(systemPrompt),
       new HumanMessage(prompt)
    ]);

    let mermaidCode = response.content.toString().trim();
    if (mermaidCode.startsWith('```mermaid')) {
        mermaidCode = mermaidCode.replace(/^```mermaid\s*/, '').replace(/\s*```$/, '');
    } else if (mermaidCode.startsWith('```')) {
        mermaidCode = mermaidCode.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    res.json({ mermaid: mermaidCode });
  } catch (error: any) {
    console.error('Visualizer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New Endpoint: Explain Topic
router.post('/explain', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    // Retrieve local context
    const localContext = await getRelevantContext(topic);

    const systemPrompt = await getSystemPrompt("You are an expert tutor explaining concepts clearly.");

    const prompt = `
      Context from Notes:
      ${localContext || "No specific notes found."}

      Explain the concept "${topic}" in detail.
      Reference the "Context from Notes" if relevant to provide a tailored explanation.
      Use examples and keep the tone consistent with your persona.
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

// Chat Endpoint
router.post('/chat', async (req, res) => {
    try {
      const { message, topic } = req.body;
      if (!message) return res.status(400).json({ error: 'Message is required' });

      // Retrieve local context based on the message + topic
      const query = `${topic} ${message}`;
      const localContext = await getRelevantContext(query);

      const systemPrompt = await getSystemPrompt("You are an interactive tutor. Answer the student's question directly.");

      const prompt = `
        Current Topic: ${topic}
        Context from Uploaded Notes:
        ${localContext || "No specific notes found."}

        Student Question: ${message}

        Answer the question clearly and concisely. If the answer is in the Context from Uploaded Notes, explicitly mention "According to your notes...".
        If not, use your general knowledge.
      `;

      const response = await llm.invoke([
         new SystemMessage(systemPrompt),
         new HumanMessage(prompt)
      ]);

      res.json({ reply: response.content });
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({ error: error.message });
    }
  });

export default router;
