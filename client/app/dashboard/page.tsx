"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import DashboardCard from '../../components/DashboardCard';
import DashboardChart from '../../components/DashboardChart';
import CalendarWidget from '../../components/CalendarWidget';
import MeetingTable from '../../components/MeetingTable';
import { dashboardStats } from '../../data/dashboardData';

export default function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const user = params.get('user');

    if (!token) return;

    localStorage.setItem('accessToken', token);
    if (user) {
      localStorage.setItem('user', user);
    }

    window.history.replaceState(null, '', '/dashboard');
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
            <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 shadow-lg mb-8">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-10 blur-3xl"></div>
              <div className="relative z-10 flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back, SuperAdmin! 👋</h1>
                  <p className="text-blue-100 mt-2 text-sm md:text-base">Here is what is happening with your meetings today. You have 2 upcoming meetings.</p>
                </div>
              </div>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboardStats.map((stat) => (
                <DashboardCard 
                  key={stat.id}
                  title={stat.title} 
                  value={stat.value} 
                  description={stat.description} 
                />
              ))}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 min-h-[350px]">
                <DashboardChart />
              </div>
              <div className="min-h-[350px]">
                <CalendarWidget />
              </div>
            </div>

            <div className="pb-8">
              <MeetingTable searchQuery={searchQuery} />
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}
