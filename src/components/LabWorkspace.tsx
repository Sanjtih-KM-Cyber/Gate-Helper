import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, Upload, Code, BookOpen, ChevronRight, ChevronDown,
  Play, Maximize2, Minimize2, Loader2, Save, FileText, FlaskConical, Send
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { useGlobalTaskManager } from '../context/GlobalTaskManager';

interface Topic {
  name: string;
  status: string;
  code?: string;
}

interface Unit {
  title: string;
  topics: Topic[];
}

interface Subject {
  _id: string;
  name: string;
  syllabus: Unit[];
}

interface ChatMessage {
    role: 'user' | 'ai';
    content: string;
}

export default function LabWorkspace({ subject }: { subject: Subject }) {
  const { id } = useParams<{ id: string }>();
  const [activeExperiment, setActiveExperiment] = useState<string | null>(null);
  const [code, setCode] = useState('// Select an experiment or paste code here...');
  const [aiPanelOpen, setAiPanelOpen] = useState(true);

  // Resizable Panel State
  const [aiPanelWidth, setAiPanelWidth] = useState(450); // px
  const [isResizing, setIsResizing] = useState(false);
  const resizerRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Chat State - Now keyed by experiment name
  const [allChats, setAllChats] = useState<Record<string, ChatMessage[]>>({});
  const [currentChat, setCurrentChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Map experiments to session IDs
  const [sessionIds, setSessionIds] = useState<Record<string, string>>({});

  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const { startTask, tasks } = useGlobalTaskManager();

  // Upload State
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [manualFile, setManualFile] = useState<File | null>(null);

  // Initialize
  useEffect(() => {
      if (subject.syllabus.length > 0 && subject.syllabus[0].topics.length > 0) {
          const firstTopic = subject.syllabus[0].topics[0];
          setActiveExperiment(firstTopic.name);
          setCode(firstTopic.code || `// ${firstTopic.name}\n\n#include <stdio.h>\n\nint main() {\n    printf("Hello Lab!");\n    return 0;\n}`);
          setExpandedUnits({ [subject.syllabus[0].title]: true });
      }
  }, [subject]);

  // Sync Current Chat with Active Experiment & Fetch History
  useEffect(() => {
      if (!activeExperiment) return;

      // 1. Update View with local state first (Optimistic)
      setCurrentChat(allChats[activeExperiment] || []);

      // 2. Fetch history from backend to ensure persistence across reloads/devices
      const fetchHistory = async () => {
          try {
              // Check if we already have a session ID locally, if so, we might still want to refresh to get latest
              const res = await axios.get(`http://localhost:5000/api/chat/sessions`, {
                  params: {
                      type: 'lab',
                      subjectId: id,
                      topicName: activeExperiment
                  }
              });

              if (res.data && res.data.length > 0) {
                  const session = res.data[0];
                  setSessionIds(prev => ({ ...prev, [activeExperiment]: session._id }));

                  // Update local state with backend messages
                  setAllChats(prev => ({
                      ...prev,
                      [activeExperiment]: session.messages.map((m: any) => ({
                          role: m.role,
                          content: m.content
                      }))
                  }));
              }
          } catch (err) {
              console.error("Failed to fetch chat history", err);
          }
      };

      fetchHistory();

  }, [activeExperiment, id]); // Depend on activeExperiment to re-fetch on switch

  // Sync allChats to currentChat (for streaming updates)
  useEffect(() => {
      if (activeExperiment) {
          setCurrentChat(allChats[activeExperiment] || []);
      }
  }, [allChats]); // Remove activeExperiment from here to avoid double-triggering logic loops

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat, loadingAi, aiPanelOpen]);

  // Resizing Logic
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isResizing && resizerRef.current) {
              const delta = resizerRef.current.startX - e.clientX; // Dragging Left increases width
              const newWidth = resizerRef.current.startWidth + delta;

              // Constraints: Min 300px, Max 60% of screen
              if (newWidth > 300 && newWidth < document.body.clientWidth * 0.6) {
                  setAiPanelWidth(newWidth);
              }
          }
      };

      const handleMouseUp = () => {
          setIsResizing(false);
          resizerRef.current = null;
          document.body.style.cursor = 'default';
          document.body.style.userSelect = 'auto'; // Re-enable text selection
      };

      if (isResizing) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none'; // Disable text selection while dragging
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isResizing]);

  const toggleUnit = (title: string) => {
      setExpandedUnits(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handleTopicClick = (topic: Topic) => {
      setActiveExperiment(topic.name);

      if (topic.code && topic.code.length > 50) { // Basic check if code is real
          setCode(topic.code);
      } else {
          // Trigger Lazy Load Task
          setCode('// Loading code from manual...');
          startTask('parse-code', { subjectId: id, topicName: topic.name });
      }
  };

  // Watch for completed parse tasks
  useEffect(() => {
      Object.values(tasks).forEach((task: any) => {
          if (task.type === 'parse-code' && task.status === 'completed' && task.payload.topicName === activeExperiment) {
              setCode(task.result);
          }
      });
  }, [tasks, activeExperiment]);

  const handleUploadManual = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!manualFile) return;
      setUploading(true);
      const formData = new FormData();
      formData.append('file', manualFile);

      try {
          await axios.post(`http://localhost:5000/api/subjects/${id}/parse-lab-manual`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          window.location.reload(); // Simple refresh to load new syllabus
      } catch (err) {
          console.error(err);
          alert("Failed to parse manual.");
      } finally {
          setUploading(false);
      }
  };

  const updateChatHistory = (newMessage: ChatMessage) => {
      if (!activeExperiment) return;

      setAllChats(prev => {
          const experimentHistory = prev[activeExperiment] || [];
          return {
              ...prev,
              [activeExperiment]: [...experimentHistory, newMessage]
          };
      });
  };

  const handleAiAssist = async (action: 'explain' | 'shorten' | 'comment' | 'chat', message?: string) => {
      if (!activeExperiment) return;
      setLoadingAi(true);
      if (!aiPanelOpen) setAiPanelOpen(true);

      // Add user message to history (Optimistic UI)
      if (action === 'chat' && message) {
          updateChatHistory({ role: 'user', content: message });
          setChatInput('');
      } else if (action !== 'chat') {
          updateChatHistory({ role: 'user', content: `Request: ${action} this code.` });
      }

      // Ensure Session Exists
      let currentSessionId = sessionIds[activeExperiment];
      if (!currentSessionId) {
          try {
              const res = await axios.post('http://localhost:5000/api/chat/sessions', {
                  title: `Lab: ${activeExperiment}`,
                  metadata: {
                      type: 'lab',
                      subjectId: id,
                      topicName: activeExperiment
                  }
              });
              currentSessionId = res.data._id;
              setSessionIds(prev => ({ ...prev, [activeExperiment]: currentSessionId }));
          } catch (err) {
              console.error("Failed to create chat session", err);
              // Proceed without session ID (won't persist but will work for this session)
          }
      }

      // Start Task via Global Manager
      const taskId = startTask('ai-chat', {
          code,
          action,
          language: 'c',
          message: message,
          experimentId: activeExperiment, // Identify which experiment this task belongs to
          sessionId: currentSessionId // Pass session ID for persistence
      });
  };

  // Watch for AI Tasks (Streaming or Completed)
  useEffect(() => {
      Object.values(tasks).forEach((task: any) => {
          if (task.type !== 'ai-chat') return;

          const targetExperiment = task.payload.experimentId;
          if (!targetExperiment) return;

          // Handle Completed Tasks (Non-streaming fallback or Final Stream state)
          if (task.status === 'completed' && task.result) {
               setAllChats(prev => {
                  const currentExpChats = prev[targetExperiment] || [];
                  const lastMsg = currentExpChats[currentExpChats.length - 1];

                  // Avoid duplicating if already updated via stream
                  if (lastMsg && lastMsg.role === 'ai' && lastMsg.content === task.result) return prev;

                  // If the last message was the user's prompt, append the result
                  if (!lastMsg || lastMsg.role === 'user') {
                      return { ...prev, [targetExperiment]: [...currentExpChats, { role: 'ai', content: task.result }] };
                  }

                  // If we were streaming, update the final message content
                  if (lastMsg.role === 'ai') {
                      const newChats = [...currentExpChats];
                      newChats[newChats.length - 1] = { role: 'ai', content: task.result };
                      return { ...prev, [targetExperiment]: newChats };
                  }

                  return prev;
               });

               // Only stop loading if this is the active experiment
               if (targetExperiment === activeExperiment) setLoadingAi(false);
          }

          // Handle Streaming Updates
          if (task.status === 'running' && task.streamContent) {
              setAllChats(prev => {
                  const currentExpChats = prev[targetExperiment] || [];
                  const lastMsg = currentExpChats[currentExpChats.length - 1];

                  if (lastMsg && lastMsg.role === 'ai' && lastMsg.content !== task.streamContent) {
                      const newChats = [...currentExpChats];
                      newChats[newChats.length - 1] = { role: 'ai', content: task.streamContent };
                      return { ...prev, [targetExperiment]: newChats };
                  } else if (!lastMsg || lastMsg.role === 'user') {
                      return { ...prev, [targetExperiment]: [...currentExpChats, { role: 'ai', content: task.streamContent }] };
                  }
                  return prev;
              });
          }
      });
  }, [tasks, activeExperiment]);

  const saveCode = async () => {
      if (!activeExperiment) return;
      try {
          await axios.put(`http://localhost:5000/api/subjects/${id}/topic`, {
              topicName: activeExperiment,
              code: code
          });
          alert("Code saved!");
      } catch (err) {
          console.error(err);
      }
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden text-white font-sans">
      {/* Sidebar: Experiment List */}
      <div className="w-1/5 min-w-[250px] bg-[#111827] border-r border-gray-800 flex flex-col scrollbar-hide">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1f2937]">
              <h2 className="font-bold text-gray-100 flex items-center text-sm uppercase tracking-wide">
                  <FlaskConical size={16} className="mr-2 text-purple-500"/> Lab Experiments
              </h2>
              <button onClick={() => setShowUpload(true)} className="bg-gray-700 hover:bg-gray-600 p-1.5 rounded-lg transition-colors" title="Upload Manual"><Upload size={14}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
              {subject.syllabus.length === 0 ? (
                  <div className="text-center py-10 px-4">
                      <p className="text-gray-500 text-xs mb-4">No experiments found.</p>
                      <button onClick={() => setShowUpload(true)} className="text-purple-400 hover:text-purple-300 text-xs font-medium underline">Upload Lab Manual</button>
                  </div>
              ) : (
                  subject.syllabus.map((unit) => (
                      <div key={unit.title} className="mb-2">
                          <button
                              onClick={() => toggleUnit(unit.title)}
                              className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-300 hover:bg-gray-800/50 rounded-lg transition-colors text-left group"
                          >
                              <span className="truncate group-hover:text-white transition-colors">{unit.title}</span>
                              {expandedUnits[unit.title] ? <ChevronDown size={14} className="text-gray-500"/> : <ChevronRight size={14} className="text-gray-500"/>}
                          </button>

                          {expandedUnits[unit.title] && (
                              <div className="ml-3 pl-3 border-l border-gray-800 mt-1 space-y-1">
                                  {unit.topics.map(topic => (
                                      <button
                                          key={topic.name}
                                          onClick={() => handleTopicClick(topic)}
                                          className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all truncate border border-transparent ${activeExperiment === topic.name ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                                      >
                                          {topic.name}
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
          {/* Global Drag Overlay */}
          {isResizing && (
              <div className="fixed inset-0 z-50 cursor-col-resize bg-transparent" />
          )}

          {/* Toolbar */}
          <div className="h-14 bg-[#1f2937] border-b border-gray-800 flex items-center justify-between px-6 shadow-sm z-20">
              <div className="flex items-center space-x-4 overflow-hidden">
                  <Link to={`/subject/${id}`} className="text-gray-400 hover:text-white transition-colors"><ArrowLeft size={20}/></Link>
                  <h1 className="text-sm font-bold text-gray-100 truncate max-w-lg tracking-wide">
                      {activeExperiment || "Select an Experiment"}
                  </h1>
              </div>
              <div className="flex items-center space-x-3">
                  <button onClick={saveCode} className="flex items-center space-x-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-900/20">
                      <Save size={14}/> <span>Save Code</span>
                  </button>
                  <div className="h-6 w-px bg-gray-700 mx-2"></div>
                  <div className="flex bg-gray-800 rounded-lg p-1">
                      <button onClick={() => handleAiAssist('explain')} className="text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 px-3 py-1.5 rounded-md transition-colors">Explain</button>
                      <button onClick={() => handleAiAssist('shorten')} className="text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 px-3 py-1.5 rounded-md transition-colors">Refactor</button>
                      <button onClick={() => handleAiAssist('comment')} className="text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 px-3 py-1.5 rounded-md transition-colors">Docs</button>
                  </div>
                  <button onClick={() => setAiPanelOpen(!aiPanelOpen)} className={`p-2 rounded-lg transition-colors ${aiPanelOpen ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                      {aiPanelOpen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
                  </button>
              </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
              {/* Code Editor */}
              <div className="flex-1 bg-[#0d1117] relative flex flex-col min-w-0">
                  <textarea
                      className="w-full h-full bg-transparent text-gray-300 font-mono text-sm p-6 resize-none focus:outline-none leading-relaxed scrollbar-hide"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      spellCheck="false"
                  />
              </div>

              {/* Resizer Handle */}
              {aiPanelOpen && (
                  <div
                      onMouseDown={(e) => {
                          setIsResizing(true);
                          resizerRef.current = { startX: e.clientX, startWidth: aiPanelWidth };
                      }}
                      className="w-1 cursor-col-resize bg-gray-800 hover:bg-purple-500 transition-colors z-20 flex flex-col justify-center items-center group"
                  >
                      <div className="h-8 w-1 bg-gray-600 rounded group-hover:bg-white transition-colors"></div>
                  </div>
              )}

              {/* AI Panel - Resizable */}
              {aiPanelOpen && (
                  <div
                      style={{ width: `${aiPanelWidth}px` }}
                      className="bg-[#111827] border-l border-gray-800 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl z-10 shrink-0"
                  >
                      <div className="p-4 border-b border-gray-800 bg-[#1f2937] flex items-center justify-between">
                          <div className="flex items-center font-bold text-gray-100 text-sm tracking-wide">
                              <Code size={16} className="mr-2 text-purple-400"/> AI Copilot
                          </div>
                          <button onClick={() => setAiPanelOpen(false)} className="text-gray-500 hover:text-white transition-colors"><Minimize2 size={16}/></button>
                      </div>

                      <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-hide bg-[#111827]">
                          {currentChat.length === 0 && !loadingAi && (
                              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                                  <div className="bg-gray-800 p-4 rounded-full"><Code size={32} className="text-purple-500"/></div>
                                  <p className="text-sm font-medium">Ready to assist! Ask me anything about your code.</p>
                              </div>
                          )}

                          {currentChat.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[90%] rounded-2xl px-5 py-4 shadow-sm ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-sm'}`}>
                                      <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
                                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                                      </div>
                                  </div>
                              </div>
                          ))}

                          {loadingAi && (
                              <div className="flex justify-start">
                                  <div className="bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 flex items-center space-x-3 text-gray-400 animate-pulse">
                                      <Loader2 className="animate-spin text-purple-500" size={18}/>
                                      <span className="text-sm font-medium">Thinking...</span>
                                  </div>
                              </div>
                          )}
                          <div ref={chatEndRef} />
                      </div>

                      {/* Chat Input Area */}
                      <div className="p-4 border-t border-gray-800 bg-[#1f2937]">
                          <div className="relative flex items-center bg-gray-900 rounded-xl border border-gray-700 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-all shadow-inner">
                              <input
                                  type="text"
                                  className="w-full bg-transparent pl-4 pr-12 py-3.5 text-sm text-white focus:outline-none placeholder-gray-500"
                                  placeholder="Ask follow-up questions..."
                                  value={chatInput}
                                  onChange={e => setChatInput(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiAssist('chat', chatInput)}
                                  disabled={loadingAi}
                              />
                              <button
                                  onClick={() => handleAiAssist('chat', chatInput)}
                                  disabled={!chatInput.trim() || loadingAi}
                                  className="absolute right-2 p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
                              >
                                  <Send size={18}/>
                              </button>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 relative shadow-2xl animate-in zoom-in-95 duration-200">
                  <button onClick={() => setShowUpload(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><ArrowLeft size={20}/></button>
                  <h3 className="text-xl font-bold text-white mb-2">Upload Lab Manual</h3>
                  <p className="text-gray-400 text-sm mb-6">Upload a PDF manual to automatically extract experiments and source code.</p>

                  <form onSubmit={handleUploadManual}>
                      <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-purple-500/50 transition-colors cursor-pointer bg-gray-800/30 mb-6 group">
                          <input
                              type="file"
                              id="manual-upload"
                              className="hidden"
                              accept=".pdf"
                              onChange={e => setManualFile(e.target.files?.[0] || null)}
                          />
                          <label htmlFor="manual-upload" className="cursor-pointer w-full flex flex-col items-center">
                              <div className="bg-gray-800 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                  <FileText className="text-purple-500" size={32}/>
                              </div>
                              <span className="text-gray-300 font-medium group-hover:text-purple-400 transition-colors">Click to Select PDF</span>
                              {manualFile && <span className="mt-2 text-sm text-green-400 font-medium bg-green-900/20 px-3 py-1 rounded-full">{manualFile.name}</span>}
                          </label>
                      </div>

                      <button
                          type="submit"
                          disabled={!manualFile || uploading}
                          className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:translate-y-[-2px]"
                      >
                          {uploading ? <><Loader2 className="animate-spin mr-2"/> Processing Manual...</> : 'Parse & Generate'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
