"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowLeft, CheckCircle2, Download, Lock, Plus, RefreshCw, Save, ShieldCheck, Sparkles } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "react-quill-new/dist/quill.snow.css";
import AgendaItemForm from "@/components/mom/AgendaItemForm";
import SummaryTable from "@/components/mom/SummaryTable";
import { MemberPresent, MomAgendaItem, MomApprovalStatus, MomBlock, MomBlockType, MomCoverDetails, MomMeeting, MomStatus } from "@/components/mom/types";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings`;
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-800 dark:bg-gray-950 dark:text-white";
const logoPaths = ["/mom/nitc-logo.png", "/mom/nitc-logo.png.png"];
const buildingPaths = ["/mom/nitc-building.jpg", "/mom/nitc-building.jpeg"];

interface CurrentUser {
  id?: string;
  _id?: string;
  role?: string;
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

const emptyAgendaItem = (order: number): MomAgendaItem => ({
  _id: `local-${Date.now()}-${order}`,
  sourceAgendaId: null,
  itemNumber: "",
  sectionTag: "",
  sectionGroup: "Procedural",
  subject: "",
  backgroundNote: "",
  decision: "",
  actionRequired: "",
  responsiblePerson: "",
  targetDate: "",
  blocks: createPresetBlocks("Procedural"),
  order,
});

interface MeetingAgenda {
  _id: string;
  title: string;
  description?: string;
  status?: string;
  sequence?: number;
}

const defaultCoverDetails = (meeting?: MomMeeting | null): MomCoverDetails => ({
  meetingNumber: "71st",
  meetingBody: "Board of Governors",
  instituteName: "National Institute of Technology Calicut",
  dateLine: meeting ? `on ${formatDate(meeting.date)} from ${meeting.startTime || "start time"} to ${meeting.endTime || "end time"}` : "",
  venueLine: meeting ? `${meeting.mode || "Meeting"} mode at ${meeting.venue || meeting.link || "the notified venue"}` : "",
});

export default function MomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<MomMeeting | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [membersPresent, setMembersPresent] = useState<MemberPresent[]>([]);
  const [agendaItems, setAgendaItems] = useState<MomAgendaItem[]>([]);
  const [momCoverDetails, setMomCoverDetails] = useState<MomCoverDetails>(defaultCoverDetails());
  const [sourceAgendas, setSourceAgendas] = useState<MeetingAgenda[]>([]);
  const [momStatus, setMomStatus] = useState<MomStatus>("Draft");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  const loadMom = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (!params.id) throw new Error("Missing meeting id in the URL.");

      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const [momResponse, agendaResponse] = await Promise.all([
        fetch(`${API_BASE}/${params.id}/mom`, { headers }),
        fetch(`${API_BASE}/${params.id}/agendas`, { headers }),
      ]);
      const data = await readJsonResponse(momResponse);
      const agendaDataResponse = agendaResponse.ok ? await readJsonResponse(agendaResponse) : [];
      const agendaData = Array.isArray(agendaDataResponse) ? agendaDataResponse : [];
      if (!momResponse.ok) {
        throw new Error(data?.message || `Unable to load MoM. Server returned ${momResponse.status}.`);
      }
      if (!data || typeof data !== "object") {
        throw new Error("The server returned an empty MoM response.");
      }

      setMeeting(data);
      setMembersPresent(deriveMembersFromParticipants(data));
      setMomCoverDetails(mergeCoverDetails(data, data.momCoverDetails));
      setSourceAgendas(agendaData);
      setAgendaItems(mergeAgendaModuleItems(data.agendaItems || [], agendaData));
      setMomStatus(data.momStatus || "Draft");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load MoM.";
      setLoadError(message);
      setNotice({ message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadMom();
    });
  }, [loadMom]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return;
    try {
      queueMicrotask(() => {
        setCurrentUser(JSON.parse(storedUser));
      });
    } catch {
      queueMicrotask(() => {
        setCurrentUser(null);
      });
    }
  }, []);

  const sortableIds = useMemo(() => agendaItems.map((item, index) => item._id || `agenda-${index}`), [agendaItems]);
  const approvalStatus = useMemo(() => meeting?.momApprovalStatus || [], [meeting]);
  const allApproved = approvalStatus.length > 0 && approvalStatus.every((approval) => approval.approved);
  const pendingApprovals = approvalStatus.filter((approval) => !approval.approved);
  const isConfirmed = momStatus === "Confirmed";
  const currentUserId = currentUser?.id || currentUser?._id;
  const currentUserApproval = approvalStatus.find((approval) => approval.userId === currentUserId);

  const isOrganizerOrAdmin = Boolean(currentUser && meeting && (
    currentUser.role === "SuperAdmin" || 
    currentUser.role === "Admin" || 
    getOrganizerId(meeting.organizerId) === currentUserId ||
    meeting.organizerId === currentUserId
  ));
  const canEdit = isOrganizerOrAdmin && !isConfirmed;

  const previewMeeting = useMemo<MomMeeting | null>(() => {
    if (!meeting) return null;
    return { ...meeting, membersPresent: deriveMembersFromParticipants(meeting), agendaItems, momCoverDetails, momStatus };
  }, [agendaItems, meeting, momCoverDetails, momStatus]);

  const saveMom = async (status: MomStatus = momStatus) => {
    if (isConfirmed) {
      setNotice({ message: "This MoM is confirmed and locked. It cannot be changed.", type: "error" });
      return false;
    }
    if ((status === "Confirmed") && !isCoverComplete(momCoverDetails)) {
      window.alert("Please complete the cover page details before confirming the MoM.");
      return false;
    }
    if (status === "Confirmed" && !allApproved) {
      window.alert(`Everyone in the meeting must approve before confirmation. Pending: ${pendingApprovals.map((approval) => approval.name).join(", ") || "No reviewers found"}.`);
      return false;
    }

    setIsSaving(true);
    try {
      const payload = {
        membersPresent: meeting ? deriveMembersFromParticipants(meeting) : membersPresent,
        momCoverDetails: meeting ? mergeCoverDetails(meeting, momCoverDetails) : momCoverDetails,
        agendaItems: agendaItems.map((item, index) => {
          const { _id, ...rest } = item;
          return {
            ...normalizeAgendaItemForBlocks(rest as MomAgendaItem),
            ...(_id && !_id.startsWith("local-") ? { _id } : {}),
            order: index,
          };
        }),
        momStatus: status,
      };

      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const response = await fetch(`${API_BASE}/${params.id}/mom`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save MoM.");

      setMeeting(data);
      setMembersPresent(deriveMembersFromParticipants(data));
      setMomCoverDetails(mergeCoverDetails(data, data.momCoverDetails));
      setAgendaItems(normalizeAgendaItems(data.agendaItems || []));
      setMomStatus(data.momStatus || status);
      setNotice({ message: status === "Confirmed" ? "MoM confirmed." : "MoM draft saved.", type: "success" });
      return true;
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Unable to save MoM.", type: "error" });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!isCoverComplete(momCoverDetails)) {
      window.alert("Please complete the cover page details before exporting the MoM.");
      return;
    }
    if (!allApproved) {
      window.alert(`Everyone in the meeting must approve before export. Pending: ${pendingApprovals.map((approval) => approval.name).join(", ") || "No reviewers found"}.`);
      return;
    }
    if (!isConfirmed) {
      window.alert("Confirm the MoM before exporting. Confirming locks the document.");
      return;
    }
    if (!previewMeeting) return;

    try {
      await exportMomPdf(previewMeeting);
      setNotice({ message: "MoM PDF downloaded.", type: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Unable to export PDF.", type: "error" });
    }
  };

  const exportWord = () => {
    if (!isCoverComplete(momCoverDetails)) {
      window.alert("Please complete the cover page details before exporting the MoM.");
      return;
    }
    if (!allApproved) {
      window.alert(`Everyone in the meeting must approve before export. Pending: ${pendingApprovals.map((approval) => approval.name).join(", ") || "No reviewers found"}.`);
      return;
    }
    if (!isConfirmed) {
      window.alert("Confirm the MoM before exporting. Confirming locks the document.");
      return;
    }
    if (!previewMeeting) return;

    try {
      exportMomWord(previewMeeting);
      setNotice({ message: "MoM Word document downloaded.", type: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Unable to export Word document.", type: "error" });
    }
  };

  const updateAgendaItem = (index: number, item: MomAgendaItem) => {
    if (isConfirmed) return;
    setAgendaItems((current) => current.map((currentItem, itemIndex) => itemIndex === index ? item : currentItem));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (isConfirmed) return;
    if (!over || active.id === over.id) return;

    setAgendaItems((current) => {
      const oldIndex = current.findIndex((item, index) => (item._id || `agenda-${index}`) === active.id);
      const newIndex = current.findIndex((item, index) => (item._id || `agenda-${index}`) === over.id);
      return arrayMove(current, oldIndex, newIndex).map((item, index) => ({ ...item, order: index }));
    });
  };

  const syncAgendaModuleItems = async () => {
    if (isConfirmed) return;
    try {
      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_BASE}/${params.id}/agendas`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to sync agenda module.");
      setSourceAgendas(data);
      setAgendaItems((current) => mergeAgendaModuleItems(current, data));
      setNotice({ message: "Agenda module items synced into MoM.", type: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Unable to sync agenda module.", type: "error" });
    }
  };

  const openAiFillPage = async () => {
    if (isConfirmed) {
      setNotice({ message: "This MoM is confirmed and locked. Transcript fill is no longer available.", type: "error" });
      return;
    }
    const saved = await saveMom("Draft");
    if (saved) {
      router.push(`/meetings/${params.id}/mom/ai`);
    }
  };

  const approveMom = async () => {
    if (isConfirmed) return;
    try {
      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_BASE}/${params.id}/mom/approve`, {
        method: "POST",
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to approve MoM.");

      setMeeting(data);
      setMembersPresent(deriveMembersFromParticipants(data));
      setMomCoverDetails(mergeCoverDetails(data, data.momCoverDetails));
      setAgendaItems(normalizeAgendaItems(data.agendaItems || []));
      setMomStatus(data.momStatus || "Draft");
      setNotice({ message: "Your MoM approval has been recorded.", type: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Unable to approve MoM.", type: "error" });
    }
  };

  if (isLoading) {
    return <main className="min-h-screen bg-gray-50 p-8 text-gray-700 dark:bg-gray-950 dark:text-gray-200">Loading MoM...</main>;
  }

  if (!meeting || !previewMeeting) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/60 dark:bg-gray-900">
          <p className="text-sm font-semibold uppercase text-red-600 dark:text-red-400">MoM could not be loaded</p>
          <h1 className="mt-3 text-2xl font-bold">Open a valid meeting first</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            {loadError || "The meeting record was not found or the server did not return a valid MoM response."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => router.push("/meetings")} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Go to Meetings
            </button>
            <button onClick={loadMom} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-700 p-6 text-white shadow-lg shadow-blue-900/10">
          <button onClick={() => router.back()} className="mb-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-blue-100">Minutes of Meeting</p>
              <h1 className="mt-2 text-3xl font-bold">{meeting.title}</h1>
              <p className="mt-2 text-sm text-blue-100">{new Date(meeting.date).toLocaleDateString()} | {meeting.venue || meeting.link || "Venue not specified"}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canEdit && (
                <>
                  <button onClick={() => saveMom("Draft")} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">
                    <Save size={16} />
                    Save Draft
                  </button>
                  <button onClick={() => saveMom("Confirmed")} disabled={isSaving || !allApproved} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60">
                    <ShieldCheck size={16} />
                    {isConfirmed ? "Confirmed" : "Confirm"}
                  </button>
                </>
              )}
              <button onClick={exportPdf} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20">
                <Download size={16} />
                Export PDF
              </button>
              <button onClick={exportWord} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20">
                <Download size={16} />
                Export Word
              </button>
            </div>
          </div>
        </header>

        {notice && (
          <div className={`rounded-xl border p-4 text-sm font-semibold ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300" : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"}`}>
            {notice.message}
          </div>
        )}

        {isConfirmed && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
            <Lock size={18} />
            This MoM is confirmed and locked. No further edits, agenda changes, transcript fills, or approvals can be made.
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white">Meeting Details</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pulled directly from the meeting module.</p>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <InfoRow label="Title" value={meeting.title} />
            <InfoRow label="Type" value={meeting.meetingType || "Meeting"} />
            <InfoRow label="Date" value={formatDate(meeting.date)} />
            <InfoRow label="Time" value={`${meeting.startTime || "-"} to ${meeting.endTime || "-"}`} />
            <InfoRow label="Mode" value={meeting.mode || "-"} />
            <InfoRow label="Venue / Link" value={meeting.venue || meeting.link || "-"} />
          </dl>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white">Cover Details</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">These fields control the first page of the official MoM template.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CoverField label="Meeting Number">
              <input disabled={!canEdit} value={momCoverDetails.meetingNumber} onChange={(event) => setMomCoverDetails((current) => ({ ...current, meetingNumber: event.target.value }))} className={inputClass} placeholder="71st" />
            </CoverField>
            <CoverField label="Meeting Body">
              <input disabled={!canEdit} value={momCoverDetails.meetingBody} onChange={(event) => setMomCoverDetails((current) => ({ ...current, meetingBody: event.target.value }))} className={inputClass} placeholder="Board of Governors" />
            </CoverField>
            <CoverField label="Institute Name">
              <input disabled={!canEdit} value={momCoverDetails.instituteName} onChange={(event) => setMomCoverDetails((current) => ({ ...current, instituteName: event.target.value }))} className={inputClass} placeholder="National Institute of Technology Calicut" />
            </CoverField>
            <CoverField label="Date Line">
              <input readOnly value={momCoverDetails.dateLine} className={`${inputClass} cursor-not-allowed bg-gray-50 dark:bg-gray-900`} />
            </CoverField>
            <div className="md:col-span-2">
              <CoverField label="Venue / Mode Line">
                <input readOnly value={momCoverDetails.venueLine} className={`${inputClass} cursor-not-allowed bg-gray-50 dark:bg-gray-900`} />
              </CoverField>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">MoM Approvals</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Everyone in the meeting must approve before the MoM can be confirmed and exported.
              </p>
            </div>
            <button
              type="button"
              onClick={approveMom}
              disabled={isConfirmed || !currentUserId || currentUserApproval?.approved}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              {currentUserApproval?.approved ? "Approved" : "Approve MoM"}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {approvalStatus.map((approval) => (
                  <tr key={approval.userId} className="bg-white dark:bg-gray-900">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{approval.name || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{approval.department || "-"}</td>
                    <td className="px-4 py-3">
                      <ApprovalBadge approval={approval} />
                    </td>
                  </tr>
                ))}
                {approvalStatus.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No meeting members found for approval.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!allApproved && (
            <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">
              Pending: {pendingApprovals.map((approval) => approval.name).join(", ") || "No reviewers found"}.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white">Invited Participants</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Automatically copied from the meeting module. Add or remove invitees from Edit Meeting.</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Attendance Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {membersPresent.map((member, index) => (
                  <tr key={`${member.name}-${index}`} className="bg-white dark:bg-gray-900">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{member.name || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{member.designation || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{member.attendanceMode || "-"}</td>
                  </tr>
                ))}
                {membersPresent.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No participants invited in the meeting module.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-900/10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">MoM Agenda Items</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Pulled from the agenda module. {sourceAgendas.length} agenda item{sourceAgendas.length === 1 ? "" : "s"} found; add extra MoM items only when needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canEdit && (
              <>
                <button onClick={syncAgendaModuleItems} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-blue-900/20">
                  <RefreshCw size={16} />
                  Sync Agenda Module
                </button>
                <button onClick={() => setAgendaItems((current) => [...current, emptyAgendaItem(current.length)])} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700">
                  <Plus size={16} />
                  Add Extra MoM Item
                </button>
                <button onClick={openAiFillPage} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                  <Sparkles size={16} />
                  Fill Remaining Boxes from Transcript
                </button>
              </>
            )}
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {agendaItems.map((item, index) => (
                <AgendaItemForm
                  key={item._id || `agenda-${index}`}
                  item={item}
                  index={index}
                  onChange={(nextItem) => updateAgendaItem(index, nextItem)}
                  onRemove={() => setAgendaItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={!canEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <SummaryTable items={agendaItems} />
      </div>
    </main>
  );
}

function CoverField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      {children}
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
      <dt className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

function ApprovalBadge({ approval }: { approval: MomApprovalStatus }) {
  if (approval.approved) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        Approved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      Pending
    </span>
  );
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function deriveMembersFromParticipants(meeting: MomMeeting): MemberPresent[] {
  const mode = meeting.mode === "Online" ? "Online" : meeting.mode === "Hybrid" ? "Hybrid" : "In person";

  return (meeting.participants || [])
    .map((participant) => {
      const user = participant.user;
      if (!user || typeof user === "string") return null;

      return {
        name: user.name || user.email || "Unnamed participant",
        designation: user.department || "Invited participant",
        attendanceMode: mode,
      };
    })
    .filter((member): member is MemberPresent => Boolean(member));
}

function mergeCoverDetails(meeting: MomMeeting, details?: Partial<MomCoverDetails> | null): MomCoverDetails {
  const derived = defaultCoverDetails(meeting);
  return {
    ...derived,
    ...(details || {}),
    dateLine: derived.dateLine,
    venueLine: derived.venueLine,
  };
}

function isCoverComplete(details: MomCoverDetails) {
  return Boolean(
    details.meetingNumber?.trim() &&
    details.meetingBody?.trim() &&
    details.instituteName?.trim() &&
    details.dateLine?.trim() &&
    details.venueLine?.trim()
  );
}

function getOrganizerId(organizer: MomMeeting["organizerId"]) {
  return typeof organizer === "string" ? organizer : organizer?._id || organizer?.id || "";
}

const blockLabels: Record<MomBlockType, string> = {
  backgroundNote: "Background Note",
  decision: "Decision",
  actionRequired: "Action Required",
  responsiblePerson: "Responsible Person",
  targetDate: "Target Date",
  annexureReference: "Annexure Reference",
  status: "Status",
  table: "Table",
  customField: "Custom Field",
};

const presetBlockTypes: Record<MomAgendaItem["sectionGroup"], MomBlockType[]> = {
  "Procedural": ["backgroundNote", "decision"],
  "Consideration & Approval": ["backgroundNote", "decision", "actionRequired", "responsiblePerson", "targetDate"],
  "Reporting": ["backgroundNote", "decision", "status"],
  "Any Other Matter": ["backgroundNote", "decision"],
};

function createPresetBlocks(sectionGroup: MomAgendaItem["sectionGroup"], values: Partial<Record<MomBlockType, string>> = {}) {
  return presetBlockTypes[sectionGroup].map((type) => ({
    type,
    label: blockLabels[type],
    value: values[type] || (type === "status" ? "Pending" : ""),
  }));
}

function normalizeBlocks(item: MomAgendaItem): MomBlock[] {
  if (Array.isArray(item.blocks) && item.blocks.length) {
    return item.blocks.map((block) => ({
      type: block.type,
      label: block.label || blockLabels[block.type] || "Field",
      value: block.type === "table" ? normalizeTableValue(block.value) : String(block.value || ""),
    }));
  }

  return createPresetBlocks(item.sectionGroup || "Procedural", {
    backgroundNote: item.backgroundNote || "",
    decision: item.decision || "",
    actionRequired: item.actionRequired || "",
    responsiblePerson: item.responsiblePerson || "",
    targetDate: item.targetDate || "",
  });
}

function normalizeAgendaItemForBlocks(item: MomAgendaItem): MomAgendaItem {
  const blocks = normalizeBlocks(item);
  const getBlockValue = (type: MomBlockType) => String(blocks.find((block) => block.type === type)?.value || "");

  return {
    ...item,
    blocks,
    backgroundNote: getBlockValue("backgroundNote"),
    decision: getBlockValue("decision"),
    actionRequired: getBlockValue("actionRequired"),
    responsiblePerson: getBlockValue("responsiblePerson"),
    targetDate: getBlockValue("targetDate"),
  };
}

function normalizeAgendaItems(items: MomAgendaItem[]) {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => normalizeAgendaItemForBlocks({ ...item, order: index }));
}

function normalizeTableValue(value: MomBlock["value"]) {
  if (typeof value === "object" && value && Array.isArray(value.columns) && Array.isArray(value.rows)) {
    return {
      columns: value.columns.map(String),
      rows: value.rows.map((row) => Array.isArray(row) ? row.map(String) : []),
    };
  }

  return { columns: ["Column 1", "Column 2"], rows: [["", ""]] };
}

function compactTableValue(value: MomBlock["value"]) {
  const table = normalizeTableValue(value);
  const visibleColumnIndexes = table.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => column.trim() || table.rows.some((row) => String(row[index] || "").trim()))
    .map(({ index }) => index);
  const rows = table.rows
    .map((row) => visibleColumnIndexes.map((index) => String(row[index] || "")))
    .filter((row) => row.some((cell) => cell.trim()));

  return {
    columns: visibleColumnIndexes.map((index) => table.columns[index] || `Column ${index + 1}`),
    rows,
  };
}

function hasBlockDisplayValue(block: MomBlock) {
  if (block.type === "table") {
    const table = compactTableValue(block.value);
    return table.columns.length > 0 && table.rows.length > 0;
  }
  return stripHtml(String(block.value || "")).length > 0;
}

function visibleBlocks(item: MomAgendaItem) {
  return normalizeBlocks(item).filter(hasBlockDisplayValue);
}

function getBlockText(item: MomAgendaItem, type: MomBlockType) {
  const block = normalizeBlocks(item).find((currentBlock) => currentBlock.type === type);
  if (!block || block.type === "table") return "";
  return String(block.value || "");
}

function getBlockDisplayValue(block: MomBlock) {
  if (block.type === "table") return "";
  if (block.type === "backgroundNote" || block.type === "decision") return stripHtml(String(block.value || ""));
  if (block.type === "targetDate") return formatDate(String(block.value || ""));
  return String(block.value || "").trim();
}

function mergeAgendaModuleItems(existingItems: MomAgendaItem[], agendaModuleItems: MeetingAgenda[]) {
  const agendaById = new Map(agendaModuleItems.map((agenda) => [agenda._id, agenda]));
  const sortedExisting = [...existingItems]
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const sourceAgendaKey = item.sourceAgendaId ? String(item.sourceAgendaId) : "";
      const sourceAgenda = sourceAgendaKey ? agendaById.get(sourceAgendaKey) : null;
      if (!sourceAgenda) return normalizeAgendaItemForBlocks(item);

      const updatedBlocks = normalizeBlocks(item).map((block) => (
        block.type === "backgroundNote"
          ? { ...block, value: sourceAgenda.description || String(block.value || "") }
          : block
      ));
      return normalizeAgendaItemForBlocks({
        ...item,
        itemNumber: item.itemNumber || String(sourceAgenda.sequence || item.order + 1).padStart(2, "0"),
        subject: sourceAgenda.title || item.subject,
        backgroundNote: sourceAgenda.description || item.backgroundNote,
        blocks: updatedBlocks,
      });
    });
  const existingBySource = new Set(sortedExisting.map((item) => item.sourceAgendaId ? String(item.sourceAgendaId) : "").filter(Boolean));
  const agendaItems = [...agendaModuleItems].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const importedItems = agendaItems
    .filter((agenda) => !existingBySource.has(agenda._id))
    .map((agenda, index) => normalizeAgendaItemForBlocks({
      _id: `local-agenda-${agenda._id}`,
      sourceAgendaId: agenda._id,
      itemNumber: String((agenda.sequence || index + 1)).padStart(2, "0"),
      sectionTag: "",
      sectionGroup: "Procedural" as const,
      subject: agenda.title || "",
      backgroundNote: agenda.description || "",
      decision: "",
      actionRequired: "",
      responsiblePerson: "",
      targetDate: "",
      order: sortedExisting.length + index,
    }));

  return [...sortedExisting, ...importedItems].map((item, index) => ({ ...item, order: index }));
}

async function loadImage(paths: string[]) {
  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return dataUrl;
    } catch {
      continue;
    }
  }

  return null;
}

async function exportMomPdf(meeting: MomMeeting) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cover = { ...defaultCoverDetails(meeting), ...(meeting.momCoverDetails || {}) };
  const logo = await loadImage(logoPaths);
  const building = await loadImage(buildingPaths);
  const margin = 48;
  const agendaItems = [...(meeting.agendaItems || [])].sort((a, b) => a.order - b.order);

  drawOfficialCover(doc, {
    pageWidth,
    pageHeight,
    cover,
    meeting,
    logo,
    building,
  });

  doc.addPage();
  drawPageHeader(doc, meeting, 2);
  let y = 94;
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 35, 60);
  doc.text("Minutes of Meeting", margin, y);
  y += 24;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { font: "times", fontSize: 10, cellPadding: 6, lineColor: [180, 190, 200], lineWidth: 0.5, textColor: [20, 35, 60] },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [242, 246, 250], cellWidth: 135 },
      1: { cellWidth: pageWidth - margin * 2 - 135 },
    },
    body: [
      ["Meeting", `${cover.meetingNumber || "Nth"} Meeting of the ${cover.meetingBody || "Board of Governors"}`],
      ["Institute", cover.instituteName || "National Institute of Technology Calicut"],
      ["Date", cover.dateLine || formatDate(meeting.date)],
      ["Venue / Mode", cover.venueLine || meeting.venue || meeting.link || "Not specified"],
      ["Status", meeting.momStatus || "Draft"],
    ],
  });

  y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || y) + 30;
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("Members Present", margin, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: margin, right: margin },
    head: [["Sl. No.", "Name", "Designation", "Mode"]],
    body: meeting.membersPresent.length
      ? meeting.membersPresent.map((member, index) => [
          String(index + 1),
          member.name || "-",
          member.designation || "-",
          member.attendanceMode || "-",
        ])
      : [["-", "No members recorded", "-", "-"]],
    styles: { font: "times", fontSize: 9.5, cellPadding: 5, lineColor: [190, 198, 208], lineWidth: 0.4, textColor: [25, 35, 50] },
    headStyles: { fillColor: [21, 45, 78], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 50, halign: "center" }, 3: { cellWidth: 80 } },
    didDrawPage: () => drawPageHeader(doc, meeting, doc.getNumberOfPages()),
  });

  y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || y) + 30;
  y = ensureSpace(doc, y, 120, meeting);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 35, 60);
  doc.text("Agenda Items and Decisions", margin, y);
  y += 22;

  const groups: MomAgendaItem["sectionGroup"][] = ["Procedural", "Consideration & Approval", "Reporting", "Any Other Matter"];
  groups.forEach((group) => {
    const groupItems = agendaItems.filter((item) => item.sectionGroup === group);
    if (!groupItems.length) return;

    y = ensureSpace(doc, y, 64, meeting);
    doc.setFillColor(235, 242, 249);
    doc.rect(margin, y - 12, pageWidth - margin * 2, 24, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(21, 70, 120);
    doc.text(group, margin + 8, y + 4);
    y += 30;

    groupItems.forEach((item, index) => {
      const agendaNo = [item.sectionTag, item.itemNumber || String(index + 1).padStart(2, "0")].filter(Boolean).join(" / ");
      y = ensureSpace(doc, y, 150, meeting);
      const itemStartY = y - 16;
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      const titleLines = doc.splitTextToSize(`${agendaNo ? `Item ${agendaNo}. ` : `Item ${String(index + 1).padStart(2, "0")}. `}${item.subject || "Untitled agenda item"}`, pageWidth - margin * 2 - 16);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 14 + 8;

      visibleBlocks(item).forEach((block) => {
        if (block.type === "table") {
          y = writeOfficialTable(doc, block, margin + 14, y, pageWidth, meeting);
          return;
        }
        y = writeOfficialBlock(doc, block.label, getBlockDisplayValue(block), margin, y, pageWidth, meeting);
      });
      doc.setDrawColor(190, 198, 208);
      doc.setLineWidth(0.4);
      doc.rect(margin - 8, itemStartY, pageWidth - margin * 2 + 16, Math.max(36, y - itemStartY), "S");
      y += 10;
    });
  });

  if (!agendaItems.length) {
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text("No agenda items recorded.", margin, y);
    y += 20;
  }

  doc.addPage();
  drawPageHeader(doc, meeting, doc.getNumberOfPages());
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 35, 60);
  doc.text("Action Taken Summary", margin, 94);

  const actionRows = agendaItems
    .map((item, index) => ({
      agendaNo: item.itemNumber || String(index + 1).padStart(2, "0"),
      decisionAction: stripHtml(getBlockText(item, "decision")) || getBlockText(item, "actionRequired"),
      responsibility: getBlockText(item, "responsiblePerson"),
      targetDate: formatDate(getBlockText(item, "targetDate")),
    }))
    .filter((row) => row.decisionAction || row.responsibility || row.targetDate);
  const actionColumns = [
    { header: "Agenda No.", key: "agendaNo", visible: true },
    { header: "Decision / Action", key: "decisionAction", visible: actionRows.some((row) => row.decisionAction) },
    { header: "Responsibility", key: "responsibility", visible: actionRows.some((row) => row.responsibility) },
    { header: "Target Date", key: "targetDate", visible: actionRows.some((row) => row.targetDate) },
  ].filter((column) => column.visible);

  autoTable(doc, {
    startY: 112,
    theme: "grid",
    margin: { left: margin, right: margin },
    head: [actionColumns.map((column) => column.header)],
    body: actionRows.length
      ? actionRows.map((row) => actionColumns.map((column) => row[column.key as keyof typeof row] || "-"))
      : [actionColumns.map((_, index) => index === 0 ? "No action items recorded" : "-")],
    styles: { font: "times", fontSize: 9, cellPadding: 5, valign: "top", lineColor: [190, 198, 208], lineWidth: 0.4, textColor: [25, 35, 50] },
    headStyles: { fillColor: [21, 45, 78], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70, halign: "center" },
      1: { cellWidth: 250 },
      2: { cellWidth: 115 },
      3: { cellWidth: 65, halign: "center" },
    },
    didDrawPage: () => drawPageHeader(doc, meeting, doc.getNumberOfPages()),
  });

  y = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || 112) + 44;
  y = ensureSpace(doc, y, 120, meeting);
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(25, 35, 50);
  doc.text("The meeting ended with thanks to the Chair.", margin, y);
  y += 64;
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 35, 60);
  doc.text("Approved By", margin, y + 16);

  y += 36;
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(25, 35, 50);

  const approvalStatus = meeting.momApprovalStatus || [];
  const approvedMembers = approvalStatus.filter((a) => a.approved);

  if (approvedMembers.length > 0) {
    approvedMembers.forEach((member) => {
      y = ensureSpace(doc, y, 16, meeting);
      doc.text(`${member.name} (${member.department || "Member"})`, margin, y);
      y += 16;
    });
  } else {
    doc.text("No approvals recorded.", margin, y);
  }

  addPageNumbers(doc, meeting);

  doc.save(`${meeting.title.replace(/[^a-z0-9]+/gi, "-") || "mom"}.pdf`);
}

function exportMomWord(meeting: MomMeeting) {
  const cover = { ...defaultCoverDetails(meeting), ...(meeting.momCoverDetails || {}) };
  const agendaItems = [...(meeting.agendaItems || [])].sort((a, b) => a.order - b.order);
  const groups: MomAgendaItem["sectionGroup"][] = ["Procedural", "Consideration & Approval", "Reporting", "Any Other Matter"];
  const approvalStatus = meeting.momApprovalStatus || [];
  const approvedMembers = approvalStatus.filter((approval) => approval.approved);

  const agendaHtml = groups.map((group) => {
    const groupItems = agendaItems.filter((item) => item.sectionGroup === group);
    if (!groupItems.length) return "";

    return `
      <h2>${escapeHtml(group)}</h2>
      ${groupItems.map((item, index) => {
        const agendaNo = [item.sectionTag, item.itemNumber || String(index + 1).padStart(2, "0")].filter(Boolean).join(" / ");
        return `
          <div class="agenda-box">
          <h3>${escapeHtml(`${agendaNo ? `Item ${agendaNo}. ` : `Item ${String(index + 1).padStart(2, "0")}. `}${item.subject || "Untitled agenda item"}`)}</h3>
          ${visibleBlocks(item).map((block) => {
            if (block.type === "table") return tableBlockToHtml(block);
            return `<p class="block"><strong>${escapeHtml(block.label)}:</strong> ${escapeHtml(getBlockDisplayValue(block)).replace(/\n/g, "<br>")}</p>`;
          }).join("")}
          </div>
        `;
      }).join("")}
    `;
  }).join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0.7in; }
          body { font-family: "Times New Roman", serif; color: #111827; font-size: 11pt; line-height: 1.35; }
          h1 { font-size: 18pt; text-align: center; margin: 0 0 18pt; }
          h2 { font-size: 13pt; background: #eef3f8; color: #153654; padding: 6pt; margin: 18pt 0 8pt; }
          h3 { font-size: 12pt; margin: 12pt 0 6pt; }
          .header { text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 18pt; }
          .meta, .members, .data-table { border-collapse: collapse; width: 100%; margin: 8pt 0 16pt; }
          .meta td, .members th, .members td, .data-table th, .data-table td { border: 1px solid #b9c1cc; padding: 5pt; vertical-align: top; }
          .meta td:first-child, .members th, .data-table th { font-weight: bold; background: #f2f6fa; }
          .agenda-box { border: 1px solid #b9c1cc; padding: 8pt; margin: 8pt 0 12pt; }
          .block { border-top: 1px solid #d5dbe3; margin: 8pt 0 8pt; padding: 5pt 0 0; }
          .footer { mso-element: footer; text-align: center; color: #5b6472; font-size: 9pt; }
        </style>
      </head>
      <body>
        <div class="header">National Institute of Technology Calicut</div>
        <h1>Minutes of Meeting</h1>
        <table class="meta">
          <tr><td>Meeting</td><td>${escapeHtml(`${cover.meetingNumber || "Nth"} Meeting of the ${cover.meetingBody || "Board of Governors"}`)}</td></tr>
          <tr><td>Institute</td><td>${escapeHtml(cover.instituteName || "National Institute of Technology Calicut")}</td></tr>
          <tr><td>Date</td><td>${escapeHtml(cover.dateLine || formatDate(meeting.date))}</td></tr>
          <tr><td>Venue / Mode</td><td>${escapeHtml(cover.venueLine || meeting.venue || meeting.link || "Not specified")}</td></tr>
          <tr><td>Status</td><td>${escapeHtml(meeting.momStatus || "Draft")}</td></tr>
        </table>
        <h2>Members Present</h2>
        <table class="members">
          <tr><th>Sl. No.</th><th>Name</th><th>Designation</th><th>Mode</th></tr>
          ${(meeting.membersPresent.length ? meeting.membersPresent : [{ name: "No members recorded", designation: "-", attendanceMode: "-" }]).map((member, index) => `
            <tr><td>${index + 1}</td><td>${escapeHtml(member.name || "-")}</td><td>${escapeHtml(member.designation || "-")}</td><td>${escapeHtml(member.attendanceMode || "-")}</td></tr>
          `).join("")}
        </table>
        ${agendaHtml || "<p>No agenda items recorded.</p>"}
        <p>The meeting ended with thanks to the Chair.</p>
        <h2>Approved By</h2>
        ${approvedMembers.length ? approvedMembers.map((member) => `<p>${escapeHtml(`${member.name} (${member.department || "Member"})`)}</p>`).join("") : "<p>No approvals recorded.</p>"}
        <div class="footer">Minutes of Meeting</div>
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${meeting.title.replace(/[^a-z0-9]+/gi, "-") || "mom"}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function tableBlockToHtml(block: MomBlock) {
  const table = compactTableValue(block.value);
  if (!table.columns.length || !table.rows.length) return "";
  return `
    <p class="block"><strong>${escapeHtml(block.label)}:</strong></p>
    <table class="data-table">
      <tr>${table.columns.map((column) => `<th>${escapeHtml(column || "-")}</th>`).join("")}</tr>
      ${table.rows.map((row) => `<tr>${table.columns.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`).join("")}
    </table>
  `;
}

function stripHtml(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function drawOfficialCover(
  doc: jsPDF,
  options: {
    pageWidth: number;
    pageHeight: number;
    cover: MomCoverDetails;
    meeting: MomMeeting;
    logo: string | null;
    building: string | null;
  }
) {
  const { pageWidth, pageHeight, cover, meeting, logo, building } = options;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  if (logo) {
    doc.addImage(logo, "PNG", pageWidth / 2 - 34, 28, 68, 68);
  }

  doc.setFont("times", "bold");
  doc.setFontSize(25);
  doc.setTextColor(0, 174, 239);
  doc.text("Minutes", pageWidth / 2, 175, { align: "center" });

  doc.setTextColor(205, 0, 0);
  doc.setFontSize(31);
  doc.text(`of the ${cover.meetingNumber || "Nth"}`, pageWidth / 2, 220, { align: "center" });

  doc.setFontSize(20);
  doc.text("Meeting of the", pageWidth / 2, 270, { align: "center" });

  doc.setFontSize(31);
  doc.setTextColor(0, 175, 75);
  doc.text(cover.meetingBody || "Board of Governors", pageWidth / 2, 314, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(18);
  doc.setTextColor(205, 0, 0);
  doc.text(`of the ${cover.instituteName || "National Institute of Technology Calicut"}`, pageWidth / 2, 352, {
    align: "center",
    maxWidth: 520,
  });

  doc.setTextColor(0, 174, 239);
  doc.setFontSize(20);
  doc.text(cover.dateLine || `on ${formatDate(meeting.date)}`, pageWidth / 2, 430, { align: "center", maxWidth: 520 });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.text(cover.venueLine || meeting.venue || meeting.link || "Venue not specified", pageWidth / 2, 515, {
    align: "center",
    maxWidth: 500,
  });

  if (building) {
    doc.addImage(building, "JPEG", pageWidth / 2 - 155, pageHeight - 155, 310, 118);
  }
}

function drawPageHeader(doc: jsPDF, meeting: MomMeeting, pageNumber: number) {
  if (pageNumber === 1) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(21, 45, 78);
  doc.rect(0, 0, pageWidth, 46, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("National Institute of Technology Calicut", 48, 20);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(`Minutes of Meeting: ${meeting.title}`, 48, 34, { maxWidth: pageWidth - 96 });
}

function ensureSpace(doc: jsPDF, y: number, requiredHeight: number, meeting: MomMeeting) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + requiredHeight <= pageHeight - 70) return y;
  doc.addPage();
  drawPageHeader(doc, meeting, doc.getNumberOfPages());
  return 86;
}

function writeOfficialBlock(doc: jsPDF, label: string, value: string, margin: number, y: number, pageWidth: number, meeting: MomMeeting) {
  y = ensureSpace(doc, y, 84, meeting);
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(80, 90, 105);
  doc.text(label, margin, y);
  y += 5;
  doc.setDrawColor(210, 218, 228);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(25, 35, 50);
  const lines = doc.splitTextToSize(value, pageWidth - margin * 2);
  lines.forEach((line: string) => {
    y = ensureSpace(doc, y, 18, meeting);
    doc.text(line, margin, y);
    y += 13;
  });

  return y + 6;
}

function writeOfficialTable(doc: jsPDF, block: MomBlock, margin: number, y: number, pageWidth: number, meeting: MomMeeting) {
  const table = compactTableValue(block.value);
  if (!table.columns.length || !table.rows.length) return y;
  y = ensureSpace(doc, y, 90, meeting);
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(80, 90, 105);
  doc.text(block.label, margin - 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    margin: { left: margin, right: 48 },
    head: [table.columns.map((column) => column || "-")],
    body: table.rows.length ? table.rows.map((row) => table.columns.map((_, index) => row[index] || "")) : [table.columns.map(() => "")],
    styles: { font: "times", fontSize: 9, cellPadding: 4, lineColor: [190, 198, 208], lineWidth: 0.4, textColor: [25, 35, 50] },
    headStyles: { fillColor: [242, 246, 250], textColor: [25, 35, 50], fontStyle: "bold" },
    tableWidth: pageWidth - margin - 48,
    didDrawPage: () => drawPageHeader(doc, meeting, doc.getNumberOfPages()),
  });

  return ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY || y) + 12;
}

function addPageNumbers(doc: jsPDF, meeting: MomMeeting) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 2; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 98, 110);
    doc.text(`Minutes of ${meeting.title} | Page ${page - 1} of ${pageCount - 1}`, pageWidth / 2, pageHeight - 28, { align: "center" });
  }
}
