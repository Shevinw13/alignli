"use client";

import { useState } from "react";
import { WizardShell } from "@/features/project-creation/components/wizard-shell";
import { ResumeUploadStep } from "@/features/project-creation/components/resume-upload-step";
import { ProcessingStep } from "@/features/project-creation/components/processing-step";
import { WizardProvider, useWizardContext } from "@/features/project-creation/wizard-context";
import { createProject, type CreateProjectRequest } from "@/lib/services/projects";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function NewProjectPage() {
  return (
    <WizardProvider>
      <NewProjectWizard />
    </WizardProvider>
  );
}

function NewProjectWizard() {
  const { currentStep, nextStep, prevStep, setStepData } = useWizardContext();
  const [projectId, setProjectId] = useState<string | null>(null);

  // Step 1 state
  const [title, setTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [titleError, setTitleError] = useState("");

  // Step 1 submit
  function handleRoleSubmit() {
    if (!title.trim()) {
      setTitleError("Give your role a title");
      return;
    }
    setTitleError("");
    setStepData("basicInfo", {
      title: title.trim(),
      location,
      employmentType: (employmentType || "Full-time") as "Full-time" | "Part-time" | "Contract" | "Temporary" | "",
      remotePreference: "",
      assignedManager: "",
      minYearsExperience: "",
      salaryMin: "",
      salaryMax: "",
      salaryCurrency: "USD",
      isAgency: false,
      clientCompany: "",
      commissionType: "",
      commissionValue: "",
    });
    setStepData("jobDescription", { rawText: jobDescription });
    nextStep();
  }

  // Step 2 submit — upload candidates then create project
  async function handleCandidatesContinue(files: File[]) {
    setStepData("resumeUpload", files);

    try {
      const payload: CreateProjectRequest = {
        title: title.trim(),
        location: location || "Remote",
        employment_type: (employmentType || "Full-time") as CreateProjectRequest["employment_type"],
      };
      const response = await createProject(payload);
      setProjectId(response.data.id);
    } catch (err: unknown) {
      console.error("Failed to create project:", err);
    }

    nextStep();
  }

  // Shell next handler
  function handleShellNext() {
    if (currentStep === 1) {
      handleRoleSubmit();
    } else if (currentStep === 2) {
      // Trigger the upload step's continue logic
      handleCandidatesContinue([]);
    } else {
      nextStep();
    }
  }

  return (
    <WizardShell currentStep={currentStep} onNext={handleShellNext}>
      {/* ─── Step 1: About the Role ─── */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">About the role</h2>
            <p className="mt-1 text-sm text-gray-500">
              Tell us what you're hiring for. Paste a job description if you have one.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="role-title" className="block text-sm font-medium text-gray-900">
              Role title <span className="text-red-500">*</span>
            </label>
            <input
              id="role-title"
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(""); }}
              placeholder="e.g., Senior Software Engineer"
              className={cn(
                "w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors",
                "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20",
                titleError ? "border-red-400" : "border-gray-200"
              )}
              autoFocus
            />
            {titleError && <p className="text-xs text-red-500">{titleError}</p>}
          </div>

          {/* Job Description */}
          <div className="space-y-1.5">
            <label htmlFor="job-description" className="block text-sm font-medium text-gray-900">
              Job description
            </label>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste your job description here (optional but helps AI rank more accurately)..."
              rows={6}
              className={cn(
                "w-full resize-y rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors",
                "focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20",
                "border-gray-200"
              )}
            />
            <p className="text-xs text-gray-400">
              The AI uses this to determine what matters most for scoring candidates.
            </p>
          </div>

          {/* Optional details (collapsed) */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              {showDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {showDetails ? "Hide details" : "Add more details (optional)"}
            </button>

            {showDetails && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="location" className="block text-xs font-medium text-gray-600">Location</label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., San Francisco, CA"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="emp-type" className="block text-xs font-medium text-gray-600">Employment type</label>
                  <select
                    id="emp-type"
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none appearance-none bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="">Full-time (default)</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Temporary">Temporary</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Step 2: Add Candidates ─── */}
      {currentStep === 2 && (
        <ResumeUploadStep onContinue={handleCandidatesContinue} />
      )}

      {/* ─── Step 3: Processing ─── */}
      {currentStep === 3 && (
        <ProcessingStep
          projectId={projectId ?? ""}
          totalResumes={5}
        />
      )}
    </WizardShell>
  );
}
