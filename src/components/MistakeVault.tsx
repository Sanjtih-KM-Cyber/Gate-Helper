import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, BrainCircuit } from 'lucide-react';

interface Mistake {
  _id: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export default function MistakeVault() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchMistakes();
  }, []);

  const fetchMistakes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/mistakes');
      setMistakes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const solveWithAI = async (id: string, mistake: Mistake) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await axios.post('http://localhost:5000/api/mistakes/solve-mistake', {
        question: mistake.question,
        userAnswer: mistake.userAnswer,
        correctAnswer: mistake.correctAnswer
      });
      setMistakes(prev => prev.map(m => m._id === id ? { ...m, explanation: res.data.explanation } : m));
    } catch (err) {
      console.error(err);
      alert('Failed to get AI explanation.');
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center space-x-3 mb-8">
        <AlertCircle className="text-red-500" size={32} />
        <h1 className="text-3xl font-bold text-white">Mistake Vault</h1>
      </div>

      {mistakes.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          No mistakes logged yet. Keep practicing!
        </div>
      ) : (
        <div className="space-y-6">
          {mistakes.map((mistake) => (
            <div key={mistake._id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-white mb-4">{mistake.question}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                <div className="p-3 bg-red-900/20 border border-red-800/50 rounded text-red-300">
                  <span className="font-bold block mb-1">Your Answer:</span>
                  {mistake.userAnswer}
                </div>
                <div className="p-3 bg-green-900/20 border border-green-800/50 rounded text-green-300">
                  <span className="font-bold block mb-1">Correct Answer:</span>
                  {mistake.correctAnswer}
                </div>
              </div>

              {mistake.explanation ? (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded p-4 text-gray-300 mt-4 animate-fade-in">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold mb-2">
                    <BrainCircuit size={18} /> <span>AI Explanation</span>
                  </div>
                  <ReactMarkdown>{mistake.explanation}</ReactMarkdown>
                </div>
              ) : (
                <button
                  onClick={() => solveWithAI(mistake._id, mistake)}
                  disabled={loading[mistake._id]}
                  className="mt-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 disabled:opacity-50 transition-colors"
                >
                  {loading[mistake._id] ? (
                    <span className="animate-pulse">Thinking...</span>
                  ) : (
                    <>
                      <BrainCircuit size={16} /> <span>Explain with Local AI</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
