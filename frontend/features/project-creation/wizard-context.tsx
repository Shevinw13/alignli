"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useWizardState,
  type WizardData,
  type UseWizardStateReturn,
} from "./hooks/use-wizard-state";

const WizardContext = createContext<UseWizardStateReturn | null>(null);

interface WizardProviderProps {
  children: ReactNode;
  initialStep?: number;
}

export function WizardProvider({ children, initialStep }: WizardProviderProps) {
  const wizardState = useWizardState(initialStep);

  return (
    <WizardContext.Provider value={wizardState}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizardContext(): UseWizardStateReturn {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizardContext must be used within a WizardProvider");
  }
  return context;
}

export type { WizardData, UseWizardStateReturn };
