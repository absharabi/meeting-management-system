"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowLeft, CheckCircle2, Download, Lock, Plus, RefreshCw, Save, ShieldCheck, Sparkles, Upload, Trash2, FileText, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "react-quill-new/dist/quill.snow.css";
import AgendaItemForm from "@/components/mom/AgendaItemForm";
import SummaryTable from "@/components/mom/SummaryTable";
import { MemberPresent, MomAgendaItem, MomApprovalStatus, MomBlock, MomBlockType, MomCoverDetails, MomMeeting, MomStatus } from "@/components/mom/types";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/meetings`;
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-800 dark:bg-gray-950 dark:text-white";
import { 
  logoPaths, buildingPaths, defaultCoverDetails, MeetingAgenda, deriveMembersFromParticipants, mergeCoverDetails, isCoverComplete, getOrganizerId, blockLabels, presetBlockTypes, createPresetBlocks, normalizeBlocks, normalizeAgendaItemForBlocks, normalizeAgendaItems, normalizeTableValue, compactTableValue, hasBlockDisplayValue, visibleBlocks, getBlockText, getBlockDisplayValue, mergeAgendaModuleItems, loadImage, exportMomPdf, exportMomWord, tableBlockToHtml, stripHtml, escapeHtml, formatDate, drawOfficialCover, drawPageHeader, ensureSpace, writeOfficialBlock, writeOfficialTable, addPageNumbers, readJsonResponse
} from "@/utils/pdfExport";

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



interface CurrentUser {
  id?: string;
  _id?: string;
  role?: string;
}









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
  const [newGeneralRemark, setNewGeneralRemark] = useState("");
  const [isUploadingMom, setIsUploadingMom] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  const handleOfflineMomUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      window.alert("Only PDF and Word files (.doc, .docx) are allowed.");
      return;
    }

    setIsUploadingMom(true);
    const formData = new FormData();
    formData.append("momFile", file);

    try {
      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_BASE}/${params.id}/upload-mom`, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to upload MoM file.");
      }

      setMeeting(data.meeting);
      setNotice({ message: "Offline MoM document uploaded successfully.", type: "success" });
    } catch (error) {
      console.error(error);
      setNotice({ message: error instanceof Error ? error.message : "Failed to upload MoM file.", type: "error" });
    } finally {
      setIsUploadingMom(false);
    }
  };

  const handleOfflineMomDelete = async () => {
    if (!window.confirm("Are you sure you want to delete the uploaded offline MoM document?")) {
      return;
    }

    try {
      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_BASE}/${params.id}/upload-mom`, {
        method: "DELETE",
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete MoM file.");
      }

      setMeeting(data.meeting);
      setNotice({ message: "Offline MoM document deleted successfully.", type: "success" });
    } catch (error) {
      console.error(error);
      setNotice({ message: error instanceof Error ? error.message : "Failed to delete MoM file.", type: "error" });
    }
  };

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
  const canForceConfirm = currentUser?.role === "SuperAdmin" || currentUser?.role === "Admin";
  const canEdit = isOrganizerOrAdmin && !isConfirmed;
  const isParticipant = Boolean(meeting?.participants?.some(p => {
    const pId = typeof p.user === 'string' ? p.user : p.user?._id || p.user?.id;
    return pId === currentUserId;
  }));
  const canAddRemark = !isConfirmed && (isOrganizerOrAdmin || isParticipant);

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
      setNotice({ message: "MoM saved successfully.", type: "success" });
      return true;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to save MoM.";
      setNotice({ message, type: "error" });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addGeneralRemark = async () => {
    if (!newGeneralRemark.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/${params.id}/mom/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
        body: JSON.stringify({ text: newGeneralRemark }),
      });
      if (res.ok) {
        const updatedMeeting = await res.json();
        setMeeting(updatedMeeting);
        setNewGeneralRemark("");
      } else {
        window.alert("Failed to add remark");
      }
    } catch (e) {
      console.error(e);
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

  const addAgendaComment = async (agendaId: string, text: string) => {
    if (agendaId.startsWith("local-")) {
      setNotice({ 
        message: canEdit 
          ? "Please click 'Save Draft' first before adding comments to new agenda items." 
          : "The organizer has not saved this MoM yet. Please wait until they save the draft.", 
        type: "error" 
      });
      return;
    }
    try {
      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      const response = await fetch(`${API_BASE}/${params.id}/mom/agendas/${agendaId}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to add comment.");

      setMeeting(data);
      setMembersPresent(deriveMembersFromParticipants(data));
      setMomCoverDetails(mergeCoverDetails(data, data.momCoverDetails));
      setAgendaItems(normalizeAgendaItems(data.agendaItems || []));
      setMomStatus(data.momStatus || "Draft");
      setNotice({ message: "Comment added successfully.", type: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Unable to add comment.", type: "error" });
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

        {/* Offline MoM Document Section */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 transition hover:shadow-md">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-600 dark:text-blue-400" size={20} />
                <h2 className="font-bold text-gray-900 dark:text-white text-lg">Offline MoM Document</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If you compiled the Minutes of Meeting outside this platform, upload the final PDF or Word file here.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {meeting.offlineMomFileUrl ? (
                <>
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${meeting.offlineMomFileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30 transition duration-150"
                  >
                    <Download size={16} />
                    Download Offline MoM
                  </a>
                  {isOrganizerOrAdmin && !isConfirmed && (
                    <button
                      onClick={handleOfflineMomDelete}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/20 transition duration-150"
                    >
                      <Trash2 size={16} />
                      Delete MoM File
                    </button>
                  )}
                </>
              ) : meeting.isOfflineMomUploaded ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400 font-semibold">
                  <AlertCircle size={15} />
                  Offline MoM uploaded (pending confirmation)
                </span>
              ) : isOrganizerOrAdmin ? (
                <label className={`relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:border-blue-500 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:border-blue-500 dark:hover:text-blue-400 transition duration-150 ${isUploadingMom ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}>
                  <Upload size={16} className={isUploadingMom ? 'animate-bounce' : ''} />
                  <span>{isUploadingMom ? 'Uploading...' : 'Upload MoM (PDF/Word)'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleOfflineMomUpload}
                    disabled={isUploadingMom}
                    className="hidden"
                  />
                </label>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 dark:bg-gray-950 dark:border-gray-800 dark:text-gray-400">
                  <AlertCircle size={15} />
                  No offline MoM document uploaded yet
                </span>
              )}
            </div>
          </div>
        </section>

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
            <h2 className="font-bold text-gray-900 dark:text-white">Members Present</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Derived from attendance marked in the meeting. Organizer is included by default.</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 w-16">Sl. No.</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Attendance Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {membersPresent.map((member, index) => (
                  <tr key={`${member.name}-${index}`} className="bg-white dark:bg-gray-900">
                    <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{member.name || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{member.designation || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{member.attendanceMode || "-"}</td>
                  </tr>
                ))}
                {membersPresent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No members marked as present yet. Mark attendance first.</td>
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
                  onAddComment={addAgendaComment}
                  currentUserId={currentUserId}
                  isConfirmed={isConfirmed}
                  isOrganizerOrAdmin={isOrganizerOrAdmin}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <SummaryTable items={agendaItems} />

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 mt-6">
          <div className="mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white">General Remarks</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Add any general remarks or comments regarding the overall meeting.</p>
          </div>
          <div className="space-y-4">
            {meeting?.momGeneralRemarks?.map((remark: any, index: number) => (
              <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{remark.userName}</span>
                  <span className="text-xs text-gray-500">{new Date(remark.createdAt).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{remark.text}</p>
              </div>
            ))}
            
            {canAddRemark && (
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={newGeneralRemark}
                  onChange={(e) => setNewGeneralRemark(e.target.value)}
                  placeholder="Type a general remark..."
                  className="flex-1 rounded-lg border px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                />
                <button
                  onClick={addGeneralRemark}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Add Remark
                </button>
              </div>
            )}
          </div>
        </section>
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

