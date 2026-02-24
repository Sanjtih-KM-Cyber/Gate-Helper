import express from 'express';
import { ChatOllama } from '@langchain/ollama';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Settings } from '../models/Settings.ts';
import { ChatSession } from '../models/ChatSession.ts';
import { getRelevantContext } from '../utils/vectorStore.ts';
import { execSync } from 'child_process';
import axios from 'axios';
import { jsonrepair } from 'jsonrepair';

const router = express.Router();

// Initialize Local Ollama Models
const llm = new ChatOllama({
  model: 'qwen2.5-coder:7b',
  baseUrl: 'http://localhost:11434',
  temperature: 0,
  format: 'json',
  maxRetries: 2,
});

// Code Assistant Model
const codeLlm = new ChatOllama({
  model: 'qwen2.5-coder:7b',
  baseUrl: 'http://localhost:11434',
  temperature: 0.2,
  maxRetries: 2,
});

const searchTool = new DuckDuckGoSearch({ maxResults: 3 });

async function getSystemPrompt(baseInstruction: string, category: string = 'GATE Prep') {
  let settings = null;
  try {
    settings = await Settings.findOne();
    // If settings exist and custom persona is set, use it (could be enhanced to support dual personas later)
    if (settings && settings.aiPersona) {
      return `${settings.aiPersona}\n\n${baseInstruction}`;
    }
  } catch (e) {
    console.error("Failed to fetch settings", e);
  }

  // 2. Fetch specific personas from Settings or Fallback
  let persona = '';
  if (settings) {
      switch (category) {
          case 'College Prep':
              persona = settings.collegePersona || '';
              break;
          case 'Lab':
              persona = settings.labPersona || '';
              break;
          case 'GATE Prep':
          default:
              persona = settings.gatePersona || '';
              break;
      }
  }

  // 3. Fallbacks if settings are empty
  if (!persona) {
      if (category === 'College Prep') {
          persona = `You are a patient and academic College Professor.
          Your goal is to help students understand concepts deeply for their semester exams.
          - Explain concepts step-by-step with clear definitions and examples.
          - Use a supportive and educational tone.`;
      } else if (category === 'Lab') {
          persona = `You are an expert Coding Assistant and Lab Instructor.
          - Provide clear, optimized, and well-commented code.
          - Explain logic step-by-step.`;
      } else {
          persona = `You are a strategic GATE Exam Coach.
          Your goal is to help students crack the exam with high scores.
          - Focus on problem-solving, shortcuts, and key formulas.`;
      }
  }

  return `${persona}\n\n${baseInstruction}`;
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
    const { code, action, language = 'c', message, sessionId } = req.body;
    if (!code || !action) return res.status(400).json({ error: 'Code and action are required' });

    let baseInstruction = "";
    let userPrompt = "";
    let userDisplayMessage = "";

    switch (action) {
      case 'explain':
        baseInstruction = "Explain the provided code step-by-step for a college student. Focus on logic and flow.";
        userPrompt = `Explain this ${language} code:\n\n${code}`;
        userDisplayMessage = "Explain this code";
        break;
      case 'shorten':
        baseInstruction = "Refactor the code to be shorter and more efficient without changing functionality. Provide the refactored code and a brief explanation.";
        userPrompt = `Shorten this ${language} code:\n\n${code}`;
        userDisplayMessage = "Refactor/Shorten code";
        break;
      case 'comment':
        baseInstruction = "Add detailed educational comments to the code. Explain complex lines.";
        userPrompt = `Add comments to this ${language} code:\n\n${code}`;
        userDisplayMessage = "Add comments";
        break;
      case 'chat':
         baseInstruction = "Answer the student's question about the code.";
         userPrompt = `Code:\n${code}\n\nQuestion: ${message || "Help me with this."}`;
         userDisplayMessage = message || "Code Query";
         break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Use the dynamic persona for 'Lab' category
    const systemPrompt = await getSystemPrompt(baseInstruction, 'Lab');

    try {
        // Check if streaming is requested
        if (req.body.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const stream = await codeLlm.stream([
                new SystemMessage(systemPrompt),
                new HumanMessage(userPrompt)
            ]);

            let fullResponse = '';

            for await (const chunk of stream) {
                if (chunk.content) {
                    const text = chunk.content.toString();
                    fullResponse += text;
                    res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
                }
            }
            res.write('data: [DONE]\n\n');
            res.end();

            // Persist Chat if sessionId provided
            if (sessionId) {
                 await ChatSession.findByIdAndUpdate(sessionId, {
                     $push: { messages: [
                         { role: 'user', content: userDisplayMessage, timestamp: new Date() },
                         { role: 'ai', content: fullResponse, timestamp: new Date() }
                     ]},
                     updatedAt: new Date()
                 });
            }

            return;
        }

        const response = await codeLlm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(userPrompt)
        ]);

        const aiContent = response.content.toString();

        // Persist Chat if sessionId provided
        if (sessionId) {
             await ChatSession.findByIdAndUpdate(sessionId, {
                 $push: { messages: [
                     { role: 'user', content: userDisplayMessage, timestamp: new Date() },
                     { role: 'ai', content: aiContent, timestamp: new Date() }
                 ]},
                 updatedAt: new Date()
             });
        }

        return res.json({ result: aiContent });
    } catch (modelErr) {
        console.warn("Failed to use qwen2.5-coder:7b, falling back to default LLM", modelErr);
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

// Generate Questions (Infinite Exam Engine)
router.post('/questions', async (req, res) => {
  try {
    const {
        topic,
        count = 5,
        types, // Optional override from frontend
        difficulty, // Optional override
        prepType = 'GATE',
        syllabusContext = ''
    } = req.body;

    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    // Defaults based on prepType if not provided
    const targetTypes = types && types.length > 0 ? types : (prepType === 'College' ? ['2-mark', '5-mark', '8-mark'] : ['MCQ', 'MSQ', 'NAT']);
    const targetDiff = difficulty && difficulty.length > 0 ? difficulty : (prepType === 'College' ? ['Easy', 'Medium', 'Hard'] : ['Hard', 'GATE Level']);
    const numQuestions = Math.min(Math.max(count, 1), 15); // Clamp 1-15

    console.log(`Generating ${numQuestions} questions for: ${topic} (Mode: ${prepType}, Types: ${targetTypes}, Diff: ${targetDiff})`);

    const localContext = await getRelevantContext(topic);
    let searchResults = '';
    try {
      searchResults = await searchTool.invoke(`GATE previous year questions ${topic} ${targetTypes.join(' ')}`);
    } catch (e) {
      console.log('Search unavailable');
    }

    let systemInstruction = "";
    let formatInstruction = "";

    if (prepType === 'College') {
        systemInstruction = "You are a strict exam generator. Generate a comprehensive set of unique questions. Output MUST contain 2-mark, 5-mark, and 8-mark questions. Classify each by difficulty (Easy/Medium/Hard).";
        formatInstruction = `
          CRITICAL INSTRUCTION - YOU MUST OBEY THESE STRICT WORD LIMITS FOR THE "answer" FIELD:
          - 2-mark questions: STRICTLY 30 to 40 words. (Do not write more than 2 sentences).
          - 5-mark questions: STRICTLY 150 to 200 words.
          - 8-mark questions: STRICTLY 300 to 400 words.

          If you write 100 words for a 2-mark question, you fail. Count your words mentally before generating the text.

          Required Types: ${targetTypes.join(', ')}
          Required Difficulty Levels: ${targetDiff.join(', ')}

          Strict JSON Format:
          [
            {
              "type": "2-mark" | "5-mark" | "8-mark",
              "question": "Question text...",
              "answer": "Detailed solution strictly adhering to the word limit...",
              "difficulty": "Easy" | "Medium" | "Hard"
            }
          ]
        `;
    } else {
        // GATE Default
        systemInstruction = "You are an exhaustive GATE exam generator. You create challenging, exam-level questions that test deep conceptual understanding and problem-solving skills.";
        formatInstruction = `
          MANDATORY REQUIREMENTS:
          1. **MCQ**: Must test deep conceptual clarity. Options should be confusing and closely related.
          2. **MSQ**: 1 to 4 options can be correct. Requires evaluating every option independently.
          3. **NAT**: Must require actual mathematical calculation or algorithm tracing. 'answer' must be a strict numerical value (e.g., "42", "3.14").
          4. **Difficulty**: Target levels: ${targetDiff.join(', ')}. Do not generate trivial questions.
          5. **Format**: Return ONLY valid JSON matching the template below. DO NOT include any conversational text.

          Required Types: ${targetTypes.join(', ')}

          Strict JSON Template:
          [
            {
              "type": "MCQ" | "MSQ" | "NAT",
              "question": "Complex question text...",
              "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"], // Required for MCQ/MSQ, Empty for NAT
              "answer": "Correct Answer",
              "explanation": "Detailed step-by-step solution...",
              "difficulty": "Hard" | "GATE Level" | "Topper",
              "verification_script": "print(2**10)" // Optional Python script for math checks
            }
          ]
        `;
    }

    const systemPrompt = await getSystemPrompt(systemInstruction, prepType === 'College' ? 'College Prep' : 'GATE Prep');
    let prompt = `
      Topic: ${topic}

      Syllabus Context:
      ${syllabusContext}

      Context from Notes:
      ${localContext || "No specific notes found."}
      ${searchResults}

      Task:
      Generate ${numQuestions} distinct, high-quality questions for "${topic}".
      ${formatInstruction}

      IMPORTANT: You MUST output ONLY valid JSON. Every key and every string MUST be enclosed in double quotes. Do not output markdown backticks.
    `;

    // First Pass Generation
    let response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(prompt)
    ]);

    let questions = [];
    questions = extractJSON(response.content.toString());
    if (!Array.isArray(questions)) questions = [];

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

            const correctedQuestions = extractJSON(correctionResponse.content.toString());
            if (Array.isArray(correctedQuestions) && correctedQuestions.length > 0) {
                questions = correctedQuestions;
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
    const json = extractJSON(response.content.toString());
    if (json && Array.isArray(json.questions)) {
        questions = json.questions;
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
    const systemPrompt = await getSystemPrompt("You are a technical diagram generator using Mermaid.js.", "GATE Prep");

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
      const { message, topic, mode = 'standard', category = 'GATE Prep' } = req.body;
      if (!message) return res.status(400).json({ error: 'Message is required' });

      const localContext = await getRelevantContext(`${topic} ${message}`);
      let searchResults = '';
      try {
          searchResults = await searchTool.invoke(`${category} ${topic} ${message}`);
      } catch(e) {
          console.log("Search failed for chat context");
      }

      let systemInstruction = "You are an interactive tutor. Answer the student's question directly.";
      if (mode === 'socratic') {
          systemInstruction = "You are a Socratic tutor. DO NOT give the answer directly. Instead, ask guiding questions to help the student derive the answer themselves. Give hints if they are stuck.";
      }

      // Fetch settings and apply to system prompt
      const finalSystemPrompt = await getSystemPrompt(systemInstruction, category);

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
    const { topic, category = 'GATE Prep' } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    const localContext = await getRelevantContext(topic);
    let searchResults = '';
    try {
        searchResults = await searchTool.invoke(`${topic} ${category} computer science explanation tutorial`);
    } catch(e) {
        console.log("Search failed for explanation context");
    }

    const systemPrompt = await getSystemPrompt("You are an expert tutor explaining concepts clearly.", category);
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
