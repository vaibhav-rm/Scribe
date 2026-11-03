"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  BadgeCheck,
  CreditCard,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export function SettingsPage() {
  const { user, updateProfile, updatePassword, signOut } = useAuth();
  const { fetchJson } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setName(user?.display_name ?? "");
  }, [user?.display_name]);

  const usageQ = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetchJson("/api/v1/billing/usage");
      if (!res.ok) throw new Error("Failed to load plan");
      return res.json();
    },
  });

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Please enter at least 2 characters");
      return;
    }
    setSavingName(true);
    try {
      const { error } = await updateProfile(name);
      if (error) {
        toast.error(error.message || "Could not update your profile");
        return;
      }
      toast.success("Profile updated");
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        toast.error(error.message || "Could not update your password");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      queryClient.clear();
      navigate("/login");
    } finally {
      setSigningOut(false);
    }
  };

  const initials =
    (user?.display_name || user?.email || "U")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Account settings"
        description="Manage your profile, password, and session."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            This name appears in your workspace and on the sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-sm">
              {initials}
            </span>
            <div>
              <p className="font-semibold">{user?.display_name || "Student"}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> {user?.email || "No email"}
              </p>
              <div className="mt-2 flex gap-2">
                <Badge variant={user?.role === "admin" ? "default" : "secondary"}>
                  {user?.role === "admin" ? (
                    <>
                      <ShieldCheck className="mr-1 h-3 w-3" /> Administrator
                    </>
                  ) : (
                    <>
                      <UserRound className="mr-1 h-3 w-3" /> Student
                    </>
                  )}
                </Badge>
                {usageQ.data?.plan === "pro" && usageQ.data?.planActive ? (
                  <Badge variant="success">
                    <BadgeCheck className="mr-1 h-3 w-3" /> Student Pro
                  </Badge>
                ) : (
                  <Badge variant="outline">Free plan</Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <form onSubmit={saveName} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="Your name"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingName || name.trim() === (user?.display_name ?? "")}
              >
                {savingName ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>
            Use at least 8 characters. You will stay signed in on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                disabled={savingPassword || !password || !confirmPassword}
              >
                {savingPassword ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan &amp; billing</CardTitle>
          <CardDescription>
            Your current entitlement and usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {usageQ.isLoading ? (
            <Skeleton className="h-10 w-48" />
          ) : (
            <div className="text-sm">
              <p className="font-semibold">
                {usageQ.data?.plan === "pro" ? "Student Pro" : "Free plan"}
              </p>
              <p className="text-muted-foreground">
                {usageQ.data?.usage?.projects ?? 0} /{" "}
                {usageQ.data?.limits?.maxProjects ?? 1} active projects ·{" "}
                {usageQ.data?.usage?.generationsThisMonth ?? 0} /{" "}
                {usageQ.data?.limits?.maxGenerationsPerMonth ?? 3} generations
                this month
              </p>
            </div>
          )}
          <Button asChild variant="outline">
            <Link to="/app/billing">
              <CreditCard className="mr-2 h-4 w-4" /> Manage billing
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
          <CardDescription>
            Sign out of this browser. Your projects and documents stay saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
