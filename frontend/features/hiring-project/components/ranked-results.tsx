"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, MessageSquare, Download, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { listCandidates } from "@/lib/services/candidates";
import type { CandidateCard } from "@/lib/services/candidates";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RankedCandidate {
  id: string;
  rank: number;
  name: string;
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  redFlags: RedFlag[];
  interviewQuestions: string[];
  experience: string;
  currentRole?: string;
  location?: string;
  email?: string;
  phone?: string;
  company?: string;
  education?: string;
  resumeText?: string;
}

export interface RedFlag {
  type: "gap" | "hopping" | "overqualified" | "inflation" | "mismatch";
  description: string;
  severity: "low" | "medium" | "high";
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_CANDIDATES: RankedCandidate[] = [
  {
    id: "1",
    rank: 1,
    name: "Sarah Chen",
    score: 96,
    summary: "Sarah is the strongest overall match — she combines deep React architecture experience with proven leadership at Stripe, directly matching what this role needs.",
    strengths: ["Deep React/TypeScript expertise", "Led platform team at scale", "System design experience"],
    concerns: ["May be overqualified for IC role", "Higher salary expectations likely"],
    redFlags: [],
    interviewQuestions: [
      "How did you balance hands-on coding with team leadership at Stripe?",
      "Describe a time you made a significant architecture decision that affected the whole team.",
      "What made you interested in moving back to an IC-focused role?",
    ],
    experience: "8 years",
    currentRole: "Staff Engineer",
    company: "Stripe",
    location: "San Francisco, CA",
    education: "Stanford University, BS Computer Science",
  },
  {
    id: "2",
    rank: 2,
    name: "Marcus Johnson",
    score: 91,
    summary: "Marcus is a strong contender — excellent system design skills and real-time data expertise, though he leans backend-heavy for a full-stack role.",
    strengths: ["Real-time systems at scale", "Strong backend fundamentals", "Clear communication style"],
    concerns: ["Less frontend experience than ideal", "No direct team leadership"],
    redFlags: [
      { type: "gap", description: "6-month gap between roles (2023) — listed as sabbatical", severity: "low" },
    ],
    interviewQuestions: [
      "Tell me about your experience with frontend architecture vs. your backend strength.",
      "How do you approach mentoring junior engineers without a formal lead title?",
      "What was your reason for the career break in 2023?",
    ],
    experience: "6 years",
    currentRole: "Senior Engineer, DataFlow",
  },
  {
    id: "3",
    rank: 3,
    name: "Emily Park",
    score: 84,
    summary: "Emily shows strong potential with rapid growth, but at 4 years she's still building the depth of experience this senior role demands.",
    strengths: ["Fast learner, quick promotions", "Clean code, strong testing habits", "Startup mentality"],
    concerns: ["Only 4 years experience", "No large-scale system ownership yet"],
    redFlags: [
      { type: "hopping", description: "3 roles in 4 years — each under 18 months", severity: "medium" },
    ],
    interviewQuestions: [
      "What's driving your career moves — what are you looking for in a longer-term role?",
      "Describe the most complex system you've owned end-to-end.",
      "How do you handle ambiguity when there's no senior engineer to consult?",
    ],
    experience: "4 years",
    currentRole: "Software Engineer, StartupXYZ",
  },
  {
    id: "4",
    rank: 4,
    name: "David Kim",
    score: 72,
    summary: "David is early in his engineering career with solid fundamentals, but lacks the production-scale experience needed for a senior position.",
    strengths: ["CS fundamentals are strong", "Good communication in writing", "Eager to learn"],
    concerns: ["Limited production experience at scale", "No distributed systems exposure"],
    redFlags: [],
    interviewQuestions: [
      "What's the largest codebase you've contributed to and what was your role?",
      "How do you approach learning a new technology quickly?",
    ],
    experience: "3 years",
    currentRole: "Developer, MediumCo",
  },
];

// ─── Main Component ──────────────────────────────────────────────────────────

interface RankedResultsProps {
  projectTitle: string;
  projectId?: string;
  candidates?: RankedCandidate[];
}

export function RankedResults({ projectTitle, projectId, candidates: propCandidates }: RankedResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [candidates, setCandidates] = useState<RankedCandidate[]>(propCandidates || DEMO_CANDIDATES);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real candidates if projectId is provided
  useEffect(() => {
    if (!projectId) return;

    async function fetchCandidates() {
      setIsLoading(true);
      try {
        const response = await listCandidates(projectId!, { pageSize: 50 });
        const items = response.data.items;

        // Only use real data if there are scored candidates
        const scoredCandidates = items.filter((c) => c.match_score != null);
        if (scoredCandidates.length > 0) {
          const mapped: RankedCandidate[] = scoredCandidates
            .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
            .map((c, index) => ({
              id: c.id,
              rank: index + 1,
              name: c.full_name || `Candidate ${index + 1}`,
              score: c.match_score ?? 0,
              summary: c.summary || "No summary available",
              strengths: [],
              concerns: [],
              redFlags: [],
              interviewQuestions: [],
              experience: c.years_experience ? `${c.years_experience} years` : "Unknown",
              currentRole: c.current_company || undefined,
            }));
          setCandidates(mapped);

          // Fetch full profiles for detailed data
          fetchFullProfiles(scoredCandidates.map((c) => c.id));
        }
      } catch (err) {
        console.error("Failed to fetch candidates:", err);
        // Fall back to demo data (already set)
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchFullProfiles(ids: string[]) {
      try {
        const { getCandidateProfile } = await import("@/lib/services/candidates");
        const profiles = await Promise.all(
          ids.map((id) => getCandidateProfile(id).then((r) => r.data).catch(() => null))
        );

        setCandidates((prev) =>
          prev.map((candidate) => {
            const profile = profiles.find((p) => p?.id === candidate.id);
            if (!profile) return candidate;
            return {
              ...candidate,
              strengths: (profile.strengths as string[]) || candidate.strengths,
              concerns: (profile.concerns as string[]) || candidate.concerns,
              interviewQuestions: (profile.interview_questions as string[]) || candidate.interviewQuestions,
              experience: profile.years_experience ? `${profile.years_experience} years` : candidate.experience,
              currentRole: profile.current_company || candidate.currentRole,
              location: profile.location || candidate.location,
              email: profile.email || candidate.email,
              phone: profile.phone || candidate.phone,
              company: profile.current_company || candidate.company,
              education: (profile.parsed_data?.education as string) || candidate.education,
              resumeText: (profile.parsed_data?.raw_text as string) || (profile.parsed_data?.text as string) || candidate.resumeText,
            };
          })
        );
      } catch {
        // Gracefully degrade — card view still works
      }
    }

    fetchCandidates();
  }, [projectId]);

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }

  const compareList = candidates.filter((c) => compareIds.has(c.id));

  if (showCompare && compareList.length >= 2) {
    return <CompareView candidates={compareList} onBack={() => setShowCompare(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{candidates.length} candidates ranked</p>
        </div>
        <div className="flex items-center gap-2">
          {compareIds.size >= 2 && (
            <Button
              onClick={() => setShowCompare(true)}
              className="bg-violet-600 text-white hover:bg-violet-700 text-xs px-3 py-1.5 rounded-lg"
            >
              <GitCompare className="h-3.5 w-3.5 mr-1.5" />
              Compare ({compareIds.size})
            </Button>
          )}
          <Button
            onClick={() => exportToPdf(projectTitle, candidates)}
            variant="outline"
            className="text-xs px-3 py-1.5 rounded-lg"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Bias transparency notice */}
      <div className="rounded-lg bg-violet-50 border border-violet-100 px-4 py-2.5">
        <p className="text-xs text-violet-700">
          <span className="font-medium">Fair ranking:</span> Scores are based solely on skills, experience, and role fit. No demographic factors are considered.
        </p>
      </div>

      {/* Ranked list */}
      <div className="space-y-3">
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            isExpanded={expandedId === candidate.id}
            isComparing={compareIds.has(candidate.id)}
            onToggleExpand={() => toggleExpand(candidate.id)}
            onToggleCompare={() => toggleCompare(candidate.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Candidate Row ───────────────────────────────────────────────────────────

function CandidateRow({
  candidate,
  isExpanded,
  isComparing,
  onToggleExpand,
  onToggleCompare,
}: {
  candidate: RankedCandidate;
  isExpanded: boolean;
  isComparing: boolean;
  onToggleExpand: () => void;
  onToggleCompare: () => void;
}) {
  const scoreColor = candidate.score >= 90 ? "text-emerald-600" : candidate.score >= 75 ? "text-amber-600" : "text-gray-500";

  return (
    <div className={cn(
      "rounded-xl border bg-white overflow-hidden transition-all",
      isExpanded ? "border-violet-200 shadow-sm" : "border-gray-100",
      isComparing && "ring-2 ring-violet-300"
    )}>
      {/* Main row — always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        {/* Rank */}
        <span className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          candidate.rank === 1 ? "bg-violet-100 text-violet-700" :
          candidate.rank === 2 ? "bg-gray-100 text-gray-700" :
          candidate.rank === 3 ? "bg-amber-50 text-amber-700" :
          "bg-gray-50 text-gray-500"
        )}>
          {candidate.rank}
        </span>

        {/* Name + summary */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{candidate.name}</p>
            {candidate.redFlags.length > 0 && (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Has flags" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 truncate">{candidate.summary}</p>
        </div>

        {/* Score */}
        <span className={cn("text-lg font-bold tabular-nums shrink-0", scoreColor)}>
          {candidate.score}%
        </span>

        {/* Expand chevron */}
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <ExpandedDetail candidate={candidate} isComparing={isComparing} onToggleCompare={onToggleCompare} />
      )}
    </div>
  );
}

// ─── Expanded Detail ─────────────────────────────────────────────────────────

function ExpandedDetail({
  candidate,
  isComparing,
  onToggleCompare,
}: {
  candidate: RankedCandidate;
  isComparing: boolean;
  onToggleCompare: () => void;
}) {
  const [showResume, setShowResume] = useState(false);

  return (
    <div className="border-t border-gray-100 px-5 py-5 space-y-5">
      {/* Profile info row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        {candidate.company && <span className="font-medium text-gray-700">{candidate.company}</span>}
        {candidate.currentRole && <span>{candidate.currentRole}</span>}
        {candidate.experience && <span>{candidate.experience} experience</span>}
        {candidate.location && <span>📍 {candidate.location}</span>}
        {candidate.education && <span>🎓 {candidate.education}</span>}
        {candidate.email && <span>✉ {candidate.email}</span>}
        {candidate.phone && <span>📞 {candidate.phone}</span>}
      </div>

      {/* Strengths */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Strengths</h4>
        <ul className="space-y-1">
          {candidate.strengths.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Concerns */}
      {candidate.concerns.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Concerns</h4>
          <ul className="space-y-1">
            {candidate.concerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Red Flags */}
      {candidate.redFlags.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
          <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Flags to discuss in interview
          </h4>
          <ul className="space-y-1">
            {candidate.redFlags.map((flag, i) => (
              <li key={i} className="text-xs text-amber-700">{flag.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Interview Questions */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Suggested interview questions
        </h4>
        <ol className="space-y-2 list-decimal list-inside">
          {candidate.interviewQuestions.map((q, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed">{q}</li>
          ))}
        </ol>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
          className={cn(
            "text-xs font-medium px-3 py-1.5 rounded-md border transition-colors",
            isComparing
              ? "bg-violet-50 border-violet-200 text-violet-700"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          )}
        >
          {isComparing ? "✓ Added to compare" : "Add to compare"}
        </button>

        {candidate.resumeText && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowResume(!showResume); }}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {showResume ? "Hide resume" : "View resume"}
          </button>
        )}
      </div>

      {/* Resume text viewer */}
      {showResume && candidate.resumeText && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-64 overflow-y-auto">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
            {candidate.resumeText}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Compare View ────────────────────────────────────────────────────────────

function CompareView({ candidates, onBack }: { candidates: RankedCandidate[]; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Comparing {candidates.length} candidates</h2>
          <p className="text-sm text-gray-500">Side-by-side view of your shortlist</p>
        </div>
        <Button onClick={onBack} variant="outline" className="text-xs rounded-lg">
          ← Back to rankings
        </Button>
      </div>

      {/* Comparison grid */}
      <div className={cn("grid gap-4", candidates.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {candidates.map((c) => (
          <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-5 space-y-4">
            {/* Header */}
            <div className="text-center">
              <div className={cn(
                "mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold mb-2",
                c.rank === 1 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-700"
              )}>
                #{c.rank}
              </div>
              <p className="font-semibold text-gray-900">{c.name}</p>
              <p className={cn("text-2xl font-bold mt-1",
                c.score >= 90 ? "text-emerald-600" : c.score >= 75 ? "text-amber-600" : "text-gray-500"
              )}>
                {c.score}%
              </p>
              <p className="text-xs text-gray-500 mt-1">{c.experience} · {c.currentRole}</p>
            </div>

            {/* Strengths */}
            <div>
              <h4 className="text-xs font-semibold text-emerald-700 mb-1">Strengths</h4>
              <ul className="space-y-1">
                {c.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-gray-600">• {s}</li>
                ))}
              </ul>
            </div>

            {/* Concerns */}
            <div>
              <h4 className="text-xs font-semibold text-amber-700 mb-1">Concerns</h4>
              <ul className="space-y-1">
                {c.concerns.map((con, i) => (
                  <li key={i} className="text-xs text-gray-600">• {con}</li>
                ))}
              </ul>
            </div>

            {/* Red flags */}
            {c.redFlags.length > 0 && (
              <div className="rounded-md bg-amber-50 p-2">
                <p className="text-xs text-amber-700 font-medium">⚠ {c.redFlags.length} flag{c.redFlags.length > 1 ? "s" : ""}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Export to PDF ────────────────────────────────────────────────────────────

function exportToPdf(projectTitle: string, candidates: RankedCandidate[]) {
  // Generate a printable HTML document and trigger print dialog
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${projectTitle} — Candidate Rankings | Narrowli</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; color: #1f2937; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 32px; }
        .candidate { margin-bottom: 24px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; }
        .rank { display: inline-block; width: 28px; height: 28px; border-radius: 50%; background: #ede9fe; color: #5b21b6; font-weight: 700; text-align: center; line-height: 28px; font-size: 13px; margin-right: 12px; }
        .name { font-weight: 600; font-size: 15px; display: inline; }
        .score { float: right; font-size: 18px; font-weight: 700; color: #059669; }
        .summary { color: #6b7280; font-size: 13px; margin-top: 8px; }
        .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; margin: 12px 0 4px; }
        .list { margin: 0; padding-left: 16px; font-size: 13px; color: #4b5563; }
        .flag { background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; margin-top: 8px; font-size: 12px; color: #92400e; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
        .bias-note { background: #ede9fe; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #5b21b6; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <h1>${projectTitle}</h1>
      <p class="subtitle">${candidates.length} candidates ranked by Narrowli AI</p>
      <div class="bias-note">Fair ranking: Scores based solely on skills, experience, and role fit. No demographic factors considered.</div>
      ${candidates.map((c) => `
        <div class="candidate">
          <span class="rank">${c.rank}</span>
          <span class="name">${c.name}</span>
          <span class="score">${c.score}%</span>
          <p class="summary">${c.summary}</p>
          <p class="section-title">Strengths</p>
          <ul class="list">${c.strengths.map((s) => `<li>${s}</li>`).join("")}</ul>
          ${c.concerns.length > 0 ? `<p class="section-title">Concerns</p><ul class="list">${c.concerns.map((con) => `<li>${con}</li>`).join("")}</ul>` : ""}
          ${c.redFlags.length > 0 ? `<div class="flag">⚠ ${c.redFlags.map((f) => f.description).join("; ")}</div>` : ""}
        </div>
      `).join("")}
      <div class="footer">Generated by Narrowli · ${new Date().toLocaleDateString()}</div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }
}
