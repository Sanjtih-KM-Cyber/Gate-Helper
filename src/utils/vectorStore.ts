import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OllamaEmbeddings } from "@langchain/ollama";
import fs from 'fs';
import path from 'path';

const VECTOR_STORE_PATH = path.resolve('vector_store');

// Initialize Embeddings
const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434",
});

let vectorStore: HNSWLib | null = null;

export const getVectorStore = async () => {
  if (vectorStore) return vectorStore;

  if (fs.existsSync(VECTOR_STORE_PATH)) {
    console.log("Loading existing vector store...");
    try {
      vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
    } catch (error) {
      console.error("Error loading vector store, initializing new one:", error);
      // Fallback if corrupted
      vectorStore = new HNSWLib(embeddings, { space: 'cosine' });
    }
  } else {
    console.log("Initializing new vector store...");
    vectorStore = new HNSWLib(embeddings, { space: 'cosine' });
  }
  return vectorStore;
};

export const addDocumentsToStore = async (docs: any[]) => {
  const store = await getVectorStore();
  await store.addDocuments(docs);

  if (!fs.existsSync(VECTOR_STORE_PATH)) {
      fs.mkdirSync(VECTOR_STORE_PATH, { recursive: true });
  }

  await store.save(VECTOR_STORE_PATH);
  console.log(`Saved ${docs.length} documents to vector store at ${VECTOR_STORE_PATH}`);
};

export const getRelevantContext = async (query: string, k: number = 3): Promise<string> => {
  const store = await getVectorStore();
  // We need to check if the store has any documents, otherwise similaritySearch might throw or return nothing
  if (!fs.existsSync(VECTOR_STORE_PATH) && store.index.getCurrentCount() === 0) {
      return "";
  }

  try {
      const results = await store.similaritySearch(query, k);
      return results.map(doc => doc.pageContent).join("\n\n");
  } catch (e) {
      console.error("Error searching vector store:", e);
      return "";
  }
};
