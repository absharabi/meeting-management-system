"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import Sidebar from '../../../../components/Sidebar';
import MeetingForm from '../../../../components/MeetingForm';

export default function EditMeetingPage() {
  const params = useParams();
  const meetingId = params.id as string;
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Failed to fetch meetings');
        const data = await res.json();
        
        // Since we don't have a GET /:id route, we find it from the list
        const meeting = data.find((m: any) => m._id === meetingId);
        
        if (meeting) {
          if (meeting.status === 'Completed') {
            setError('Cannot edit a meeting that is already completed.');
          } else {
            setInitialData(meeting);
          }
        } else {
          setError('Meeting not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load meeting details');
      } finally {
        setIsLoading(false);
      }
    };

    if (meetingId) {
      fetchMeeting();
    }
  }, [meetingId]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans transition-colors">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar 
          onMenuClick={() => setIsSidebarOpen(true)} 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 dark:bg-gray-950/50 p-4 md:p-8">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="max-w-4xl mx-auto p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
              {error}
            </div>
          ) : (
            <MeetingForm mode="edit" initialData={initialData} />
          )}
        </main>
      </div>
    </div>
  );
}
