"use client";

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import 'react-quill-new/dist/quill.snow.css';

// Dynamically import Quill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

interface LiveNotesPadProps {
  meetingId: string;
  initialContent?: string;
  currentUser?: any;
}

export default function LiveNotesPad({ meetingId, initialContent = '', currentUser }: LiveNotesPadProps) {
  const [editorText, setEditorText] = useState(initialContent);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize Socket
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`;
    socketRef.current = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      socketRef.current?.emit('join-meeting-room', meetingId);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for incoming note updates from other users
    socketRef.current.on('note-updated', (incomingText: string) => {
      setEditorText(incomingText);
    });

    socketRef.current.on('meeting-locked', () => {
      setIsConnected(false);
      socketRef.current?.disconnect();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting-room', meetingId);
        socketRef.current.disconnect();
      }
    };
  }, [meetingId]);

  const handleEditorChange = (enteredValue: string, changeDelta: any, actionSource: string) => {
    setEditorText(enteredValue);
    // Only broadcast if the change was made by a 'user' (not by 'api' from receiving socket data)
    if (actionSource === 'user' && socketRef.current) {
      socketRef.current.emit('note-update', { meetingId, content: enteredValue });
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['clean']
    ],
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Live Collaborative Notes</h3>
          {isConnected ? (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-gray-400"></span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {isConnected ? 'Syncing in real-time...' : 'Offline'}
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden" style={{ minHeight: '300px' }}>
        <ReactQuill 
          theme="snow" 
          value={editorText} 
          onChange={handleEditorChange}
          modules={modules}
          className="h-full flex flex-col"
          placeholder="Start typing notes collaboratively..."
        />
      </div>
      <style>{`
        .ql-container {
          flex: 1;
          overflow-y: auto;
          font-size: 14px;
        }
        .ql-toolbar {
          border-left: none !important;
          border-right: none !important;
          border-top: none !important;
          background-color: transparent;
        }
        .dark .ql-toolbar .ql-stroke {
          stroke: #9CA3AF;
        }
        .dark .ql-toolbar .ql-fill {
          fill: #9CA3AF;
        }
        .dark .ql-toolbar .ql-picker {
          color: #9CA3AF;
        }
        .dark .ql-editor.ql-blank::before {
          color: #6B7280;
        }
      `}</style>
    </div>
  );
}
