"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Copy,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldAlert,
  Trash2,
  User,
  UserCog,
  Users,
  RefreshCw,
} from "lucide-react";
import { DataTable, type Column, type BulkAction } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { OrganizationMember, PendingInvitation, OrgRole } from "../types";

// --- Combined row type for DataTable ---

type MemberStatus = "active" | "pending" | "suspended";

interface TeamMemberRow {
  id: string;
  name: string;
  email: string;
  role: OrgRole;
  status: MemberStatus;
  dateAdded: string;
  /** Original data for pending invitations */
  invitation?: PendingInvitation;
  /** Original data for members */
  member?: OrganizationMember;
}

interface TeamMembersListProps {
  members: OrganizationMember[];
  pendingInvitations: PendingInvitation[];
  currentUserRole: OrgRole;
  onChangeRole?: (memberId: string, newRole: OrgRole) => void;
  onRemoveUser?: (memberId: string) => void;
  onSuspendUser?: (memberId: string) => void;
  onResendInvitation?: (invitationId: string) => void;
  onCopyInvitationLink?: (invitationId: string) => void;
  onInviteMember?: () => void;
}

// --- Constants ---

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

const STATUS_STYLES: Record<MemberStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  suspended: "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Active",
  pending: "Pending",
  suspended: "Suspended",
};

const ALL_ROLES: OrgRole[] = ["Owner", "Admin", "Hiring_Manager", "Recruiter", "Viewer"];
const ALL_STATUSES: MemberStatus[] = ["active", "pending", "suspended"];

// --- Helpers ---

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

// --- Main Component ---

export function TeamMembersList({
  members,
  pendingInvitations,
  currentUserRole,
  onChangeRole,
  onRemoveUser,
  onSuspendUser,
  onResendInvitation,
  onCopyInvitationLink,
  onInviteMember,
}: TeamMembersListProps) {
  // --- State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<OrgRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: "default" | "destructive";
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    variant: "default",
    onConfirm: () => {},
  });
  const [roleChangeDialog, setRoleChangeDialog] = useState<{
    open: boolean;
    memberId: string;
    currentRole: OrgRole;
  }>({
    open: false,
    memberId: "",
    currentRole: "Viewer",
  });
  const [selectedNewRole, setSelectedNewRole] = useState<OrgRole>("Viewer");

  // --- Transform data into unified rows ---
  const rows: TeamMemberRow[] = useMemo(() => {
    const memberRows: TeamMemberRow[] = members.map((m) => ({
      id: m.id,
      name: m.fullName,
      email: m.email,
      role: m.role,
      status: "active" as MemberStatus,
      dateAdded: m.joinedAt,
      member: m,
    }));

    const invitationRows: TeamMemberRow[] = pendingInvitations.map((inv) => ({
      id: inv.id,
      name: inv.email,
      email: inv.email,
      role: inv.role,
      status: "pending" as MemberStatus,
      dateAdded: inv.sentAt,
      invitation: inv,
    }));

    return [...memberRows, ...invitationRows];
  }, [members, pendingInvitations]);

  // --- Filtered data based on role and status filters ---
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });
  }, [rows, roleFilter, statusFilter]);

  // --- Permission checks ---
  const canManageMembers = currentUserRole === "Owner" || currentUserRole === "Admin";

  // --- Handlers ---
  const handleRemoveUser = useCallback(
    (memberId: string) => {
      const row = rows.find((r) => r.id === memberId);
      setConfirmDialog({
        open: true,
        title: "Remove User",
        description: `Are you sure you want to remove ${row?.name || "this user"} from the organization? They will lose access to all projects and data.`,
        variant: "destructive",
        onConfirm: () => {
          onRemoveUser?.(memberId);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          setMenuOpenId(null);
        },
      });
    },
    [rows, onRemoveUser]
  );

  const handleBulkRemove = useCallback(
    (ids: Set<string>) => {
      setConfirmDialog({
        open: true,
        title: "Remove Selected Users",
        description: `Are you sure you want to remove ${ids.size} user(s) from the organization? They will lose access to all projects and data.`,
        variant: "destructive",
        onConfirm: () => {
          ids.forEach((id) => onRemoveUser?.(id));
          setSelectedIds(new Set());
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
    },
    [onRemoveUser]
  );

  const handleChangeRole = useCallback(
    (memberId: string) => {
      const row = rows.find((r) => r.id === memberId);
      if (!row) return;
      setSelectedNewRole(row.role);
      setRoleChangeDialog({
        open: true,
        memberId,
        currentRole: row.role,
      });
      setMenuOpenId(null);
    },
    [rows]
  );

  const handleConfirmRoleChange = useCallback(() => {
    onChangeRole?.(roleChangeDialog.memberId, selectedNewRole);
    setRoleChangeDialog((prev) => ({ ...prev, open: false }));
  }, [onChangeRole, roleChangeDialog.memberId, selectedNewRole]);

  const handleBulkChangeRole = useCallback(
    (ids: Set<string>) => {
      // Open role change dialog for the first selected member
      const firstId = [...ids][0];
      if (firstId) {
        const row = rows.find((r) => r.id === firstId);
        if (row) {
          setSelectedNewRole(row.role);
          setRoleChangeDialog({
            open: true,
            memberId: firstId,
            currentRole: row.role,
          });
        }
      }
    },
    [rows]
  );

  const handleSuspendUser = useCallback(
    (memberId: string) => {
      const row = rows.find((r) => r.id === memberId);
      setConfirmDialog({
        open: true,
        title: "Suspend User",
        description: `Are you sure you want to suspend ${row?.name || "this user"}? They will not be able to access the organization until reactivated.`,
        variant: "destructive",
        onConfirm: () => {
          onSuspendUser?.(memberId);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
          setMenuOpenId(null);
        },
      });
    },
    [rows, onSuspendUser]
  );

  // --- Search filter ---
  const searchFilter = useCallback((row: TeamMemberRow, query: string): boolean => {
    const lower = query.toLowerCase();
    return (
      row.name.toLowerCase().includes(lower) ||
      row.email.toLowerCase().includes(lower)
    );
  }, []);

  // --- Table columns ---
  const columns: Column<TeamMemberRow>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        accessor: (row) => (
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50"
              aria-hidden="true"
            >
              {row.status === "pending" ? (
                <Mail className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <User className="h-3.5 w-3.5 text-indigo-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy">
                {row.name}
              </p>
              {row.name !== row.email && (
                <p className="truncate text-xs text-muted-foreground">
                  {row.email}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "role",
        header: "Role",
        sortable: true,
        width: "140px",
        accessor: (row) => <RoleBadge role={row.role} />,
      },
      {
        id: "status",
        header: "Status",
        sortable: true,
        width: "110px",
        accessor: (row) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATUS_STYLES[row.status]
            )}
          >
            {STATUS_LABELS[row.status]}
          </span>
        ),
      },
      {
        id: "dateAdded",
        header: "Date Added",
        sortable: true,
        width: "130px",
        accessor: (row) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.dateAdded)}
          </span>
        ),
      },
      ...(canManageMembers
        ? [
            {
              id: "actions",
              header: "",
              width: "50px",
              accessor: (row: TeamMemberRow) => (
                <RowActionMenu
                  row={row}
                  isOpen={menuOpenId === row.id}
                  onToggle={() =>
                    setMenuOpenId((prev) => (prev === row.id ? null : row.id))
                  }
                  onClose={() => setMenuOpenId(null)}
                  onChangeRole={() => handleChangeRole(row.id)}
                  onSuspendUser={() => handleSuspendUser(row.id)}
                  onRemoveUser={() => handleRemoveUser(row.id)}
                  onResendInvitation={() => {
                    onResendInvitation?.(row.id);
                    setMenuOpenId(null);
                  }}
                  onCopyInvitationLink={() => {
                    onCopyInvitationLink?.(row.id);
                    setMenuOpenId(null);
                  }}
                />
              ),
            } as Column<TeamMemberRow>,
          ]
        : []),
    ],
    [
      canManageMembers,
      menuOpenId,
      handleChangeRole,
      handleSuspendUser,
      handleRemoveUser,
      onResendInvitation,
      onCopyInvitationLink,
    ]
  );

  // --- Bulk actions ---
  const bulkActions: BulkAction[] = useMemo(
    () =>
      canManageMembers
        ? [
            {
              label: "Change Role",
              icon: UserCog,
              onClick: handleBulkChangeRole,
            },
            {
              label: "Remove",
              icon: Trash2,
              onClick: handleBulkRemove,
              variant: "destructive" as const,
            },
          ]
        : [],
    [canManageMembers, handleBulkChangeRole, handleBulkRemove]
  );

  // --- Empty check ---
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No team members yet"
        description="Invite team members to collaborate on hiring projects."
        actionLabel="Invite Team Member"
        onAction={onInviteMember}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Role filter */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="role-filter"
            className="text-xs font-medium text-muted-foreground"
          >
            Role
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as OrgRole | "all")}
            className="h-7 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All Roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-xs font-medium text-muted-foreground"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as MemberStatus | "all")
            }
            className="h-7 rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DataTable */}
      <DataTable<TeamMemberRow>
        columns={columns}
        data={filteredRows}
        getRowId={(row) => row.id}
        selectable={canManageMembers}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        searchable
        searchPlaceholder="Search by name or email…"
        searchFilter={searchFilter}
        pageSize={20}
        stickyHeader
        bulkActions={bulkActions}
        emptyState={{
          icon: Users,
          title: "No results found",
          description:
            "No team members match the current filters or search.",
          secondaryLabel: "Clear Filters",
          onSecondaryAction: () => {
            setRoleFilter("all");
            setStatusFilter("all");
          },
        }}
      />

      {/* Confirm Dialog for Remove / Suspend */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.variant === "destructive" ? "Remove" : "Confirm"}
        onConfirm={confirmDialog.onConfirm}
      />

      {/* Inline Role Selection Dialog */}
      {roleChangeDialog.open && (
        <RoleChangeOverlay
          open={roleChangeDialog.open}
          currentRole={roleChangeDialog.currentRole}
          selectedRole={selectedNewRole}
          onSelectRole={setSelectedNewRole}
          onConfirm={handleConfirmRoleChange}
          onCancel={() =>
            setRoleChangeDialog((prev) => ({ ...prev, open: false }))
          }
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        ROLE_STYLES[role]
      )}
    >
      <Shield className="h-3 w-3" aria-hidden="true" />
      {ROLE_LABELS[role]}
    </span>
  );
}

// --- Row Action Menu (overflow menu) ---

interface RowActionMenuProps {
  row: TeamMemberRow;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChangeRole: () => void;
  onSuspendUser: () => void;
  onRemoveUser: () => void;
  onResendInvitation: () => void;
  onCopyInvitationLink: () => void;
}

function RowActionMenu({
  row,
  isOpen,
  onToggle,
  onClose,
  onChangeRole,
  onSuspendUser,
  onRemoveUser,
  onResendInvitation,
  onCopyInvitationLink,
}: RowActionMenuProps) {
  const isPending = row.status === "pending";

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={`Actions for ${row.name}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-white py-1 shadow-md"
            role="menu"
            aria-label={`Actions for ${row.name}`}
          >
            {isPending ? (
              <>
                <MenuButton
                  icon={RefreshCw}
                  label="Resend Invitation"
                  onClick={onResendInvitation}
                />
                <MenuButton
                  icon={Copy}
                  label="Copy Invitation Link"
                  onClick={onCopyInvitationLink}
                />
                <div className="my-1 border-t border-border" />
                <MenuButton
                  icon={Trash2}
                  label="Remove Invitation"
                  onClick={onRemoveUser}
                  destructive
                />
              </>
            ) : (
              <>
                <MenuButton
                  icon={UserCog}
                  label="Change Role"
                  onClick={onChangeRole}
                />
                <MenuButton
                  icon={ShieldAlert}
                  label="Suspend User"
                  onClick={onSuspendUser}
                />
                <div className="my-1 border-t border-border" />
                <MenuButton
                  icon={Trash2}
                  label="Remove User"
                  onClick={onRemoveUser}
                  destructive
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "text-navy hover:bg-gray-50"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

// --- Role Change Overlay ---

interface RoleChangeOverlayProps {
  open: boolean;
  currentRole: OrgRole;
  selectedRole: OrgRole;
  onSelectRole: (role: OrgRole) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function RoleChangeOverlay({
  open,
  currentRole,
  selectedRole,
  onSelectRole,
  onConfirm,
  onCancel,
}: RoleChangeOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        className="relative z-50 w-full max-w-sm rounded-[20px] bg-background p-6 shadow-sm border border-border"
        role="dialog"
        aria-modal="true"
        aria-label="Change Role"
      >
        <h2 className="text-lg font-semibold text-foreground">Change Role</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select a new role for this team member.
        </p>

        <div className="mt-4 space-y-2">
          {ALL_ROLES.filter((r) => r !== "Owner").map((role) => (
            <label
              key={role}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[12px] border p-3 transition-colors",
                selectedRole === role
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-border hover:border-indigo-300"
              )}
            >
              <input
                type="radio"
                name="new-role"
                value={role}
                checked={selectedRole === role}
                onChange={() => onSelectRole(role)}
                className="h-4 w-4 border-border text-indigo-600 focus:ring-indigo-600"
              />
              <span className="text-sm font-medium text-navy">
                {ROLE_LABELS[role]}
              </span>
              {role === currentRole && (
                <span className="ml-auto text-xs text-muted-foreground">
                  (current)
                </span>
              )}
            </label>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={selectedRole === currentRole}
          >
            Save Role
          </Button>
        </div>
      </div>
    </div>
  );
}
