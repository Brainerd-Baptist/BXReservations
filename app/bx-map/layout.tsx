// BX Building Map — route layout
// Positions the map as a fixed full-bleed panel below the site header,
// and hides the root version footer on this route.
export default function BxMapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Hide the root version footer on the map route */}
      <style>{`body > footer { display: none !important; }`}</style>
      {/* Fixed panel: starts below the 56px header, fills the rest of the viewport */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(3.5rem + env(safe-area-inset-top))',
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          zIndex: 20,
        }}
      >
        {children}
      </div>
    </>
  );
}
