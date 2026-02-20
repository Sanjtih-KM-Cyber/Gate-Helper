import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, User, MessageSquare } from 'lucide-react';

export default function Settings() {
  const [aiName, setAiName] = useState('GATE Tutor');
  const [aiPersona, setAiPersona] = useState('');
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
        setAiPersona(res.data.aiPersona || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      await axios.post('http://localhost:5000/api/settings', { aiName, aiPersona });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">AI Settings</h1>
        <p className="text-gray-400">Customize your tutor's personality and name.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-6">
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

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center">
             <MessageSquare size={16} className="mr-2"/> Persona / System Prompt
          </label>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white h-40 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={aiPersona}
            onChange={(e) => setAiPersona(e.target.value)}
            placeholder="Describe how the AI should behave. E.g., 'You are a strict but fair professor who uses Socratic questioning.'"
          />
          <p className="text-xs text-gray-500 mt-2">
            This instruction will be prefixed to every request sent to the AI agent.
          </p>
        </div>

        <div className="pt-4 flex items-center justify-between">
           <button
             onClick={handleSave}
             disabled={loading}
             className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
           >
             <Save size={18} /> <span>{loading ? 'Saving...' : 'Save Settings'}</span>
           </button>

           {success && <span className="text-green-400 font-medium animate-fade-in">Saved Successfully!</span>}
        </div>
      </div>
    </div>
  );
}
