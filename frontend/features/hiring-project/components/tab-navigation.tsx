"use client";

import { cn } from "@/lib/utils";

export type ProjectTab = "overview" | "candidates" | "communication" | "settings";

interface TabNavigationProps {
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
}

const tabs: { id: ProjectTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "candidates", label: "Candidates" },
  { id: "communication", label: "Communication" },
  { id: "settings", label: "Settings" },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav aria-label="Project tabs" className="border-b border-border">
      <div
        className="flex gap-1"
        role="tablist"
        aria-label="Project navigation tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
              "rounded-t-[8px]",
              activeTab === tab.id
                ? "text-indigo-600"
                : "text-muted-foreground hover:text-navy"
            )}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-600 rounded-full"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
