"use client";

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
import { useWizardState } from "@/features/project-creation/hooks/use-wizard-state";
import { WizardProvider, useWizardContext } from "@/features/project-creation/wizard-context";

export default function NewProjectPage() {
  return (
    <WizardProvider>
      <NewProjectWizard />
    </WizardProvider>
  );
}

function NewProjectWizard() {
  const { currentStep, wizardData, nextStep, prevStep, setStepData } = useWizardContext();

  function handleBasicInfoSubmit(data: BasicInfoData) {
    setStepData("basicInfo", data);
    nextStep();
  }

  function handleJobDescriptionSubmit(data: JobDescriptionData) {
    setStepData("jobDescription", data);
    nextStep();
  }

  function handleCriteriaConfirm(criteria: RankingCriterion[]) {
    setStepData("rankingCriteria", criteria);
    nextStep();
  }

  function handleResumesContinue(files: File[]) {
    setStepData("resumes", files);
    nextStep();
  }

  return (
    <WizardShell currentStep={currentStep}>
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
          initialCriteria={wizardData.rankingCriteria as RankingCriterion[] | undefined}
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
          projectId="mock-project-id"
          totalResumes={5}
        />
      )}
    </WizardShell>
  );
}
