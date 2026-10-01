"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_PRICES, type PriceList } from "@/lib/pricing";
import type { AddonWithRules } from "@/lib/addon-pricing";

// The room price list from Admin → Settings, handed down from the server page.
const Ctx = createContext<PriceList>(DEFAULT_PRICES);
// Church use: rooms are free, so estimates say "No charge"
const FreeCtx = createContext(false);
const AddonCtx = createContext<AddonWithRules[] | null>(null);

export function RoomPriceProvider({ prices, free = false, addons = null, children }: {
  prices: PriceList; free?: boolean; addons?: AddonWithRules[] | null; children: ReactNode;
}) {
  return (
    <Ctx.Provider value={prices}>
      <FreeCtx.Provider value={free}>
        <AddonCtx.Provider value={addons}>{children}</AddonCtx.Provider>
      </FreeCtx.Provider>
    </Ctx.Provider>
  );
}

/** The add-on catalog loaded with the page (null = not provided) */
export const useAddonCatalog = () => useContext(AddonCtx);

export const useNoCharge = () => useContext(FreeCtx);

export const useRoomPrices = () => useContext(Ctx);

/** One room's prices (4-hour rates + each extra hour) */
export const useRoomPrice = (roomId: string) => useContext(Ctx)[roomId];

/** 4-hour block price for one room */
export function useBlockPrice(roomId: string, isNP: boolean): number {
  const p = useContext(Ctx)[roomId];
  return p ? (isNP ? p.np : p.std) : 0;
}
