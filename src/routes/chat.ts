import express from 'express';
import { ChatSession } from '../models/ChatSession.ts';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const router = express.Router();

// Initialize Ollama
const llm = new ChatOllama({
  model: 'qwen2.5-coder:7b',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
});

// GET /sessions - List all chats (History)
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await ChatSession.find().sort({ updatedAt: -1 }).select('title createdAt');
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /sessions/:id - Get specific chat
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await ChatSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// POST /sessions - Create new chat
router.post('/sessions', async (req, res) => {
  try {
    const newSession = new ChatSession({
        title: 'New Chat',
        messages: []
    });
    await newSession.save();
    res.json(newSession);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// POST /sessions/:id/message - Send message & Get Reply (Non-streaming for now, or stream if requested)
router.post('/sessions/:id/message', async (req, res) => {
  try {
    const { message, attachments } = req.body;
    const session = await ChatSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // 1. Save User Message
    session.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
        attachments: attachments || []
    });

    // 2. Generate AI Response
    // Construct context from recent messages
    const history = session.messages.slice(-5).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

    const systemPrompt = "You are a helpful AI assistant in the Cyber Hub. You can analyze files, generate ideas, and help with any task.";
    const userPrompt = `
      History:
      ${history}

      User: ${message}
    `;

    const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
    ]);

    const aiText = response.content.toString();

    // 3. Save AI Message
    session.messages.push({
        role: 'ai',
        content: aiText,
        timestamp: new Date()
    });

    // 4. Update Title if it's the first exchange
    if (session.messages.length <= 2) {
        // Simple heuristic: First 5 words of user message
        session.title = message.split(' ').slice(0, 5).join(' ') + '...';
    }

    session.updatedAt = new Date();
    await session.save();

    res.json({ reply: aiText, session });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// DELETE /sessions/:id
router.delete('/sessions/:id', async (req, res) => {
    try {
        await ChatSession.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

export default router;
