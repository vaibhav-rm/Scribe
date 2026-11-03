/// <reference types="vite/client" />

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

let sbPromise: Promise<SupabaseClient> | null = null;

/**
 * Load Supabase only when auth is actually needed. The public landing page
 * should not pay for the SDK before its first paint.
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  if (!sbPromise) {
    sbPromise = import("@supabase/supabase-js")
      .then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey))
      .catch((error) => {
        sbPromise = null;
        throw error;
      });
  }
  return sbPromise;
}

export type UserProfile = {
  id: string;
  email: string | null;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: Error | null; needsVerification: boolean }>;
  updateProfile: (displayName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  isAuthenticated: boolean;
};

/**
 * The profiles table does not store the email address (it lives in
 * auth.users), so build a complete profile object from the auth user as a
 * fallback. Without this, a valid session could look unauthenticated whenever
 * the profile row is missing.
 */
function fallbackProfile(session: Session): UserProfile {
  const authUser = session.user;
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    role: (authUser.app_metadata?.role as string | undefined) ?? "user",
    display_name:
      (authUser.user_metadata?.display_name as string | undefined) ?? null,
    avatar_url:
      (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
  };
}

async function fetchProfile(session: Session): Promise<UserProfile> {
  const fallback = fallbackProfile(session);
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, display_name, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !data) return fallback;

    const row = data as {
      id: string;
      role: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };

    return {
      id: row.id,
      email: session.user.email ?? null,
      role: row.role ?? fallback.role,
      display_name: row.display_name ?? fallback.display_name,
      avatar_url: row.avatar_url ?? fallback.avatar_url,
    };
  } catch {
    return fallback;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const applySession = (session: Session | null) => {
      if (!active) return;
      if (!session?.user) {
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      // Render the app from the session immediately. The profile row is only
      // used for display/role data, so waiting for it made every cold load
      // feel much slower than necessary.
      setToken(session.access_token);
      setUser((previous) =>
        previous?.id === session.user.id ? previous : fallbackProfile(session),
      );
      setLoading(false);

      void fetchProfile(session).then((profile) => {
        if (active) setUser(profile);
      });
    };

    void getSupabase()
      .then((supabase) => {
        if (!active) return;
        void supabase.auth
          .getSession()
          .then(({ data }) => applySession(data.session))
          .catch(() => {
            if (active) setLoading(false);
          });

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_OUT" || !session) {
            setUser(null);
            setToken(null);
            setLoading(false);
            return;
          }

          if (
            event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED" ||
            event === "USER_UPDATED" ||
            event === "INITIAL_SESSION"
          ) {
            // Defer work so Supabase's auth lock is released first.
            setTimeout(() => {
              void applySession(session);
            }, 0);
          }
        });
        subscription = data.subscription;
      })
      .catch((err) => {
        // Missing configuration should not crash the whole app. The login form
        // will surface the configuration error when the user tries to sign in.
        console.error(err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      // Apply the session synchronously so navigation after sign-in does not hit
      // RequireAuth before the auth state listener has run.
      if (!error && data.session) {
        setToken(data.session.access_token);
        setUser(fallbackProfile(data.session));
        setLoading(false);
        void fetchProfile(data.session).then((profile) => setUser(profile));
      }
      return { error: (error as Error | null) ?? null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      try {
        const supabase = await getSupabase();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: displayName
            ? { data: { display_name: displayName.trim() } }
            : undefined,
        });
        if (error) return { error: error as Error, needsVerification: false };
        if (data.session) {
          // Email confirmation is disabled on this project: the account is
          // usable immediately, so the caller can go straight to the app.
          setToken(data.session.access_token);
          setUser(fallbackProfile(data.session));
          setLoading(false);
          void fetchProfile(data.session).then((profile) => setUser(profile));
          return { error: null, needsVerification: false };
        }
        return { error: null, needsVerification: true };
      } catch (err) {
        return { error: err as Error, needsVerification: false };
      }
    },
    [],
  );

  const updateProfile = useCallback(
    async (displayName: string) => {
      try {
        if (!token) return { error: new Error("You are not signed in") };

        const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ display_name: displayName.trim() }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          return {
            error: new Error(body.message || "Could not update your profile"),
          };
        }

        const body = await res.json();
        setUser((previous) =>
          previous
            ? {
                ...previous,
                display_name:
                  body.profile?.display_name ?? displayName.trim(),
                avatar_url: body.profile?.avatar_url ?? previous.avatar_url,
                role: body.profile?.role ?? previous.role,
              }
            : previous,
        );
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [token],
  );

  const signOut = useCallback(async () => {
    try {
      const supabase = await getSupabase();
      await supabase.auth.signOut();
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
      setToken(null);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      return { error: (error as Error | null) ?? null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      return { error: (error as Error | null) ?? null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      signIn,
      signUp,
      updateProfile,
      signOut,
      resetPassword,
      updatePassword,
      isAuthenticated: !!token,
    }),
    [
      user,
      token,
      loading,
      signIn,
      signUp,
      updateProfile,
      signOut,
      resetPassword,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
