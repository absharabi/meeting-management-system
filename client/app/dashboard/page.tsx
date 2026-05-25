"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import DashboardCard from '../../components/DashboardCard';
import DashboardChart from '../../components/DashboardChart';
import CalendarWidget from '../../components/CalendarWidget';
import MeetingTable from '../../components/MeetingTable';
import ActionCard from '../../components/ActionCard';
import ActivityLogWidget from '../../components/ActivityLogWidget';
import { superAdminStats, adminStats, userStats } from '../../data/dashboardData';
import { ShieldCheck, Download, Settings, FileText, Bell, Users, Video, CalendarPlus } from 'lucide-react';

interface User {
  name?: string;
  role?: string;
  [key: string]: any;
}

export default function DashboardPage() {
  const router = useRouter();
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

  const role = currentUser?.role || 'User';
  
  const getGreetingName = () => {
    if (role === 'SuperAdmin') return 'SuperAdmin';
    if (role === 'Admin') return 'Admin';
    return currentUser?.name ? currentUser.name.split(' ')[0] : role;
  };
  const greetingName = getGreetingName();

  const isSuperAdmin = role === 'SuperAdmin';
  const isAdmin = role === 'Admin';
  const isUser = role === 'User';

  const getSubtitle = () => {
    if (isSuperAdmin) return "System Overview: Here is what is happening across all departments today.";
    if (isAdmin) return "Department Overview: Here is what is happening in your department today.";
    return "Here is what is happening with your meetings today. Check your calendar for upcoming events.";
  };

  const renderDashboardContent = () => {
    if (isSuperAdmin) {
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {superAdminStats.map((stat) => (
              <DashboardCard key={stat.id} title={stat.title} value={stat.value} description={stat.description} />
            ))}
          </div>
          
          <div className="mt-8 mb-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">System Management</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ActionCard title="Role Assignment" description="Manage access control" icon={ShieldCheck} color="blue" onClick={() => alert('Role Assignment coming soon')} />
              <ActionCard title="System Settings" description="Configure platform" icon={Settings} color="purple" onClick={() => alert('System Settings coming soon')} />
              <ActionCard title="Audit Logs" description="View security logs" icon={FileText} color="amber" onClick={() => alert('Audit Logs coming soon')} />
              <ActionCard title="Export Reports" description="Download PDF/Excel" icon={Download} color="green" onClick={() => alert('Export Reports coming soon')} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2 min-h-[350px]">
              <DashboardChart />
            </div>
            <div className="min-h-[350px]">
              <ActivityLogWidget />
            </div>
          </div>
          <div className="py-8">
            <MeetingTable searchQuery={searchQuery} />
          </div>
        </>
      );
    }

    if (isAdmin) {
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {adminStats.map((stat) => (
              <DashboardCard key={stat.id} title={stat.title} value={stat.value} description={stat.description} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2 min-h-[350px]">
              <DashboardChart />
            </div>
            <div className="min-h-[350px]">
              <CalendarWidget />
            </div>
          </div>
          <div className="py-8">
            <MeetingTable searchQuery={searchQuery} isDepartmentAdmin={true} />
          </div>
        </>
      );
    }

    // Standard User View
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {userStats.map((stat) => (
            <DashboardCard key={stat.id} title={stat.title} value={stat.value} description={stat.description} />
          ))}
        </div>

        <div className="mt-8 mb-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ActionCard title="Schedule Meeting" description="Create a new event" icon={CalendarPlus} color="blue" onClick={() => router.push('/meetings/create')} />
            <ActionCard title="Manage Agendas" description="Attach meeting agendas" icon={FileText} color="purple" onClick={() => router.push('/meetings')} />
            <ActionCard title="Live Notifications" description="Send reminders" icon={Bell} color="amber" onClick={() => alert('Live notifications coming soon')} />
            <ActionCard title="Start Online Sync" description="Google Meet Integration" icon={Video} color="green" onClick={() => window.open('https://meet.google.com/new', '_blank')} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-3 min-h-[350px]">
            <CalendarWidget />
          </div>
        </div>
        <div className="py-8">
          {/* We pass currentUser to MeetingTable to allow it to figure out contextual actions */}
          <MeetingTable searchQuery={searchQuery} currentUser={currentUser} />
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
