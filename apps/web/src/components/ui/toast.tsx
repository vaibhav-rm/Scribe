/// <reference types="vite/client" />

import { Toaster, toast, type ExternalToast } from "sonner";

export { toast, type ExternalToast };
export function ToastProvider() {
  return <Toaster richColors position="bottom-right" />;
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
