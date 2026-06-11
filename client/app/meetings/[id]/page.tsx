"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, MapPin, Users, FileText, CheckCircle, Clock as ClockIcon, Download, Plus, Trash2, GripVertical, BellOff, Bell, CheckSquare, Copy, Edit, Paperclip, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import dynamic from 'next/dynamic';
import AgendaItem from '../../../components/AgendaItem';
import LiveNotesPad from '../../../components/LiveNotesPad';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

export default function MeetingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meetingId = params.id as string;
  const viewMode = searchParams.get('view') || 'details';

  const [meeting, setMeeting] = useState<any>(null);
  const [agendas, setAgendas] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newActionItem, setNewActionItem] = useState({ title: '', assigneeId: '', dueDate: '' });
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [newAgenda, setNewAgenda] = useState({ title: '', description: '', timeAllocated: 15, isEmergency: false });
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const pendingDocsInputRef = useRef<HTMLInputElement>(null);
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const fetchMeetingAndAgendas = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      // Fetch meeting details (in a real app, you'd have a GET /api/meetings/:id endpoint)
      // Since we don't have one, we fetch all and find it
      const mRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const meetings = await mRes.json();
      const foundMeeting = meetings.find((m: any) => m._id === meetingId);
      setMeeting(foundMeeting);

      if (foundMeeting) {
        const aRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/agendas`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const agendasData = await aRes.json();
        setAgendas(agendasData);
      }

      // Fetch user to get muted status
      const uRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (uRes.ok) {
        const user = await uRes.json();
        setCurrentUser(user);
      }

      // Fetch action items for this meeting
      const actionRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/action-items/meeting/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (actionRes.ok) {
        const actionData = await actionRes.json();
        setActionItems(actionData);
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
      const token = localStorage.getItem('accessToken');
      const payload = { ...newAgenda, sequence: agendas.length + 1 };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/agendas`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const createdAgenda = await res.json();
        // Upload any pending documents
        if (pendingDocs.length > 0) {
          await Promise.all(
            pendingDocs.map((file) => handleUploadAgendaDocument(createdAgenda._id, file))
          );
        }
        setNewAgenda({ title: '', description: '', timeAllocated: 15, isEmergency: false });
        setPendingDocs([]);
        if (pendingDocsInputRef.current) pendingDocsInputRef.current.value = '';
        fetchMeetingAndAgendas();
      }
    } catch (error) {
      console.error('Failed to add agenda', error);
    }
  };

  const handleAddActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken');
      const payload = { ...newActionItem, meetingId };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Action item created and assigned successfully!');
        setNewActionItem({ title: '', assigneeId: '', dueDate: '' });
        fetchMeetingAndAgendas();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to create action item');
      }
    } catch (error) {
      console.error('Failed to add action item', error);
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
        const token = localStorage.getItem('accessToken');
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/agendas/reorder`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ items: updatedItems })
        });
      } catch (err) {
        console.error('Failed to save reordered agendas:', err);
      }
    }
  };

  const handleApprove = async (agendaId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/agendas/${agendaId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
      const token = localStorage.getItem('accessToken');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/agendas/${agendaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchMeetingAndAgendas();
    } catch (error) {
      console.error('Failed to delete agenda', error);
    }
  };

  const handleUploadAgendaDocument = async (agendaId: string, file: File) => {
    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('document', file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/agendas/${agendaId}/upload-document`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
      if (res.ok) {
        fetchMeetingAndAgendas();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Failed to upload agenda document', error);
      alert('Error uploading document');
    }
  };

  const handleDeleteAgendaDocument = async (agendaId: string, docIndex: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/agendas/${agendaId}/documents/${docIndex}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        fetchMeetingAndAgendas();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Failed to delete agenda document', error);
      alert('Error deleting document');
    }
  };



  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('reportFile', file);

    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/upload-report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to upload report');
      } else {
        alert('Offline report uploaded successfully!');
        fetchMeetingAndAgendas();
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file');
    } finally {
      setIsLoading(false);
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

  const currentUserId = currentUser?.id || currentUser?._id;
  const isOrganizerOrAdmin = currentUser && (
    currentUser.role === 'SuperAdmin' || 
    currentUser.role === 'Admin' || 
    meeting.organizerId === currentUserId || 
    meeting.organizerId?._id === currentUserId
  );

  const isAdminOrSuperAdmin = currentUser && (
    currentUser.role === 'SuperAdmin' || 
    currentUser.role === 'Admin'
  );

  const isAgendaProposalAllowed = (() => {
    if (!meeting) return false;
    const meetingDate = new Date(meeting.date);
    const meetingDateStr = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth()+1).padStart(2,'0')}-${String(meetingDate.getDate()).padStart(2,'0')}`;
    const startTimeStr = meeting.startTime || '00:00';
    const meetingStartDateTime = new Date(`${meetingDateStr}T${startTimeStr}:00`);
    const now = new Date();
    
    if (meeting.meetingType === 'Emergency Meeting') {
      return meetingStartDateTime.getTime() > now.getTime();
    }
    
    const hoursDiff = (meetingStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDiff >= 24;
  })();

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 shadow-sm">
        <button 
          onClick={() => router.push('/meetings')} 
          className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          ← Back to Meetings
        </button>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-semibold">{meeting.meetingType}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${meeting.status === 'Scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{meeting.status}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{meeting.title}</h1>
            
            {/* Compressed Meeting ID */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-mono text-gray-500 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded-md flex items-center">
                ID: {meeting._id}
              </span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(meeting._id);
                  alert('Meeting ID copied to clipboard!');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Copy Meeting ID"
              >
                <Copy size={14} />
              </button>
            </div>

            {meeting.description ? (
              <div className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: meeting.description }} />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">No description provided.</p>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 justify-end">
            {isOrganizerOrAdmin && meeting.status !== 'Completed' && meeting.status !== 'Cancelled' && isAgendaProposalAllowed && (
              <button 
                onClick={() => router.push(`/meetings/${meetingId}/edit`)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Edit size={16} /> Edit
              </button>
            )}
            {isOrganizerOrAdmin && meeting.status !== 'Completed' && meeting.status !== 'Cancelled' && (
              <>
                <button 
                  onClick={async () => {
                    if (!confirm('Are you sure you want to cancel this meeting?')) return;
                    try {
                      const token = localStorage.getItem('accessToken');
                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      if (res.ok) {
                        fetchMeetingAndAgendas();
                      }
                    } catch (e) {
                      console.error('Failed to cancel meeting', e);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 size={16} /> Cancel Meeting
                </button>
                <button 
                  onClick={async () => {
                    if(!confirm('Mark this meeting as completed?')) return;
                    try {
                      const token = localStorage.getItem('accessToken');
                      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ status: 'Completed' })
                      });
                      fetchMeetingAndAgendas();
                    } catch (e) {
                      console.error('Failed to complete meeting', e);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCircle size={16} /> Mark Completed
                </button>
              </>
            )}
            
            {isAdminOrSuperAdmin && (
              <button 
                onClick={async () => {
                  if (!confirm('CRITICAL WARNING: Are you sure you want to PERMANENTLY delete this meeting from the database? This action cannot be undone.')) return;
                  try {
                    const token = localStorage.getItem('accessToken');
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/${meetingId}/hard`, {
                      method: 'DELETE',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                      router.push('/meetings');
                    } else {
                      alert('Failed to permanently delete the meeting');
                    }
                  } catch (e) {
                    console.error('Failed to permanently delete meeting', e);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Trash2 size={16} /> Delete Permanently
              </button>
            )}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {meeting.mode === 'Online' ? 'Meeting Link' : meeting.mode === 'Hybrid' ? 'Venue / Link' : 'Venue'}
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {meeting.mode === 'Online' ? (
                  meeting.link ? (
                    <a href={meeting.link.startsWith('http') ? meeting.link : `https://${meeting.link}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                      {meeting.link}
                    </a>
                  ) : (
                    'Online (No link provided)'
                  )
                ) : meeting.mode === 'Hybrid' ? (
                  <>
                    {meeting.venue || 'No venue'}
                    {meeting.link && (
                      <span className="block text-xs mt-0.5">
                        Link:{' '}
                        <a href={meeting.link.startsWith('http') ? meeting.link : `https://${meeting.link}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                          {meeting.link}
                        </a>
                      </span>
                    )}
                  </>
                ) : (
                  meeting.venue || 'Offline'
                )}
              </p>
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
      {viewMode === 'agenda' && (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="text-blue-500" /> Meeting Agenda
          </h2>
          <div className="flex gap-2">
            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg text-sm font-medium transition-colors">
              <Download size={16} /> PDF Agenda
            </button>
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-lg text-sm font-medium transition-colors">
              <Download size={16} /> Excel
            </button>
          </div>
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
                      currentUserId={currentUserId || ''}
                      meetingId={meetingId}
                      onApprove={handleApprove}
                      onDelete={handleDeleteAgenda}
                      onUploadDocument={handleUploadAgendaDocument}
                      onDeleteDocument={handleDeleteAgendaDocument}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Add Agenda Form */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700 h-fit">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Plus size={18} /> Propose Agenda Item</h3>
            {!isAgendaProposalAllowed ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800 text-sm">
                Agenda items can only be proposed up to 24 hours before the meeting starts.
              </div>
            ) : (
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

                {/* Supporting Documents */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Paperclip size={12} /> Supporting Documents <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors">
                    <Paperclip size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {pendingDocs.length === 0 ? 'Attach files… (PDF, Word, Excel, Images)' : `${pendingDocs.length} file${pendingDocs.length > 1 ? 's' : ''} selected`}
                    </span>
                    <input
                      ref={pendingDocsInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        setPendingDocs(prev => [...prev, ...files]);
                      }}
                    />
                  </label>
                  {pendingDocs.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {pendingDocs.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                          <Paperclip size={11} className="flex-shrink-0 text-gray-400" />
                          <span className="truncate flex-1">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingDocs(prev => prev.filter((_, idx) => idx !== i))}
                            className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Add to Agenda
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
      )}

      {/* Offline Report Section */}
      {viewMode === 'details' && (meeting.mode === 'Offline' || meeting.offlineReportFileUrl) && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="text-indigo-500" /> Offline Meeting Report
            </h2>
            <p className="text-sm text-gray-500 mt-1">Download the official scanned attendance and minutes document.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {meeting.offlineReportFileUrl ? (
              meeting.status === 'Completed' ? (
                <a 
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${meeting.offlineReportFileUrl}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} /> Download Report
                </a>
              ) : (
                <span className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 flex items-center gap-2">
                  <ClockIcon size={14} /> Report available after completion
                </span>
              )
            ) : (
              !isOrganizerOrAdmin && (
                <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                  Report not uploaded yet
                </span>
              )
            )}
            
            {isOrganizerOrAdmin && !meeting.offlineReportFileUrl && (
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                <Plus size={16} /> Upload Report
                <input 
                  type="file" 
                  accept=".pdf, .xls, .xlsx" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Live Notes & Action Items Section */}
      {viewMode === 'details' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[450px]">
        {/* Live Notes Section */}
        <div className="lg:col-span-2 h-full">
          <LiveNotesPad meetingId={meetingId} currentUser={currentUser} />
        </div>

        {/* Action Items Assigner & List */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
          
          {/* Action Items List */}
          <div className="flex-1 p-5 overflow-y-auto border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CheckSquare className="text-blue-500" size={18} /> Assigned Tasks
            </h3>
            
            {actionItems.length === 0 ? (
              <p className="text-sm text-gray-500 italic text-center mt-8">No tasks assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {actionItems.map(item => (
                  <div key={item._id} className="p-3 rounded-lg border bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.title}
                      </h4>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {item.assigneeId?.name || 'Unknown'}
                      </span>
                      {/* Date removed as per request */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Items Form */}
          {isOrganizerOrAdmin && (
            <div className="p-5 bg-gray-50 dark:bg-gray-800/50">
              <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-3">Assign New Task</h4>
              <form onSubmit={handleAddActionItem} className="space-y-3">
                <input required type="text" value={newActionItem.title} onChange={e => setNewActionItem({...newActionItem, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm" placeholder="Task Title (e.g. Prepare slides)" />
                  <select required value={newActionItem.assigneeId} onChange={e => setNewActionItem({...newActionItem, assigneeId: e.target.value})} className="flex-1 w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm bg-white dark:bg-gray-900">
                    <option value="" disabled>Assign To...</option>
                    {meeting.organizerId && (
                      <option value={meeting.organizerId._id}>{meeting.organizerId.name} (Org)</option>
                    )}
                    {meeting.participants?.map((p: any) => p.user && p.user._id !== meeting.organizerId?._id && (
                      <option key={p.user._id} value={p.user._id}>{p.user.name}</option>
                    ))}
                  </select>
                <button type="submit" className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Assign Task
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Feedback Section */}
      {viewMode === 'details' && meeting.status === 'Completed' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-6 text-center">
          <h3 className="text-xl font-bold text-amber-800 dark:text-amber-400 mb-2">Rate This Meeting</h3>
          <p className="text-amber-700 dark:text-amber-500 mb-4 text-sm">How efficient was this meeting? Your feedback helps us improve.</p>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={async () => {
                  setUserRating(star);
                  try {
                    const token = localStorage.getItem('accessToken');
                    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/feedback`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ meetingId, rating: star })
                    });
                    alert('Thank you for your feedback!');
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className={`text-3xl transition-all ${
                  star <= (hoverRating || userRating)
                    ? 'text-amber-500 scale-110 drop-shadow-md'
                    : 'text-gray-300 dark:text-gray-600 hover:text-amber-300'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
