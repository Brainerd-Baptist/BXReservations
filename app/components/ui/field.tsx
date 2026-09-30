"use client";

import { createContext, useContext, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/**
 * Field = label + control + hint + error, wired together for screen readers:
 * the label names the control (htmlFor/id), and the hint and error are read
 * with it (aria-describedby). An error also marks the control aria-invalid,
 * which the global CSS turns into a red edge. (Audit F11/F17.)
 *
 *   <Field label="Email" required error={errors.email} hint="We'll send the confirmation here">
 *     <Input type="email" value={…} onChange={…} />
 *   </Field>
 */
type Ctx = { id: string; describedBy?: string; invalid: boolean; required?: boolean };
const FieldContext = createContext<Ctx | null>(null);

export function Field({
  label,
  hint,
  error,
  required,
  id: idProp,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  const auto = useId();
  const id = idProp ?? `f${auto.replace(/[:«»]/g, "")}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error, required }}>
      <div className={["bx-field", className].filter(Boolean).join(" ")}>
        <label htmlFor={id} className="bx-field__label">
          {label}
          {required && <span className="bx-field__req" aria-hidden="true">*</span>}
        </label>
        {children}
        {hint && !error && <p id={hintId} className="bx-field__hint">{hint}</p>}
        {error && <p id={errorId} className="bx-field__error">{error}</p>}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldProps<T extends { id?: string; className?: string }>(props: T) {
  const ctx = useContext(FieldContext);
  return {
    ...props,
    id: props.id ?? ctx?.id,
    "aria-describedby": ctx?.describedBy,
    "aria-invalid": ctx?.invalid || undefined,
    "aria-required": ctx?.required || undefined,
    className: ["bx-input", props.className].filter(Boolean).join(" "),
  };
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...useFieldProps(props)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...useFieldProps(props)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...useFieldProps(props)} />;
}
