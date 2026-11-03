"use client";

import { useMemo, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  CreditCard,
  File,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  ShieldCheck,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/layout/Brand";
import { preloadRoute } from "@/lib/preload";

const baseNavItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: FileText },
  { href: "/app/documents", label: "Documents", icon: File },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/app/generate", label: "Generate", icon: Sparkles },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
];

const PAGE_TITLES: Array<[RegExp, string]> = [
  [/^\/app$/, "Dashboard"],
  [/^\/app\/projects\/[^/]+$/, "Project"],
  [/^\/app\/projects$/, "Projects"],
  [/^\/app\/documents\/[^/]+$/, "Document editor"],
  [/^\/app\/documents$/, "Documents"],
  [/^\/app\/templates\/[^/]+$/, "Template"],
  [/^\/app\/templates$/, "Templates"],
  [/^\/app\/generations\/[^/]+$/, "Generation"],
  [/^\/app\/generate$/, "Generate a document"],
  [/^\/app\/billing$/, "Billing & usage"],
  [/^\/app\/settings$/, "Account settings"],
  [/^\/app\/admin$/, "Admin"],
];

function navItemActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  return (
    PAGE_TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Dashboard"
  );
}

function SidebarNav({
  isAdmin,
  onNavigate,
}: {
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const items = isAdmin
    ? [...baseNavItems, { href: "/app/admin", label: "Admin", icon: ShieldCheck }]
    : baseNavItems;

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      <p className="px-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
        Workspace
      </p>
      {items.map((item) => {
        const active = navItemActive(location.pathname, item.href);
        return (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            onMouseEnter={() => preloadRoute(item.href)}
            onFocus={() => preloadRoute(item.href)}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary/[0.11] text-foreground ring-1 ring-inset ring-primary/15 before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-primary before:shadow-[0_0_10px_hsl(var(--primary)/0.8)]"
                : "text-muted-foreground hover:bg-white/[0.045] hover:text-foreground",
            )}
          >
            <item.icon
              className={cn(
                "h-[17px] w-[17px] shrink-0 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground/80 group-hover:text-foreground",
              )}
            />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function UserCard() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const label = user.display_name || user.email || "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "U";

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      queryClient.clear();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      navigate("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="border-t border-white/[0.07] p-3">
      <div className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.045]">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--electric)))] text-sm font-bold text-primary-foreground shadow-[0_0_0_1px_hsl(0_0%_100%/0.15)]">
          {initial}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--card))] bg-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            {user.role === "admin" ? (
              <>
                <ShieldCheck className="h-3 w-3 text-primary" /> Administrator
              </>
            ) : (
              user.email || "Student account"
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = user?.role === "admin";
  const title = useMemo(() => pageTitle(location.pathname), [location.pathname]);

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-white/[0.07] px-4">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          className="text-foreground md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-foreground/80">
              Student workspace
            </p>
            <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Private · template-first
            </p>
          </div>
        </div>
      </div>
      <SidebarNav isAdmin={isAdmin} onNavigate={() => setSidebarOpen(false)} />
      <UserCard />
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-[264px] flex-col border-r border-white/[0.07] bg-[hsl(var(--ink)/0.55)] backdrop-blur-xl md:flex">
        {sidebar}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          sidebarOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!sidebarOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300",
            sidebarOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-white/[0.08] bg-[hsl(var(--ink)/0.96)] shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
        </aside>
      </div>

      <div className="app-shell flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-background/55 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Scribe workspace
              </p>
              <h1 className="truncate text-sm font-semibold text-foreground">
                {title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
              <ShieldCheck className="h-3 w-3 text-primary" />
              Private workspace
            </div>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => navigate("/app/generate")}
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">New generation</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="page-reveal mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
