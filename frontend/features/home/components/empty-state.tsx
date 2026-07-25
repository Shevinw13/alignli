"use client";

import { useRouter } from "next/navigation";
import { Plus, FileText, Users, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Empty state for the projects list (home page).
 * Premium, visual design that communicates the product value.
 */
export function EmptyState() {
  const router = useRouter();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-[#e6f7fc]/50 p-8 md:p-12">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#0099CC]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-[#2d9e80]/10 blur-3xl" />

      <div className="relative flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Visual: 3 steps with connecting lines */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e6f7fc] text-[#0099CC] shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div className="h-px w-8 bg-gray-200" />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f4f0] text-[#2d9e80] shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div className="h-px w-8 bg-gray-200" />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fef3e6] text-[#d97706] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-bold text-navy">
          Find your best candidates, faster
        </h2>

        {/* Subtext */}
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md">
          Upload resumes or paste profiles. BTS scores every candidate against your criteria and shows exactly why — no black boxes.
        </p>

        {/* How it works */}
        <div className="mt-8 grid grid-cols-3 gap-4 w-full text-left">
          <div className="rounded-xl bg-gradient-to-br from-[#e6f7fc] to-white border border-[#d4eef2] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0099CC]/10 mb-2">
              <FileText className="h-4 w-4 text-[#0099CC]" />
            </div>
            <p className="text-sm font-semibold text-[#0099CC]">1. Define</p>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">Set your role requirements and criteria</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#e8f4f0] to-white border border-[#c8e8de] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2d9e80]/10 mb-2">
              <Users className="h-4 w-4 text-[#2d9e80]" />
            </div>
            <p className="text-sm font-semibold text-[#2d9e80]">2. Upload</p>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">Add resumes, paste text, or LinkedIn profiles</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#fef7ed] to-white border border-[#f5e6cc] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d97706]/10 mb-2">
              <Sparkles className="h-4 w-4 text-[#d97706]" />
            </div>
            <p className="text-sm font-semibold text-[#d97706]">3. Decide</p>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">See ranked results with transparent scoring</p>
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={() => router.push("/projects/new")}
          className="mt-8 h-11 rounded-xl bg-[#0099CC] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#007aa3] hover:shadow-lg transition-all"
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Create your first project
          <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Takes about 2 minutes to set up
        </p>
      </div>
    </div>
  );
}
