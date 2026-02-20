import React from 'react';

const coreSubjects = [
  { name: 'Data Structures & Algorithms', progress: 75 },
  { name: 'Operating Systems', progress: 60 },
  { name: 'Database Management Systems', progress: 45 },
  { name: 'Computer Networks', progress: 30 },
  { name: 'Compiler Design', progress: 20 },
];

const daSubjects = [
  { name: 'Linear Algebra', progress: 80 },
  { name: 'Probability & Statistics', progress: 50 },
  { name: 'Machine Learning', progress: 40 },
  { name: 'Calculus', progress: 65 },
];

function SubjectCard({ title, subjects }: { title: string, subjects: { name: string, progress: number }[] }) {
  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg">
      <h2 className="text-xl font-semibold mb-6 text-blue-400 border-b border-gray-800 pb-2">{title}</h2>
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
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Track your GATE 2026 preparation progress.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SubjectCard title="CS Core Subjects" subjects={coreSubjects} />
        <SubjectCard title="Data Science & AI (DA)" subjects={daSubjects} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
           <h3 className="text-lg font-semibold text-gray-200 mb-2">Total Topics Covered</h3>
           <p className="text-4xl font-bold text-green-400">142</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
           <h3 className="text-lg font-semibold text-gray-200 mb-2">Tests Attempted</h3>
           <p className="text-4xl font-bold text-purple-400">28</p>
        </div>
         <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
           <h3 className="text-lg font-semibold text-gray-200 mb-2">Average Accuracy</h3>
           <p className="text-4xl font-bold text-yellow-400">76%</p>
        </div>
      </div>
    </div>
  );
}
