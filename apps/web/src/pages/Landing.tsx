"use client";

import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  GitBranch,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
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
  },
  {
    icon: LayoutTemplate,
    title: "Choose or upload a template",
    body: "Bring your college's DOCX format. Scribe reads its structure and keeps your sections in order.",
  },
  {
    icon: Wand2,
    title: "Review the outline",
    body: "The AI proposes a section plan built from your sources. You approve it before a single word is generated.",
  },
  {
    icon: FileText,
    title: "Generate, edit, export",
    body: "Write section by section, edit inline, restore earlier versions, and download a formatted DOCX.",
  },
];

export function LandingPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-input">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.16),transparent_58%)]" />
        <div className="pointer-events-none absolute -right-32 top-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div>
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
              <Sparkles className="h-3 w-3" /> Built for Indian college projects
            </Badge>
            <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Your project report,
              <span className="block text-primary">formatted like your college wants.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Scribe turns your notes, files, and repo into a template-aware
              academic document. It plans an outline you can review, grounds every
              section in your sources, and never invents results or references.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to="/signup">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/templates">Browse templates</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> No invented results
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Visible placeholders
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> DOCX export
              </span>
            </div>
          </div>

          {/* Product preview */}
          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary/20 via-transparent to-primary/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-input bg-card shadow-lift">
              <div className="flex items-center justify-between border-b border-input px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Smart Irrigation System · Synopsis
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Outline approved</p>
                    <p className="text-xs text-muted-foreground">
                      8 sections · 4 sources used
                    </p>
                  </div>
                  <Badge variant="success">Ready</Badge>
                </div>
                <div className="space-y-2">
                  {[
                    ["1", "Introduction", true],
                    ["2", "Problem Statement", true],
                    ["3", "Literature Review", true],
                    ["4", "Methodology", true],
                    ["5", "Implementation", true],
                    ["6", "Results & Discussion", false],
                  ].map(([n, label, done]) => (
                    <div
                      key={n as string}
                      className="flex items-center gap-3 rounded-lg border border-input bg-background/60 px-3 py-2"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {n}
                      </span>
                      <span className="flex-1 text-xs font-medium">{label}</span>
                      {done ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">queued</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                  Missing facts become visible <code>[PLACEHOLDER]</code> markers.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-input bg-muted/30">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            ["8", "document types"],
            ["DOCX", "template-aware export"],
            ["3 / month", "free draft generations"],
            ["₹0", "to start"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            From scattered notes to a reviewable draft
          </h2>
          <p className="mt-3 text-muted-foreground">
            A deliberate workflow instead of a single prompt. You stay in control
            of the outline and every section.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Card key={step.title} className="relative">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-sm font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-input bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Grounded by design
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Honest AI, not a content vending machine
              </h2>
              <p className="mt-3 max-w-lg text-muted-foreground">
                The generator is built around a simple rule: if your sources do
                not contain a fact, it must not be invented. You will see where
                information is missing.
              </p>
              <div className="mt-8 space-y-5">
                {[
                  {
                    icon: BookOpen,
                    title: "Source-grounded sections",
                    body: "Every section is written from the resources you added to that project.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Private by default",
                    body: "Uploads live in private storage. Downloads use short-lived signed URLs.",
                  },
                  {
                    icon: GitBranch,
                    title: "GitHub-aware",
                    body: "Link a public repository and Scribe reads its README and source files.",
                  },
                  {
                    icon: FileText,
                    title: "Version history",
                    body: "Edits, regeneration, and restores are snapshotted so you can go back.",
                  },
                ].map((feature) => (
                  <div key={feature.title} className="flex gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{feature.title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {feature.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {DOC_TYPES.slice(0, 8).map((doc) => (
                <Card key={doc.name} className="bg-background/80">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">{doc.name}</h3>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {doc.desc}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Pricing
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Start free. Upgrade only when you need more.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Student-friendly pricing in INR. No hidden academic add-ons.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Free</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold text-foreground">₹0</span>
                <span className="text-sm"> / month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {[
                "1 project workspace",
                "3 draft generations per month",
                "1 custom template",
                "DOCX export",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-muted-foreground" /> {item}
                </div>
              ))}
            </CardContent>
            <CardContent className="pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link to="/signup">Create free account</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="border-primary/40 bg-primary/5 ring-1 ring-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Student Pro</CardTitle>
                <Badge>Most popular</Badge>
              </div>
              <CardDescription>
                <span className="text-3xl font-bold text-foreground">₹149</span>
                <span className="text-sm"> / 30 days</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {[
                "Multiple project workspaces",
                "50 generations per month",
                "5 custom templates",
                "DOCX + PDF export",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> {item}
                </div>
              ))}
            </CardContent>
            <CardContent className="pt-2">
              <Button asChild className="w-full">
                <Link to="/pricing">See Pro details</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-input bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="mt-10 space-y-4">
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
            ].map(([question, answer]) => (
              <Card key={question}>
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold">{question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {answer}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_55%)]" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <h2 className="relative text-3xl font-bold tracking-tight">
            Build your next project report with a clear conscience.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80">
            Start with the free tier. Keep your sources, outline, and edits in
            one place.
          </p>
          <Button asChild size="lg" variant="secondary" className="relative mt-7 gap-2">
            <Link to="/signup">
              Create your first project <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
