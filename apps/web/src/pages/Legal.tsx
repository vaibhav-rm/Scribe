"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/PublicLayout";

function LegalShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            {children}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" description="Last updated: October 2026">
      <p>
        Scribe ("we", "us") helps college students generate academic
        documents. This notice describes how we handle your data.
      </p>
      <h4 className="text-sm font-semibold text-foreground">
        Third-party AI processing
      </h4>
      <p>
        Document generation uses a large-language-model provider (initially
        Google Gemini). Your project text, extracted resources, and generated
        sections are sent to that provider to produce output. We do not verify
        that the provider never retains data, and you should assume inputs may be
        processed and temporarily retained by the AI provider per its own terms.
        Do not submit confidential or personal data you are not comfortable
        sharing with an AI provider.
      </p>
      <h4 className="text-sm font-semibold text-foreground">Storage</h4>
      <p>
        Uploaded files and generated documents are stored in private Supabase
        Storage buckets tied to your account. Other users cannot access them.
        Generated documents are retained until you delete your project or
        account, subject to backup and payment-obligation retention.
      </p>
      <h4 className="text-sm font-semibold text-foreground">Your rights</h4>
      <p>
        You may delete projects and their associated documents at any time from
        the project settings. You may also request account deletion, which
        removes your profile and personal data; anonymized usage records may be
        retained for billing and abuse-prevention purposes.
      </p>
      <div className="pt-4">
        <Button asChild>
          <a href="mailto:support@scribe.example">Contact us</a>
        </Button>
      </div>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      description="Last updated: October 2026"
    >
      <p>
        By using Scribe you agree to these terms. The service is intended
        for currently enrolled college students.
      </p>
      <h4 className="text-sm font-semibold text-foreground">
        Academic integrity
      </h4>
      <p>
        Scribe is a drafting and formatting aid. You remain responsible
        for ensuring that generated documents are accurate, truthful, and
        compliant with your institution's academic-integrity policy. Do not
        fabricate experiments, results, references, or metrics.
      </p>
      <h4 className="text-sm font-semibold text-foreground">Eligibility</h4>
      <p>
        Free tier: ₹0, one active project, three draft generations per month.
        Student Pro: ₹149 for a 30-day access pass. Prices are initial product
        defaults.
      </p>
      <h4 className="text-sm font-semibold text-foreground">Payments</h4>
      <p>
        Subscriptions are processed through Razorpay. Entitlements are granted
        only after verified payment events; a frontend claim of payment is never
        sufficient.
      </p>
    </LegalShell>
  );
}

export function AcceptableUsePage() {
  return (
    <LegalShell
      title="Acceptable Use Policy"
      description="Last updated: October 2026"
    >
      <h4 className="text-sm font-semibold text-foreground">Do not</h4>
      <ul className="list-inside list-disc space-y-2">
        <li>Upload content you do not have rights to share.</li>
        <li>Submit templates you do not have permission to distribute.</li>
        <li>Attempt to reverse-engineer, scrape, or abuse the API.</li>
        <li>Execute or upload macros, scripts, or executable files.</li>
        <li>Fabricate results, references, or metrics in generated documents.</li>
      </ul>
      <h4 className="text-sm font-semibold text-foreground">Enforcement</h4>
      <p>
        Violations may result in content removal, suspension, or termination of
        your account. Templates submitted to the public library require explicit
        confirmation that you have permission to share them and are reviewed
        before verification.
      </p>
    </LegalShell>
  );
}
