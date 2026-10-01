import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/event-map";
import { isStaffPreview, loadQuote } from "@/lib/quotes";
import QuoteView from "./quote-view";

export const metadata: Metadata = { title: "Your quote — BX Reservations", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

// The quote for approval. The private link from the email is the key (like the
// agreement and survey links), so the organizer doesn't need to sign in.
export default async function QuotePage({ params }: Props) {
  const { token } = await params;
  const db = adminClient();
  const loaded = await loadQuote(db, token);
  if (!loaded) notFound();
  const [staffPreview, { data: messages }] = await Promise.all([
    isStaffPreview(db, loaded.reservation),
    // The booking's Messages thread (what the organizer can see)
    db.from("reservation_comments").select("id, author_name, author_role, body, created_at")
      .eq("reservation_id", loaded.reservation.id).eq("internal_only", false)
      .order("created_at", { ascending: false }).limit(30),
  ]);
  return <QuoteView quote={loaded.quote} reservation={loaded.reservation} state={loaded.state} staffPreview={staffPreview}
    messages={(messages ?? []).reverse()} />;
}
