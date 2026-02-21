import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, AlertTriangle, Code, BrainCircuit,
  Send, CheckCircle, HelpCircle, Activity,
  Maximize2, Minimize2, Loader2, Save, Calculator, PenTool, Eraser, Trash2, Download, Bookmark, Globe, Settings as SettingsIcon, Filter
} from 'lucide-react';
import { useGlobalTask, Question } from '../context/GlobalTaskManager';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

interface Mistake {
  _id: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
}

// === Sub-components ===

function SimpleCalculator() {
  const [display, setDisplay] = useState('');

  const handleBtn = (val: string) => {
    if (val === 'C') setDisplay('');
    else if (val === '=') {
      try {
        // eslint-disable-next-line
        setDisplay(eval(display).toString());
      } catch (e) {
        setDisplay('Error');
      }
    } else {
      setDisplay(prev => prev + val);
    }
  };

  const buttons = [
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    '0', '.', '=', '+',
    'C'
  ];

  return (
    <div className="p-4 flex flex-col h-full bg-gray-950">
      <div className="bg-gray-800 p-4 rounded-lg mb-4 text-right text-2xl font-mono text-white overflow-x-auto">
        {display || '0'}
      </div>
      <div className="grid grid-cols-4 gap-2 flex-1">
        {buttons.map(btn => (
          <button
            key={btn}
            onClick={() => handleBtn(btn)}
            className={`rounded-lg font-bold text-xl transition-colors ${
              btn === '=' ? 'bg-blue-600 hover:bg-blue-500 text-white col-span-2' :
              btn === 'C' ? 'bg-red-600 hover:bg-red-500 text-white col-span-2' :
              ['/', '*', '-', '+'].includes(btn) ? 'bg-gray-700 hover:bg-gray-600 text-blue-400' :
              'bg-gray-800 hover:bg-gray-700 text-gray-200'
            }`}
            style={{ gridColumn: btn === '=' || btn === 'C' ? 'span 2' : 'span 1' }}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
}

function DigitalWhiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [eraser, setEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 300;
        canvas.height = canvas.parentElement?.clientHeight || 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = "#111827"; // bg-gray-900
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
  }, []);

  const startDrawing = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = eraser ? '#111827' : color;
    ctx.lineWidth = eraser ? 20 : 2;
    ctx.lineCap = 'round';

    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.fillStyle = "#111827";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
  }

  return (
      <div className="flex flex-col h-full bg-gray-950 relative">
          <div className="absolute top-2 left-2 flex space-x-2 bg-gray-800/80 p-1 rounded-lg backdrop-blur-sm border border-gray-700">
              <input type="color" value={color} onChange={e => { setColor(e.target.value); setEraser(false); }} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
              <button onClick={() => setEraser(!eraser)} className={`p-1.5 rounded ${eraser ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`} title="Eraser">
                  <Eraser size={16}/>
              </button>
              <button onClick={clear} className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-700" title="Clear">
                  <Trash2 size={16}/>
              </button>
          </div>
          <canvas
              ref={canvasRef}
              className="flex-1 cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
          />
      </div>
  )
}

// === Main Component ===

export default function TopicStudio() {
  const { subjectId, topic } = useParams<{ subjectId: string; topic: string }>();
  const decodedTopic = decodeURIComponent(topic || '');

  const [activeTab, setActiveTab] = useState<'chat' | 'exam' | 'mistakes'>('chat');
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [sidePanelTab, setSidePanelTab] = useState<'code' | 'whiteboard' | 'calculator'>('code');

  const [confidence, setConfidence] = useState<'Red' | 'Yellow' | 'Green'>('Red');
  const [status, setStatus] = useState<'Not Started' | 'In Progress' | 'Completed'>('In Progress');
  const [prepType, setPrepType] = useState<'College' | 'GATE'>('GATE');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [socraticMode, setSocraticMode] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [scratchpadContent, setScratchpadContent] = useState('// Write your C code or SQL queries here...');

  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loadingMistakes, setLoadingMistakes] = useState(false);

  // New State for Features
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);
  const [fetchingPYQ, setFetchingPYQ] = useState(false);
  const [realPYQs, setRealPYQs] = useState<any[]>([]);

  // Exam Configuration State
  const [examConfigOpen, setExamConfigOpen] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string[]>(['Medium', 'Hard']);

  const { generatedQuestions, startQuestionGeneration, isGenerating } = useGlobalTask();
  const topicQuestions = generatedQuestions[decodedTopic] || [];

  // Init & Persistence
  useEffect(() => {
    fetchTopicDetails();
    if (activeTab === 'mistakes') fetchMistakes();

    // Load Chat History
    const savedMessages = localStorage.getItem(`chat_${subjectId}_${decodedTopic}`);
    if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
    } else {
        setMessages([{ sender: 'ai', text: `Hi! I'm your AI Tutor. Let's master "${decodedTopic}".` }]);
    }
  }, [subjectId, decodedTopic, activeTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, realPYQs]);

  // Save Chat History on Update
  useEffect(() => {
    if (messages.length > 0) {
        localStorage.setItem(`chat_${subjectId}_${decodedTopic}`, JSON.stringify(messages));
    }
  }, [messages, subjectId, decodedTopic]);

  // Initialize Exam Defaults based on PrepType
  useEffect(() => {
      if (prepType === 'College') {
          setSelectedTypes(['2-mark', '5-mark']);
      } else {
          setSelectedTypes(['MCQ', 'NAT']);
      }
  }, [prepType]);

  const fetchTopicDetails = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/subjects/${subjectId}`);
      if (res.data) {
        if (res.data.category === 'College Prep') setPrepType('College');
        else setPrepType('GATE');

        if (res.data.syllabus) {
            for (const unit of res.data.syllabus) {
                const t = unit.topics.find((t: any) => t.name === decodedTopic);
                if (t) {
                    setConfidence(t.confidence);
                    setStatus(t.status);
                    break;
                }
            }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateTopicStatus = async (newStatus: 'Not Started' | 'In Progress' | 'Completed') => {
    setStatus(newStatus);
    try {
      await axios.put(`http://localhost:5000/api/subjects/${subjectId}/topic-status`, {
        topicName: decodedTopic,
        status: newStatus
      });
    } catch (err) {
      console.error("Failed to update topic status", err);
    }
  };

  const updateTopicConfidence = async (newConfidence: 'Red' | 'Yellow' | 'Green') => {
    setConfidence(newConfidence);
    try {
        await axios.put(`http://localhost:5000/api/subjects/${subjectId}/topic`, {
            topicName: decodedTopic,
            confidence: newConfidence
        });
    } catch (err) {
        console.error("Failed to update confidence", err);
    }
  };

  const fetchMistakes = async () => {
    setLoadingMistakes(true);
    try {
      const res = await axios.get('http://localhost:5000/api/mistakes');
      const filtered = res.data.filter((m: any) => m.topic === decodedTopic);
      setMistakes(filtered);
    } catch (err) {
      console.error(err);
      setMistakes([]);
    } finally {
      setLoadingMistakes(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    // First message trigger
    if (status === 'Not Started') {
        updateTopicStatus('In Progress');
    }

    const userMsg = inputMessage;
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setInputMessage('');
    setChatLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/agent/chat', {
        message: userMsg,
        topic: decodedTopic,
        mode: socraticMode ? 'socratic' : 'standard'
      });
      setMessages(prev => [...prev, { sender: 'ai', text: res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'ai', text: "I'm having trouble connecting." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateQuestions = () => {
    startQuestionGeneration(decodedTopic, questionCount, selectedTypes, prepType);
    setExamConfigOpen(false);
  };

  const toggleSelection = (list: string[], item: string, setList: React.Dispatch<React.SetStateAction<string[]>>) => {
      if (list.includes(item)) {
          setList(list.filter(i => i !== item));
      } else {
          setList([...list, item]);
      }
  };

  const handleFetchPYQ = async () => {
      setFetchingPYQ(true);
      try {
          const res = await axios.post('http://localhost:5000/api/agent/pyq', { topic: decodedTopic });
          if (res.data.questions) {
              setRealPYQs(prev => [...prev, ...res.data.questions]);
              setMessages(prev => [...prev, { sender: 'ai', text: `I found ${res.data.questions.length} real PYQs for you. Check below.` }]);
          }
      } catch (err) {
          console.error("PYQ Fetch Error", err);
      } finally {
          setFetchingPYQ(false);
      }
  };

  const handleSaveToVault = async (questionData: any) => {
      const qId = questionData.question; // Simple unique check
      if (savedQuestionIds.includes(qId)) return;

      try {
          await axios.post('http://localhost:5000/api/vault/save', {
              question: questionData.question,
              answer: questionData.answer,
              subjectId,
              topicName: decodedTopic,
              difficulty: questionData.difficulty || 'Unknown'
          });
          setSavedQuestionIds(prev => [...prev, qId]);
      } catch (err) {
          console.error("Save Failed", err);
      }
  };

  const renderQuestionCard = (q: any, idx: number, isReal: boolean) => (
    <div key={idx} className={`bg-gray-800 border ${isReal ? 'border-green-600/50' : 'border-gray-700'} rounded-xl p-6 shadow-sm mb-4 relative`}>
        {isReal && (
            <div className="absolute top-0 right-0 bg-green-600 text-white text-[10px] px-2 py-1 rounded-bl-lg rounded-tr-lg font-bold uppercase tracking-wider">
                Real GATE PYQ
            </div>
        )}

        <div className="flex justify-between mb-4">
            <div className="flex items-center space-x-2">
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                    q.type === 'NAT' || q.type === '2-mark' ? 'bg-pink-900/30 text-pink-400' :
                    q.type === 'MSQ' || q.type === '5-mark' ? 'bg-orange-900/30 text-orange-400' :
                    'bg-blue-900/30 text-blue-400'
                }`}>{q.type}</span>
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                    q.difficulty === 'Hard' ? 'bg-red-900/30 text-red-400' :
                    q.difficulty === 'Medium' ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-green-900/30 text-green-400'
                }`}>{q.difficulty}</span>
            </div>

            <div className="flex items-center space-x-2">
                <button
                    onClick={() => handleSaveToVault(q)}
                    className={`p-1.5 rounded transition-colors ${savedQuestionIds.includes(q.question) ? 'text-green-500 bg-green-900/20' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                    disabled={savedQuestionIds.includes(q.question)}
                    title="Save to Vault"
                >
                    <Bookmark size={18} fill={savedQuestionIds.includes(q.question) ? "currentColor" : "none"}/>
                </button>
                <span className="text-gray-500 text-xs font-mono">#{idx+1}</span>
            </div>
        </div>

        <h3 className="text-lg font-medium text-white mb-6 leading-relaxed">{q.question}</h3>

        {q.type === 'NAT' ? (
            <div className="mb-6 bg-pink-900/10 p-4 rounded-lg border border-pink-900/30">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm text-pink-300">Your Answer (Numerical):</label>
                    <div className="flex space-x-2">
                        <button onClick={() => { setShowSidePanel(true); setSidePanelTab('calculator'); }} className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-700 flex items-center text-gray-300"><Calculator size={12} className="mr-1"/> Calculator</button>
                    </div>
                </div>
                <input type="text" placeholder="e.g. 42.5" className="bg-gray-900 border border-gray-700 rounded p-3 w-full max-w-xs text-white"/>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-2 mb-6">
                {q.options && q.options.map((opt: string, i: number) => (
                    <div key={i} className="p-3 bg-gray-900 rounded border border-gray-800 hover:border-blue-500/50 cursor-pointer transition-colors text-gray-300 hover:text-white">{opt}</div>
                ))}
            </div>
        )}

        <details className="group">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-blue-400 flex items-center space-x-2 select-none"><span>Reveal Solution</span><span className="group-open:rotate-180 transition-transform">▼</span></summary>
            <div className="mt-4 pt-4 border-t border-gray-700 bg-gray-800/50 rounded p-4">
                <p className="font-bold text-green-400 mb-2">Answer: {q.answer}</p>
                <p className="text-gray-300 leading-relaxed text-sm">{q.explanation}</p>
            </div>
        </details>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
         <div className="flex items-center space-x-4">
            <Link to={`/subject/${subjectId}`} className="text-gray-400 hover:text-white p-2 hover:bg-gray-900 rounded-full transition-colors">
               <ArrowLeft size={20} />
            </Link>
            <div>
               <h1 className="text-xl font-bold text-white truncate max-w-md">{decodedTopic}</h1>
               <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${status === 'Completed' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                  <span>{status}</span>
                  <span className="bg-gray-800 px-2 rounded">{prepType}</span>
               </div>
            </div>
         </div>

         <div className="flex items-center space-x-4">
            {/* Mark as Completed Button */}
            {status !== 'Completed' && (
                <button
                  onClick={() => updateTopicStatus('Completed')}
                  className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center shadow-lg shadow-green-900/20 transition-all"
                >
                  <CheckCircle size={16} className="mr-2"/> Mark Completed
                </button>
            )}

            {/* Confidence Traffic Light */}
            <div className="flex bg-gray-900 rounded-full p-1 border border-gray-800">
               <button onClick={() => updateTopicConfidence('Red')} className={`p-2 rounded-full transition-all ${confidence === 'Red' ? 'bg-red-500 shadow-lg shadow-red-500/50 scale-110' : 'text-gray-600 hover:bg-gray-800'}`} title="Low Confidence">
                  <AlertTriangle size={16} className={confidence === 'Red' ? 'text-white' : ''}/>
               </button>
               <button onClick={() => updateTopicConfidence('Yellow')} className={`p-2 rounded-full transition-all ${confidence === 'Yellow' ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50 scale-110' : 'text-gray-600 hover:bg-gray-800'}`} title="Medium Confidence">
                  <Activity size={16} className={confidence === 'Yellow' ? 'text-white' : ''}/>
               </button>
               <button onClick={() => updateTopicConfidence('Green')} className={`p-2 rounded-full transition-all ${confidence === 'Green' ? 'bg-green-500 shadow-lg shadow-green-500/50 scale-110' : 'text-gray-600 hover:bg-gray-800'}`} title="High Confidence">
                  <CheckCircle size={16} className={confidence === 'Green' ? 'text-white' : ''}/>
               </button>
            </div>

            <button
              onClick={() => setShowSidePanel(!showSidePanel)}
              className={`p-2 rounded-lg transition-colors ${showSidePanel ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              title="Toggle Side Panel"
            >
               <Code size={20} />
            </button>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden space-x-4">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
           <div className="flex border-b border-gray-800">
              <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${activeTab === 'chat' ? 'bg-gray-800 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                 <MessageSquare size={16}/> <span>AI Tutor</span>
              </button>
              <button onClick={() => setActiveTab('exam')} className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${activeTab === 'exam' ? 'bg-gray-800 text-white border-b-2 border-purple-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                 <BrainCircuit size={16}/> <span>Infinite Exam</span>
              </button>
              <button onClick={() => setActiveTab('mistakes')} className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${activeTab === 'mistakes' ? 'bg-gray-800 text-white border-b-2 border-orange-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                 <AlertTriangle size={16}/> <span>Learning Vault</span>
              </button>
           </div>

           <div className="flex-1 overflow-hidden relative">
              {activeTab === 'chat' && (
                 <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700">
                       {/* Real PYQs */}
                       {realPYQs.length > 0 && (
                           <div className="mb-6 border-b border-gray-800 pb-4">
                               <h4 className="text-xs font-bold text-green-500 uppercase mb-4 flex items-center"><Globe size={14} className="mr-2"/> Real GATE PYQs</h4>
                               {realPYQs.map((q, idx) => renderQuestionCard(q, idx, true))}
                           </div>
                       )}

                       {/* Chat Messages */}
                       {messages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'}`}>
                                <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
                             </div>
                          </div>
                       ))}
                       {chatLoading && <div className="flex justify-start"><div className="bg-gray-800 text-gray-400 rounded-2xl px-5 py-3 rounded-bl-none border border-gray-700 animate-pulse flex items-center space-x-2"><Loader2 className="animate-spin" size={14}/> <span>Thinking...</span></div></div>}
                       <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 bg-gray-900 border-t border-gray-800">
                       <div className="flex items-center justify-between mb-2 px-2">
                          <div className="flex space-x-2">
                              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center">{socraticMode ? 'Socratic Mode Active' : 'Standard Mode'}</span>
                              <button onClick={() => setSocraticMode(!socraticMode)} className={`text-xs px-2 py-1 rounded border ${socraticMode ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'border-gray-700 text-gray-400 hover:text-white'}`}>Toggle</button>
                          </div>
                          <button
                              onClick={handleFetchPYQ}
                              disabled={fetchingPYQ}
                              className="text-xs bg-green-900/30 border border-green-700 text-green-400 hover:bg-green-900/50 px-3 py-1 rounded flex items-center transition-colors disabled:opacity-50"
                          >
                              {fetchingPYQ ? <Loader2 size={12} className="animate-spin mr-1"/> : <Globe size={12} className="mr-1"/>} Fetch Real PYQs
                          </button>
                       </div>
                       <div className="relative">
                          <textarea
                             className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-500 resize-none overflow-hidden"
                             placeholder={`Ask about ${decodedTopic}...`}
                             rows={1}
                             style={{ minHeight: '46px' }}
                             value={inputMessage}
                             onChange={(e) => setInputMessage(e.target.value)}
                             onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                   e.preventDefault();
                                   sendMessage();
                                }
                             }}
                             disabled={chatLoading}
                          />
                          <button onClick={sendMessage} disabled={!inputMessage.trim() || chatLoading} className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"><Send size={18} /></button>
                       </div>
                    </div>
                 </div>
              )}

              {activeTab === 'exam' && (
                 <div className="p-6 overflow-y-auto h-full scrollbar-thin scrollbar-thumb-gray-700">
                    <div className="flex justify-between items-center mb-6">
                       <h2 className="text-xl font-bold text-white">Practice Questions</h2>
                       <button onClick={() => setExamConfigOpen(!examConfigOpen)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"><SettingsIcon size={20}/></button>
                    </div>

                    {/* Exam Config Panel */}
                    {examConfigOpen && (
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6 animate-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Count</label>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => setQuestionCount(Math.max(1, questionCount - 1))} className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-white">-</button>
                                        <span className="text-white font-mono w-8 text-center">{questionCount}</span>
                                        <button onClick={() => setQuestionCount(Math.min(15, questionCount + 1))} className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-white">+</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Types</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(prepType === 'College' ? ['2-mark', '5-mark', '8-mark', 'Descriptive', 'Numerical'] : ['MCQ', 'MSQ', 'NAT']).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => toggleSelection(selectedTypes, t, setSelectedTypes)}
                                                className={`text-xs px-2 py-1 rounded border transition-colors ${selectedTypes.includes(t) ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Difficulty</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Easy', 'Medium', 'Hard', 'Topper'].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => toggleSelection(selectedDifficulty, d, setSelectedDifficulty)}
                                                className={`text-xs px-2 py-1 rounded border transition-colors ${selectedDifficulty.includes(d) ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500'}`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={handleGenerateQuestions}
                                    disabled={isGenerating}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-900/20"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={18}/> : <BrainCircuit size={18}/>}
                                    <span>Generate Custom Set</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {!examConfigOpen && (
                        <button
                            onClick={handleGenerateQuestions}
                            disabled={isGenerating}
                            className="w-full mb-6 bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-900/20"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={18}/> : <BrainCircuit size={18}/>}
                            <span>Generate Questions ({questionCount})</span>
                        </button>
                    )}

                    <div className="space-y-6">
                       {topicQuestions.length === 0 ? (
                          <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/50">
                             <BrainCircuit size={48} className="mx-auto text-gray-600 mb-4"/>
                             <p className="text-gray-400 mb-4">No questions generated yet.</p>
                             <button onClick={() => setExamConfigOpen(true)} className="text-purple-400 hover:text-purple-300 font-medium">Configure Exam</button>
                          </div>
                       ) : (
                          topicQuestions.map((q, idx) => renderQuestionCard(q, idx, false))
                       )}
                    </div>
                 </div>
              )}

              {activeTab === 'mistakes' && (
                 <div className="p-6 overflow-y-auto h-full scrollbar-thin scrollbar-thumb-gray-700">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center"><AlertTriangle className="mr-2 text-orange-500" size={24}/> Learning Vault</h2>
                    {loadingMistakes ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-500"/></div> : mistakes.length === 0 ? <div className="text-center py-20 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl">No learning items for this topic. Great job!</div> : <div className="space-y-4">{mistakes.map((m) => (<div key={m._id} className="bg-gray-800/50 border border-red-900/30 p-4 rounded-xl hover:border-red-500/30 transition-colors"><p className="font-medium text-white mb-2">{m.question}</p><div className="text-sm text-red-400 mb-1">Your Answer: {m.userAnswer}</div><div className="text-sm text-green-400">Correct: {m.correctAnswer}</div></div>))}</div>}
                 </div>
              )}
           </div>
        </div>

        {/* Side Panel (Code, Whiteboard, Calculator) */}
        {showSidePanel && (
           <div className="w-96 bg-gray-900 rounded-xl border border-gray-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-850">
                 <div className="flex space-x-1">
                     <button onClick={() => setSidePanelTab('code')} className={`px-3 py-1 text-xs font-medium rounded ${sidePanelTab === 'code' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Code</button>
                     <button onClick={() => setSidePanelTab('whiteboard')} className={`px-3 py-1 text-xs font-medium rounded ${sidePanelTab === 'whiteboard' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Board</button>
                     <button onClick={() => setSidePanelTab('calculator')} className={`px-3 py-1 text-xs font-medium rounded ${sidePanelTab === 'calculator' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Calc</button>
                 </div>
                 <button onClick={() => setShowSidePanel(false)} className="text-gray-500 hover:text-white"><Minimize2 size={16}/></button>
              </div>

              <div className="flex-1 overflow-hidden">
                  {sidePanelTab === 'code' && (
                     <div className="h-full flex flex-col">
                        <textarea className="flex-1 bg-gray-950 text-gray-300 p-4 font-mono text-sm resize-none focus:outline-none" spellCheck="false" value={scratchpadContent} onChange={(e) => setScratchpadContent(e.target.value)} />
                        <div className="p-2 border-t border-gray-800 text-xs text-gray-600 text-right bg-gray-900">Supports C, SQL, Plain Text</div>
                     </div>
                  )}

                  {sidePanelTab === 'whiteboard' && <DigitalWhiteboard />}

                  {sidePanelTab === 'calculator' && <SimpleCalculator />}
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
