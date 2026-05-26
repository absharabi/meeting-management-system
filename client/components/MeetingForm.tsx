"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Video, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface MeetingFormProps {
  initialData?: any;
  mode?: 'create' | 'edit';
}

interface AvailableUser {
  id: string;
  name: string;
  email: string;
}

export default function MeetingForm({ initialData, mode = 'create' }: MeetingFormProps) {
  const router = useRouter();

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meetingType: 'Normal Meeting',
    mode: 'Offline',
    visibility: 'Private',
    date: '',
    startTime: '',
    endTime: '',
    venue: '',
    link: '',
    recurrencePattern: 'None',
    recurrenceCount: 1,
    participants: [] as string[]
  });

  useEffect(() => {
    if (initialData) {
      // If we are editing, map initialData to formData
      // Format date to YYYY-MM-DD for the input[type="date"]
      const formattedDate = initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '';
      
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        meetingType: initialData.meetingType || 'Normal Meeting',
        mode: initialData.mode || 'Offline',
        visibility: initialData.visibility || 'Private',
        date: formattedDate,
        startTime: initialData.startTime || '',
        endTime: initialData.endTime || '',
        venue: initialData.venue || '',
        link: initialData.link || '',
        recurrencePattern: initialData.recurrencePattern || 'None',
        recurrenceCount: initialData.recurrenceCount || 1,
        participants: initialData.participants?.map((p: any) => p.user?._id || p.user || p._id || p) || []
      });
    }
  }, [initialData]);

  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('http://localhost:5000/api/users', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) return;

        const users = await res.json();
        setAvailableUsers(users.map((user: any) => ({
          id: user._id,
          name: user.name,
          email: user.email,
        })));
      } catch {
        setAvailableUsers([]);
      }
    };

    loadUsers();
  }, []);

  const toggleParticipant = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.includes(userId)
        ? prev.participants.filter(id => id !== userId)
        : [...prev.participants, userId]
    }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const url = mode === 'edit' && initialData?._id 
        ? `http://localhost:5000/api/meetings/${initialData._id}` 
        : 'http://localhost:5000/api/meetings';
        
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${token}` // TODO: Add real token when Google Auth is complete
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${mode} meeting`);
      }

      setSuccess(`Meeting ${mode === 'edit' ? 'updated' : 'created'} successfully!`);
      
      // We removed the manual toast.success here because the backend 
      // automatically emits a Socket.io notification for creations/updates,
      // which triggers the toast in NotificationDropdown.tsx instead!
      
      if (mode === 'create') {
        // Reset form on success
        setFormData({
          title: '', description: '', meetingType: 'Normal Meeting', mode: 'Offline', visibility: 'Private',
          date: '', startTime: '', endTime: '', venue: '', link: '', recurrencePattern: 'None', recurrenceCount: 1, participants: []
        });
        
        // Also redirect back to the meetings list so they see it in the table!
        setTimeout(() => {
          router.push('/meetings');
        }, 500);
      } else {
        // Redirect back to meetings list if editing
        setTimeout(() => {
          router.push('/meetings');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process request. Venue conflict detected.');
      toast.error(err.message || 'Failed to process request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Beautiful Gradient Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-8 shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-10 blur-3xl"></div>
        <div className="absolute bottom-0 right-32 w-32 h-32 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              {mode === 'edit' ? 'Edit Meeting' : 'Schedule a Meeting'}
            </h1>
            <p className="text-blue-100 mt-2 text-sm md:text-base max-w-lg">
              {mode === 'edit' 
                ? 'Update your meeting details below. Venue conflicts will be automatically checked.'
                : 'Plan your next gathering, set the agenda, and invite your team. Our system automatically checks for venue conflicts to ensure a smooth scheduling experience.'}
            </p>
          </div>
          <div className="hidden md:flex h-16 w-16 bg-white/20 backdrop-blur-md rounded-2xl items-center justify-center border border-white/30 shadow-inner">
            <Calendar className="text-white" size={32} />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3 text-green-700 dark:text-green-400">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 md:p-8 space-y-8">
        
        {/* Basic Details */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
            Basic Details
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Title *</label>
              <input 
                required name="title" value={formData.title} onChange={handleChange}
                placeholder="e.g. Q3 Roadmap Planning"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
              />
            </div>
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <div className="bg-white dark:bg-gray-900 pb-10">
                <ReactQuill theme="snow" value={formData.description} onChange={(val) => setFormData({...formData, description: val})} className="h-32" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Category</label>
                <select name="meetingType" value={formData.meetingType} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all">
                  <option value="Normal Meeting">Normal Meeting</option>
                  <option value="Board Meeting">Board Meeting</option>
                  <option value="Department Meeting">Department Meeting</option>
                  <option value="Review Meeting">Review Meeting</option>
                  <option value="Online Conference">Online Conference</option>
                  <option value="Committee Meeting">Committee Meeting</option>
                  <option value="Emergency Meeting">Emergency Meeting</option>
                  <option value="Periodic Meeting">Periodic Meeting</option>
                  <option value="Scheduled Meeting">Scheduled Meeting</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visibility</label>
                <select name="visibility" value={formData.visibility} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all">
                  <option value="Private">Private (Invite Only)</option>
                  <option value="Public">Public (Visible to all org)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Date & Time */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">2</span>
            Schedule
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Calendar size={14} /> Date *</label>
              <input 
                type="date" required name="date" value={formData.date} onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Clock size={14} /> Start Time *</label>
              <input 
                type="time" required name="startTime" value={formData.startTime} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Clock size={14} /> End Time *</label>
              <input 
                type="time" required name="endTime" value={formData.endTime} onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all" 
              />
            </div>
            
            {mode === 'create' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recurrence</label>
                  <select name="recurrencePattern" value={formData.recurrencePattern} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all">
                    <option value="None">Does not repeat</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
                {formData.recurrencePattern !== 'None' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Occurrences</label>
                    <input 
                      type="number" min="2" max="12" name="recurrenceCount" value={formData.recurrenceCount} onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all" 
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Location */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center text-sm font-bold">3</span>
            Location & Mode
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Mode</label>
              <select name="mode" value={formData.mode} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all">
                <option value="Offline">In-Person (Offline)</option>
                <option value="Online">Virtual (Online)</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            {formData.mode !== 'Online' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><MapPin size={14} /> Venue Room *</label>
                <input 
                  name="venue" required list="venues" value={formData.venue} onChange={handleChange} 
                  placeholder="Type or select a venue"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all"
                />
                <datalist id="venues">
                  <option value="Conference Room A" />
                  <option value="Main Auditorium" />
                  <option value="Executive Board Room" />
                </datalist>
              </div>
            )}

            {formData.mode !== 'Offline' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Video size={14} /> Meeting Link</label>
                <input 
                  name="link" value={formData.link} onChange={handleChange} placeholder="https://zoom.us/j/..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all" 
                />
              </div>
            )}
          </div>
        </section>

        {/* Participants */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
            <span className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-sm font-bold">4</span>
            Invite Members
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1"><Users size={14} /> Select Participants</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {availableUsers.length === 0 && (
                <p className="col-span-full rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  No users available to invite.
                </p>
              )}
              {availableUsers.map(user => {
                const isSelected = formData.participants.includes(user.id);
                return (
                  <div 
                    key={user.id}
                    onClick={() => toggleParticipant(user.id)}
                    className={`
                      cursor-pointer p-3 rounded-xl border flex items-center gap-3 transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-700'}
                    `}
                  >
                    <div className={`
                      w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                      ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-700'}
                    `}>
                      {isSelected && <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5"><path d="M3 7.5L5.5 10L11 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        
        {/* Submission */}
        <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm font-medium rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? 'Processing...' : (mode === 'edit' ? 'Save Changes' : 'Schedule Meeting')}
          </button>
        </div>

      </form>
    </div>
  );
}
