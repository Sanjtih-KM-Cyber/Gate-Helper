import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import mermaid from 'mermaid';
import { Search, Activity, ZoomIn, ZoomOut, Download, AlertTriangle } from 'lucide-react';

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
});

function MermaidChart({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderChart = async () => {
      setError(null);
      if (containerRef.current && code) {
        try {
            // Check for obviously bad syntax before trying to render
            if (code.includes('->>')) {
                 throw new Error("Invalid arrow syntax '->>' detected. Please regenerate.");
            }

            containerRef.current.innerHTML = '';
            const id = `mermaid-${Date.now()}`;
            // mermaid.render can throw if syntax is invalid
            const { svg } = await mermaid.render(id, code);
            containerRef.current.innerHTML = svg;
        } catch (err: any) {
            console.error('Mermaid render error', err);
            setError(err.message || 'Syntax Error');
            containerRef.current.innerHTML = ''; // Clear container
        }
      }
    };
    renderChart();
  }, [code]);

  if (error) {
      return (
          <div className="flex flex-col items-center justify-center p-8 bg-red-900/20 border border-red-800 rounded-lg h-[300px]">
              <AlertTriangle className="text-red-500 mb-2" size={32} />
              <p className="text-red-400 font-bold mb-1">Visualization Failed</p>
              <p className="text-red-300/80 text-sm text-center max-w-md">
                  The AI generated invalid diagram syntax ({error}).
                  <br/>Please try clicking "Visualize" again.
              </p>
          </div>
      );
  }

  return <div ref={containerRef} className="overflow-x-auto flex justify-center p-4 bg-gray-800 rounded-lg min-h-[300px] items-center" />;
}

export default function Visualizer() {
  const [concept, setConcept] = useState('');
  const [loading, setLoading] = useState(false);
  const [mermaidCode, setMermaidCode] = useState('');

  const handleVisualize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept.trim()) return;

    setLoading(true);
    setMermaidCode('');

    try {
      const response = await axios.post('http://localhost:5000/api/agent/visualize', { concept });
      setMermaidCode(response.data.mermaid);
    } catch (error) {
      console.error(error);
      alert('Failed to generate visualization. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-8">
         <h1 className="text-3xl font-bold text-white mb-2">Concept Visualizer</h1>
         <p className="text-gray-400">Turn complex GATE concepts into instant flowcharts and diagrams.</p>
      </div>

      <form onSubmit={handleVisualize} className="mb-10">
        <div className="relative">
          <input
            type="text"
            placeholder="Enter a concept (e.g., 'Push-Down Automata', 'Dijkstra Algorithm')..."
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 pl-12 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-lg"
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <button
            type="submit"
            disabled={loading || !concept}
            className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? 'Visualizing...' : 'Visualize'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-pulse">
          <Activity size={48} className="mb-4 text-purple-500" />
          <p className="text-xl">Consulting AI & drawing diagram...</p>
        </div>
      )}

      {mermaidCode && (
        <div className="space-y-4 animate-in fade-in duration-500">
             <div className="flex justify-between items-center">
                 <h2 className="text-xl font-semibold text-white">Generated Diagram</h2>
                 <div className="flex space-x-2">
                     <button className="p-2 bg-gray-800 rounded hover:bg-gray-700 text-gray-300" title="Zoom In"><ZoomIn size={18}/></button>
                     <button className="p-2 bg-gray-800 rounded hover:bg-gray-700 text-gray-300" title="Zoom Out"><ZoomOut size={18}/></button>
                     <button className="p-2 bg-gray-800 rounded hover:bg-gray-700 text-gray-300" title="Download SVG"><Download size={18}/></button>
                 </div>
             </div>
             <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 shadow-2xl">
                <MermaidChart code={mermaidCode} />
             </div>
             <div className="mt-8">
                 <h3 className="text-gray-400 mb-2 text-sm uppercase font-bold tracking-wider">Mermaid Source Code</h3>
                 <pre className="bg-gray-950 p-4 rounded-lg text-green-400 font-mono text-sm overflow-x-auto border border-gray-800">
                     {mermaidCode}
                 </pre>
             </div>
        </div>
      )}
    </div>
  );
}
