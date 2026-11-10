import { redirect } from "next/navigation";
import { getUserAndRole } from "@/lib/get-user-role";
import { can } from "@/lib/roles";
import FinanceBillingView from "./finance-billing-view";

export const metadata = { title: "Billing Overview" };

export default async function FinancePage() {
  const { user, role } = await getUserAndRole();
  if (!user) redirect("/sign-in");
  if (!can.viewBillingHub(role)) redirect("/account");

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-parchment">Billing Overview</h1>
        <p className="text-sm text-slate mt-1">Outstanding balances and payment history across all reservations.</p>
      </div>
      <FinanceBillingView />
    </main>
  );
}
