"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface MeetingAISummaryProps {
  meetingId: string;
  meeting?: any;
  onUpdated?: (meeting: any) => void;
  momMode?: boolean;
}

const transcriptTypes = ".txt";
const audioTypes = ".wav,.mp3,.m4a";
const videoTypes = ".mp4,.mov,.webm";

export default function MeetingAISummary({ meetingId, meeting, onUpdated, momMode = false }: MeetingAISummaryProps) {
  const router = useRouter();
  const [localMeeting, setLocalMeeting] = useState<any>(meeting || null);
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraftingMom, setIsDraftingMom] = useState(false);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(!meeting);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftKeyPoints, setDraftKeyPoints] = useState("");
  const [draftDecisions, setDraftDecisions] = useState("");
  const [draftRisks, setDraftRisks] = useState("");
  const [draftActionItems, setDraftActionItems] = useState("");

  const displayedMeeting = meeting || localMeeting;

  const loadMeeting = useCallback(async () => {
    if (meeting) return;

    setIsLoadingMeeting(true);
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(
        momMode ? `http://localhost:5000/api/meetings/${meetingId}/mom` : "http://localhost:5000/api/meetings",
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load meeting summary.");
      setLocalMeeting(momMode ? data : data.find((item: any) => item._id === meetingId) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load meeting summary.");
    } finally {
      setIsLoadingMeeting(false);
    }
  }, [meeting, meetingId, momMode]);

  useEffect(() => {
    setLocalMeeting(meeting || null);
  }, [meeting]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  useEffect(() => {
    if (!displayedMeeting) return;
    setDraftSummary(displayedMeeting.aiSummary || "");
    setDraftKeyPoints((displayedMeeting.aiKeyPoints || []).join("\n"));
    setDraftDecisions((displayedMeeting.aiDecisions || []).join("\n"));
    setDraftRisks((displayedMeeting.aiRisks || []).join("\n"));
    setDraftActionItems(
      (displayedMeeting.aiActionItems || [])
        .map((item: any) => `${item.task || ""} | ${item.owner || "Unassigned"} | ${item.deadline || "Not mentioned"}`)
        .join("\n")
    );
  }, [displayedMeeting]);

  const splitLines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

  const parseActionItems = (value: string) => splitLines(value).map((line) => {
    const [task = "", owner = "Unassigned", deadline = "Not mentioned"] = line.split("|").map((item) => item.trim());
    return { task, owner, deadline };
  }).filter((item) => item.task);

  const generateSummary = async () => {
    if (!file) {
      setError("Choose a transcript, audio, or video file first.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setNotice("");

    try {
      const token = localStorage.getItem("accessToken");
      const formData = new FormData();
      formData.append("meetingFile", file);

      const response = await fetch(`http://localhost:5000/api/meetings/${meetingId}/summary`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to generate summary.");

      setLocalMeeting((current: any) => ({
        ...(current || {}),
        ...data.meeting,
        momCoverDetails: current?.momCoverDetails || data.meeting?.momCoverDetails,
        agendaItems: current?.agendaItems?.length ? current.agendaItems : data.meeting?.agendaItems,
      }));
      onUpdated?.(data.meeting);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate summary.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateMomDraft = async () => {
    if (!displayedMeeting?.aiSummary && !displayedMeeting?.aiKeyPoints?.length) {
      setError("Generate a meeting summary before creating a MoM draft.");
      return;
    }
    if (momMode && !isCoverComplete(displayedMeeting?.momCoverDetails)) {
      window.alert("Please complete the cover page details before approving the filled MoM.");
      return;
    }

    setIsDraftingMom(true);
    setError("");
    setNotice("");

    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`http://localhost:5000/api/meetings/${meetingId}/mom-draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          summary: draftSummary,
          keyPoints: splitLines(draftKeyPoints),
          decisions: splitLines(draftDecisions),
          risks: splitLines(draftRisks),
          actionItems: parseActionItems(draftActionItems),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to generate MoM draft.");

      setLocalMeeting(data.meeting);
      onUpdated?.(data.meeting);
      setNotice("The remaining MoM boxes were filled. Opening the review and export page...");
      if (momMode) {
        router.push(`/meetings/${meetingId}/mom`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate MoM draft.");
    } finally {
      setIsDraftingMom(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {momMode ? "Minutes of Meeting Draft" : "Meeting Summary"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {momMode
              ? "Use the meeting details and agenda already in the MoM, then fill the remaining boxes from the post-meeting transcript."
              : "Upload a transcript first, or use audio/video once Whisper and FFmpeg are ready."}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <UploadChoice label="Upload Transcript" accept={transcriptTypes} onSelect={setFile} />
          <UploadChoice label="Upload Audio" accept={audioTypes} onSelect={setFile} />
          <UploadChoice label="Upload Video" accept={videoTypes} onSelect={setFile} />
          <button
            type="button"
            onClick={generateSummary}
            disabled={!file || isGenerating}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Generate Summary"}
          </button>
          <button
            type="button"
            onClick={generateMomDraft}
            disabled={isDraftingMom || (!displayedMeeting?.aiSummary && !displayedMeeting?.aiKeyPoints?.length)}
            className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-900/20"
          >
            {isDraftingMom ? "Filling Boxes..." : "Approve Fill"}
          </button>
          {momMode && (
            <button
              type="button"
              onClick={() => router.push(`/meetings/${meetingId}/mom`)}
              className="rounded-xl border border-green-200 px-4 py-2.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900/60 dark:text-green-300 dark:hover:bg-green-900/20"
            >
              Review & Export MoM
            </button>
          )}
        </div>
      </div>

      {file && <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">Selected: {file.name}</p>}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300">
          {notice}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {momMode ? (
          <>
            <EditBlock title="Summary" value={draftSummary} onChange={setDraftSummary} placeholder="Generate or write the summary..." />
            <EditBlock title="Key Points" value={draftKeyPoints} onChange={setDraftKeyPoints} placeholder="One key point per line" />
            <EditBlock title="Decisions" value={draftDecisions} onChange={setDraftDecisions} placeholder="One decision per line" />
            <EditBlock title="Risks" value={draftRisks} onChange={setDraftRisks} placeholder="One risk or blocker per line" />
          </>
        ) : (
          <>
            <SummaryBlock title="Summary">
              {isLoadingMeeting ? "Loading..." : displayedMeeting?.aiSummary || "No meeting summary generated yet."}
            </SummaryBlock>
            <SummaryList title="Key Points" items={displayedMeeting?.aiKeyPoints || []} />
            <SummaryList title="Decisions" items={displayedMeeting?.aiDecisions || []} />
            <SummaryList title="Risks" items={displayedMeeting?.aiRisks || []} />
          </>
        )}

        <div className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Action Items</h3>
          {momMode ? (
            <textarea
              value={draftActionItems}
              onChange={(event) => setDraftActionItems(event.target.value)}
              placeholder="One action item per line: Task | Owner | Deadline"
              className="min-h-40 w-full rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            />
          ) : displayedMeeting?.aiActionItems?.length ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {displayedMeeting.aiActionItems.map((item: any, index: number) => (
                    <tr key={`${item.task}-${index}`}>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{item.task}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.owner || "Unassigned"}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.deadline || "Not mentioned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
              No action items detected yet.
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          <SummaryBlock title="Transcript">
            {displayedMeeting?.aiTranscript || "No transcript saved yet."}
          </SummaryBlock>
        </div>
      </div>
    </section>
  );
}

function isCoverComplete(details?: any) {
  return Boolean(
    details?.meetingNumber?.trim?.() &&
    details?.meetingBody?.trim?.() &&
    details?.instituteName?.trim?.() &&
    details?.dateLine?.trim?.() &&
    details?.venueLine?.trim?.()
  );
}

function EditBlock({ title, value, onChange, placeholder }: { title: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-40 w-full rounded-xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
      />
    </div>
  );
}

function UploadChoice({ label, accept, onSelect }: { label: string; accept: string; onSelect: (file: File | null) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
      {label}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onSelect(event.target.files?.[0] || null)}
      />
    </label>
  );
}

function SummaryBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
      <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 p-4 text-sm leading-6 text-gray-700 dark:border-gray-800 dark:text-gray-300">
        {children}
      </div>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
      {items.length ? (
        <ul className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          None detected yet.
        </p>
      )}
    </div>
  );
}
