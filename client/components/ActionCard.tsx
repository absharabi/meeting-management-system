import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'red';
}

export default function ActionCard({ title, description, icon: Icon, onClick, color = 'blue' }: ActionCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-400 dark:hover:bg-blue-900/40',
    green: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800/30 dark:text-green-400 dark:hover:bg-green-900/40',
    purple: 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100 dark:bg-purple-900/20 dark:border-purple-800/30 dark:text-purple-400 dark:hover:bg-purple-900/40',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800/30 dark:text-amber-400 dark:hover:bg-amber-900/40',
    red: 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400 dark:hover:bg-red-900/40',
  };

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-6 text-center rounded-2xl border transition-all duration-200 w-full ${colorClasses[color]}`}
    >
      <div className="mb-3 p-3 rounded-full bg-white dark:bg-gray-800 shadow-sm">
        <Icon size={24} />
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[150px]">{description}</p>
    </button>
  );
}
