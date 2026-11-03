"use client";

import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Check, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/hooks/useAuth";

const FREE_FEATURES = [
  "1 project workspace",
  "3 initial draft generations per month",
  "1 custom template",
  "1 section regeneration per month",
  "DOCX export",
];

const PRO_FEATURES = [
  "10 project workspaces",
  "50 generations per month",
  "5 custom templates",
  "20 section regenerations per month",
  "DOCX + PDF export",
  "Standard processing priority",
];

export function PricingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
            <Sparkles className="h-3 w-3" /> Student pricing
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Pricing</h1>
          <p className="mt-3 text-muted-foreground">
            Simple, student-friendly pricing in INR. Start free, upgrade when you
            need more projects and generations.
          </p>
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/55">
            <span>Sheet 03 / pricing</span>
            <span className="h-px flex-1 bg-border" />
            <span>INR / 30 days</span>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">Free</CardTitle>
              <CardDescription>
                <span className="text-3xl font-semibold tracking-[-0.03em] text-foreground">₹0</span>
                <span className="text-sm"> / month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {FREE_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {feature}
                </div>
              ))}
            </CardContent>
            <CardFooter className="pt-6">
              <Button asChild variant="outline" className="w-full">
                <Link to={isAuthenticated ? "/app" : "/signup"}>
                  {isAuthenticated ? "Go to dashboard" : "Get started free"}
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="corner-marks flex flex-col border-primary/40 bg-primary/5 ring-1 ring-primary/30">
            <div className="flex items-center justify-between rounded-t-sm bg-primary/10 px-6 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Most popular
              </span>
              <Badge variant="secondary">30-day pass</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-xl">Student Pro</CardTitle>
              <CardDescription>
                <span className="text-3xl font-semibold tracking-[-0.03em] text-foreground">₹149</span>
                <span className="text-sm"> / 30 days</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {PRO_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </div>
              ))}
            </CardContent>
            <CardFooter className="pt-6">
              <Button asChild className="w-full">
                <Link to={isAuthenticated ? "/app/billing" : "/signup"}>
                  {isAuthenticated ? "Manage access" : "Create account to upgrade"}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Separator className="my-14" />

        <div className="rounded-md border border-border bg-muted/40 p-8 text-center">
          <h3 className="text-lg font-semibold">Payments in INR</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Student Pro is a one-time 30-day access pass processed through
            Razorpay. There is no automatic renewal or stored card. Paid access
            is granted only after a verified payment — never from a frontend
            claim alone.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Pricing shown is an initial product default, not a guaranteed final
              price.
            </span>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
