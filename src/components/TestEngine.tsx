import React, { useState } from 'react';
import axios from 'axios';
import { Search, BrainCircuit, CheckCircle, XCircle, Calculator, X } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
}

function VirtualCalculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');

  const handlePress = (val: string) => {
    if (val === 'C') {
      setDisplay('0');
      setExpression('');
    } else if (val === '=') {
      try {
        // eslint-disable-next-line no-eval
        const res = eval(expression + display); // Simple eval for demo
        setDisplay(String(res));
        setExpression('');
      } catch (e) {
        setDisplay('Error');
      }
    } else if (['+', '-', '*', '/'].includes(val)) {
      setExpression(expression + display + val);
      setDisplay('0');
    } else {
      setDisplay(display === '0' ? val : display + val);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-gray-200 text-black p-4 rounded-lg shadow-2xl border-4 border-gray-400 w-64 z-50 font-mono">
      <div className="flex justify-between items-center mb-2 bg-blue-800 text-white p-1 px-2 rounded-t">
        <span className="text-xs font-bold">GATE Virtual Calculator</span>
        <button onClick={onClose}><X size={14} /></button>
      </div>
      <div className="bg-white border border-gray-400 p-2 text-right mb-3 font-bold text-xl h-10 overflow-hidden">
        {display}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+','C'].map((btn) => (
          <button
            key={btn}
            onClick={() => handlePress(btn)}
            className={`p-2 rounded text-sm font-bold ${
              btn === 'C' ? 'bg-red-500 text-white col-span-4 mt-1' :
              btn === '=' ? 'bg-green-600 text-white' :
              ['/','*','-','+'].includes(btn) ? 'bg-blue-200' : 'bg-gray-100'
            }`}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TestEngine() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [results, setResults] = useState<{ [key: number]: boolean }>({});

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setQuestions([]);
    setSelectedAnswers({});
    setResults({});

    try {
      const response = await axios.post('http://localhost:5000/api/agent', { topic });
      setQuestions(response.data.questions);
    } catch (error) {
      console.error(error);
      alert('Failed to generate questions. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (qIndex: number, option: string) => {
    if (results[qIndex] !== undefined) return; // Prevent changing after checking
    setSelectedAnswers(prev => ({ ...prev, [qIndex]: option }));
  };

  const checkAnswer = (qIndex: number) => {
    const isCorrect = selectedAnswers[qIndex] === questions[qIndex].answer;
    setResults(prev => ({ ...prev, [qIndex]: isCorrect }));
  };

  return (
    <div className="max-w-5xl mx-auto relative pb-20">
      <div className="mb-8 flex justify-between items-start">
        <div>
           <h1 className="text-3xl font-bold text-white mb-2">Adaptive Test Engine</h1>
           <p className="text-gray-400">Generate GATE-level questions on any topic using AI agents.</p>
        </div>
        <button
          onClick={() => setShowCalculator(!showCalculator)}
          className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700 transition-colors"
        >
          <Calculator size={18} />
          <span>{showCalculator ? 'Hide Calculator' : 'Virtual Calculator'}</span>
        </button>
      </div>

      <form onSubmit={handleGenerate} className="mb-10">
        <div className="relative">
          <input
            type="text"
            placeholder="Enter a topic (e.g., 'Dijkstra Algorithm', 'TCP Congestion Control')..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 pl-12 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-lg"
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <button
            type="submit"
            disabled={loading || !topic}
            className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? 'Generating...' : 'Generate Test'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-pulse">
          <BrainCircuit size={48} className="mb-4 text-blue-500" />
          <p className="text-xl">Analyzing syllabus & generating questions...</p>
        </div>
      )}

      <div className="space-y-8">
        {questions.map((q, idx) => (
          <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="flex justify-between items-start mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                ${q.difficulty === 'Easy' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                  q.difficulty === 'Medium' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' :
                  q.difficulty === 'Hard' ? 'bg-orange-900/50 text-orange-400 border border-orange-800' :
                  'bg-purple-900/50 text-purple-400 border border-purple-800' // Topper Level
                }`}>
                {q.difficulty}
              </span>
              <span className="text-gray-500 text-sm">Q{idx + 1}</span>
            </div>

            <h3 className="text-lg font-medium text-white mb-6">{q.question}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleOptionSelect(idx, opt)}
                  className={`p-4 rounded-lg text-left border transition-all ${
                    selectedAnswers[idx] === opt
                      ? 'bg-blue-900/30 border-blue-500 text-blue-200'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750 hover:border-gray-600'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center border-t border-gray-800 pt-4">
               {results[idx] !== undefined ? (
                 <div className={`flex items-start space-x-2 ${results[idx] ? 'text-green-400' : 'text-red-400'}`}>
                   {results[idx] ? <CheckCircle className="mt-1" size={18} /> : <XCircle className="mt-1" size={18} />}
                   <div>
                     <p className="font-bold mb-1">{results[idx] ? 'Correct Answer' : 'Incorrect'}</p>
                     <p className="text-gray-400 text-sm">{q.explanation}</p>
                   </div>
                 </div>
               ) : (
                 <button
                    onClick={() => checkAnswer(idx)}
                    disabled={!selectedAnswers[idx]}
                    className="ml-auto bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                 >
                   Check Answer
                 </button>
               )}
            </div>
          </div>
        ))}
      </div>

      {showCalculator && <VirtualCalculator onClose={() => setShowCalculator(false)} />}
    </div>
  );
}
