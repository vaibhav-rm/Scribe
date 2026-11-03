"use client";

import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/layout/Brand";

const links = [
  { to: "/templates", label: "Templates" },
  { to: "/pricing", label: "Pricing" },
  { to: "/#how-it-works", label: "How it works" },
];

export function PublicHeader() {
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) =>
              link.to.includes("#") ? (
                <Link
                  key={link.to}
                  to={link.to}
                  className="rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground"
                >
                  {link.label}
                </Link>
              ) : (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      "relative rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.label}
                      {isActive && (
                        <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-[1px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.9)]" />
                      )}
                    </>
                  )}
                </NavLink>
              ),
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 border border-border bg-secondary/50 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-[1px] bg-primary" />
            Template-first
          </span>
          {isAuthenticated ? (
            <Button asChild size="sm">
              <Link to="/app">
                Open dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                asChild
              >
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/signup">
                  Get started <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-border bg-background/95 px-4 py-4 backdrop-blur-xl md:hidden">
          <nav className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block rounded-sm px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            {isAuthenticated ? (
              <Button asChild>
                <Link to="/app">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Create an account</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-[hsl(var(--ink)/0.55)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 border-b border-border px-4 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60 sm:px-6 lg:px-8">
        <span>Scribe / Archival drafting system</span>
        <span>Sheet 04 / 04</span>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <Brand />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Academic documents that respect the brief, the sources, and the
              exact template your college gave you.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Private storage · signed downloads
            </div>
          </div>
          <div className="md:col-span-2">
            <h4 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Product
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/templates" className="transition-colors hover:text-primary">
                  Template library
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="transition-colors hover:text-primary">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/signup" className="transition-colors hover:text-primary">
                  Create an account
                </Link>
              </li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <h4 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Legal
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/privacy" className="transition-colors hover:text-primary">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="transition-colors hover:text-primary">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/acceptable-use" className="transition-colors hover:text-primary">
                  Acceptable use
                </Link>
              </li>
            </ul>
          </div>
          <div className="md:col-span-4">
            <h4 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Built for
            </h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-primary/80" /> Synopsis & proposal
              </li>
              <li className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-electric/80" /> Final-year report
              </li>
              <li className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-violet/80" /> SRS & system design
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-coral/80" /> Research paper
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Scribe. Not affiliated with any college or university.</p>
          <p>Always follow your institution&rsquo;s academic-integrity policy.</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell flex min-h-screen flex-col">
      <PublicHeader />
      <main className="page-reveal flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
