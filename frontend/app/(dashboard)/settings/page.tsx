"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type SettingsTab = "account" | "team" | "billing";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account, team, and billing.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Settings tabs">
          {([
            { id: "account", label: "Account" },
            { id: "team", label: "Team" },
            { id: "billing", label: "Billing" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "account" && <AccountTab />}
      {activeTab === "team" && <TeamTab />}
      {activeTab === "billing" && <BillingTab />}
    </div>
  );
}

// ─── Account Tab ─────────────────────────────────────────────────────────────

function AccountTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900">Profile</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">Full name</label>
            <input
              type="text"
              defaultValue=""
              placeholder="Your name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">Email</label>
            <input
              type="email"
              defaultValue=""
              placeholder="you@company.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600">Company</label>
            <input
              type="text"
              defaultValue=""
              placeholder="Your company name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>
        <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
          Save changes
        </button>
      </div>

      <div className="rounded-xl border border-red-100 bg-white p-6 space-y-3">
        <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
        <p className="text-xs text-gray-500">Permanently delete your account and all data.</p>
        <button className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
          Delete account
        </button>
      </div>
    </div>
  );
}

// ─── Team Tab ────────────────────────────────────────────────────────────────

function TeamTab() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Team Members</h3>
        <button className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors">
          Invite member
        </button>
      </div>
      <p className="text-sm text-gray-500">
        No team members yet. Invite colleagues to collaborate on hiring decisions.
      </p>
    </div>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Current Plan</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-gray-900">Free</p>
            <p className="text-xs text-gray-500">3 jobs · 25 candidates per job</p>
          </div>
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
            Upgrade
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Usage this month</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-gray-900">2</p>
            <p className="text-xs text-gray-500">Jobs created</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-xs text-gray-500">Candidates screened</p>
          </div>
        </div>
      </div>
    </div>
  );
}
