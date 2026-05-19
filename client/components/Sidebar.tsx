import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, Calendar, X, LogOut } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">MMS</h2>
          <button onClick={onClose} className="md:hidden p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium transition-colors">
            <LayoutDashboard size={18} />
            Dashboard
          </Link>
          <Link href="/meetings" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium">
            <Calendar size={18} />
            Meetings
          </Link>
          <Link href="/users" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium">
            <Users size={18} />
            Users
          </Link>
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium text-left">
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
