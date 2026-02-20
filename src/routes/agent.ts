import express from 'express';
import { ChatOllama } from '@langchain/ollama';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const router = express.Router();

// Initialize Local Ollama Model
const llm = new ChatOllama({
  model: 'llama3.2', // Ensure this model is pulled in Ollama
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
});

const searchTool = new DuckDuckGoSearch({ maxResults: 3 });

router.post('/generate-questions', async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`Searching for GATE questions on: ${topic}`);

    // 1. Search DuckDuckGo
    let searchResults = '';
    try {
      searchResults = await searchTool.invoke(`GATE previous year questions for ${topic}`);
    } catch (searchError) {
      console.error('Search failed:', searchError);
      searchResults = 'Search unavailable. Generating questions based on internal knowledge.';
    }

    // 2. Feed to Ollama
    const prompt = `
      You are an expert GATE exam tutor.
      
      Context from web search:
      ${searchResults}
      
      Task:
      Generate 4 practice questions for the topic "${topic}" based on the context and your knowledge of the GATE syllabus.
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
      new SystemMessage("You are a helpful AI assistant that outputs strict JSON."),
      new HumanMessage(prompt),
    ]);

    // Clean up response content to ensure valid JSON
    let cleanContent = response.content.toString().trim();
    // Remove markdown code blocks if present
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
      // Fallback or retry logic could go here
      return res.status(500).json({ error: 'Failed to parse AI response', raw: cleanContent });
    }

    res.json({ topic, questions });

  } catch (error: any) {
    console.error('Agent error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
