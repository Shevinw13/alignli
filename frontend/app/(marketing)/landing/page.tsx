"use client";

import Link from "next/link";
import { ArrowRight, FileText, Upload, Sparkles, CheckCircle2, Shield, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link href="/landing" className="flex items-center gap-2.5">
            <img src="/narrowli.png" alt="Narrowli" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-semibold text-gray-900 tracking-tight">Narrowli</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-sm"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Find the right hire.<br />
            <span className="text-violet-600">Faster.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
            AI-powered candidate intelligence that helps you identify, evaluate, and hire the best talent with confidence.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-700 hover:shadow-xl transition-all"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-violet-600 transition-colors"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">No credit card required · Free for up to 3 jobs</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6 bg-gray-50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            Three steps. Under 60 seconds.
          </h2>
          <p className="mt-3 text-center text-gray-500">
            No training required. No complex setup. Just results.
          </p>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            <StepCard
              number="1"
              icon={FileText}
              title="Describe the role"
              description="Paste your job description or just type what you're looking for. The AI extracts what matters."
            />
            <StepCard
              number="2"
              icon={Upload}
              title="Drop in resumes"
              description="Upload PDFs, paste text, or copy-paste from LinkedIn. Add as many candidates as you want."
            />
            <StepCard
              number="3"
              icon={Sparkles}
              title="See who's best"
              description="Ranked candidates with scores, reasoning, red flags, and tailored interview questions."
            />
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            Everything you need to decide who to interview
          </h2>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Sparkles}
              title="AI-powered rankings"
              description="Every candidate scored 0-100 against your specific requirements"
            />
            <FeatureCard
              icon={CheckCircle2}
              title="Clear explanations"
              description="One-sentence summary explaining why each candidate ranked where they did"
            />
            <FeatureCard
              icon={Shield}
              title="Red flag detection"
              description="Employment gaps, job-hopping, and overqualification surfaced automatically"
            />
            <FeatureCard
              icon={Zap}
              title="Interview questions"
              description="3-5 tailored questions per candidate based on their gaps and strengths"
            />
            <FeatureCard
              icon={FileText}
              title="Export to PDF"
              description="Share ranked shortlists with your team — no login needed for them"
            />
            <FeatureCard
              icon={Upload}
              title="Compare candidates"
              description="Side-by-side view of your top 2-3 finalists across all criteria"
            />
          </div>
        </div>
      </section>

      {/* Social proof / trust */}
      <section className="py-16 px-6 bg-violet-50">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-lg font-medium text-violet-900">
            "I used to spend 4 hours reading resumes for every role. Now I get a ranked list in under a minute. It's absurd how much time this saves."
          </p>
          <p className="mt-4 text-sm text-violet-600">— Early beta user, Hiring Manager</p>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Simple pricing</h2>
          <p className="mt-3 text-gray-500">No per-seat fees. No enterprise sales calls.</p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 max-w-lg mx-auto">
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-left">
              <p className="text-sm font-semibold text-gray-900">Free</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">$0</p>
              <p className="mt-1 text-xs text-gray-500">3 jobs · 10 candidates each</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>✓ AI rankings</li>
                <li>✓ Interview questions</li>
                <li>✓ PDF export</li>
              </ul>
            </div>
            <div className="rounded-xl border-2 border-violet-600 bg-white p-6 text-left relative">
              <span className="absolute -top-3 left-4 rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">Popular</span>
              <p className="text-sm font-semibold text-gray-900">Pro</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">$29<span className="text-base font-normal text-gray-500">/mo</span></p>
              <p className="mt-1 text-xs text-gray-500">Unlimited jobs · Unlimited candidates</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>✓ Everything in Free</li>
                <li>✓ Red flag detection</li>
                <li>✓ Compare mode</li>
                <li>✓ Priority support</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-violet-600 to-indigo-600">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Stop reading resumes. Start interviewing the right people.
          </h2>
          <p className="mt-3 text-violet-100">
            Join hiring managers who save hours on every role.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-violet-700 shadow-lg hover:bg-violet-50 transition-all"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/narrowli.png" alt="" width={20} height={20} className="h-5 w-5 rounded" />
            <span className="text-sm text-gray-500">© 2026 Narrowli</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <Link href="/sign-in" className="hover:text-gray-600">Sign in</Link>
            <Link href="/sign-up" className="hover:text-gray-600">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepCard({ number, icon: Icon, title, description }: { number: string; icon: typeof FileText; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-2 text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: typeof Sparkles; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <Icon className="h-5 w-5 text-violet-600 mb-3" />
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
