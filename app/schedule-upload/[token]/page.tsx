"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

type PageState = "loading" | "ready" | "already_uploaded" | "not_found" | "uploading" | "success" | "error";
type Mode = "upload" | "build";

const ALLOWED_EXTENSIONS = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif";
const MAX_MB = 25;

interface TimeBlock {
  start: string;
  end: string;
  activity: string;
}

export default function ScheduleUploadPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [state, setState]   = useState<PageState>("loading");
  const [info, setInfo]     = useState<{
    bookingNumber: string;
    name: string;
    eventName: string;
    uploadedFilename?: string | null;
  } | null>(null);

  // Upload mode
  const [mode, setMode]         = useState<Mode>("upload");
  const [file, setFile]         = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Build mode
  const [blocks, setBlocks] = useState<TimeBlock[]>([
    { start: "", end: "", activity: "" },
  ]);
  const [generalNotes, setGeneralNotes] = useState("");

  // ── Fetch booking info on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!token) { setState("not_found"); return; }
    fetch(`/api/schedule-upload/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setState("not_found"); return; }
        setInfo({
          bookingNumber:    data.bookingNumber,
          name:             data.name,
          eventName:        data.eventName,
          uploadedFilename: data.uploadedFilename,
        });
        setState(data.alreadyUploaded ? "already_uploaded" : "ready");
      })
      .catch(() => setState("not_found"));
  }, [token]);

  // ── File validation ──────────────────────────────────────────────────────
  function validateFile(f: File): string | null {
    const allowed = [
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/png", "image/heic", "image/heif",
    ];
    if (!allowed.includes(f.type) && !f.name.match(/\.(pdf|doc|docx|jpe?g|png|heic|heif)$/i)) {
      return "Please upload a PDF, Word document, or image (JPG/PNG/HEIC).";
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      return `File is too large. Maximum size is ${MAX_MB} MB.`;
    }
    return null;
  }

  function pickFile(f: File) {
    const err = validateFile(f);
    if (err) { setErrorMsg(err); setFile(null); return; }
    setErrorMsg("");
    setFile(f);
  }

  // ── Build schedule → serialize to text file ──────────────────────────────
  function buildScheduleFile(): File {
    const lines: string[] = [];
    lines.push(`Event Schedule — ${info?.eventName ?? ""}`);
    lines.push(`Booking: ${info?.bookingNumber ?? ""}`);
    lines.push("─".repeat(40));
    lines.push("");
    const filled = blocks.filter(b => b.activity.trim());
    if (filled.length === 0) {
      lines.push("(No time blocks added)");
    } else {
      filled.forEach(b => {
        const timeLabel = (b.start || b.end)
          ? `${b.start || "?"}–${b.end || "?"}`
          : "";
        lines.push(timeLabel ? `${timeLabel}  ${b.activity}` : b.activity);
      });
    }
    if (generalNotes.trim()) {
      lines.push("");
      lines.push("Notes:");
      lines.push(generalNotes.trim());
    }
    const text = lines.join("\n");
    return new File([text], "event-schedule.txt", { type: "text/plain" });
  }

  function buildScheduleValid(): boolean {
    return blocks.some(b => b.activity.trim().length > 0) || generalNotes.trim().length > 0;
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload() {
    let uploadFile: File | null = null;
    if (mode === "upload") {
      if (!file) return;
      uploadFile = file;
    } else {
      if (!buildScheduleValid()) { setErrorMsg("Add at least one time block or a note before submitting."); return; }
      uploadFile = buildScheduleFile();
    }

    setState("uploading");
    setProgress(0);
    setErrorMsg("");

    const form = new FormData();
    form.append("file", uploadFile);

    const interval = setInterval(() => setProgress(p => Math.min(p + 8, 85)), 300);
    try {
      const res = await fetch(`/api/schedule-upload/${token}`, { method: "POST", body: form });
      clearInterval(interval);
      setProgress(100);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Upload failed. Please try again.");
        setState("error");
      } else {
        setState("success");
      }
    } catch {
      clearInterval(interval);
      setErrorMsg("Network error. Check your connection and try again.");
      setState("error");
    }
  }

  // ── Block helpers ─────────────────────────────────────────────────────────
  function updateBlock(i: number, key: keyof TimeBlock, val: string) {
    setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, [key]: val } : b));
  }
  function addBlock() {
    setBlocks(prev => [...prev, { start: "", end: "", activity: "" }]);
  }
  function removeBlock(i: number) {
    setBlocks(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  function fileIcon(name: string) {
    if (/\.pdf$/i.test(name)) return "📄";
    if (/\.(doc|docx|txt)$/i.test(name)) return "📝";
    return "🖼️";
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col items-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8">
        <Image
          src="https://bbc-team-dashboard.vercel.app/brainerd-logo.png"
          alt="Brainerd Baptist Church"
          width={160}
          height={40}
          style={{ objectFit: "contain" }}
          unoptimized
        />
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        {/* Header band */}
        <div className="bg-[#00205b] px-6 py-5">
          <p className="text-[#00abc9] text-xs font-semibold uppercase tracking-widest mb-1">BX Reservations</p>
          <h1 className="text-white text-xl font-bold leading-snug">Event Schedule</h1>
        </div>

        <div className="px-6 py-6">
          {/* ── Loading ── */}
          {state === "loading" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-8 h-8 border-2 border-[#00abc9] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading your booking…</p>
            </div>
          )}

          {/* ── Not found ── */}
          {state === "not_found" && (
            <div className="py-8 text-center">
              <div className="text-4xl mb-3">🔗</div>
              <h2 className="text-base font-semibold text-gray-800 mb-2">Link not found or expired</h2>
              <p className="text-sm text-gray-500">
                This upload link is invalid or has already been used.
                If you think this is a mistake, contact your BX coordinator.
              </p>
              <p className="mt-4 text-xs text-gray-400">
                <a href="mailto:BXreservations@brainerdbaptist.org" className="text-[#00abc9] underline">
                  BXreservations@brainerdbaptist.org
                </a>
              </p>
            </div>
          )}

          {/* ── Already uploaded ── */}
          {state === "already_uploaded" && info && (
            <div className="py-6 text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-800 mb-2">Schedule already received</h2>
              <p className="text-sm text-gray-500">
                We already have your event schedule on file for <strong>{info.eventName}</strong> ({info.bookingNumber}).
                Our team will review it and be in touch.
              </p>
              {info.uploadedFilename && (
                <p className="mt-3 text-xs text-gray-400">
                  {fileIcon(info.uploadedFilename)} {info.uploadedFilename}
                </p>
              )}
            </div>
          )}

          {/* ── Ready / Error ── */}
          {(state === "ready" || state === "error") && info && (
            <>
              <p className="text-sm text-gray-600 mb-1">
                Hi <strong className="text-gray-800">{info.name.split(" ")[0]}</strong>, please share the schedule for:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5">
                <p className="font-semibold text-[#00205b] text-sm">{info.eventName}</p>
                <p className="text-xs text-gray-500 mt-0.5">Booking {info.bookingNumber}</p>
              </div>

              {/* Mode tabs */}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-5">
                <button
                  onClick={() => { setMode("build"); setErrorMsg(""); }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors
                    ${mode === "build" ? "bg-[#00205b] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  ✏️ Build a schedule
                </button>
                <button
                  onClick={() => { setMode("upload"); setErrorMsg(""); }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors border-l border-gray-200
                    ${mode === "upload" ? "bg-[#00205b] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  📁 Upload a file
                </button>
              </div>

              {/* ── Build mode ── */}
              {mode === "build" && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">Add time blocks for your event. Start/end times are optional — just describe what's happening.</p>

                  <div className="space-y-2">
                    {blocks.map((b, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex gap-1.5 flex-shrink-0">
                          <input
                            type="time"
                            value={b.start}
                            onChange={e => updateBlock(i, "start", e.target.value)}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#00abc9]"
                            placeholder="Start"
                          />
                          <span className="text-gray-400 text-xs self-center">–</span>
                          <input
                            type="time"
                            value={b.end}
                            onChange={e => updateBlock(i, "end", e.target.value)}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#00abc9]"
                            placeholder="End"
                          />
                        </div>
                        <input
                          type="text"
                          value={b.activity}
                          onChange={e => updateBlock(i, "activity", e.target.value)}
                          placeholder="Activity / description"
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#00abc9]"
                        />
                        {blocks.length > 1 && (
                          <button onClick={() => removeBlock(i)} className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0 mt-1.5">✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addBlock}
                    className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-[#00abc9] hover:text-[#00abc9] transition-colors"
                  >
                    + Add time block
                  </button>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Additional notes (optional)</label>
                    <textarea
                      value={generalNotes}
                      onChange={e => setGeneralNotes(e.target.value)}
                      placeholder="Setup requirements, AV needs, special instructions…"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#00abc9] resize-none"
                    />
                  </div>
                </div>
              )}

              {/* ── Upload mode ── */}
              {mode === "upload" && (
                <>
                  <div
                    onClick={() => inputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4
                      ${dragOver ? "border-[#00abc9] bg-[#f0fbfd]" : file ? "border-emerald-400 bg-emerald-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"}`}
                  >
                    {file ? (
                      <div>
                        <p className="text-2xl mb-1">{fileIcon(file.name)}</p>
                        <p className="text-sm font-medium text-gray-800 break-all">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatBytes(file.size)}</p>
                        <p className="text-xs text-[#00abc9] mt-2">Tap to change file</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-3xl mb-2">📁</p>
                        <p className="text-sm font-medium text-gray-700">Drag & drop or tap to browse</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, Word, JPG, PNG — up to {MAX_MB} MB</p>
                      </div>
                    )}
                    <input
                      ref={inputRef}
                      type="file"
                      accept={ALLOWED_EXTENSIONS}
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
                    />
                  </div>
                </>
              )}

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 mt-2">
                  <p className="text-xs text-red-700">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={mode === "upload" ? !file : !buildScheduleValid()}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-colors mt-4
                  disabled:opacity-40 disabled:cursor-not-allowed
                  bg-[#00205b] text-white hover:bg-[#00297a]"
              >
                {mode === "build" ? "Submit Schedule →" : "Upload Schedule →"}
              </button>
            </>
          )}

          {/* ── Uploading ── */}
          {state === "uploading" && (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#00abc9] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">Sending… {progress}%</p>
            </div>
          )}

          {/* ── Success ── */}
          {state === "success" && info && (
            <div className="py-6 text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-800 mb-2">Schedule received!</h2>
              <p className="text-sm text-gray-500">
                Thank you, {info.name.split(" ")[0]}. We've received the event schedule
                for <strong>{info.eventName}</strong>. Our team will review it and follow up shortly.
              </p>
              <p className="mt-4 text-xs text-gray-400">Reference: {info.bookingNumber}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-gray-400 text-center">
        Questions? Email{" "}
        <a href="mailto:BXreservations@brainerdbaptist.org" className="text-[#00abc9]">
          BXreservations@brainerdbaptist.org
        </a>
      </p>
    </div>
  );
}
