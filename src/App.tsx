import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, BrainCircuit, Activity } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Vault from './components/Vault';
import TestEngine from './components/TestEngine';
import Visualizer from './components/Visualizer';

function Sidebar() {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/vault', label: 'Vault', icon: Database },
    { path: '/test-engine', label: 'Test Engine', icon: BrainCircuit },
    { path: '/visualizer', label: 'Visualizer', icon: Activity },
  ];

  return (
    <div className="w-64 bg-gray-900 h-screen p-4 text-white flex flex-col fixed left-0 top-0 overflow-y-auto border-r border-gray-800">
      <h1 className="text-2xl font-bold mb-8 text-center text-blue-400">GATE Tutor</h1>
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-gray-800 text-xs text-gray-500 text-center">
        Offline-First Architecture
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="flex bg-gray-950 min-h-screen text-gray-100 font-sans">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
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
