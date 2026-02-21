import React, { createContext, useContext, useState, ReactNode } from 'react';
import axios from 'axios';

export interface Question {
  type: 'MCQ' | 'MSQ' | 'NAT';
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

interface Task {
  id: string;
  type: 'QUESTION_GEN' | 'SYLLABUS_GEN';
  status: 'pending' | 'completed' | 'failed';
  topic?: string;
  timestamp: number;
}

interface GlobalTaskContextType {
  tasks: Task[];
  generatedQuestions: Record<string, Question[]>; // Map topic -> questions
  startQuestionGeneration: (topic: string, count?: number, types?: string[]) => Promise<void>;
  isGenerating: boolean;
  clearQuestions: (topic: string) => void;
}

const GlobalTaskContext = createContext<GlobalTaskContextType | undefined>(undefined);

export function useGlobalTask() {
  const context = useContext(GlobalTaskContext);
  if (!context) {
    throw new Error('useGlobalTask must be used within a GlobalTaskProvider');
  }
  return context;
}

export function GlobalTaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<Record<string, Question[]>>({});

  const isGenerating = tasks.some(t => t.status === 'pending');

  const startQuestionGeneration = async (topic: string, count: number = 5, types: string[] = ['MCQ', 'MSQ', 'NAT']) => {
    const taskId = Math.random().toString(36).substring(7);
    const newTask: Task = { id: taskId, type: 'QUESTION_GEN', status: 'pending', topic, timestamp: Date.now() };

    setTasks(prev => [...prev, newTask]);

    try {
      // Non-blocking request? No, we await it here but the UI component that calls this
      // can choose to not await or just rely on state updates.
      // However, to make it truly "background" across tabs, this context holds the state.

      const res = await axios.post('http://localhost:5000/api/agent/questions', {
        topic,
        count,
        types
      });

      if (res.data.questions) {
        setGeneratedQuestions(prev => ({
          ...prev,
          [topic]: [...(prev[topic] || []), ...res.data.questions]
        }));

        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
      } else {
        throw new Error('No questions returned');
      }

    } catch (error) {
      console.error('Background Generation Failed:', error);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'failed' } : t));
    }
  };

  const clearQuestions = (topic: string) => {
    setGeneratedQuestions(prev => {
      const newState = { ...prev };
      delete newState[topic];
      return newState;
    });
  };

  return (
    <GlobalTaskContext.Provider value={{ tasks, generatedQuestions, startQuestionGeneration, isGenerating, clearQuestions }}>
      {children}
    </GlobalTaskContext.Provider>
  );
}
