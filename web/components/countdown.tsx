"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Live "3m 12s" countdown; shows `doneText` once the time has passed. */
export function Countdown({
  to,
  doneText = "now",
  className,
  urgentBelowSecs = 60,
}: {
  to: string | Date;
  doneText?: string;
  className?: string;
  urgentBelowSecs?: number;
}) {
  const now = useNow();
  const secs = (new Date(to).getTime() - now) / 1000;
  return (
    <span className={cn("tabular", secs > 0 && secs < urgentBelowSecs && "text-no", className)}>
      {secs > 0 ? formatDuration(secs) : doneText}
    </span>
  );
}
