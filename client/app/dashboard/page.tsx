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
import { ShieldCheck, Download, Settings, FileText, Bell, Video, CalendarPlus } from 'lucide-react';

interface User {
  name?: string;
  role?: string;
  [key: string]: any;
}

interface DashboardStat {
  id: number;
  title: string;
  value: string | number;
  description?: string;
}

interface DashboardSummary {
  stats: DashboardStat[];
  chartData: { name: string; meetings: number }[];
  calendarMeetings: { id: string; title: string; date: string; status: string }[];
  activityLogs: { id: string; action: string; details: string; time: string; type: string }[];
}

const emptyDashboard: DashboardSummary = {
  stats: [],
  chartData: [],
  calendarMeetings: [],
  activityLogs: [],
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function DashboardPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardSummary>(emptyDashboard);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

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
      window.dispatchEvent(new Event('auth-change'));
    }

    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to parse user', e);
    }
    
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const loadDashboard = async () => {
      setIsDashboardLoading(true);
      setDashboardError('');
      try {
        const response = await fetch('http://localhost:5000/api/dashboard/summary', {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load dashboard data.');
        setDashboard(data);
      } catch (error) {
        setDashboard(emptyDashboard);
        setDashboardError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      } finally {
        setIsDashboardLoading(false);
      }
    };

    loadDashboard();
  }, [isMounted]);

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
    if (isDashboardLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800" />
          ))}
        </div>
      );
    }

    if (dashboardError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {dashboardError}
        </div>
      );
    }

    if (isSuperAdmin) {
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {dashboard.stats.map((stat) => (
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
              <DashboardChart data={dashboard.chartData} />
            </div>
            <div className="min-h-[350px]">
              <ActivityLogWidget logs={dashboard.activityLogs} />
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
            {dashboard.stats.map((stat) => (
              <DashboardCard key={stat.id} title={stat.title} value={stat.value} description={stat.description} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2 min-h-[350px]">
              <DashboardChart data={dashboard.chartData} />
            </div>
            <div className="min-h-[350px]">
              <CalendarWidget meetings={dashboard.calendarMeetings} />
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
          {dashboard.stats.map((stat) => (
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
            <CalendarWidget meetings={dashboard.calendarMeetings} />
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
          {!isMounted ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
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
          )}
        </main>
      </div>
    </div>
  );
}
