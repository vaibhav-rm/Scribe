/// <reference types="vite/client" />

import { Toaster, toast, type ExternalToast } from "sonner";

export { toast, type ExternalToast };

export function ToastProvider() {
  return (
    <Toaster
      theme="dark"
      richColors
      position="bottom-right"
      toastOptions={{
        style: {
          background: "hsl(240 18% 8%)",
          border: "1px solid hsl(0 0% 100% / 0.1)",
          color: "hsl(60 18% 94%)",
          borderRadius: "14px",
        },
      }}
    />
  );
}

export function useToast() {
  return { toast };
}

declare global {
  interface Window {
    __projectscribe_toast?: (props: ExternalToast) => string | number;
  }
}

export function showToast(props: ExternalToast) {
  if (typeof window !== "undefined" && (window as any).__projectscribe_toast) {
    return (window as any).__projectscribe_toast(props);
  }
  return null;
}
