import Image from "next/image";
import { cn } from "@/lib/utils";

/** The PutYourMoney mascot (web/public/logo.png, generated from assets/icon.png). */
export function Logo({ size = 32, className, priority }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="PutYourMoney"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 select-none", className)}
    />
  );
}
