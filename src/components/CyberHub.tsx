import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Save, FilePlus, Trash2, Edit2 } from 'lucide-react';

interface Note {
  _id: string;
  title: string;
  content: string;
  category: 'Cybersecurity' | 'College';
  createdAt: string;
}

export default function CyberHub() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/notes');
      setNotes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!title || !content) return;
    try {
      if (activeNote?._id) {
        await axios.put(`http://localhost:5000/api/notes/${activeNote._id}`, { title, content });
      } else {
        await axios.post('http://localhost:5000/api/notes', { title, content, category: 'College' });
      }
      fetchNotes();
      setEditMode(false);
      setActiveNote(null);
      setTitle('');
      setContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this note?')) {
      try {
        await axios.delete(`http://localhost:5000/api/notes/${id}`);
        fetchNotes();
        if (activeNote?._id === id) {
          setActiveNote(null);
          setEditMode(false);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-950 overflow-hidden">
      {/* Sidebar List */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
        <button
          onClick={() => { setActiveNote(null); setEditMode(true); setTitle(''); setContent(''); }}
          className="bg-blue-600 hover:bg-blue-500 text-white w-full py-2 rounded mb-4 flex justify-center items-center space-x-2"
        >
          <FilePlus size={16} /> <span>New Note</span>
        </button>
        <div className="flex-1 overflow-y-auto space-y-2">
          {notes.map(note => (
            <div
              key={note._id}
              onClick={() => { setActiveNote(note); setEditMode(false); }}
              className={`p-3 rounded cursor-pointer transition-colors ${activeNote?._id === note._id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}
            >
              <div className="font-medium truncate">{note.title}</div>
              <div className="text-xs text-gray-500">{new Date(note.createdAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeNote || editMode ? (
          <>
            <div className="border-b border-gray-800 p-4 bg-gray-900 flex justify-between items-center">
              {editMode ? (
                <input
                  type="text"
                  placeholder="Note Title..."
                  className="bg-transparent text-xl font-bold text-white focus:outline-none w-full"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              ) : (
                <h2 className="text-xl font-bold text-white">{activeNote?.title}</h2>
              )}

              <div className="flex space-x-2">
                {!editMode ? (
                  <>
                    <button
                      onClick={() => { setEditMode(true); setTitle(activeNote!.title); setContent(activeNote!.content); }}
                      className="text-gray-400 hover:text-white p-2"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(activeNote!._id)}
                      className="text-red-400 hover:text-red-300 p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-1 rounded flex items-center space-x-1"
                  >
                    <Save size={16} /> <span>Save</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-gray-950">
              {editMode ? (
                <textarea
                  className="w-full h-full bg-transparent text-gray-300 focus:outline-none resize-none font-mono"
                  placeholder="Write in markdown..."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
              ) : (
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown>{activeNote?.content || ''}</ReactMarkdown>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a note or create a new one to start writing.
          </div>
        )}
      </div>
    </div>
  );
}
