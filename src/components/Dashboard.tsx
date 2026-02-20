import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { LayoutDashboard, Plus, Trash2 } from 'lucide-react';

// === SubjectCard Component ===
function SubjectCard({ title, subjects }: { title: string, subjects: { name: string, progress: number }[] }) {
  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg">
      <h2 className="text-xl font-semibold mb-6 text-blue-400 border-b border-gray-800 pb-2">{title}</h2>
      {subjects.length === 0 ? (
          <div className="text-gray-500 text-sm">No subjects in this category.</div>
      ) : (
          <div className="space-y-6">
            {subjects.map((subject) => (
              <div key={subject.name}>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-300 font-medium">{subject.name}</span>
                  <span className="text-gray-400 text-sm">{subject.progress}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${subject.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
      )}
    </div>
  );
}

// === Dashboard Component ===
interface SemesterPlan {
  _id: string;
  title: string;
  semester: string;
  order: number;
}

interface Stats {
    subjects: number;
    topics: number;
    mistakes: number;
    accuracy: number;
}

const semesters = ['Semester 5', 'Semester 6', 'Semester 7', 'Semester 8', 'Backlog'];

export default function Dashboard() {
  const [plans, setPlans] = useState<SemesterPlan[]>([]);
  const [stats, setStats] = useState<Stats>({ subjects: 0, topics: 0, mistakes: 0, accuracy: 0 });
  // In a real app, we would fetch these categorization from the Subject model (category field)
  // For now, let's keep the hardcoded split for "visuals" but fetch the counts
  const [coreSubjects, setCoreSubjects] = useState<any[]>([]);

  useEffect(() => {
    fetchPlans();
    fetchStats();
    fetchSubjects();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/planner');
      if (Array.isArray(res.data)) {
        setPlans(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
      try {
          const res = await axios.get('http://localhost:5000/api/stats');
          if (res.data) setStats(res.data);
      } catch (err) {
          console.error(err);
      }
  }

  const fetchSubjects = async () => {
      try {
          const res = await axios.get('http://localhost:5000/api/subjects');
          if (Array.isArray(res.data)) {
            const subs = res.data.map((s: any) => ({ name: s.name, progress: Math.floor(Math.random() * 100) }));
            setCoreSubjects(subs.slice(0, 5));
          }
      } catch (err) {
          console.error(err);
      }
  }

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;

    setPlans(prev => prev.map(p =>
      p._id === draggableId ? { ...p, semester: destination.droppableId } : p
    ));

    try {
      await axios.put(`http://localhost:5000/api/planner/${draggableId}`, {
        semester: destination.droppableId
      });
    } catch (err) {
      console.error(err);
      fetchPlans();
    }
  };

  const addSubject = async (semester: string) => {
    const title = prompt('Enter subject name:');
    if (!title) return;

    try {
      const res = await axios.post('http://localhost:5000/api/planner', {
        title,
        semester,
        order: plans.filter(p => p.semester === semester).length
      });
      setPlans([...plans, res.data]);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSubject = async (id: string) => {
      if(!confirm("Remove from plan?")) return;
      try {
          await axios.delete(`http://localhost:5000/api/planner/${id}`);
          setPlans(plans.filter(p => p._id !== id));
      } catch (err) {
          console.error(err);
      }
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Stats Section */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Track your GATE 2026 preparation progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SubjectCard title="Active Subjects" subjects={coreSubjects} />
        {/* Placeholder for now since we don't distinguish yet in DB, or duplicate */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg flex items-center justify-center flex-col text-center">
            <h3 className="text-xl font-semibold text-gray-400 mb-4">Focus Area</h3>
            <p className="text-gray-500">Categorize your subjects in the "My Subjects" tab to see them here.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
           <h3 className="text-lg font-semibold text-gray-200 mb-2">Total Topics</h3>
           <p className="text-4xl font-bold text-green-400">{stats.topics}</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
           <h3 className="text-lg font-semibold text-gray-200 mb-2">Mistakes Logged</h3>
           <p className="text-4xl font-bold text-purple-400">{stats.mistakes}</p>
        </div>
         <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
           <h3 className="text-lg font-semibold text-gray-200 mb-2">Est. Accuracy</h3>
           <p className="text-4xl font-bold text-yellow-400">{stats.accuracy}%</p>
        </div>
      </div>

      {/* Kanban Planner */}
      <div>
        <div className="flex items-center mb-6">
          <LayoutDashboard className="text-blue-400 mr-2" />
          <h2 className="text-2xl font-bold text-white">Semester Planner</h2>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex overflow-x-auto pb-4 space-x-6">
            {semesters.map(sem => (
              <div key={sem} className="flex-shrink-0 w-80">
                <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col h-full min-h-[300px]">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850 rounded-t-xl">
                    <h3 className="font-bold text-gray-200">{sem}</h3>
                    <button
                      onClick={() => addSubject(sem)}
                      className="text-blue-400 hover:text-blue-300 p-1 hover:bg-blue-900/20 rounded transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <Droppable droppableId={sem}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-4 flex-1 space-y-3 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-gray-800/30' : ''
                        }`}
                      >
                        {plans
                          .filter(p => p.semester === sem)
                          .map((item, index) => (
                            <Draggable key={item._id} draggableId={item._id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-gray-800 p-3 rounded border border-gray-700 shadow-sm group relative hover:border-blue-500/50 transition-all ${
                                    snapshot.isDragging ? 'opacity-50 ring-2 ring-blue-500' : ''
                                  }`}
                                >
                                  <div className="pr-6 text-sm font-medium text-gray-300 break-words">
                                    {item.title}
                                  </div>
                                  <button
                                    onClick={() => deleteSubject(item._id)}
                                    className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                  >
                                    <Trash2 size={14}/>
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
