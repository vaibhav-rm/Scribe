import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { LandingPage } from "@/pages/Landing";
import { LoginPage } from "@/pages/Login";
import { SignupPage } from "@/pages/Signup";
import { ResetPasswordPage } from "@/pages/ResetPassword";
import { PublicTemplatesPage } from "@/pages/PublicTemplates";
import { PricingPage } from "@/pages/Pricing";
import { PrivacyPage, TermsPage, AcceptableUsePage } from "@/pages/Legal";
import { DashboardPage } from "@/pages/dashboard/Dashboard";
import { ProjectsPage } from "@/pages/projects/Projects";
import { ProjectDetailPage } from "@/pages/projects/ProjectDetail";
import { TemplatesPage, TemplateDetailPage } from "@/pages/templates/Templates";
import { GenerationPage } from "@/pages/generation/Generation";
import { DocumentPage } from "@/pages/documents/Document";
import { DocumentsPage } from "@/pages/documents/Documents";
import { BillingPage } from "@/pages/billing/Billing";
import { SettingsPage } from "@/pages/settings/Settings";
import { AdminPage } from "@/pages/admin/Admin";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          S
        </span>
        <span className="text-sm text-muted-foreground">Loading your workspace…</span>
      </div>
    </div>
  );
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
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  {
    path: "/auth/reset-password",
    element: <ResetPasswordPage />,
  },
  { path: "/templates", element: <PublicTemplatesPage /> },
  { path: "/pricing", element: <PricingPage /> },
  { path: "/privacy", element: <PrivacyPage /> },
  { path: "/terms", element: <TermsPage /> },
  { path: "/acceptable-use", element: <AcceptableUsePage /> },
  // Protected app
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:id", element: <ProjectDetailPage /> },
      { path: "templates", element: <TemplatesPage /> },
      { path: "templates/:id", element: <TemplateDetailPage /> },
      { path: "generate", element: <GenerationPage /> },
      { path: "generations/:id", element: <GenerationPage /> },
      { path: "documents", element: <DocumentsPage /> },
      { path: "documents/:id", element: <DocumentPage /> },
      { path: "billing", element: <BillingPage /> },
      { path: "settings", element: <SettingsPage /> },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminPage />
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
