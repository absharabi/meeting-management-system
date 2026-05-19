"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';

export default function CalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Dummy data for days with meetings
  const meetingDays = [2, 5, 12, 14, 18, 22, 25, 26];

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Calendar</h2>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      <div className="text-center font-medium text-sm text-gray-800 dark:text-gray-200 mb-4">
        {format(currentDate, 'MMMM yyyy')}
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1 flex-1">
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="p-1" />
        ))}
        
        {daysInMonth.map((day, idx) => {
          const hasMeeting = meetingDays.includes(day.getDate());
          const today = isToday(day);
          
          return (
            <div key={idx} className="p-1 flex justify-center items-center aspect-square">
              <button 
                className={`
                  w-8 h-8 rounded-full flex justify-center items-center text-sm transition-colors
                  ${today ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
                  ${hasMeeting && !today ? 'border-b-2 border-blue-500 rounded-none pb-0.5' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
