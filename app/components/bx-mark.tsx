import Image from "next/image";

/** The BX logo, black on light and white on dark, no tile. Decorative by default. */
export default function BxMark({ height = 40, label, className = "" }: { height?: number; label?: string; className?: string }) {
  const w = Math.round((height * 949) / 413);
  return (
    <span className={`inline-flex ${className}`} role={label ? "img" : undefined} aria-label={label}>
      <Image src="/bx-logo-black-trim.png" alt="" width={w} height={height} className="bx-only-light" style={{ height, width: "auto" }} priority />
      <Image src="/bx-logo-white.png" alt="" width={w} height={height} className="bx-only-dark" style={{ height, width: "auto" }} priority />
    </span>
  );
}
