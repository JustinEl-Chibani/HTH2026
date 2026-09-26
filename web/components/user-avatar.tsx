import { cn } from "@/lib/utils";

const PALETTE = [
  ["#b6f03c", "#1f7a3a"],
  ["#ff7a59", "#8a1c3b"],
  ["#5ad1ff", "#243c8f"],
  ["#ffd23f", "#b0440a"],
  ["#c58bff", "#4a1f8a"],
  ["#3ff0c0", "#0b5e57"],
  ["#ff9ad5", "#7a1f5c"],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function UserAvatar({
  seed,
  name,
  size = 40,
  className,
}: {
  seed: string;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const h = hash(seed);
  const [a, b] = PALETTE[h % PALETTE.length];
  const angle = h % 360;
  const initial = (name ?? "?").replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-black text-white shadow-inner select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(${angle}deg, ${a}, ${b})`,
        textShadow: "0 1px 2px rgba(0,0,0,.35)",
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
