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

      <div className="pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 -rotate-90 font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground/45 sm:block">
        210 mm
      </div>
      <div className="pointer-events-none absolute bottom-0 left-1/2 hidden -translate-x-1/2 font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground/45 sm:block">
        A4 / 297 mm
      </div>

      <div className="scene-stack">
        <div className="scene-card scene-card-a paper-surface paper-sheet corner-marks">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              RVCE_Synopsis.docx
            </span>
            <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.16em] text-primary">
              REV. 01
            </span>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-primary">
                  FIG. 01 / SYNOPSIS
                </p>
                <p className="mt-1 text-[13px] font-semibold leading-tight text-foreground">
                  Smart Irrigation System
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  Department of Computer Science
                </p>
              </div>
              <span className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[6px] font-semibold uppercase tracking-[0.14em] text-primary">
                Template
              </span>
            </div>

            <div className="mt-3 h-px bg-border" />

            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 w-4/5 bg-foreground/18" />
              <div className="h-1.5 w-full bg-foreground/15" />
              <div className="h-1.5 w-11/12 bg-foreground/10" />
            </div>

            <div className="mt-3 overflow-hidden border border-border">
              <div className="grid grid-cols-3 border-b border-border bg-muted/70">
                {["Stage", "Method", "Status"].map((label) => (
                  <div
                    key={label}
                    className="border-r border-border px-2 py-1.5 font-mono text-[6px] font-semibold uppercase tracking-[0.12em] text-muted-foreground last:border-r-0"
                  >
                    {label}
                  </div>
                ))}
              </div>
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="grid grid-cols-3 border-b border-border last:border-b-0"
                >
                  {[0, 1, 2].map((cell) => (
                    <div key={cell} className="border-r border-border px-2 py-1.5 last:border-r-0">
                      <div
                        className="h-1 bg-foreground/15"
                        style={{ width: `${70 - row * 8 - cell * 6}%` }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
              <span className="flex items-center gap-1.5 font-mono text-[6px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                Tables preserved
              </span>
              <span className="font-mono text-[6px] uppercase tracking-[0.14em] text-muted-foreground/60">
                Sheet 01
              </span>
            </div>
          </div>
        </div>

        <div className="scene-card scene-card-b paper-surface paper-sheet">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <LayoutTemplate className="h-3 w-3 text-electric" />
              <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Outline
              </span>
            </div>
            <span className="border border-success/30 bg-success/10 px-1.5 py-0.5 font-mono text-[6px] font-semibold uppercase tracking-[0.1em] text-success">
              Approved
            </span>
          </div>
          <div className="space-y-1.5 p-3">
            {["Introduction", "Literature review", "Methodology", "Implementation"].map(
              (item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-2 border border-border bg-muted/35 px-2 py-1.5"
                >
                  <span className="flex h-3.5 w-3.5 items-center justify-center border border-primary/25 bg-primary/10 font-mono text-[6px] font-semibold text-primary">
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

        <div className="scene-card scene-card-c paper-surface paper-sheet">
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="h-3 w-3 text-coral" />
                <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Fig. 02
                </span>
              </div>
              <span className="font-mono text-[6px] uppercase tracking-[0.12em] text-muted-foreground/60">
                Reserved
              </span>
            </div>
            <div className="mt-2 flex h-14 items-center justify-center border border-dashed border-border bg-muted/30 text-center">
              <div>
                <p className="font-mono text-[6px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Image space
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
        <div className="animate-float flex items-center gap-2 border border-border bg-background/90 px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground/80 shadow-lift">
          <FileText className="h-3 w-3 text-primary" />
          9 tables preserved
        </div>
      </div>
      <div className="absolute right-2 top-[38%] z-30 hidden [transform:translateZ(220px)] sm:block">
        <div className="animate-float-delayed flex items-center gap-2 border border-electric/25 bg-background/90 px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground/80 shadow-lift">
          <Sparkles className="h-3 w-3 text-electric" />
          Source-grounded
        </div>
      </div>
      <div className="absolute bottom-[8%] left-1/2 flex -translate-x-1/2 items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-primary backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-[1px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
        DOCX export ready
      </div>
    </div>
  );
}
