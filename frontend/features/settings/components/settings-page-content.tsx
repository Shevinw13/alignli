"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Users, CreditCard } from "lucide-react";
import { OrganizationSettings } from "./organization-settings";
import { BillingSettings } from "./billing-settings";

type SettingsTab = "team" | "billing";

const TABS: { id: SettingsTab; label: string; icon: typeof Users }[] = [
  { id: "team", label: "Team", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
];

export function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("team");

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <nav aria-label="Settings tabs">
        <div className="flex gap-1 rounded-[12px] border border-border bg-white p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-muted-foreground hover:bg-gray-50 hover:text-navy"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Tab panels */}
      <div
        id="panel-team"
        role="tabpanel"
        aria-labelledby="tab-team"
        hidden={activeTab !== "team"}
      >
        {activeTab === "team" && <OrganizationSettings />}
      </div>

      <div
        id="panel-billing"
        role="tabpanel"
        aria-labelledby="tab-billing"
        hidden={activeTab !== "billing"}
      >
        {activeTab === "billing" && <BillingSettings />}
      </div>
    </div>
  );
}
