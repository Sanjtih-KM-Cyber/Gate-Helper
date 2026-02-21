import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Database, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-12">
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
        <Link
          to="/subjects/gate-prep"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-green-500/50 transition-all duration-300 shadow-2xl hover:shadow-green-900/20 p-8 flex flex-col items-start justify-between min-h-[250px]"
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
      </div>
    </div>
  );
}
