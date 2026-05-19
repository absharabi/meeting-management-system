import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  description?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, description }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-all duration-200">
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      {description && (
        <div className="mt-4 flex items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">{description}</span>
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
