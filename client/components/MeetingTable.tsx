import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Edit, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Meeting {
  _id: string;
  title: string;
  date: string;
  startTime: string;
  status: string;
  participants: User[];
}

interface MeetingTableProps {
  searchQuery?: string;
  isParticipant?: boolean;
  isOrganizer?: boolean;
  isDepartmentAdmin?: boolean;
}

export default function MeetingTable({ 
  searchQuery = '', 
  isParticipant = false, 
  isOrganizer = false, 
  isDepartmentAdmin = false 
}: MeetingTableProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('http://localhost:5000/api/meetings');
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (error) {
      console.error('Failed to fetch meetings', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/meetings/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMeetings(prev => prev.filter(m => m._id !== id));
      } else {
        alert('Failed to delete meeting');
      }
    } catch (error) {
      console.error('Failed to delete', error);
    }
  };

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || meeting.status === statusFilter;
    // Basic date filtering logic could be added here
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent & Upcoming Meetings</h2>
          
          {/* Advanced Search Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <option value="All">Any Date</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="Next Week">Next Week</option>
            </select>
            {isDepartmentAdmin && (
              <select className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 transition-colors">
                <option value="All">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="HR">HR</option>
                <option value="Marketing">Marketing</option>
              </select>
            )}
            <button 
              onClick={fetchMeetings}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 px-4 py-2 border border-blue-200 dark:border-blue-900/50 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto min-h-[300px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
            <p>No meetings found.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th scope="col" className="px-6 py-4">Title</th>
                <th scope="col" className="px-6 py-4">Date & Time</th>
                <th scope="col" className="px-6 py-4">Participants</th>
                <th scope="col" className="px-6 py-4">Status</th>
                <th scope="col" className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMeetings.map((meeting) => (
                <tr key={meeting._id} className="bg-white dark:bg-gray-800 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {meeting.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {meeting.date ? format(new Date(meeting.date), 'MMM dd, yyyy') : 'No Date'} at {meeting.startTime || 'TBD'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-2">
                      {meeting.participants?.slice(0, 3).map((user, i) => (
                        <div key={user._id} title={user.name} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs text-blue-700 dark:text-blue-300 font-medium z-10">
                          {user.name.charAt(0)}
                        </div>
                      ))}
                      {meeting.participants?.length > 3 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300 font-medium z-0">
                          +{meeting.participants.length - 3}
                        </div>
                      )}
                      {(!meeting.participants || meeting.participants.length === 0) && (
                        <span className="text-gray-400">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {/* Dynamic Animated Status Badges */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm border ${
                      meeting.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' : 
                      meeting.status === 'Ongoing' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' :
                      meeting.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' :
                      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                    }`}>
                      {meeting.status === 'Ongoing' && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                      )}
                      {meeting.status === 'Scheduled' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>}
                      {meeting.status === 'Completed' && <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>}
                      {meeting.status === 'Cancelled' && <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>}
                      {meeting.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button 
                      onClick={() => setOpenDropdownId(openDropdownId === meeting._id ? null : meeting._id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openDropdownId === meeting._id && (
                      <div className="absolute right-6 mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                        <div className="py-1">
                          <button 
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left"
                            onClick={() => setOpenDropdownId(null)}
                          >
                            <ExternalLink size={14} /> View Details
                          </button>

                          {isParticipant && (
                            <>
                              <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                              <button className="flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 w-full text-left">
                                Accept Invitation
                              </button>
                              <button className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left">
                                Reject
                              </button>
                            </>
                          )}

                          {isOrganizer && (
                            <>
                              <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                              <button className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 w-full text-left">
                                Mark Attendance
                              </button>
                              <button className="flex items-center gap-2 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 w-full text-left">
                                Upload Documents
                              </button>
                            </>
                          )}

                          {(!isParticipant) && (
                            <>
                              <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                              <Link 
                                href={`/meetings/${meeting._id}/edit`}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 w-full text-left"
                                onClick={() => setOpenDropdownId(null)}
                              >
                                <Edit size={14} /> Edit
                              </Link>
                              <button 
                                onClick={() => { setOpenDropdownId(null); handleDelete(meeting._id); }}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
