"use client";

import { useState } from "react";
import { WizardShell } from "@/features/project-creation/components/wizard-shell";
import {
  BasicInfoStep,
  type BasicInfoData,
} from "@/features/project-creation/components/basic-info-step";
import {
  JobDescriptionStep,
  type JobDescriptionData,
} from "@/features/project-creation/components/job-description-step";
import {
  RankingCriteriaStep,
  type RankingCriterion,
} from "@/features/project-creation/components/ranking-criteria-step";
import { ResumeUploadStep } from "@/features/project-creation/components/resume-upload-step";
import { ProcessingStep } from "@/features/project-creation/components/processing-step";
import { WizardProvider, useWizardContext } from "@/features/project-creation/wizard-context";
import { createProject, type CreateProjectRequest } from "@/lib/services/projects";

export default function NewProjectPage() {
  return (
    <WizardProvider>
      <NewProjectWizard />
    </WizardProvider>
  );
}

function NewProjectWizard() {
  const { currentStep, wizardData, nextStep, prevStep, setStepData } = useWizardContext();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [generatedCriteria, setGeneratedCriteria] = useState<RankingCriterion[]>([]);

  async function handleBasicInfoSubmit(data: BasicInfoData) {
    setStepData("basicInfo", data);
    nextStep();
  }

  function handleJobDescriptionSubmit(data: JobDescriptionData) {
    setStepData("jobDescription", data);

    // Pull step 1 data to include in criteria
    const basicInfo = wizardData.basicInfo;
    const minYears = basicInfo?.minYearsExperience ? parseInt(basicInfo.minYearsExperience, 10) : null;

    // Criteria from Basic Info (step 1)
    const step1Criteria: RankingCriterion[] = [];

    if (minYears && minYears > 0) {
      step1Criteria.push({
        id: "basic-exp",
        category: "Experience",
        label: `Minimum ${minYears} years of relevant experience`,
        priority: "High",
        maxScore: 100,
      });
    }

    // Generic criteria (keep it to 2 — leave room for custom)
    const genericCriteria: RankingCriterion[] = [
      { id: "gen-2", category: "Education", label: "Educational background", priority: "Low", maxScore: 100 },
      { id: "gen-3", category: "Leadership", label: "Communication & collaboration skills", priority: "Medium", maxScore: 100 },
    ];

    // Role-specific criteria derived from JD extraction
    const extractedCategories = data.extractedCategories;
    const roleCriteria: RankingCriterion[] = [];

    if (extractedCategories.required_skills.length > 0) {
      extractedCategories.required_skills.forEach((skill, i) => {
        roleCriteria.push({
          id: `jd-skill-${i}`,
          category: "Skill Match",
          label: skill.value,
          priority: "High",
          maxScore: 100,
        });
      });
    }

    if (extractedCategories.preferred_skills.length > 0) {
      extractedCategories.preferred_skills.forEach((skill, i) => {
        roleCriteria.push({
          id: `jd-pref-${i}`,
          category: "Skill Match",
          label: skill.value,
          priority: "Medium",
          maxScore: 80,
        });
      });
    }

    if (extractedCategories.certifications.length > 0) {
      extractedCategories.certifications.forEach((cert, i) => {
        roleCriteria.push({
          id: `jd-cert-${i}`,
          category: "Certifications",
          label: cert.value,
          priority: "Low",
          maxScore: 60,
        });
      });
    }

    // Combine: step 1 criteria + role-specific from JD + generic (max 12 total)
    const combined = [...step1Criteria, ...roleCriteria, ...genericCriteria].slice(0, 12);

    setGeneratedCriteria(combined);
    setStepData("rankingCriteria", combined);
  }

  function handleCriteriaConfirm(criteria: RankingCriterion[]) {
    setStepData("rankingCriteria", criteria);
    nextStep();
  }

  async function handleResumesContinue(files: File[]) {
    setStepData("resumeUpload", files);

    // Create the project in the backend before moving to processing
    const basicInfo = wizardData.basicInfo;
    if (!basicInfo) {
      nextStep();
      return;
    }

    try {
      const payload: CreateProjectRequest = {
        title: basicInfo.title,
        location: basicInfo.location,
        employment_type: basicInfo.employmentType as CreateProjectRequest["employment_type"],
        remote_preference: (basicInfo.remotePreference || "Remote") as "Remote" | "Hybrid" | "On-site",
      };

      const response = await createProject(payload);
      setProjectId(response.data.id);
    } catch (err: unknown) {
      // If backend fails, still proceed — processing will simulate
      console.error("Failed to create project:", err);
    }

    nextStep();
  }

  // Handle the shell's Next button per step
  function handleShellNext() {
    if (currentStep === 1) {
      // Trigger form submit programmatically
      const form = document.querySelector("form");
      if (form) {
        form.requestSubmit();
      } else {
        nextStep();
      }
    } else {
      // For all other steps, just advance
      nextStep();
    }
  }

  return (
    <WizardShell currentStep={currentStep} onNext={handleShellNext}>
      {currentStep === 1 && (
        <BasicInfoStep
          initialData={wizardData.basicInfo ?? undefined}
          onSubmit={handleBasicInfoSubmit}
        />
      )}

      {currentStep === 2 && (
        <JobDescriptionStep
          initialData={(wizardData.jobDescription as JobDescriptionData) ?? undefined}
          onSubmit={handleJobDescriptionSubmit}
          onBack={prevStep}
        />
      )}

      {currentStep === 3 && (
        <RankingCriteriaStep
          initialCriteria={generatedCriteria}
          onConfirm={handleCriteriaConfirm}
        />
      )}

      {currentStep === 4 && (
        <ResumeUploadStep
          onContinue={handleResumesContinue}
        />
      )}

      {currentStep === 5 && (
        <ProcessingStep
          projectId={projectId ?? ""}
          totalResumes={5}
        />
      )}
    </WizardShell>
  );
}
