"use client";

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_60%)]" />
        <div className="relative w-full max-w-md">
          {children}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to home
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
