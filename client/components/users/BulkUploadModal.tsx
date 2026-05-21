"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { importPreview } from "@/data/usersData";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (message: string, type?: "success" | "error") => void;
}

export default function BulkUploadModal({ isOpen, onClose, onComplete }: BulkUploadModalProps) {
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setFileName("");
      setProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startUpload = (name: string) => {
    setFileName(name);
    setProgress(18);
    window.setTimeout(() => setProgress(54), 300);
    window.setTimeout(() => setProgress(86), 650);
    window.setTimeout(() => {
      setProgress(100);
      onComplete("Bulk upload file received. Preview will appear after validation is connected.", "success");
    }, 950);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Upload Users</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Import users from Excel or CSV with validation preview.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-81px)] overflow-y-auto p-6">
          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dropped = event.dataTransfer.files[0];
              if (dropped) startUpload(dropped.name);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-8 text-center transition-colors hover:bg-blue-50 dark:border-blue-900/60 dark:bg-blue-900/10 dark:hover:bg-blue-900/20"
          >
            <input
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) startUpload(selected.name);
              }}
            />
            <div className="rounded-full bg-white p-4 text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-400">
              <UploadCloud size={32} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Drag & drop Excel or CSV file</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Accepted files: .xlsx, .csv</p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet size={17} />
              Upload Excel
            </span>
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => onComplete("User import template download started.")} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-400 dark:hover:bg-blue-900/20">
              <Download size={16} />
              Download Template
            </button>
            {fileName && (
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-200 px-4 py-2.5 dark:border-gray-800">
                <FileSpreadsheet className="shrink-0 text-green-600 dark:text-green-400" size={18} />
                <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{fileName}</span>
              </div>
            )}
          </div>

          {progress > 0 && (
            <div className="mt-5 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700 dark:text-gray-200">Upload progress</span>
                <span className="text-gray-500 dark:text-gray-400">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <section className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Import Preview</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Validation runs before records are created.</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">No preview yet</span>
            </div>
            {importPreview.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Row</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {importPreview.map((row) => (
                      <tr key={row.row}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.row}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.email}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.role}</td>
                        <td className="px-4 py-3">
                          {row.status === "Ready" ? (
                            <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400"><CheckCircle2 size={15} /> Ready</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><AlertTriangle size={15} /> {row.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <FileSpreadsheet className="text-gray-300 dark:text-gray-600" size={34} />
                <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-200">No uploaded user rows to preview</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your imported users will appear here after validation.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
