"use client";

import { Link } from "react-router-dom";
import { ArrowLeft, Check, ShieldCheck, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { OrbitMark } from "@/components/ui/loader";

const points = [
  "Upload the exact template your college gave you",
  "Grounded in your own project sources",
  "Visible placeholders for anything missing",
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout>
      <div className="relative grid min-h-[calc(100vh-4rem)] overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
        <div className="pointer-events-none absolute inset-0 grid-field opacity-60" />
        <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-electric/10 blur-[120px]" />

        <div className="relative hidden flex-col justify-between border-r border-white/[0.07] p-10 lg:flex xl:p-14">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Template-first drafting
          </div>

          <div className="max-w-lg">
            <OrbitMark className="mb-8 h-14 w-14" />
            <h2 className="text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.04em] xl:text-5xl">
              Your work,{" "}
              <span className="font-serif font-normal italic text-primary">
                in the right format.
              </span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Scribe drafts the document around your project and preserves the
              template&rsquo;s tables, margins, headings, and figure spaces.
            </p>
            <ul className="mt-8 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-foreground/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Private storage · signed downloads · no fabricated sources
          </div>
        </div>

        <div className="relative flex items-center justify-center px-4 py-12 sm:px-8">
          <div className="page-reveal w-full max-w-md">
            {children}
            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
