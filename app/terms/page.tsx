import type { Metadata } from "next";
import LegalPage from "@/app/components/legal-page";

export const metadata: Metadata = { title: "Terms of use — BX Reservations", description: "The rules for using BX Reservations." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="September 30, 2026">
      <p>
        These terms cover your use of BX Reservations, the online booking site for the BX Community Center at Brainerd Baptist Church
        (&ldquo;we&rdquo;, &ldquo;the church&rdquo;). By creating an account or sending a request, you agree to them.
      </p>

      <h2>Requests and bookings</h2>
      <ul>
        <li>Sending a request doesn&rsquo;t reserve a space. A booking is confirmed only when the BX team confirms it.</li>
        <li>Prices shown before confirmation are estimates. Your invoice shows what you owe.</li>
        <li>For each booking, the <strong>Facility Use Agreement</strong> sets the rules for using the building, including deposits, insurance, conduct and damage. If it differs from these terms, the agreement wins.</li>
        <li>We may decline or cancel a request, for example when a space is needed for church ministry or the event doesn&rsquo;t fit the BX&rsquo;s purpose.</li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate information, and keep your contact details current so we can reach you about your event.</li>
        <li>Keep your password private. You&rsquo;re responsible for what happens on your account.</li>
        <li>People you add to a booking can see it; co-organizers can also change it and cancel it.</li>
      </ul>

      <h2>Cancellations</h2>
      <p>
        The organizer or a co-organizer can cancel a request that isn&rsquo;t confirmed yet, and must give a reason. Everyone on the booking and the BX team is told who cancelled, when and why.
        To cancel a confirmed booking, message the BX team; the Facility Use Agreement explains any fees.
      </p>

      <h2>Payments</h2>
      <p>Pay as shown on your invoice. Reminders are sent before your event when a balance is due. Church-use bookings may have no charge.</p>

      <h2>What you upload</h2>
      <p>
        You may upload only logos, documents and text you have the right to use. You allow the church to use your event logo and event
        name on the signs, maps and packets for your event. Don&rsquo;t upload anything unlawful, hateful, or harmful.
      </p>

      <h2>Using the site</h2>
      <ul>
        <li>Don&rsquo;t try to get into accounts or data that aren&rsquo;t yours, disrupt the site, or send automated or bulk requests.</li>
        <li>We may suspend accounts that misuse the site.</li>
      </ul>

      <h2>No guarantees</h2>
      <p>
        We work to keep the site accurate and available, but it&rsquo;s provided &ldquo;as is.&rdquo; Room photos, availability and estimates are guides, not promises.
        To the extent the law allows, the church isn&rsquo;t responsible for losses caused by using or being unable to use the site; your Facility Use Agreement covers your event itself.
      </p>

      <h2>Changes and law</h2>
      <p>We may update these terms and will change the date above when we do. Tennessee law applies.</p>
    </LegalPage>
  );
}
