"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import DashboardCard from '../../components/DashboardCard';
import DashboardChart from '../../components/DashboardChart';
import CalendarWidget from '../../components/CalendarWidget';
import MeetingTable from '../../components/MeetingTable';
import { dashboardStats } from '../../data/dashboardData';

interface User {
  name?: string;
  role?: string;
  [key: string]: any;
}

export default function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userParam = params.get('user');

    if (token) {
      localStorage.setItem('accessToken', token);
    }
    if (userParam) {
      localStorage.setItem('user', userParam);
    }

    if (token || userParam) {
      window.history.replaceState(null, '', '/dashboard');
    }

    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to parse user', e);
    }
  }, []);

  const role = currentUser?.role || 'Participant';
  
  const getGreetingName = () => {
    if (role === 'SuperAdmin') return 'SuperAdmin';
    if (role === 'Admin') return 'Admin';
    return currentUser?.name ? currentUser.name.split(' ')[0] : role;
  };
  const greetingName = getGreetingName();

  const isSuperAdmin = role === 'SuperAdmin';
  const isAdmin = role === 'Admin';
  const isOrganizer = role === 'Organizer';
  const isParticipant = role === 'Participant';

  const getSubtitle = () => {
    if (isSuperAdmin) return "System Overview: Here is what is happening across all departments today.";
    if (isAdmin) return "Department Overview: Here is what is happening in your department today.";
    if (isOrganizer) return "Organizer Dashboard: Here are your scheduled meetings and attendance tasks.";
    return "Here is what is happening with your meetings today. Check your calendar for upcoming events.";
  };

  const renderDashboardContent = () => {
    if (isSuperAdmin) {
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardStats.map((stat) => (
              <DashboardCard key={stat.id} title={stat.title} value={stat.value} description={stat.description} />
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
        </>
      );
    }

    if (isAdmin) {
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardStats.map((stat) => (
              <DashboardCard key={stat.id} title={stat.title} value={stat.value} description={stat.description} />
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
        </>
      );
    }

    if (isOrganizer) {
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Organizers see fewer stats, focused on their own meetings */}
            {dashboardStats.slice(0, 2).map((stat) => (
              <DashboardCard key={stat.id} title={stat.title} value={stat.value} description={stat.description} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3 min-h-[350px]">
              <CalendarWidget />
            </div>
          </div>
          <div className="pb-8">
            <MeetingTable searchQuery={searchQuery} />
          </div>
        </>
      );
    }

    // Participant View
    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 min-h-[350px]">
            <CalendarWidget />
          </div>
        </div>
        <div className="pb-8">
          <MeetingTable searchQuery={searchQuery} />
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans transition-colors">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} userRole={role} />
      
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
                  <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back, {greetingName}! 👋</h1>
                  <p className="text-blue-100 mt-2 text-sm md:text-base">
                    {getSubtitle()}
                  </p>
                </div>
              </div>
            </header>
            
            {renderDashboardContent()}
            
          </div>
        </main>
      </div>
    </div>
  );
}
