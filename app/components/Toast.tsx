"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

/* ── Types ── */
export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
  dismissing?: boolean;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

/* ── Context ── */
const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

/* ── Provider ── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    // Mark as dismissing for exit animation, then remove
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 220);
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = `toast-${Date.now()}-${++counterRef.current}`;
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismiss(id), 3000);
    },
    [dismiss]
  );

  const iconFor = (kind: ToastKind) => {
    if (kind === "success")
      return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    if (kind === "error")
      return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={12} cy={12} r={10} /><line x1={15} y1={9} x2={9} y2={15} /><line x1={9} y1={9} x2={15} y2={15} />
        </svg>
      );
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={12} cy={12} r={10} /><line x1={12} y1={8} x2={12} y2={12} /><line x1={12} y1={16} x2={12.01} y2={16} />
      </svg>
    );
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="bx-toast-stack" role="region" aria-label="Notifications" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`bx-toast bx-toast-${t.kind}${t.dismissing ? " dismissing" : ""}`}
              onClick={() => dismiss(t.id)}
              role="alert"
            >
              {iconFor(t.kind)}
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/* ── Hook ── */
export function useToast() {
  return useContext(ToastContext);
}
