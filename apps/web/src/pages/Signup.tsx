"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
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

const schema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Please enter your name")
      .max(100, "Name is too long"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setError("");
    setSubmitting(true);
    try {
      const { error: err, needsVerification } = await signUp(
        data.email,
        data.password,
        data.displayName,
      );
      if (err) {
        setError(err.message || "Signup failed");
        toast.error(err.message || "Signup failed");
        return;
      }
      if (needsVerification) {
        toast.success("Account created. Check your email to verify it.");
        navigate("/login");
      } else {
        toast.success("Account created. Welcome to Scribe.");
        navigate("/app");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>
            Start generating academic documents with Scribe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="display-name">Full name</Label>
              <Input
                id="display-name"
                {...register("displayName")}
                autoComplete="name"
                placeholder="e.g. Ananya Sharma"
                disabled={submitting}
              />
              {errors.displayName && (
                <span className="text-xs text-destructive">
                  {errors.displayName.message}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="name@college.edu"
                disabled={submitting}
              />
              {errors.email && (
                <span className="text-xs text-destructive">
                  {errors.email.message}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                {...register("password")}
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                disabled={submitting}
              />
              {errors.password && (
                <span className="text-xs text-destructive">
                  {errors.password.message}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                {...register("confirmPassword")}
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                disabled={submitting}
              />
              {errors.confirmPassword && (
                <span className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By creating an account you agree to our{" "}
              <Link to="/terms" className="text-primary hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
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
