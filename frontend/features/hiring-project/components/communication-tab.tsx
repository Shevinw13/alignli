"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CharacterCounter } from "@/components/ui/character-counter";
import { useAutoFocus } from "@/lib/hooks/use-auto-focus";
import { cn } from "@/lib/utils";
import { Send, Mail, AlertCircle } from "lucide-react";

// --- Types ---

type DeliveryStatus = "sent" | "failed" | "pending";

interface EmailHistoryEntry {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  sentAt: string;
  deliveryStatus: DeliveryStatus;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
}

interface ComposeFormData {
  recipientCandidateId: string;
  subject: string;
  body: string;
}

interface FieldErrors {
  recipientCandidateId?: string;
  subject?: string;
  body?: string;
}

// --- Mock Data ---

const MOCK_CANDIDATES: Candidate[] = [
  { id: "c1", name: "Alice Johnson", email: "alice.johnson@example.com" },
  { id: "c2", name: "Bob Williams", email: "bob.williams@example.com" },
  { id: "c3", name: "Carlos Martinez", email: "carlos.m@example.com" },
  { id: "c4", name: "Diana Chen", email: "diana.chen@example.com" },
];

const MOCK_EMAIL_HISTORY: EmailHistoryEntry[] = [
  {
    id: "e1",
    sender: "hiring@brightwell.io",
    recipient: "alice.johnson@example.com",
    subject: "Interview Invitation — Senior Software Engineer",
    sentAt: "2024-06-15T14:30:00Z",
    deliveryStatus: "sent",
  },
  {
    id: "e2",
    sender: "hiring@brightwell.io",
    recipient: "bob.williams@example.com",
    subject: "Next Steps in Your Application",
    sentAt: "2024-06-14T09:15:00Z",
    deliveryStatus: "sent",
  },
  {
    id: "e3",
    sender: "hiring@brightwell.io",
    recipient: "carlos.m@example.com",
    subject: "Schedule Confirmation",
    sentAt: "2024-06-13T16:45:00Z",
    deliveryStatus: "failed",
  },
  {
    id: "e4",
    sender: "hiring@brightwell.io",
    recipient: "diana.chen@example.com",
    subject: "Welcome to the Interview Process",
    sentAt: "2024-06-12T11:00:00Z",
    deliveryStatus: "pending",
  },
];

// --- Status Badge ---

const statusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  sent: {
    label: "Sent",
    className: "bg-emerald-50 text-emerald-700",
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-700",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700",
  },
};

function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

// --- Compose Form ---

function ComposeForm({
  candidates,
  onSend,
  sendError,
}: {
  candidates: Candidate[];
  onSend: (data: ComposeFormData) => void;
  sendError: string | null;
}) {
  const formRef = useAutoFocus<HTMLFormElement>();
  const [formData, setFormData] = useState<ComposeFormData>({
    recipientCandidateId: "",
    subject: "",
    body: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  function validateField(field: keyof ComposeFormData): string | undefined {
    switch (field) {
      case "recipientCandidateId":
        if (!formData.recipientCandidateId) return "Recipient is required";
        return undefined;
      case "subject":
        if (!formData.subject.trim()) return "Subject is required";
        if (formData.subject.length > 255) return "Subject must be 255 characters or fewer";
        return undefined;
      case "body":
        if (!formData.body.trim()) return "Body is required";
        if (formData.body.length > 10000) return "Body must be 10,000 characters or fewer";
        return undefined;
    }
  }

  function handleBlur(field: keyof ComposeFormData) {
    const error = validateField(field);
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

  function validate(): FieldErrors {
    const newErrors: FieldErrors = {};

    if (!formData.recipientCandidateId) {
      newErrors.recipientCandidateId = "Recipient is required";
    }

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    } else if (formData.subject.length > 255) {
      newErrors.subject = "Subject must be 255 characters or fewer";
    }

    if (!formData.body.trim()) {
      newErrors.body = "Body is required";
    } else if (formData.body.length > 10000) {
      newErrors.body = "Body must be 10,000 characters or fewer";
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
    onSend(formData);
  }

  function handleChange(field: keyof ComposeFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter-to-submit on single-line input (subject field)
    if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-indigo-600" aria-hidden="true" />
        <h3 className="text-base font-semibold text-navy">Compose Email</h3>
      </div>

      {sendError && (
        <div
          className="flex items-start gap-2 rounded-[12px] border border-red-200 bg-red-50 p-3"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-sm text-red-700">{sendError}</p>
        </div>
      )}

      {/* Recipient */}
      <FormField
        label="Recipient"
        htmlFor="recipient"
        error={errors.recipientCandidateId}
        required
      >
        <select
          id="recipient"
          value={formData.recipientCandidateId}
          onChange={(e) => handleChange("recipientCandidateId", e.target.value)}
          onBlur={() => handleBlur("recipientCandidateId")}
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy outline-none transition-colors appearance-none bg-white",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.recipientCandidateId ? "border-red-500" : "border-border-default",
            !formData.recipientCandidateId && "text-muted-foreground"
          )}
          aria-invalid={!!errors.recipientCandidateId}
          aria-describedby={
            errors.recipientCandidateId ? "recipient-error" : undefined
          }
        >
          <option value="" disabled>
            Select a candidate
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} ({candidate.email})
            </option>
          ))}
        </select>
      </FormField>

      {/* Subject */}
      <FormField
        label="Subject"
        htmlFor="subject"
        error={errors.subject}
        required
      >
        <input
          id="subject"
          type="text"
          maxLength={255}
          value={formData.subject}
          onChange={(e) => handleChange("subject", e.target.value)}
          onBlur={() => handleBlur("subject")}
          placeholder="Email subject"
          className={cn(
            "w-full rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.subject ? "border-red-500" : "border-border-default"
          )}
          aria-invalid={!!errors.subject}
          aria-describedby={errors.subject ? "subject-error" : "subject-counter"}
        />
        <CharacterCounter current={formData.subject.length} max={255} className="mt-1" />
      </FormField>

      {/* Body */}
      <FormField
        label="Body"
        htmlFor="body"
        error={errors.body}
        required
      >
        <textarea
          id="body"
          maxLength={10000}
          rows={6}
          value={formData.body}
          onChange={(e) => handleChange("body", e.target.value)}
          onBlur={() => handleBlur("body")}
          placeholder="Write your message..."
          className={cn(
            "w-full resize-y rounded-[12px] border px-4 py-2.5 text-sm text-navy placeholder:text-muted-foreground outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            errors.body ? "border-red-500" : "border-border-default"
          )}
          aria-invalid={!!errors.body}
          aria-describedby={errors.body ? "body-error" : "body-counter"}
        />
        <CharacterCounter current={formData.body.length} max={10000} className="mt-1" />
      </FormField>

      {/* Send Button */}
      <div className="pt-1">
        <Button
          type="submit"
          className="h-9 rounded-[12px] bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Send
        </Button>
      </div>
    </form>
  );
}

// --- Email History ---

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmailHistoryList({ emails }: { emails: EmailHistoryEntry[] }) {
  if (emails.length === 0) {
    return (
      <div className="rounded-[16px] border border-border bg-white p-8 text-center">
        <Mail className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">
          No communications yet
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-white">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-border bg-gray-50/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Sender
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Recipient
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Subject
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Date/Time
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr
              key={email.id}
              className="border-b border-border last:border-b-0 hover:bg-gray-50/30"
            >
              <td className="px-4 py-3 text-navy">{email.sender}</td>
              <td className="px-4 py-3 text-navy">{email.recipient}</td>
              <td className="max-w-[200px] truncate px-4 py-3 text-navy">
                {email.subject}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {formatDate(email.sentAt)}
              </td>
              <td className="px-4 py-3">
                <DeliveryStatusBadge status={email.deliveryStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Main Component ---

export function CommunicationTab() {
  const [emailHistory] = useState<EmailHistoryEntry[]>(MOCK_EMAIL_HISTORY);
  const [sendError, setSendError] = useState<string | null>(null);

  function handleSend(data: ComposeFormData) {
    // Mock send — in the future this would call the API
    // For now simulate potential failure handling
    setSendError(null);

    const candidate = MOCK_CANDIDATES.find(
      (c) => c.id === data.recipientCandidateId
    );

    if (!candidate) {
      setSendError("Selected candidate not found. Please try again.");
      return;
    }

    // Simulate a successful send by logging to console
    // The real implementation will POST to /api/v1/communication/send
    console.log("Sending email:", {
      to: candidate.email,
      subject: data.subject,
      body: data.body,
    });
  }

  return (
    <div className="space-y-8">
      {/* Compose Form Section */}
      <section
        className="rounded-[16px] border border-border bg-white p-6"
        aria-labelledby="compose-heading"
      >
        <ComposeForm
          candidates={MOCK_CANDIDATES}
          onSend={handleSend}
          sendError={sendError}
        />
      </section>

      {/* Email History Section */}
      <section aria-labelledby="history-heading">
        <h3
          id="history-heading"
          className="mb-4 text-base font-semibold text-navy"
        >
          Email History
        </h3>
        <EmailHistoryList emails={emailHistory} />
      </section>
    </div>
  );
}

// --- Helper Component ---

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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-navy">
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
