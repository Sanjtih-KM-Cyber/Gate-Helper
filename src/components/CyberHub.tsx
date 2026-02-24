import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  MessageSquare, Plus, Trash2, Send, Paperclip,
  Image as ImageIcon, Loader2, Menu, X, BrainCircuit
} from 'lucide-react';

interface Message {
  role: 'user' | 'ai';
  content: string;
  attachments?: string[];
}

interface Session {
  _id: string;
  title: string;
  createdAt: string;
}

export default function CyberHub() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploading, setUploading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/chat/sessions');
      setSessions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/chat/sessions/${id}`);
      setMessages(res.data.messages);
    } catch (err) {
      console.error(err);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/chat/sessions');
      setSessions([res.data, ...sessions]);
      setCurrentSessionId(res.data._id);
      setMessages([]);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/chat/sessions/${id}`);
      setSessions(prev => prev.filter(s => s._id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !uploading) return;
    if (!currentSessionId) {
        // Auto-create session if none selected
        await createNewChat();
        // Note: In a real app, we'd need to wait for state update or use the ref returned
        // For simplicity, we assume the user clicks "New Chat" first or we handle this better next iteration
        return alert("Please click 'New Chat' to start.");
    }

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await axios.post(`http://localhost:5000/api/chat/sessions/${currentSessionId}/message`, {
        message: userMsg
      });
      setMessages(prev => [...prev, { role: 'ai', content: res.data.reply }]);
      fetchSessions(); // Update titles
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: "Error sending message." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setUploading(true);
          const formData = new FormData();
          Array.from(e.target.files).forEach(file => {
              formData.append('files', file);
          });

          try {
              // Use the generic upload endpoint
              const res = await axios.post('http://localhost:5000/api/upload', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' }
              });

              // Add a system message about the upload
              const fileNames = res.data.results.map((r: any) => r.source).join(', ');
              const msg = `Uploaded files: ${fileNames}.`;

              // Automatically send this as a message context
              if (currentSessionId) {
                  await axios.post(`http://localhost:5000/api/chat/sessions/${currentSessionId}/message`, {
                      message: msg,
                      attachments: fileNames.split(', ')
                  });
                  fetchMessages(currentSessionId);
              }
          } catch (err) {
              alert("Upload failed");
          } finally {
              setUploading(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-gray-950 overflow-hidden text-gray-100 font-sans border border-gray-800 rounded-xl shadow-2xl">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-gray-900 border-r border-gray-800 transition-all duration-300 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
           <button
             onClick={createNewChat}
             className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-900/20"
           >
             <Plus size={16}/> <span className="font-medium text-sm">New Chat</span>
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
           {sessions.map(session => (
             <div
               key={session._id}
               onClick={() => setCurrentSessionId(session._id)}
               className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${currentSessionId === session._id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
             >
               <div className="flex items-center space-x-3 overflow-hidden">
                 <MessageSquare size={16} className="flex-shrink-0"/>
                 <span className="text-sm truncate">{session.title}</span>
               </div>
               <button
                 onClick={(e) => deleteSession(e, session._id)}
                 className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity"
               >
                 <Trash2 size={14}/>
               </button>
             </div>
           ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-gray-950">
        {/* Toggle Sidebar Button (Mobile/Desktop) */}
        <div className="absolute top-4 left-4 z-10">
           <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
             {sidebarOpen ? <X size={20}/> : <Menu size={20}/>}
           </button>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
           {messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-6 animate-in fade-in duration-500">
                <div className="bg-gray-900 p-6 rounded-full border border-gray-800 shadow-xl">
                   <BrainCircuit size={64} className="text-blue-500"/>
                </div>
                <h1 className="text-2xl font-bold text-gray-300">Cyber Hub Assistant</h1>
                <p className="max-w-md text-center text-gray-500">
                  Ask me anything, upload documents for analysis, or generate study plans. I'm here to help.
                </p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                   <button className="p-4 bg-gray-900 border border-gray-800 rounded-xl text-left hover:border-blue-500/50 transition-colors">
                      <span className="block text-sm font-bold text-gray-300 mb-1">Upload PDF</span>
                      <span className="text-xs text-gray-500">Analyze research papers</span>
                   </button>
                   <button className="p-4 bg-gray-900 border border-gray-800 rounded-xl text-left hover:border-purple-500/50 transition-colors">
                      <span className="block text-sm font-bold text-gray-300 mb-1">Generate Mindmap</span>
                      <span className="text-xs text-gray-500">Visualize complex topics</span>
                   </button>
                </div>
             </div>
           ) : (
             messages.map((msg, idx) => (
               <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                 <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-5 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-sm'}`}>
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                       <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                 </div>
               </div>
             ))
           )}
           {loading && (
             <div className="flex justify-start">
               <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center space-x-3 text-gray-400">
                 <Loader2 className="animate-spin text-blue-500" size={18}/>
                 <span className="text-sm">Thinking...</span>
               </div>
             </div>
           )}
           <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50 backdrop-blur-sm">
           <div className="max-w-4xl mx-auto relative flex items-center bg-gray-950 border border-gray-800 rounded-xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-lg">
              <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-blue-400 transition-colors" title="Upload File">
                 <Paperclip size={20}/>
              </button>
              <input
                type="file"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />

              <input
                type="text"
                className="flex-1 bg-transparent py-4 text-white focus:outline-none placeholder-gray-500"
                placeholder={uploading ? "Uploading..." : "Message Cyber Hub..."}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                disabled={uploading || loading}
              />

              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || loading}
                className="p-3 text-gray-400 hover:text-blue-500 disabled:opacity-50 transition-colors"
              >
                 <Send size={20}/>
              </button>
           </div>
           <p className="text-center text-xs text-gray-600 mt-2">
              AI can make mistakes. Check important info.
           </p>
        </div>
      </div>
    </div>
  );
}
