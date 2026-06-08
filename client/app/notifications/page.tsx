"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { Bell, Check, Trash2, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Notification {
  _id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

export default function NotificationsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/read-all`, { method: 'PUT' });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const clearAllNotifications = async () => {
    if (!confirm('Are you sure you want to clear all notifications?')) return;
    try {
      await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/clear-all`, { method: 'DELETE' });
      setNotifications([]);
    } catch (error) {
      console.error('Failed to clear all notifications', error);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/${id}`, { method: 'DELETE' });
      setNotifications(notifications.filter(n => n._id !== id));
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans transition-colors">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 dark:bg-gray-950/50 p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                  <Bell className="text-blue-600 dark:text-blue-400" /> Notifications
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage your recent activity and alerts.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button 
                  onClick={markAllAsRead}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                  <Check size={16} /> Mark all read
                </button>
                <button 
                  onClick={clearAllNotifications}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 text-sm font-medium rounded-xl shadow-sm transition-all flex items-center gap-2"
                >
                  <Trash2 size={16} /> Clear all
                </button>
              </div>
            </header>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
              {isLoading ? (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
                  <Bell size={48} className="mb-4 opacity-20" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">You're all caught up!</h3>
                  <p className="mt-1">No notifications to show right now.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {notifications.map((notification) => (
                    <div 
                      key={notification._id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-6 transition-colors relative group cursor-pointer ${
                        notification.isRead ? 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50' : 'bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${notification.isRead ? 'bg-transparent' : 'bg-blue-600 dark:bg-blue-400'}`}></div>
                        <div className="flex-1 pr-10">
                          <p className={`text-base ${notification.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white font-medium'}`}>
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(notification.createdAt).toLocaleDateString()} at {new Date(notification.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-xs font-medium">{notification.type}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={(e) => deleteNotification(notification._id, e)}
                        className="absolute top-1/2 -translate-y-1/2 right-6 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete notification"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}
