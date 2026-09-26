"use client";

import { PageHeader } from "@/components/page-header";
import { useMe } from "@/hooks/use-session";

export default function HomePage() {
  const { data: me } = useMe();
  return <PageHeader title={`Hey ${me?.displayName ?? me?.username} 👋`} subtitle="Bets coming soon." />;
}
