"use client";

import { Mail, Phone, Globe, Link2, ExternalLink } from "lucide-react";
import { SectionCard } from "./section-card";

interface ContactInfoProps {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  websiteUrl: string | null;
}

interface ContactItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}

function ContactItem({ icon, label, value, href }: ContactItemProps) {
  const content = (
    <div className="flex items-center gap-3 rounded-[8px] px-3 py-2 transition-colors hover:bg-gray-50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-navy">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 rounded-[8px]"
        aria-label={`${label}: ${value} (opens in new tab)`}
      >
        {content}
      </a>
    );
  }

  return content;
}

/**
 * Contact Info section — Email, Phone, LinkedIn, GitHub, Portfolio, Website.
 *
 * Requirement 11.1
 */
export function ContactInfo({
  email,
  phone,
  linkedinUrl,
  githubUrl,
  portfolioUrl,
  websiteUrl,
}: ContactInfoProps) {
  const hasAnyContact = email || phone || linkedinUrl || githubUrl || portfolioUrl || websiteUrl;

  return (
    <SectionCard
      title="Contact Info"
      icon={<Link2 className="h-5 w-5" aria-hidden="true" />}
    >
      {hasAnyContact ? (
        <div className="grid gap-1 sm:grid-cols-2">
          {email && (
            <ContactItem
              icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              label="Email"
              value={email}
              href={`mailto:${email}`}
            />
          )}
          {phone && (
            <ContactItem
              icon={<Phone className="h-4 w-4" aria-hidden="true" />}
              label="Phone"
              value={phone}
              href={`tel:${phone}`}
            />
          )}
          {linkedinUrl && (
            <ContactItem
              icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
              label="LinkedIn"
              value={linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
              href={linkedinUrl}
            />
          )}
          {githubUrl && (
            <ContactItem
              icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
              label="GitHub"
              value={githubUrl.replace(/^https?:\/\/(www\.)?/, "")}
              href={githubUrl}
            />
          )}
          {portfolioUrl && (
            <ContactItem
              icon={<Globe className="h-4 w-4" aria-hidden="true" />}
              label="Portfolio"
              value={portfolioUrl.replace(/^https?:\/\/(www\.)?/, "")}
              href={portfolioUrl}
            />
          )}
          {websiteUrl && (
            <ContactItem
              icon={<Globe className="h-4 w-4" aria-hidden="true" />}
              label="Website"
              value={websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
              href={websiteUrl}
            />
          )}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No contact information available.
        </p>
      )}
    </SectionCard>
  );
}
