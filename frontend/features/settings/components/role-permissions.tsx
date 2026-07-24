"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import type { OrgRole, RolePermissionEntry } from "../types";

const ROLE_COLUMNS: { key: OrgRole; label: string }[] = [
  { key: "Owner", label: "Owner" },
  { key: "Admin", label: "Admin" },
  { key: "Hiring_Manager", label: "Hiring Manager" },
  { key: "Recruiter", label: "Recruiter" },
  { key: "Viewer", label: "Viewer" },
];

const PERMISSIONS: RolePermissionEntry[] = [
  {
    permission: "Manage organization settings",
    Owner: true,
    Admin: true,
    Hiring_Manager: false,
    Recruiter: false,
    Viewer: false,
  },
  {
    permission: "Invite and remove team members",
    Owner: true,
    Admin: true,
    Hiring_Manager: false,
    Recruiter: false,
    Viewer: false,
  },
  {
    permission: "Manage billing and subscriptions",
    Owner: true,
    Admin: true,
    Hiring_Manager: false,
    Recruiter: false,
    Viewer: false,
  },
  {
    permission: "Create hiring projects",
    Owner: true,
    Admin: true,
    Hiring_Manager: true,
    Recruiter: false,
    Viewer: false,
  },
  {
    permission: "Manage project lifecycle (state transitions)",
    Owner: true,
    Admin: true,
    Hiring_Manager: true,
    Recruiter: false,
    Viewer: false,
  },
  {
    permission: "Upload and manage resumes",
    Owner: true,
    Admin: true,
    Hiring_Manager: true,
    Recruiter: true,
    Viewer: false,
  },
  {
    permission: "View candidates and profiles",
    Owner: true,
    Admin: true,
    Hiring_Manager: true,
    Recruiter: true,
    Viewer: true,
  },
  {
    permission: "Send candidate communications",
    Owner: true,
    Admin: true,
    Hiring_Manager: true,
    Recruiter: true,
    Viewer: false,
  },
  {
    permission: "Mark candidates as hired",
    Owner: true,
    Admin: true,
    Hiring_Manager: true,
    Recruiter: false,
    Viewer: false,
  },
  {
    permission: "Edit ranking criteria",
    Owner: true,
    Admin: true,
    Hiring_Manager: true,
    Recruiter: false,
    Viewer: false,
  },
  {
    permission: "View audit logs",
    Owner: true,
    Admin: true,
    Hiring_Manager: false,
    Recruiter: false,
    Viewer: false,
  },
];

export function RolePermissions() {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-border bg-white">
      <table className="w-full text-left" aria-label="Role permissions matrix">
        <thead>
          <tr className="border-b border-border">
            <th
              className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              scope="col"
            >
              Permission
            </th>
            {ROLE_COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                scope="col"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((row, index) => (
            <tr
              key={row.permission}
              className={cn(
                "border-b border-border last:border-b-0",
                index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
              )}
            >
              <td className="px-4 py-3 text-sm text-navy">
                {row.permission}
              </td>
              {ROLE_COLUMNS.map((col) => (
                <td key={col.key} className="px-3 py-3 text-center">
                  {row[col.key] ? (
                    <Check
                      className="mx-auto h-4 w-4 text-emerald-600"
                      aria-label={`${col.label} can ${row.permission}`}
                    />
                  ) : (
                    <X
                      className="mx-auto h-4 w-4 text-gray-300"
                      aria-label={`${col.label} cannot ${row.permission}`}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
