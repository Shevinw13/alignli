"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { TeamMembersList } from "./team-members-list";
import { InviteMemberDialog } from "./invite-member-dialog";
import { RolePermissions } from "./role-permissions";
import type { OrganizationMember, PendingInvitation, OrgRole } from "../types";

// ─── Mock data (will be replaced by API integration in task 20) ──────────────

const mockMembers: OrganizationMember[] = [
  {
    id: "1",
    fullName: "Sarah Chen",
    email: "sarah@company.com",
    role: "Owner",
    joinedAt: "2024-06-01T00:00:00Z",
  },
  {
    id: "2",
    fullName: "James Rodriguez",
    email: "james@company.com",
    role: "Admin",
    joinedAt: "2024-07-15T00:00:00Z",
  },
  {
    id: "3",
    fullName: "Emily Park",
    email: "emily@company.com",
    role: "Hiring_Manager",
    joinedAt: "2024-08-20T00:00:00Z",
  },
  {
    id: "4",
    fullName: "Michael Torres",
    email: "michael@company.com",
    role: "Recruiter",
    joinedAt: "2024-09-10T00:00:00Z",
  },
  {
    id: "5",
    fullName: "Lisa Wang",
    email: "lisa@company.com",
    role: "Viewer",
    joinedAt: "2024-10-01T00:00:00Z",
  },
];

const mockPendingInvitations: PendingInvitation[] = [
  {
    id: "inv-1",
    email: "alex@company.com",
    role: "Hiring_Manager",
    sentAt: "2024-12-08T10:00:00Z",
    expiresAt: "2024-12-15T10:00:00Z",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function OrganizationSettings() {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [members] = useState<OrganizationMember[]>(mockMembers);
  const [pendingInvitations] = useState<PendingInvitation[]>(
    mockPendingInvitations
  );

  // Current user role — in real app, fetched from auth context
  const currentUserRole: OrgRole = "Owner";

  const canInvite = currentUserRole === "Owner" || currentUserRole === "Admin";

  function handleInvite(email: string, role: OrgRole) {
    // Will be replaced by API call in task 20
    // Sends invitation via Resend with 7-day expiry
    console.log("Inviting:", email, "with role:", role);
    setIsInviteOpen(false);
  }

  return (
    <div className="space-y-8">
      {/* Team Management Section */}
      <section aria-labelledby="team-management-heading">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="team-management-heading"
              className="text-lg font-semibold text-navy"
            >
              Team Members
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage who has access to your organization.
            </p>
          </div>

          {canInvite && (
            <Button
              className="h-9 gap-2 rounded-[12px] bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
              onClick={() => setIsInviteOpen(true)}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite Member
            </Button>
          )}
        </div>

        <div className="mt-6">
          <TeamMembersList
            members={members}
            pendingInvitations={pendingInvitations}
            currentUserRole={currentUserRole}
          />
        </div>
      </section>

      {/* Role Permissions Section */}
      <section aria-labelledby="role-permissions-heading">
        <div>
          <h2
            id="role-permissions-heading"
            className="text-lg font-semibold text-navy"
          >
            Role Permissions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Understand what each role can do within your organization.
          </p>
        </div>

        <div className="mt-6">
          <RolePermissions />
        </div>
      </section>

      {/* Invite Dialog */}
      <InviteMemberDialog
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}
