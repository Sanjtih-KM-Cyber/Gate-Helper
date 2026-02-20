import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Routes
import uploadRoutes from './routes/upload.ts';
import agentRoutes from './routes/agent.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // MongoDB Connection
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gate_tutor';
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('Running in offline mode without database persistence (or ensure MongoDB is running).');
  }

  // API Routes
  app.use('/api/upload', uploadRoutes);
  app.use('/api/agent', agentRoutes);

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  // Vite Middleware (for development)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    // app.use(express.static(path.join(__dirname, '../dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`- API: http://localhost:${PORT}/api`);
    console.log(`- Client: http://localhost:${PORT}`);
  });
}

startServer();
