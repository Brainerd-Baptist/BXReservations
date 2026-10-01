import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminClient } from "@/lib/event-map";
import { loadQuote } from "@/lib/quotes";
import QuoteView from "./quote-view";

export const metadata: Metadata = { title: "Your quote — BX Reservations", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

// The quote for approval. The private link from the email is the key (like the
// agreement and survey links), so the organizer doesn't need to sign in.
export default async function QuotePage({ params }: Props) {
  const { token } = await params;
  const loaded = await loadQuote(adminClient(), token);
  if (!loaded) notFound();
  return <QuoteView quote={loaded.quote} reservation={loaded.reservation} state={loaded.state} />;
}
