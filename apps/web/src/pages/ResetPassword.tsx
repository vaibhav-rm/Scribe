"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getSupabase, useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { AuthShell } from "@/components/layout/AuthShell";
import { ArrowLeft, Mail } from "lucide-react";

const requestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const updateSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword, updatePassword } = useAuth();
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // A recovery link signs the user in with a temporary session. In that case
  // show the "choose a new password" form instead of the request form.
  const [recovery, setRecovery] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery")
    );
  });

  const requestForm = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
  });
  const updateForm = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
  });

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let active = true;
    void getSupabase()
      .then((supabase) => {
        if (!active) return;
        const { data } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") setRecovery(true);
        });
        subscription = data.subscription;
      })
      .catch(() => {
        // Missing Supabase configuration is surfaced when the user submits.
      });
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const onRequest = async (data: z.infer<typeof requestSchema>) => {
    setError("");
    setSubmitting(true);
    try {
      const { error: err } = await resetPassword(data.email);
      if (err) {
        setError(err.message || "Failed to send reset email");
        toast.error(err.message || "Failed to send reset email");
        return;
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdate = async (data: z.infer<typeof updateSchema>) => {
    setError("");
    setSubmitting(true);
    try {
      const { error: err } = await updatePassword(data.password);
      if (err) {
        setError(err.message || "Failed to update password");
        toast.error(err.message || "Failed to update password");
        return;
      }
      toast.success("Password updated. You can now sign in.");
      navigate("/app");
    } finally {
      setSubmitting(false);
    }
  };

  if (recovery) {
    return (
      <AuthShell>
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Set a new password</CardTitle>
            <CardDescription>
              Choose a new password for your Scribe account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={updateForm.handleSubmit(onUpdate)}
              className="space-y-4"
            >
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  {...updateForm.register("password")}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  disabled={submitting}
                />
                {updateForm.formState.errors.password && (
                  <span className="text-xs text-destructive">
                    {updateForm.formState.errors.password.message}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  {...updateForm.register("confirmPassword")}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  disabled={submitting}
                />
                {updateForm.formState.errors.confirmPassword && (
                  <span className="text-xs text-destructive">
                    {updateForm.formState.errors.confirmPassword.message}
                  </span>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (sent) {
    return (
      <AuthShell>
        <Card className="w-full text-center">
          <CardContent className="p-8">
            <Mail className="mx-auto mb-3 h-10 w-10 text-primary" />
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription className="mt-2">
              A password-reset link has been sent if an account exists for that
              address.
            </CardDescription>
          </CardContent>
          <CardFooter className="pb-6">
            <Button onClick={() => navigate("/login")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>
            We&rsquo;ll send a reset link to your email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={requestForm.handleSubmit(onRequest)}
            className="space-y-4"
          >
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                {...requestForm.register("email")}
                type="email"
                autoComplete="email"
                placeholder="name@college.edu"
                disabled={submitting}
              />
              {requestForm.formState.errors.email && (
                <span className="text-xs text-destructive">
                  {requestForm.formState.errors.email.message}
                </span>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
