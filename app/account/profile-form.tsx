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
          <label htmlFor="profile-fo-email-1" style={labelStyle}>Email</label>
          <input id="profile-fo-email-1" aria-describedby="profile-fo-email-1-hint"
            type="email"
            value={email}
            readOnly
            className="bx-input" style={{ background: "color-mix(in srgb, var(--bx-parchment) 6%, transparent)", color: "var(--bx-slate)", cursor: "not-allowed" }}
          />
          <p id="profile-fo-email-1-hint" style={hintStyle}>Managed by Google sign-in</p>
        </div>

        {/* Display name */}
        <div>
          <label htmlFor="profile-fo-full-name-2" style={labelStyle}>Full name</label>
          <input id="profile-fo-full-name-2"
            type="text"
            name="display_name"
            defaultValue={displayName ?? ""}
            placeholder="Your full name"
            className="bx-input"
            maxLength={100}
          />
        </div>

        {/* Phone — live-formatted */}
        <div>
          <label htmlFor="profile-fo-phone-number-3" style={labelStyle}>Phone number</label>
          <input id="profile-fo-phone-number-3"
            type="tel"
            name="phone"
            value={phoneValue}
            onChange={handlePhoneChange}
            placeholder="(555) 555-5555"
            className="bx-input"
            maxLength={14}
          />
        </div>

        {/* Organization */}
        <div>
          <label htmlFor="profile-fo-organization-group-4" style={labelStyle}>Organization / Group</label>
          <input id="profile-fo-organization-group-4" aria-describedby="profile-fo-organization-group-4-hint"
            type="text"
            name="organization"
            defaultValue={organization ?? ""}
            placeholder="e.g. Youth Group, Community Partner"
            className="bx-input"
            maxLength={120}
          />
          <p id="profile-fo-organization-group-4-hint" style={hintStyle}>Used to pre-fill reservation requests</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button type="submit" disabled={isPending} className="bx-btn bx-btn--primary bx-btn--md">
          {isPending ? "Saving…" : "Save profile"}
        </button>

        {saved && (
          <span role="status" style={{ fontSize: "0.875rem", color: "var(--bx-sage)", fontWeight: 500 }}>
            ✓ Saved
          </span>
        )}
        {error && (
          <span role="alert" style={{ fontSize: "0.875rem", color: "var(--bx-clay)" }}>
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
  textTransform: "uppercase" as const,
  color: "var(--bx-slate)",
  marginBottom: "0.35rem",
};


const hintStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "color-mix(in srgb, var(--bx-slate) 80%, transparent)",
  marginTop: "0.25rem",
};
