import type { Metadata } from "next";
import LegalPage from "@/app/components/legal-page";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy notice — BX Reservations", description: "What BX Reservations collects, why, and your choices." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="September 30, 2026">
      <p>
        BX Reservations is how people request and plan events at the BX Community Center, run by Brainerd Baptist Church in
        Chattanooga, Tennessee (&ldquo;we&rdquo;). This notice explains what we collect, why, who helps us run the site, and your choices.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email, phone and organization. If you sign in with Google, we receive your name and email from Google. Passwords are stored by our sign-in provider, never in plain text.</li>
        <li><strong>Booking details:</strong> event name, dates, times, spaces, setup, headcount, add-ons, notes, and messages with the BX team.</li>
        <li><strong>Documents you give us:</strong> certificates of insurance, your event logo, and your event map plan.</li>
        <li><strong>Agreements:</strong> when you sign the Facility Use Agreement we record the name you type, the date and time, and your internet (IP) address as proof of signing.</li>
        <li><strong>Your feedback:</strong> if you answer the survey we send after your event, we keep your answers with your booking. We only quote your comments (with your first name) if you tick the box that says we may.</li>
        <li><strong>Payments:</strong> amounts, dates and method (for example, check) that the BX team records. We don&rsquo;t collect card or bank numbers on this site.</li>
        <li><strong>Site use:</strong> page views and page speed, collected without cookies and without identifying you; and how far a visit gets through the booking form, using a random code that isn&rsquo;t linked to your name or email.</li>
        <li><strong>Security:</strong> to stop abuse we keep a scrambled (hashed) form of your IP address, email or account ID for a short time when you use the site&rsquo;s forms (sign-up, sign-in emails, requests, invites). These counters are cleared after about two days.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To review, confirm and run your event: scheduling rooms, setup, signs, billing and reminders.</li>
        <li>To contact you about your booking, including emails about status changes, payments and cancellations.</li>
        <li>To keep church financial and facility records.</li>
        <li>To keep the site secure and working well.</li>
      </ul>
      <p>We don&rsquo;t sell your information, and we don&rsquo;t use it for advertising.</p>

      <h2>Who can see it</h2>
      <ul>
        <li><strong>BX staff</strong> who manage bookings.</li>
        <li><strong>People you add</strong> to a booking as co-organizers or viewers.</li>
        <li><strong>Attendees</strong>, only if you turn on a share link for your event map; it shows the public map, not your contact details.</li>
        <li><strong>Service providers</strong> who run parts of the site for us: Supabase (database, sign-in and file storage, in the United States), Vercel (web hosting and cookie-free analytics), Resend (email delivery), Google (only if you choose Google sign-in), and Planning Center (the church calendar, which receives each event&rsquo;s name, times and status).</li>
        <li><strong>When required by law</strong>, or to protect people&rsquo;s safety.</li>
      </ul>

      <h2>Cookies</h2>
      <p>We use only the cookies needed to keep you signed in. Your Light/Dark choice is saved in your browser. We don&rsquo;t use advertising or tracking cookies.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep booking and payment records as long as the church needs them for its records and accounting.
        [Church to confirm: for example, 7 years for financial records, and certificates of insurance deleted 3 years after the event.]
        You can ask us to delete your account at any time; we may keep booking and payment records we&rsquo;re required to keep.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Update your name, phone and organization on your Account page.</li>
        <li>Ask us for a copy of your information, to correct it, or to delete your account by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</li>
        <li>Remove people from your booking at any time.</li>
      </ul>

      <h2>Children</h2>
      <p>The site is for adults arranging events. Children under 13 shouldn&rsquo;t create accounts. If a child&rsquo;s information was given to us by mistake, contact us and we&rsquo;ll remove it.</p>

      <h2>Keeping it safe</h2>
      <p>Information is sent over encrypted connections, access is limited to the people above, and staff tools require a staff account. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>Changes</h2>
      <p>If we change this notice, we&rsquo;ll update the date above, and we&rsquo;ll tell account holders by email about important changes.</p>
    </LegalPage>
  );
}
