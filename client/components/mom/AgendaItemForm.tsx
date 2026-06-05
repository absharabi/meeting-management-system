"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { MomAgendaItem, MomBlock, MomBlockType, MomTableValue, SectionGroup } from "./types";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const sectionGroups: SectionGroup[] = [
  "Procedural",
  "Consideration & Approval",
  "Reporting",
  "Any Other Matter",
];

const blockCatalog: { type: MomBlockType; label: string }[] = [
  { type: "backgroundNote", label: "Background Note" },
  { type: "decision", label: "Decision" },
  { type: "actionRequired", label: "Action Required" },
  { type: "responsiblePerson", label: "Responsible Person" },
  { type: "targetDate", label: "Target Date" },
  { type: "annexureReference", label: "Annexure Reference" },
  { type: "status", label: "Status" },
  { type: "table", label: "Table" },
  { type: "customField", label: "Custom Field" },
];

const presetBlocks: Record<SectionGroup, MomBlockType[]> = {
  "Procedural": ["backgroundNote", "decision"],
  "Consideration & Approval": ["backgroundNote", "decision", "actionRequired", "responsiblePerson", "targetDate"],
  "Reporting": ["backgroundNote", "decision", "status"],
  "Any Other Matter": ["backgroundNote", "decision"],
};

const fieldInputClass = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:disabled:bg-gray-900";

interface AgendaItemFormProps {
  item: MomAgendaItem;
  index: number;
  onChange: (item: MomAgendaItem) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export default function AgendaItemForm({ item, index, onChange, onRemove, disabled = false }: AgendaItemFormProps) {
  const sortableId = item._id || `agenda-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sortableId });
  const blockSensors = useSensors(useSensor(PointerSensor));
  const blocks = normalizeBlocks(item);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const update = <K extends keyof MomAgendaItem>(field: K, value: MomAgendaItem[K]) => {
    onChange({ ...item, blocks, [field]: value });
  };

  const updateBlocks = (nextBlocks: MomBlock[]) => {
    onChange(withLegacyFields({ ...item, blocks: nextBlocks }));
  };

  const addBlock = (type: MomBlockType) => {
    if (disabled) return;
    updateBlocks([...blocks, createBlock(type)]);
  };

  const removeBlock = (blockIndex: number) => {
    if (disabled) return;
    updateBlocks(blocks.filter((_, currentIndex) => currentIndex !== blockIndex));
  };

  const updateBlock = (blockIndex: number, nextBlock: MomBlock) => {
    updateBlocks(blocks.map((block, currentIndex) => currentIndex === blockIndex ? nextBlock : block));
  };

  const handleSectionGroupChange = (nextGroup: SectionGroup) => {
    if (disabled) return;
    const nextPreset = presetBlocks[nextGroup].map(createBlock);
    const hasExistingBlocks = blocks.some((block) => hasBlockValue(block));
    if (hasExistingBlocks && !window.confirm("Replace the existing blocks with the preset for this Section Group?")) {
      onChange({ ...item, blocks, sectionGroup: nextGroup });
      return;
    }
    onChange(withLegacyFields({ ...item, sectionGroup: nextGroup, blocks: nextPreset }));
  };

  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (disabled || !over || active.id === over.id) return;
    const oldIndex = Number(String(active.id).split("-block-").pop());
    const newIndex = Number(String(over.id).split("-block-").pop());
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;
    updateBlocks(arrayMove(blocks, oldIndex, newIndex));
  };

  return (
    <section ref={setNodeRef} style={style} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Reorder agenda item"
            {...attributes}
            {...(disabled ? {} : listeners)}
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
          disabled={disabled}
          className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-900/20"
          aria-label="Remove agenda item"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Item Number">
          <input disabled={disabled} value={item.itemNumber} onChange={(event) => update("itemNumber", event.target.value)} className={fieldInputClass} placeholder="BG.71.03" />
        </Field>
        <Field label="Section Tag">
          <input disabled={disabled} value={item.sectionTag || ""} onChange={(event) => update("sectionTag", event.target.value)} className={fieldInputClass} placeholder="FC.62.02" />
        </Field>
        <Field label="Section Group">
          <select disabled={disabled} value={item.sectionGroup} onChange={(event) => handleSectionGroupChange(event.target.value as SectionGroup)} className={fieldInputClass}>
            {sectionGroups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Subject / Title">
          <input disabled={disabled} value={item.subject} onChange={(event) => update("subject", event.target.value)} className={fieldInputClass} placeholder="Subject for discussion" />
        </Field>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-800">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white">Blocks</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Add, reorder, or remove MoM body fields for this item.</p>
          </div>
          <label className="inline-flex items-center gap-2">
            <Plus size={16} className="text-blue-600" />
            <select disabled={disabled} value="" onChange={(event) => { addBlock(event.target.value as MomBlockType); event.currentTarget.value = ""; }} className={fieldInputClass}>
              <option value="" disabled>Add block</option>
              {blockCatalog.map((block) => <option key={block.type} value={block.type}>{block.label}</option>)}
            </select>
          </label>
        </div>

        <DndContext sensors={blockSensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
          <SortableContext items={blocks.map((_, blockIndex) => `${sortableId}-block-${blockIndex}`)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((block, blockIndex) => (
                <SortableBlock
                  key={`${sortableId}-block-${blockIndex}-${block.type}`}
                  id={`${sortableId}-block-${blockIndex}`}
                  block={block}
                  disabled={disabled}
                  onChange={(nextBlock) => updateBlock(blockIndex, nextBlock)}
                  onRemove={() => removeBlock(blockIndex)}
                />
              ))}
              {blocks.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  No blocks added yet.
                </p>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}

function SortableBlock({ id, block, disabled, onChange, onRemove }: { id: string; block: MomBlock; disabled?: boolean; onChange: (block: MomBlock) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article ref={setNodeRef} style={style} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-900 dark:hover:text-gray-200"
            aria-label="Reorder block"
            {...attributes}
            {...(disabled ? {} : listeners)}
          >
            <GripVertical size={16} />
          </button>
          {block.type === "customField" ? (
            <input disabled={disabled} value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} className={fieldInputClass} placeholder="Custom label" />
          ) : (
            <h5 className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">{block.label}</h5>
          )}
        </div>
        <button type="button" disabled={disabled} onClick={onRemove} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-900/20" aria-label="Remove block">
          <Trash2 size={16} />
        </button>
      </div>
      <BlockEditor block={block} disabled={disabled} onChange={onChange} />
    </article>
  );
}

function BlockEditor({ block, disabled, onChange }: { block: MomBlock; disabled?: boolean; onChange: (block: MomBlock) => void }) {
  if (block.type === "backgroundNote" || block.type === "decision") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white pb-10 dark:border-gray-800 dark:bg-gray-950">
        <ReactQuill theme="snow" value={String(block.value || "")} onChange={(value) => onChange({ ...block, value })} readOnly={disabled} className="h-36" />
      </div>
    );
  }

  if (block.type === "targetDate") {
    return <input disabled={disabled} type="date" value={String(block.value || "").slice(0, 10)} onChange={(event) => onChange({ ...block, value: event.target.value })} className={fieldInputClass} />;
  }

  if (block.type === "status") {
    return (
      <select disabled={disabled} value={String(block.value || "Pending")} onChange={(event) => onChange({ ...block, value: event.target.value })} className={fieldInputClass}>
        {["Pending", "In Progress", "Complete", "Deferred"].map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
    );
  }

  if (block.type === "table") {
    return <EditableTable disabled={disabled} value={asTableValue(block.value)} onChange={(value) => onChange({ ...block, value })} />;
  }

  return <input disabled={disabled} value={String(block.value || "")} onChange={(event) => onChange({ ...block, value: event.target.value })} className={fieldInputClass} placeholder={block.label} />;
}

function EditableTable({ value, onChange, disabled }: { value: MomTableValue; onChange: (value: MomTableValue) => void; disabled?: boolean }) {
  const setColumn = (columnIndex: number, label: string) => {
    onChange({ ...value, columns: value.columns.map((column, index) => index === columnIndex ? label : column) });
  };

  const setCell = (rowIndex: number, columnIndex: number, cellValue: string) => {
    onChange({
      ...value,
      rows: value.rows.map((row, index) => index === rowIndex ? row.map((cell, cellIndex) => cellIndex === columnIndex ? cellValue : cell) : row),
    });
  };

  const addColumn = () => {
    onChange({
      columns: [...value.columns, `Column ${value.columns.length + 1}`],
      rows: value.rows.map((row) => [...row, ""]),
    });
  };

  const addRow = () => {
    onChange({ ...value, rows: [...value.rows, value.columns.map(() => "")] });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900">
            <tr>
              {value.columns.map((column, columnIndex) => (
                <th key={`column-${columnIndex}`} className="p-2">
                  <input disabled={disabled} value={column} onChange={(event) => setColumn(columnIndex, event.target.value)} className={fieldInputClass} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="border-t border-gray-100 dark:border-gray-800">
                {value.columns.map((_, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`} className="p-2">
                    <input disabled={disabled} value={row[columnIndex] || ""} onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)} className={fieldInputClass} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={addRow} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900">Add row</button>
        <button type="button" disabled={disabled} onClick={addColumn} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900">Add column</button>
      </div>
    </div>
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

function createBlock(type: MomBlockType): MomBlock {
  const definition = blockCatalog.find((block) => block.type === type);
  if (type === "table") return { type, label: definition?.label || "Table", value: { columns: ["Column 1", "Column 2"], rows: [["", ""]] } };
  if (type === "status") return { type, label: definition?.label || "Status", value: "Pending" };
  if (type === "customField") return { type, label: "Custom Field", value: "" };
  return { type, label: definition?.label || "Field", value: "" };
}

function normalizeBlocks(item: MomAgendaItem): MomBlock[] {
  if (Array.isArray(item.blocks) && item.blocks.length) {
    return item.blocks.map((block) => ({
      type: block.type,
      label: block.label || blockCatalog.find((catalogBlock) => catalogBlock.type === block.type)?.label || "Field",
      value: block.type === "table" ? asTableValue(block.value) : String(block.value || ""),
    }));
  }

  const fallbackBlocks: MomBlock[] = [
    { type: "backgroundNote", label: "Background Note", value: item.backgroundNote || "" },
    { type: "decision", label: "Decision", value: item.decision || "" },
    { type: "actionRequired", label: "Action Required", value: item.actionRequired || "" },
    { type: "responsiblePerson", label: "Responsible Person", value: item.responsiblePerson || "" },
    { type: "targetDate", label: "Target Date", value: item.targetDate || "" },
  ];

  return fallbackBlocks.filter((block) => block.type === "backgroundNote" || block.type === "decision" || hasBlockValue(block));
}

function hasBlockValue(block: MomBlock) {
  if (block.type === "table") {
    const table = asTableValue(block.value);
    return table.columns.some(Boolean) || table.rows.some((row) => row.some(Boolean));
  }
  return String(block.value || "").trim().length > 0;
}

function asTableValue(value: MomBlock["value"]): MomTableValue {
  if (typeof value === "object" && value && Array.isArray(value.columns) && Array.isArray(value.rows)) {
    return {
      columns: value.columns.length ? value.columns.map(String) : ["Column 1", "Column 2"],
      rows: value.rows.length ? value.rows.map((row) => Array.isArray(row) ? row.map(String) : []) : [["", ""]],
    };
  }
  return { columns: ["Column 1", "Column 2"], rows: [["", ""]] };
}

function withLegacyFields(item: MomAgendaItem): MomAgendaItem {
  const getString = (type: MomBlockType) => String(item.blocks?.find((block) => block.type === type)?.value || "");
  return {
    ...item,
    backgroundNote: getString("backgroundNote"),
    decision: getString("decision"),
    actionRequired: getString("actionRequired"),
    responsiblePerson: getString("responsiblePerson"),
    targetDate: getString("targetDate"),
  };
}
