"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MomAgendaItem, SectionGroup } from "./types";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const sectionGroups: SectionGroup[] = [
  "Procedural",
  "Consideration & Approval",
  "Reporting",
  "Any Other Matter",
];

const fieldInputClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-800 dark:bg-gray-950 dark:text-white";

interface AgendaItemFormProps {
  item: MomAgendaItem;
  index: number;
  onChange: (item: MomAgendaItem) => void;
  onRemove: () => void;
}

export default function AgendaItemForm({ item, index, onChange, onRemove }: AgendaItemFormProps) {
  const sortableId = item._id || `agenda-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sortableId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const update = <K extends keyof MomAgendaItem>(field: K, value: MomAgendaItem[K]) => {
    onChange({ ...item, [field]: value });
  };

  return (
    <section ref={setNodeRef} style={style} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Reorder agenda item"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Agenda Item {index + 1}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {item.sourceAgendaId ? "Imported from agenda module" : "Additional MoM item"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          aria-label="Remove agenda item"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Item Number">
          <input value={item.itemNumber} onChange={(event) => update("itemNumber", event.target.value)} className={fieldInputClass} placeholder="BG.71.03" />
        </Field>
        <Field label="Section Tag">
          <input value={item.sectionTag || ""} onChange={(event) => update("sectionTag", event.target.value)} className={fieldInputClass} placeholder="FC.62.02" />
        </Field>
        <Field label="Section Group">
          <select value={item.sectionGroup} onChange={(event) => update("sectionGroup", event.target.value as SectionGroup)} className={fieldInputClass}>
            {sectionGroups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Subject / Title">
          <input value={item.subject} onChange={(event) => update("subject", event.target.value)} className={fieldInputClass} placeholder="Subject for discussion" />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RichField label="Background Note" value={item.backgroundNote} onChange={(value) => update("backgroundNote", value)} />
        <RichField label="Decision" value={item.decision} onChange={(value) => update("decision", value)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Action Required">
          <input value={item.actionRequired} onChange={(event) => update("actionRequired", event.target.value)} className={fieldInputClass} placeholder="Action to be completed" />
        </Field>
        <Field label="Responsible Person">
          <input value={item.responsiblePerson} onChange={(event) => update("responsiblePerson", event.target.value)} className={fieldInputClass} placeholder="Name / office" />
        </Field>
        <Field label="Target Date">
          <input type="date" value={item.targetDate?.slice(0, 10) || ""} onChange={(event) => update("targetDate", event.target.value)} className={fieldInputClass} />
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      {children}
    </label>
  );
}

function RichField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      <div className="rounded-xl border border-gray-200 bg-white pb-10 dark:border-gray-800 dark:bg-gray-950">
        <ReactQuill theme="snow" value={value} onChange={onChange} className="h-36" />
      </div>
    </div>
  );
}
