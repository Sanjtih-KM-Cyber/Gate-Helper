import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, Music, Image as ImageIcon, Film, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function Vault() {
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [uploadStats, setUploadStats] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setYoutubeUrl('');
    }
  };

  const handleUpload = async () => {
    if (!file && !youtubeUrl) {
      setMessage('Please select a file or enter a YouTube URL');
      return;
    }

    setStatus('uploading');
    setMessage('');
    setUploadStats(null);

    const formData = new FormData();
    if (file) {
      formData.append('file', file);
      // Determine type based on mime type roughly for the backend requirement if strictly needed,
      // but backend logic seems to sniff mimetype.
      // However, backend code: `const { type, youtubeUrl } = req.body;`
      // It uses type for logic?
      // Looking at `upload.ts`:
      // `if (youtubeUrl) { ... } else if (file) { ... if (file.mimetype === ...) ... }`
      // So `type` might not be strictly required if `file.mimetype` is used.
      // But let's send it to be safe.
      formData.append('type', 'file');
    } else {
        formData.append('youtubeUrl', youtubeUrl);
        formData.append('type', 'youtube');
    }

    try {
      const response = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setStatus('success');
      setUploadStats(response.data);
      setMessage('Content processed and added to RAG vector store successfully!');
      setFile(null);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* File Upload Section */}
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-900/50 relative group">
                <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept=".pdf,.ppt,.pptx,image/*,audio/*,video/*"
                />
                <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:bg-gray-700 transition-colors">
                    <Upload className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-gray-300 font-medium mb-1">Click or Drag file to upload</p>
                <p className="text-gray-500 text-sm">PDF, PPT, Images, Audio</p>
                {file && (
                    <div className="mt-4 p-2 bg-blue-900/30 text-blue-300 rounded text-sm flex items-center">
                        <FileText size={16} className="mr-2"/> {file.name}
                    </div>
                )}
            </div>

            {/* YouTube Section */}
            <div className="flex flex-col justify-center space-y-4">
                <div className="text-gray-300 font-medium">Or import from YouTube</div>
                <input
                    type="text"
                    placeholder="Paste YouTube Video URL..."
                    value={youtubeUrl}
                    onChange={(e) => {
                        setYoutubeUrl(e.target.value);
                        setFile(null);
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
            </div>
        </div>

        <div className="flex justify-end">
            <button
                onClick={handleUpload}
                disabled={status === 'uploading' || (!file && !youtubeUrl)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    status === 'uploading' || (!file && !youtubeUrl)
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
                        <span>Upload to Vault</span>
                    </>
                )}
            </button>
        </div>

        {/* Status Messages */}
        {status === 'success' && (
            <div className="mt-6 p-4 bg-green-900/20 border border-green-800 rounded-lg flex items-start space-x-3 animate-fade-in">
                <CheckCircle className="text-green-400 mt-1 flex-shrink-0" />
                <div>
                    <h3 className="text-green-400 font-medium">Upload Successful!</h3>
                    <p className="text-green-300/80 text-sm mt-1">{message}</p>
                    {uploadStats && (
                        <div className="mt-2 text-xs text-green-300/60">
                            Extracted {uploadStats.extractedTextLength} chars.
                            Generated {uploadStats.embeddingResult?.vectorsGenerated} vectors.
                        </div>
                    )}
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
