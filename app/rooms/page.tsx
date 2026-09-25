import { Metadata } from "next";
import { RoomsClient } from "./rooms-client";

export const metadata: Metadata = {
  title: "Spaces — BX Community Center",
  description: "Browse all available event spaces at the BX Community Center. View photos, capacity, and setup configurations.",
};

export default function RoomsPage() {
  return <RoomsClient />;
}
