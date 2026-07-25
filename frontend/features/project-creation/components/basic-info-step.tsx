"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CharacterCounter } from "@/components/ui/character-counter";
import { AISuggestionCard } from "@/components/shared/ai-suggestion-card";
import { useAutoFocus } from "@/lib/hooks/use-auto-focus";
import { cn } from "@/lib/utils";

const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
] as const;

const REMOTE_PREFERENCES = ["Remote", "Hybrid", "On-site"] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type RemotePreference = (typeof REMOTE_PREFERENCES)[number];

export interface BasicInfoData {
  title: string;
  location: string;
  employmentType: EmploymentType | "";
  remotePreference: RemotePreference | "";
  assignedManager: string;
  minYearsExperience: string;
  /** Salary range */
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  /** Agency fields — only shown when isAgency is true */
  isAgency: boolean;
  clientCompany: string;
  commissionType: "percentage" | "flat" | "";
  commissionValue: string;
}

interface BasicInfoStepProps {
  initialData?: BasicInfoData;
  onSubmit: (data: BasicInfoData) => void;
}

interface FieldErrors {
  title?: string;
  location?: string;
  employmentType?: string;
  remotePreference?: string;
  assignedManager?: string;
  minYearsExperience?: string;
  clientCompany?: string;
  commissionType?: string;
  commissionValue?: string;
}

// Mock: simulate that previous projects exist to enable smart defaults
const MOCK_PREVIOUS_PROJECTS = [
  { title: "Senior Backend Engineer", employmentType: "Full-time" as const, remotePreference: "Remote" as const },
  { title: "Product Manager", employmentType: "Full-time" as const, remotePreference: "Hybrid" as const },
];

function getSmartDefaults(): { employmentType: EmploymentType; remotePreference: RemotePreference } | null {
  if (MOCK_PREVIOUS_PROJECTS.length === 0) return null;

  // Find the most common employment type and remote preference from previous projects
  const typeCounts: Record<string, number> = {};
  const remoteCounts: Record<string, number> = {};

  for (const project of MOCK_PREVIOUS_PROJECTS) {
    typeCounts[project.employmentType] = (typeCounts[project.employmentType] || 0) + 1;
    remoteCounts[project.remotePreference] = (remoteCounts[project.remotePreference] || 0) + 1;
  }

  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as EmploymentType;
  const topRemote = Object.entries(remoteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as RemotePreference;

  return { employmentType: topType, remotePreference: topRemote };
}

export function BasicInfoStep({ initialData, onSubmit }: BasicInfoStepProps) {
  const containerRef = useAutoFocus<HTMLFormElement>();
  const [formData, setFormData] = useState<BasicInfoData>(
    initialData ?? {
      title: "",
      location: "",
      employmentType: "",
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
    }
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showSuggestion, setShowSuggestion] = useState(false);
  const smartDefaults = getSmartDefaults();

  // Show smart default suggestion if previous projects exist and fields are empty
  useEffect(() => {
    if (smartDefaults && !initialData?.employmentType && !initialData?.remotePreference) {
      setShowSuggestion(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applySmartDefaults() {
    if (!smartDefaults) return;
    setFormData((prev) => ({
      ...prev,
      employmentType: prev.employmentType || smartDefaults.employmentType,
      remotePreference: prev.remotePreference || smartDefaults.remotePreference,
    }));
    setShowSuggestion(false);
  }

  function validate(): FieldErrors {
    const newErrors: FieldErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 100) {
      newErrors.title = "Title must be 100 characters or less";
    }

    if (!formData.location.trim()) {
      newErrors.location = "Location is required";
    } else if (formData.location.length > 100) {
      newErrors.location = "Location must be 100 characters or less";
    }

    if (!formData.employmentType) {
      newErrors.employmentType = "Employment type is required";
    }

    if (!formData.remotePreference) {
      newErrors.remotePreference = "Remote preference is required";
    }

    if (!formData.assignedManager.trim()) {
      newErrors.assignedManager = "Assigned Hiring Manager is required";
    }

    if (!formData.minYearsExperience.trim()) {
      newErrors.minYearsExperience = "Minimum years of experience is required";
    } else {
      const years = parseInt(formData.minYearsExperience, 10);
      if (isNaN(years) || years < 0 || years > 30) {
        newErrors.minYearsExperience = "Please enter a number between 0 and 30";
      }
    }

    if (formData.isAgency && !formData.clientCompany.trim()) {
      newErrors.clientCompany = "Client company is required for agency roles";
    }

    return newErrors;
  }

  function validateField(field: keyof BasicInfoData): void {
    const fieldValidators: Record<keyof BasicInfoData, () => string | undefined> = {
      title: () => {
        if (!formData.title.trim()) return "Title is required";
        if (formData.title.length > 100) return "Title must be 100 characters or less";
        return undefined;
      },
      location: () => {
        if (!formData.location.trim()) return "Location is required";
        if (formData.location.length > 100) return "Location must be 100 characters or less";
        return undefined;
      },
      employmentType: () => {
        if (!formData.employmentType) return "Employment type is required";
        return undefined;
      },
      remotePreference: () => {
        if (!formData.remotePreference) return "Remote preference is required";
        return undefined;
      },
      assignedManager: () => {
        if (!formData.assignedManager.trim()) return "Assigned Hiring Manager is required";
        return undefined;
      },
      minYearsExperience: () => {
        if (!formData.minYearsExperience.trim()) return "Minimum years of experience is required";
        const years = parseInt(formData.minYearsExperience, 10);
        if (isNaN(years) || years < 0 || years > 30) return "Please enter a number between 0 and 30";
        return undefined;
      },
      clientCompany: () => {
        if (formData.isAgency && !formData.clientCompany.trim()) return "Client company is required for agency roles";
        return undefined;
      },
      commissionType: () => undefined,
      commissionValue: () => undefined,
    };

    const error = fieldValidators[field]();
    setErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    onSubmit(formData);
  }

  function handleChange(
    field: keyof BasicInfoData,
    value: string | boolean
  ) {
    setFormData((prev) => ({ ...prev, [field]: field === "isAgency" ? value === "true" || value === true : value }));
    // Clear error on change
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FieldErrors];
        return next;
      });
    }
  }

  return (
    <form ref={containerRef} onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-navy">Basic Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the basic details for this hiring project.
        </p>
      </div>

      {/* Smart defaults suggestion */}
      {showSuggestion && smartDefaults && (
        <AISuggestionCard
          suggestion={`Based on your previous projects, we suggest "${smartDefaults.employmentType}" employment and "${smartDefaults.remotePreference}" work arrangement.`}
          title="Smart Defaults Available"
          actionLabel="Apply suggestions"
          onAction={applySmartDefaults}
          onDismiss={() => setShowSuggestion(false)}
        />
      )}

      {/* Title */}
      <FormField
        label="Project Title"
        htmlFor="title"
        error={errors.title}
        required
      >
        <input
          id="title"
          type="text"
          maxLength={100}
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          onBlur={() => validateField("title")}
          placeholder="e.g., Senior Software Engineer"
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.title
              ? "border-red-500"
              : "border-border-default"
          )}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : "title-counter"}
        />
        <CharacterCounter current={formData.title.length} max={100} className="mt-1" />
      </FormField>

      {/* Location */}
      <FormField
        label="Location"
        htmlFor="location"
        error={errors.location}
        required
      >
        <input
          id="location"
          type="text"
          maxLength={100}
          value={formData.location}
          onChange={(e) => handleChange("location", e.target.value)}
          onBlur={() => validateField("location")}
          placeholder="e.g., San Francisco, CA"
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.location
              ? "border-red-500"
              : "border-border-default"
          )}
          aria-invalid={!!errors.location}
          aria-describedby={errors.location ? "location-error" : "location-counter"}
        />
        <CharacterCounter current={formData.location.length} max={100} className="mt-1" />
      </FormField>

      {/* Employment Type */}
      <FormField
        label="Employment Type"
        htmlFor="employmentType"
        error={errors.employmentType}
        required
      >
        <select
          id="employmentType"
          value={formData.employmentType}
          onChange={(e) => handleChange("employmentType", e.target.value)}
          onBlur={() => validateField("employmentType")}
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy outline-none transition-colors appearance-none bg-white",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.employmentType
              ? "border-red-500"
              : "border-border-default",
            !formData.employmentType && "text-muted-foreground"
          )}
          aria-invalid={!!errors.employmentType}
          aria-describedby={
            errors.employmentType ? "employmentType-error" : undefined
          }
        >
          <option value="" disabled>
            Select employment type
          </option>
          {EMPLOYMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </FormField>

      {/* Remote Preference */}
      <FormField
        label="Remote Preference"
        htmlFor="remotePreference"
        error={errors.remotePreference}
        required
      >
        <select
          id="remotePreference"
          value={formData.remotePreference}
          onChange={(e) => handleChange("remotePreference", e.target.value)}
          onBlur={() => validateField("remotePreference")}
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy outline-none transition-colors appearance-none bg-white",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.remotePreference
              ? "border-red-500"
              : "border-border-default",
            !formData.remotePreference && "text-muted-foreground"
          )}
          aria-invalid={!!errors.remotePreference}
          aria-describedby={
            errors.remotePreference ? "remotePreference-error" : undefined
          }
        >
          <option value="" disabled>
            Select remote preference
          </option>
          {REMOTE_PREFERENCES.map((pref) => (
            <option key={pref} value={pref}>
              {pref}
            </option>
          ))}
        </select>
      </FormField>

      {/* Assigned Manager */}
      <FormField
        label="Assigned Hiring Manager"
        htmlFor="assignedManager"
        error={errors.assignedManager}
        required
      >
        <input
          id="assignedManager"
          type="text"
          value={formData.assignedManager}
          onChange={(e) => handleChange("assignedManager", e.target.value)}
          onBlur={() => validateField("assignedManager")}
          placeholder="e.g., Jane Smith"
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.assignedManager
              ? "border-red-500"
              : "border-border-default"
          )}
          aria-invalid={!!errors.assignedManager}
          aria-describedby={
            errors.assignedManager ? "assignedManager-error" : undefined
          }
        />
      </FormField>

      {/* Minimum Years of Experience */}
      <FormField
        label="Minimum Years of Relevant Experience"
        htmlFor="minYearsExperience"
        error={errors.minYearsExperience}
        required
      >
        <input
          id="minYearsExperience"
          type="number"
          min={0}
          max={30}
          value={formData.minYearsExperience}
          onChange={(e) => handleChange("minYearsExperience", e.target.value)}
          onBlur={() => validateField("minYearsExperience")}
          placeholder="e.g., 3"
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.minYearsExperience
              ? "border-red-500"
              : "border-border-default"
          )}
          aria-invalid={!!errors.minYearsExperience}
          aria-describedby={
            errors.minYearsExperience ? "minYearsExperience-error" : undefined
          }
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Candidates with fewer years will be scored lower on the experience criterion.
        </p>
      </FormField>

      {/* Salary Range */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-navy">
          Salary Range
        </label>
        <div className="grid grid-cols-[80px_1fr_auto_1fr] items-center gap-2">
          <select
            value={formData.salaryCurrency}
            onChange={(e) => handleChange("salaryCurrency", e.target.value)}
            className={cn(
              "rounded-[12px] border px-2 py-2.5 text-sm text-navy outline-none transition-colors appearance-none bg-white",
              "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
              "border-border-default"
            )}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
          </select>
          <input
            type="number"
            min={0}
            value={formData.salaryMin}
            onChange={(e) => handleChange("salaryMin", e.target.value)}
            placeholder="Min (e.g., 80000)"
            className={cn(
              "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
              "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
              "border-border-default"
            )}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="number"
            min={0}
            value={formData.salaryMax}
            onChange={(e) => handleChange("salaryMax", e.target.value)}
            placeholder="Max (e.g., 120000)"
            className={cn(
              "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
              "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
              "border-border-default"
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. Used for budget tracking and commission calculations.
        </p>
      </div>

      {/* Agency toggle + fields */}
      <div className="space-y-4 rounded-[12px] border border-border p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isAgency}
            onChange={(e) => handleChange("isAgency", e.target.checked)}
            className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-600"
          />
          <div>
            <span className="text-sm font-medium text-navy">
              Recruiting for a client company
            </span>
            <p className="text-xs text-muted-foreground">
              Enable if you're an agency or external recruiter filling this role for another company.
            </p>
          </div>
        </label>

        {formData.isAgency && (
          <div className="space-y-4 pl-7">
            {/* Client Company */}
            <FormField
              label="Client Company"
              htmlFor="clientCompany"
              error={errors.clientCompany}
              required
            >
              <input
                id="clientCompany"
                type="text"
                value={formData.clientCompany}
                onChange={(e) => handleChange("clientCompany", e.target.value)}
                onBlur={() => validateField("clientCompany")}
                placeholder="e.g., Acme Corp"
                className={cn(
                  "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
                  "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
                  errors.clientCompany ? "border-red-500" : "border-border-default"
                )}
                aria-invalid={!!errors.clientCompany}
              />
            </FormField>

            {/* Commission */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Commission Type"
                htmlFor="commissionType"
                error={errors.commissionType}
              >
                <select
                  id="commissionType"
                  value={formData.commissionType}
                  onChange={(e) => handleChange("commissionType", e.target.value)}
                  className={cn(
                    "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy outline-none transition-colors appearance-none bg-white",
                    "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
                    "border-border-default",
                    !formData.commissionType && "text-muted-foreground"
                  )}
                >
                  <option value="">None</option>
                  <option value="percentage">Percentage of salary</option>
                  <option value="flat">Flat fee</option>
                </select>
              </FormField>

              {formData.commissionType && (
                <FormField
                  label={formData.commissionType === "percentage" ? "Commission %" : "Fee Amount ($)"}
                  htmlFor="commissionValue"
                  error={errors.commissionValue}
                >
                  <input
                    id="commissionValue"
                    type="number"
                    min={0}
                    value={formData.commissionValue}
                    onChange={(e) => handleChange("commissionValue", e.target.value)}
                    placeholder={formData.commissionType === "percentage" ? "e.g., 20" : "e.g., 15000"}
                    className={cn(
                      "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
                      "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
                      "border-border-default"
                    )}
                  />
                </FormField>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden submit for Enter key support — actual navigation via WizardShell footer */}
      <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
    </form>
  );
}

/* ---- Helper Component ---- */

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FormField({
  label,
  htmlFor,
  error,
  required,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-navy"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p
          id={`${htmlFor}-error`}
          className="text-sm text-red-500"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
