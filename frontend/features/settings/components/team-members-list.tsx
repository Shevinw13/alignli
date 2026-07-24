"use client";

import { cn } from "@/lib/utils";
import { Clock, Mail, Shield, User } from "lucide-react";
import type { OrganizationMember, PendingInvitation, OrgRole } from "../types";

interface TeamMembersListProps {
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
  currentUserRole: OrgRole;
}

const ROLE_STYLES: Record<OrgRole, string> = {
  Owner: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Admin: "bg-purple-50 text-purple-700 border-purple-200",
  Hiring_Manager: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Recruiter: "bg-amber-50 text-amber-700 border-amber-200",
  Viewer: "bg-gray-50 text-gray-700 border-gray-200",
};

const ROLE_LABELS: Record<OrgRole, string> = {
  Owner: "Owner",
  Admin: "Admin",
  Hiring_Manager: "Hiring Manager",
  Recruiter: "Recruiter",
  Viewer: "Viewer",
};

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function daysUntilExpiry(expiresAt: string): number {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function TeamMembersList({
  members,
  pendingInvitations,
  currentUserRole,
}: TeamMembersListProps) {
  return (
    <div className="space-y-6">
      {/* Active Members */}
      <div
        className="rounded-[16px] border border-border bg-white"
        role="table"
        aria-label="Organization members"
      >
        {/* Table header */}
        <div
          className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-3 md:grid-cols-[1fr_160px_140px]"
          role="row"
        >
          <span
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            role="columnheader"
          >
            Member
          </span>
          <span
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            role="columnheader"
          >
            Role
          </span>
          <span
            className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:block"
            role="columnheader"
          >
            Joined
          </span>
        </div>

        {/* Member rows */}
        {members.map((member) => (
          <div
            key={member.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[1fr_160px_140px]"
            role="row"
          >
            <div className="flex items-center gap-3" role="cell">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50"
                aria-hidden="true"
              >
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy">
                  {member.fullName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email}
                </p>
              </div>
            </div>

            <div role="cell">
              <RoleBadge role={member.role} />
            </div>

            <div
              className="hidden text-sm text-muted-foreground md:block"
              role="cell"
            >
              {formatDate(member.joinedAt)}
            </div>
          </div>
        ))}
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy">
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Pending Invitations
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-700">
              {pendingInvitations.length}
            </span>
          </h3>

          <div className="mt-3 space-y-2">
            {pendingInvitations.map((invitation) => {
              const expired = isExpired(invitation.expiresAt);
              const daysLeft = daysUntilExpiry(invitation.expiresAt);

              return (
                <div
                  key={invitation.id}
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-[12px] border px-4 py-3",
                    expired
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        expired ? "bg-red-100" : "bg-amber-100"
                      )}
                      aria-hidden="true"
                    >
                      <Mail
                        className={cn(
                          "h-4 w-4",
                          expired ? "text-red-600" : "text-amber-600"
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy">
                        {invitation.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Invited {formatDate(invitation.sentAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <RoleBadge role={invitation.role} />
                    <div className="flex items-center gap-1">
                      <Clock
                        className={cn(
                          "h-3.5 w-3.5",
                          expired ? "text-red-500" : "text-amber-600"
                        )}
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          "text-xs font-medium",
                          expired ? "text-red-600" : "text-amber-700"
                        )}
                      >
                        {expired ? "Expired" : `${daysLeft}d left`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Invitations expire after 7 days. Expired invitations must be re-sent.
          </p>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        ROLE_STYLES[role]
      )}
    >
      <Shield className="h-3 w-3" aria-hidden="true" />
      {ROLE_LABELS[role]}
    </span>
  );
}
