import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import * as lancedb from "@lancedb/lancedb";
import { OllamaEmbeddings } from "@langchain/ollama";
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('vector_store_lance');
const TABLE_NAME = 'gate_context';

// Initialize Embeddings
const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434",
});

let vectorStore: LanceDB | null = null;

// Initialize LanceDB Connection
const connectToDB = async () => {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }
  const db = await lancedb.connect(DB_PATH);

  // Create table if not exists (simulated by checking schema or just trying to create)
  try {
     const table = await db.openTable(TABLE_NAME);
     return table;
  } catch (e) {
     // Table doesn't exist, will be created on first write
     return null; // Let langchain create it
  }
};

export const getVectorStore = async () => {
  if (vectorStore) return vectorStore;

  console.log("Initializing LanceDB vector store...");
  const db = await lancedb.connect(DB_PATH);

  // Check if table exists
  let table;
  try {
      table = await db.openTable(TABLE_NAME);
  } catch {
      // If table missing, we initialize store without it first
      // LangChain handles table creation when adding documents
  }

  vectorStore = new LanceDB(embeddings, {
      table: table as any,
      tableName: TABLE_NAME
  });

  return vectorStore;
};

export const addDocumentsToStore = async (docs: any[]) => {
  const store = await getVectorStore();

  // Convert metadata to string if needed or ensure compatibility
  const processedDocs = docs.map(d => ({
      pageContent: d.pageContent,
      metadata: { ...d.metadata, id: d.metadata.source || 'unknown' }
  }));

  // Re-initialize to ensure connection is fresh
  const db = await lancedb.connect(DB_PATH);
  const table = await db.openTable(TABLE_NAME).catch(() => null);

  if (!table) {
      // First time creation via LangChain utility
      vectorStore = await LanceDB.fromDocuments(processedDocs, embeddings, {
          table: table as any,
          tableName: TABLE_NAME
      });
  } else {
      // Append to existing table
      await vectorStore?.addDocuments(processedDocs);
  }

  console.log(`Saved ${docs.length} documents to LanceDB at ${DB_PATH}`);
};

export const getRelevantContext = async (query: string, k: number = 3): Promise<string> => {
  const db = await lancedb.connect(DB_PATH);
  try {
      const table = await db.openTable(TABLE_NAME);
      const store = new LanceDB(embeddings, { table: table as any, tableName: TABLE_NAME });

      const results = await store.similaritySearch(query, k);
      return results.map(doc => doc.pageContent).join("\n\n");
  } catch (e) {
      console.log("No vector table found yet (no uploads). returning empty context.");
      return "";
  }
};
