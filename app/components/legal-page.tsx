import Link from "next/link";
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/site";

/** Shared frame for the privacy notice and terms of use (C4). */
export default function LegalPage({ title, updated, draft = true, children }: { title: string; updated: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <div className="px-4 py-10">
      <article className="max-w-2xl mx-auto bx-glass rounded-2xl p-6 sm:p-10 bx-legal">
        {draft && (
          <p className="bx-tone-amber border rounded-lg px-3 py-2 text-xs mb-6" role="note">
            Draft for review by Brainerd Baptist Church. This is plain-language guidance, not legal advice; have it reviewed before relying on it.
          </p>
        )}
        <h1 className="font-serif text-3xl text-parchment mb-1">{title}</h1>
        <p className="text-xs text-slate mb-8">Last updated {updated}</p>
        {children}
        <hr className="my-8 border-parchment/10" />
        <p className="text-sm text-slate">
          Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or call {SUPPORT_PHONE}.
          {" "}See also the <Link href="/privacy">privacy notice</Link> and <Link href="/terms">terms of use</Link>.
        </p>
      </article>
    </div>
  );
}
