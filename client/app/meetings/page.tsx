"use client";

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import MeetingTable from '../../components/MeetingTable';
import { Calendar, Users, TrendingUp, CheckCircle } from 'lucide-react';

export default function MeetingsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [currentUser, setCurrentUser] = useState<any>(null);

  const [stats, setStats] = useState({ total: 0, completed: 0, upcoming: 0, avgParticipants: 0 });

  React.useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to parse user', e);
    }
  }, []);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          let completed = 0;
          let upcoming = 0;
          let participantsCount = 0;
          data.forEach((m: any) => {
            if (m.status === 'Completed') completed++;
            if (m.status === 'Scheduled' || m.status === 'Ongoing') upcoming++;
            if (m.participants) participantsCount += m.participants.length;
          });
          const avg = data.length > 0 ? (participantsCount / data.length).toFixed(1) : 0;
          
          setStats({
            total: data.length,
            completed,
            upcoming,
            avgParticipants: Number(avg)
          });
        }
      } catch (error) {
        console.error('Failed to fetch meetings for stats', error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans transition-colors">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar 
          onMenuClick={() => setIsSidebarOpen(true)} 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 dark:bg-gray-950/50 p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">All Meetings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage, edit, and organize all your upcoming events.</p>
              </div>
              <a href="/meetings/create" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2">
                <Calendar size={16} />
                Schedule Meeting
              </a>
            </header>

            {/* Quick Analytics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Meetings</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</h3>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Completed</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</h3>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Upcoming</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.upcoming}</h3>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Avg Participants</p>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgParticipants}</h3>
                </div>
              </div>
            </div>
            
            <div className="pb-8">
              <MeetingTable searchQuery={searchQuery} currentUser={currentUser} />
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}
