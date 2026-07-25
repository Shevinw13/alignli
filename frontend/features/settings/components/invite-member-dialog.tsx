"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AccessibleDialog } from "@/components/shared/accessible-dialog";
import { useAutoFocus } from "@/lib/hooks/use-auto-focus";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";
import type { OrgRole } from "../types";

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: OrgRole) => void;
}

const ASSIGNABLE_ROLES: { value: OrgRole; label: string; description: string }[] = [
  {
    value: "Admin",
    label: "Admin",
    description: "Full access including team management and billing",
  },
  {
    value: "Hiring_Manager",
    label: "Hiring Manager",
    description: "Create and manage hiring projects, make hiring decisions",
  },
  {
    value: "Recruiter",
    label: "Recruiter",
    description: "Upload resumes, manage candidates, send communications",
  },
  {
    value: "Viewer",
    label: "Viewer",
    description: "View-only access to projects and candidates",
  },
];

export function InviteMemberDialog({
  open,
  onClose,
  onInvite,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("Hiring_Manager");
  const [errors, setErrors] = useState<{ email?: string; role?: string }>({});
  const [isSending, setIsSending] = useState(false);
  const formRef = useAutoFocus<HTMLFormElement>();

  function validateEmail(): string | undefined {
    if (!email.trim()) return "Email address is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Please enter a valid email address";
    return undefined;
  }

  function handleEmailBlur() {
    const error = validateEmail();
    setErrors((prev) => ({ ...prev, email: error }));
  }

  function validate(): boolean {
    const newErrors: { email?: string; role?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!role) {
      newErrors.role = "Please select a role";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setIsSending(true);

    // Simulating API call — will be replaced by actual Resend integration in task 20
    setTimeout(() => {
      onInvite(email.trim(), role);
      setEmail("");
      setRole("Hiring_Manager");
      setErrors({});
      setIsSending(false);
    }, 500);
  }

  function handleClose() {
    setEmail("");
    setRole("Hiring_Manager");
    setErrors({});
    onClose();
  }

  return (
    <AccessibleDialog
      open={open}
      onClose={handleClose}
      title="Invite Team Member"
      description="Send an invitation email to add a new member to your organization. Invitations expire after 7 days."
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Email Input */}
        <div>
          <label
            htmlFor="invite-email"
            className="block text-sm font-medium text-navy"
          >
            Email Address
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            onBlur={handleEmailBlur}
            placeholder="colleague@company.com"
            className={cn(
              "mt-1.5 w-full rounded-[12px] border px-3 py-2.5 text-sm text-navy",
              "placeholder:text-muted-foreground",
              "focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20",
              errors.email ? "border-red-400" : "border-border"
            )}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            autoComplete="email"
          />
          {errors.email && (
            <p id="email-error" className="mt-1.5 text-xs text-red-600" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Role Selection */}
        <fieldset>
          <legend className="block text-sm font-medium text-navy">
            Assign Role
          </legend>
          <div className="mt-2 space-y-2">
            {ASSIGNABLE_ROLES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[12px] border p-3 transition-colors",
                  role === option.value
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-border hover:border-indigo-300 hover:bg-indigo-50/50"
                )}
              >
                <input
                  type="radio"
                  name="invite-role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className="mt-0.5 h-4 w-4 border-border text-indigo-600 focus:ring-indigo-600"
                />
                <div>
                  <span className="text-sm font-medium text-navy">
                    {option.label}
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {errors.role && (
            <p className="mt-1.5 text-xs text-red-600" role="alert">
              {errors.role}
            </p>
          )}
        </fieldset>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-[12px] px-4 text-sm font-medium"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="h-9 gap-2 rounded-[12px] bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            disabled={isSending}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {isSending ? "Sending..." : "Send Invitation"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          The invitation will be sent via email and expires after 7 days.
        </p>
      </form>
    </AccessibleDialog>
  );
}
