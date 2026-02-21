import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Database, ArrowRight, Upload, Loader2, X } from 'lucide-react';
import axios from 'axios';

export default function Dashboard() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadMessage('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('http://localhost:5000/api/subjects/gate-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadMessage(`Success! Updated subjects: ${res.data.subjects.join(', ')}`);
      setFile(null);
      // Optional: Trigger a refresh if we had a subjects list here, but Dashboard mostly links out.
    } catch (err: any) {
      console.error(err);
      setUploadMessage('Failed to upload syllabus. Ensure backend is running.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12 relative">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          Welcome to <span className="text-blue-500">GATE Tutor</span>
        </h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto">
          Your AI-powered companion for academic excellence and competitive exam preparation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-4">
        {/* College Prep Banner */}
        <Link
          to="/subjects/college-prep"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 shadow-2xl hover:shadow-blue-900/20 p-8 flex flex-col items-start justify-between min-h-[250px]"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
            <GraduationCap size={150} />
          </div>

          <div className="z-10">
            <div className="bg-blue-500/20 p-3 rounded-lg w-fit mb-6 text-blue-400 group-hover:text-white group-hover:bg-blue-600 transition-colors">
              <GraduationCap size={32} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 group-hover:translate-x-1 transition-transform">
              College Prep
            </h2>
            <p className="text-gray-400 max-w-sm group-hover:text-gray-300 transition-colors">
              Manage your semester subjects. Upload syllabus PDFs and get structured learning paths automatically.
            </p>
          </div>

          <div className="mt-8 flex items-center text-blue-400 font-medium group-hover:text-white transition-colors">
            Enter Space <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" size={20} />
          </div>
        </Link>

        {/* GATE Prep Banner */}
        <div className="relative group">
            <Link
            to="/subjects/gate-prep"
            className="block h-full relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-green-500/50 transition-all duration-300 shadow-2xl hover:shadow-green-900/20 p-8 flex flex-col items-start justify-between min-h-[250px]"
            >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                <Database size={150} />
            </div>

            <div className="z-10">
                <div className="bg-green-500/20 p-3 rounded-lg w-fit mb-6 text-green-400 group-hover:text-white group-hover:bg-green-600 transition-colors">
                <Database size={32} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2 group-hover:translate-x-1 transition-transform">
                GATE Prep
                </h2>
                <p className="text-gray-400 max-w-sm group-hover:text-gray-300 transition-colors">
                Access curated GATE subjects (OS, DBMS, CN). Auto-generated syllabus from official sources.
                </p>
            </div>

            <div className="mt-8 flex items-center text-green-400 font-medium group-hover:text-white transition-colors">
                Enter Space <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" size={20} />
            </div>
            </Link>

            {/* Upload Button Overlay */}
            <button
                onClick={(e) => { e.preventDefault(); setShowUploadModal(true); }}
                className="absolute top-6 right-6 z-20 bg-gray-800/80 hover:bg-green-600 text-gray-300 hover:text-white p-2 rounded-lg backdrop-blur-sm border border-gray-600 transition-all"
                title="Upload Master Syllabus"
            >
                <Upload size={20}/>
            </button>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
                  <button onClick={() => setShowUploadModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                      <X size={24}/>
                  </button>

                  <h2 className="text-xl font-bold text-white mb-4">Upload Master GATE Syllabus</h2>
                  <p className="text-gray-400 text-sm mb-6">Upload the official GATE PDF/Image. AI will extract subjects and merge them into your GATE Prep space.</p>

                  <form onSubmit={handleUpload} className="space-y-6">
                      <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-green-500/50 transition-colors cursor-pointer bg-gray-800/30">
                          <input
                              type="file"
                              id="master-upload"
                              className="hidden"
                              accept=".pdf,image/*"
                              onChange={e => setFile(e.target.files?.[0] || null)}
                          />
                          <label htmlFor="master-upload" className="cursor-pointer flex flex-col items-center w-full">
                              <Upload className="text-green-500 mb-3" size={32}/>
                              <span className="text-gray-300 font-medium">Click to Select File</span>
                              {file && <span className="mt-2 text-sm text-green-400">{file.name}</span>}
                          </label>
                      </div>

                      {uploadMessage && (
                          <div className={`p-3 rounded text-sm ${uploadMessage.includes('Success') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                              {uploadMessage}
                          </div>
                      )}

                      <button
                          type="submit"
                          disabled={!file || uploading}
                          className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                          {uploading ? <><Loader2 className="animate-spin mr-2"/> Processing...</> : 'Start Extraction'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
