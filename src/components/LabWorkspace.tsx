import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, Upload, Code, BookOpen, ChevronRight, ChevronDown,
  Play, Maximize2, Minimize2, Loader2, Save, FileText, FlaskConical, Send
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';

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

export default function LabWorkspace({ subject }: { subject: Subject }) {
  const { id } = useParams<{ id: string }>();
  const [activeExperiment, setActiveExperiment] = useState<string | null>(null);
  const [code, setCode] = useState('// Select an experiment or paste code here...');
  const [output, setOutput] = useState('');
  const [aiPanelOpen, setAiPanelOpen] = useState(true);

  // Chat State
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});

  // Upload State
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [manualFile, setManualFile] = useState<File | null>(null);

  useEffect(() => {
      // Default to first experiment if available
      if (subject.syllabus.length > 0 && subject.syllabus[0].topics.length > 0) {
          const firstTopic = subject.syllabus[0].topics[0];
          setActiveExperiment(firstTopic.name);
          setCode(firstTopic.code || `// ${firstTopic.name}\n\n#include <stdio.h>\n\nint main() {\n    printf("Hello Lab!");\n    return 0;\n}`);
          setExpandedUnits({ [subject.syllabus[0].title]: true });
      }
  }, [subject]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loadingAi]);

  const toggleUnit = (title: string) => {
      setExpandedUnits(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handleTopicClick = (topic: Topic) => {
      setActiveExperiment(topic.name);
      setCode(topic.code || `// ${topic.name}\n\n#include <stdio.h>\n\nint main() {\n    printf("Hello Lab!");\n    return 0;\n}`);
  };

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

  const handleAiAssist = async (action: 'explain' | 'shorten' | 'comment' | 'chat', message?: string) => {
      setLoadingAi(true);
      if (!aiPanelOpen) setAiPanelOpen(true);

      // Add user message to history if chat
      if (action === 'chat' && message) {
          setChatHistory(prev => [...prev, { role: 'user', content: message }]);
          setChatInput('');
      } else if (action !== 'chat') {
          // Clear history for new major actions to focus context
          setChatHistory([{ role: 'user', content: `Request: ${action} this code.` }]);
      }

      try {
          const res = await axios.post('http://localhost:5000/api/agent/lab-assist', {
              code,
              action,
              language: 'c', // Defaulting to C for labs
              message: message
          });
          setChatHistory(prev => [...prev, { role: 'ai', content: res.data.result }]);
      } catch (err) {
          setChatHistory(prev => [...prev, { role: 'ai', content: "AI Assistant failed to respond. Ensure backend is running." }]);
      } finally {
          setLoadingAi(false);
      }
  };

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
    <div className="flex h-[calc(100vh-6rem)] bg-gray-950 overflow-hidden">
      {/* Sidebar: Experiment List */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h2 className="font-bold text-white flex items-center"><FlaskConical size={18} className="mr-2 text-purple-500"/> Experiments</h2>
              <button onClick={() => setShowUpload(true)} className="text-xs bg-gray-800 hover:bg-gray-700 p-2 rounded text-gray-300" title="Upload Manual"><Upload size={14}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {subject.syllabus.length === 0 ? (
                  <div className="text-center py-10 px-4">
                      <p className="text-gray-500 text-sm mb-4">No experiments found.</p>
                      <button onClick={() => setShowUpload(true)} className="text-purple-400 hover:text-purple-300 text-sm underline">Upload Lab Manual</button>
                  </div>
              ) : (
                  subject.syllabus.map((unit) => (
                      <div key={unit.title}>
                          <button
                              onClick={() => toggleUnit(unit.title)}
                              className="w-full flex items-center justify-between p-2 text-sm text-gray-300 hover:bg-gray-800 rounded transition-colors text-left"
                          >
                              <span className="font-medium truncate">{unit.title}</span>
                              {expandedUnits[unit.title] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                          </button>

                          {expandedUnits[unit.title] && (
                              <div className="ml-2 pl-2 border-l border-gray-800 mt-1 space-y-1">
                                  {unit.topics.map(topic => (
                                      <button
                                          key={topic.name}
                                          onClick={() => handleTopicClick(topic)}
                                          className={`w-full text-left p-2 text-xs rounded transition-colors truncate ${activeExperiment === topic.name ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
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
      <div className="flex-1 flex flex-col relative">
          {/* Toolbar */}
          <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
              <div className="text-sm font-medium text-gray-300 truncate max-w-md">
                  {activeExperiment || "Select an experiment"}
              </div>
              <div className="flex items-center space-x-2">
                  <button onClick={saveCode} className="flex items-center space-x-1 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors">
                      <Save size={14}/> <span>Save</span>
                  </button>
                  <div className="h-4 w-px bg-gray-700 mx-2"></div>
                  <button onClick={() => handleAiAssist('explain')} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors">Explain</button>
                  <button onClick={() => handleAiAssist('shorten')} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors">Refactor</button>
                  <button onClick={() => handleAiAssist('comment')} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors">Docs</button>
                  <button onClick={() => setAiPanelOpen(!aiPanelOpen)} className={`p-1.5 rounded transition-colors ${aiPanelOpen ? 'bg-purple-900/50 text-purple-300' : 'text-gray-400 hover:text-white'}`}>
                      {aiPanelOpen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                  </button>
              </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
              {/* Code Editor (Simple Textarea for now, ideally Monaco) */}
              <div className="flex-1 bg-[#1e1e1e] relative">
                  <textarea
                      className="w-full h-full bg-transparent text-gray-300 font-mono text-sm p-4 resize-none focus:outline-none"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      spellCheck="false"
                  />
              </div>

              {/* AI Panel */}
              {aiPanelOpen && (
                  <div className="w-1/3 min-w-[300px] bg-gray-900 border-l border-gray-800 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl z-10">
                      <div className="p-3 border-b border-gray-800 font-bold text-gray-300 text-xs uppercase tracking-wider flex items-center justify-between">
                          <div className="flex items-center"><Code size={14} className="mr-2"/> AI Assistant</div>
                          <button onClick={() => setAiPanelOpen(false)} className="text-gray-500 hover:text-white"><Minimize2 size={14}/></button>
                      </div>

                      <div className="flex-1 p-4 overflow-y-auto text-sm text-gray-300 space-y-4">
                          {chatHistory.length === 0 && !loadingAi && (
                              <div className="text-center text-gray-600 mt-10">
                                  Select an action from the toolbar or ask a question below.
                              </div>
                          )}

                          {chatHistory.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[90%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'}`}>
                                      <div className="prose prose-invert prose-sm max-w-none break-words">
                                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                                      </div>
                                  </div>
                              </div>
                          ))}

                          {loadingAi && (
                              <div className="flex justify-start">
                                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center space-x-2 text-gray-400">
                                      <Loader2 className="animate-spin" size={14}/>
                                      <span>Thinking...</span>
                                  </div>
                              </div>
                          )}
                          <div ref={chatEndRef} />
                      </div>

                      {/* Chat Input */}
                      <div className="p-3 border-t border-gray-800 bg-gray-900">
                          <div className="relative flex items-center">
                              <input
                                  type="text"
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder-gray-500"
                                  placeholder="Ask about this code..."
                                  value={chatInput}
                                  onChange={e => setChatInput(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiAssist('chat', chatInput)}
                                  disabled={loadingAi}
                              />
                              <button
                                  onClick={() => handleAiAssist('chat', chatInput)}
                                  disabled={!chatInput.trim() || loadingAi}
                                  className="absolute right-2 text-gray-400 hover:text-purple-400 disabled:opacity-50"
                              >
                                  <Send size={16}/>
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
              <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6 relative">
                  <button onClick={() => setShowUpload(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><ArrowLeft size={20}/></button>
                  <h3 className="text-xl font-bold text-white mb-4">Populate Lab Workspace</h3>

                  <form onSubmit={handleUploadManual}>
                      <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:border-purple-500/50 transition-colors cursor-pointer bg-gray-800/50 mb-6">
                          <input
                              type="file"
                              id="manual-upload"
                              className="hidden"
                              accept=".pdf"
                              onChange={e => setManualFile(e.target.files?.[0] || null)}
                          />
                          <label htmlFor="manual-upload" className="cursor-pointer w-full flex flex-col items-center">
                              <FileText className="text-purple-500 mb-3" size={32}/>
                              <span className="text-gray-300 font-medium">Upload Lab Manual (PDF)</span>
                              {manualFile && <span className="mt-2 text-sm text-purple-400">{manualFile.name}</span>}
                          </label>
                      </div>

                      <button
                          type="submit"
                          disabled={!manualFile || uploading}
                          className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                          {uploading ? <><Loader2 className="animate-spin mr-2"/> Parsing...</> : 'Generate Experiments'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
