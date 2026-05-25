"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, Users, FileText, CheckCircle, Clock as ClockIcon, Download, Plus, Trash2, GripVertical, BellOff, Bell } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import dynamic from 'next/dynamic';
import AgendaItem from '../../../components/AgendaItem';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

export default function MeetingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<any>(null);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  // Dummy current user for testing
  const currentUser = { id: '65f0a1b2c3d4e5f607890abc', role: 'SuperAdmin' };

  const [newAgenda, setNewAgenda] = useState({ title: '', description: '', timeAllocated: 15, isEmergency: false });

  const fetchMeetingAndAgendas = async () => {
    try {
      setIsLoading(true);
      // Fetch meeting details (in a real app, you'd have a GET /api/meetings/:id endpoint)
      // Since we don't have one, we fetch all and find it
      const mRes = await fetch(`http://localhost:5000/api/meetings`);
      const meetings = await mRes.json();
      const foundMeeting = meetings.find((m: any) => m._id === meetingId);
      setMeeting(foundMeeting);

      if (foundMeeting) {
        const aRes = await fetch(`http://localhost:5000/api/meetings/${meetingId}/agendas`);
        const agendasData = await aRes.json();
        setAgendas(agendasData);
      }

      // Fetch user to get muted status
      const uRes = await fetch(`http://localhost:5000/api/users/me`);
      if (uRes.ok) {
        const user = await uRes.json();
        if (user.mutedMeetings?.includes(meetingId)) {
          setIsMuted(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingAndAgendas();
  }, [meetingId]);

  const handleAddAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...newAgenda, sequence: agendas.length + 1 };
      const res = await fetch(`http://localhost:5000/api/meetings/${meetingId}/agendas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewAgenda({ title: '', description: '', timeAllocated: 15, isEmergency: false });
        fetchMeetingAndAgendas();
      }
    } catch (error) {
      console.error('Failed to add agenda', error);
    }
  };

  // Drag and Drop Setup
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = agendas.findIndex((a) => a._id === active.id);
      const newIndex = agendas.findIndex((a) => a._id === over.id);
      
      const newAgendas = arrayMove(agendas, oldIndex, newIndex);
      setAgendas(newAgendas);

      // Re-sequence
      const updatedItems = newAgendas.map((item, idx) => ({ id: item._id, sequence: idx + 1 }));
      
      try {
        await fetch(`http://localhost:5000/api/meetings/${meetingId}/agendas/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: updatedItems })
        });
      } catch (err) {
        console.error('Failed to save reordered agendas:', err);
      }
    }
  };

  const handleApprove = async (agendaId: string) => {
    try {
      await fetch(`http://localhost:5000/api/meetings/${meetingId}/agendas/${agendaId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Approved' })
      });
      fetchMeetingAndAgendas();
    } catch (error) {
      console.error('Failed to approve agenda', error);
    }
  };

  const handleDeleteAgenda = async (agendaId: string) => {
    if (!confirm('Delete this agenda item?')) return;
    try {
      await fetch(`http://localhost:5000/api/meetings/${meetingId}/agendas/${agendaId}`, {
        method: 'DELETE'
      });
      fetchMeetingAndAgendas();
    } catch (error) {
      console.error('Failed to delete agenda', error);
    }
  };

  const handleToggleMute = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/users/mute-meeting/${meetingId}`, {
        method: 'PUT'
      });
      if (res.ok) {
        setIsMuted(!isMuted);
      }
    } catch (error) {
      console.error('Failed to toggle mute', error);
    }
  };

  const stripHtml = (html: string) => {
    if (!html) return 'N/A';
    return html.replace(/<[^>]+>/g, '').trim() || 'N/A';
  };

  const exportPDF = () => {
    if (!meeting) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text(`Meeting Agenda: ${meeting.title}`, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Date: ${new Date(meeting.date).toLocaleDateString()}`, 14, 32);
    doc.text(`Time: ${meeting.startTime} - ${meeting.endTime}`, 14, 38);
    doc.text(`Venue: ${meeting.venue || meeting.mode}`, 14, 44);

    const approvedAgendas = agendas.filter(a => a.status === 'Approved');
    
    const tableData = approvedAgendas.map((a, i) => [
      i + 1,
      a.title,
      stripHtml(a.description),
      `${a.timeAllocated} mins`,
      a.isEmergency ? 'Yes' : 'No'
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['#', 'Topic', 'Description', 'Time', 'Emergency']],
      body: tableData,
    });

    doc.save(`Agenda_${meeting.title.replace(/\s+/g, '_')}.pdf`);
  };

  const exportExcel = () => {
    if (!meeting) return;
    const approvedAgendas = agendas.filter(a => a.status === 'Approved');
    
    const worksheetData = approvedAgendas.map((a, i) => ({
      'Sequence': i + 1,
      'Topic': a.title,
      'Description': stripHtml(a.description),
      'Time Allocated (mins)': a.timeAllocated,
      'Emergency Item': a.isEmergency ? 'Yes' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Agenda");
    
    XLSX.writeFile(workbook, `Agenda_${meeting.title.replace(/\s+/g, '_')}.xlsx`);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading meeting details...</div>;
  if (!meeting) return <div className="p-8 text-center text-red-500">Meeting not found</div>;

  const isOrganizerOrAdmin = currentUser.role === 'SuperAdmin' || meeting.organizerId?._id === currentUser.id;

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-semibold">{meeting.meetingType}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${meeting.status === 'Scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{meeting.status}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{meeting.title}</h1>
            {meeting.description ? (
              <div className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: meeting.description }} />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">No description provided.</p>
            )}
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleToggleMute} 
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isMuted 
                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40'
              }`}
            >
              {isMuted ? <BellOff size={16} /> : <Bell size={16} />} 
              {isMuted ? 'Muted' : 'Mute'}
            </button>
            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg text-sm font-medium transition-colors">
              <Download size={16} /> PDF Agenda
            </button>
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-lg text-sm font-medium transition-colors">
              <Download size={16} /> Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-500"><Calendar size={20} /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
              <p className="font-medium text-gray-900 dark:text-white">{new Date(meeting.date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-500"><Clock size={20} /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Time</p>
              <p className="font-medium text-gray-900 dark:text-white">{meeting.startTime} - {meeting.endTime}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-500"><MapPin size={20} /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Venue</p>
              <p className="font-medium text-gray-900 dark:text-white">{meeting.venue || meeting.mode}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-500"><Users size={20} /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Participants</p>
              <p className="font-medium text-gray-900 dark:text-white">{meeting.participants?.length || 0} Invited</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agenda Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="text-blue-500" /> Meeting Agenda
          </h2>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Agenda List */}
          <div className="lg:col-span-2 space-y-4">
            {agendas.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Agenda Items</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Add items below to structure your meeting.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={agendas.map(a => a._id)} strategy={verticalListSortingStrategy}>
                  {agendas.map((agenda, index) => (
                    <AgendaItem 
                      key={agenda._id}
                      agenda={agenda}
                      index={index}
                      isOrganizerOrAdmin={isOrganizerOrAdmin}
                      onApprove={handleApprove}
                      onDelete={handleDeleteAgenda}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Add Agenda Form */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700 h-fit">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Plus size={18} /> Propose Agenda Item</h3>
            <form onSubmit={handleAddAgenda} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Topic Title *</label>
                <input required type="text" value={newAgenda.title} onChange={e => setNewAgenda({...newAgenda, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm" placeholder="e.g. Q3 Marketing Review" />
              </div>
              <div className="mb-8">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <div className="bg-white dark:bg-gray-900 pb-8">
                  <ReactQuill theme="snow" value={newAgenda.description} onChange={(val) => setNewAgenda({...newAgenda, description: val})} className="h-24" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Time (mins)</label>
                  <input type="number" required min="5" value={newAgenda.timeAllocated} onChange={e => setNewAgenda({...newAgenda, timeAllocated: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm" />
                </div>
                <div className="flex-1 flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-red-600 font-medium cursor-pointer">
                    <input type="checkbox" checked={newAgenda.isEmergency} onChange={e => setNewAgenda({...newAgenda, isEmergency: e.target.checked})} className="rounded text-red-600 focus:ring-red-500" />
                    Emergency
                  </label>
                </div>
              </div>
              <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                Add to Agenda
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
