"use client";

import { createContext, useContext } from "react";
import type { BxRole } from "@/lib/roles";

// The signed-in admin's role, provided by the (server) admin layout so client
// screens can hide what the API would refuse (C2).
const AdminRoleContext = createContext<BxRole | null>(null);

export function AdminRoleProvider({ role, children }: { role: BxRole | null; children: React.ReactNode }) {
  return <AdminRoleContext.Provider value={role}>{children}</AdminRoleContext.Provider>;
}

export const useAdminRole = () => useContext(AdminRoleContext);
