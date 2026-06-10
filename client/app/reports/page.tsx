"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  
  // Helper to strip HTML tags from rich text
  const stripHtml = (html: string) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };
  
  // Helper to get Base64 of Logo
  const getLogoBase64 = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(''); // Silent fail, returns empty
      img.src = url;
    });
  };

  // Helper to generate Donut Chart
  const generateDonutChartBase64 = (attended: number, total: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const missed = total - attended;
    const attendedAngle = total === 0 ? 0 : (attended / total) * 2 * Math.PI;

    ctx.clearRect(0, 0, 160, 160);

    // Background (missed) - Red
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(80, 80);
    ctx.arc(80, 80, 70, 0, 2 * Math.PI);
    ctx.fill();

    // Attended - Green
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(80, 80);
    ctx.arc(80, 80, 70, -0.5 * Math.PI, attendedAngle - 0.5 * Math.PI);
    ctx.fill();

    // Donut hole
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(80, 80, 45, 0, 2 * Math.PI);
    ctx.fill();

    // Text inside donut
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const percentage = total === 0 ? 0 : Math.round((attended / total) * 100);
    ctx.fillText(`${percentage}%`, 80, 80);

    return canvas.toDataURL('image/png');
  };
  
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
  
  // Autocomplete State
  const [meetingSuggestions, setMeetingSuggestions] = useState<any[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for suggestions
  useEffect(() => {
    if (!meetingIdInput.trim()) {
      setMeetingSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings?keyword=${meetingIdInput}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Adjust data based on API response structure. The controller returns { meetings: ... } or just array.
          setMeetingSuggestions(data.meetings || data || []);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [meetingIdInput]);

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
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/reports/date-wise?startDate=${startDate}&endDate=${endDate}${searchQuery ? `&keyword=${encodeURIComponent(searchQuery)}` : ''}`;
      const res = await fetch(url, {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/reports/yearly?year=${selectedYear}`, {
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

  const fetchMeetingReport = async (identifier = meetingIdInput) => {
    if (!identifier) {
      toast.error('Please enter a Meeting Name or ID');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/reports/meeting/${encodeURIComponent(identifier.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Access denied or meeting not found');
      }
      const data = await res.json();
      setMeetingReport(data);
      toast.success('Meeting details loaded');
      setShowSuggestions(false); // Hide suggestions after selection
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

  const exportPDF = async () => {
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
      
      doc.save(`Report_${activeTab}.pdf`);

    } else if (activeTab === 'meeting' && meetingReport) {
      const { meeting, metrics, agendas, actionItems } = meetingReport;
      
      const themePrimary: [number, number, number] = [15, 23, 42]; // Navy Blue
      const themeSecondary: [number, number, number] = [71, 85, 105]; // Slate Gray
      
      // 1. Header Area
      doc.setFillColor(themePrimary[0], themePrimary[1], themePrimary[2]);
      doc.rect(0, 0, 210, 30, 'F');
      
      const logoBase64 = await getLogoBase64('/logo.png');
      if (logoBase64) {
        // Adjust width/height preserving aspect ratio. 
        // 20x20 is a good square fit.
        doc.addImage(logoBase64, 'PNG', 14, 5, 20, 20);
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text('OFFICIAL MEETING REPORT', 38, 16);
        doc.setFontSize(10);
        doc.setTextColor(200, 200, 200);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 38, 24);
      } else {
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text('OFFICIAL MEETING REPORT', 14, 16);
        doc.setFontSize(10);
        doc.setTextColor(200, 200, 200);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 24);
      }

      // 2. Meeting Title
      doc.setFontSize(16);
      doc.setTextColor(themePrimary[0], themePrimary[1], themePrimary[2]);
      doc.text(meeting.title, 14, 40);
      if (meeting.description) {
        doc.setFontSize(10);
        doc.setTextColor(themeSecondary[0], themeSecondary[1], themeSecondary[2]);
        doc.text(stripHtml(meeting.description), 14, 47, { maxWidth: 180 });
      }

      // 3. Overview Table & Donut Chart
      let startY = meeting.description ? 55 : 48;
      
      // Draw Donut Chart
      const chartBase64 = generateDonutChartBase64(metrics.totalAttended, metrics.totalParticipants);
      if (chartBase64) {
        doc.addImage(chartBase64, 'PNG', 150, startY, 40, 40);
        doc.setFontSize(10);
        doc.setTextColor(themeSecondary[0], themeSecondary[1], themeSecondary[2]);
        doc.text('Attendance Rate', 155, startY + 45);
      }

      autoTable(doc, {
        startY: startY,
        head: [['Meeting Details', '']],
        body: [
          ['Date', new Date(meeting.date).toLocaleDateString()],
          ['Time', `${meeting.startTime} - ${meeting.endTime}`],
          ['Type', meeting.meetingType],
          ['Mode / Venue', meeting.venue || meeting.link || meeting.mode],
          ['Organizer', meeting.organizerId?.name || 'Unknown'],
          ['Status', meeting.status]
        ],
        theme: 'striped',
        headStyles: { fillColor: themePrimary, textColor: 255 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 80 } }, // Constrain width so it doesn't overlap chart
        margin: { bottom: 10, right: 70 } // Ensure it leaves space for the chart
      });
      
      // 4. Participants & Attendance Status
      let finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(themePrimary[0], themePrimary[1], themePrimary[2]);
      doc.text(`Participants (${metrics.totalAttended} / ${metrics.totalParticipants} Attended)`, 14, finalY);
      
      const attendedIds = new Set(meeting.attendance.map((u: any) => u._id));
      const participantRows = meeting.participants.map((p: any, i: number) => {
        const u = p.user;
        const isAttended = attendedIds.has(u?._id) ? 'Present' : 'Absent';
        return [i + 1, u?.name || 'Unknown', u?.email || 'N/A', p.status, isAttended];
      });

      autoTable(doc, {
        startY: finalY + 5,
        head: [['#', 'Name', 'Email', 'RSVP', 'Attendance']],
        body: participantRows.length > 0 ? participantRows : [['-', 'No participants', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: themeSecondary, textColor: 255 }, 
      });

      // 5. Agendas
      finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.text('Agenda / Topics Scheduled', 14, finalY);
      
      const agendaRows = agendas.map((a: any, i: number) => [
        i + 1,
        a.title,
        `${a.timeAllocated} mins`,
        a.status
      ]);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['#', 'Topic', 'Duration', 'Status']],
        body: agendaRows.length > 0 ? agendaRows : [['-', 'No agenda items', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: themeSecondary, textColor: 255 },
      });

      // 6. Discussion Summary & Notes (From MoM)
      finalY = (doc as any).lastAutoTable.finalY + 15;
      if (finalY > 240) { doc.addPage(); finalY = 20; }
      
      doc.text('Discussion Notes', 14, finalY);
      const discussionRows = (meeting.agendaItems || [])
        .filter((item: any) => item.backgroundNote && stripHtml(item.backgroundNote).trim() !== '')
        .map((item: any) => [item.subject || `Item ${item.itemNumber}`, stripHtml(item.backgroundNote)]);
        
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Subject', 'Notes']],
        body: discussionRows.length > 0 ? discussionRows : [['No formal discussion notes recorded.', '']],
        theme: 'striped',
        headStyles: { fillColor: themeSecondary, textColor: 255 },
        columnStyles: { 0: { cellWidth: 50 } }
      });

      // 7. Decisions Taken (From MoM)
      finalY = (doc as any).lastAutoTable.finalY + 15;
      if (finalY > 240) { doc.addPage(); finalY = 20; }
      doc.text('Decisions Taken', 14, finalY);
      
      const decisionRows = (meeting.agendaItems || [])
        .filter((item: any) => item.decision && stripHtml(item.decision).trim() !== '')
        .map((item: any) => [item.subject || `Item ${item.itemNumber}`, stripHtml(item.decision)]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Subject', 'Decision']],
        body: decisionRows.length > 0 ? decisionRows : [['No formal decisions recorded.', '']],
        theme: 'striped',
        headStyles: { fillColor: themeSecondary, textColor: 255 },
        columnStyles: { 0: { cellWidth: 50 } }
      });

      // 7.5 Additional Comments & Custom Blocks
      const commentRows: any[] = [];
      (meeting.agendaItems || []).forEach((item: any) => {
        const customBlocks = item.blocks?.filter((b: any) => 
          b.type === 'customField' || 
          (b.label && b.label.toLowerCase().includes('comment'))
        );
        customBlocks?.forEach((b: any) => {
          const val = String(b.value || '');
          if (val && stripHtml(val).trim() !== '') {
            commentRows.push([item.subject || `Item ${item.itemNumber}`, b.label || 'Comment', stripHtml(val)]);
          }
        });
      });

      if (commentRows.length > 0) {
        finalY = (doc as any).lastAutoTable.finalY + 15;
        if (finalY > 230) { doc.addPage(); finalY = 20; }
        doc.text('Additional Comments', 14, finalY);
        
        autoTable(doc, {
          startY: finalY + 5,
          head: [['Subject', 'Label', 'Comment/Note']],
          body: commentRows,
          theme: 'striped',
          headStyles: { fillColor: themeSecondary, textColor: 255 },
          columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 } }
        });
      }

      // 8. Action Items / Tasks
      finalY = (doc as any).lastAutoTable.finalY + 15;
      if (finalY > 230) { doc.addPage(); finalY = 20; }
      doc.text('Action Items & Tasks', 14, finalY);
      
      const taskRows = (actionItems || []).map((task: any) => [
        task.title,
        task.assigneeId?.name || 'Unassigned',
        task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'
      ]);
      
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Task Description', 'Assigned To', 'Deadline']],
        body: taskRows.length > 0 ? taskRows : [['No action items assigned.', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: themeSecondary, textColor: 255 },
      });

      // 9. Approvals / Signatures
      finalY = (doc as any).lastAutoTable.finalY + 20;
      if (finalY > 260) { doc.addPage(); finalY = 30; }
      
      doc.setFontSize(12);
      doc.setTextColor(themePrimary[0], themePrimary[1], themePrimary[2]);
      doc.text('Verified/Approved By', 14, finalY);

      finalY += 10;
      doc.setFontSize(10);
      doc.setTextColor(themeSecondary[0], themeSecondary[1], themeSecondary[2]);

      const approvals = meeting?.momApprovals || [];
      
      if (approvals.length > 0) {
        // List people who approved
        const approvalText = approvals.map((a: any) => `- ${a.user?.name || 'Unknown User'}`).join('\n');
        doc.text(`Electronically Approved By:\n${approvalText}`, 14, finalY);
      } else {
        // Fallback for old meetings or meetings without approvals
        doc.text(`Electronically Approved By:\n- ${meeting.organizerId?.name || 'Organizer'} (Organizer Default)`, 14, finalY);
      }

      doc.save(`Report_${meeting.title.replace(/\s+/g, '_')}.pdf`);
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    if (activeTab === 'date') {
      const data = dateReports.map(m => ({
        Date: new Date(m.date).toLocaleDateString(),
        Title: m.title,
        Type: m.meetingType,
        Status: m.status,
        Organizer: m.organizerId?.name || 'N/A'
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `report_${activeTab}.xlsx`);
      
    } else if (activeTab === 'meeting' && meetingReport) {
      const { meeting, metrics, actionItems } = meetingReport;
      
      // 1. Overview Sheet
      const overviewData = [{
        Title: meeting.title,
        Date: new Date(meeting.date).toLocaleDateString(),
        Time: `${meeting.startTime} - ${meeting.endTime}`,
        Type: meeting.meetingType,
        Mode: meeting.mode,
        Organizer: meeting.organizerId?.name || 'Unknown',
        Status: meeting.status,
        "Attendance Rate": `${metrics.totalAttended} / ${metrics.totalParticipants} Attended`
      }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overviewData), "Overview");

      // 2. Participants Sheet
      const attendedIds = new Set(meeting.attendance.map((u: any) => u._id));
      const participantsData = meeting.participants.map((p: any) => ({
        Name: p.user?.name || 'Unknown',
        Email: p.user?.email || 'N/A',
        RSVP: p.status,
        Attendance: attendedIds.has(p.user?._id) ? 'Present' : 'Absent'
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(participantsData), "Participants");

      // 3. Action Items Sheet
      const tasksData = (actionItems || []).map((task: any) => ({
        Task: task.title,
        "Assigned To": task.assigneeId?.name || 'Unassigned',
        Deadline: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'
      }));
      if (tasksData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tasksData), "Action Items");
      }

      // 4. Notes & Decisions Sheet
      const notesData = (meeting.agendaItems || []).map((item: any) => ({
        Subject: item.subject || `Item ${item.itemNumber}`,
        Notes: stripHtml(item.backgroundNote),
        Decision: stripHtml(item.decision)
      }));
      if (notesData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notesData), "Notes & Decisions");
      }

      // 5. Additional Comments Sheet
      const commentData: any[] = [];
      (meeting.agendaItems || []).forEach((item: any) => {
        const customBlocks = item.blocks?.filter((b: any) => 
          b.type === 'customField' || 
          (b.label && b.label.toLowerCase().includes('comment'))
        );
        customBlocks?.forEach((b: any) => {
          const val = String(b.value || '');
          if (val && stripHtml(val).trim() !== '') {
            commentData.push({
              Subject: item.subject || `Item ${item.itemNumber}`,
              Label: b.label || 'Comment',
              "Comment/Note": stripHtml(val)
            });
          }
        });
      });
      if (commentData.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(commentData), "Additional Comments");
      }

      XLSX.writeFile(wb, `${meeting.title.replace(/\s+/g, '_')}_Report.xlsx`);
      
    } else {
      const ws = XLSX.utils.json_to_sheet([{ message: 'Excel export for this tab coming soon' }]);
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `report_${activeTab}.xlsx`);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} userRole={currentUser?.role} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end border-b border-gray-200 dark:border-gray-800 pb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
                <p className="text-gray-500 mt-1">Generate and export meeting data.</p>
              </div>
              <div className="flex gap-2">
                {activeTab === 'date' && dateReports.length > 0 && (
                  <>
                    <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 font-medium transition-colors">
                      <FileText size={18} /> PDF
                    </button>
                    <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 font-medium transition-colors">
                      <Download size={18} /> Excel
                    </button>
                  </>
                )}
                {activeTab === 'meeting' && meetingReport && meetingReport.meeting.status === 'Completed' && (
                  <>
                    <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 font-medium transition-colors">
                      <FileText size={18} /> PDF
                    </button>
                    <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 font-medium transition-colors">
                      <Download size={18} /> Excel
                    </button>
                  </>
                )}
                {activeTab === 'meeting' && meetingReport && meetingReport.meeting.status !== 'Completed' && (
                  <span className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 flex items-center gap-2">
                    Report available after completion
                  </span>
                )}
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
                  <div className="flex gap-4 items-end max-w-lg relative" ref={suggestionRef}>
                    <div className="flex-1 relative">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Name</label>
                      <input 
                        type="text" 
                        placeholder="Enter Meeting Name..." 
                        value={meetingIdInput} 
                        onChange={(e) => setMeetingIdInput(e.target.value)}
                        onFocus={() => { if (meetingSuggestions.length > 0) setShowSuggestions(true); }}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                      
                      {/* Autocomplete Dropdown */}
                      {showSuggestions && meetingIdInput && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                          {isSearchingSuggestions ? (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">Searching...</div>
                          ) : meetingSuggestions.length > 0 ? (
                            <ul className="py-1">
                              {meetingSuggestions.map((suggestion) => (
                                <li 
                                  key={suggestion._id}
                                  onClick={() => {
                                    setMeetingIdInput(suggestion.title);
                                    setShowSuggestions(false);
                                    fetchMeetingReport(suggestion.title);
                                  }}
                                  className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer flex flex-col transition-colors"
                                >
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{suggestion.title}</span>
                                  <span className="text-xs text-gray-500">{new Date(suggestion.date).toLocaleDateString()} &middot; {suggestion.meetingType}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">No matching meetings found</div>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={() => fetchMeetingReport(meetingIdInput)} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
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
