"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { Bell, BellOff, Calendar, Save, User, Briefcase } from 'lucide-react';

const getAuthHeaders = (includeContentType = false): Record<string, string> => {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {};

  if (includeContentType) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
};

export default function SettingsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');
  
  const [profile, setProfile] = useState({
    name: '',
    department: '',
    email: ''
  });

  const [preferences, setPreferences] = useState({
    enabled: true,
    meetingUpdates: true,
    reminders: true,
    agendaUpdates: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    const fetchPreferences = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/users/me', {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const user = await res.json();
          if (!isActive) return;

          setProfile({ name: user.name || '', department: user.department || '', email: user.email || '' });
          if (user.notificationPreferences) {
            setPreferences(user.notificationPreferences);
          }
        }
      } catch (error) {
        console.error('Failed to fetch preferences', error);
      }
    };

    void fetchPreferences();
    return () => {
      isActive = false;
    };
  }, []);

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const res = await fetch('http://localhost:5000/api/users/me', {
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

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const res = await fetch('http://localhost:5000/api/users/preferences', {
        method: 'PUT',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ notificationPreferences: preferences })
      });
      
      if (res.ok) {
        setMessage('Preferences saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error(error);
      setMessage('Error saving preferences');
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
            
            <header className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account preferences and notification settings.</p>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Edit Profile
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'notifications'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Notifications
              </button>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              
              {activeTab === 'profile' && (
                <>
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
                </>
              )}

              {activeTab === 'notifications' && (
                <>
                  <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Bell className="text-blue-500" /> Notification Preferences
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Control which alerts you receive in the app.</p>
                  </div>

              <div className="p-6 space-y-6">
                
                {/* Master Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Enable All Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Master switch to turn off all alerts</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={preferences.enabled} onChange={() => handleToggle('enabled')} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className={`space-y-4 ${!preferences.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex gap-3">
                      <div className="mt-1 text-blue-500"><Calendar size={20} /></div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Meeting Updates</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when a meeting is created, updated, or cancelled.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={preferences.meetingUpdates} onChange={() => handleToggle('meetingUpdates')} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex gap-3">
                      <div className="mt-1 text-orange-500"><Bell size={20} /></div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Reminders</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Automated reminders before a meeting starts.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={preferences.reminders} onChange={() => handleToggle('reminders')} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex gap-3">
                      <div className="mt-1 text-green-500"><BellOff size={20} /></div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Agenda Updates</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when agendas are proposed or approved.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={preferences.agendaUpdates} onChange={() => handleToggle('agendaUpdates')} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                </div>

                <div className="pt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
                  <div className="text-sm font-medium text-green-600">
                    {message}
                  </div>
                  <button 
                    onClick={handleSavePreferences}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Save size={18} /> {isSaving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>

              </div>
              </>
            )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
