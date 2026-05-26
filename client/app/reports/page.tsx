"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { Download, FileText, Calendar as CalendarIcon, BarChart3, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface User {
  id?: string;
  name?: string;
  role?: string;
  [key: string]: any;
}

export default function ReportsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'date' | 'year' | 'meeting'>('date');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Date-wise state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateReports, setDateReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Year-wise state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [yearlyData, setYearlyData] = useState<any[]>([]);

  // Meeting-wise state
  const [meetingIdInput, setMeetingIdInput] = useState('');
  const [meetingReport, setMeetingReport] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) setCurrentUser(JSON.parse(userStr));
  }, []);

  const isAdminOrSuper = currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin';

  const fetchDateWiseReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`http://localhost:5000/api/reports/date-wise?startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch or unauthorized');
      const data = await res.json();
      setDateReports(data);
      toast.success('Report generated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Error fetching report');
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlyReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`http://localhost:5000/api/reports/yearly?year=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch or unauthorized');
      const data = await res.json();
      setYearlyData(data);
    } catch (err: any) {
      toast.error(err.message || 'Error fetching yearly report');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingReport = async () => {
    if (!meetingIdInput) {
      toast.error('Please enter a Meeting ID');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`http://localhost:5000/api/reports/meeting/${meetingIdInput.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Access denied or meeting not found');
      }
      const data = await res.json();
      setMeetingReport(data);
      toast.success('Meeting details loaded');
    } catch (err: any) {
      toast.error(err.message || 'Error fetching meeting report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'year') {
      fetchYearlyReport();
    }
  }, [activeTab, selectedYear]);

  const exportPDF = () => {
    const doc = new jsPDF();
    
    if (activeTab === 'date') {
      doc.setFontSize(20);
      doc.setTextColor(37, 99, 235);
      doc.text('Date-Wise Meeting Report', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
      
      const tableColumn = ["Date", "Title", "Type", "Status", "Organizer"];
      const tableRows = dateReports.map(m => [
        new Date(m.date).toLocaleDateString(),
        m.title,
        m.meetingType,
        m.status,
        m.organizerId?.name || 'N/A'
      ]);
      
      autoTable(doc, { 
        head: [tableColumn], 
        body: tableRows, 
        startY: 35,
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      
      doc.save(`Report_${activeTab}_${new Date().getTime()}.pdf`);

    } else if (activeTab === 'meeting' && meetingReport) {
      const { meeting, metrics, agendas } = meetingReport;
      
      // 1. Header
      doc.setFontSize(24);
      doc.setTextColor(31, 41, 55);
      doc.text('Official Meeting Report', 14, 22);
      
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235);
      doc.text(meeting.title, 14, 32);

      // 2. Overview Table
      autoTable(doc, {
        startY: 40,
        head: [['Meeting Details', '']],
        body: [
          ['Date', new Date(meeting.date).toLocaleDateString()],
          ['Time', `${meeting.startTime} - ${meeting.endTime}`],
          ['Type', meeting.meetingType],
          ['Mode / Venue', meeting.venue || meeting.link || meeting.mode],
          ['Organizer', meeting.organizerId?.name || 'Unknown'],
          ['Status', meeting.status]
        ],
        theme: 'grid',
        headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        margin: { bottom: 10 }
      });
      
      // 3. Participants & Attendance Status
      const finalY1 = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text(`Participants (${metrics.totalAttended} / ${metrics.totalParticipants} Attended)`, 14, finalY1);
      
      const attendedIds = new Set(meeting.attendance.map((u: any) => u._id));
      const participantRows = meeting.participants.map((p: any, i: number) => {
        const u = p.user;
        const isAttended = attendedIds.has(u?._id) ? 'Present' : 'Absent';
        return [i + 1, u?.name || 'Unknown', u?.email || 'N/A', p.status, isAttended];
      });

      autoTable(doc, {
        startY: finalY1 + 5,
        head: [['#', 'Name', 'Email', 'RSVP', 'Attendance']],
        body: participantRows.length > 0 ? participantRows : [['-', 'No participants', '-', '-', '-']],
        headStyles: { fillColor: [16, 185, 129], textColor: 255 }, 
      });

      // 4. Agendas
      const finalY2 = (doc as any).lastAutoTable.finalY + 15;
      doc.text('Agenda / Topics Discussed', 14, finalY2);
      
      const agendaRows = agendas.map((a: any, i: number) => [
        i + 1,
        a.title,
        `${a.timeAllocated} mins`,
        a.status
      ]);
      autoTable(doc, {
        startY: finalY2 + 5,
        head: [['#', 'Topic', 'Duration', 'Status']],
        body: agendaRows.length > 0 ? agendaRows : [['-', 'No agenda items', '-', '-']],
        headStyles: { fillColor: [99, 102, 241], textColor: 255 },
      });

      // 5. Discussion Summary & Notes
      let currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      
      doc.text('Discussion Summary & Notes', 14, currentY);
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text('(Document actual discussion notes here)', 14, currentY + 7);
      
      autoTable(doc, {
        startY: currentY + 10,
        body: [['\n\n\n\n']], // Placeholder box
        theme: 'grid',
        styles: { minCellHeight: 40 }
      });

      // 6. Decisions Taken
      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text('Decisions Taken', 14, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['#', 'Decision']],
        body: [['1', ''], ['2', ''], ['3', '']],
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: 255 },
      });

      // 7. Action Items / Tasks
      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 230) { doc.addPage(); currentY = 20; }
      doc.text('Action Items & Tasks', 14, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Task Description', 'Assigned To', 'Deadline', 'Status']],
        body: [['', '', '', ''], ['', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      });

      // 8. Attachments & Next Meeting
      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.text(`Attachments: ${meeting.offlineReportFileUrl ? 'Offline report attached.' : 'None'}`, 14, currentY);
      doc.text('Next Meeting Date: _______________________', 14, currentY + 8);

      // 9. Signatures
      currentY = currentY + 30;
      if (currentY > 270) { doc.addPage(); currentY = 40; }
      
      doc.line(14, currentY, 74, currentY);
      doc.line(130, currentY, 190, currentY);
      doc.text('Organizer Signature', 14, currentY + 6);
      doc.text('Approver Signature', 130, currentY + 6);

      doc.save(`Report_${meeting.title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
    }
  };

  const exportExcel = () => {
    let ws: XLSX.WorkSheet;
    if (activeTab === 'date') {
      const data = dateReports.map(m => ({
        Date: new Date(m.date).toLocaleDateString(),
        Title: m.title,
        Type: m.meetingType,
        Status: m.status,
        Organizer: m.organizerId?.name || 'N/A'
      }));
      ws = XLSX.utils.json_to_sheet(data);
    } else {
      ws = XLSX.utils.json_to_sheet([{ message: 'Excel export for this tab coming soon' }]);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `report_${activeTab}.xlsx`);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} userRole={currentUser?.role} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} searchQuery="" onSearchChange={() => {}} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end border-b border-gray-200 dark:border-gray-800 pb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
                <p className="text-gray-500 mt-1">Generate and export meeting data.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 font-medium transition-colors">
                  <FileText size={18} /> PDF
                </button>
                <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 font-medium transition-colors">
                  <Download size={18} /> Excel
                </button>
              </div>
            </div>

            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-xl w-fit">
              <button onClick={() => setActiveTab('date')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'date' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-900'}`}>
                <CalendarIcon size={16} className="inline mr-2 mb-0.5" /> Date-Wise
              </button>
              <button onClick={() => setActiveTab('year')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'year' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-900'}`}>
                <BarChart3 size={16} className="inline mr-2 mb-0.5" /> Year-Wise
              </button>
              <button onClick={() => setActiveTab('meeting')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'meeting' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-gray-900'}`}>
                <Search size={16} className="inline mr-2 mb-0.5" /> Meeting-Wise
              </button>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
              
              {activeTab === 'date' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2" />
                    </div>
                    <button onClick={fetchDateWiseReport} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                      {loading ? 'Loading...' : 'Generate'}
                    </button>
                  </div>

                  {dateReports.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 mt-6">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organizer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                          {dateReports.map((meeting) => (
                            <tr key={meeting._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{new Date(meeting.date).toLocaleDateString()}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{meeting.title}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{meeting.meetingType}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{meeting.organizerId?.name || 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  meeting.status === 'Completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  meeting.status === 'Scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                }`}>
                                  {meeting.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'year' && (
                <div className="space-y-6">
                  <div className="flex gap-4 items-end max-w-sm">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Year</label>
                      <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="h-96 w-full mt-8">
                    {loading ? (
                      <div className="flex h-full items-center justify-center text-gray-500">Loading chart...</div>
                    ) : yearlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yearlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                          <XAxis dataKey="name" stroke="#6B7280" />
                          <YAxis stroke="#6B7280" />
                          <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Legend />
                          <Bar dataKey="Normal Meeting" stackId="a" fill="#3B82F6" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Board Meeting" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Department Meeting" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-500">No data for this year</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'meeting' && (
                <div className="space-y-6">
                  <div className="flex gap-4 items-end max-w-lg">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting ID</label>
                      <input type="text" placeholder="Enter MongoDB ObjectId" value={meetingIdInput} onChange={(e) => setMeetingIdInput(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 font-mono text-sm" />
                    </div>
                    <button onClick={fetchMeetingReport} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  {meetingReport && (
                    <div className="mt-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-6 border border-blue-100 dark:border-blue-900/30">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{meetingReport.meeting.title}</h2>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div><p className="text-xs text-gray-500 uppercase tracking-wider">Date</p><p className="font-medium text-gray-900 dark:text-gray-100">{new Date(meetingReport.meeting.date).toLocaleDateString()}</p></div>
                        <div><p className="text-xs text-gray-500 uppercase tracking-wider">Time</p><p className="font-medium text-gray-900 dark:text-gray-100">{meetingReport.meeting.startTime} - {meetingReport.meeting.endTime}</p></div>
                        <div><p className="text-xs text-gray-500 uppercase tracking-wider">Attendance Rate</p><p className="font-medium text-green-600">{meetingReport.metrics.attendancePercentage}%</p></div>
                        <div><p className="text-xs text-gray-500 uppercase tracking-wider">Organizer</p><p className="font-medium text-gray-900 dark:text-gray-100">{meetingReport.meeting.organizerId?.name}</p></div>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 mt-6 border-b border-gray-200 dark:border-gray-800 pb-2">Attendees ({meetingReport.metrics.totalAttended}/{meetingReport.metrics.totalParticipants})</h3>
                      <div className="flex flex-wrap gap-2">
                        {meetingReport.meeting.attendance.map((user: any) => (
                          <span key={user._id} className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            {user.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
