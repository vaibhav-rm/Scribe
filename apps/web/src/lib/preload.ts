const preloaders: Record<string, () => Promise<unknown>> = {
  "/app": () => import("@/pages/dashboard/Dashboard"),
  "/app/projects": () => import("@/pages/projects/Projects"),
  "/app/documents": () => import("@/pages/documents/Documents"),
  "/app/templates": () => import("@/pages/templates/Templates"),
  "/app/generate": () => import("@/pages/generation/Generation"),
  "/app/billing": () => import("@/pages/billing/Billing"),
  "/app/settings": () => import("@/pages/settings/Settings"),
  "/app/admin": () => import("@/pages/admin/Admin"),
};

const preloaded = new Set<string>();

/**
 * Warm the route chunk when a user hovers or focuses a navigation item. The
 * lazy route still owns the render; this only removes the network wait from
 * the click.
 */
export function preloadRoute(href: string): void {
  if (preloaded.has(href)) return;
  const loader = preloaders[href];
  if (!loader) return;
  preloaded.add(href);
  void loader().catch(() => {
    preloaded.delete(href);
  });
}
