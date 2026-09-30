"use client";

import Link from "next/link";
import { FileText, Shield, DollarSign, AlertTriangle, FolderOpen } from "lucide-react";
import { ReservationListSkeleton, CardSkeleton, InlineSkeleton } from "@/app/components/Skeleton";
import { useToast } from "@/app/components/Toast";
import LoadError from "@/app/components/load-error";
import { fetchArray } from "@/lib/fetch-list";
import { NOTIFICATIONS_CHANGED } from "@/lib/notifications";
import { venueToday, formatYmd } from "@/lib/dates";

/** The calendar API returns 14 days back → 90 days ahead; label that window. */
function calendarRangeLabel(): string {
  const today = venueToday();
  const shift = (days: number) => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${formatYmd(shift(-14), o)} – ${formatYmd(shift(90), { ...o, year: "numeric" })}`;
}
import CommentsThread from "@/components/bx/CommentsThread";
import EventLogoCard from "@/app/components/event-logo-card";
import VenueSettings from "@/app/components/venue-settings";
import BillingCard from "@/app/components/billing-card";
import EditBooking from "@/app/components/edit-booking";
import PeopleCard from "@/app/components/people-card";
import RoomRates from "@/app/components/room-rates";
import { ROOMS } from "@/lib/rooms";
import BookingInsights from "./booking-insights";
import { useAdminRole } from "./admin-role";
import TemplatesManager, { SaveTemplateButton } from "./booking-templates";
import WaiverEditor from "./waiver-editor";
import { can } from "@/lib/roles";
import AddonCatalog from "@/app/components/addon-catalog";
import GridToggle from "@/app/components/grid-toggle";
import { useState, useEffect, useCallback } from "react";
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
  churchUse?: boolean;       // C4: Ministry Coordinator / Brainerd Staff / staff
  waived?: { agreement: boolean; coi: boolean; payment: boolean };
}

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

// P7: Physical-metaphor badge palette — aligned with lib/status-tokens.ts families
// Amber=pending, Indigo=in-progress, Orange=action-required,
// Emerald=approved/forward, Stone=completed(filed), Red=declined/cancel-BX,
// Gray=neutral cancels
const STATUS_COLORS: Record<Status, string> = {
  Requested:             "bx-tone-amber",      // sticky note
  "Proposal Sent":       "bx-tone-indigo",   // in-tray stamp
  "Needs Info":          "bx-tone-orange",   // warning label
  "Pending Documents":   "bx-tone-orange",   // warning label
  "Pending Payment":     "bx-tone-orange",   // warning label
  "Deposit Received":    "bx-tone-green",// approval stamp
  Confirmed:             "bx-tone-green",// approval stamp
  Completed:             "bx-tone-stone",      // filed document
  Declined:              "bx-tone-red",            // red stamp
  "Cancelled by BX":     "bx-tone-red",            // red stamp
  "Cancelled by User":   "bx-tone-stone",         // voided paper
  Expired:               "bx-tone-stone",         // voided paper
};

export default function BxReservationsAdmin() {
  const myRole = useAdminRole();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<Request[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const rawStatus = searchParams.get("status") ?? "";
  const statusFromUrl = (raw: string): Status | "All" => {
    const ALL_S: (Status | "All")[] = ["All","Requested","Proposal Sent","Needs Info","Pending Documents","Pending Payment","Deposit Received","Confirmed","Completed","Declined","Cancelled by BX","Cancelled by User","Expired"];
    return ALL_S.includes(raw as Status) ? (raw as Status) : "All";
  };
  const [filter, setFilter] = useState<Status | "All">(() => statusFromUrl(rawStatus));
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Request | null>(null);
  const [calOpen, setCalOpen] = useState(() => searchParams.get("view") === "calendar");
  // Follow the URL when the sidebar links to ?status=… or ?view=calendar on
  // this same page (state used to be read only once — audit F13).
  const rawView = searchParams.get("view");
  const [seenUrl, setSeenUrl] = useState({ status: rawStatus, view: rawView });
  if (seenUrl.status !== rawStatus || seenUrl.view !== rawView) {
    setSeenUrl({ status: rawStatus, view: rawView });
    if (seenUrl.status !== rawStatus) setFilter(statusFromUrl(rawStatus));
    if (seenUrl.view !== rawView) setCalOpen(rawView === "calendar");
  }
  // ?open=<reservation id> (e.g. from a user's Reservations tab) selects that booking once it loads.
  const openId = searchParams.get("open");
  const [openedId, setOpenedId] = useState<string | null>(null);
  if (openId && openedId !== openId && requests.length) {
    const match = requests.find((r) => r.dbId === openId);
    if (match) {
      setOpenedId(openId);
      setFilter("All");
      setSelected(match);
    }
  }
  // Opening a request counts as reading its notifications (clears the bell)
  const selectedDbId = selected?.dbId;
  useEffect(() => {
    if (!selectedDbId) return;
    fetch("/api/notifications/list", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId: selectedDbId }),
    }).then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))).catch(() => {});
  }, [selectedDbId]);

  useEffect(() => {
    if (openedId && selected?.dbId === openedId) {
      document.getElementById(`req-${openedId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [openedId, selected]);
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
    rack_rate_total: number | null;
    discount_applied: number | null;
    net_amount: number | null;
    organization_id: string | null;
  };
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({});
  const [docLoading, setDocLoading] = useState<Record<string, boolean>>({});
  const [coiAction, setCoiAction] = useState<Record<string, "accept" | "flag" | null>>({});
  const [coiExpiry, setCoiExpiry] = useState<Record<string, string>>({});
  const [coiFlagNote, setCoiFlagNote] = useState<Record<string, string>>({});
  const [coiBusy, setCoiBusy] = useState<Record<string, boolean>>({});
  const [bookingDiscounts, setBookingDiscounts] = useState<Record<string, Array<{ id: string; type: string; value: number; scope: string; discount_reason: string | null; note: string | null }>>>({});
  const [bookingDiscountForm, setBookingDiscountForm] = useState<Record<string, { open: boolean; type: string; value: string; reason: string; note: string; busy: boolean }>>({});
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
  const [historyError, setHistoryError] = useState<Record<string, string | null>>({});

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
  // A failed load shows an error with Retry — not "No requests here", and the
  // error object is never stored as the list (audit F06).
  const fetchReservations = useCallback(() =>
    fetchArray<Request>("/api/admin/reservations")
      .then(data => setRequests(data))
      .catch(err => setReservationsError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setReservationsLoading(false)), []);
  useEffect(() => { fetchReservations(); }, [fetchReservations]); // loading starts true
  const loadReservations = () => {
    setReservationsLoading(true);
    setReservationsError(null);
    fetchReservations();
  };

  useEffect(() => {
    fetch("/api/blackouts")
      .then(r => (r.ok ? r.json() : []))
      .then((data: unknown) => { setBlackouts(Array.isArray(data) ? (data as BlackoutRule[]) : []); setBlackoutsLoading(false); })
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
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      toast(err.error ?? "Couldn't add that blackout.", "error");
    }
    setSaving(false);
  }

  async function removeBlackout(id: string) {
    const res = await fetch("/api/blackouts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      toast(err.error ?? "Couldn't remove that blackout.", "error");
      return;
    }
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
  // Church use is fast-tracked: waiting church requests come first (C4)
  }).sort((a, b) => Number(!!b.churchUse && b.status === "Requested") - Number(!!a.churchUse && a.status === "Requested"));

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
        toast("Status update failed: " + (err.error ?? res.status), "error");
      }
    } catch (e) {
      console.error("[admin] changeStatus failed:", e);
      toast("Network error — status not updated.", "error");
    }
    setChangingStatus(null);
  }

  async function fetchHistory(localId: string, dbId: string) {
    setHistoryLoading(prev => ({ ...prev, [localId]: true }));
    setHistoryError(prev => ({ ...prev, [localId]: null }));
    let err: string | null = null;
    let data: HistoryEntry[] = [];
    try {
      const res = await fetch(`/api/reservations/${dbId}/history`);
      if (res.ok) data = await res.json();
      else err = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Error ${res.status}`;
    } catch (e) {
      console.error("[admin] fetchHistory failed:", e);
      err = "Network error";
    }
    // Always store a result, so a failed load shows an error instead of
    // re-requesting on every render (that was the endless loading bar).
    setHistory(prev => ({ ...prev, [localId]: data }));
    setHistoryError(prev => ({ ...prev, [localId]: err }));
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
          rack_rate_total:     r.rack_rate_total ?? null,
          discount_applied:    r.discount_applied ?? null,
          net_amount:          r.net_amount ?? null,
          organization_id:     r.organization_id ?? null,
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
      if (!res.ok) { toast(data.error ?? "Error", "error"); return; }
      setDocStatus(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setDocLoading(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setCoiAction(prev => ({ ...prev, [req.id]: null }));
      fetchDocStatus(req.id, req.dbId!);
    } catch { toast("Request failed — please try again.", "error"); }
    finally { setCoiBusy(prev => ({ ...prev, [req.id]: false })); }
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
      if (!res.ok) { toast(data.error ?? "Error sending agreement", "error"); return; }
      toast(`Agreement sent to ${req.email}!`);
      setDocStatus(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      setDocLoading(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      fetchDocStatus(req.id, req.dbId!);
    } catch { toast("Failed to send — please try again.", "error"); }
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
      if (!res.ok) { toast("Error countersigning: " + (data.error ?? "Unknown"), "error"); return; }
      setAgreements(prev => ({ ...prev, [req.id]: { ...ag, staff_signed_at: data.staff_signed_at } }));
      setCountersigning(null);
      setCountersignName("");
      toast("Agreement fully executed! Both parties have signed.");
    } catch { toast("Failed to countersign — please try again.", "error"); }
  }

  // Current month at the venue, not a fixed October 2026 (audit F13)
  const monthKey = venueToday().slice(0, 7);
  const monthLabel = formatYmd(`${monthKey}-01`, { month: "short" });
  const confirmedThisMonth = requests.filter(
    (r) => r.status === "Confirmed" && (r.date ?? "").startsWith(monthKey)
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
        toast(`Delete failed: ${body.error ?? res.status}`, "error");
        return;
      }
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setSelected(null);
      setDeleteConfirm(null);
    } catch (err) {
      console.error("[delete reservation]", err);
      toast("Delete failed — see console.", "error");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="min-h-screen">

      <div key={tab} className={`animate-in max-w-7xl mx-auto px-4 py-6 gap-6 ${tab === "requests" ? "grid lg:grid-cols-[1fr_320px]" : "block"}`}>
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
            <TemplatesManager />
            {/* Rates, add-ons and blackout rules are System Admin settings; the
                background grid is the Owner's. Booking Admins don't see controls
                they can't save (C2). */}
            {can.configureSystem(myRole) ? <RoomRates /> : null}
            {can.configureSystem(myRole) ? <AddonCatalog /> : null}
            {myRole === "owner" && <GridToggle />}
            {!can.configureSystem(myRole) && (
              <p className="text-xs text-slate bx-well rounded-xl p-4">Room rates, add-ons and blackout dates are managed by a System Admin.</p>
            )}
            {can.configureSystem(myRole) && <BlackoutSettings
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
            />}
            </>
          )}
          {tab === "requests" && (<>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPI label="Pending Review" value={String(pending)} color="text-amber-600" />
            <KPI label="Awaiting Deposit" value={String(awaitingDeposit)} color="text-blue-600" />
            <KPI label={`Confirmed (${monthLabel})`} value={String(confirmedThisMonth)} color="text-emerald-600" />
            <KPI label="Revenue Pipeline" value={`$${revenue.toLocaleString()}`} color="text-[var(--bx-accent-text)]" />
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="search"
              placeholder="Search by name, org, email, event, booking #…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-parchment/20 bg-ink-soft text-parchment text-sm px-4 py-2.5 placeholder-slate focus:outline-none focus:ring-2 focus:ring-[var(--bx-focus)] pr-10"
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
              <ReservationListSkeleton rows={8} />
            )}
            {!reservationsLoading && reservationsError && (
              <LoadError what="reservation requests" message={reservationsError} onRetry={loadReservations} />
            )}
            {!reservationsLoading && !reservationsError && filtered.length === 0 && (
              <div className="bx-glass rounded-xl">
                <div className="bx-empty">
                  <svg className="bx-empty-icon" width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1"/>
                    <path d="M9 12h6M9 16h4"/>
                  </svg>
                  <p className="bx-empty-title">No requests here</p>
                  <p className="bx-empty-sub">Try a different status filter above</p>
                </div>
              </div>
            )}
            {filtered.map((req) => (
              <div
                key={req.id}
                id={req.dbId ? `req-${req.dbId}` : undefined}
                className={`bx-row bx-glass-flat rounded-xl p-4 cursor-pointer ${
                  selected?.id === req.id ? "ring-2 ring-[var(--bx-accent-text)]" : ""
                }`}
                onClick={() => setSelected(selected?.id === req.id ? null : req)}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-parchment text-sm">{req.name}</p>
                      {req.org && <p className="text-xs text-slate">· {req.org}</p>}
                      {req.churchUse && (
                        <span className="bx-tone-green border px-2 py-0.5 rounded-full text-xs font-semibold">Church use</span>
                      )}
                      {req.flexible && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle size={10} className="inline mr-0.5" />Soft block
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
                    <span className="flex gap-1.5 items-center" aria-label="Agreement, insurance and payment">
                      {([
                        ["Agreement", req.agreementSigned, req.waived?.agreement, <FileText key="a" size={13} />],
                        ["Insurance", req.coiAccepted, req.waived?.coi, <Shield key="c" size={13} />],
                        ["Payment", req.hasPayment, req.waived?.payment, <DollarSign key="p" size={13} />],
                      ] as const).map(([label, done, waived, icon]) => {
                        const state = waived ? "not needed" : done ? "done" : "to do";
                        return (
                          <span key={label} title={`${label}: ${state}`} className={`inline-flex items-center gap-0.5 text-[10px] ${waived ? "text-slate/40 line-through" : done ? "text-emerald-400" : "text-slate/60"}`}>
                            {icon}<span className="sr-only">{label}: {state}</span>
                          </span>
                        );
                      })}
                    </span>
                    <span className="font-bold text-sm text-parchment">${req.estimate.toLocaleString()}</span>
                    <span
                      className={`bx-status bx-status--sm border ${STATUS_COLORS[req.status]}`}
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
                            className="bx-btn bx-btn--secondary bx-btn--sm"
                          >
                            Open event map →
                          </a>
                          <a href={`/api/event-map/${req.dbId}/signs?inline=1`} target="_blank" rel="noopener" className="bx-btn bx-btn--secondary bx-btn--sm">
                            Door signs
                          </a>
                          <a href={`/api/event-map/${req.dbId}/signs?variant=staff&inline=1`} target="_blank" rel="noopener" className="bx-btn bx-btn--secondary bx-btn--sm">
                            Staff signs
                          </a>
                          <a href={`/api/event-map/${req.dbId}/setup-sheet?inline=1`} target="_blank" rel="noopener" className="bx-btn bx-btn--secondary bx-btn--sm">
                            Setup sheet
                          </a>
                          <a href={`/api/event-map/${req.dbId}/arrows?inline=1`} target="_blank" rel="noopener" className="bx-btn bx-btn--secondary bx-btn--sm">
                            Arrow signs
                          </a>
                          <a href={`/api/event-map/${req.dbId}/packet?inline=1`} target="_blank" rel="noopener" className="bx-btn bx-btn--secondary bx-btn--sm">
                            Attendee packet
                          </a>
                          <SaveTemplateButton reservationId={req.dbId} eventName={req.event} organizationId={req.organizationId ?? null} />
                          <WaiverEditor key={`${req.churchUse}-${JSON.stringify(req.waived)}`} reservationId={req.dbId} churchUse={!!req.churchUse} waived={req.waived ?? { agreement: false, coi: false, payment: false }} onSaved={fetchReservations} />
                        </div>
                      </div>
                    )}

                    {/* ── Edit booking details (names, contact, schedule) */}
                    {req.dbId && (
                      <div onClick={e => e.stopPropagation()}>
                        <EditBooking reservationId={req.dbId} onSaved={fetchReservations} compact />
                      </div>
                    )}
                    {req.dbId && (
                      <details className="bx-well rounded-xl p-4" onClick={e => e.stopPropagation()}>
                        <summary className="text-xs font-semibold text-slate uppercase tracking-widest cursor-pointer">People on this booking</summary>
                        <div className="mt-3"><PeopleCard reservationId={req.dbId} /></div>
                      </details>
                    )}

                    {/* ── Status control panel */}
                    {req.status !== "Cancelled by User" && req.status !== "Expired" && req.status !== "Completed" && req.status !== "Cancelled by BX" && (() => {
                      const draft = statusDraft[req.id] ?? "";
                      const note = statusNote[req.id] ?? "";
                      const isCancelFlow = draft === "Cancelled by BX";
                      const reason = cancelReason[req.id] ?? "";
                      const busy = changingStatus === req.id;
                      return (
                        <div className="space-y-3 bx-well rounded-xl p-4" onClick={e => e.stopPropagation()}>
                          <p className="text-xs font-semibold text-slate uppercase tracking-widest">Update Status</p>
                          <select
                            className="bx-input w-full"
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
                              className="bx-input w-full placeholder-slate resize-none"
                              placeholder="Internal note (optional)"
                              rows={2}
                              value={note}
                              onChange={e => setStatusNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                            />
                          )}
                          {isCancelFlow && (
                            <textarea
                              className="bx-input w-full placeholder-slate resize-none"
                              placeholder="Cancellation reason (required)"
                              rows={2}
                              value={reason}
                              onChange={e => setCancelReason(prev => ({ ...prev, [req.id]: e.target.value }))}
                            />
                          )}
                          {draft && (
                            <div className="flex gap-2">
                              <button
                                className={`bx-btn bx-btn--md ${isCancelFlow ? "bx-btn--danger" : "bx-btn--primary"}`}
                                disabled={busy || (isCancelFlow && !reason.trim())}
                                onClick={() => changeStatus(req, draft as Status, note || undefined, reason || undefined)}
                              >
                                {busy ? "Saving…" : isCancelFlow ? "Cancel Reservation" : `Set → ${draft}`}
                              </button>
                              <button
                                className="bx-btn bx-btn--secondary bx-btn--md"
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
                          {loading && <InlineSkeleton width="60px" />}
                          {!loading && historyError[req.id] && (
                            <p className="text-xs" style={{ color: "var(--bx-clay)" }}>
                              Couldn&apos;t load history ({historyError[req.id]}).{" "}
                              <button type="button" className="underline font-semibold" onClick={() => fetchHistory(req.id, req.dbId!)}>Retry</button>
                            </p>
                          )}
                          {!loading && !historyError[req.id] && entries && entries.length === 0 && <p className="text-xs text-slate">No history yet.</p>}
                          {!loading && entries && entries.length > 0 && (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {entries.map(h => (
                                <div key={h.id} className="flex gap-3 text-xs">
                                  <span className="text-slate/60 flex-shrink-0 pt-0.5">{new Date(h.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</span>
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
                        <div className="space-y-4 bx-well rounded-xl p-4" onClick={e => e.stopPropagation()}>
                          <p className="text-xs font-semibold text-slate uppercase tracking-widest">Documents &amp; Payment</p>
                          {loading && <InlineSkeleton width="60px" />}
                          {!loading && ds && (<>

                            {/* Agreement */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-parchment/70">Facility Use Agreement</p>
                              {!ds.agreement_sent_at && (
                                <button
                                  className="bx-btn bx-btn--secondary bx-btn--sm"
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
                                    className="bx-btn bx-btn--secondary bx-btn--sm"
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
                                        <button className="bx-btn bx-btn--confirm bx-btn--sm" onClick={() => setCoiAction(prev => ({ ...prev, [req.id]: "accept" }))}>
                                          <span className="flex items-center gap-1"><span>✓</span> Accept COI</span>
                                        </button>
                                        <button className="bx-btn bx-btn--danger-outline bx-btn--sm" onClick={() => setCoiAction(prev => ({ ...prev, [req.id]: "flag" }))}>
                                          <span className="flex items-center gap-1"><AlertTriangle size={12} />Flag Issue</span>
                                        </button>
                                      </div>
                                    )}
                                    {act === "accept" && (
                                      <div className="space-y-2">
                                        <label htmlFor="bx-reserva-expiry-date-optional-1" className="text-xs text-slate">Expiry date (optional)</label>
                                        <input id="bx-reserva-expiry-date-optional-1"
                                          type="date"
                                          className="bx-input bx-input--sm"
                                          value={coiExpiry[req.id] ?? ""}
                                          onChange={e => setCoiExpiry(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        />
                                        <div className="flex gap-2">
                                          <button className="bx-btn bx-btn--confirm bx-btn--sm" disabled={busy} onClick={() => handleCoiAction(req, "accept")}>
                                            {busy ? "Saving…" : "Confirm Accept"}
                                          </button>
                                          <button className="bx-btn bx-btn--secondary bx-btn--sm" onClick={() => setCoiAction(prev => ({ ...prev, [req.id]: null }))}>Cancel</button>
                                        </div>
                                      </div>
                                    )}
                                    {act === "flag" && (
                                      <div className="space-y-2">
                                        <textarea
                                          className="bx-input bx-input--sm w-full placeholder-slate resize-none"
                                          rows={2}
                                          placeholder="Describe the issue (sent as a message to the customer)"
                                          value={coiFlagNote[req.id] ?? ""}
                                          onChange={e => setCoiFlagNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        />
                                        <div className="flex gap-2">
                                          <button className="bx-btn bx-btn--danger-outline bx-btn--sm" disabled={busy} onClick={() => handleCoiAction(req, "flag")}>
                                            {busy ? "Sending…" : "Send Flag to Customer"}
                                          </button>
                                          <button className="bx-btn bx-btn--secondary bx-btn--sm" onClick={() => setCoiAction(prev => ({ ...prev, [req.id]: null }))}>Cancel</button>
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

                            {/* Charges & payments (lib/billing.ts) */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-parchment/70">Charges &amp; payments</p>
                              <BillingCard reservationId={req.dbId!} compact />
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
                                    <span>{coiExpiringSoon ? <AlertTriangle size={14} className="text-amber-400" /> : <span className="text-emerald-400">✓</span>}</span>
                                    <span>
                                      {coiExpiringSoon
                                        ? `COI expires ${org.coi_expiry_date} — remind org to renew`
                                        : `Valid COI on file${org.coi_expiry_date ? ` — expires ${org.coi_expiry_date}` : ""}. No new upload required unless coverage changed.`}
                                    </span>
                                  </div>
                                )}
                                {org.has_coi && !coiValid && coiExpiry && (
                                  <div className="text-xs rounded px-2 py-1.5 flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200">
                                    <span className="text-red-400">✗</span>
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
                                          className="bx-btn bx-btn--secondary bx-btn--sm shrink-0"
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

                    {/* ── Phase 4: Pricing Summary Panel */}
                    {docStatus[req.id] && (docStatus[req.id].rack_rate_total != null || docStatus[req.id].net_amount != null) && (
                      <div className="space-y-2 pt-1" onClick={e => e.stopPropagation()}>
                        <p className="text-xs font-semibold text-slate uppercase tracking-widest">Pricing</p>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
                          {/* Rate rows */}
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Rack Rate</span>
                            <span className="font-medium text-parchment/80">
                              {docStatus[req.id].rack_rate_total != null
                                ? `$${Number(docStatus[req.id].rack_rate_total).toFixed(2)}`
                                : "—"}
                            </span>
                          </div>
                          {(docStatus[req.id].discount_applied ?? 0) !== 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Discount Applied</span>
                              <span className="font-medium text-emerald-600">
                                −${Number(docStatus[req.id].discount_applied).toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs border-t border-gray-200 pt-1.5">
                            <span className="text-gray-600 font-medium">Net Amount</span>
                            <span className="font-semibold text-parchment">
                              {docStatus[req.id].net_amount != null
                                ? `$${Number(docStatus[req.id].net_amount).toFixed(2)}`
                                : "—"}
                            </span>
                          </div>

                          {/* Per-booking discount override */}
                          {(() => {
                            const bdf = bookingDiscountForm[req.id];
                            const bds = bookingDiscounts[req.id];
                            if (!bdf?.open) {
                              return (
                                <div className="pt-1 space-y-1">
                                  {bds && bds.length > 0 && (
                                    <div className="space-y-1">
                                      {bds.map(d => (
                                        <div key={d.id} className="flex items-center justify-between text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1">
                                          <span className="text-blue-700">
                                            Override: {d.type === "percent" ? `${d.value}%` : d.type === "flat_dollar" ? `$${Number(d.value).toFixed(2)} off` : `$${Number(d.value).toFixed(2)}/room`}
                                            {d.discount_reason ? ` (${d.discount_reason.replace(/_/g, " ")})` : ""}
                                          </span>
                                          <button
                                            className="text-red-400 hover:text-red-600 ml-2"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (!req.dbId) return;
                                              await fetch(`/api/admin/reservations/${req.dbId}/discount`, {
                                                method: "DELETE",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ discountId: d.id }),
                                              });
                                              setBookingDiscounts(prev => ({
                                                ...prev,
                                                [req.id]: (prev[req.id] ?? []).filter(x => x.id !== d.id),
                                              }));
                                            }}
                                          >×</button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                    onClick={e => {
                                      e.stopPropagation();
                                      // Lazy-load existing discounts on first open
                                      if (!bds && req.dbId) {
                                        fetch(`/api/admin/reservations/${req.dbId}/discount`)
                                          .then(r => r.json())
                                          .then(data => {
                                            setBookingDiscounts(prev => ({ ...prev, [req.id]: data.discounts ?? [] }));
                                          });
                                      }
                                      setBookingDiscountForm(prev => ({
                                        ...prev,
                                        [req.id]: { open: true, type: "percent", value: "", reason: "", note: "", busy: false },
                                      }));
                                    }}
                                  >+ Add booking discount override</button>
                                </div>
                              );
                            }
                            return (
                              <div className="pt-1.5 space-y-2 border-t border-gray-200 mt-1" onClick={e => e.stopPropagation()}>
                                <p className="text-xs font-medium text-gray-600">Add booking discount override</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <select
                                    className="bx-input bx-input--sm col-span-2"
                                    value={bdf.type}
                                    onChange={e => setBookingDiscountForm(prev => ({ ...prev, [req.id]: { ...prev[req.id], type: e.target.value } }))}
                                  >
                                    <option value="percent">Percent off</option>
                                    <option value="flat_dollar">Flat dollar off</option>
                                    <option value="room_rate_override">Room rate override</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder={bdf.type === "percent" ? "%" : "$"}
                                    className="bx-input bx-input--sm"
                                    value={bdf.value}
                                    onChange={e => setBookingDiscountForm(prev => ({ ...prev, [req.id]: { ...prev[req.id], value: e.target.value } }))}
                                  />
                                  <select
                                    className="bx-input bx-input--sm"
                                    value={bdf.reason}
                                    onChange={e => setBookingDiscountForm(prev => ({ ...prev, [req.id]: { ...prev[req.id], reason: e.target.value } }))}
                                  >
                                    <option value="">Reason (optional)</option>
                                    <option value="bbs_default">BBS Default</option>
                                    <option value="bx_ministry_initiative">Ministry Initiative</option>
                                    <option value="nonprofit_partner">Nonprofit Partner</option>
                                    <option value="staff_courtesy">Staff Courtesy</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Note (optional)"
                                  className="bx-input bx-input--sm w-full"
                                  value={bdf.note}
                                  onChange={e => setBookingDiscountForm(prev => ({ ...prev, [req.id]: { ...prev[req.id], note: e.target.value } }))}
                                />
                                <div className="flex gap-2">
                                  <button
                                    disabled={bdf.busy || !bdf.value}
                                    className="bx-btn bx-btn--primary bx-btn--sm"
                                    onClick={async e => {
                                      e.stopPropagation();
                                      if (!req.dbId || !bdf.value) return;
                                      setBookingDiscountForm(prev => ({ ...prev, [req.id]: { ...prev[req.id], busy: true } }));
                                      try {
                                        const r = await fetch(`/api/admin/reservations/${req.dbId}/discount`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            type: bdf.type,
                                            value: parseFloat(bdf.value),
                                            scope: "all_rooms",
                                            discount_reason: bdf.reason || null,
                                            note: bdf.note || null,
                                          }),
                                        });
                                        const data = await r.json();
                                        if (data.discount) {
                                          setBookingDiscounts(prev => ({
                                            ...prev,
                                            [req.id]: [data.discount, ...(prev[req.id] ?? [])],
                                          }));
                                          setBookingDiscountForm(prev => ({ ...prev, [req.id]: { ...prev[req.id], open: false, busy: false } }));
                                        }
                                      } catch {
                                        setBookingDiscountForm(prev => ({ ...prev, [req.id]: { ...prev[req.id], busy: false } }));
                                      }
                                    }}
                                  >{bdf.busy ? "Saving…" : "Save"}</button>
                                  <button
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setBookingDiscountForm(prev => ({ ...prev, [req.id]: { ...prev[req.id], open: false } }));
                                    }}
                                  >Cancel</button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {req.status === "Confirmed" && (() => {
                      const ag = agreements[req.id];
                      const customerSigned = !!ag?.customer_signed_at;
                      const staffSigned    = !!ag?.staff_signed_at;
                      return (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">✓ Confirmed</p>
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
                                  className="bx-input bx-input--sm w-44"
                                  placeholder="Your full name"
                                  value={countersignName}
                                  onChange={(e) => setCountersignName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") doCountersign(req); }}
                                  autoFocus
                                />
                                <button className="bx-btn bx-btn--primary bx-btn--sm" onClick={() => doCountersign(req)}>Sign</button>
                                <button className="text-xs text-slate hover:text-parchment" onClick={() => { setCountersigning(null); setCountersignName(""); }}>Cancel</button>
                              </div>
                            ) : (
                              <button
                                className="bx-btn bx-btn--confirm bx-btn--sm"
                                onClick={(e) => { e.stopPropagation(); setCountersigning(req.id); setCountersignName(""); }}
                              >
                                <span className="flex items-center gap-1.5"><span>✍</span>Countersign Agreement</span>
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
                        <div className="rounded-xl p-4 space-y-3" style={{ background: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)", border: "1px solid color-mix(in srgb, var(--bx-clay) 35%, transparent)" }}>
                          <div className="flex gap-2.5 items-start">
                            <span className="text-base leading-none mt-0.5">⚠️</span>
                            <div>
                              <p className="text-xs font-bold mb-0.5" style={{ color: "var(--bx-parchment)" }}>
                                Permanently delete {req.id}?
                              </p>
                              <p className="text-xs" style={{ color: "color-mix(in srgb, var(--bx-parchment) 65%, transparent)" }}>
                                Removes all comments, history, agreements, and COI files. Cannot be undone.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              disabled={deleting === req.id}
                              onClick={() => deleteReservation(req)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
                              style={{ background: "#dc2626", color: "white" }}
                            >
                              {deleting === req.id ? "Deleting…" : "Yes, delete permanently"}
                            </button>
                            <button
                              disabled={deleting === req.id}
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                              style={{ background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)", color: "var(--bx-parchment)", border: "1px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)" }}
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

          {/* ── Users tab → moved to /admin/bx-reservations/users ─────── */}
          {tab === "users" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-sm" style={{ color: "var(--bx-slate)" }}>
                User management has moved to its own page.
              </p>
              <Link
                href="/admin/bx-reservations/users"
                className="bx-cta px-4 py-2 rounded-lg text-sm font-semibold bg-brass text-white"
              >
                Go to Users →
              </Link>
            </div>
          )}

          {/* ── Ministries tab → moved to /admin/bx-reservations/organizations */}
          {tab === "ministries" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-sm" style={{ color: "var(--bx-slate)" }}>
                Organizations (formerly Ministries) has moved to its own page.
              </p>
              <Link
                href="/admin/bx-reservations/organizations"
                className="bx-cta px-4 py-2 rounded-lg text-sm font-semibold bg-brass text-white"
              >
                Go to Organizations →
              </Link>
            </div>
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
                <FolderOpen size={14} className="inline mr-1.5" />View Documents Hub (Agreements · COIs · Payments) →
              </a>
            </div>
          )}
        </div>

        {/* Right: Calendar sidebar — Requests tab only */}
        {tab === "requests" && <div className={`${calOpen ? "block" : "hidden lg:block"}`}>
          <div className="sticky top-20 bx-glass rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate uppercase tracking-widest">Combined Calendar</p>
              <p className="text-xs text-slate">{calendarRangeLabel()}</p>
            </div>
            <p className="text-xs text-slate leading-relaxed">
              Staff view — shows real event names and flex-block flags. Never visible to the public.
            </p>

            {/* Grouped by day: a date heading, then each room's event on its own line */}
            <div className="space-y-4">
              {calendarEvents.length === 0 && <p className="text-xs text-slate">Nothing on the calendar in this range.</p>}
              {Object.entries(
                [...calendarEvents].sort((a, b) => a.date.localeCompare(b.date)).reduce<Record<string, typeof calendarEvents>>((acc, ev) => {
                  (acc[ev.date] ??= []).push(ev); return acc;
                }, {})
              ).map(([date, evs]) => (
                <div key={date}>
                  <p className="text-xs font-bold text-parchment mb-1.5">{formatYmd(date, { weekday: "short", month: "short", day: "numeric" })}</p>
                  <ul className="space-y-1.5">
                    {evs.map((ev, i) => (
                      <li
                        key={i}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium leading-snug border"
                        style={
                          ev.kind === "rental"
                            ? { background: "color-mix(in srgb, var(--bx-brass) 12%, transparent)", borderColor: "color-mix(in srgb, var(--bx-brass) 30%, transparent)", color: "var(--bx-parchment)" }
                            : ev.kind === "flex"
                            ? { background: "var(--tone-amber-bg)", borderColor: "var(--tone-amber-bd)", color: "var(--tone-amber-fg)" }
                            : { background: "color-mix(in srgb, var(--bx-slate) 8%, transparent)", borderColor: "color-mix(in srgb, var(--bx-parchment) 12%, transparent)", color: "var(--bx-slate)", textDecoration: "line-through" }
                        }
                      >
                        <span className="block">{ev.kind === "flex" && <span className="mr-1" aria-label="Standing use">⟳</span>}{ev.label}</span>
                        {ev.room && <span className="block text-[11px] opacity-75 font-normal">{ev.room.split(/,\s*/).map((id) => ROOMS.find((r) => r.id === id)?.name ?? id).join(" · ")}</span>}
                      </li>
                    ))}
                  </ul>
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
    <div className="bx-glass rounded-xl p-4">
      <p className="text-xs text-slate font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight tabular ${color}`}>{value}</p>
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
  { key: "payment_reminder_1_days", label: "First payment reminder",    unit: "days", description: "Days before the event to email the requester if a balance is due (confirmed bookings)" },
  { key: "payment_reminder_2_days", label: "Second payment reminder",   unit: "days", description: "Days before the event for a final balance reminder" },
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
    <div className="rounded-2xl bx-glass overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-parchment/10 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-parchment">Automation Thresholds</p>
          <p className="text-xs text-slate mt-0.5">Controls when reminder emails and auto-cancellation fire</p>
        </div>
        {dirty && (
          <button
            onClick={onSave}
            disabled={saving}
            className="bx-btn bx-btn--primary bx-btn--sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        )}
      </div>
      {loading ? (
        <div className="px-5 py-4"><CardSkeleton lines={2} height="80px" /></div>
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
                  aria-label={`${label} (${unit})`}
                  className="bx-input bx-input--sm w-16 text-center"
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
      <div className="bx-glass rounded-xl divide-y divide-parchment/5">
        {loading && (
          <div className="px-5 py-4"><CardSkeleton lines={2} height="80px" /></div>
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
      <div className="bx-glass rounded-xl p-5 space-y-4">
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
              <label htmlFor="bx-reserva-day-of-week-6" className="block text-xs font-semibold text-slate mb-1">Day of week</label>
              <select id="bx-reserva-day-of-week-6"
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
              <label htmlFor="bx-reserva-time-slot-7" className="block text-xs font-semibold text-slate mb-1">Time slot</label>
              <select id="bx-reserva-time-slot-7"
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
              <label htmlFor="bx-reserva-date-8" className="block text-xs font-semibold text-slate mb-1">Date</label>
              <input id="bx-reserva-date-8"
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="border border-parchment/20 rounded-lg px-3 py-2 text-sm bg-ink text-parchment"
              />
            </div>
          )}

          {/* Label */}
          <div className="flex-1 min-w-[160px]">
            <label htmlFor="bx-reserva-label-optional-9" className="block text-xs font-semibold text-slate mb-1">
              Label <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input id="bx-reserva-label-optional-9"
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
            className="bx-btn bx-btn--primary bx-btn--md"
          >
            {saving ? "Adding…" : "Add rule"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Types (Reports) ────────────────────────────────────────────────────────────
interface ReportKpis {
  total: number;
  internal:  { count: number; rack_rate_total: number };
  bbs:       { count: number; rack_rate_total: number };
  external:  { count: number; net_amount: number };
  discounts_given: number;
  net_revenue: number;
}
interface OrgRow {
  org_name: string;
  tier: string;
  bookings: number;
  rack_rate: number;
  discount: number;
  net: number;
}
interface ReportData {
  period: { from: string; to: string };
  kpis: ReportKpis;
  by_org: OrgRow[];
}
type SortCol = "org_name" | "tier" | "bookings" | "rack_rate" | "discount" | "net";

// ─── ReportsTab (live data) ──────────────────────────────────────────────────────
function ReportsTab() {
  const [period, setPeriod]       = useState<"this_year" | "last_year" | "custom">("this_year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");
  const [loading, setLoading]     = useState(true);
  const [data, setData]           = useState<ReportData | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [sortCol, setSortCol]     = useState<SortCol>("bookings");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (period === "custom" && (!customFrom || !customTo)) return;
    const params = new URLSearchParams({ period });
    if (period === "custom") { params.set("from", customFrom); params.set("to", customTo); }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/reports/bx?${params}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(json => { if (!cancelled) { setData(json); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Failed to load report data."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [period, customFrom, customTo]);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const sortedRows: OrgRow[] = data
    ? [...data.by_org].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortCol === "org_name") return dir * a.org_name.localeCompare(b.org_name);
        if (sortCol === "tier")     return dir * a.tier.localeCompare(b.tier);
        return dir * ((a[sortCol] as number) - (b[sortCol] as number));
      })
    : [];

  const fmt = (n: number) =>
    "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const tierLabel: Record<string, string> = {
    internal: "Internal",
    bbs:      "BBS School",
    external: "External",
  };
  const tierColor: Record<string, string> = {
    internal: "var(--bx-brass)",
    bbs:      "var(--bx-slate)",
    external: "var(--bx-parchment)",
  };

  const kpis = data?.kpis;

  const tile = (
    label: string,
    value: string | number,
    sub: string,
    accent = false
  ) => (
    <div
      className="bx-glass-flat rounded-xl p-5 flex flex-col gap-1"
      style={{
        background: accent
          ? "color-mix(in srgb, var(--bx-brass) 10%, var(--bx-surface))"
          : "var(--bx-surface)",
        border: `1px solid ${accent
          ? "color-mix(in srgb, var(--bx-brass) 25%, transparent)"
          : "color-mix(in srgb, var(--bx-parchment) 10%, transparent)"}`,
      }}
    >
      <p className="text-xs uppercase tracking-widest"
        style={{ color: accent ? "var(--bx-accent-text)" : "var(--bx-slate)" }}>
        {label}
      </p>
      {loading
        ? <div className="h-8 w-20 rounded animate-pulse"
            style={{ background: "color-mix(in srgb, var(--bx-parchment) 8%, transparent)" }} />
        : <p className="text-3xl font-bold"
            style={{ color: accent ? "var(--bx-accent-text)" : "var(--bx-parchment)" }}>
            {value}
          </p>
      }
      {!loading && (
        <p className="text-xs"
          style={{ color: accent ? "color-mix(in srgb, var(--bx-brass) 70%, transparent)" : "var(--bx-slate)" }}>
          {sub}
        </p>
      )}
    </div>
  );

  const th = (col: SortCol, label: string) => (
    <th
      key={col}
      onClick={() => toggleSort(col)}
      className="px-4 py-3 text-left cursor-pointer select-none whitespace-nowrap"
      style={{ color: sortCol === col ? "var(--bx-accent-text)" : "var(--bx-slate)", fontWeight: 500, fontSize: "0.75rem" }}
    >
      {label}{sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="flex flex-col gap-6 p-1">
      <BookingInsights />

      {/* ── Period selector ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs uppercase tracking-widest" style={{ color: "var(--bx-slate)" }}>Period</span>
        {(["this_year", "last_year", "custom"] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className="text-sm px-3 py-1 rounded-full border transition-colors"
            style={{
              background:  period === p ? "var(--bx-brass)" : "transparent",
              color:       period === p ? "#fff"  : "var(--bx-parchment)",
              borderColor: period === p
                ? "var(--bx-brass)"
                : "color-mix(in srgb, var(--bx-parchment) 20%, transparent)",
              fontWeight:  period === p ? 700 : 400,
            }}
          >
            {p === "this_year" ? "This Year" : p === "last_year" ? "Last Year" : "Custom Range"}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="text-sm px-2 py-1 rounded border bg-transparent"
              style={{ color: "var(--bx-parchment)", borderColor: "color-mix(in srgb, var(--bx-parchment) 20%, transparent)" }}
            />
            <span className="text-xs" style={{ color: "var(--bx-slate)" }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="text-sm px-2 py-1 rounded border bg-transparent"
              style={{ color: "var(--bx-parchment)", borderColor: "color-mix(in srgb, var(--bx-parchment) 20%, transparent)" }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ background: "color-mix(in srgb, red 10%, transparent)", color: "var(--bx-parchment)", border: "1px solid color-mix(in srgb, red 20%, transparent)" }}>
          {error}
        </div>
      )}

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tile("Total Bookings", kpis?.total ?? 0, "All tiers")}
        {tile("Internal",       kpis?.internal.count ?? 0,
                                kpis ? `${fmt(kpis.internal.rack_rate_total)} rack rate` : "")}
        {tile("BBS School",     kpis?.bbs.count ?? 0,
                                kpis ? `${fmt(kpis.bbs.rack_rate_total)} rack rate` : "")}
        {tile("External",       kpis?.external.count ?? 0,
                                kpis ? `${fmt(kpis.external.net_amount)} net` : "")}
        {tile("Discounts Given", kpis ? fmt(kpis.discounts_given) : "—", "All tiers")}
        {tile("Net Revenue",    kpis ? fmt(kpis.net_revenue) : "—", "External only", true)}
      </div>

      {/* ── Org breakdown table ── */}
      {!loading && !error && sortedRows.length > 0 && (
        <div className="bx-glass rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "color-mix(in srgb, var(--bx-parchment) 6%, transparent)" }}>
                {th("org_name", "Organization")}
                {th("tier",     "Tier")}
                {th("bookings", "Bookings")}
                {th("rack_rate","Rack Rate")}
                {th("discount", "Discount")}
                {th("net",      "Net")}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid color-mix(in srgb, var(--bx-parchment) 6%, transparent)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--bx-parchment)" }}>{row.org_name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--bx-parchment) 6%, transparent)", color: tierColor[row.tier] ?? "var(--bx-parchment)" }}>
                      {tierLabel[row.tier] ?? row.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--bx-parchment)" }}>{row.bookings}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--bx-slate)" }}>{row.rack_rate > 0 ? fmt(row.rack_rate) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: row.discount > 0 ? "var(--bx-accent-text)" : "var(--bx-slate)" }}>{row.discount > 0 ? fmt(row.discount) : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: row.net > 0 ? "var(--bx-parchment)" : "var(--bx-slate)" }}>{row.net > 0 ? fmt(row.net) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid color-mix(in srgb, var(--bx-parchment) 15%, transparent)", background: "color-mix(in srgb, var(--bx-parchment) 4%, transparent)" }}>
                <td className="px-4 py-3 font-semibold text-xs uppercase tracking-widest" colSpan={2} style={{ color: "var(--bx-slate)" }}>Total</td>
                <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "var(--bx-accent-text)" }}>{kpis?.total ?? 0}</td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--bx-slate)" }}>
                  {fmt((kpis?.internal.rack_rate_total ?? 0) + (kpis?.bbs.rack_rate_total ?? 0))}
                </td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--bx-accent-text)" }}>
                  {fmt(kpis?.discounts_given ?? 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "var(--bx-parchment)" }}>
                  {fmt(kpis?.net_revenue ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && !error && sortedRows.length === 0 && (
        <p className="text-sm text-center py-10" style={{ color: "var(--bx-slate)" }}>
          No bookings found in this period.
        </p>
      )}

      {loading && (
        <div className="bx-glass-flat rounded-xl p-10 flex items-center justify-center">
          <p className="text-sm animate-pulse" style={{ color: "var(--bx-slate)" }}>Loading report data…</p>
        </div>
      )}

      {!loading && data && (
        <p className="text-xs pb-2" style={{ color: "color-mix(in srgb, var(--bx-slate) 50%, transparent)" }}>
          Live data · BX Reservations · {kpis?.total ?? 0} booking{kpis?.total !== 1 ? "s" : ""} ·{" "}
          {new Date(data.period.from).toLocaleDateString()} – {new Date(data.period.to).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
