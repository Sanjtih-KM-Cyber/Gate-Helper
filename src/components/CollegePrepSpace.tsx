import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Book, FileText, Settings, PenTool, Save, Trash2 } from 'lucide-react';

interface Rubric {
  _id?: string;
  marks: number;
  description: string;
  wordCount: number;
  requirements: string[];
}

export default function CollegePrepSpace() {
  const [activeTab, setActiveTab] = useState<'syllabus' | 'rubrics' | 'generator'>('syllabus');
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [newRubric, setNewRubric] = useState<Rubric>({ marks: 0, description: '', wordCount: 0, requirements: [] });
  const [genTopic, setGenTopic] = useState('');
  const [genMarks, setGenMarks] = useState<number>(0);
  const [generatedAnswer, setGeneratedAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRubrics();
  }, []);

  const fetchRubrics = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/rubrics');
      setRubrics(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const saveRubric = async () => {
    try {
      await axios.post('http://localhost:5000/api/rubrics', newRubric);
      fetchRubrics();
      setNewRubric({ marks: 0, description: '', wordCount: 0, requirements: [] });
    } catch (err) {
      console.error(err);
    }
  };

  const generateAnswer = async () => {
    if (!genTopic || !genMarks) return;
    setLoading(true);
    setGeneratedAnswer('');
    try {
      const res = await axios.post('http://localhost:5000/api/rubrics/generate-answer', {
        topic: genTopic,
        marks: genMarks
      });
      setGeneratedAnswer(res.data.answer);
    } catch (err) {
      console.error(err);
      alert('Failed to generate answer. Ensure a rubric exists for these marks.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center space-x-4 mb-8">
        <h1 className="text-3xl font-bold text-white">College Prep Space</h1>
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          <button
            onClick={() => setActiveTab('syllabus')}
            className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors ${activeTab === 'syllabus' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Book size={18} /> <span>Syllabus</span>
          </button>
          <button
            onClick={() => setActiveTab('rubrics')}
            className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors ${activeTab === 'rubrics' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Settings size={18} /> <span>Rubrics</span>
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors ${activeTab === 'generator' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <PenTool size={18} /> <span>Answer Gen</span>
          </button>
        </div>
      </div>

      {activeTab === 'syllabus' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-4">Syllabus & Materials</h2>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer">
              <FileText size={48} className="mb-2" />
              <p>Drag & Drop Syllabus PDF here</p>
            </div>
            {/* List of uploaded files would go here */}
          </div>
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
             <h2 className="text-xl font-semibold text-white mb-4">Topic Roadmap</h2>
             <div className="space-y-2">
               <div className="p-3 bg-gray-800 rounded text-gray-300 hover:bg-gray-700 cursor-pointer">Unit 1: Introduction to automata</div>
               <div className="p-3 bg-gray-800 rounded text-gray-300 hover:bg-gray-700 cursor-pointer">Unit 2: Regular Expressions</div>
               <div className="p-3 bg-gray-800 rounded text-gray-300 hover:bg-gray-700 cursor-pointer">Unit 3: Context Free Grammars</div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'rubrics' && (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-6">Rubric Profile Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Marks (e.g., 5)"
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white"
                  value={newRubric.marks || ''}
                  onChange={e => setNewRubric({...newRubric, marks: parseInt(e.target.value)})}
                />
                <input
                  type="number"
                  placeholder="Target Word Count (e.g., 150)"
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white"
                  value={newRubric.wordCount || ''}
                  onChange={e => setNewRubric({...newRubric, wordCount: parseInt(e.target.value)})}
                />
                <textarea
                   placeholder="Description & Requirements (e.g., 'Include definition + 2 examples')"
                   className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white h-32"
                   value={newRubric.description}
                   onChange={e => setNewRubric({...newRubric, description: e.target.value})}
                />
                <button
                  onClick={saveRubric}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-medium flex items-center space-x-2"
                >
                  <Save size={18} /> <span>Save Rubric</span>
                </button>
             </div>
             <div className="space-y-4">
                {rubrics.map((r) => (
                  <div key={r._id} className="bg-gray-800 p-4 rounded border border-gray-700 flex justify-between items-start">
                    <div>
                      <div className="font-bold text-blue-400 text-lg">{r.marks} Marks</div>
                      <div className="text-gray-300 text-sm">{r.wordCount} words</div>
                      <div className="text-gray-400 mt-1">{r.description}</div>
                    </div>
                    <button className="text-red-400 hover:text-red-300"><Trash2 size={18}/></button>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'generator' && (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
           <h2 className="text-xl font-semibold text-white mb-6">Mark-Specific Answer Generator</h2>
           <div className="flex space-x-4 mb-6">
              <input
                type="text"
                placeholder="Topic (e.g., 'Types of Operating Systems')"
                className="flex-1 bg-gray-800 border border-gray-700 rounded p-3 text-white"
                value={genTopic}
                onChange={e => setGenTopic(e.target.value)}
              />
              <select
                className="bg-gray-800 border border-gray-700 rounded p-3 text-white w-32"
                value={genMarks}
                onChange={e => setGenMarks(parseInt(e.target.value))}
              >
                <option value={0}>Select Marks</option>
                {rubrics.map(r => <option key={r._id} value={r.marks}>{r.marks} Marks</option>)}
              </select>
              <button
                onClick={generateAnswer}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded font-medium disabled:opacity-50"
              >
                {loading ? 'Writing...' : 'Generate Answer'}
              </button>
           </div>

           {generatedAnswer && (
             <div className="bg-gray-950 p-6 rounded border border-gray-800 text-gray-300 leading-relaxed whitespace-pre-wrap">
               {generatedAnswer}
             </div>
           )}
        </div>
      )}
    </div>
  );
}
