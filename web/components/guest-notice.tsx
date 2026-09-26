"use client";

import { useGoSignIn } from "@/components/app-shell";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

/** Shown to guests on pages that only make sense with an account (friends, notifications). */
export function GuestNotice({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const goSignIn = useGoSignIn();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={title} />
      <EmptyState icon={icon} title="Sign in to use this">
        {children}
      </EmptyState>
      <Button size="lg" className="mt-4 h-12 w-full font-bold" onClick={goSignIn}>
        Sign in
      </Button>
    </div>
  );
}
