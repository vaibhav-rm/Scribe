import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageLoader } from "@/components/ui/loader";

const AppLayout = lazy(() =>
  import("@/components/layout/AppLayout").then((module) => ({
    default: module.AppLayout,
  })),
);
const LandingPage = lazy(() =>
  import("@/pages/Landing").then((module) => ({
    default: module.LandingPage,
  })),
);
const LoginPage = lazy(() =>
  import("@/pages/Login").then((module) => ({ default: module.LoginPage })),
);
const SignupPage = lazy(() =>
  import("@/pages/Signup").then((module) => ({ default: module.SignupPage })),
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/ResetPassword").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const PublicTemplatesPage = lazy(() =>
  import("@/pages/PublicTemplates").then((module) => ({
    default: module.PublicTemplatesPage,
  })),
);
const PricingPage = lazy(() =>
  import("@/pages/Pricing").then((module) => ({
    default: module.PricingPage,
  })),
);
const PrivacyPage = lazy(() =>
  import("@/pages/Legal").then((module) => ({ default: module.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import("@/pages/Legal").then((module) => ({ default: module.TermsPage })),
);
const AcceptableUsePage = lazy(() =>
  import("@/pages/Legal").then((module) => ({
    default: module.AcceptableUsePage,
  })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard/Dashboard").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ProjectsPage = lazy(() =>
  import("@/pages/projects/Projects").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const ProjectDetailPage = lazy(() =>
  import("@/pages/projects/ProjectDetail").then((module) => ({
    default: module.ProjectDetailPage,
  })),
);
const TemplatesPage = lazy(() =>
  import("@/pages/templates/Templates").then((module) => ({
    default: module.TemplatesPage,
  })),
);
const TemplateDetailPage = lazy(() =>
  import("@/pages/templates/Templates").then((module) => ({
    default: module.TemplateDetailPage,
  })),
);
const GenerationPage = lazy(() =>
  import("@/pages/generation/Generation").then((module) => ({
    default: module.GenerationPage,
  })),
);
const DocumentPage = lazy(() =>
  import("@/pages/documents/Document").then((module) => ({
    default: module.DocumentPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("@/pages/documents/Documents").then((module) => ({
    default: module.DocumentsPage,
  })),
);
const BillingPage = lazy(() =>
  import("@/pages/billing/Billing").then((module) => ({
    default: module.BillingPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings/Settings").then((module) => ({
    default: module.SettingsPage,
  })),
);
const AdminPage = lazy(() =>
  import("@/pages/admin/Admin").then((module) => ({
    default: module.AdminPage,
  })),
);

function RouteBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader compact label="Loading page" />}>
      {children}
    </Suspense>
  );
}

function FullPageLoader() {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center">
      <PageLoader label="Opening your workspace" />
    </div>
  );
}

function AppShellBoundary({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<FullPageLoader />}>{children}</Suspense>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") return <Navigate to="/app" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  // Public
  {
    path: "/",
    element: (
      <RouteBoundary>
        <LandingPage />
      </RouteBoundary>
    ),
  },
  {
    path: "/login",
    element: (
      <RouteBoundary>
        <LoginPage />
      </RouteBoundary>
    ),
  },
  {
    path: "/signup",
    element: (
      <RouteBoundary>
        <SignupPage />
      </RouteBoundary>
    ),
  },
  {
    path: "/auth/reset-password",
    element: (
      <RouteBoundary>
        <ResetPasswordPage />
      </RouteBoundary>
    ),
  },
  {
    path: "/templates",
    element: (
      <RouteBoundary>
        <PublicTemplatesPage />
      </RouteBoundary>
    ),
  },
  {
    path: "/pricing",
    element: (
      <RouteBoundary>
        <PricingPage />
      </RouteBoundary>
    ),
  },
  {
    path: "/privacy",
    element: (
      <RouteBoundary>
        <PrivacyPage />
      </RouteBoundary>
    ),
  },
  {
    path: "/terms",
    element: (
      <RouteBoundary>
        <TermsPage />
      </RouteBoundary>
    ),
  },
  {
    path: "/acceptable-use",
    element: (
      <RouteBoundary>
        <AcceptableUsePage />
      </RouteBoundary>
    ),
  },
  // Protected app
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppShellBoundary>
          <AppLayout />
        </AppShellBoundary>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <RouteBoundary>
            <DashboardPage />
          </RouteBoundary>
        ),
      },
      {
        path: "projects",
        element: (
          <RouteBoundary>
            <ProjectsPage />
          </RouteBoundary>
        ),
      },
      {
        path: "projects/:id",
        element: (
          <RouteBoundary>
            <ProjectDetailPage />
          </RouteBoundary>
        ),
      },
      {
        path: "templates",
        element: (
          <RouteBoundary>
            <TemplatesPage />
          </RouteBoundary>
        ),
      },
      {
        path: "templates/:id",
        element: (
          <RouteBoundary>
            <TemplateDetailPage />
          </RouteBoundary>
        ),
      },
      {
        path: "generate",
        element: (
          <RouteBoundary>
            <GenerationPage />
          </RouteBoundary>
        ),
      },
      {
        path: "generations/:id",
        element: (
          <RouteBoundary>
            <GenerationPage />
          </RouteBoundary>
        ),
      },
      {
        path: "documents",
        element: (
          <RouteBoundary>
            <DocumentsPage />
          </RouteBoundary>
        ),
      },
      {
        path: "documents/:id",
        element: (
          <RouteBoundary>
            <DocumentPage />
          </RouteBoundary>
        ),
      },
      {
        path: "billing",
        element: (
          <RouteBoundary>
            <BillingPage />
          </RouteBoundary>
        ),
      },
      {
        path: "settings",
        element: (
          <RouteBoundary>
            <SettingsPage />
          </RouteBoundary>
        ),
      },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <RouteBoundary>
              <AdminPage />
            </RouteBoundary>
          </RequireAdmin>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
