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
// This was likely the old 'GlobalTaskContext' for question generation.
// We will merge functionality or keep them side-by-side for this refactor.
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

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

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
  }, []);

  const executeTask = async (id: string, type: Task['type'], payload: any) => {
    updateTask(id, { status: 'running' });

    try {
      if (type === 'ai-chat') {
        // Stream AI Chat
        const response = await fetch('http://localhost:5000/api/agent/lab-assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, stream: true })
        });

        if (!response.body) throw new Error("No stream body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '').trim();
                    if (dataStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.chunk) {
                            fullText += data.chunk;
                            updateTask(id, { streamContent: fullText });
                        }
                    } catch (e) {
                        console.error("Error parsing JSON chunk", e);
                    }
                }
            }
        }
        updateTask(id, { status: 'completed', result: fullText });

      } else if (type === 'parse-code') {
        // Lazy Parse Experiment Code
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
  };

  const getTask = (id: string) => tasks[id];

  const cancelTask = (id: string) => {
    // For now, just mark as failed. Real cancellation requires AbortController support.
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
