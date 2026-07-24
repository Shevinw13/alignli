"use client";

import { WizardProvider } from "./wizard-context";
import { WizardShell } from "./components/wizard-shell";
import { useWizardContext } from "./wizard-context";
import type { ReactNode } from "react";

interface WizardLayoutProps {
  children: ReactNode;
}

/**
 * WizardLayout wraps the wizard steps with the provider and shell.
 * Usage: Wrap all wizard step content inside this component.
 */
export function WizardLayout({ children }: WizardLayoutProps) {
  return (
    <WizardProvider>
      <WizardLayoutInner>{children}</WizardLayoutInner>
    </WizardProvider>
  );
}

function WizardLayoutInner({ children }: { children: ReactNode }) {
  const { currentStep } = useWizardContext();

  return <WizardShell currentStep={currentStep}>{children}</WizardShell>;
}
