// Event Map route layout — hides the root version footer so the map gets the
// full height below the site header (same treatment as /bx-map).
export default function EventMapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body > footer { display: none !important; }`}</style>
      {children}
    </>
  );
}
