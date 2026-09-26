import Image from "next/image";
import { cn } from "@/lib/utils";

export const APP_NAME = "SolMog";
export const APP_SLOGAN = "Put your money where your mouth is.";

/** The SolMog mascot (web/public/logo.png, generated from assets/icon.png). */
export function Logo({ size = 32, className, priority }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt={APP_NAME}
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 select-none", className)}
    />
  );
}

/** "Sol" + lime "Mog" wordmark, optionally with the slogan tucked underneath. */
export function Wordmark({
  className,
//  slogan = false,
  //sloganClassName,
}: {
  className?: string;
  //slogan?: boolean;
  //sloganClassName?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className="font-black tracking-tighter">
        Sol
        <span className="bg-gradient-to-br from-primary to-brand-ink bg-clip-text text-transparent dark:to-yes">Mog</span>
      </span>
    </span>
  );
}
