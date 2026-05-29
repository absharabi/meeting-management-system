import React from 'react';
import { Activity, Settings, UserPlus, FileText } from 'lucide-react';

interface ActivityLog {
  id: string;
  action: string;
  details: string;
  time: string;
  type: string;
}

interface ActivityLogWidgetProps {
  logs: ActivityLog[];
}

export default function ActivityLogWidget({ logs }: ActivityLogWidgetProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'system': return <Settings size={16} className="text-blue-500" />;
      case 'meeting': return <Activity size={16} className="text-green-500" />;
      case 'report': return <FileText size={16} className="text-purple-500" />;
      case 'user': return <UserPlus size={16} className="text-amber-500" />;
      default: return <Activity size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 h-full flex flex-col">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">System Activity Logs</h2>
      
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            No recent activity yet.
          </div>
        ) : (
          <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3 space-y-6">
            {logs.map((log) => (
              <div key={log.id} className="relative pl-6">
                <span className="absolute -left-3.5 top-1 bg-white dark:bg-gray-900 p-1 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
                  {getIcon(log.type)}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{log.action}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{log.details}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
