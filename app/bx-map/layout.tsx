// BX Building Map — route layout
// Hides the root version footer on the map route.
// No fixed overlay needed: page.tsx uses height:calc(100dvh-56px) on its container.
export default function BxMapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`body > footer { display: none !important; }`}</style>
      {children}
    </>
  );
}
