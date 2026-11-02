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
import { Brand } from "@/components/layout/PublicLayout";

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
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Workspace
      </p>
      {items.map((item) => {
        const active = navItemActive(location.pathname, item.href);
        return (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4",
                active ? "" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {item.label}
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
      // Let auth state settle so an unsaved-edit guard on the current page
      // does not block the sign-out redirect.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      navigate("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="border-t border-input p-3">
      <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {user.role === "admin" ? (
              <>
                <ShieldCheck className="h-3 w-3" /> Administrator
              </>
            ) : (
              user.email || "Student account"
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
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
      <div className="flex h-16 items-center justify-between border-b border-input px-4">
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
      <SidebarNav isAdmin={isAdmin} onNavigate={() => setSidebarOpen(false)} />
      <UserCard />
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-input bg-card md:flex">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden",
          sidebarOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!sidebarOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity",
            sidebarOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 flex-col border-r border-input bg-card shadow-xl transition-transform duration-200",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {sidebar}
        </aside>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-input bg-background/80 px-4 backdrop-blur sm:px-6">
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
              <h1 className="truncate text-sm font-semibold text-foreground">
                {title}
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Scribe workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
