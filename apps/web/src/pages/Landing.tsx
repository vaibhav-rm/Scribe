"use client";

import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  GitBranch,
  Image as ImageIcon,
  LayoutTemplate,
  Lock,
  Ruler,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { HeroScene } from "@/components/marketing/HeroScene";
import { cn } from "@/lib/utils";

const DOC_TYPES = [
  { name: "Project Synopsis", desc: "Objectives, scope, and methodology at a glance." },
  { name: "Final Year Report", desc: "Full capstone documentation with chapters." },
  { name: "SRS", desc: "IEEE-style requirements for software projects." },
  { name: "System Design", desc: "Architecture, modules, and data flow." },
  { name: "Project Proposal", desc: "A formal approval-ready proposal." },
  { name: "Abstract", desc: "A tight one-page conference summary." },
  { name: "Literature Review", desc: "Source-grounded review of existing work." },
  { name: "Progress Report", desc: "Milestone updates for guides and panels." },
];

const STEPS = [
  {
    icon: Upload,
    title: "Add your project sources",
    body: "Paste notes, upload PDFs or DOCX files, and link a public GitHub repository. Only what you add is used.",
    tone: "text-primary",
    span: "lg:col-span-5",
  },
  {
    icon: LayoutTemplate,
    title: "Choose or upload a template",
    body: "Bring your college's DOCX format. Scribe reads its structure and keeps your sections in order.",
    tone: "text-electric",
    span: "lg:col-span-7",
  },
  {
    icon: Wand2,
    title: "Review the outline",
    body: "The AI proposes a section plan built from your sources. You approve it before a single word is generated.",
    tone: "text-violet",
    span: "lg:col-span-7",
  },
  {
    icon: FileText,
    title: "Generate, edit, export",
    body: "Write section by section, edit inline, restore earlier versions, and download a formatted DOCX.",
    tone: "text-coral",
    span: "lg:col-span-5",
  },
];

const FEATURES = [
  {
    icon: BookOpen,
    title: "Source-grounded sections",
    body: "Every section is written from the resources you added to that project — not from a generic prompt.",
    tone: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Uploads live in private storage. Downloads use short-lived signed URLs.",
    tone: "text-electric",
    bg: "bg-electric/10",
  },
  {
    icon: GitBranch,
    title: "GitHub-aware",
    body: "Link a public repository and Scribe reads its README and source files.",
    tone: "text-violet",
    bg: "bg-violet/10",
  },
  {
    icon: ScanLine,
    title: "Visible gaps",
    body: "Missing facts stay visible as placeholders. No invented experiments, results, or references.",
    tone: "text-coral",
    bg: "bg-coral/10",
  },
];

const FORMAT_ROWS = [
  { label: "Page", value: "A4 · measured from your DOCX", icon: Ruler },
  { label: "Margins", value: "Exact section properties preserved", icon: ScanLine },
  { label: "Tables", value: "Title page, content, declaration, appendix", icon: Table2 },
  { label: "Headings", value: "Styles, numbering, and spacing kept", icon: LayoutTemplate },
  { label: "Figures", value: "Reserved image spaces and captions", icon: ImageIcon },
  { label: "Export", value: "DOCX first · PDF when enabled", icon: Lock },
];

export function LandingPage() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 grid-field opacity-70" />
        <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-24 top-8 h-96 w-96 rounded-full bg-electric/[0.07] blur-[130px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24 xl:gap-20">
          <div className="animate-rise">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 border border-primary/25 bg-primary/[0.07] px-3 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-[1px] bg-primary/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-[1px] bg-primary" />
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  FIG. 01 / Template-first engine
                </span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/55">
                Rev. 2026.11
              </span>
            </div>

            <div className="mt-8 flex items-center gap-3 border-t border-border pt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/55">
              <span>Scribe / drafting system</span>
              <span className="h-px flex-1 bg-border" />
              <span>Sheet 01 / 04</span>
            </div>

            <h1 className="mt-5 max-w-3xl text-balance text-[2.8rem] font-semibold leading-[0.98] tracking-[-0.055em] text-foreground sm:text-6xl lg:text-[4.55rem]">
              Your project report,{" "}
              <span className="font-serif font-normal italic text-primary">
                formatted
              </span>{" "}
              like your college wants.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Scribe turns your notes, files, and repo into a template-aware
              academic document. It plans an outline you can review, grounds
              every section in your sources, and never invents results or
              references.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to="/signup">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/templates">
                  Browse templates <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> No invented results
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-electric" /> Visible placeholders
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-violet" /> DOCX export
              </span>
            </div>
          </div>

          <div className="animate-rise delay-2">
            <HeroScene />
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-b border-border bg-card/30 py-3.5">
        <div className="animate-marquee pause-on-hover flex w-max items-center gap-8">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className="flex items-center gap-8"
            >
              {[
                "Template fidelity",
                "Source grounding",
                "Visible placeholders",
                "Version history",
                "DOCX export",
                "Private storage",
              ].map((item) => (
                <span
                  key={`${copy}-${item}`}
                  className="flex items-center gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80"
                >
                  <span className="h-1 w-1 rounded-full bg-primary/70" />
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-md border border-border bg-card/40 md:grid-cols-4">
          {[
            ["8", "document types"],
            ["DOCX", "template-aware export"],
            ["3 / month", "free draft generations"],
            ["0", "invented results"],
          ].map(([value, label], index) => (
            <div
              key={label}
              className={cn(
                "px-5 py-5 sm:px-6",
                index >= 2 && "border-t border-border md:border-t-0",
              )}
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/50">
                0{index + 1}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-foreground">
                {value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              From scattered notes to a{" "}
              <span className="font-serif font-normal italic text-electric">
                reviewable draft
              </span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              A deliberate workflow instead of a single prompt. You stay in
              control of the outline and every section.
            </p>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground lg:flex">
            <span className="h-px w-10 bg-primary/40" />
            Four checkpoints
          </div>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-12">
          {STEPS.map((step, index) => (
            <Card
              key={step.title}
              className={cn(
                "group relative overflow-hidden border-border bg-card/40 p-1",
                step.span,
              )}
            >
              <div className="relative h-full rounded-sm p-5 sm:p-6">
                <span className="pointer-events-none absolute -right-1 -top-5 font-display text-[6rem] font-bold leading-none tracking-[-0.08em] text-foreground/[0.035] transition-colors duration-500 group-hover:text-primary/[0.08]">
                  0{index + 1}
                </span>
                <div className="relative flex items-center justify-between">
                  <span className={cn("icon-tile h-11 w-11", step.tone)}>
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                    FIG. 0{index + 1}
                  </span>
                </div>
                <h3 className="relative mt-6 text-base font-semibold tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-[hsl(var(--ink)/0.42)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-8 lg:py-24">
          <div>
            <p className="eyebrow">Template fidelity</p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              The format is not a{" "}
              <span className="font-serif font-normal italic text-primary">
                suggestion.
              </span>
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Scribe opens the DOCX you upload, keeps its page setup and styles,
              and writes into its structure. Tables stay tables. Figure spaces
              stay reserved. Static sections stay untouched.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "Page size, margins, and section breaks",
                "Heading styles, numbering, and spacing",
                "Title page fields and declaration placeholders",
                "Content tables split across continuation pages",
                "Figure captions and reserved image areas",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-foreground/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </div>
              ))}
            </div>

            <Button asChild variant="outline" className="mt-8">
              <Link to="/templates">
                See how templates work <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-primary/[0.06] blur-2xl" />
            <div className="paper-surface paper-sheet corner-marks relative overflow-hidden rounded-lg p-1">
              <div className="border border-border bg-transparent">
                <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Format receipt / FIG. 02
                    </p>
                    <p className="mt-1 text-sm font-semibold">RVCE_Synopsis.docx</p>
                  </div>
                  <Badge variant="success">
                    <Lock className="h-3 w-3" /> Template locked
                  </Badge>
                </div>
                <div className="divide-y divide-border">
                  {FORMAT_ROWS.map((row, index) => (
                    <div key={row.label} className="flex items-center gap-3 px-5 py-3">
                      <span className="font-mono text-[9px] text-muted-foreground/50">
                        0{index + 1}
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-muted/60 text-primary">
                        <row.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="w-20 shrink-0 text-xs font-medium text-foreground/70">
                        {row.label}
                      </span>
                      <span className="flex-1 text-xs text-muted-foreground">
                        {row.value}
                      </span>
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    </div>
                  ))}
                </div>
                <div className="border-t border-border px-5 py-4">
                  <div className="flex items-center gap-2 border border-dashed border-border bg-muted/30 p-3">
                    <div className="flex h-9 w-9 items-center justify-center border border-border bg-coral/10 text-coral">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Figure 1 · reserved
                      </p>
                      <p className="text-[11px] text-foreground/70">
                        System architecture image space
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border px-5 py-2.5 font-mono text-[8px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                  <span>Scale 1:1 / measured from DOCX</span>
                  <span>Sheet 02 / 04</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Grounded by design</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Honest AI, not a{" "}
            <span className="font-serif font-normal italic text-coral">
              content vending machine.
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            The generator is built around a simple rule: if your sources do not
            contain a fact, it must not be invented. You will see where
            information is missing.
          </p>
        </div>

        <div className="mt-8 flex items-center gap-3 border-t border-border pt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/55">
          <span>Ground rules</span>
          <span className="h-px flex-1 bg-border" />
          <span>04 guarantees</span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <Card key={feature.title} className="group border-border p-1">
              <div className="h-full rounded-sm p-5">
                <div className="flex items-start justify-between">
                  <span className={cn("icon-tile h-10 w-10", feature.bg, feature.tone)}>
                    <feature.icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/45">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card/25">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Document types</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
                One workflow. Eight formats.
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Start with the format your department actually asks for. Your
              template still decides the final layout.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DOC_TYPES.map((doc, index) => (
              <Link
                key={doc.name}
                to="/templates"
                className="group rounded-md border border-border bg-card/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.045]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center border border-border bg-muted/50 text-primary transition-colors group-hover:border-primary/25 group-hover:bg-primary/10">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/45">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold">{doc.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {doc.desc}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/50">
                    Template-led
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="text-center">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Start free. Upgrade only when you need more.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Student-friendly pricing in INR. No hidden academic add-ons.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Card className="p-1">
            <div className="rounded-[calc(var(--radius)-2px)] p-6">
              <CardHeader className="p-0">
                <CardTitle className="text-lg">Free</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-semibold tracking-[-0.03em] text-foreground">
                    ₹0
                  </span>
                  <span className="text-sm"> / month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-6 space-y-2.5 p-0 text-sm">
                {[
                  "1 project workspace",
                  "3 draft generations per month",
                  "1 custom template",
                  "DOCX export",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-primary/80" /> {item}
                  </div>
                ))}
              </CardContent>
              <Button asChild variant="outline" className="mt-7 w-full">
                <Link to="/signup">Create free account</Link>
              </Button>
            </div>
          </Card>

          <Card className="relative overflow-hidden border-primary/30 p-1 shadow-glow">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="rounded-[calc(var(--radius)-2px)] bg-primary/[0.035] p-6">
              <CardHeader className="p-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Student Pro</CardTitle>
                  <Badge>
                    <Sparkles className="h-3 w-3" /> Most popular
                  </Badge>
                </div>
                <CardDescription>
                  <span className="text-3xl font-semibold tracking-[-0.03em] text-foreground">
                    ₹149
                  </span>
                  <span className="text-sm"> / 30 days</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-6 space-y-2.5 p-0 text-sm">
                {[
                  "Multiple project workspaces",
                  "50 generations per month",
                  "5 custom templates",
                  "DOCX + PDF export",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" /> {item}
                  </div>
                ))}
              </CardContent>
              <Button asChild className="mt-7 w-full">
                <Link to="/pricing">See Pro details</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-t border-border bg-[hsl(var(--ink)/0.42)]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="eyebrow text-center">Questions</p>
          <h2 className="mt-4 text-center text-3xl font-semibold tracking-[-0.04em]">
            Frequently asked questions
          </h2>
          <div className="mt-10 space-y-3">
            {[
              [
                "Is my data used to train AI models?",
                "Your project text is sent to the configured AI provider only to generate your document. We do not claim the provider never retains data — review the privacy notice for details.",
              ],
              [
                "Can I use my college's own template?",
                "Yes. Upload your department's DOCX template. Scribe parses its structure and reuses it across your projects.",
              ],
              [
                "What happens if my sources are incomplete?",
                "The generator inserts visible placeholders instead of inventing experiments, results, or references. You decide what to fill in.",
              ],
              [
                "Is PDF export available?",
                "DOCX export is the primary format. PDF export requires LibreOffice conversion on the server and is available on paid plans when enabled.",
              ],
            ].map(([question, answer], index) => (
              <Card key={question} className="border-border p-1">
                <details className="group rounded-sm p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-[9px] font-normal tracking-[0.14em] text-muted-foreground/50">
                        0{index + 1}
                      </span>
                      {question}
                    </span>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-border text-muted-foreground transition-transform duration-300 group-open:rotate-45 group-open:border-primary/30 group-open:text-primary">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl pl-6 text-sm leading-relaxed text-muted-foreground">
                    {answer}
                  </p>
                </details>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-lg border border-primary/25 bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12 lg:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,hsl(0_0%_100%/0.22),transparent_45%,hsl(var(--electric)/0.16))]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_120%,hsl(0_0%_0%/0.18),transparent_50%)]" />
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 border border-primary-foreground/15" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 border border-primary-foreground/10" />

          <div className="relative mb-8 flex items-center justify-between border-b border-primary-foreground/20 pb-3 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">
            <span>FIG. 04 / Submission</span>
            <span>Sheet 04 / 04</span>
          </div>

          <p className="relative font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            Your next submission
          </p>
          <h2 className="relative mx-auto mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl lg:text-5xl">
            Build your project report with a{" "}
            <span className="font-serif font-normal italic">clear conscience.</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm text-primary-foreground/75">
            Start with the free tier. Keep your sources, outline, and edits in
            one place.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="relative mt-7 gap-2 border-primary-foreground/10 bg-[hsl(var(--ink))] text-foreground hover:bg-[hsl(var(--ink)/0.9)]"
          >
            <Link to="/signup">
              Create your first project <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
