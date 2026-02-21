import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import mermaid from 'mermaid';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, BrainCircuit, Activity, Send, MessageSquare, AlertTriangle } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

// === Reusable Visualizer Component (Simplified) ===
mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });

function MermaidChart({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderChart = async () => {
      setError(null);
      if (containerRef.current && code) {
        try {
            if (code.includes('->>')) {
                 throw new Error("Invalid arrow syntax '->>' detected. Please regenerate.");
            }
            containerRef.current.innerHTML = '';
            const id = `mermaid-${Date.now()}`;
            const { svg } = await mermaid.render(id, code);
            containerRef.current.innerHTML = svg;
        } catch (err: any) {
            console.error('Mermaid render error', err);
            setError(err.message || 'Syntax Error');
            containerRef.current.innerHTML = '';
        }
      }
    };
    renderChart();
  }, [code]);

  if (error) {
      return (
          <div className="flex flex-col items-center justify-center p-8 bg-red-900/20 border border-red-800 rounded-lg min-h-[300px]">
              <AlertTriangle className="text-red-500 mb-2" size={32} />
              <p className="text-red-400 font-bold mb-1">Visualization Failed</p>
              <p className="text-red-300/80 text-sm text-center max-w-md">
                  {error}
              </p>
          </div>
      );
  }
  return <div ref={containerRef} className="overflow-x-auto flex justify-center p-4 bg-gray-950 rounded-lg min-h-[300px] items-center" />;
}

export default function TopicStudio() {
  const { id: subjectId, topic: topicName } = useParams<{ id: string; topic: string }>();
  const [activeTab, setActiveTab] = useState<'chat' | 'learn' | 'quiz' | 'visualize'>('chat');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState(''); // For Learn/Explain
  const [questions, setQuestions] = useState<Question[]>([]); // For Quiz
  const [mermaidCode, setMermaidCode] = useState(''); // For Visualize

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([{ sender: 'ai', text: `Hi! I'm your AI Tutor. Ask me anything about "${decodeURIComponent(topicName || '')}".` }]);
  const [inputMessage, setInputMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const decodedTopic = decodeURIComponent(topicName || '');

  // Reset state when topic changes
  useEffect(() => {
    setContent('');
    setQuestions([]);
    setMermaidCode('');
    setMessages([{ sender: 'ai', text: `Hi! I'm your AI Tutor. Ask me anything about "${decodedTopic}".` }]);
    setActiveTab('chat');
  }, [decodedTopic]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchExplanation = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/agent/explain', { topic: decodedTopic });
      setContent(res.data.explanation);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateQuiz = async () => {
    if (questions.length > 0) return;
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/agent', { topic: decodedTopic });
      setQuestions(res.data.questions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateVisualization = async () => {
    if (mermaidCode) return;
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/agent/visualize', { concept: decodedTopic });
      setMermaidCode(res.data.mermaid);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMsg = inputMessage;
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/agent/chat', {
          message: userMsg,
          topic: decodedTopic
      });
      setMessages(prev => [...prev, { sender: 'ai', text: res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, I encountered an error connecting to the backend.' }]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
         <div className="flex items-center space-x-4">
            <Link to={`/subject/${subjectId}`} className="text-gray-400 hover:text-white transition-colors bg-gray-800 p-2 rounded-full">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-white truncate max-w-md">{decodedTopic}</h1>
         </div>

         <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800 shadow-sm">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors text-sm font-medium ${activeTab === 'chat' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
               <MessageSquare size={16} /> <span>Chat</span>
            </button>
            <button
              onClick={() => { setActiveTab('learn'); if(!content) fetchExplanation(); }}
              className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors text-sm font-medium ${activeTab === 'learn' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
               <BookOpen size={16} /> <span>Notes</span>
            </button>
            <button
              onClick={() => { setActiveTab('quiz'); generateQuiz(); }}
              className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors text-sm font-medium ${activeTab === 'quiz' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
               <Activity size={16} /> <span>Quiz</span>
            </button>
            <button
              onClick={() => { setActiveTab('visualize'); generateVisualization(); }}
              className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors text-sm font-medium ${activeTab === 'visualize' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            >
               <BrainCircuit size={16} /> <span>Visualize</span>
            </button>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-inner custom-scrollbar relative flex flex-col">
        {loading && activeTab !== 'chat' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10 backdrop-blur-sm">
            <BrainCircuit size={48} className="mb-4 text-blue-500 animate-pulse" />
            <p className="text-xl text-gray-300 font-medium">Consulting AI Tutor...</p>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
            <>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                                msg.sender === 'user'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'
                            }`}>
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-800 text-gray-400 rounded-2xl px-5 py-3 rounded-bl-none border border-gray-700 animate-pulse">
                                Typing...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-4 bg-gray-900 border-t border-gray-800">
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-full px-6 py-3 pr-12 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
                            placeholder="Ask a doubt..."
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            disabled={loading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!inputMessage.trim() || loading}
                            className="absolute right-2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </>
        )}

        {/* Learn Tab */}
        {activeTab === 'learn' && (
          <div className="p-8 overflow-y-auto h-full">
            <div className="prose prose-invert prose-lg max-w-none">
                {content ? (
                    <ReactMarkdown>{content}</ReactMarkdown>
                ) : (
                    !loading && <div className="text-center text-gray-500 py-20">Content failed to load. Try refreshing or check backend connection.</div>
                )}
            </div>
          </div>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <div className="p-8 overflow-y-auto h-full">
            <div className="space-y-6 max-w-3xl mx-auto">
                {questions.map((q, idx) => (
                <div key={idx} className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-md">
                    <div className="flex justify-between mb-4">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded
                            ${q.difficulty === 'Easy' ? 'bg-green-900/30 text-green-400' :
                            q.difficulty === 'Medium' ? 'bg-yellow-900/30 text-yellow-400' :
                            'bg-red-900/30 text-red-400'}`}>
                            {q.difficulty}
                        </span>
                        <span className="text-gray-500 text-xs">Q{idx+1}</span>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-6 leading-relaxed">{q.question}</h3>
                    <div className="grid grid-cols-1 gap-3 mb-6">
                        {q.options.map(opt => (
                        <button key={opt} className="text-left p-4 rounded-lg bg-gray-900 hover:bg-gray-750 transition-colors border border-gray-800 hover:border-blue-500/50 text-gray-300 hover:text-white">
                            {opt}
                        </button>
                        ))}
                    </div>
                    <details className="text-sm text-gray-400 cursor-pointer group bg-gray-900/50 p-3 rounded border border-gray-800">
                        <summary className="group-hover:text-blue-400 transition-colors list-none font-medium flex items-center justify-between">
                            <span>Show Answer & Explanation</span>
                            <span className="text-xs text-gray-600 group-hover:text-blue-500">▼</span>
                        </summary>
                        <div className="mt-3 pt-3 border-t border-gray-700 text-gray-300">
                        <p className="font-bold text-green-400 mb-2">Correct Answer: {q.answer}</p>
                        <p className="leading-relaxed">{q.explanation}</p>
                        </div>
                    </details>
                </div>
                ))}
                {questions.length === 0 && !loading && (
                    <div className="text-center text-gray-500 py-20 border-2 border-dashed border-gray-800 rounded-xl">
                        No questions generated. Check if Ollama is running.
                    </div>
                )}
            </div>
          </div>
        )}

        {/* Visualize Tab */}
        {activeTab === 'visualize' && (
          <div className="p-8 h-full flex flex-col items-center justify-center overflow-y-auto">
             {mermaidCode ? (
               <div className="w-full bg-gray-950 rounded-lg border border-gray-800 p-6 shadow-xl overflow-x-auto flex justify-center">
                 <MermaidChart code={mermaidCode} />
               </div>
             ) : (
               !loading && <div className="text-center text-gray-500">Visualization unavailable.</div>
             )}
             {mermaidCode && (
                 <div className="mt-8 w-full max-w-2xl">
                     <h4 className="text-xs uppercase font-bold text-gray-500 mb-2">Mermaid Source</h4>
                     <pre className="bg-black p-4 rounded border border-gray-800 text-green-500 text-xs font-mono overflow-auto max-h-40">{mermaidCode}</pre>
                 </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
