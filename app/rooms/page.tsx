import { Metadata } from "next";
import { RoomsClient } from "./rooms-client";
import { getRoomPrices } from "@/lib/room-prices";
import { RoomPriceProvider } from "@/lib/room-price-context";

export const metadata: Metadata = {
  title: "Spaces — BX Community Center",
  description: "Browse all available event spaces at the BX Community Center. View photos, capacity, and setup configurations.",
};

export default async function RoomsPage() {
  return (
    <RoomPriceProvider prices={await getRoomPrices()}>
      <RoomsClient />
    </RoomPriceProvider>
  );
}
