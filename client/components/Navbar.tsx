"use client";

import React, { useState, useEffect } from 'react';
import { UserCircle, Search, Menu, Sun, Moon, Shield, Star } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface NavbarProps {
  onMenuClick: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function Navbar({ onMenuClick, searchQuery = '', onSearchChange }: NavbarProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-change'));
    router.push('/');
  };

  useEffect(() => {
    setMounted(true);
    const loadUser = () => {
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    loadUser();
    window.addEventListener('auth-change', loadUser);
    return () => window.removeEventListener('auth-change', loadUser);
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
        <NotificationDropdown />

        {/* Profile Dropdown */}
        <div className="relative flex items-center gap-3">
          {currentUser && (
            <div className="hidden md:flex flex-col items-end mr-1">
              <span className="text-sm font-bold text-white tracking-wide">{currentUser.name || 'User'}</span>
              <span className="text-xs text-blue-200 dark:text-gray-400 font-mono">{currentUser.email}</span>
            </div>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="p-1 rounded-full hover:bg-blue-800 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
            >
            {currentUser ? (
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm border border-white/20" title={currentUser.email}>
                  {currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U'}
                </div>
                
                {/* Role Badges */}
                {currentUser.role === 'SuperAdmin' && (
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-0.5 border-2 border-blue-900 dark:border-gray-950 shadow-sm" title="Super Admin">
                    <Shield size={10} className="text-white" />
                  </div>
                )}
                {currentUser.role === 'Admin' && (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-blue-900 dark:border-gray-950 shadow-sm" title="Admin">
                    <Star size={10} className="text-white" />
                  </div>
                )}
              </div>
            ) : (
              <UserCircle size={28} />
            )}
          </button>
          
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden text-gray-800 dark:text-gray-200">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-1 md:hidden">
                    <p className="text-sm font-bold truncate">{currentUser?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
                  </div>
                  <Link href="/settings" className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">Profile</Link>
                  <Link href="/settings" className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">Settings</Link>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Logout</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
