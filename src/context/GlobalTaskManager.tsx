import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import axios from 'axios';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  id: string;
  type: 'ai-chat' | 'parse-code' | 'generate-questions';
  status: TaskStatus;
  payload: any; // Input data (e.g. prompt, file)
  result?: any;
  error?: string;
  progress?: number; // 0-100
  streamContent?: string; // For streaming text
  createdAt: number;
}

interface GlobalTaskContextType {
  tasks: Record<string, Task>;
  startTask: (type: Task['type'], payload: any) => string;
  getTask: (id: string) => Task | undefined;
  cancelTask: (id: string) => void;
  clearCompleted: () => void;
}

const GlobalTaskContext = createContext<GlobalTaskContextType | undefined>(undefined);

export const useGlobalTaskManager = () => {
  const context = useContext(GlobalTaskContext);
  if (!context) {
    throw new Error('useGlobalTaskManager must be used within a GlobalTaskManagerProvider');
  }
  return context;
};

// --- Legacy Context (Keep for now to avoid breaking existing code immediately) ---
interface LegacyContextType {
    generatedQuestions: any;
    isGenerating: boolean;
    startQuestionGeneration: (topic: string, count: number, types: string[], prepType: string) => void;
}
const LegacyGlobalTaskContext = createContext<LegacyContextType>({ generatedQuestions: {}, isGenerating: false, startQuestionGeneration: () => {} });
export const useGlobalTask = () => useContext(LegacyGlobalTaskContext);

export const GlobalTaskProvider = ({ children }: { children: ReactNode }) => {
    const [generatedQuestions, setGeneratedQuestions] = useState<any>({});
    const [isGenerating, setIsGenerating] = useState(false);

    const startQuestionGeneration = async (topic: string, count: number, types: string[], prepType: string) => {
        setIsGenerating(true);
        try {
            const res = await axios.post('http://localhost:5000/api/agent/questions', { topic, count, types, prepType });
            setGeneratedQuestions((prev: any) => ({ ...prev, [topic]: res.data.questions }));
        } catch (e) { console.error(e); }
        finally { setIsGenerating(false); }
    };

    return (
        <LegacyGlobalTaskContext.Provider value={{ generatedQuestions, isGenerating, startQuestionGeneration }}>
            {children}
        </LegacyGlobalTaskContext.Provider>
    );
}
// --- End Legacy ---

export const GlobalTaskManagerProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Record<string, Task>>({});

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  }, []);

  const executeTask = useCallback(async (id: string, type: Task['type'], payload: any) => {
    updateTask(id, { status: 'running' });

    try {
      if (type === 'ai-chat') {
        try {
            const response = await fetch('http://localhost:5000/api/agent/lab-assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, stream: true })
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process lines separated by double newline (SSE standard)
                const lines = buffer.split('\n\n');
                // Keep the last partial line in buffer
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine.startsWith("data: ")) continue;

                    const data = trimmedLine.slice(6);
                    if (data === "[DONE]") {
                        updateTask(id, { status: 'completed', result: fullText });
                        return;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.chunk) {
                            fullText += parsed.chunk;
                            // Update UI with stream content
                            updateTask(id, { streamContent: fullText });
                        }
                    } catch (e) {
                        console.warn("Stream JSON parse error:", e);
                    }
                }
            }

            // Flush remaining buffer if any
            if (buffer.trim().startsWith("data: ")) {
                 const data = buffer.trim().slice(6);
                 if (data !== "[DONE]") {
                     try {
                        const parsed = JSON.parse(data);
                        if (parsed.chunk) fullText += parsed.chunk;
                     } catch (e) { console.warn("Final chunk parse error", e); }
                 }
            }

            updateTask(id, { status: 'completed', result: fullText });

        } catch (err: any) {
            console.error("Streaming failed, falling back to blocking request", err);
            // Fallback
            const response = await axios.post('http://localhost:5000/api/agent/lab-assist', { ...payload, stream: false });
            updateTask(id, { status: 'completed', result: response.data.result });
        }

      } else if (type === 'parse-code') {
        const response = await axios.post(`http://localhost:5000/api/subjects/${payload.subjectId}/parse-experiment-detail`, {
            topicName: payload.topicName
        });
        updateTask(id, { status: 'completed', result: response.data.code });
      }
      // Add other task types here
    } catch (error: any) {
      console.error(`Task ${id} failed:`, error);
      updateTask(id, { status: 'failed', error: error.message || 'Task failed' });
    }
  }, [updateTask]);

  const startTask = useCallback((type: Task['type'], payload: any) => {
    const id = crypto.randomUUID();
    const newTask: Task = {
      id,
      type,
      status: 'pending',
      payload,
      createdAt: Date.now(),
      streamContent: ''
    };

    setTasks(prev => ({ ...prev, [id]: newTask }));

    // Execute Task Logic
    executeTask(id, type, payload);

    return id;
  }, [executeTask]);

  const getTask = (id: string) => tasks[id];

  const cancelTask = (id: string) => {
    updateTask(id, { status: 'failed', error: 'Cancelled by user' });
  };

  const clearCompleted = () => {
    setTasks(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
            if (next[key].status === 'completed' || next[key].status === 'failed') {
                delete next[key];
            }
        });
        return next;
    });
  };

  return (
    <GlobalTaskContext.Provider value={{ tasks, startTask, getTask, cancelTask, clearCompleted }}>
      {children}
    </GlobalTaskContext.Provider>
  );
};
