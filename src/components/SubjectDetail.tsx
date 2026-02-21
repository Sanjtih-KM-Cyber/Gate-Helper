import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Plus, Activity, BrainCircuit } from 'lucide-react';

interface Subject {
  _id: string;
  name: string;
  topics: string[];
}

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    fetchSubjectWithSyllabus();
  }, [id]);

  const fetchSubjectWithSyllabus = async () => {
    setLoading(true);
    try {
      // First, try to get the subject normally
      const res = await axios.get(`http://localhost:5000/api/subjects/${id}/syllabus`);
      setSubject(res.data);
    } catch (err) {
      console.error(err);
      // Fallback: If AI fails, try normal fetch
      try {
          const res = await axios.get(`http://localhost:5000/api/subjects/${id}`);
          setSubject(res.data);
      } catch (e) { console.error(e); }
    } finally {
      setLoading(false);
    }
  };

  const addTopic = async () => {
    if (!newTopic) return;
    try {
      await axios.post(`http://localhost:5000/api/subjects/${id}/topics`, { topic: newTopic });
      setNewTopic('');
      // Refresh just by appending locally to avoid full reload
      if (subject) {
          setSubject({ ...subject, topics: [...subject.topics, newTopic] });
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500 animate-pulse">
              <BrainCircuit size={48} className="mb-4 text-blue-500" />
              <p className="text-xl font-medium">Analyzing Subject & Generating Syllabus...</p>
              <p className="text-sm mt-2">This might take a moment with local AI.</p>
          </div>
      );
  }

  if (!subject) return <div className="text-red-500">Subject not found.</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-4 mb-6">
        <Link to="/subjects" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-3xl font-bold text-white">{subject.name}</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
          <h2 className="text-xl font-semibold text-gray-200 flex items-center">
            <BookOpen size={20} className="mr-3 text-blue-500" />
            Topic Roadmap
          </h2>
          <div className="flex space-x-2">
             <input
               type="text"
               placeholder="Add Custom Topic..."
               className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white focus:outline-none focus:border-blue-500 placeholder-gray-500"
               value={newTopic}
               onChange={(e) => setNewTopic(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && addTopic()}
             />
             <button onClick={addTopic} className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded transition-colors">
               <Plus size={16} />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {subject.topics.map((topic, idx) => (
             <Link
               to={`/subject/${id}/topic/${encodeURIComponent(topic)}`}
               key={idx}
               className="group p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-all flex justify-between items-center"
             >
               <span className="font-medium text-gray-300 group-hover:text-white truncate pr-2" title={topic}>{topic}</span>
               <Activity size={16} className="text-gray-600 group-hover:text-blue-400" />
             </Link>
           ))}
           {subject.topics.length === 0 && (
             <div className="col-span-full text-center py-10 text-gray-500 border-2 border-dashed border-gray-800 rounded-lg">
               No topics found. Try refreshing to trigger AI generation again.
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
