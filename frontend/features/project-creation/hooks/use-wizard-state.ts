"use client";

import { useState, useCallback } from "react";
import type { BasicInfoData } from "../components/basic-info-step";

export interface WizardData {
  basicInfo: BasicInfoData | null;
  jobDescription: unknown | null;
  rankingCriteria: unknown | null;
  resumeUpload: unknown | null;
}

const TOTAL_STEPS = 5;
const DRAFT_STORAGE_KEY = "alignli_wizard_draft";

const INITIAL_WIZARD_DATA: WizardData = {
  basicInfo: null,
  jobDescription: null,
  rankingCriteria: null,
  resumeUpload: null,
};

export interface UseWizardStateReturn {
  currentStep: number;
  totalSteps: number;
  wizardData: WizardData;
  completedSteps: Set<number>;
  isDirty: boolean;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  previousStep: () => void;
  setStepData: <K extends keyof WizardData>(key: K, data: WizardData[K]) => void;
  saveDraft: () => void;
  validateStep: (step: number) => boolean;
  markCompleted: (step: number) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function useWizardState(initialStep = 1): UseWizardStateReturn {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [wizardData, setWizardData] = useState<WizardData>(INITIAL_WIZARD_DATA);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isDirty, setIsDirty] = useState(false);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  /** Navigate to the previous step without data loss */
  const previousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const setStepData = useCallback(
    <K extends keyof WizardData>(key: K, data: WizardData[K]) => {
      setWizardData((prev) => ({ ...prev, [key]: data }));
      setIsDirty(true);
    },
    []
  );

  /** Persist wizard data to localStorage and reset dirty state */
  const saveDraft = useCallback(() => {
    try {
      const serializable = {
        wizardData,
        currentStep,
        completedSteps: Array.from(completedSteps),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serializable));
      setIsDirty(false);
    } catch {
      // localStorage may be unavailable (SSR, private browsing, quota exceeded)
      // Silently fail — UI can show a toast if needed
    }
  }, [wizardData, currentStep, completedSteps]);

  /** Validate a given step. Returns true for now — will be wired to real validation later. */
  const validateStep = useCallback((_step: number): boolean => {
    return true;
  }, []);

  /** Mark a step as completed */
  const markCompleted = useCallback((step: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  }, []);

  return {
    currentStep,
    totalSteps: TOTAL_STEPS,
    wizardData,
    completedSteps,
    isDirty,
    goToStep,
    nextStep,
    prevStep,
    previousStep,
    setStepData,
    saveDraft,
    validateStep,
    markCompleted,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === TOTAL_STEPS,
  };
}
