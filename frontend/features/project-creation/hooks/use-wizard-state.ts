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
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStepData: <K extends keyof WizardData>(key: K, data: WizardData[K]) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

export function useWizardState(initialStep = 1): UseWizardStateReturn {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [wizardData, setWizardData] = useState<WizardData>(INITIAL_WIZARD_DATA);

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

  const setStepData = useCallback(
    <K extends keyof WizardData>(key: K, data: WizardData[K]) => {
      setWizardData((prev) => ({ ...prev, [key]: data }));
    },
    []
  );

  return {
    currentStep,
    totalSteps: TOTAL_STEPS,
    wizardData,
    goToStep,
    nextStep,
    prevStep,
    setStepData,
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === TOTAL_STEPS,
  };
}
