"use client";

import React, { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle,
  Clock as ClockIcon,
  Users,
  Trash2,
  GripVertical,
  Paperclip,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  Lock,
  Pencil,
  Check,
  Send,
} from 'lucide-react';

interface AgendaDocument {
  fileName: string;
  fileUrl: string;
  uploadedAt: string | Date;
  uploadedBy?: { _id: string; name: string; email: string } | string;
}

interface AgendaItemProps {
  agenda: any;
  index: number;
  isOrganizerOrAdmin: boolean;
  currentUserId: string;
  canUploadDocument: boolean;
  meetingId: string;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, data: { title: string; description: string; timeAllocated: number; isEmergency: boolean }) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
  onUploadDocument: (agendaId: string, file: File) => Promise<void>;
  onDeleteDocument: (agendaId: string, docIndex: number) => Promise<void>;
}

function getUploaderId(doc: AgendaDocument): string {
  if (!doc.uploadedBy) return '';
  if (typeof doc.uploadedBy === 'string') return doc.uploadedBy;
  return doc.uploadedBy._id ?? '';
}

function getUploaderName(doc: AgendaDocument): string {
  if (!doc.uploadedBy) return 'Unknown';
  if (typeof doc.uploadedBy === 'string') return 'Unknown';
  return doc.uploadedBy.name ?? 'Unknown';
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png'].includes(ext || '')) return '🖼️';
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext || '')) return '📝';
  if (['xls', 'xlsx'].includes(ext || '')) return '📊';
  return '📎';
}

export default function AgendaItem({
  agenda,
  index,
  isOrganizerOrAdmin,
  currentUserId,
  canUploadDocument,
  meetingId,
  onApprove,
  onDelete,
  onEdit,
  onConfirm,
  onUploadDocument,
  onDeleteDocument,
}: AgendaItemProps) {
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

  const [docsOpen, setDocsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(agenda.title);
  const [editDescription, setEditDescription] = useState(agenda.description || '');
  const [editTime, setEditTime] = useState(agenda.timeAllocated || 15);
  const [editEmergency, setEditEmergency] = useState(agenda.isEmergency || false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isOwnDraft = agenda.proposedBy?._id === currentUserId && !agenda.isConfirmedByProposer;

  const allDocuments: AgendaDocument[] = agenda.documents || [];

  // Participants see only their own docs; organizer/admin sees everything
  const visibleDocs = isOrganizerOrAdmin
    ? allDocuments
    : allDocuments.filter((doc) => getUploaderId(doc) === currentUserId);

  // Count of docs visible to this user (for badge)
  const ownDocCount = allDocuments.filter((d) => getUploaderId(d) === currentUserId).length;
  const badgeCount = isOrganizerOrAdmin ? allDocuments.length : ownDocCount;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUploadDocument(agenda._id, file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Map visible doc index back to the true index in allDocuments for deletion
  const handleDeleteDoc = async (visibleIdx: number) => {
    if (!confirm('Remove this document?')) return;
    const docToDelete = visibleDocs[visibleIdx];
    const trueIdx = allDocuments.findIndex(
      (d) => d.fileUrl === docToDelete.fileUrl && getUploaderId(d) === getUploaderId(docToDelete)
    );
    if (trueIdx === -1) return;
    setDeletingIdx(visibleIdx);
    try {
      await onDeleteDocument(agenda._id, trueIdx);
    } finally {
      setDeletingIdx(null);
    }
  };

  const canDeleteDoc = (doc: AgendaDocument) =>
    isOrganizerOrAdmin || getUploaderId(doc) === currentUserId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-xl relative ${
        agenda.isEmergency
          ? 'border-red-200 bg-red-50/30 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      } ${isDragging ? 'shadow-xl border-blue-500' : ''}`}
    >
      {/* Main content row */}
      <div className="p-4 flex gap-3">
        {/* Drag Handle — organizer/admin only */}
        {isOrganizerOrAdmin && (
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          >
            <GripVertical size={20} />
          </div>
        )}

        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-bold text-sm">
          {index + 1}
        </div>

        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
              {agenda.title}
              {agenda.isEmergency && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs rounded-md">
                  Emergency
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {agenda.status === 'Pending' ? (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs rounded-full font-medium flex items-center gap-1">
                  <ClockIcon size={12} /> Pending Approval
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full font-medium flex items-center gap-1">
                  <CheckCircle size={12} /> Approved
                </span>
              )}

              {/* Draft badge for unconfirmed items */}
              {!agenda.isConfirmedByProposer && (
                <span className="px-2.5 py-1 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 text-xs rounded-full font-medium flex items-center gap-1">
                  <Pencil size={12} /> Draft
                </span>
              )}

              {isOrganizerOrAdmin && (
                <div className="flex gap-1 ml-2">
                  {agenda.status === 'Pending' && (
                    <button
                      onClick={() => onApprove(agenda._id)}
                      className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                      title="Approve"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(agenda._id)}
                    className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Delete agenda item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* Participant actions on their own draft */}
              {!isOrganizerOrAdmin && isOwnDraft && (
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => {
                      setEditTitle(agenda.title);
                      setEditDescription(agenda.description || '');
                      setEditTime(agenda.timeAllocated || 15);
                      setEditEmergency(agenda.isEmergency || false);
                      setIsEditing(true);
                    }}
                    className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                    title="Edit agenda item"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(agenda._id)}
                    className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Delete agenda item"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    disabled={confirming}
                    onClick={async () => {
                      setConfirming(true);
                      try { await onConfirm(agenda._id); } finally { setConfirming(false); }
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                    title="Confirm and submit to organizer"
                  >
                    <Send size={12} /> {confirming ? 'Confirming...' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Inline Edit Form */}
          {isEditing ? (
            <div className="mt-3 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm"
                />
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Time (mins)</label>
                  <input
                    type="number"
                    min={5}
                    value={editTime}
                    onChange={e => setEditTime(parseInt(e.target.value) || 15)}
                    className="w-24 px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 text-sm"
                  />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={editEmergency}
                    onChange={e => setEditEmergency(e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <label className="text-xs text-gray-600 dark:text-gray-400">Emergency</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onEdit(agenda._id, { title: editTitle, description: editDescription, timeAllocated: editTime, isEmergency: editEmergency });
                      setIsEditing(false);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="rich-text-content min-w-0 max-w-full overflow-hidden text-gray-500 dark:text-gray-400 text-sm mt-1 prose prose-sm dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: agenda.description || '' }}
              />
            </>
          )}

          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span className="flex items-center gap-1">
              <ClockIcon size={14} /> {agenda.timeAllocated} mins
            </span>
            <span className="flex items-center gap-1">
              <Users size={14} /> Proposed by: {agenda.proposedBy?.name || 'Unknown'}
            </span>
            {agenda.createdAt && (
              <span className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-4">
                <ClockIcon size={14} /> on {new Date(agenda.createdAt).toLocaleDateString()} at{' '}
                {new Date(agenda.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Supporting Documents Panel — visible to all, filtered by uploader for participants */}
      <div className="border-t border-gray-100 dark:border-gray-700/60">
        {/* Collapsible header */}
        <button
          onClick={() => setDocsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors rounded-b-xl"
        >
          <span className="flex items-center gap-1.5">
            <Paperclip size={13} />
            Supporting Documents
            {badgeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full text-[10px] font-bold">
                {badgeCount}
              </span>
            )}
            {/* Subtle indicator for participants that they see only their own */}
            {!isOrganizerOrAdmin && (
              <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 ml-1">
                <Lock size={9} /> your uploads only
              </span>
            )}
          </span>
          {docsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {docsOpen && (
          <div className="px-4 pb-4 space-y-3">
            {/* Upload button — available to everyone */}
            {canUploadDocument ? (
            <div className="flex items-center gap-2">
              <label
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                  uploading
                    ? 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-700 dark:border-gray-600 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/40'
                }`}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload size={13} />
                    Upload Document
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.mp3,.wav"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                PDF, Word, Excel, Images, Audio · max 10 MB
              </span>
            </div>
            ) : (
              <p className="text-xs text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-lg px-3 py-2">
                Accept this meeting invitation before uploading supporting documents.
              </p>
            )}

            {/* Organizer sees a label showing all vs own */}
            {isOrganizerOrAdmin && allDocuments.length > 0 && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-1">
                Showing all {allDocuments.length} document{allDocuments.length > 1 ? 's' : ''} from all uploaders
              </p>
            )}

            {/* Document list */}
            {visibleDocs.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">
                {isOrganizerOrAdmin ? 'No documents uploaded yet.' : 'You have not uploaded any documents yet.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {visibleDocs.map((doc, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 group"
                  >
                    <span className="text-base leading-none flex-shrink-0">{getFileIcon(doc.fileName)}</span>
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-xs text-gray-700 dark:text-gray-300 truncate block"
                        title={doc.fileName}
                      >
                        {doc.fileName}
                      </span>
                      {/* Show uploader name to organizer/admin */}
                      {isOrganizerOrAdmin && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          by {getUploaderName(doc)}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap hidden sm:block">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>

                    {/* View / Download */}
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${doc.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 rounded transition-colors flex-shrink-0"
                      title="View / Download"
                    >
                      <Eye size={14} />
                    </a>

                    {/* Delete — only for own doc or organizer/admin */}
                    {canDeleteDoc(doc) && (
                      <button
                        onClick={() => handleDeleteDoc(idx)}
                        disabled={deletingIdx === idx}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors disabled:opacity-40 flex-shrink-0"
                        title="Remove document"
                      >
                        {deletingIdx === idx ? (
                          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                        ) : (
                          <X size={14} />
                        )}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
