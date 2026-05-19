import React from 'react';
import { MoreHorizontal } from 'lucide-react';

const meetings = [
  { id: 1, title: 'Project Kickoff', date: 'Oct 24', time: '10:00 AM', participants: 5, status: 'Completed' },
  { id: 2, title: 'Design Review', date: 'Oct 25', time: '2:30 PM', participants: 3, status: 'Upcoming' },
  { id: 3, title: 'Weekly Sync', date: 'Oct 26', time: '1:00 PM', participants: 8, status: 'Upcoming' },
  { id: 4, title: 'Client Presentation', date: 'Oct 28', time: '11:00 AM', participants: 4, status: 'Upcoming' },
];

interface MeetingTableProps {
  searchQuery?: string;
}

export default function MeetingTable({ searchQuery = '' }: MeetingTableProps) {
  const filteredMeetings = meetings.filter(meeting => 
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent & Upcoming Meetings</h2>
        <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700">View All</button>
      </div>
      <div className="overflow-x-auto">
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
              <tr key={meeting.id} className="bg-white dark:bg-gray-800 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {meeting.title}
                </td>
                <td className="px-6 py-4">
                  {meeting.date} at {meeting.time}
                </td>
                <td className="px-6 py-4">
                  <div className="flex -space-x-2">
                    {[...Array(Math.min(meeting.participants, 3))].map((_, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs text-blue-700 dark:text-blue-300 font-medium z-10">
                        {String.fromCharCode(65 + i)}
                      </div>
                    ))}
                    {meeting.participants > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300 font-medium z-0">
                        +{meeting.participants - 3}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    meeting.status === 'Completed' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {meeting.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
