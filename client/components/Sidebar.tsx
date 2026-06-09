"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Calendar, X, LogOut, FileText } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, userRole = 'User' }) => {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-change'));
    router.push('/');
  };

  const [role, setRole] = React.useState(userRole);

  React.useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.role) {
          setRole(parsed.role);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const isAdminOrSuper = role === 'SuperAdmin' || role === 'Admin';
  const canManageMeetings = !isAdminOrSuper;
  const itemClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
      active
        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

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
          <Link href="/dashboard" className={itemClass(pathname === '/dashboard')}>
            <LayoutDashboard size={18} />
            Dashboard
          </Link>
          {!isAdminOrSuper && (
            <Link href="/meetings" className={itemClass(pathname === '/meetings' || (pathname.startsWith('/meetings') && pathname !== '/meetings/create'))}>
              <Calendar size={18} />
              Meetings
            </Link>
          )}
          <Link href="/mom" className={itemClass(pathname.startsWith('/mom'))}>
            <FileText size={18} />
            MoM Archive
          </Link>
          <Link href="/reports" className={itemClass(pathname.startsWith('/reports'))}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Reports
          </Link>
          
          {canManageMeetings && (
            <Link href="/meetings/create" className="flex items-center gap-3 px-4 py-3 ml-2 rounded-lg text-sm text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium">
              + New Meeting
            </Link>
          )}

          {isAdminOrSuper && (
            <Link href="/dashboard/users" className={itemClass(pathname.startsWith('/dashboard/users'))}>
              <Users size={18} />
              Users
            </Link>
          )}
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium text-left">
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
