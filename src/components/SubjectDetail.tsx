import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle, Circle, AlertTriangle, Activity, Loader2 } from 'lucide-react';

interface Topic {
  name: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  confidence: 'Red' | 'Yellow' | 'Green';
}

interface Unit {
  title: string;
  topics: Topic[];
}

interface Subject {
  _id: string;
  name: string;
  description: string;
  category: string;
  syllabus: Unit[];
}

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubject();
  }, [id]);

  const fetchSubject = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/subjects/${id}`);
      setSubject(res.data);

      // If syllabus is empty, maybe trigger generation?
      // Current flow: College Prep generates on upload. GATE Prep generates on creation.
      // So syllabus should exist. If not, it might be in progress (but scraping is synchronous-ish in my implementation).
      // Or maybe the scrape failed.
    } catch (err) {
      console.error(err);
      setError('Failed to load subject details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-gray-400">Loading Syllabus...</p>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="text-red-500 mb-4" size={48} />
        <h2 className="text-2xl font-bold text-white mb-2">Error Loading Subject</h2>
        <p className="text-gray-400 mb-6">{error || 'Subject not found.'}</p>
        <Link to="/" className="text-blue-400 hover:text-blue-300 flex items-center">
          <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
        </Link>
      </div>
    );
  }

  // Calculate Progress
  const totalTopics = subject.syllabus.reduce((acc, unit) => acc + unit.topics.length, 0);
  const completedTopics = subject.syllabus.reduce((acc, unit) =>
    acc + unit.topics.filter(t => t.status === 'Completed').length, 0
  );
  const progress = totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100);

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
         <div className="flex items-center space-x-4">
            <Link to={subject.category === 'College Prep' ? '/subjects/college-prep' : '/subjects/gate-prep'} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-full transition-colors">
               <ArrowLeft size={24} />
            </Link>
            <div>
               <h1 className="text-3xl font-bold text-white mb-1">{subject.name}</h1>
               <p className="text-gray-400 text-sm flex items-center space-x-2">
                 <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">{subject.category}</span>
                 <span>• {subject.syllabus.length} Units</span>
                 <span>• {totalTopics} Topics</span>
               </p>
            </div>
         </div>

         <div className="text-right">
            <div className="text-3xl font-bold text-blue-500">{progress}%</div>
            <div className="text-gray-500 text-xs uppercase tracking-wider">Completion</div>
         </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
         <div className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
      </div>

      {/* Syllabus List */}
      <div className="space-y-6">
         {subject.syllabus.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
               <BookOpen className="mx-auto text-gray-600 mb-4" size={48}/>
               <p className="text-gray-500">Syllabus is empty.</p>
            </div>
         ) : (
            subject.syllabus.map((unit, unitIdx) => (
               <div key={unitIdx} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="bg-gray-850 px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                     <h2 className="text-lg font-bold text-white flex items-center">
                        <span className="text-gray-500 mr-3 text-sm font-mono">UNIT {unitIdx + 1}</span>
                        {unit.title}
                     </h2>
                     <span className="text-xs text-gray-500">{unit.topics.length} Topics</span>
                  </div>

                  <div className="divide-y divide-gray-800/50">
                     {unit.topics.map((topic, topicIdx) => (
                        <Link
                           key={topicIdx}
                           to={`/subject/${subject._id}/topic/${encodeURIComponent(topic.name)}`}
                           className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/50 transition-colors group cursor-pointer"
                        >
                           <div className="flex items-center space-x-4">
                              <div className={`
                                 w-2 h-2 rounded-full ring-2 ring-offset-2 ring-offset-gray-900
                                 ${topic.confidence === 'Green' ? 'bg-green-500 ring-green-900' :
                                   topic.confidence === 'Yellow' ? 'bg-yellow-500 ring-yellow-900' :
                                   'bg-red-500 ring-red-900'}
                              `} title={`Confidence: ${topic.confidence}`}></div>

                              <span className={`text-gray-300 font-medium group-hover:text-white transition-colors ${topic.status === 'Completed' ? 'line-through text-gray-500' : ''}`}>
                                 {topic.name}
                              </span>
                           </div>

                           <div className="flex items-center space-x-4">
                              {topic.status === 'Completed' && <CheckCircle size={18} className="text-green-500" />}
                              {topic.status === 'In Progress' && <Activity size={18} className="text-blue-500" />}
                              {topic.status === 'Not Started' && <Circle size={18} className="text-gray-600" />}

                              <ArrowRight size={16} className="text-gray-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                           </div>
                        </Link>
                     ))}
                  </div>
               </div>
            ))
         )}
      </div>
    </div>
  );
}
