import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, BrainCircuit, Activity, GraduationCap, Shield, AlertTriangle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Vault from './components/Vault';
import TestEngine from './components/TestEngine';
import Visualizer from './components/Visualizer';
import CollegePrepSpace from './components/CollegePrepSpace';
import CyberHub from './components/CyberHub';
import MistakeVault from './components/MistakeVault';

function Sidebar() {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/college-prep', label: 'College Prep', icon: GraduationCap },
    { path: '/cyber-hub', label: 'Cyber Hub', icon: Shield },
    { path: '/mistake-vault', label: 'Mistake Vault', icon: AlertTriangle },
    { path: '/vault', label: 'RAG Vault', icon: Database },
    { path: '/test-engine', label: 'Test Engine', icon: BrainCircuit },
    { path: '/visualizer', label: 'Visualizer', icon: Activity },
  ];

  return (
    <div className="w-64 bg-gray-900 h-screen p-4 text-white flex flex-col fixed left-0 top-0 overflow-y-auto border-r border-gray-800 scrollbar-thin scrollbar-thumb-gray-700">
      <h1 className="text-2xl font-bold mb-8 text-center text-blue-400 tracking-wider">GATE Tutor</h1>
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-white'} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 pt-4 border-t border-gray-800 text-xs text-gray-600 text-center font-mono">
        v2.0 • Offline AI
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="flex bg-gray-950 min-h-screen text-gray-100 font-sans selection:bg-blue-500/30">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen scrollbar-hide">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/college-prep" element={<CollegePrepSpace />} />
            <Route path="/cyber-hub" element={<CyberHub />} />
            <Route path="/mistake-vault" element={<MistakeVault />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/test-engine" element={<TestEngine />} />
            <Route path="/visualizer" element={<Visualizer />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
