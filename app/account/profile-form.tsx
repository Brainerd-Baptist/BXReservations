"use client";

import { useRef, useState, useTransition } from "react";
import { saveProfile } from "./actions";

interface Props {
  displayName: string | null;
  phone: string | null;
  organization: string | null;
  email: string;
}

/** Format digits as (XXX) XXX-XXXX as the user types */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function ProfileForm({ displayName, phone, organization, email }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState(phone ? formatPhone(phone) : "");
  const formRef = useRef<HTMLFormElement>(null);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhoneValue(formatPhone(e.target.value));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Store the formatted value (already in the input)
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await saveProfile(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "grid", gap: "0.75rem" }}>

        {/* Email (read-only) */}
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            readOnly
            style={{ ...inputStyle, background: "#f5f5f5", color: "#666", cursor: "not-allowed" }}
          />
          <p style={hintStyle}>Managed by Google sign-in</p>
        </div>

        {/* Display name */}
        <div>
          <label style={labelStyle}>Full name</label>
          <input
            type="text"
            name="display_name"
            defaultValue={displayName ?? ""}
            placeholder="Your full name"
            style={inputStyle}
            maxLength={100}
          />
        </div>

        {/* Phone — live-formatted */}
        <div>
          <label style={labelStyle}>Phone number</label>
          <input
            type="tel"
            name="phone"
            value={phoneValue}
            onChange={handlePhoneChange}
            placeholder="(555) 555-5555"
            style={inputStyle}
            maxLength={14}
          />
        </div>

        {/* Organization */}
        <div>
          <label style={labelStyle}>Organization / Group</label>
          <input
            type="text"
            name="organization"
            defaultValue={organization ?? ""}
            placeholder="e.g. Youth Group, Community Partner"
            style={inputStyle}
            maxLength={120}
          />
          <p style={hintStyle}>Used to pre-fill reservation requests</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "0.5rem 1.25rem",
            background: "#00205B",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.7 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {isPending ? "Saving…" : "Save profile"}
        </button>

        {saved && (
          <span style={{ fontSize: "0.875rem", color: "#16a34a", fontWeight: 500 }}>
            ✓ Saved
          </span>
        )}
        {error && (
          <span style={{ fontSize: "0.875rem", color: "#dc2626" }}>
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#666",
  marginBottom: "0.35rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid #e0e0e0",
  borderRadius: "6px",
  fontSize: "0.9375rem",
  color: "#111",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.15s",
};

const hintStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#999",
  marginTop: "0.25rem",
};
