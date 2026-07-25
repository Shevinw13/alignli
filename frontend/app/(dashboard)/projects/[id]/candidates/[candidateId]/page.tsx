"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, MapPin, Briefcase, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/shared";
import {
  HireCandidateButton,
  AISummarySection,
  MatchBreakdown,
  StrengthsConcerns,
  CareerTimeline,
  ExperienceSection,
  EducationSection,
  SkillsSection,
  ContactInfo,
  CertificationsSection,
  ProjectsSection,
  AwardsSection,
  LanguagesSection,
  InterviewQuestions,
  NotesSection,
  ResumeViewer,
} from "@/features/candidate";
import type { ProjectState } from "@/features/hiring-project";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CandidateProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  websiteUrl: string | null;
  currentCompany: string | null;
  location: string | null;
  yearsExperience: number | null;
  matchScore: number;
  confidenceLevel: "High" | "Medium" | "Low";
  status: "Active" | "Interviewing" | "Offer Extended" | "Hired" | "Rejected";
  summary: string | null;
  strengths: { text: string; evidence: string }[];
  concerns: { text: string; uncertaintyLevel: "High" | "Medium" | "Low" }[];
  scores: {
    criteriaLabel: string;
    category: string;
    rawScore: number;
    maxScore: number;
    reasoning: string;
  }[];
  careerTimeline: {
    title: string;
    company: string;
    startDate: string;
    endDate: string | null;
    description?: string;
  }[];
  experience: {
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string | null;
    description: string;
    achievements: string[];
  }[];
  education: {
    degree: string;
    field: string;
    institution: string;
    graduationYear: string;
    gpa?: string;
    honors?: string;
  }[];
  skills: { category: string; skills: string[] }[];
  certifications: { name: string; issuer: string; year: string }[];
  projects: {
    name: string;
    description: string;
    url?: string;
    technologies: string[];
  }[];
  awards: { title: string; issuer: string; year: string }[];
  languages: {
    language: string;
    proficiency: "Native" | "Fluent" | "Advanced" | "Intermediate" | "Basic";
  }[];
  interviewQuestions: string[];
  notes: { id: string; content: string; createdAt: string; updatedAt: string }[];
  resumeFileName: string | null;
  resumeFileUrl: string | null;
}

// ─── Section error state keys ────────────────────────────────────────────────

type AISection =
  | "summary"
  | "scores"
  | "strengths"
  | "concerns"
  | "interviewQuestions";

// ─── Mock Data (API wiring in task 20) ──────────────────────────────────────

const mockCandidateProfile: CandidateProfile = {
  id: "cand-1",
  name: "Alice Johnson",
  email: "alice.johnson@example.com",
  phone: "+1 (415) 555-0123",
  linkedinUrl: "https://linkedin.com/in/alicejohnson",
  githubUrl: "https://github.com/alicejohnson",
  portfolioUrl: "https://alicejohnson.dev",
  websiteUrl: null,
  currentCompany: "TechCorp Inc.",
  location: "San Francisco, CA",
  yearsExperience: 8,
  matchScore: 97,
  confidenceLevel: "High",
  status: "Interviewing",
  summary:
    "Alice Johnson is an exceptional full-stack engineer with 8 years of experience specializing in React, TypeScript, and Node.js. She led the migration of TechCorp's monolithic application to a microservices architecture serving 2M+ daily active users, demonstrating strong technical leadership and system design skills. Her consistent track record of mentoring junior developers and contributing to open-source projects shows both collaboration strength and passion for the craft. One minor concern is a lack of formal experience with our specific cloud provider (GCP), though her AWS expertise is extensive. She should absolutely be interviewed — she's a top-tier candidate who would elevate any engineering team.",
  strengths: [
    {
      text: "Led migration from monolith to microservices at scale",
      evidence:
        "Architected and delivered microservices migration serving 2M+ DAU at TechCorp over 18 months",
    },
    {
      text: "Deep expertise in React and TypeScript ecosystem",
      evidence:
        "8 years of React experience, core contributor to 3 popular open-source React libraries",
    },
    {
      text: "Proven mentorship and technical leadership skills",
      evidence:
        "Mentored 12+ junior developers, 4 of whom were promoted within 18 months",
    },
    {
      text: "Strong system design and architecture thinking",
      evidence:
        "Designed event-driven architecture handling 500K events/sec with 99.99% uptime",
    },
    {
      text: "Excellent communication and cross-functional collaboration",
      evidence:
        "Led weekly architecture reviews, partnered with product and design on 3 major product launches",
    },
  ],
  concerns: [
    {
      text: "No direct GCP experience — all cloud work has been on AWS",
      uncertaintyLevel: "Low",
    },
    {
      text: "Last role was primarily backend-focused; frontend skills may need verification",
      uncertaintyLevel: "Medium",
    },
    {
      text: "Short tenure at previous startup (11 months) — may indicate restlessness",
      uncertaintyLevel: "High",
    },
  ],
  scores: [
    {
      criteriaLabel: "React & TypeScript proficiency",
      category: "Skill Match",
      rawScore: 98,
      maxScore: 100,
      reasoning:
        "8 years React experience, TypeScript since 2018, core contributor to open-source React libraries. Demonstrates expert-level proficiency.",
    },
    {
      criteriaLabel: "5+ years frontend development",
      category: "Experience",
      rawScore: 95,
      maxScore: 100,
      reasoning:
        "8 years of professional frontend development with progressive responsibility. Exceeds the 5-year requirement.",
    },
    {
      criteriaLabel: "Mentorship & code review",
      category: "Leadership",
      rawScore: 92,
      maxScore: 100,
      reasoning:
        "Mentored 12+ engineers, established code review standards, led architecture reviews. Strong evidence of technical leadership.",
    },
    {
      criteriaLabel: "Computer Science or related field",
      category: "Education",
      rawScore: 100,
      maxScore: 100,
      reasoning:
        "B.S. Computer Science from Stanford University with honors. Fully meets educational requirements.",
    },
    {
      criteriaLabel: "AWS or cloud certifications",
      category: "Certifications",
      rawScore: 85,
      maxScore: 100,
      reasoning:
        "Holds AWS Solutions Architect Professional certification. No GCP certifications, but AWS expertise is transferable.",
    },
  ],
  careerTimeline: [
    {
      title: "Staff Engineer",
      company: "TechCorp Inc.",
      startDate: "Jan 2021",
      endDate: null,
      description:
        "Leading platform engineering initiatives, microservices migration, and mentoring.",
    },
    {
      title: "Senior Software Engineer",
      company: "TechCorp Inc.",
      startDate: "Mar 2019",
      endDate: "Dec 2020",
      description:
        "Full-stack development on core product, established TypeScript migration.",
    },
    {
      title: "Software Engineer",
      company: "RocketStart",
      startDate: "Apr 2018",
      endDate: "Feb 2019",
      description:
        "Built real-time collaborative editing features for the startup's main product.",
    },
    {
      title: "Frontend Developer",
      company: "WebAgency Co.",
      startDate: "Jun 2016",
      endDate: "Mar 2018",
      description:
        "Developed client-facing SPAs and design systems for enterprise clients.",
    },
  ],
  experience: [
    {
      title: "Staff Engineer",
      company: "TechCorp Inc.",
      location: "San Francisco, CA",
      startDate: "Jan 2021",
      endDate: null,
      description:
        "Leading platform engineering team of 6 engineers. Architecting microservices migration for a product serving 2M+ daily active users. Establishing engineering standards and mentoring junior/mid-level developers.",
      achievements: [
        "Led monolith-to-microservices migration serving 2M+ DAU with zero downtime",
        "Reduced P95 API latency by 60% through architecture optimizations",
        "Mentored 12+ engineers, 4 promoted to senior within 18 months",
        "Established TypeScript-first development standards across 15 repositories",
      ],
    },
    {
      title: "Senior Software Engineer",
      company: "TechCorp Inc.",
      location: "San Francisco, CA",
      startDate: "Mar 2019",
      endDate: "Dec 2020",
      description:
        "Full-stack development on core product features. Led TypeScript migration initiative. Designed event-driven architecture for real-time features.",
      achievements: [
        "Migrated 200K+ lines of JavaScript to TypeScript with 95% type coverage",
        "Designed event-driven system handling 500K events/second",
        "Shipped 3 major features that increased user engagement by 25%",
      ],
    },
    {
      title: "Software Engineer",
      company: "RocketStart",
      location: "San Francisco, CA",
      startDate: "Apr 2018",
      endDate: "Feb 2019",
      description:
        "Built real-time collaborative editing features using operational transforms. Startup was acqui-hired by TechCorp.",
      achievements: [
        "Implemented real-time collaborative editing with <50ms sync latency",
        "Built custom CRDT implementation for concurrent document editing",
      ],
    },
    {
      title: "Frontend Developer",
      company: "WebAgency Co.",
      location: "Los Angeles, CA",
      startDate: "Jun 2016",
      endDate: "Mar 2018",
      description:
        "Developed single-page applications and design systems for enterprise clients. Introduced React adoption at the agency.",
      achievements: [
        "Delivered 8 client projects on time using React and Vue.js",
        "Built reusable component library adopted by 4 project teams",
        "Introduced automated testing, increasing code coverage from 20% to 75%",
      ],
    },
  ],
  education: [
    {
      degree: "B.S.",
      field: "Computer Science",
      institution: "Stanford University",
      graduationYear: "2016",
      gpa: "3.87",
      honors: "Cum Laude",
    },
  ],
  skills: [
    {
      category: "Frontend",
      skills: [
        "React",
        "TypeScript",
        "Next.js",
        "Vue.js",
        "Tailwind CSS",
        "HTML/CSS",
        "Webpack",
        "Vite",
      ],
    },
    {
      category: "Backend",
      skills: ["Node.js", "Express", "GraphQL", "REST APIs", "PostgreSQL", "Redis", "Kafka"],
    },
    {
      category: "Cloud & DevOps",
      skills: ["AWS", "Docker", "Kubernetes", "CI/CD", "Terraform", "GitHub Actions"],
    },
    {
      category: "Tools & Practices",
      skills: [
        "Git",
        "Agile/Scrum",
        "System Design",
        "TDD",
        "Code Review",
        "Technical Writing",
      ],
    },
  ],
  certifications: [
    {
      name: "AWS Solutions Architect – Professional",
      issuer: "Amazon Web Services",
      year: "2022",
    },
    {
      name: "AWS Developer – Associate",
      issuer: "Amazon Web Services",
      year: "2020",
    },
  ],
  projects: [
    {
      name: "react-perf-toolkit",
      description:
        "Open-source performance monitoring toolkit for React applications with automatic bottleneck detection.",
      url: "https://github.com/alicejohnson/react-perf-toolkit",
      technologies: ["React", "TypeScript", "Web Workers", "Performance API"],
    },
    {
      name: "Distributed Task Scheduler",
      description:
        "A fault-tolerant distributed task scheduling system built during a hackathon. Won 1st place.",
      technologies: ["Go", "Redis", "gRPC", "Docker"],
    },
  ],
  awards: [
    {
      title: "Engineering Excellence Award",
      issuer: "TechCorp Inc.",
      year: "2023",
    },
    {
      title: "Best Architecture – Internal Hackathon",
      issuer: "TechCorp Inc.",
      year: "2022",
    },
  ],
  languages: [
    { language: "English", proficiency: "Native" },
    { language: "Spanish", proficiency: "Intermediate" },
    { language: "Japanese", proficiency: "Basic" },
  ],
  interviewQuestions: [
    "Describe your approach to migrating a monolithic application to microservices. What were the biggest technical challenges at TechCorp, and how did you handle service boundaries?",
    "You mentored 12+ engineers — can you walk through your mentoring philosophy and a specific example where you helped a junior developer overcome a significant technical challenge?",
    "Your resume shows experience with event-driven architectures handling 500K events/sec. How did you ensure reliability and handle failure scenarios at that scale?",
    "Given your AWS background, how would you approach learning our GCP stack? Can you give an example of quickly ramping up on a new technology in a past role?",
    "Tell me about a time you had to make a significant technical decision with incomplete information. How did you manage risk and communicate trade-offs to stakeholders?",
  ],
  notes: [],
  resumeFileName: "Alice_Johnson_Resume_2024.pdf",
  resumeFileUrl: "#",
};

const mockProjectContext = {
  id: "1",
  title: "Senior Frontend Engineer",
  state: "Active" as ProjectState,
};

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CandidateProfile["status"] }) {
  const statusStyles: Record<CandidateProfile["status"], string> = {
    Active: "bg-emerald-50 text-emerald-700",
    Interviewing: "bg-blue-50 text-blue-700",
    "Offer Extended": "bg-purple-50 text-purple-700",
    Hired: "bg-indigo-50 text-indigo-700",
    Rejected: "bg-gray-100 text-gray-500",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        statusStyles[status]
      )}
      aria-label={`Candidate status: ${status}`}
    >
      {status}
    </span>
  );
}

// ─── Score Color for hero section ────────────────────────────────────────────

function getHeroScoreColor(score: number): string {
  if (score >= 95) return "text-emerald-600";
  if (score >= 80) return "text-blue-600";
  if (score >= 65) return "text-amber-600";
  return "text-gray-500";
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CandidateProfilePage() {
  const params = useParams<{ id: string; candidateId: string }>();

  // Mock data (API integration in task 20)
  const candidate = mockCandidateProfile;
  const projectContext = mockProjectContext;

  // Local state for candidate status and project state
  const [candidateStatus, setCandidateStatus] = useState(candidate.status);
  const [projectState, setProjectState] = useState<ProjectState>(projectContext.state);

  // Notes state (local until API wiring)
  const [notes, setNotes] = useState(candidate.notes);

  // Per-section error states for AI-generated sections (Requirement 11.9)
  const [sectionErrors, setSectionErrors] = useState<Record<AISection, boolean>>({
    summary: false,
    scores: false,
    strengths: false,
    concerns: false,
    interviewQuestions: false,
  });

  // Per-section retry handlers (will call API in task 20)
  const handleRetrySection = useCallback((section: AISection) => {
    // In a real implementation, this would call the API to regenerate the section
    // For now, we just clear the error state to simulate a successful retry
    setSectionErrors((prev) => ({ ...prev, [section]: false }));
  }, []);

  const handleHired = () => {
    setCandidateStatus("Hired");
  };

  const handleProjectFilled = () => {
    setProjectState("Filled");
  };

  const handleNoteSave = (noteId: string | null, content: string) => {
    if (noteId) {
      // Edit existing note
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, content, updatedAt: new Date().toLocaleDateString() }
            : n
        )
      );
    } else {
      // Add new note
      const newNote = {
        id: `note-${Date.now()}`,
        content,
        createdAt: new Date().toLocaleDateString(),
        updatedAt: new Date().toLocaleDateString(),
      };
      setNotes((prev) => [newNote, ...prev]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb navigation */}
      <Breadcrumb
        items={[
          { label: "Projects", href: "/" },
          { label: projectContext.title, href: `/projects/${params.id}` },
          { label: candidate.name, href: `/projects/${params.id}/candidates/${params.candidateId}` },
        ]}
      />

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link
            href={`/projects/${params.id}`}
            className={cn(
              "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]",
              "text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            )}
            aria-label={`Back to ${projectContext.title}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-navy">{candidate.name}</h1>
            <p className="text-sm text-muted-foreground">
              {projectContext.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={candidateStatus} />
          {candidateStatus !== "Hired" && (
            <HireCandidateButton
              candidateId={candidate.id}
              candidateName={candidate.name}
              projectState={projectState}
              onHired={handleHired}
              onProjectFilled={handleProjectFilled}
            />
          )}
        </div>
      </div>

      {/* ─── Hero Card — basic info + match score ───────────────────────── */}
      <div className="rounded-[16px] border border-border bg-white p-6">
        <div className="flex items-start gap-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-50"
            aria-hidden="true"
          >
            <User className="h-8 w-8 text-indigo-400" />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {candidate.currentCompany && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{candidate.currentCompany}</span>
                </div>
              )}
              {candidate.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{candidate.location}</span>
                </div>
              )}
              {candidate.yearsExperience !== null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{candidate.yearsExperience} years experience</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-navy">
                  Match Score:
                </span>
                <span
                  className={cn(
                    "text-2xl font-bold",
                    getHeroScoreColor(candidate.matchScore)
                  )}
                >
                  {candidate.matchScore}/100
                </span>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {candidate.confidenceLevel} confidence
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── AI Summary ─────────────────────────────────────────────────── */}
      <AISummarySection
        summary={candidate.summary}
        error={sectionErrors.summary}
        onRetry={() => handleRetrySection("summary")}
      />

      {/* ─── Match Breakdown ────────────────────────────────────────────── */}
      <MatchBreakdown
        scores={candidate.scores}
        error={sectionErrors.scores}
        onRetry={() => handleRetrySection("scores")}
      />

      {/* ─── Strengths & Concerns (two columns) ─────────────────────────── */}
      <StrengthsConcerns
        strengths={candidate.strengths}
        concerns={candidate.concerns}
        strengthsError={sectionErrors.strengths}
        concernsError={sectionErrors.concerns}
        onRetryStrengths={() => handleRetrySection("strengths")}
        onRetryConcerns={() => handleRetrySection("concerns")}
      />

      {/* ─── Career Timeline ────────────────────────────────────────────── */}
      <CareerTimeline entries={candidate.careerTimeline} />

      {/* ─── Experience ─────────────────────────────────────────────────── */}
      <ExperienceSection entries={candidate.experience} />

      {/* ─── Education ──────────────────────────────────────────────────── */}
      <EducationSection entries={candidate.education} />

      {/* ─── Skills ─────────────────────────────────────────────────────── */}
      <SkillsSection categories={candidate.skills} />

      {/* ─── Contact Info ───────────────────────────────────────────────── */}
      <ContactInfo
        email={candidate.email}
        phone={candidate.phone}
        linkedinUrl={candidate.linkedinUrl}
        githubUrl={candidate.githubUrl}
        portfolioUrl={candidate.portfolioUrl}
        websiteUrl={candidate.websiteUrl}
      />

      {/* ─── Certifications ─────────────────────────────────────────────── */}
      <CertificationsSection certifications={candidate.certifications} />

      {/* ─── Projects ───────────────────────────────────────────────────── */}
      <ProjectsSection projects={candidate.projects} />

      {/* ─── Awards ─────────────────────────────────────────────────────── */}
      <AwardsSection awards={candidate.awards} />

      {/* ─── Languages ──────────────────────────────────────────────────── */}
      <LanguagesSection languages={candidate.languages} />

      {/* ─── AI Interview Questions ─────────────────────────────────────── */}
      <InterviewQuestions
        questions={candidate.interviewQuestions}
        error={sectionErrors.interviewQuestions}
        onRetry={() => handleRetrySection("interviewQuestions")}
      />

      {/* ─── Notes ──────────────────────────────────────────────────────── */}
      <NotesSection notes={notes} onSave={handleNoteSave} />

      {/* ─── Original Resume ────────────────────────────────────────────── */}
      <ResumeViewer
        fileName={candidate.resumeFileName}
        fileUrl={candidate.resumeFileUrl}
      />

      {/* Project state info (visible when project state has changed) */}
      {projectState === "Filled" && (
        <div className="rounded-[12px] border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-700">
            This project has been marked as Filled and moved to your closed
            projects list.
          </p>
        </div>
      )}
    </div>
  );
}
