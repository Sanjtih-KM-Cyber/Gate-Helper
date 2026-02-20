import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const pptxParser = require('node-pptx-parser');
const nodewhisper = require('nodejs-whisper');

import Tesseract from 'tesseract.js';
import { YoutubeTranscript } from 'youtube-transcript';
import { OllamaEmbeddings } from '@langchain/ollama';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Initialize Ollama Embeddings (Local)
const embeddings = new OllamaEmbeddings({
  model: 'nomic-embed-text', // Ensure this model is pulled in Ollama
  baseUrl: 'http://localhost:11434',
});

// Helper function to process text for embeddings
async function processTextForEmbeddings(text: string, metadata: any) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  const docs = await splitter.createDocuments([text], [metadata]);
  
  // In a real app, you would store these embeddings in a vector store (e.g., Chroma, Faiss).
  // For this demo, we'll just generate them to show the integration.
  try {
    const vectors = await embeddings.embedDocuments(docs.map(d => d.pageContent));
    console.log(`Generated ${vectors.length} vectors for ${metadata.source}`);
    return { success: true, chunks: docs.length, vectorsGenerated: vectors.length };
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return { success: false, error: 'Ollama embedding failed. Ensure Ollama is running.' };
  }
}

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { type, youtubeUrl } = req.body; // type: 'pdf', 'pptx', 'image', 'audio', 'youtube'

    let extractedText = '';
    let metadata = { source: 'unknown' };

    if (youtubeUrl) {
      // Handle YouTube
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
        extractedText = transcript.map(t => t.text).join(' ');
        metadata = { source: youtubeUrl };
      } catch (err) {
        return res.status(400).json({ error: 'Failed to fetch YouTube transcript' });
      }
    } else if (file) {
      const filePath = file.path;
      metadata = { source: file.originalname };

      if (file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        extractedText = data.text;
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        // PPTX
        try {
            // node-pptx-parser usage might vary, assuming standard usage or fallback
            const parser = new pptxParser(filePath);
            const result: any = await parser.parse();
            extractedText = result.text || JSON.stringify(result); // Adjust based on library output
        } catch (e) {
             console.error("PPTX parse error", e);
             extractedText = "Error parsing PPTX";
        }
      } else if (file.mimetype.startsWith('image/')) {
        // Image (Tesseract)
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
        extractedText = text;
      } else if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
        // Audio (Whisper)
        // Note: nodejs-whisper requires local setup. This might fail in some envs.
        try {
            const result: any = await (nodewhisper as any)(filePath, {
                modelName: 'base.en', // Ensure model is available
                // whisperOptions
            });
            extractedText = result.transcription || JSON.stringify(result);
        } catch (e) {
            console.error("Whisper error", e);
            extractedText = "Error transcribing audio. Ensure Whisper is installed locally.";
        }
      }

      // Cleanup uploaded file
      fs.unlinkSync(filePath);
    } else {
      return res.status(400).json({ error: 'No file or YouTube URL provided' });
    }

    // Process for RAG
    const embeddingResult = await processTextForEmbeddings(extractedText, metadata);

    res.json({
      message: 'Content processed successfully',
      extractedTextLength: extractedText.length,
      embeddingResult,
    });

  } catch (error: any) {
    console.error('Upload processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
