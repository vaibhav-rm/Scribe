/// <reference types="vite/client" />

import { useAuth } from "./useAuth";
import { useCallback, useEffect, useRef } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export function useApi() {
  const { token } = useAuth();

  // Keep the token in a ref so `fetchJson` stays referentially stable across
  // Supabase token refreshes. Otherwise every query/callback that depends on it
  // would be recreated (reloading editors and discarding unsaved edits).
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const fetchJson = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      // Never set a JSON content-type on multipart uploads: the browser must
      // add its own boundary. Callers can still override headers explicitly.
      const isFormData =
        typeof FormData !== "undefined" && options.body instanceof FormData;

      const headers: Record<string, string> = {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...((options.headers as Record<string, string>) || {}),
      };
      const authToken = tokenRef.current;
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      return fetch(`${API_URL}${path}`, { ...options, headers });
    },
    [],
  );

  return { fetchJson, API_URL };
}
