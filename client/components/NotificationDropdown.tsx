import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

interface Notification {
  _id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const audioCtx = new AudioContext();
      const t = audioCtx.currentTime;
      // Helper function to play a single rich "glass/marimba" strike
      const playTone = (freq: number, startTime: number) => {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator(); // Harmonic for richness
        const gainNode = audioCtx.createGain();
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);
        
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 1.5, startTime); // 5th harmonic for metallic/glass feel
        
        // Fast attack, exponential decay for that iOS feel
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        
        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + 0.4);
        osc2.stop(startTime + 0.4);
      };

      // Single crisp, rich notification tone (D6)
      playTone(1174.66, t);
    } catch (e) {
      console.log('Audio playback failed', e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Get user ID from token
    let currentUserId = '';
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));
        currentUserId = payload.id;
      } catch (e) {
        console.error('Failed to parse token');
      }
    }
    
    // Initialize socket connection
    const socket = io(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`, {
      withCredentials: true
    });

    // Register user ID every time the socket connects (handles server restarts)
    socket.on('connect', () => {
      socket.emit('register', currentUserId);
    });

    // Listen for incoming notifications
    socket.on('new_notification', (notification) => {
      
      // Play the notification sound
      playNotificationSound();

      // Show attractive toast popup based on type
      if (notification.type === 'Meeting Cancelled') {
        toast.error(notification.message, {
          style: {
            border: '1px solid #7f1d1d',
            padding: '16px',
          }
        });
      } else if (notification.type === 'Meeting Created' || notification.type === 'Meeting Updated') {
        toast.success(notification.message, {
          style: {
            border: '1px solid #14532d',
            padding: '16px',
          }
        });
      } else {
        toast(notification.message, {
          icon: '✨',
          style: {
            border: '1px solid #1e3a8a',
            padding: '16px',
          }
        });
      }
      
      // Add new notification to the top of the list instantly
      setNotifications(prev => [notification, ...prev]);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/${id}/read`, { 
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/read-all`, { 
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/notifications/${id}`, { 
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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
      setIsOpen(false);
      router.push(notification.actionUrl);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-blue-800 dark:hover:bg-gray-800 relative transition-colors"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-blue-900 dark:border-gray-950"></span>
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden text-gray-800 dark:text-gray-200 z-50">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
              >
                <Check size={14} /> Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center">
                <Bell size={32} className="mb-2 opacity-20" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div 
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-gray-50 dark:border-gray-700/50 cursor-pointer transition-colors relative group ${
                    notification.isRead ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                >
                  <div className="flex justify-between items-start pr-6">
                    <p className={`text-sm ${notification.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white font-semibold'}`}>
                      {notification.message}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                      {notification.type}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(notification.createdAt)}</p>
                  </div>
                  
                  {/* Delete Button (visible on hover) */}
                  <button 
                    onClick={(e) => deleteNotification(notification._id, e)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete notification"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
          
          <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-center">
            <Link 
              href="/notifications" 
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1"
            >
              View all notifications <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
