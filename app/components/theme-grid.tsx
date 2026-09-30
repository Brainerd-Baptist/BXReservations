"use client";

import AppearancePicker from "./appearance-picker";

interface ThemeGridProps {
  userId: string;
  savedTheme: string | null;
}

/** Account page appearance setting — Light / Dark / Auto. */
export default function ThemeGrid({ userId }: ThemeGridProps) {
  return <AppearancePicker userId={userId} size="lg" />;
}
