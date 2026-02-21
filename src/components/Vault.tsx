import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, Music, Image as ImageIcon, Film, Loader2, CheckCircle, AlertCircle, X, Youtube } from 'lucide-react';

export default function Vault() {
  const [files, setFiles] = useState<File[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [uploadStats, setUploadStats] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      // We don't clear youtubeUrl automatically now, allowing mixed upload
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 && !youtubeUrl) {
      setMessage('Please select files or enter a YouTube URL');
      return;
    }

    setStatus('uploading');
    setMessage('');
    setUploadStats(null);

    const formData = new FormData();

    // Append all files with the key 'files' for multer array
    files.forEach(file => {
      formData.append('files', file);
    });

    if (youtubeUrl) {
        formData.append('youtubeUrl', youtubeUrl);
    }

    try {
      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setStatus('success');
      setUploadStats(response.data);
      setMessage('Upload successful!');
      setFiles([]);
      setYoutubeUrl('');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setMessage(error.response?.data?.error || 'Upload failed. Ensure backend is running.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
         <h1 className="text-3xl font-bold text-white mb-2">Knowledge Vault</h1>
         <p className="text-gray-400">Upload study materials (PDF, PPT, Images, Audio) or YouTube links to train your personal GATE tutor.</p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 shadow-2xl">
        <div className="grid grid-cols-1 gap-8 mb-8">
            {/* File Upload Section */}
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-900/50 relative group min-h-[200px]">
                <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept=".pdf,.ppt,.pptx,image/*,audio/*,video/*"
                    multiple
                />
                <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:bg-gray-700 transition-colors">
                    <Upload className="w-10 h-10 text-blue-400" />
                </div>
                <p className="text-gray-300 font-medium mb-1 text-lg">Click or Drag files to upload</p>
                <p className="text-gray-500 text-sm">Supports multiple files: PDF, PPT, Images, Audio</p>
            </div>

            {/* Selected Files List */}
            {files.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Selected Files ({files.length})</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {files.map((file, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-800 p-3 rounded border border-gray-700/50">
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    {file.type.includes('pdf') ? <FileText size={18} className="text-red-400 flex-shrink-0"/> :
                                     file.type.includes('image') ? <ImageIcon size={18} className="text-blue-400 flex-shrink-0"/> :
                                     file.type.includes('audio') ? <Music size={18} className="text-yellow-400 flex-shrink-0"/> :
                                     <FileText size={18} className="text-gray-400 flex-shrink-0"/>}
                                    <span className="text-gray-300 text-sm truncate">{file.name}</span>
                                    <span className="text-gray-500 text-xs flex-shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                </div>
                                <button onClick={() => removeFile(idx)} className="text-gray-500 hover:text-red-400 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* YouTube Section */}
            <div className="flex flex-col space-y-2">
                <label className="text-gray-300 font-medium flex items-center gap-2">
                    <Youtube size={20} className="text-red-500"/> Import from YouTube
                </label>
                <input
                    type="text"
                    placeholder="Paste YouTube Video URL..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
            </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-800">
            <button
                onClick={handleUpload}
                disabled={status === 'uploading' || (files.length === 0 && !youtubeUrl)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    status === 'uploading' || (files.length === 0 && !youtubeUrl)
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/20'
                }`}
            >
                {status === 'uploading' ? (
                    <>
                        <Loader2 className="animate-spin" />
                        <span>Processing...</span>
                    </>
                ) : (
                    <>
                        <Upload size={20} />
                        <span>Upload All to Vault</span>
                    </>
                )}
            </button>
        </div>

        {/* Status Messages */}
        {status === 'success' && (
            <div className="mt-6 p-4 bg-green-900/20 border border-green-800 rounded-lg animate-fade-in">
                <div className="flex items-start space-x-3">
                    <CheckCircle className="text-green-400 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="text-green-400 font-medium">Processing Complete!</h3>
                        <p className="text-green-300/80 text-sm mt-1">{message}</p>

                        {uploadStats && uploadStats.results && (
                            <div className="mt-3 space-y-1">
                                {uploadStats.results.map((res: any, idx: number) => (
                                    <div key={idx} className={`text-xs flex items-center space-x-2 ${res.success ? 'text-green-300/70' : 'text-red-300/70'}`}>
                                        {res.success ? <CheckCircle size={12}/> : <AlertCircle size={12}/>}
                                        <span className="truncate max-w-[200px]">{res.source}</span>
                                        <span>- {res.success ? `Indexed ${res.vectorsGenerated || 0} chunks` : res.error}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {status === 'error' && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-800 rounded-lg flex items-start space-x-3 animate-fade-in">
                <AlertCircle className="text-red-400 mt-1 flex-shrink-0" />
                <div>
                    <h3 className="text-red-400 font-medium">Processing Failed</h3>
                    <p className="text-red-300/80 text-sm mt-1">{message}</p>
                </div>
            </div>
        )}
      </div>

      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col items-center justify-center text-center border border-gray-800">
            <FileText className="text-purple-400 mb-2" />
            <span className="text-gray-400 text-sm">Notes & PDFs</span>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col items-center justify-center text-center border border-gray-800">
            <Film className="text-red-400 mb-2" />
            <span className="text-gray-400 text-sm">Lecture Videos</span>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col items-center justify-center text-center border border-gray-800">
             <ImageIcon className="text-yellow-400 mb-2" />
            <span className="text-gray-400 text-sm">Diagrams</span>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg flex flex-col items-center justify-center text-center border border-gray-800">
            <Music className="text-green-400 mb-2" />
            <span className="text-gray-400 text-sm">Audio Lectures</span>
        </div>
      </div>
    </div>
  );
}
