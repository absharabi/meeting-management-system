"use client";

import React, { useState, useEffect } from 'react';
import Navbar from '../../../components/Navbar';
import Sidebar from '../../../components/Sidebar';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'react-hot-toast';
import { CheckCircle, Clock, CheckSquare } from 'lucide-react';

interface User {
  id?: string;
  name?: string;
  role?: string;
  [key: string]: any;
}

interface ActionItem {
  _id: string;
  title: string;
  description?: string;
  status: 'To Do' | 'In Progress' | 'Done';
  dueDate?: string;
  meetingId?: { _id: string; title: string };
}

// Droppable Column Component
const DroppableColumn = ({ id, title, count, children, bgClass, textClass, borderClass }: any) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`${bgClass} rounded-2xl p-4 flex flex-col border ${isOver ? 'border-blue-500 ring-2 ring-blue-500/20' : borderClass} transition-all`}
    >
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className={`font-semibold ${textClass}`}>{title}</h3>
        <span className="bg-black/5 dark:bg-white/10 text-xs font-bold px-2 py-1 rounded-full">{count}</span>
      </div>
      <div className="flex-1 flex flex-col gap-3 min-h-[200px]">
        {children}
      </div>
    </div>
  );
};

// Draggable Item Component
const SortableItem = ({ item }: { item: ActionItem }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">{item.title}</h4>
      {item.meetingId && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate border-b border-gray-100 dark:border-gray-700 pb-2">
          Meeting: {item.meetingId.title}
        </p>
      )}
      {item.dueDate && (
        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500 font-medium bg-amber-50 dark:bg-amber-900/20 w-fit px-2 py-1 rounded-md mt-2">
          <Clock size={12} />
          {new Date(item.dueDate).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

export default function ActionItemsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) setCurrentUser(JSON.parse(userStr));
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('http://localhost:5000/api/action-items/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error('Error fetching items', error);
      toast.error('Failed to load action items');
    } finally {
      setLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const newStatus = over.id as 'To Do' | 'In Progress' | 'Done';

    const item = items.find(i => i._id === itemId);
    if (item && item.status !== newStatus) {
      // Optimistic update
      setItems(prev => prev.map(i => i._id === itemId ? { ...i, status: newStatus } : i));

      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`http://localhost:5000/api/action-items/${itemId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('Failed to update');
        toast.success(`Moved to ${newStatus}`);
      } catch (error) {
        toast.error('Error updating status');
        fetchItems(); // Revert on failure
      }
    }
  };

  const getItemsByStatus = (status: string) => items.filter(item => item.status === status);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} userRole={currentUser?.role} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} searchQuery="" onSearchChange={() => {}} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <CheckSquare className="text-blue-600" /> My Action Items
              </h1>
              <p className="text-gray-500 mt-1">Manage tasks assigned to you from all meetings.</p>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">Loading your tasks...</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[500px]">
                  
                  {/* To Do Column */}
                  <DroppableColumn 
                    id="To Do" 
                    title="To Do" 
                    count={getItemsByStatus('To Do').length}
                    bgClass="bg-gray-100 dark:bg-gray-900/50"
                    textClass="text-gray-700 dark:text-gray-300"
                    borderClass="border-gray-200 dark:border-gray-800"
                  >
                    <SortableContext id="To Do" items={getItemsByStatus('To Do').map(i => i._id)} strategy={verticalListSortingStrategy}>
                      {getItemsByStatus('To Do').map(item => <SortableItem key={item._id} item={item} />)}
                    </SortableContext>
                  </DroppableColumn>

                  {/* In Progress Column */}
                  <DroppableColumn 
                    id="In Progress" 
                    title="In Progress" 
                    count={getItemsByStatus('In Progress').length}
                    bgClass="bg-blue-50/50 dark:bg-blue-900/10"
                    textClass="text-blue-700 dark:text-blue-400"
                    borderClass="border-blue-100 dark:border-blue-900/30"
                  >
                    <SortableContext id="In Progress" items={getItemsByStatus('In Progress').map(i => i._id)} strategy={verticalListSortingStrategy}>
                      {getItemsByStatus('In Progress').map(item => <SortableItem key={item._id} item={item} />)}
                    </SortableContext>
                  </DroppableColumn>

                  {/* Done Column */}
                  <DroppableColumn 
                    id="Done" 
                    title="Done" 
                    count={getItemsByStatus('Done').length}
                    bgClass="bg-green-50/50 dark:bg-green-900/10"
                    textClass="text-green-700 dark:text-green-400"
                    borderClass="border-green-100 dark:border-green-900/30"
                  >
                    <SortableContext id="Done" items={getItemsByStatus('Done').map(i => i._id)} strategy={verticalListSortingStrategy}>
                      {getItemsByStatus('Done').map(item => <SortableItem key={item._id} item={item} />)}
                    </SortableContext>
                  </DroppableColumn>

                </div>
              </DndContext>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
