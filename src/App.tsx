import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Home, Loader2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import SubjectExplorer from './components/SubjectExplorer';
import SubjectDetail from './components/SubjectDetail';
import TopicStudio from './components/TopicStudio';
import SettingsPage from './components/Settings';
import CyberHub from './components/CyberHub';
import { GlobalTaskProvider, useGlobalTask, GlobalTaskManagerProvider, useGlobalTaskManager } from './context/GlobalTaskManager';

function Navbar() {
  const { isGenerating } = useGlobalTask(); // Legacy
  const { tasks } = useGlobalTaskManager(); // New Manager
  const activeTasksCount = Object.values(tasks).filter((t: any) => t.status === 'running' || t.status === 'pending').length;

  return (
     <nav className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
       <div className="flex items-center space-x-6">
          <Link to="/" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 hover:opacity-80 transition-opacity">
            GATE Tutor
          </Link>
          <Link to="/" className="text-gray-400 hover:text-white flex items-center space-x-2 text-sm font-medium transition-colors">
            <Home size={16}/> <span>Dashboard</span>
          </Link>
       </div>

       <div className="flex items-center space-x-6">
          {(isGenerating || activeTasksCount > 0) && (
             <div className="flex items-center text-yellow-500 text-xs font-mono bg-yellow-900/20 px-3 py-1 rounded-full border border-yellow-800 animate-pulse">
                <Loader2 className="mr-2 animate-spin" size={12}/>
                {isGenerating ? 'Generating Questions...' : `${activeTasksCount} Active Task(s)`}
             </div>
          )}
          <Link to="/settings" className="text-gray-400 hover:text-white transition-colors">
            <Settings size={20}/>
          </Link>
       </div>
     </nav>
  )
}

function App() {
  return (
    <GlobalTaskProvider>
    <GlobalTaskManagerProvider>
      <Router>
        <div className="bg-gray-950 min-h-screen text-gray-100 font-sans selection:bg-blue-500/30 flex flex-col">
          <Navbar />
          <main className="flex-1 p-8 overflow-y-auto scrollbar-hide w-full max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />

              {/* College Prep Flow */}
              <Route path="/subjects/college-prep" element={<SubjectExplorer category="College Prep" />} />

              {/* GATE Prep Flow */}
              <Route path="/subjects/gate-prep" element={<SubjectExplorer category="GATE Prep" />} />

              {/* Details */}
              <Route path="/subject/:id" element={<SubjectDetail />} />
              <Route path="/subject/:subjectId/topic/:topic" element={<TopicStudio />} />

              <Route path="/hub" element={<CyberHub />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </GlobalTaskManagerProvider>
    </GlobalTaskProvider>
  );
}

export default App;
