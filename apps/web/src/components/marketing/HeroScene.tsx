"use client";

import {
  Check,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function HeroScene() {
  return (
    <div className="scene-stage relative mx-auto h-[430px] w-full max-w-[470px] sm:h-[500px]">
      <div className="pointer-events-none absolute inset-8 rounded-full bg-primary/10 blur-[90px]" />
      <div className="pointer-events-none absolute right-0 top-10 h-36 w-36 rounded-full bg-electric/10 blur-[70px]" />
      <div className="scene-floor" />
      <div className="scene-ring h-[62%] w-[62%] opacity-80" />
      <div className="scene-ring h-[84%] w-[84%] opacity-40" />

      <div className="scene-stack">
        <div className="scene-card scene-card-a">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-coral/80" />
              <span className="h-2 w-2 rounded-full bg-amber-300/80" />
              <span className="h-2 w-2 rounded-full bg-primary/80" />
            </div>
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
              RVCE_Synopsis.docx
            </span>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-primary">
                  Project synopsis
                </p>
                <p className="mt-1 text-[13px] font-semibold leading-tight text-foreground">
                  Smart Irrigation System
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  Department of Computer Science
                </p>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-primary">
                Template
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="h-1.5 w-4/5 rounded-full bg-white/15" />
              <div className="h-1.5 w-full rounded-full bg-white/10" />
              <div className="h-1.5 w-11/12 rounded-full bg-white/[0.07]" />
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.08]">
              <div className="grid grid-cols-3 border-b border-white/[0.08] bg-white/[0.035]">
                {["Stage", "Method", "Status"].map((label) => (
                  <div
                    key={label}
                    className="border-r border-white/[0.06] px-2 py-1.5 font-mono text-[6px] uppercase tracking-[0.12em] text-muted-foreground last:border-r-0"
                  >
                    {label}
                  </div>
                ))}
              </div>
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="grid grid-cols-3 border-b border-white/[0.05] last:border-b-0"
                >
                  {[0, 1, 2].map((cell) => (
                    <div key={cell} className="px-2 py-1.5">
                      <div
                        className="h-1 rounded-full bg-white/10"
                        style={{ width: `${70 - row * 8 - cell * 6}%` }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[8px] text-muted-foreground">
              <ShieldCheck className="h-2.5 w-2.5 text-primary" />
              Margins, tables, and numbering preserved
            </div>
          </div>
        </div>

        <div className="scene-card scene-card-b">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <LayoutTemplate className="h-3 w-3 text-electric" />
              <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground">
                Outline
              </span>
            </div>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[6px] uppercase tracking-[0.1em] text-primary">
              Approved
            </span>
          </div>
          <div className="space-y-1.5 p-3">
            {["Introduction", "Literature review", "Methodology", "Implementation"].map(
              (item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5"
                >
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/10 font-mono text-[6px] text-primary">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-[8px] font-medium text-foreground/80">
                    {item}
                  </span>
                  <Check className="h-2.5 w-2.5 text-primary" />
                </div>
              ),
            )}
          </div>
        </div>

        <div className="scene-card scene-card-c">
          <div className="p-3">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3 text-violet" />
              <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-muted-foreground">
                Figure 1
              </span>
            </div>
            <div className="mt-2 flex h-14 items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.025] text-center">
              <div>
                <p className="font-mono text-[6px] uppercase tracking-[0.12em] text-muted-foreground">
                  Reserved image space
                </p>
                <p className="mt-0.5 text-[7px] text-foreground/60">
                  System architecture
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute left-1 top-[18%] z-30 hidden [transform:translateZ(180px)] sm:block">
        <div className="animate-float flex items-center gap-2 rounded-full border border-white/10 bg-background/80 px-3 py-2 text-[10px] font-medium text-foreground/80 shadow-lift backdrop-blur-md">
          <FileText className="h-3 w-3 text-primary" />
          9 tables preserved
        </div>
      </div>
      <div className="absolute right-2 top-[38%] z-30 hidden [transform:translateZ(220px)] sm:block">
        <div className="animate-float-delayed flex items-center gap-2 rounded-full border border-white/10 bg-background/80 px-3 py-2 text-[10px] font-medium text-foreground/80 shadow-lift backdrop-blur-md">
          <Sparkles className="h-3 w-3 text-electric" />
          Source-grounded
        </div>
      </div>
      <div className="absolute bottom-[8%] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-background/75 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
        DOCX export ready
      </div>
    </div>
  );
}
