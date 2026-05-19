"use client";

import React, { useState } from 'react';
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
            <header>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">Overview</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Here's what's happening with your meetings today.</p>
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
