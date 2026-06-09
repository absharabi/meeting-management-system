"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { Save, User, Briefcase } from 'lucide-react';

const getAuthHeaders = (includeContentType = false): Record<string, string> => {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {};

  if (includeContentType) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
};

export default function ProfilePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [profile, setProfile] = useState({
    name: '',
    department: '',
    email: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    const fetchPreferences = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/me`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const user = await res.json();
          if (!isActive) return;

          setProfile({ name: user.name || '', department: user.department || '', email: user.email || '' });
        }
      } catch (error) {
        console.error('Failed to fetch profile', error);
      }
    };

    void fetchPreferences();
    return () => {
      isActive = false;
    };
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/me`, {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ name: profile.name, department: profile.department })
      });
      if (res.ok) {
        const user = await res.json();
        localStorage.setItem('user', JSON.stringify(user));
        window.dispatchEvent(new Event('auth-change'));
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error(error);
      setMessage('Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans transition-colors">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 dark:bg-gray-950/50 p-4 md:p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            
            <header className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Profile</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account profile and personal information.</p>
            </header>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <User className="text-blue-500" /> Account Profile
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update your personal information.</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      value={profile.name}
                      onChange={(e) => setProfile({...profile, name: e.target.value})}
                      className="w-full px-4 py-2 border rounded-xl dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address (Read-only)</label>
                    <input 
                      type="email" 
                      value={profile.email}
                      readOnly
                      className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:border-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                      <Briefcase size={16} className="text-gray-400" /> Department / Job Title
                    </label>
                    <input 
                      type="text" 
                      value={profile.department}
                      onChange={(e) => setProfile({...profile, department: e.target.value})}
                      className="w-full px-4 py-2 border rounded-xl dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="e.g. Engineering, Marketing, CEO"
                    />
                  </div>
                </div>
                <div className="pt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
                  <div className="text-sm font-medium text-green-600">{message}</div>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Save size={18} /> {isSaving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
