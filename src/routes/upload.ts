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
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { addDocumentsToStore } from '../utils/vectorStore.ts';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Helper function to process text for embeddings
async function processTextForEmbeddings(text: string, metadata: any) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  const docs = await splitter.createDocuments([text], [metadata]);
  
  try {
    // Add documents to the persistent vector store
    await addDocumentsToStore(docs);
    return { vectorsGenerated: docs.length, message: "Embeddings stored successfully" };
  } catch (error) {
    console.error('Error generating/storing embeddings:', error);
    throw new Error('Failed to store embeddings');
  }
}

router.post('/', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { youtubeUrl } = req.body;
    const results: any[] = [];

    // 1. Handle YouTube URL (if provided)
    if (youtubeUrl) {
      try {
        const transcript = await YoutubeTranscript.fetchTranscript(youtubeUrl);
        const extractedText = transcript.map((t: any) => t.text).join(' ');
        const metadata = { source: youtubeUrl };
        const embeddingResult = await processTextForEmbeddings(extractedText, metadata);
        results.push({ source: youtubeUrl, type: 'youtube', success: true, ...embeddingResult });
      } catch (err: any) {
        results.push({ source: youtubeUrl, type: 'youtube', success: false, error: err.message || 'Failed to fetch YouTube transcript' });
      }
    }

    // 2. Handle Files (if provided)
    if (files && files.length > 0) {
      for (const file of files) {
        let extractedText = '';
        let metadata = { source: file.originalname };
        let success = true;
        let errorMsg = '';

        try {
            const filePath = file.path;

            if (file.mimetype === 'application/pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);
                extractedText = data.text;
            } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
                // PPTX
                try {
                    const parser = new pptxParser(filePath);
                    const result: any = await parser.parse();
                    extractedText = result.text || JSON.stringify(result);
                } catch (e) {
                    console.error("PPTX parse error", e);
                    extractedText = "Error parsing PPTX";
                    success = false;
                    errorMsg = "PPTX parse error";
                }
            } else if (file.mimetype.startsWith('image/')) {
                // Image (Tesseract)
                try {
                   const { data: { text } } = await Tesseract.recognize(filePath, 'eng');
                   extractedText = text;
                } catch(e) {
                   console.error("OCR error", e);
                   success = false;
                   errorMsg = "OCR failed";
                }
            } else if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
                // Audio (Whisper)
                try {
                    const result: any = await (nodewhisper as any)(filePath, {
                        modelName: 'base.en', // Ensure model is available
                    });
                    extractedText = result.transcription || JSON.stringify(result);
                } catch (e) {
                    console.error("Whisper error", e);
                    extractedText = "Error transcribing audio. Ensure Whisper is installed locally.";
                    success = false;
                    errorMsg = "Whisper transcription failed";
                }
            } else {
                 // Try treating as plain text for unknown types if possible, or skip
                 success = false;
                 errorMsg = `Unsupported file type: ${file.mimetype}`;
            }

            // Cleanup uploaded file
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            if (success && extractedText) {
                const embeddingResult = await processTextForEmbeddings(extractedText, metadata);
                results.push({ source: file.originalname, type: 'file', success: true, ...embeddingResult });
            } else {
                results.push({ source: file.originalname, type: 'file', success: false, error: errorMsg || "Extraction failed" });
            }

        } catch (e: any) {
            console.error(`Error processing file ${file.originalname}:`, e);
            results.push({ source: file.originalname, type: 'file', success: false, error: e.message });
            // ensure cleanup even on error
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
      }
    }

    if (results.length === 0) {
      return res.status(400).json({ error: 'No files or YouTube URL provided' });
    }

    res.json({
      message: `Processed ${results.length} items.`,
      results,
    });

  } catch (error: any) {
    console.error('Upload processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
