# Setup Instructions

## 1. MongoDB Setup
You need a local MongoDB instance running for data persistence.

### Option A: Docker (Recommended)
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Option B: Local Installation
1. Download MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community).
2. Install and start the service.
   - macOS: `brew services start mongodb-community`
   - Linux: `sudo systemctl start mongod`
   - Windows: Run the installer and ensure the service is started.

## 2. Ollama Setup (Local AI)
You need Ollama running to power the Answer Generator, Mistake Solver, and Quiz Engine.

1. **Install Ollama**:
   - Download from [ollama.com](https://ollama.com).

2. **Pull Required Models**:
   The application is configured to use `llama3.2` for text generation and `nomic-embed-text` for embeddings (RAG).
   ```bash
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ```

3. **Start Ollama**:
   Ensure the Ollama server is running (usually on port 11434).
   ```bash
   ollama serve
   ```

## 3. Running the App
1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

2. Start the development server (Frontend + Backend):
   ```bash
   npm run dev
   ```

3. Access the app at `http://localhost:5000`.

## 4. Usage Tips
- **AI Persona**: Go to "AI Settings" in the sidebar to customize how the tutor speaks to you (e.g., "Socratic Method", "Strict Professor").
- **Subject Flow**: Create a Subject in "My Subjects", add Topics to it, then click a topic to access the unified Learn/Quiz/Visualize workspace.
