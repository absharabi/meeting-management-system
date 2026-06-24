"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import MeetingAISummary from "../../../../../components/MeetingAISummary";

export default function AiMomDraftPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  if (!meetingId) return null;

  return (
    <main className="bg-gray-50/50 px-4 py-6 dark:bg-gray-950/50 md:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/meetings/${meetingId}/mom`)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={16} />
          Back to MoM
        </button>
        <MeetingAISummary meetingId={meetingId} momMode />
      </div>
    </main>
  );
}
