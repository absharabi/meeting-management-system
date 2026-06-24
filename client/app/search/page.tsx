"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Calendar, FileText, ChevronRight, FileSearch } from "lucide-react";

export default function SearchResultsPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q) return;
    const fetchResults = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings/search?q=${encodeURIComponent(q)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
        if (!res.ok) throw new Error('Failed to fetch results');
        const data = await res.json();
        setResults(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [q]);

  if (!q) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Search</h1>
        <p className="text-gray-500">Please enter a search query in the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Search className="text-blue-500" size={28} />
          Search Results
        </h1>
        <p className="text-gray-500 mt-2">
          Showing results for <span className="font-semibold text-gray-900 dark:text-white">"{q}"</span>
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
          <FileSearch className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No matches found</h3>
          <p className="text-gray-500">We couldn't find any meetings or MoMs matching your keyword.</p>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="space-y-6">
          {results.map((meeting) => (
            <div key={meeting._id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 transition-colors shadow-sm">
              <div className="p-5">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {meeting.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1 font-medium"><Calendar size={14} className="text-blue-500"/> {new Date(meeting.date).toDateString()}</span>
                      <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-gray-300"></span> {meeting.startTime} - {meeting.endTime || 'End'}</span>
                      {meeting.venue && <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-gray-300"></span> {meeting.venue}</span>}
                      {meeting.mode && <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-gray-300"></span> {meeting.mode}</span>}
                      {meeting.meetingType && <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-gray-300"></span> {meeting.meetingType}</span>}
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${meeting.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                        {meeting.status}
                      </span>
                    </div>
                  </div>
                </div>
                
                {meeting.description && (
                  <div 
                    className="text-sm text-gray-700 dark:text-gray-300 mt-2 mb-4 prose prose-sm dark:prose-invert max-w-none line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: meeting.description }}
                  />
                )}

                {/* MoM Preview Section */}
                {(meeting.aiSummary || (meeting.aiDecisions && meeting.aiDecisions.length > 0)) && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                      <FileText size={14} className="text-blue-500" /> MoM Preview / Report
                    </h4>
                    {meeting.aiSummary && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                        {meeting.aiSummary}
                      </p>
                    )}
                    {meeting.aiDecisions && meeting.aiDecisions.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Key Decisions</h5>
                        <ul className="list-disc pl-4 space-y-1">
                          {meeting.aiDecisions.slice(0, 2).map((dec: string, idx: number) => (
                            <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{dec}</li>
                          ))}
                          {meeting.aiDecisions.length > 2 && (
                            <li className="text-xs text-blue-500 italic">+{meeting.aiDecisions.length - 2} more...</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-3">
                  <Link 
                    href={`/meetings/${meeting._id}`}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Calendar size={16} /> View Full Meeting Details
                  </Link>
                  <Link 
                    href={`/meetings/${meeting._id}/mom`}
                    className="flex items-center gap-2 text-sm font-medium text-white hover:bg-blue-700 bg-blue-600 px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <FileText size={16} /> Open Complete MoM <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
