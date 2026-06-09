"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { Download, Calendar, Clock, MapPin, CheckCircle, FileText, Search } from 'lucide-react';
import { exportMomPdf, readJsonResponse } from '@/utils/pdfExport';

interface Meeting {
  _id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  mode: string;
  status: string;
  momStatus: string;
  organizerId: any;
}

export default function MomArchive() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfirmedMoms();
  }, []);

  const fetchConfirmedMoms = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/');
        return;
      }
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const currentUserId = currentUser?.id || currentUser?._id;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings?momStatus=Confirmed&status=Completed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        // Strictly filter to only meetings where the user actively participated (organizer or attended), unless they are an admin
        const participatedData = data.filter((meeting: any) => {
          if (!currentUserId) return false;
          if (currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin') return true;
          
          const isOrganizer = meeting.organizerId === currentUserId || meeting.organizerId?._id === currentUserId;
          const isAttended = meeting.attendance?.some((a: any) => a === currentUserId || a?._id === currentUserId);
          return isOrganizer || isAttended;
        });

        // Sort descending by date
        const sorted = participatedData.sort((a: Meeting, b: Meeting) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMeetings(sorted);
      }
    } catch (error) {
      console.error('Failed to fetch MoMs:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadMom = async (meetingId: string, title: string) => {
    try {
      setDownloadingId(meetingId);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/mom`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch MoM details');
      }

      const meetingData = await readJsonResponse(response);
      if (!meetingData) throw new Error("The server returned an empty MoM response.");

      await exportMomPdf(meetingData);

    } catch (error) {
      console.error('Error downloading MoM:', error);
      alert('Failed to download MoM. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Group meetings by month/year
  const groupedMeetings = meetings.reduce((acc, meeting) => {
    const d = new Date(meeting.date);
    const key = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(meeting);
    return acc;
  }, {} as Record<string, Meeting[]>);

  // Filter by search
  const filteredKeys = Object.keys(groupedMeetings).filter(key => {
    return groupedMeetings[key].some(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <FileText className="text-blue-600 dark:text-blue-400" size={32} />
                  Minutes of Meeting Archive
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                  Access and download all confirmed MoMs from your participated meetings.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : meetings.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="bg-blue-50 dark:bg-blue-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="text-blue-500 dark:text-blue-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No MoMs Found</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  You don't have any meetings with confirmed Minutes of Meeting yet. Once a meeting is completed and its MoM is approved, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {filteredKeys.map(monthYear => (
                  <div key={monthYear} className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {monthYear}
                      <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-sm font-medium px-2.5 py-0.5 rounded-full">
                        {groupedMeetings[monthYear].filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase())).length}
                      </span>
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {groupedMeetings[monthYear]
                        .filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(meeting => (
                        <div key={meeting._id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group">
                          
                          {/* Card Header */}
                          <div className="p-6 border-b border-gray-50 dark:border-gray-700/50">
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">
                                {meeting.title}
                              </h3>
                              <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-1.5 rounded-lg flex-shrink-0">
                                <CheckCircle size={20} />
                              </div>
                            </div>
                            
                            {/* Details List */}
                            <div className="space-y-2.5">
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                <Calendar size={16} className="text-gray-400 mr-3 flex-shrink-0" />
                                {new Date(meeting.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                <Clock size={16} className="text-gray-400 mr-3 flex-shrink-0" />
                                {meeting.startTime} - {meeting.endTime || 'Ongoing'}
                              </div>
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                <MapPin size={16} className="text-gray-400 mr-3 flex-shrink-0" />
                                <span className="truncate">{meeting.venue || meeting.mode}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Card Footer */}
                          <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50">
                            <button
                              onClick={() => downloadMom(meeting._id, meeting.title)}
                              disabled={downloadingId === meeting._id}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium transition-all duration-200 ${
                                downloadingId === meeting._id 
                                ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow active:scale-[0.98]'
                              }`}
                            >
                              {downloadingId === meeting._id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                  Downloading...
                                </>
                              ) : (
                                <>
                                  <Download size={18} />
                                  Download MoM
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
          </div>
        </main>
      </div>
    </div>
  );
}
