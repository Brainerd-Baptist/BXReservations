import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BX Building Map · Brainerd Baptist',
  description:
    'Interactive floor plan of the Brainerd Baptist BX building, lower and upper levels.',
};

export default function BxMapLayout({ children }: { children: React.ReactNode }) {
  // Children render in a fixed full-screen overlay — no wrapper needed.
  return <>{children}</>;
}
