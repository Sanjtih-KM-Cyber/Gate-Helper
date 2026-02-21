import express from 'express';
import { ChatOllama } from '@langchain/ollama';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Settings } from '../models/Settings.ts';
import { getRelevantContext } from '../utils/vectorStore.ts';
import { execSync } from 'child_process';
import axios from 'axios';

const router = express.Router();

// Initialize Local Ollama Models
const llm = new ChatOllama({
  model: 'llama3.2',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
});

// Code Assistant Model (Qwen)
const codeLlm = new ChatOllama({
  model: 'qwen3-coder:30b', // Target model as requested
  baseUrl: 'http://localhost:11434',
  temperature: 0.2, // Lower temperature for code
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
  if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  cleanContent = cleanContent.replace(/,\s*([\]}])/g, '$1');
  try {
      return JSON.parse(cleanContent);
  } catch (e) {
      console.error("JSON Parse Failed on content:", cleanContent);
      throw e;
  }
}

// Helper: Verify Answer with Python
function verifyAnswerWithPython(script: string): string | null {
    try {
        const output = execSync(`python3 -c "${script.replace(/"/g, '\\"')}"`, { timeout: 2000, encoding: 'utf-8' });
        return output.trim();
    } catch (e) {
        console.warn("Python verification failed:", e);
        return null;
    }
}

// Lab Assistant Endpoint
router.post('/lab-assist', async (req, res) => {
  try {
    const { code, action, language = 'c' } = req.body;
    if (!code || !action) return res.status(400).json({ error: 'Code and action are required' });

    let systemPrompt = "You are an expert coding tutor.";
    let userPrompt = "";

    switch (action) {
      case 'explain':
        systemPrompt += " Explain the provided code step-by-step for a college student. Focus on logic and flow.";
        userPrompt = `Explain this ${language} code:\n\n${code}`;
        break;
      case 'shorten':
        systemPrompt += " Refactor the code to be shorter and more efficient without changing functionality. Provide the refactored code and a brief explanation.";
        userPrompt = `Shorten this ${language} code:\n\n${code}`;
        break;
      case 'comment':
        systemPrompt += " Add detailed educational comments to the code. Explain complex lines.";
        userPrompt = `Add comments to this ${language} code:\n\n${code}`;
        break;
      case 'chat':
         systemPrompt += " Answer the student's question about the code.";
         userPrompt = `Code:\n${code}\n\nQuestion: ${req.body.message || "Help me with this."}`;
         break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Try using the specialized coding model first
    try {
        const response = await codeLlm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userPrompt)
        ]);
        return res.json({ result: response.content });
    } catch (modelErr) {
        console.warn("Failed to use qwen3-coder:30b, falling back to default LLM", modelErr);
        // Fallback to standard LLM
        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userPrompt)
        ]);
        return res.json({ result: response.content });
    }

  } catch (error: any) {
    console.error('Lab Assist Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ... [Existing routes: questions, visualize, chat, explain, pyq] ...
// (Retaining existing code below for brevity in diff application, but writing full file content)

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

          For NAT or calculation-heavy questions, YOU MUST PROVIDE a "verification_script" field containing a small valid Python script that prints the result.
          Example: "verification_script": "print(2**10)"

          Strict JSON Format:
          [
            {
              "type": "MCQ" | "MSQ" | "NAT",
              "question": "Question text...",
              "options": ["A", "B", "C", "D"], // Empty for NAT
              "answer": "Correct Answer",
              "explanation": "Detailed solution...",
              "difficulty": "Easy" | "Medium" | "Hard" | "Topper",
              "verification_script": "print(...)" // Optional, for math checks
            }
          ]
        `;
    }

    const systemPrompt = await getSystemPrompt(systemInstruction);
    let prompt = `
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

    // First Pass Generation
    let response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt)
    ]);

    let questions = [];
    try {
      questions = extractJSON(response.content.toString());
      if (!Array.isArray(questions)) questions = [];
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      questions = [];
    }

    // Python Verification Step
    if (prepType === 'GATE' && questions.length > 0) {
        let correctionsNeeded = false;
        let correctionPrompt = "The following questions had incorrect answers based on Python verification:\n";

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (q.verification_script) {
                const pyResult = verifyAnswerWithPython(q.verification_script);
                if (pyResult !== null && pyResult !== q.answer) {
                    console.log(`Mismatch detected for Q${i+1}: LLM=${q.answer}, Python=${pyResult}`);
                    correctionsNeeded = true;
                    correctionPrompt += `Question ${i+1}: Your answer was "${q.answer}", but Python verification script output "${pyResult}". Please correct the answer or the script.\n`;
                }
            }
        }

        if (correctionsNeeded) {
            console.log("Triggering LLM Correction Loop...");
            const correctionResponse = await llm.invoke([
                new SystemMessage(systemPrompt),
                new HumanMessage(prompt), // Original context
                new SystemMessage("Your previous output had mathematical errors. Fix them based on the Python verification results below."),
                new HumanMessage(correctionPrompt + "\nRegenerate the COMPLETE JSON array with corrected answers.")
            ]);

            try {
                const correctedQuestions = extractJSON(correctionResponse.content.toString());
                if (Array.isArray(correctedQuestions) && correctedQuestions.length > 0) {
                    questions = correctedQuestions;
                }
            } catch (e) {
                console.error("Failed to parse corrected JSON. Keeping original.");
            }
        }
    }

    res.json({ topic, questions });

  } catch (error: any) {
    console.error('Question Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate questions. Ensure Ollama is running.' });
  }
});

// Fetch Real PYQs (Tavily)
router.post('/pyq', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY not found");

    const query = `GATE CSE previous year questions and solutions for ${topic} site:gateoverflow.in OR site:geeksforgeeks.org`;
    console.log(`Fetching PYQs via Tavily: ${query}`);

    let combinedContent = "";
    try {
        const tavilyResponse = await axios.post('https://api.tavily.com/search', {
            api_key: apiKey,
            query: query,
            search_depth: "advanced",
            include_raw_content: true,
            max_results: 5
        });

        if (tavilyResponse.data.results) {
            combinedContent = tavilyResponse.data.results.map((r: any) => r.raw_content || r.content).join('\n\n');
        }
    } catch (e) {
        console.warn("Tavily search failed", e);
        return res.json({ questions: [] }); // Fail gracefully
    }

    if (!combinedContent) return res.json({ questions: [] });

    const systemPrompt = "You are a strict GATE exam parser. Scan the provided search text and extract ALL actual Previous Year Questions (PYQs). Max limit: 15 questions. Prioritize a mix of MCQ, MSQ, and NAT if they exist in the text.\nCRITICAL INSTRUCTION: DO NOT invent or hallucinate questions to hit a quota. If the text only contains 3 real PYQs, output exactly 3. If none exist, output an empty array.";
    const prompt = `
        Search Text:
        ${combinedContent.substring(0, 20000)}

        Format exactly into this JSON schema: { "questions": [ { "question": "[Year] The exact question text", "type": "MCQ/MSQ/NAT", "marks": 1 or 2, "difficulty": "Hard", "answer": "The step-by-step solution" } ] }. Output ONLY valid JSON.
    `;

    const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(prompt)
    ]);

    let questions = [];
    try {
        const json = extractJSON(response.content.toString());
        if (json && Array.isArray(json.questions)) {
            questions = json.questions;
        }
    } catch (e) {
        console.error("PYQ Parsing Failed", e);
    }

    res.json({ questions });

  } catch (error: any) {
    console.error('PYQ Fetch Error:', error);
    res.status(500).json({ error: error.message });
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
