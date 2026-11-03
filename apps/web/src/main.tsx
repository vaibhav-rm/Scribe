import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import "./index.css";

const ToastProvider = React.lazy(() =>
  import("./components/ui/toast").then((module) => ({
    default: module.ToastProvider,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Keep already-loaded workspace data warm so route changes feel instant
      // and do not trigger a burst of identical API requests.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// App renders a data router (<RouterProvider>), so no outer router may wrap it.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <React.Suspense fallback={null}>
          <ToastProvider />
        </React.Suspense>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
