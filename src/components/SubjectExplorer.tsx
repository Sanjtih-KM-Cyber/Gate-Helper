import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Book, Plus, ArrowRight } from 'lucide-react';

interface Subject {
  _id: string;
  name: string;
  description: string;
  category: string;
  topics: string[];
}

export default function SubjectExplorer() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/subjects');
      setSubjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addSubject = async () => {
    if (!newSubject) return;
    try {
      await axios.post('http://localhost:5000/api/subjects', { name: newSubject });
      setNewSubject('');
      fetchSubjects();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-white mb-2">My Subjects</h1>
           <p className="text-gray-400">Select a subject to dive into topics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {subjects.map((sub) => (
          <Link to={`/subject/${sub._id}`} key={sub._id} className="group bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500 transition-all shadow-lg hover:shadow-blue-900/20 flex flex-col justify-between min-h-[160px]">
             <div>
               <div className="flex justify-between items-start mb-4">
                 <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{sub.name}</h2>
                 <Book className="text-gray-600 group-hover:text-blue-500 transition-colors" size={24}/>
               </div>
               <p className="text-gray-500 text-sm">{sub.topics.length} Topics</p>
             </div>
             <div className="flex items-center text-blue-500 text-sm font-medium mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               Explore <ArrowRight size={16} className="ml-2" />
             </div>
          </Link>
        ))}

        {/* Add New Subject Card */}
        <div className="bg-gray-900/50 border-2 border-dashed border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[160px] group hover:border-gray-600 transition-colors">
           <input
             type="text"
             placeholder="New Subject Name..."
             className="bg-transparent text-center text-white border-b border-gray-700 focus:border-blue-500 outline-none mb-4 w-full placeholder-gray-600"
             value={newSubject}
             onChange={(e) => setNewSubject(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && addSubject()}
           />
           <button
             onClick={addSubject}
             className="flex items-center space-x-2 text-gray-500 group-hover:text-white transition-colors"
           >
             <Plus size={20} />
             <span>Add Subject</span>
           </button>
        </div>
      </div>
    </div>
  );
}
