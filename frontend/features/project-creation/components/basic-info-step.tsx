"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
}

export function BasicInfoStep({ initialData, onSubmit }: BasicInfoStepProps) {
  const [formData, setFormData] = useState<BasicInfoData>(
    initialData ?? {
      title: "",
      location: "",
      employmentType: "",
      remotePreference: "",
      assignedManager: "",
    }
  );
  const [errors, setErrors] = useState<FieldErrors>({});

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

    return newErrors;
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
    value: string
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-navy">Basic Information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the basic details for this hiring project.
        </p>
      </div>

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
          placeholder="e.g., Senior Software Engineer"
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.title
              ? "border-red-500"
              : "border-border-default"
          )}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {formData.title.length}/100 characters
        </p>
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
          placeholder="e.g., San Francisco, CA"
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.location
              ? "border-red-500"
              : "border-border-default"
          )}
          aria-invalid={!!errors.location}
          aria-describedby={errors.location ? "location-error" : undefined}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {formData.location.length}/100 characters
        </p>
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

      {/* Submit Button */}
      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          className="h-10 rounded-[12px] bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Continue
        </Button>
      </div>
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
