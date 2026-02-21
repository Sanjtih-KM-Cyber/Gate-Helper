import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Book, Plus, ArrowRight, Upload, Loader2, Database, GraduationCap, X, FlaskConical } from 'lucide-react';

interface Subject {
  _id: string;
  name: string;
  description: string;
  category: string;
  type: 'Theory' | 'Lab';
  syllabus: any[];
}

const GATE_SUBJECTS = [
  'Operating Systems',
  'Database Management Systems',
  'Computer Networks',
  'Theory of Computation',
  'Compiler Design',
  'Algorithms',
  'Data Structures',
  'Computer Organization and Architecture',
  'Digital Logic',
  'Discrete Mathematics',
  'Engineering Mathematics',
  'General Aptitude'
];

interface SubjectExplorerProps {
  category: 'College Prep' | 'GATE Prep';
}

export default function SubjectExplorer({ category }: SubjectExplorerProps) {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State for College Prep
  const [showModal, setShowModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [subjectType, setSubjectType] = useState<'Theory' | 'Lab'>('Theory');
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

  // Loading State for GATE subject creation
  const [creatingGateSubject, setCreatingGateSubject] = useState<string | null>(null);

  useEffect(() => {
    fetchSubjects();
  }, [category]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/subjects');
      // Filter by category
      const filtered = res.data.filter((s: Subject) => s.category === category);
      setSubjects(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGateSubjectClick = async (subjectName: string) => {
    // Check if subject already exists
    const existing = subjects.find(s => s.name === subjectName);
    if (existing) {
      navigate(`/subject/${existing._id}`);
      return;
    }

    // Create it
    setCreatingGateSubject(subjectName);
    try {
      const res = await axios.post('http://localhost:5000/api/subjects/gate-prep', { name: subjectName });
      navigate(`/subject/${res.data._id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to initialize subject. Please try again.');
    } finally {
      setCreatingGateSubject(null);
    }
  };

  const handleCollegePrepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName) return;
    if (subjectType === 'Theory' && (!files || files.length === 0)) {
        alert("Please upload syllabus files for Theory subjects.");
        return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('name', newSubjectName);
    formData.append('type', subjectType);
    formData.append('description', 'User uploaded subject');
    if (files) {
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
    }

    try {
      const res = await axios.post('http://localhost:5000/api/subjects/college-prep', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSubjects([...subjects, res.data]);
      setShowModal(false);
      setNewSubjectName('');
      setSubjectType('Theory');
      setFiles(null);
    } catch (err) {
      console.error(err);
      alert('Failed to create subject. Ensure backend is running.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
             {category === 'College Prep' ? <GraduationCap className="mr-3 text-blue-500" size={40}/> : <Database className="mr-3 text-green-500" size={40}/>}
             {category}
           </h1>
           <p className="text-gray-400 text-lg">
             {category === 'College Prep' ? 'Your semester subjects & custom syllabus.' : 'Official GATE curriculum & automated study plans.'}
           </p>
        </div>

        {category === 'College Prep' && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl flex items-center space-x-2 transition-all shadow-lg hover:shadow-blue-900/40"
          >
            <Plus size={20} />
            <span className="font-medium">Add Subject</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-gray-500" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {category === 'College Prep' ? (
            subjects.length === 0 ? (
              <div className="col-span-full text-center py-20 border-2 border-dashed border-gray-800 rounded-xl">
                 <p className="text-gray-500 mb-4">No subjects yet. Add one to get started!</p>
                 <button onClick={() => setShowModal(true)} className="text-blue-500 hover:underline">Create a Subject</button>
              </div>
            ) : (
              subjects.map((sub) => (
                <Link to={`/subject/${sub._id}`} key={sub._id} className="group bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500 transition-all shadow-lg hover:shadow-blue-900/20 flex flex-col justify-between min-h-[180px]">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">{sub.name}</h2>
                      {sub.type === 'Lab' ? (
                          <FlaskConical className="text-purple-500 group-hover:text-purple-400 transition-colors flex-shrink-0" size={24}/>
                      ) : (
                          <Book className="text-gray-600 group-hover:text-blue-500 transition-colors flex-shrink-0" size={24}/>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${sub.type === 'Lab' ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-900/30 text-blue-400'}`}>
                            {sub.type}
                        </span>
                    </div>
                    <p className="text-gray-500 text-sm">
                        {sub.syllabus?.length || 0} Units • {sub.syllabus?.reduce((acc: number, u: any) => acc + (u.topics?.length || 0), 0) || 0} Topics
                    </p>
                  </div>
                  <div className="flex items-center text-blue-500 text-sm font-medium mt-6 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                    View Workspace <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))
            )
          ) : (
            // GATE PREP FLOW
            GATE_SUBJECTS.map((name) => {
              const existing = subjects.find(s => s.name === name);
              const isCreating = creatingGateSubject === name;

              return (
                <div
                   key={name}
                   onClick={() => !isCreating && handleGateSubjectClick(name)}
                   className={`relative group bg-gray-900 border border-gray-800 rounded-xl p-6 transition-all shadow-lg hover:shadow-green-900/20 flex flex-col justify-between min-h-[180px] cursor-pointer ${existing ? 'hover:border-green-500' : 'hover:border-gray-600 opacity-80 hover:opacity-100'}`}
                >
                   {isCreating && (
                      <div className="absolute inset-0 bg-gray-900/90 z-10 flex flex-col items-center justify-center rounded-xl backdrop-blur-sm">
                         <Loader2 className="animate-spin text-green-500 mb-2" size={32}/>
                         <span className="text-green-400 text-sm font-medium animate-pulse">Scraping Syllabus...</span>
                      </div>
                   )}

                   <div>
                     <div className="flex justify-between items-start mb-4">
                       <h2 className={`text-xl font-bold transition-colors line-clamp-2 ${existing ? 'text-white group-hover:text-green-400' : 'text-gray-400 group-hover:text-gray-200'}`}>
                         {name}
                       </h2>
                       <Database className={`${existing ? 'text-green-600' : 'text-gray-700'} group-hover:text-green-500 transition-colors flex-shrink-0`} size={24}/>
                     </div>
                     <p className="text-gray-500 text-sm">
                        {existing ? `${existing.syllabus?.length || 0} Units • Ready` : 'Not Started • Click to Initialize'}
                     </p>
                   </div>

                   <div className={`flex items-center text-sm font-medium mt-6 transition-all ${existing ? 'text-green-500 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0' : 'text-gray-500 group-hover:text-gray-300'}`}>
                     {existing ? 'Enter Subject' : 'Initialize Subject'} <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                   </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal for College Prep Upload */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-6 border-b border-gray-800">
                 <h2 className="text-xl font-bold text-white">Add New Subject</h2>
                 <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                 </button>
              </div>

              <form onSubmit={handleCollegePrepSubmit} className="p-6 space-y-6">
                 <div>
                    <label className="block text-gray-400 text-sm font-medium mb-2">Subject Name</label>
                    <input
                      type="text"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. Distributed Systems"
                      value={newSubjectName}
                      onChange={e => setNewSubjectName(e.target.value)}
                      required
                    />
                 </div>

                 {/* Type Selection */}
                 <div>
                    <label className="block text-gray-400 text-sm font-medium mb-2">Subject Type</label>
                    <div className="flex space-x-4">
                        <button
                            type="button"
                            onClick={() => setSubjectType('Theory')}
                            className={`flex-1 py-3 rounded-lg border flex items-center justify-center space-x-2 transition-all ${
                                subjectType === 'Theory'
                                ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            <Book size={18} />
                            <span>Theory</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubjectType('Lab')}
                            className={`flex-1 py-3 rounded-lg border flex items-center justify-center space-x-2 transition-all ${
                                subjectType === 'Lab'
                                ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            <FlaskConical size={18} />
                            <span>Lab</span>
                        </button>
                    </div>
                 </div>

                 {/* Optional Upload for Theory */}
                 {subjectType === 'Theory' && (
                     <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                        <label className="block text-gray-400 text-sm font-medium mb-2">Syllabus Files (PDF/Images)</label>
                        <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:border-blue-500/50 transition-colors group cursor-pointer bg-gray-800/50">
                        <Upload className="text-gray-500 group-hover:text-blue-400 mb-3" size={32}/>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,image/*"
                            onChange={e => setFiles(e.target.files)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            style={{ position: 'relative', height: '100px', width: '100%', display: 'none' }}
                            id="file-upload"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer w-full flex flex-col items-center">
                                <span className="text-gray-300 font-medium group-hover:text-blue-400">Click to Upload</span>
                                <span className="text-gray-500 text-xs mt-1">PDFs or Screenshots of Syllabus</span>
                                {files && files.length > 0 && (
                                    <div className="mt-4 bg-blue-900/30 px-3 py-1 rounded-full text-blue-300 text-xs">
                                        {files.length} files selected
                                    </div>
                                )}
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            multiple
                            accept=".pdf,image/*"
                            onChange={e => setFiles(e.target.files)}
                            className="hidden"
                        />
                        </div>
                     </div>
                 )}

                 {/* Lab Info */}
                 {subjectType === 'Lab' && (
                     <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg text-sm text-purple-300 animate-in fade-in slide-in-from-top-4 duration-300">
                         <p className="font-medium mb-1">Lab Mode Selected</p>
                         <p className="opacity-80">This will create an empty workspace where you can manually add experiments or upload lab manuals later.</p>
                     </div>
                 )}

                 <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="text-gray-400 hover:text-white px-4 py-2 mr-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploading}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg hover:shadow-blue-900/30 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? <><Loader2 className="animate-spin mr-2" size={18}/> {subjectType === 'Theory' ? 'Analyzing...' : 'Creating...'}</> : 'Create Subject'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
