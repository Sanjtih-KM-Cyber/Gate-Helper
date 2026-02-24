import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Save, User, MessageSquare, X, GraduationCap, Database, Code } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [aiName, setAiName] = useState('GATE Tutor');
  const [gatePersona, setGatePersona] = useState('');
  const [collegePersona, setCollegePersona] = useState('');
  const [labPersona, setLabPersona] = useState('');

  const [activeTab, setActiveTab] = useState<'GATE' | 'College' | 'Lab'>('GATE');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/settings');
      if (res.data) {
        setAiName(res.data.aiName || 'GATE Tutor');
        setGatePersona(res.data.gatePersona || '');
        setCollegePersona(res.data.collegePersona || '');
        setLabPersona(res.data.labPersona || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      await axios.post('http://localhost:5000/api/settings', {
          aiName,
          gatePersona,
          collegePersona,
          labPersona
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 relative pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Settings</h1>
          <p className="text-gray-400">Customize the personalities for different learning modes.</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
          title="Go Back"
        >
          <X size={24} />
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-8">
        {/* Global Name */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center">
             <User size={16} className="mr-2"/> Tutor Name
          </label>
          <input
            type="text"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={aiName}
            onChange={(e) => setAiName(e.target.value)}
            placeholder="e.g., Professor X"
          />
        </div>

        {/* Persona Tabs */}
        <div>
            <div className="flex space-x-4 border-b border-gray-800 mb-6">
                <button
                    onClick={() => setActiveTab('GATE')}
                    className={`pb-3 px-4 flex items-center space-x-2 font-medium transition-colors border-b-2 ${activeTab === 'GATE' ? 'border-green-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    <Database size={18}/> <span>GATE Prep</span>
                </button>
                <button
                    onClick={() => setActiveTab('College')}
                    className={`pb-3 px-4 flex items-center space-x-2 font-medium transition-colors border-b-2 ${activeTab === 'College' ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    <GraduationCap size={18}/> <span>College Prep</span>
                </button>
                <button
                    onClick={() => setActiveTab('Lab')}
                    className={`pb-3 px-4 flex items-center space-x-2 font-medium transition-colors border-b-2 ${activeTab === 'Lab' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                    <Code size={18}/> <span>Lab Assistant</span>
                </button>
            </div>

            <div className="min-h-[200px]">
                {activeTab === 'GATE' && (
                    <div className="animate-in fade-in">
                        <label className="block text-sm font-medium text-green-400 mb-2">GATE Persona System Prompt</label>
                        <textarea
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white h-48 focus:ring-2 focus:ring-green-500 focus:outline-none leading-relaxed"
                            value={gatePersona}
                            onChange={(e) => setGatePersona(e.target.value)}
                            placeholder="You are a strategic GATE Exam Coach..."
                        />
                    </div>
                )}
                {activeTab === 'College' && (
                    <div className="animate-in fade-in">
                        <label className="block text-sm font-medium text-blue-400 mb-2">College Prep Persona System Prompt</label>
                        <textarea
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white h-48 focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                            value={collegePersona}
                            onChange={(e) => setCollegePersona(e.target.value)}
                            placeholder="You are a patient College Professor..."
                        />
                    </div>
                )}
                {activeTab === 'Lab' && (
                    <div className="animate-in fade-in">
                        <label className="block text-sm font-medium text-purple-400 mb-2">Lab Assistant Persona System Prompt</label>
                        <textarea
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white h-48 focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed"
                            value={labPersona}
                            onChange={(e) => setLabPersona(e.target.value)}
                            placeholder="You are an expert Coding Assistant..."
                        />
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-500 mt-3">
                This instruction defines the behavior and tone of the AI for the selected mode.
            </p>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-gray-800">
           <button
             onClick={handleSave}
             disabled={loading}
             className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center space-x-2 transition-colors disabled:opacity-50 shadow-lg shadow-blue-900/20"
           >
             <Save size={20} /> <span>{loading ? 'Saving...' : 'Save All Settings'}</span>
           </button>

           {success && <span className="text-green-400 font-bold animate-fade-in flex items-center"><span className="mr-2">✓</span> Saved Successfully!</span>}
        </div>
      </div>
    </div>
  );
}
