"use client";
import CommentsThread from "@/components/bx/CommentsThread";
import EventLogoCard from "@/app/components/event-logo-card";
import VenueSettings from "@/app/components/venue-settings";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BlackoutRule, ruleDescription } from "@/lib/blackouts";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status = "Requested" | "Proposal Sent" | "Needs Info" | "Pending Documents" | "Pending Payment" | "Deposit Received" | "Confirmed" | "Completed" | "Declined" | "Cancelled by BX" | "Cancelled by User" | "Expired";

interface Request {
  id: string;
  name: string;
  org: string;
  email: string;
  room: string;
  date: string;
  event: string;
  guests: number;
  setup: string;
  estimate: number;
  status: Status;
  submitted: string;
  nonProfit: boolean;
  avNeeded: boolean;
  tablecloths: number;
  flexible: boolean; // is the blocked slot a soft block?
  dbId?: string;       // real Supabase UUID — used for API status updates
  // Phase 4: doc completion flags (populated by API)
  organizationId?: string;   // Phase 5: linked org
  agreementSigned?: boolean;
  coiAccepted?: boolean;
  hasPayment?: boolean;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────
const INITIAL_REQUESTS: Request[] = [
  {
    id: "BX-IS117",
    name: "Michelle Smith",
    org: "Isaiah 117 House at Chambliss Center",
    email: "michelle.smith@isaiah117house.com",
    room: "The Crossing",
    date: "2026-10-20",
    event: "Isaiah 117 House Luncheon & Dinner",
    guests: 250,
    setup: "Banquet/Rounds",
    estimate: 750,
    status: "Requested",
    submitted: "2026-03-24",
    nonProfit: true,
    avNeeded: true,
    tablecloths: 32,
    flexible: false,
  },
  {
    id: "BX-HCGOV",
    name: "LaDarius Price",
    org: "Hamilton County Government",
    email: "lprice@hamiltontn.gov",
    room: "The Crossing",
    date: "2026-10-29",
    event: "Mental Health Summit",
    guests: 75,
    setup: "Banquet/Rounds",
    estimate: 900,
    status: "Proposal Sent",
    submitted: "2026-08-14",
    nonProfit: false,
    avNeeded: true,
    tablecloths: 0,
    flexible: false,
  },
  {
    id: "BX-YMCA1",
    name: "Susan Moriarty",
    org: "YMCA Center for Civic Engagement",
    email: "smoriarty@ymcamidtn.org",
    room: "The Crossing",
    date: "2026-10-22",
    event: "Middle School Model UN",
    guests: 200,
    setup: "Theater",
    estimate: 750,
    status: "Deposit Received",
    submitted: "2026-05-27",
    nonProfit: true,
    avNeeded: true,
    tablecloths: 0,
    flexible: false,
  },
  {
    id: "BX-PERRL",
    name: "Kelly Perrel",
    org: "",
    email: "Kperrel@gmail.com",
    room: "CrossView",
    date: "2026-10-03",
    event: "Jonckheere Baby Shower",
    guests: 45,
    setup: "Banquet/Rounds",
    estimate: 250,
    status: "Confirmed",
    submitted: "2026-09-05",
    nonProfit: true,
    avNeeded: false,
    tablecloths: 0,
    flexible: false,
  },
  {
    id: "BX-TRUST",
    name: "Lindsey Gutierrez",
    org: "The Generosity Trust",
    email: "lindsey@thegenerositytrust.org",
    room: "CrossPointe A",
    date: "2026-10-22",
    event: "Faith Community Leadership Roundtable",
    guests: 25,
    setup: "Classroom",
    estimate: 200,
    status: "Declined",
    submitted: "2026-09-09",
    nonProfit: true,
    avNeeded: true,
    tablecloths: 0,
    flexible: false,
  },
]

// ─── Calendar data (combined staff view — real names + flex flags) ─────────────
const CALENDAR_EVENTS = [
  { date: "2026-10-03", room: "CrossView", label: "Perrel Baby Shower (Confirmed)", kind: "rental" as const },
  { date: "2026-10-06", room: "CrossPointe A", label: "City of Chattanooga — Team Training", kind: "rental" as const },
  { date: "2026-10-10", room: "The Crossing", label: "Breton Birthday Party (Inquiry)", kind: "rental" as const },
  { date: "2026-10-20", room: "The Crossing", label: "Isaiah 117 House Luncheon & Dinner (New)", kind: "rental" as const },
  { date: "2026-10-22", room: "The Crossing", label: "YMCA Model UN (Deposit In)", kind: "rental" as const },
  { date: "2026-10-22", room: "CrossPointe A", label: "Generosity Trust Roundtable (Declined)", kind: "declined" as const },
  { date: "2026-10-29", room: "The Crossing", label: "Hamilton Co. Mental Health Summit (Proposal Out)", kind: "rental" as const },
  { date: "2026-10-22", room: "The Loft", label: "Men's Bible Study (weekly — can flex)", kind: "flex" as const },
]



// All statuses in display order (used for filter tabs)
const ALL_STATUSES: Status[] = [
  "Requested",
  "Proposal Sent",
  "Needs Info",
  "Pending Documents",
  "Pending Payment",
  "Deposit Received",
  "Confirmed",
  "Completed",
  "Declined",
  "Cancelled by BX",
  "Cancelled by User",
  "Expired",
];

// Statuses an admin can manually assign
const ADMIN_SETTABLE_STATUSES: Status[] = [
  "Proposal Sent",
  "Needs Info",
  "Pending Documents",
  "Pending Payment",
  "Deposit Received",
  "Confirmed",
  "Completed",
  "Declined",
  "Cancelled by BX",
];

const STATUS_COLORS: Record<Status, string> = {
  Requested:             "bg-amber-100 text-amber-800 border-amber-200",
  "Proposal Sent":       "bg-blue-100 text-blue-800 border-blue-200",
  "Needs Info":          "bg-orange-100 text-orange-800 border-orange-200",
  "Pending Documents":   "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Pending Payment":     "bg-violet-100 text-violet-800 border-violet-200",
  "Deposit Received":    "bg-purple-100 text-purple-800 border-purple-200",
  Confirmed:             "bg-emerald-100 text-emerald-800 border-emerald-200",
  Completed:             "bg-teal-100 text-teal-800 border-teal-200",
  Declined:              "bg-red-100 text-red-800 border-red-200",
  "Cancelled by BX":     "bg-red-100 text-red-800 border-red-200",
  "Cancelled by User":   "bg-gray-100 text-gray-600 border-gray-200",
  Expired:               "bg-gray-100 text-gray-500 border-gray-200",
};

export default function BxReservationsAdmin() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Request | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") ?? "requests";
  const tab = ["requests", "users", "ministries", "settings", "reports"].includes(rawTab)
    ? (rawTab as "requests" | "users" | "ministries" | "settings" | "reports")
    : "requests";
  function setTab(id: "requests" | "users" | "ministries" | "settings" | "reports") {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "requests") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    router.replace(`/admin/bx-reservations?${params.toString()}`);
  }

  // ── Users tab state ──────────────────────────────────────────────────────────
  const [userSearch, setUserSearch] = useState("");
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [savingRole, setSavingRole] = useState<string | null>(null);

  // ── Ministries tab state ─────────────────────────────────────────────────────
  const [selectedMinistryId, setSelectedMinistryId] = useState<string | null>(null);
  const [newMinistryName, setNewMinistryName] = useState("");
  const [newMinistryDesc, setNewMinistryDesc] = useState("");
  const [savingMinistry, setSavingMinistry] = useState(false);

  // ── Calendar events (live from DB) ──────────────────────────────────────────
  type CalEvent = { date: string; room: string; label: string; kind: "rental" | "flex" | "declined" };
  const [calendarEvents, setCalendarEvents] = useState<CalEvent[]>([]);

  // ── Agreements ─────────────────────────────────────────────────────────────
  type AgreementMeta = { token: string; customer_signed_at: string | null; staff_signed_at: string | null };
  const [agreements, setAgreements] = useState<Record<string, AgreementMeta>>({});

  // ── Phase 3: Document & payment state ───────────────────────────────────────
  type DocStatus = {
    coi_file_url: string | null;
    coi_uploaded_at: string | null;
    coi_accepted_at: string | null;
    coi_expiry_date: string | null;
    coi_accepted_by: string | null;
    payment_received_at: string | null;
    payment_amount: number | null;
    payment_method: string | null;
    payment_receipt_url: string | null;
    payment_recorded_by: string | null;
    agreement_sent_at: string | null;
    agreement_signed_at: string | null;
    agreement_id: string | null;
    agreement_pdf_url: string | null;
  };
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({});
  const [docLoading, setDocLoading] = useState<Record<string, boolean>>({});
  const [coiAction, setCoiAction] = useState<Record<string, "accept" | "flag" | null>>({});
  const [coiExpiry, setCoiExpiry] = useState<Record<string, string>>({});
  const [coiFlagNote, setCoiFlagNote] = useState<Record<string, string>>({});
  const [coiBusy, setCoiBusy] = useState<Record<string, boolean>>({});
  const [payForm, setPayForm] = useState<Record<string, { amount: string; method: string; received_at: string; receipt_url: string }>>({});
  const [payBusy, setPayBusy] = useState<Record<string, boolean>>({});
  const [sendingAgreementV2, setSendingAgreementV2] = useState<Record<string, boolean>>({});
  const [countersigning, setCountersigning] = useState<string | null>(null);
  const [countersignName, setCountersignName] = useState("");

  // ── Status control panel state ──────────────────────────────────────
  type HistoryEntry = { id: string; actor_name: string; actor_role: string; action: string; from_status: string | null; to_status: string; note: string | null; created_at: string };
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [statusNote, setStatusNote] = useState<Record<string, string>>({});
  const [cancelReason, setCancelReason] = useState<Record<string, string>>({});
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});

  // ── Blackout rules ────────────────────────────────────────────────────────
  const [blackouts, setBlackouts] = useState<BlackoutRule[]>([]);
  const [blackoutsLoading, setBlackoutsLoading] = useState(true);

  // ── Phase 6: Automation settings state ────────────────────────────────────
  const [automationSettings, setAutomationSettings] = useState<Record<string, string>>({});
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationDraft, setAutomationDraft] = useState<Record<string, string>>({});
  const [newRuleType, setNewRuleType] = useState<"dow" | "dow_slot" | "date">("dow");
  const [newDow, setNewDow] = useState(0);
  const [newSlot, setNewSlot] = useState("evening");
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Phase 5: Org suggestion widget state ───────────────────────────────────
  interface OrgSuggestion { id: string; name: string; score: number; }
  interface LinkedOrg { id: string; name: string; has_coi: boolean; coi_expiry_date: string | null; }
  const [orgSuggestions, setOrgSuggestions] = useState<Record<string, OrgSuggestion[]>>({});
  const [linkedOrg, setLinkedOrg] = useState<Record<string, LinkedOrg | null>>({});
  const [orgLinking, setOrgLinking] = useState<Record<string, boolean>>({});

  // ── Delete reservation ───────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  function loadOrgData(req: Request) {
    if (req.organizationId) {
      fetch(`/api/admin/organizations/${req.organizationId}`)
        .then(r => r.json())
        .then(d => {
          if (d.organization) {
            setLinkedOrg(prev => ({ ...prev, [req.id]: {
              id: d.organization.id,
              name: d.organization.name,
              has_coi: d.organization.has_coi,
              coi_expiry_date: d.organization.coi_expiry_date,
            }}));
          }
        })
        .catch(() => {});
    } else if (req.org) {
      const params = new URLSearchParams({ contact_org: req.org });
      fetch(`/api/admin/organizations/suggest?${params}`)
        .then(r => r.json())
        .then(d => {
          if (d.suggestions) {
            setOrgSuggestions(prev => ({ ...prev, [req.id]: d.suggestions }));
          }
        })
        .catch(() => {});
    }
  }

  async function handleLinkOrg(req: Request, orgId: string) {
    setOrgLinking(prev => ({ ...prev, [req.id]: true }));
    try {
      await fetch(`/api/admin/organizations/${orgId}/link-reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: req.dbId }),
      });
      const updated = { ...req, organizationId: orgId };
      setRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      setSelected(updated);
      setOrgSuggestions(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      loadOrgData(updated);
    } finally {
      setOrgLinking(prev => ({ ...prev, [req.id]: false }));
    }
  }

  async function handleUnlinkOrg(req: Request) {
    if (!req.organizationId) return;
    setOrgLinking(prev => ({ ...prev, [req.id]: true }));
    try {
      await fetch(`/api/admin/organizations/${req.organizationId}/link-reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: req.dbId, unlink: true }),
      });
      const updated = { ...req, organizationId: undefined };
      setRequests(prev => prev.map(r => r.id === req.id ? updated : r));
      setSelected(updated);
      setLinkedOrg(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      loadOrgData(updated);
    } finally {
      setOrgLinking(prev => ({ ...prev, [req.id]: false }));
    }
  }

  // ── Load real reservations from DB ─────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/reservations")
      .then(r => r.json())
      .then((data: Request[]) => { setRequests(data); setReservationsLoading(false); })
      .catch(err => { console.error("Failed to load reservations:", err); setReservationsLoading(false); });
  }, []);

  useEffect(() => {
    fetch("/api/blackouts")
      .then(r => r.json())
      .then((data: BlackoutRule[]) => { setBlackouts(data); setBlackoutsLoading(false); })
      .catch(() => setBlackoutsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/admin/calendar")
      .then(r => r.json())
      .then((data: { events?: CalEvent[] }) => { if (data.events) setCalendarEvents(data.events); })
      .catch(err => console.error("Failed to load calendar events:", err));
  }, []);

  async function addBlackout() {
    let data: Record<string, unknown> = {};
    if (newRuleType === "dow") data = { dow: newDow };
    else if (newRuleType === "dow_slot") data = { dow: newDow, slot: newSlot };
    else if (newRuleType === "date") data = { date: newDate };
    setSaving(true);
    const res = await fetch("/api/blackouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule_type: newRuleType, data, label: newLabel }),
    });
    if (res.ok) {
      const rule = await res.json() as BlackoutRule;
      setBlackouts(prev => [...prev, rule]);
      setNewLabel(""); setNewDate("");
    }
    setSaving(false);
  }

  async function removeBlackout(id: string) {
    await fetch("/api/blackouts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBlackouts(prev => prev.filter(r => r.id !== id));
  }

  const filtered = requests.filter(r => {
    if (filter !== "All" && r.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.org.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.event.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.room.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function changeStatus(req: Request, newStatus: Status, note?: string, reason?: string) {
    if (!req.dbId) return;
    setChangingStatus(req.id);
    const body: Record<string, string> = { dbId: req.dbId, status: newStatus };
    if (note) body.note = note;
    if (reason) body.cancelReason = reason;
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = { ...req, status: newStatus };
        setRequests(prev => prev.map(r => r.id === req.id ? updated : r));
        if (selected?.id === req.id) setSelected(updated);
        setStatusDraft(prev => { const n = { ...prev }; delete n[req.id]; return n; });
        setStatusNote(prev => { const n = { ...prev }; delete n[req.id]; return n; });
        setCancelReason(prev => { const n = { ...prev }; delete n[req.id]; return n; });
        fetchHistory(req.id, req.dbId);
      } else {
        const err = await res.json().catch(() => ({}));
        alert("Status update failed: " + (err.error ?? res.status));
      }
    } catch (e) {
      console.error("[admin] changeStatus failed:", e);
      alert("Network error — status not updated.");
    }
    setChangingStatus(null);
  }

  async function fetchHistory(localId: string, dbId: string) {
    setHistoryLoading(prev => ({ ...prev, [localId]: true }));
    try {
      const res = await fetch(`/api/reservations/${dbId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(prev => ({ ...prev, [localId]: data }));
      }
    } catch (e) {
      console.error("[admin] fetchHistory failed:", e);
    }
    setHistoryLoading(prev => ({ ...prev, [localId]: false }));
  }

  // ── Phase 3: fetch doc/payment status ───────────────────────────────────────
  async function fetchDocStatus(localId: string, dbId: string) {
    if (docStatus[localId] || docLoading[localId]) return;
    setDocLoading(prev => ({ ...prev, [localId]: true }));
    try {
      const res = await fetch(`/api/admin/reservations/${dbId}`);
      if (!res.ok) return;
      const data = await res.json();
      const r = data.reservation;
      const ag = data.agreement;
      setDocStatus(prev => ({
        ...prev,
        [localId]: {
          coi_file_url:        r.coi_file_url ?? null,
          coi_uploaded_at:     r.coi_uploaded_at ?? null,
          coi_accepted_at:     r.coi_accepted_at ?? null,
          coi_expiry_date:     r.coi_expiry_date ?? null,
          coi_accepted_by:     r.coi_accepted_by ?? null,
          payment_received_at: r.payment_received_at ?? null,
          payment_amount:      r.payment_amount ?? null,
          payment_method:      r.payment_method ?? null,
          payment_receipt_url: r.payment_receipt_url ?? null,
          payment_recorded_by: r.payment_recorded_by ?? null,
          agreement_sent_at:   ag?.sent_at ?? null,
          agreement_signed_at: ag?.customer_signed_at ?? null,
          agreement_id:        ag?.id ?? null,
          agreement_pdf_url:   ag?.pdf_url ?? null,
        }
      }));
    } catch { /* silent */ }
    finally { setDocLoading(prev => ({ ...prev, [localId]: false })); }
  }

  async function handleCoiAction(req: Request, action: "accept" | "flag") {
    if (!req.dbId) return;
    setCoiBusy(prev => ({ ...prev, [req.id]: true }));
    try {
      const body: Record<string, string> = { action };
      if (action === "accept") body.expiry_date = coiExpiry[req.id] ?? "";
      if (action === "flag")   body.note        = coiFlagNote[req.id] ?? "";
      const res = await fetch(`/api/admin/reservations/${req.dbId}/coi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Error"); return; }
      setDocStatus(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setDocLoading(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setCoiAction(prev => ({ ...prev, [req.id]: null }));
      fetchDocStatus(req.id, req.dbId!);
    } catch { alert("Request failed — please try again."); }
    finally { setCoiBusy(prev => ({ ...prev, [req.id]: false })); }
  }

  async function handlePayment(req: Request) {
    if (!req.dbId) return;
    const pf = payForm[req.id] ?? { amount: "", method: "", received_at: "", receipt_url: "" };
    if (!pf.amount || isNaN(parseFloat(pf.amount)) || parseFloat(pf.amount) <= 0) { alert("Enter a valid payment amount."); return; }
    if (!pf.method.trim()) { alert("Enter a payment method (e.g. check, card, cash)."); return; }
    setPayBusy(prev => ({ ...prev, [req.id]: true }));
    try {
      const res = await fetch(`/api/admin/reservations/${req.dbId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_amount:      parseFloat(pf.amount),
          payment_method:      pf.method.trim(),
          payment_received_at: pf.received_at || undefined,
          payment_receipt_url: pf.receipt_url.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Error"); return; }
      setPayForm(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setDocStatus(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setDocLoading(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      fetchDocStatus(req.id, req.dbId!);
    } catch { alert("Request failed — please try again."); }
    finally { setPayBusy(prev => ({ ...prev, [req.id]: false })); }
  }

  async function handleSendAgreementV2(req: Request) {
    if (!req.dbId) return;
    setSendingAgreementV2(prev => ({ ...prev, [req.id]: true }));
    try {
      const res = await fetch(`/api/admin/reservations/${req.dbId}/send-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Error sending agreement"); return; }
      alert(`Agreement sent to ${req.email}!`);
      setDocStatus(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setDocLoading(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      fetchDocStatus(req.id, req.dbId!);
    } catch { alert("Failed to send — please try again."); }
    finally { setSendingAgreementV2(prev => ({ ...prev, [req.id]: false })); }
  }

  // KPIs
  const pending = requests.filter((r) => r.status === "Requested").length;
  const awaitingDeposit = requests.filter((r) => r.status === "Proposal Sent").length;

  async function doCountersign(req: Request) {
    const name = countersignName.trim();
    if (!name) return;
    const ag = agreements[req.id];
    if (!ag) return;
    try {
      const res = await fetch("/api/agreements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ag.token, staff_name: name }),
      });
      const data = await res.json();
      if (!res.ok) { alert("Error countersigning: " + (data.error ?? "Unknown")); return; }
      setAgreements(prev => ({ ...prev, [req.id]: { ...ag, staff_signed_at: data.staff_signed_at } }));
      setCountersigning(null);
      setCountersignName("");
      alert("Agreement fully executed! Both parties have signed.");
    } catch { alert("Failed to countersign — please try again."); }
  }

  const confirmedThisMonth = requests.filter(
    (r) => r.status === "Confirmed" && r.date.startsWith("2026-10")
  ).length;
  const revenue = requests
    .filter((r) => r.status === "Confirmed" || r.status === "Deposit Received")
    .reduce((s, r) => s + r.estimate, 0);

  // ── Delete reservation ───────────────────────────────────────────────────────
  async function deleteReservation(req: Request) {
    if (!req.dbId) return;
    setDeleting(req.id);
    try {
      const res = await fetch(`/api/admin/reservations/${req.dbId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Delete failed: ${body.error ?? res.status}`);
        return;
      }
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setSelected(null);
      setDeleteConfirm(null);
    } catch (err) {
      console.error("[delete reservation]", err);
      alert("Delete failed — see console.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen bg-ink font-sans">

      <div className={`max-w-7xl mx-auto px-4 py-6 gap-6 ${tab === "requests" ? "grid lg:grid-cols-[1fr_320px]" : "block"}`}>
        {/* Left: queue / settings */}
        <div className="space-y-5">
          {tab === "settings" && (
            <>
            <AutomationSettings
              settings={automationSettings}
              draft={automationDraft}
              loading={automationLoading}
              saving={automationSaving}
              onLoad={() => {
                setAutomationLoading(true);
                fetch("/api/admin/automation-settings")
                  .then(r => r.json())
                  .then(d => {
                    setAutomationSettings(d.settings ?? {});
                    setAutomationDraft(d.settings ?? {});
                  })
                  .finally(() => setAutomationLoading(false));
              }}
              onChange={(k, v) => setAutomationDraft(prev => ({ ...prev, [k]: v }))}
              onSave={async () => {
                setAutomationSaving(true);
                try {
                  await fetch("/api/admin/automation-settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ settings: automationDraft }),
                  });
                  setAutomationSettings({ ...automationDraft });
                } finally { setAutomationSaving(false); }
              }}
            />
            <VenueSettings />
            <BlackoutSettings
              rules={blackouts}
              loading={blackoutsLoading}
              newRuleType={newRuleType} setNewRuleType={setNewRuleType}
              newDow={newDow} setNewDow={setNewDow}
              newSlot={newSlot} setNewSlot={setNewSlot}
              newDate={newDate} setNewDate={setNewDate}
              newLabel={newLabel} setNewLabel={setNewLabel}
              saving={saving}
              onAdd={addBlackout}
              onRemove={removeBlackout}
            />
            </>
          )}
          {tab === "requests" && (<>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Pending Review" value={String(pending)} color="text-amber-600" />
            <KPI label="Awaiting Deposit" value={String(awaitingDeposit)} color="text-blue-600" />
            <KPI label="Confirmed (Oct)" value={String(confirmedThisMonth)} color="text-emerald-600" />
            <KPI label="Revenue Pipeline" value={`$${revenue.toLocaleString()}`} color="text-[var(--bbc-blue)]" />
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="search"
              placeholder="Search by name, org, email, event, booking #…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-parchment/20 bg-ink-soft text-parchment text-sm px-4 py-2.5 placeholder-slate focus:outline-none focus:ring-2 focus:ring-[var(--bbc-blue)] pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate hover:text-parchment text-lg leading-none"
              >×</button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {(["All", ...ALL_STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  filter === s
                    ? "bg-[var(--bbc-navy)] text-white border-[var(--bbc-navy)]"
                    : "bg-ink-soft text-slate border-parchment/15 hover:border-parchment/30"
                }`}
              >
                {s}
                {s !== "All" && (
                  <span className="ml-1.5 opacity-60">
                    {requests.filter((r) => r.status === s).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Request cards */}
          <div className="space-y-3">
            {reservationsLoading && (
              <div className="bg-ink-soft rounded-xl border border-parchment/10 p-10 text-center text-slate text-sm animate-pulse">
                Loading reservations…
              </div>
            )}
            {!reservationsLoading && filtered.length === 0 && (
              <div className="bg-ink-soft rounded-xl border border-parchment/10 p-10 text-center text-slate text-sm">
                No requests with this status
              </div>
            )}
            {filtered.map((req) => (
              <div
                key={req.id}
                className={`bg-ink-soft rounded-xl border border-parchment/10 p-4 cursor-pointer transition-all hover:shadow-md ${
                  selected?.id === req.id ? "ring-2 ring-[var(--bbc-blue)]" : ""
                }`}
                onClick={() => setSelected(selected?.id === req.id ? null : req)}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-parchment text-sm">{req.name}</p>
                      {req.org && <p className="text-xs text-slate">· {req.org}</p>}
                      {req.flexible && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          ⚠ Soft block
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate">
                      <span className="font-semibold">{req.event}</span> — {req.room} · {req.date}
                    </p>
                    <p className="text-xs text-slate mt-0.5">{req.id} · Submitted {req.submitted}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Doc status indicators */}
                    <span className="flex gap-1 items-center" title="Agreement / COI / Payment">
                      <span className={`text-xs ${req.agreementSigned ? "text-emerald-400" : "text-slate/40"}`} title={req.agreementSigned ? "Agreement signed" : "No agreement"}>📄</span>
                      <span className={`text-xs ${req.coiAccepted ? "text-emerald-400" : "text-slate/40"}`} title={req.coiAccepted ? "COI accepted" : "No COI"}>🛡</span>
                      <span className={`text-xs ${req.hasPayment ? "text-emerald-400" : "text-slate/40"}`} title={req.hasPayment ? "Payment recorded" : "No payment"}>💰</span>
                    </span>
                    <span className="font-bold text-sm text-parchment">${req.estimate.toLocaleString()}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[req.status]}`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {selected?.id === req.id && (
                  <div className="mt-4 pt-4 border-t border-parchment/10 space-y-4">
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <Detail label="Email" value={req.email} />
                      <Detail label="Guests" value={String(req.guests)} />
                      <Detail label="Setup" value={req.setup} />
                      <Detail label="Rate type" value={req.nonProfit ? "Non-profit" : "Standard"} />
                      <Detail label="A/V" value={req.avNeeded ? "Yes" : "No"} />
                      <Detail label="Tablecloths" value={String(req.tablecloths)} />
                    </div>

                    {/* ── Event map + logo review (Phase B) — only for rows backed by a real reservation */}
                    {req.dbId && (
                      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-start" onClick={e => e.stopPropagation()}>
                        <EventLogoCard reservationId={req.dbId} canEdit staff compact />
                        <div className="flex flex-col gap-2">
                          <a
                            href={`/reservations/${req.dbId}/event-map`}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-parchment/15 text-parchment hover:border-[var(--bbc-blue)]"
                          >
                            Open event map →
                          </a>
                          <a href={`/api/event-map/${req.dbId}/signs?inline=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-parchment/15 text-parchment hover:border-[var(--bbc-blue)]">
                            Door signs
                          </a>
                          <a href={`/api/event-map/${req.dbId}/signs?variant=staff&inline=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-parchment/15 text-parchment hover:border-[var(--bbc-blue)]">
                            Staff signs
                          </a>
                          <a href={`/api/event-map/${req.dbId}/setup-sheet?inline=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-parchment/15 text-parchment hover:border-[var(--bbc-blue)]">
                            Setup sheet
                          </a>
                          <a href={`/api/event-map/${req.dbId}/packet?inline=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-parchment/15 text-parchment hover:border-[var(--bbc-blue)]">
                            Attendee packet
                          </a>
                        </div>
                      </div>
                    )}

                    {/* ── Status control panel */}
                    {req.status !== "Cancelled by User" && req.status !== "Expired" && req.status !== "Completed" && req.status !== "Cancelled by BX" && (() => {
                      const draft = statusDraft[req.id] ?? "";
                      const note = statusNote[req.id] ?? "";
                      const isCancelFlow = draft === "Cancelled by BX";
                      const reason = cancelReason[req.id] ?? "";
                      const busy = changingStatus === req.id;
                      return (
                        <div className="space-y-3 border border-parchment/10 rounded-xl p-4 bg-ink/40" onClick={e => e.stopPropagation()}>
                          <p className="text-xs font-semibold text-slate uppercase tracking-widest">Update Status</p>
                          <select
                            className="w-full rounded-lg border border-parchment/20 bg-ink text-parchment text-sm px-3 py-2"
                            value={draft}
                            onChange={e => setStatusDraft(prev => ({ ...prev, [req.id]: e.target.value }))}
                          >
                            <option value="">— select new status —</option>
                            {ADMIN_SETTABLE_STATUSES.filter(s => s !== req.status).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          {draft && !isCancelFlow && (
                            <textarea
                              className="w-full rounded-lg border border-parchment/20 bg-ink text-parchment text-sm px-3 py-2 placeholder-slate resize-none"
                              placeholder="Internal note (optional)"
                              rows={2}
                              value={note}
                              onChange={e => setStatusNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                            />
                          )}
                          {isCancelFlow && (
                            <textarea
                              className="w-full rounded-lg border border-red-300/30 bg-ink text-parchment text-sm px-3 py-2 placeholder-slate resize-none"
                              placeholder="Cancellation reason (required)"
                              rows={2}
                              value={reason}
                              onChange={e => setCancelReason(prev => ({ ...prev, [req.id]: e.target.value }))}
                            />
                          )}
                          {draft && (
                            <div className="flex gap-2">
                              <button
                                className={`btn-primary text-sm ${isCancelFlow ? "bg-red-600 hover:bg-red-700" : ""}`}
                                disabled={busy || (isCancelFlow && !reason.trim())}
                                onClick={() => changeStatus(req, draft as Status, note || undefined, reason || undefined)}
                              >
                                {busy ? "Saving…" : isCancelFlow ? "Cancel Reservation" : `Set → ${draft}`}
                              </button>
                              <button
                                className="btn-outline text-sm"
                                onClick={() => {
                                  setStatusDraft(prev => { const n = { ...prev }; delete n[req.id]; return n; });
                                  setStatusNote(prev => { const n = { ...prev }; delete n[req.id]; return n; });
                                  setCancelReason(prev => { const n = { ...prev }; delete n[req.id]; return n; });
                                }}
                              >Clear</button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── History log */}
                    {(() => {
                      const entries = history[req.id];
                      const loading = historyLoading[req.id];
                      if (!entries && !loading && req.dbId) {
                        setTimeout(() => fetchHistory(req.id, req.dbId!), 0);
                      }
                      return (
                        <div className="space-y-2" onClick={e => e.stopPropagation()}>
                          <p className="text-xs font-semibold text-slate uppercase tracking-widest">History</p>
                          {loading && <p className="text-xs text-slate animate-pulse">Loading…</p>}
                          {!loading && entries && entries.length === 0 && <p className="text-xs text-slate">No history yet.</p>}
                          {!loading && entries && entries.length > 0 && (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {entries.map(h => (
                                <div key={h.id} className="flex gap-3 text-xs">
                                  <span className="text-slate/60 flex-shrink-0 pt-0.5">{new Date(h.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                                  <div className="flex-1">
                                    <span className="text-parchment font-medium">{h.actor_name || h.actor_role}</span>
                                    {h.to_status && <span className="text-slate"> → <span className="font-semibold text-parchment/80">{h.to_status.replace(/_/g, " ")}</span></span>}
                                    {h.note && <p className="text-slate/80 mt-0.5 italic">{h.note}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* ── Phase 3: Documents & Payment ──────────────────── */}
                    {req.dbId && (() => {
                      const ds = docStatus[req.id];
                      const loading = docLoading[req.id];
                      if (!ds && !loading) {
                        setTimeout(() => fetchDocStatus(req.id, req.dbId!), 0);
                      }
                      return (
                        <div className="space-y-4 border border-parchment/10 rounded-xl p-4 bg-ink/40" onClick={e => e.stopPropagation()}>
                          <p className="text-xs font-semibold text-slate uppercase tracking-widest">Documents &amp; Payment</p>
                          {loading && <p className="text-xs text-slate animate-pulse">Loading…</p>}
                          {!loading && ds && (<>

                            {/* Agreement */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-parchment/70">Facility Use Agreement</p>
                              {!ds.agreement_sent_at && (
                                <button
                                  className="btn-outline text-xs"
                                  disabled={sendingAgreementV2[req.id]}
                                  onClick={() => handleSendAgreementV2(req)}
                                >
                                  {sendingAgreementV2[req.id] ? "Sending…" : "Send Agreement to Customer →"}
                                </button>
                              )}
                              {ds.agreement_sent_at && !ds.agreement_signed_at && (
                                <div className="space-y-1">
                                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                    ⏳ Sent {new Date(ds.agreement_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — awaiting signature
                                  </p>
                                  <button
                                    className="btn-outline text-xs"
                                    disabled={sendingAgreementV2[req.id]}
                                    onClick={() => handleSendAgreementV2(req)}
                                  >
                                    {sendingAgreementV2[req.id] ? "Sending…" : "Resend Agreement →"}
                                  </button>
                                </div>
                              )}
                              {ds.agreement_signed_at && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                                    ✓ Signed {new Date(ds.agreement_signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                  {ds.agreement_pdf_url && (
                                    <a href={ds.agreement_pdf_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--bx-brass)] underline">
                                      View PDF
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* COI */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-parchment/70">Certificate of Insurance</p>
                              {!ds.coi_uploaded_at && (
                                <p className="text-xs text-slate">No COI uploaded yet.</p>
                              )}
                              {ds.coi_uploaded_at && !ds.coi_accepted_at && (() => {
                                const act = coiAction[req.id];
                                const busy = coiBusy[req.id];
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                        ⏳ Uploaded {new Date(ds.coi_uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — pending review
                                      </p>
                                      {ds.coi_file_url && (
                                        <a href={ds.coi_file_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--bx-brass)] underline">
                                          View COI
                                        </a>
                                      )}
                                    </div>
                                    {!act && (
                                      <div className="flex gap-2">
                                        <button className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => setCoiAction(prev => ({ ...prev, [req.id]: "accept" }))}>
                                          ✓ Accept COI
                                        </button>
                                        <button className="btn-outline text-xs border-red-300/40 text-red-400 hover:text-red-300" onClick={() => setCoiAction(prev => ({ ...prev, [req.id]: "flag" }))}>
                                          ⚠ Flag Issue
                                        </button>
                                      </div>
                                    )}
                                    {act === "accept" && (
                                      <div className="space-y-2">
                                        <label className="text-xs text-slate">Expiry date (optional)</label>
                                        <input
                                          type="date"
                                          className="rounded-lg border border-parchment/20 bg-ink text-parchment text-xs px-2 py-1"
                                          value={coiExpiry[req.id] ?? ""}
                                          onChange={e => setCoiExpiry(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        />
                                        <div className="flex gap-2">
                                          <button className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => handleCoiAction(req, "accept")}>
                                            {busy ? "Saving…" : "Confirm Accept"}
                                          </button>
                                          <button className="btn-outline text-xs" onClick={() => setCoiAction(prev => ({ ...prev, [req.id]: null }))}>Cancel</button>
                                        </div>
                                      </div>
                                    )}
                                    {act === "flag" && (
                                      <div className="space-y-2">
                                        <textarea
                                          className="w-full rounded-lg border border-red-300/30 bg-ink text-parchment text-xs px-2 py-1 placeholder-slate resize-none"
                                          rows={2}
                                          placeholder="Describe the issue (sent as a message to the customer)"
                                          value={coiFlagNote[req.id] ?? ""}
                                          onChange={e => setCoiFlagNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        />
                                        <div className="flex gap-2">
                                          <button className="btn-outline text-xs border-red-300/40 text-red-400 hover:text-red-300" disabled={busy} onClick={() => handleCoiAction(req, "flag")}>
                                            {busy ? "Sending…" : "Send Flag to Customer"}
                                          </button>
                                          <button className="btn-outline text-xs" onClick={() => setCoiAction(prev => ({ ...prev, [req.id]: null }))}>Cancel</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              {ds.coi_accepted_at && (
                                <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                                  ✓ Accepted by {ds.coi_accepted_by}{ds.coi_expiry_date ? ` — expires ${ds.coi_expiry_date}` : ""}
                                </p>
                              )}
                            </div>

                            {/* Payment */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-parchment/70">Payment</p>
                              {ds.payment_received_at ? (
                                <div className="space-y-1">
                                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                                    ✓ ${Number(ds.payment_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} via {ds.payment_method} — received {new Date(ds.payment_received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                  {ds.payment_receipt_url && (
                                    <a href={ds.payment_receipt_url} target="_blank" rel="noreferrer" className="text-xs text-[var(--bx-brass)] underline">
                                      View receipt
                                    </a>
                                  )}
                                </div>
                              ) : (() => {
                                const pf = payForm[req.id] ?? { amount: "", method: "", received_at: "", receipt_url: "" };
                                const busy = payBusy[req.id];
                                function updPay(k: string, v: string) {
                                  setPayForm(prev => ({ ...prev, [req.id]: { ...(prev[req.id] ?? { amount: "", method: "", received_at: "", receipt_url: "" }), [k]: v } }));
                                }
                                return (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs text-slate">Amount ($)</label>
                                        <input type="number" min="0" step="0.01" placeholder="0.00"
                                          className="w-full rounded-lg border border-parchment/20 bg-ink text-parchment text-xs px-2 py-1 mt-0.5"
                                          value={pf.amount} onChange={e => updPay("amount", e.target.value)} />
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate">Method</label>
                                        <input type="text" placeholder="check, card, cash…"
                                          className="w-full rounded-lg border border-parchment/20 bg-ink text-parchment text-xs px-2 py-1 mt-0.5"
                                          value={pf.method} onChange={e => updPay("method", e.target.value)} />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs text-slate">Date received</label>
                                        <input type="date"
                                          className="w-full rounded-lg border border-parchment/20 bg-ink text-parchment text-xs px-2 py-1 mt-0.5"
                                          value={pf.received_at} onChange={e => updPay("received_at", e.target.value)} />
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate">Receipt URL (optional)</label>
                                        <input type="url" placeholder="https://…"
                                          className="w-full rounded-lg border border-parchment/20 bg-ink text-parchment text-xs px-2 py-1 mt-0.5"
                                          value={pf.receipt_url} onChange={e => updPay("receipt_url", e.target.value)} />
                                      </div>
                                    </div>
                                    <button className="btn-primary text-xs" disabled={busy} onClick={() => handlePayment(req)}>
                                      {busy ? "Saving…" : "Record Payment"}
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          </>)}
                        </div>
                      );
                    })()}

                    {/* ── Comments thread */}
                    {req.dbId && (
                      <div className="space-y-2 pt-1" onClick={e => e.stopPropagation()}>
                        <p className="text-xs font-semibold text-slate uppercase tracking-widest">Messages</p>
                        <CommentsThread
                          reservationId={req.dbId}
                          fetchUrl={`/api/admin/reservations/${req.dbId}/comments`}
                          postUrl={`/api/admin/reservations/${req.dbId}/comments`}
                          canInternal={true}
                          autoLoad={false}
                        />
                      </div>
                    )}

                    {/* ── Phase 5: Organization Intelligence Widget */}
                    {req.org && (
                      <div className="space-y-2 pt-1" onClick={e => e.stopPropagation()}>
                        <p className="text-xs font-semibold text-slate uppercase tracking-widest">Organization</p>
                        {(() => {
                          const org = linkedOrg[req.id];
                          const suggestions = orgSuggestions[req.id];
                          const busy = orgLinking[req.id];

                          // Lazy-load org data when panel opens
                          if (org === undefined && !suggestions && req.organizationId) {
                            loadOrgData(req);
                          } else if (org === undefined && !suggestions && !req.organizationId && req.org) {
                            loadOrgData(req);
                          }

                          if (req.organizationId && org) {
                            const coiExpiry = org.coi_expiry_date ? new Date(org.coi_expiry_date) : null;
                            const coiValid = org.has_coi && (!coiExpiry || coiExpiry > new Date());
                            const coiExpiringSoon = coiExpiry && coiValid && (coiExpiry.getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000;
                            return (
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <a
                                      href={`/admin/bx-reservations/organizations/${org.id}`}
                                      className="text-sm font-medium text-blue-600 hover:underline"
                                      target="_blank"
                                    >
                                      {org.name}
                                    </a>
                                    <p className="text-xs text-gray-500 mt-0.5">Linked organization</p>
                                  </div>
                                  <button
                                    onClick={() => handleUnlinkOrg(req)}
                                    disabled={busy}
                                    className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                                  >
                                    {busy ? "…" : "Unlink"}
                                  </button>
                                </div>
                                {/* COI carry-forward banner */}
                                {org.has_coi && coiValid && (
                                  <div className={`text-xs rounded px-2 py-1.5 flex items-center gap-1.5 ${coiExpiringSoon ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                                    <span>{coiExpiringSoon ? "⚠️" : "✓"}</span>
                                    <span>
                                      {coiExpiringSoon
                                        ? `COI expires ${org.coi_expiry_date} — remind org to renew`
                                        : `Valid COI on file${org.coi_expiry_date ? ` — expires ${org.coi_expiry_date}` : ""}. No new upload required unless coverage changed.`}
                                    </span>
                                  </div>
                                )}
                                {org.has_coi && !coiValid && coiExpiry && (
                                  <div className="text-xs rounded px-2 py-1.5 flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200">
                                    <span>✗</span>
                                    <span>COI expired {org.coi_expiry_date} — fresh COI required for upcoming reservations.</span>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          if (!req.organizationId) {
                            return (
                              <div className="rounded-lg border border-dashed border-parchment/20 p-3 space-y-2">
                                <p className="text-xs text-slate">Submitter listed: <span className="font-medium text-parchment/80">{req.org}</span></p>
                                {suggestions && suggestions.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Possible matches:</p>
                                    {suggestions.map(s => (
                                      <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                                        <a
                                          href={`/admin/bx-reservations/organizations/${s.id}`}
                                          className="text-blue-600 hover:underline truncate"
                                          target="_blank"
                                        >
                                          {s.name}
                                        </a>
                                        <button
                                          onClick={() => handleLinkOrg(req, s.id)}
                                          disabled={busy}
                                          className="btn-outline text-xs shrink-0"
                                        >
                                          {busy ? "Linking…" : "Link"}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {suggestions && suggestions.length === 0 && (
                                  <p className="text-xs text-gray-400">No existing org matches found.</p>
                                )}
                                <div className="pt-1">
                                  <a
                                    href="/admin/bx-reservations/organizations"
                                    className="text-xs text-blue-600 hover:underline"
                                    target="_blank"
                                  >
                                    Manage organizations →
                                  </a>
                                </div>
                              </div>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    )}

                    {req.status === "Confirmed" && (() => {
                      const ag = agreements[req.id];
                      const customerSigned = !!ag?.customer_signed_at;
                      const staffSigned    = !!ag?.staff_signed_at;
                      return (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-semibold text-emerald-600">✓ Confirmed</p>
                          {/* Agreement status */}

                          {ag && !customerSigned && (
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              ⏳ Agreement sent — awaiting customer signature
                            </p>
                          )}
                          {ag && customerSigned && !staffSigned && (
                            countersigning === req.id ? (
                              <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  className="border border-parchment/20 rounded px-2 py-1 text-xs w-44 bg-ink text-parchment"
                                  placeholder="Your full name"
                                  value={countersignName}
                                  onChange={(e) => setCountersignName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") doCountersign(req); }}
                                  autoFocus
                                />
                                <button className="btn-primary text-xs" onClick={() => doCountersign(req)}>Sign</button>
                                <button className="text-xs text-slate hover:text-parchment" onClick={() => { setCountersigning(null); setCountersignName(""); }}>Cancel</button>
                              </div>
                            ) : (
                              <button
                                className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700"
                                onClick={(e) => { e.stopPropagation(); setCountersigning(req.id); setCountersignName(""); }}
                              >
                                ✍ Countersign Agreement
                              </button>
                            )
                          )}
                          {ag && customerSigned && staffSigned && (
                            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                              ✓ Agreement fully executed — both parties signed
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    {req.status === "Declined" && (
                      <p className="text-xs text-slate">This request was declined.</p>
                    )}

                    {/* ── Delete reservation (admin only) */}
                    <div className="pt-2 border-t border-red-900/20">
                      {deleteConfirm === req.id ? (
                        <div className="rounded-lg border border-red-400/40 bg-red-950/30 p-3 space-y-2">
                          <p className="text-xs font-semibold text-red-400">
                            Permanently delete <span className="font-bold">{req.id}</span>? This removes all comments, history, agreements, and COI files and cannot be undone.
                          </p>
                          <div className="flex gap-2">
                            <button
                              className="btn-primary text-xs bg-red-600 hover:bg-red-700"
                              disabled={deleting === req.id}
                              onClick={() => deleteReservation(req)}
                            >
                              {deleting === req.id ? "Deleting…" : "Yes, delete permanently"}
                            </button>
                            <button
                              className="btn-outline text-xs"
                              disabled={deleting === req.id}
                              onClick={() => setDeleteConfirm(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-red-500/60 hover:text-red-400 transition-colors"
                          onClick={e => { e.stopPropagation(); setDeleteConfirm(req.id); }}
                        >
                          Delete reservation…
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          </>)}

          {/* ── Users tab ─────────────────────────────────────────────────── */}
          {tab === "users" && (
            <UsersTab
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              pendingRoles={pendingRoles}
              setPendingRoles={setPendingRoles}
              savingRole={savingRole}
              setSavingRole={setSavingRole}
            />
          )}

          {/* ── Ministries tab ────────────────────────────────────────────── */}
          {tab === "ministries" && (
            <MinistriesTab
              selectedMinistryId={selectedMinistryId}
              setSelectedMinistryId={setSelectedMinistryId}
              newMinistryName={newMinistryName}
              setNewMinistryName={setNewMinistryName}
              newMinistryDesc={newMinistryDesc}
              setNewMinistryDesc={setNewMinistryDesc}
              savingMinistry={savingMinistry}
              setSavingMinistry={setSavingMinistry}
            />
          )}

          {/* ── Reports tab ────────────────────────────────────────────────── */}
          {tab === "reports" && <ReportsTab />}

          {/* ── Documents hub shortcut ─────────────────────────────────── */}
          {tab === "requests" && (
            <div className="flex justify-end pt-2">
              <a
                href="/admin/bx-reservations/documents"
                className="inline-flex items-center gap-2 text-xs text-[var(--bx-brass)] hover:underline font-medium"
              >
                📂 View Documents Hub (Agreements · COIs · Payments) →
              </a>
            </div>
          )}
        </div>

        {/* Right: Calendar sidebar — Requests tab only */}
        {tab === "requests" && <div className={`${calOpen ? "block" : "hidden lg:block"}`}>
          <div className="sticky top-20 bg-ink-soft rounded-xl border border-parchment/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate uppercase tracking-widest">Combined Calendar</p>
              <p className="text-xs text-slate">Oct – Nov 2026</p>
            </div>
            <p className="text-xs text-slate leading-relaxed">
              Staff view — shows real event names and flex-block flags. Never visible to the public.
            </p>

            <div className="space-y-2">
              {calendarEvents.sort((a, b) => a.date.localeCompare(b.date)).map((ev, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-14">
                    <p className="text-xs font-bold text-parchment">{ev.date.slice(5)}</p>
                    <p className="text-xs text-slate">{ev.room}</p>
                  </div>
                  <div
                    className="flex-1 rounded-lg px-2 py-1 text-xs font-medium leading-snug border"
                    style={
                      ev.kind === "rental"
                        ? {
                            background: "color-mix(in srgb, var(--bx-brass) 12%, transparent)",
                            borderColor: "color-mix(in srgb, var(--bx-brass) 30%, transparent)",
                            color: "var(--bx-parchment)",
                          }
                        : ev.kind === "flex"
                        ? {
                            background: "color-mix(in srgb, #f59e0b 12%, transparent)",
                            borderColor: "color-mix(in srgb, #f59e0b 30%, transparent)",
                            color: "color-mix(in srgb, #f59e0b 90%, var(--bx-parchment))",
                          }
                        : {
                            background: "color-mix(in srgb, var(--bx-slate) 8%, transparent)",
                            borderColor: "color-mix(in srgb, var(--bx-parchment) 12%, transparent)",
                            color: "var(--bx-slate)",
                            textDecoration: "line-through",
                          }
                    }
                  >
                    {ev.kind === "flex" && <span className="mr-1">⟳</span>}
                    {ev.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-parchment/10 space-y-1.5">
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">Legend</p>
              <LegendItemStyled
                style={{ background: "color-mix(in srgb, var(--bx-brass) 12%, transparent)", borderColor: "color-mix(in srgb, var(--bx-brass) 30%, transparent)", color: "var(--bx-parchment)" }}
                label="Rental / confirmed event"
              />
              <LegendItemStyled
                style={{ background: "color-mix(in srgb, #f59e0b 12%, transparent)", borderColor: "color-mix(in srgb, #f59e0b 30%, transparent)", color: "color-mix(in srgb, #f59e0b 90%, var(--bx-parchment))" }}
                label="⟳ Standing use · may flex"
              />
              <LegendItemStyled
                style={{ background: "color-mix(in srgb, var(--bx-slate) 8%, transparent)", borderColor: "color-mix(in srgb, var(--bx-parchment) 12%, transparent)", color: "var(--bx-slate)" }}
                label="Declined"
              />
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-ink-soft rounded-xl border border-parchment/10 p-4">
      <p className="text-xs text-slate font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate font-semibold uppercase tracking-wider">{label}</p>
      <p className="font-medium text-parchment">{value}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded px-2 py-0.5 text-xs border ${color}`}>Sample</span>
      <span className="text-xs text-slate">{label}</span>
    </div>
  );
}

function LegendItemStyled({ style, label }: { style: React.CSSProperties; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded px-2 py-0.5 text-xs border" style={style}>Sample</span>
      <span className="text-xs" style={{ color: "var(--bx-slate)" }}>{label}</span>
    </div>
  );
}

// ─── Automation Settings panel ─────────────────────────────────────────────────
const AUTOMATION_KEYS: { key: string; label: string; unit: string; description: string }[] = [
  { key: "user_reminder_1_days",    label: "First user reminder",       unit: "days", description: "Days of inactivity before sending the first follow-up to the requester" },
  { key: "user_reminder_2_days",    label: "Second user reminder",      unit: "days", description: "Days of inactivity before sending the second follow-up to the requester" },
  { key: "auto_cancel_days",        label: "Auto-cancellation",         unit: "days", description: "Days of user inactivity before automatically cancelling a needs_info or pending_documents reservation" },
  { key: "admin_reminder_days",     label: "Admin review reminder",     unit: "days", description: "Days before sending an internal admin reminder for unreviewed submitted reservations" },
  { key: "coi_expiry_warning_days", label: "COI expiry warning",        unit: "days", description: "Days before COI expiration to send a renewal reminder to the organization contact" },
];

function AutomationSettings({
  settings, draft, loading, saving, onLoad, onChange, onSave,
}: {
  settings: Record<string, string>;
  draft: Record<string, string>;
  loading: boolean;
  saving: boolean;
  onLoad: () => void;
  onChange: (key: string, value: string) => void;
  onSave: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  if (!loaded) { onLoad(); setLoaded(true); }

  const dirty = AUTOMATION_KEYS.some(k => draft[k.key] !== settings[k.key]);

  return (
    <div className="rounded-2xl bg-ink-soft border border-parchment/10 overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-parchment/10 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-parchment">Automation Thresholds</p>
          <p className="text-xs text-slate mt-0.5">Controls when reminder emails and auto-cancellation fire</p>
        </div>
        {dirty && (
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary text-xs"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        )}
      </div>
      {loading ? (
        <p className="px-5 py-4 text-sm text-slate">Loading…</p>
      ) : (
        <div className="divide-y divide-parchment/10">
          {AUTOMATION_KEYS.map(({ key, label, unit, description }) => (
            <div key={key} className="px-5 py-4 flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm text-parchment font-medium">{label}</p>
                <p className="text-xs text-slate mt-0.5">{description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={draft[key] ?? settings[key] ?? ""}
                  onChange={e => onChange(key, e.target.value)}
                  className="w-16 rounded-lg border border-parchment/20 bg-ink text-parchment text-sm px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-[var(--bbc-blue)]"
                />
                <span className="text-xs text-slate">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Blackout Settings panel ───────────────────────────────────────────────────
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_OPTIONS = [
  { value: "morning",   label: "Morning (8a–12p)" },
  { value: "afternoon", label: "Afternoon (12p–5p)" },
  { value: "evening",   label: "Evening (5p–10p)" },
];

function BlackoutSettings({
  rules, loading,
  newRuleType, setNewRuleType,
  newDow, setNewDow,
  newSlot, setNewSlot,
  newDate, setNewDate,
  newLabel, setNewLabel,
  saving, onAdd, onRemove,
}: {
  rules: BlackoutRule[];
  loading: boolean;
  newRuleType: "dow" | "dow_slot" | "date"; setNewRuleType: (v: "dow" | "dow_slot" | "date") => void;
  newDow: number; setNewDow: (v: number) => void;
  newSlot: string; setNewSlot: (v: string) => void;
  newDate: string; setNewDate: (v: string) => void;
  newLabel: string; setNewLabel: (v: string) => void;
  saving: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-parchment">Blackout Rules</h2>
        <p className="text-sm text-slate mt-1">
          Dates and times blocked on the public reservation form. PCO calendar is unaffected.
        </p>
      </div>

      {/* Current rules */}
      <div className="bg-ink-soft rounded-xl border border-parchment/10 divide-y divide-parchment/5">
        {loading && (
          <p className="px-5 py-4 text-sm text-slate">Loading…</p>
        )}
        {!loading && rules.length === 0 && (
          <p className="px-5 py-4 text-sm text-slate">No blackout rules yet.</p>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-parchment">{rule.label || ruleDescription(rule)}</p>
              {rule.label && (
                <p className="text-xs text-slate">{ruleDescription(rule)}</p>
              )}
            </div>
            <button
              onClick={() => onRemove(rule.id)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold flex-shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Add new rule */}
      <div className="bg-ink-soft rounded-xl border border-parchment/10 p-5 space-y-4">
        <p className="text-sm font-semibold text-parchment">Add a rule</p>

        {/* Rule type */}
        <div className="flex gap-2 flex-wrap">
          {([
            { value: "dow",      label: "Block whole day (weekly)" },
            { value: "dow_slot", label: "Block time slot (weekly)" },
            { value: "date",     label: "Block specific date" },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setNewRuleType(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                newRuleType === opt.value
                  ? "bg-parchment text-ink border-parchment"
                  : "bg-ink text-slate border-parchment/20 hover:bg-parchment/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Day of week picker */}
          {(newRuleType === "dow" || newRuleType === "dow_slot") && (
            <div>
              <label className="block text-xs font-semibold text-slate mb-1">Day of week</label>
              <select
                value={newDow}
                onChange={e => setNewDow(Number(e.target.value))}
                className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
              >
                {DOW_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Slot picker */}
          {newRuleType === "dow_slot" && (
            <div>
              <label className="block text-xs font-semibold text-slate mb-1">Time slot</label>
              <select
                value={newSlot}
                onChange={e => setNewSlot(e.target.value)}
                className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
              >
                {SLOT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date picker */}
          {newRuleType === "date" && (
            <div>
              <label className="block text-xs font-semibold text-slate mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
              />
            </div>
          )}

          {/* Label */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate mb-1">
              Label <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Christmas, Church Night…"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
            />
          </div>

          <button
            onClick={onAdd}
            disabled={saving || (newRuleType === "date" && !newDate)}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mock data for Users and Ministries tabs ───────────────────────────────────
type MockUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "system_admin" | "booking_admin" | "ministry_coordinator" | "member";
  lastActive: string;
  reservationCount: number;
  orphaned?: boolean;
};

type MockMinistry = {
  id: string;
  name: string;
  description: string;
  members: { userId: string; name: string; email: string; isCoordinator: boolean }[];
  reservationCount: number;
};

const MOCK_USERS: MockUser[] = [
  { id: "u1", name: "Josiah King",     email: "jking@brainerdbaptist.org",   role: "owner",               lastActive: "Today",    reservationCount: 12 },
  { id: "u2", name: "Sarah Mitchell",  email: "smitchell@brainerdbaptist.org", role: "system_admin",      lastActive: "Yesterday", reservationCount: 4  },
  { id: "u3", name: "Tom Alvarez",     email: "talvarez@brainerdbaptist.org", role: "booking_admin",       lastActive: "2 days ago", reservationCount: 2 },
  { id: "u4", name: "Rachel Brooks",   email: "rbrooks@example.com",          role: "ministry_coordinator", lastActive: "1 week ago", reservationCount: 7 },
  { id: "u5", name: "Mark Nguyen",     email: "mnguyen@example.com",          role: "member",              lastActive: "3 days ago", reservationCount: 3 },
  { id: "u6", name: "Olivia Carter",   email: "ocarter@example.com",          role: "member",              lastActive: "2 weeks ago", reservationCount: 1 },
  { id: "u7", name: "(Deleted user)",  email: "—",                            role: "member",              lastActive: "—",         reservationCount: 2, orphaned: true },
];

const MOCK_MINISTRIES: MockMinistry[] = [
  {
    id: "m1", name: "Youth Ministry", description: "Student ministry, grades 6–12.",
    reservationCount: 8,
    members: [
      { userId: "u4", name: "Rachel Brooks", email: "rbrooks@example.com", isCoordinator: true },
      { userId: "u5", name: "Mark Nguyen",   email: "mnguyen@example.com", isCoordinator: false },
    ],
  },
  {
    id: "m2", name: "Worship Team", description: "Sunday worship and special events.",
    reservationCount: 5,
    members: [
      { userId: "u6", name: "Olivia Carter", email: "ocarter@example.com", isCoordinator: true },
    ],
  },
  {
    id: "m3", name: "Care & Counseling", description: "Pastoral care programs.",
    reservationCount: 3,
    members: [],
  },
];

const ROLE_LABELS_DISPLAY: Record<MockUser["role"], string> = {
  owner: "Owner",
  system_admin: "System Admin",
  booking_admin: "Booking Admin",
  ministry_coordinator: "Ministry Coordinator",
  member: "Member",
};

const ROLE_BADGE_COLORS: Record<MockUser["role"], string> = {
  owner:                "bg-amber-100 text-amber-800 border-amber-200",
  system_admin:         "bg-purple-100 text-purple-800 border-purple-200",
  booking_admin:        "bg-blue-100 text-blue-800 border-blue-200",
  ministry_coordinator: "bg-emerald-100 text-emerald-700 border-emerald-200",
  member:               "bg-parchment/15 text-slate border-parchment/20",
};

// ─── UsersTab component ────────────────────────────────────────────────────────
function UsersTab({
  userSearch, setUserSearch,
  pendingRoles, setPendingRoles,
  savingRole, setSavingRole,
}: {
  userSearch: string; setUserSearch: (v: string) => void;
  pendingRoles: Record<string, string>; setPendingRoles: (v: Record<string, string>) => void;
  savingRole: string | null; setSavingRole: (v: string | null) => void;
}) {
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS);
  const search = userSearch.toLowerCase();
  const filtered = users.filter(
    u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)
  );
  const orphaned = users.filter(u => u.orphaned);

  async function saveRole(userId: string) {
    const newRole = pendingRoles[userId];
    if (!newRole) return;
    setSavingRole(userId);
    try {
      const res = await fetch("/api/bx/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert(err.error ?? "Failed to save role. Please try again.");
        setSavingRole(null);
        return;
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as MockUser["role"] } : u));
    } catch {
      alert("Network error saving role. Please try again.");
    }
    setSavingRole(null);
    setPendingRoles({ ...pendingRoles, [userId]: "" });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-parchment">User Management</h2>
          <p className="text-sm text-slate mt-0.5">Assign roles and manage access for all BX accounts.</p>
        </div>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment w-64"
        />
      </div>

      {/* Orphaned reservations alert */}
      {orphaned.length > 0 && (
        <div className="rounded-xl px-5 py-4" style={{ background: "color-mix(in srgb, var(--bx-brass) 10%, var(--bx-ink-soft))", border: "1px solid color-mix(in srgb, var(--bx-brass) 30%, transparent)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--bx-brass)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block mr-1.5 -mt-0.5 opacity-80"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>
            Orphaned reservations
          </p>
          <p className="text-xs mb-3" style={{ color: "var(--bx-slate)" }}>
            {orphaned.length} reservation{orphaned.length !== 1 ? "s have" : " has"} no owner because the account was deleted and no co-owner existed.
            Reassign to a member below.
          </p>
          {orphaned.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg px-4 py-2 mt-2" style={{ background: "color-mix(in srgb, var(--bx-brass) 6%, var(--bx-ink))", border: "1px solid color-mix(in srgb, var(--bx-brass) 20%, transparent)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--bx-parchment)" }}>
                {u.reservationCount} orphaned reservation{u.reservationCount !== 1 ? "s" : ""}
              </span>
              <button
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:opacity-90"
                style={{ background: "color-mix(in srgb, var(--bx-brass) 15%, transparent)", color: "var(--bx-brass)", border: "1px solid color-mix(in srgb, var(--bx-brass) 40%, transparent)" }}
              >
                Reassign →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* User list */}
      <div className="bg-ink-soft rounded-xl border border-parchment/10 divide-y divide-parchment/5">
        {filtered.length === 0 && (
          <p className="px-5 py-5 text-sm text-slate">No users match your search.</p>
        )}
        {filtered.filter(u => !u.orphaned).map(user => {
          const pending = pendingRoles[user.id];
          const isSaving = savingRole === user.id;
          return (
            <div key={user.id} className="px-5 py-4 space-y-2.5">
              {/* Top row: identity + stats + badge */}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-parchment truncate">{user.name}</p>
                  <p className="text-xs text-slate truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Stats — desktop only */}
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate">{user.reservationCount} reservations</p>
                    <p className="text-xs text-slate/60">Active {user.lastActive}</p>
                  </div>
                  {/* Role badge */}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_BADGE_COLORS[user.role]}`}>
                    {ROLE_LABELS_DISPLAY[user.role]}
                  </span>
                </div>
              </div>

              {/* Bottom row: role reassignment (system_admin+ only in production) */}
              {user.role !== "owner" && (
                <div className="flex items-center gap-2">
                  <select
                    value={pending || user.role}
                    onChange={e => setPendingRoles({ ...pendingRoles, [user.id]: e.target.value })}
                    className="flex-1 min-w-0 border border-parchment/20 rounded-lg px-2 py-1.5 text-xs bg-ink text-parchment"
                  >
                    <option value="booking_admin">Booking Admin</option>
                    <option value="ministry_coordinator">Ministry Coordinator</option>
                    <option value="member">Member</option>
                  </select>
                  {pending && pending !== user.role && (
                    <button
                      onClick={() => saveRole(user.id)}
                      disabled={isSaving}
                      className="btn-primary text-xs disabled:opacity-40 flex-shrink-0"
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate">
        Role changes take effect immediately. The <strong className="text-parchment">Owner</strong> role can only be transferred through account settings.
        System Admins cannot promote to System Admin or Owner.
      </p>
    </div>
  );
}

// ─── MinistriesTab component ───────────────────────────────────────────────────
function MinistriesTab({
  selectedMinistryId, setSelectedMinistryId,
  newMinistryName, setNewMinistryName,
  newMinistryDesc, setNewMinistryDesc,
  savingMinistry, setSavingMinistry,
}: {
  selectedMinistryId: string | null; setSelectedMinistryId: (v: string | null) => void;
  newMinistryName: string; setNewMinistryName: (v: string) => void;
  newMinistryDesc: string; setNewMinistryDesc: (v: string) => void;
  savingMinistry: boolean; setSavingMinistry: (v: boolean) => void;
}) {
  const [hoveredMinistryId, setHoveredMinistryId] = useState<string | null>(null);
  type Ministry = { id: string; name: string; description: string | null; created_at: string };
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [ministriesLoading, setMinistriesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bx/ministries")
      .then(r => r.json())
      .then((data: { ministries?: Ministry[] }) => {
        if (data.ministries) setMinistries(data.ministries);
        setMinistriesLoading(false);
      })
      .catch(() => setMinistriesLoading(false));
  }, []);

  const selected = ministries.find(m => m.id === selectedMinistryId) ?? null;

  async function createMinistry() {
    if (!newMinistryName.trim()) return;
    setSavingMinistry(true);
    try {
      const res = await fetch("/api/bx/ministries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMinistryName.trim(), description: newMinistryDesc.trim() || null }),
      });
      const data = await res.json() as { ministry?: Ministry; error?: string };
      if (!res.ok || !data.ministry) {
        alert(data.error ?? "Failed to create ministry. Please try again.");
        setSavingMinistry(false);
        return;
      }
      setMinistries(prev => [...prev, data.ministry!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewMinistryName("");
      setNewMinistryDesc("");
    } catch {
      alert("Network error creating ministry. Please try again.");
    }
    setSavingMinistry(false);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-parchment">Ministries</h2>
        <p className="text-sm text-slate mt-0.5">
          Group members into ministries. Ministry Coordinators can book on behalf of their group.
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_1.4fr] gap-5">
        {/* Left: ministry list */}
        <div className="space-y-3">
          <div className="bg-ink-soft rounded-xl border border-parchment/10 divide-y divide-parchment/5">
            {ministriesLoading ? (
              <div className="px-4 py-8 text-center text-sm text-slate">Loading…</div>
            ) : ministries.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate">No ministries yet. Create one below.</div>
            ) : ministries.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMinistryId(selectedMinistryId === m.id ? null : m.id)}
                onMouseEnter={() => setHoveredMinistryId(m.id)}
                onMouseLeave={() => setHoveredMinistryId(null)}
                className="w-full text-left px-4 py-3.5 transition-colors cursor-pointer"
                style={{
                  background: selectedMinistryId === m.id
                    ? "color-mix(in srgb, var(--bx-parchment) 12%, transparent)"
                    : hoveredMinistryId === m.id
                    ? "color-mix(in srgb, var(--bx-parchment) 5%, transparent)"
                    : "transparent",
                  borderLeft: selectedMinistryId === m.id
                    ? "2px solid var(--bx-brass)"
                    : "2px solid transparent",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-parchment">{m.name}</p>
                </div>
                {m.description && (
                  <p className="text-xs text-slate mt-0.5 truncate">{m.description}</p>
                )}
              </button>
            ))}
          </div>

          {/* Create new ministry */}
          <div className="bg-ink-soft rounded-xl border border-parchment/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate uppercase tracking-widest">New Ministry</p>
            <input
              type="text"
              placeholder="Ministry name"
              value={newMinistryName}
              onChange={e => setNewMinistryName(e.target.value)}
              className="w-full border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newMinistryDesc}
              onChange={e => setNewMinistryDesc(e.target.value)}
              className="w-full border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
            />
            <button
              onClick={createMinistry}
              disabled={savingMinistry || !newMinistryName.trim()}
              className="btn-primary text-sm w-full disabled:opacity-40"
            >
              {savingMinistry ? "Creating…" : "Create Ministry"}
            </button>
          </div>
        </div>

        {/* Right: selected ministry detail */}
        {selected ? (
          <div className="bg-ink-soft rounded-xl border border-parchment/10 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-parchment">{selected.name}</h3>
                {selected.description && (
                  <p className="text-sm text-slate mt-0.5">{selected.description}</p>
                )}
              </div>
              <button className="text-xs text-slate hover:text-parchment border border-parchment/20 rounded px-2 py-1">
                Rename
              </button>
            </div>

            {/* Members — placeholder until member management API is built */}
            <div>
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">Members</p>
              <p className="text-sm text-slate">Member management coming soon.</p>
            </div>

            {/* Add member */}
            <div className="pt-2 border-t border-parchment/10">
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">Add Member</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email address"
                  className="flex-1 border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
                />
                <button className="btn-primary text-sm flex-shrink-0">Add</button>
              </div>
              <p className="text-xs text-slate mt-1">User must have a BX account. They&apos;ll be notified by email.</p>
            </div>

            {/* Ministry reservations link */}
            <div className="pt-2 border-t border-parchment/10">
              <p className="text-xs text-slate">
                Reservations under this ministry{" "}
                <button
                  onClick={() => setSelectedMinistryId(null)}
                  className="text-[var(--bbc-blue)] hover:underline text-xs"
                >
                  View in Requests →
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-ink-soft rounded-xl border border-parchment/10 p-10 flex items-center justify-center text-center">
            <div>
              <div className="mb-3" style={{color:"var(--bx-slate)"}}><svg width="2rem" height="2rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:"block",margin:"0 auto"}}><path d="M3 22V9l9-7 9 7v13"/><path d="M12 2v5M9.5 4.5h5"/><path d="M9 22v-5a3 3 0 016 0v5"/></svg></div>
              <p className="text-sm text-slate">Select a ministry to view and manage its members.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ─── Historical reservation data (Google Form, May 2025 – Sep 2026) ────────────
const HISTORICAL_DATA = {
  byMonth: [
    { month: "2025-05", label: "May '25", count: 1 },
    { month: "2025-07", label: "Jul '25", count: 2 },
    { month: "2025-08", label: "Aug '25", count: 1 },
    { month: "2025-09", label: "Sep '25", count: 1 },
    { month: "2025-10", label: "Oct '25", count: 1 },
    { month: "2026-01", label: "Jan '26", count: 2 },
    { month: "2026-02", label: "Feb '26", count: 2 },
    { month: "2026-03", label: "Mar '26", count: 8 },
    { month: "2026-04", label: "Apr '26", count: 7 },
    { month: "2026-05", label: "May '26", count: 8 },
    { month: "2026-06", label: "Jun '26", count: 6 },
    { month: "2026-07", label: "Jul '26", count: 5 },
    { month: "2026-08", label: "Aug '26", count: 9 },
    { month: "2026-09", label: "Sep '26", count: 11 },
  ],
  byRoom: [
    { room: "The Crossing",      count: 26 },
    { room: "Crossview",         count: 13 },
    { room: "The Loft",          count: 7  },
    { room: "CrossPointe A",     count: 7  },
    { room: "Crossties A",       count: 4  },
    { room: "CrossPointe C",     count: 3  },
    { room: "Crossties Café",    count: 2  },
    { room: "Basketball Courts", count: 1  },
    { room: "CrossPointe B",     count: 1  },
  ],
  guestBuckets: [
    { label: "1–25",    count: 30 },
    { label: "26–75",   count: 17 },
    { label: "76–150",  count: 5  },
    { label: "151–250", count: 10 },
    { label: "250+",    count: 2  },
  ],
  memberStatus: { member: 16, nonMember: 48 },
  profitStatus: { nonProfit: 53, forProfit: 11 },
  byYear: [
    { year: "2025", count: 6  },
    { year: "2026", count: 48 },
    { year: "2027", count: 10 },
  ],
  totalRecords: 64,
};

// ─── ReportsTab ─────────────────────────────────────────────────────────────────
function ReportsTab() {
  const d = HISTORICAL_DATA;
  const totalGuests = 30 * 13 + 17 * 50 + 5 * 113 + 10 * 200 + 2 * 300;
  const avgGroup = Math.round(totalGuests / d.totalRecords);
  const maxMonth = Math.max(...d.byMonth.map(m => m.count));
  const maxRoom  = Math.max(...d.byRoom.map(r => r.count));
  const maxGuest = Math.max(...d.guestBuckets.map(g => g.count));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold" style={{ color: "var(--bx-parchment)" }}>Historical Reports</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--bx-slate)" }}>
          64 submissions from the Google Form · May 2025 – Sep 2026
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Submissions" value={String(d.totalRecords)} color="text-[var(--bx-brass)]" />
        <KPI label="Avg Group Size" value={`~${avgGroup}`} color="text-emerald-400" />
        <KPI label="Non-Profit Share" value={`${Math.round(d.profitStatus.nonProfit / d.totalRecords * 100)}%`} color="text-blue-400" />
        <KPI label="Member Orgs" value={`${Math.round(d.memberStatus.member / d.totalRecords * 100)}%`} color="text-violet-400" />
      </div>

      {/* Monthly submissions bar chart */}
      <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--bx-ink-soft)", borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--bx-parchment)" }}>Submissions by Month</p>
        <div className="flex items-end gap-1" style={{ height: 100 }}>
          {d.byMonth.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center group relative">
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: maxMonth ? `${(m.count / maxMonth) * 80}px` : "4px",
                  background: m.count === maxMonth
                    ? "var(--bx-brass)"
                    : "color-mix(in srgb, var(--bx-brass) 45%, transparent)",
                  minHeight: m.count > 0 ? "4px" : "0",
                }}
              />
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap"
                style={{ background: "var(--bx-ink)", color: "var(--bx-parchment)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }}>
                {m.label}: {m.count}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-1">
          {d.byMonth.map((m) => (
            <div key={m.month} className="flex-1 text-center" style={{ fontSize: 8, color: "var(--bx-slate)" }}>
              {m.label.split(" ")[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Room usage + Guest size — 2 col on large */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--bx-ink-soft)", borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--bx-parchment)" }}>Requests by Room</p>
          <div className="space-y-2">
            {d.byRoom.map((r) => (
              <div key={r.room} className="flex items-center gap-3">
                <span className="w-32 text-xs shrink-0 truncate" style={{ color: "var(--bx-slate)" }}>{r.room}</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: "color-mix(in srgb, var(--bx-parchment) 6%, transparent)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(r.count / maxRoom) * 100}%`,
                    background: r.count === maxRoom ? "var(--bx-brass)" : "color-mix(in srgb, var(--bx-brass) 55%, transparent)",
                  }} />
                </div>
                <span className="text-xs font-semibold w-5 text-right" style={{ color: "var(--bx-parchment)" }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--bx-ink-soft)", borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--bx-parchment)" }}>Group Size Distribution</p>
          <div className="space-y-2">
            {d.guestBuckets.map((g) => (
              <div key={g.label} className="flex items-center gap-3">
                <span className="w-16 text-xs shrink-0" style={{ color: "var(--bx-slate)" }}>{g.label}</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: "color-mix(in srgb, var(--bx-parchment) 6%, transparent)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(g.count / maxGuest) * 100}%`,
                    background: "color-mix(in srgb, #22c55e 70%, var(--bx-brass))",
                  }} />
                </div>
                <span className="text-xs font-semibold w-5 text-right" style={{ color: "var(--bx-parchment)" }}>{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Member + Non-profit donut tiles */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--bx-ink-soft)", borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--bx-parchment)" }}>BBC Member Orgs</p>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="color-mix(in srgb, var(--bx-parchment) 8%, transparent)" strokeWidth="3.2" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke="color-mix(in srgb, #7c3aed 80%, transparent)"
                  strokeWidth="3.2"
                  strokeDasharray={`${(d.memberStatus.member / d.totalRecords) * 100} ${100 - (d.memberStatus.member / d.totalRecords) * 100}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: "var(--bx-parchment)" }}>
                  {Math.round(d.memberStatus.member / d.totalRecords * 100)}%
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "color-mix(in srgb, #7c3aed 80%, transparent)" }} />
                <span className="text-xs" style={{ color: "var(--bx-slate)" }}>Member — {d.memberStatus.member}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)" }} />
                <span className="text-xs" style={{ color: "var(--bx-slate)" }}>Non-member — {d.memberStatus.nonMember}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--bx-ink-soft)", borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--bx-parchment)" }}>Non-Profit vs. For-Profit</p>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="color-mix(in srgb, var(--bx-parchment) 8%, transparent)" strokeWidth="3.2" />
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke="var(--bx-brass)"
                  strokeWidth="3.2"
                  strokeDasharray={`${(d.profitStatus.nonProfit / d.totalRecords) * 100} ${100 - (d.profitStatus.nonProfit / d.totalRecords) * 100}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: "var(--bx-parchment)" }}>
                  {Math.round(d.profitStatus.nonProfit / d.totalRecords * 100)}%
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "var(--bx-brass)" }} />
                <span className="text-xs" style={{ color: "var(--bx-slate)" }}>Non-profit — {d.profitStatus.nonProfit}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)" }} />
                <span className="text-xs" style={{ color: "var(--bx-slate)" }}>For-profit — {d.profitStatus.forProfit}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event year breakdown */}
      <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--bx-ink-soft)", borderColor: "color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--bx-parchment)" }}>Event Year Breakdown</p>
        <div className="flex gap-4">
          {d.byYear.map((y) => (
            <div key={y.year} className="flex-1 rounded-xl p-4 text-center" style={{ background: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 10%, transparent)" }}>
              <p className="text-3xl font-bold" style={{ color: y.year === "2026" ? "var(--bx-brass)" : "var(--bx-parchment)" }}>{y.count}</p>
              <p className="text-xs uppercase tracking-widest mt-1" style={{ color: "var(--bx-slate)" }}>{y.year}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs pb-4" style={{ color: "color-mix(in srgb, var(--bx-slate) 50%, transparent)" }}>
        Source: BX Online Reservation Request Responses · Google Form export · 64 records · through Sep 2026
      </p>
    </div>
  );
}
