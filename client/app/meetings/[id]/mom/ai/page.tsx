"use client";

import React from "react";
import { useParams } from "next/navigation";
import MeetingAISummary from "../../../../../components/MeetingAISummary";

export default function AiMomDraftPage() {
  const params = useParams();
  const meetingId = params.id as string;

  if (!meetingId) return null;

  return (
    <main className="bg-gray-50/50 px-4 py-6 dark:bg-gray-950/50 md:px-8">
      <div className="mx-auto max-w-7xl">
        <MeetingAISummary meetingId={meetingId} momMode />
      </div>
    </main>
  );
}
