"use client";

import React, { useState, useEffect } from 'react';
import { Bell, UserCircle, Search, Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

interface NavbarProps {
  onMenuClick: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function Navbar({ onMenuClick, searchQuery = '', onSearchChange }: NavbarProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex justify-between items-center bg-blue-900 dark:bg-gray-950 text-white p-4 sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="md:hidden p-1 rounded-md hover:bg-blue-800 dark:hover:bg-gray-800">
          <Menu size={24} />
        </button>
        <h1 className="text-xl md:text-2xl font-bold hidden sm:block">
          Meeting Management System
        </h1>
        <h1 className="text-xl font-bold sm:hidden">MMS</h1>
      </div>
      
      <div className="flex items-center gap-4 md:gap-6">
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-lg text-sm text-gray-900 bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-48 lg:w-64 transition-all"
          />
        </div>

        {/* Theme Toggle */}
        {mounted && (
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full hover:bg-blue-800 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-full hover:bg-blue-800 dark:hover:bg-gray-800 relative transition-colors"
          >
            <Bell size={22} />
            <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-blue-900 dark:border-gray-950"></span>
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden text-gray-800 dark:text-gray-200">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold">Notifications</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="p-4 border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <p className="text-sm font-medium">Upcoming Meeting</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Design Sync in 15 mins</p>
                </div>
                <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                  <p className="text-sm font-medium">New Invite</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">You were invited to Q3 Planning</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="p-1 rounded-full hover:bg-blue-800 dark:hover:bg-gray-800 transition-colors"
          >
            <UserCircle size={28} />
          </button>
          
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden text-gray-800 dark:text-gray-200">
              <div className="py-1">
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">Profile</button>
                <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">Settings</button>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                <button className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
