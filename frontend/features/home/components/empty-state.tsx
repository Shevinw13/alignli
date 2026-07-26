"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Upload, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Empty state / hero for the home page.
 * Clean, confident, communicates value instantly.
 */
export function EmptyState() {
  const router = useRouter();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-8 md:p-14">
      {/* Subtle decorative glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-500/[0.04] blur-3xl" />

      <div className="relative flex flex-col items-center text-center max-w-xl mx-auto">
        {/* Hero headline */}
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          Upload resumes. We'll tell you<br className="hidden sm:block" /> who deserves an interview.
        </h1>

        {/* Subheadline */}
        <p className="mt-4 text-base text-gray-500 leading-relaxed max-w-lg">
          Narrowli analyzes every resume against your job description, explains every recommendation, highlights hiring considerations, and generates tailored interview questions — all in under a minute.
        </p>

        {/* Three-step process */}
        <div className="mt-10 grid grid-cols-3 gap-6 w-full">
          <Step
            number="1"
            icon={FileText}
            text="Paste your job description."
          />
          <Step
            number="2"
            icon={Upload}
            text="Upload candidate resumes."
          />
          <Step
            number="3"
            icon={MessageSquare}
            text="Interview with confidence."
          />
        </div>

        {/* CTA */}
        <Button
          onClick={() => router.push("/projects/new")}
          className="mt-10 h-12 rounded-xl bg-violet-600 px-7 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-700 hover:shadow-xl hover:shadow-violet-500/25 transition-all"
        >
          Get started
          <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
        </Button>

        <p className="mt-4 text-xs text-gray-400">
          Free to try. No credit card required.
        </p>
      </div>
    </div>
  );
}

// ─── Step pill ───────────────────────────────────────────────────────────────

function Step({ number, icon: Icon, text }: { number: string; icon: typeof FileText; text: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600 mb-3">
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </div>
      <p className="text-sm text-gray-700 leading-snug">{text}</p>
    </div>
  );
}
