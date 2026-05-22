"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle, Clock as ClockIcon, Users, Trash2, GripVertical } from 'lucide-react';

interface AgendaItemProps {
  agenda: any;
  index: number;
  isOrganizerOrAdmin: boolean;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function AgendaItem({ agenda, index, isOrganizerOrAdmin, onApprove, onDelete }: AgendaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agenda._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`p-4 border rounded-xl flex gap-3 relative ${agenda.isEmergency ? 'border-red-200 bg-red-50/30 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} ${isDragging ? 'shadow-xl border-blue-500' : ''}`}
    >
      {/* Drag Handle */}
      {isOrganizerOrAdmin && (
        <div 
          {...attributes} 
          {...listeners}
          className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <GripVertical size={20} />
        </div>
      )}
      
      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-bold text-sm">
        {index + 1}
      </div>
      <div className="flex-grow">
        <div className="flex justify-between items-start">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {agenda.title} 
            {agenda.isEmergency && <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs rounded-md">Emergency</span>}
          </h3>
          <div className="flex items-center gap-2">
            {agenda.status === 'Pending' ? (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs rounded-full font-medium flex items-center gap-1">
                <ClockIcon size={12} /> Pending Approval
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full font-medium flex items-center gap-1">
                <CheckCircle size={12} /> Approved
              </span>
            )}
            
            {isOrganizerOrAdmin && (
              <div className="flex gap-1 ml-2">
                {agenda.status === 'Pending' && (
                  <button onClick={() => onApprove(agenda._id)} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded" title="Approve">
                    <CheckCircle size={16} />
                  </button>
                )}
                <button onClick={() => onDelete(agenda._id)} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="text-gray-500 dark:text-gray-400 text-sm mt-1 prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: agenda.description || '' }} />
        <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <span className="flex items-center gap-1"><ClockIcon size={14} /> {agenda.timeAllocated} mins</span>
          <span className="flex items-center gap-1"><Users size={14} /> Proposed by: {agenda.proposedBy?.name || 'Unknown'}</span>
        </div>
      </div>
    </div>
  );
}
