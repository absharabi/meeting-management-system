"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, ArrowRight, Calendar, Users, BarChart3 } from 'lucide-react';

export default function WelcomePage() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
    } else {
      setMounted(true);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center p-6 lg:px-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Calendar className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">NITC MMS</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {mounted && (
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          )}
          <Link 
            href="/login"
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
          >
            Log In <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-5xl mx-auto w-full">
        <div className="space-y-6 mb-16 mt-8">
          <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
            Manage Campus Meetings <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
              With Elegance
            </span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed mt-6">
            A centralized digital platform for NIT Calicut to seamlessly schedule, manage, and track meetings, agendas, participants, <br className="hidden md:block" /> and institutional workflows.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto pb-12">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mb-4">
              <Calendar className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Academic Scheduling</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Effortlessly manage department meetings and academic council discussions.</p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center mb-4">
              <Users className="text-purple-600 dark:text-purple-400" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Faculty Collaboration</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Seamlessly coordinate across various departments, committees, and administrative bodies.</p>
          </div>

          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300">
            <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/40 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="text-cyan-600 dark:text-cyan-400" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Campus Analytics</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Gain insights into campus-wide meeting trends and optimize resource allocation.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm border-t border-gray-200/50 dark:border-gray-800/50">
        © {new Date().getFullYear()} NIT Calicut Meeting Management System. All rights reserved.
      </footer>
    </div>
  );
}
