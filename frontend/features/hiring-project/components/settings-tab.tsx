"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { type ProjectState, LifecycleBadge } from "./lifecycle-badge";

// --- Types ---

interface StateTransitionEntry {
  fromState: ProjectState;
  toState: ProjectState;
  timestamp: string;
  user: string;
}

interface PrerequisiteError {
  transition: string;
  message: string;
}

interface SettingsTabProps {
  currentState: ProjectState;
  stateHistory: StateTransitionEntry[];
  onTransition?: (toState: ProjectState) => void;
}

// --- Constants ---

const STATE_ORDER: ProjectState[] = [
  "Draft",
  "Active",
  "Reviewing",
  "Interviewing",
  "Offer Extended",
  "Filled",
  "Archived",
];

const FORWARD_TRANSITIONS: Record<ProjectState, ProjectState | null> = {
  Draft: "Active",
  Active: "Reviewing",
  Reviewing: "Interviewing",
  Interviewing: "Offer Extended",
  "Offer Extended": "Filled",
  Filled: null,
  Archived: null,
};

const TRANSITION_PREREQUISITES: Record<string, string> = {
  "Draft→Active":
    "At least one candidate must have completed processing.",
  "Active→Reviewing":
    "At least one candidate must exist in the project.",
  "Reviewing→Interviewing":
    "At least one candidate must be selected for interview.",
  "Interviewing→Offer Extended":
    "At least one candidate must be marked as selected for offer.",
  "Offer Extended→Filled":
    "At least one candidate must have an accepted offer.",
};

// --- Mock data for prerequisite validation (real API in task 20) ---

function checkPrerequisites(
  fromState: ProjectState,
  toState: ProjectState
): PrerequisiteError | null {
  const key = `${fromState}→${toState}`;
  const prerequisite = TRANSITION_PREREQUISITES[key];

  // Mock: Draft→Active fails (no candidates processed yet)
  // All other transitions pass for demonstration purposes
  if (key === "Draft→Active") {
    return {
      transition: key,
      message: prerequisite,
    };
  }

  return null;
}

function getValidTransitions(currentState: ProjectState): ProjectState[] {
  const transitions: ProjectState[] = [];

  const forwardState = FORWARD_TRANSITIONS[currentState];
  if (forwardState) {
    transitions.push(forwardState);
  }

  // Archive is always available except from Archived
  if (currentState !== "Archived") {
    transitions.push("Archived");
  }

  return transitions;
}

// --- Mock state history ---

const MOCK_STATE_HISTORY: StateTransitionEntry[] = [
  {
    fromState: "Draft",
    toState: "Draft",
    timestamp: new Date().toISOString(),
    user: "System",
  },
];

// --- Component ---

export function SettingsTab({
  currentState,
  stateHistory = MOCK_STATE_HISTORY,
  onTransition,
}: SettingsTabProps) {
  const [prerequisiteError, setPrerequisiteError] =
    useState<PrerequisiteError | null>(null);
  const [transitionSuccess, setTransitionSuccess] = useState<string | null>(
    null
  );

  const validTransitions = getValidTransitions(currentState);
  const nextForwardState = FORWARD_TRANSITIONS[currentState];

  function handleTransition(toState: ProjectState) {
    setPrerequisiteError(null);
    setTransitionSuccess(null);

    if (toState !== "Archived") {
      const error = checkPrerequisites(currentState, toState);
      if (error) {
        setPrerequisiteError(error);
        return;
      }
    }

    setTransitionSuccess(
      `Project transitioned from ${currentState} to ${toState}.`
    );
    onTransition?.(toState);
  }

  return (
    <div
      className="space-y-8"
      role="tabpanel"
      id="tabpanel-settings"
      aria-labelledby="tab-settings"
    >
      {/* Current State Section */}
      <section aria-labelledby="current-state-heading">
        <h2
          id="current-state-heading"
          className="text-lg font-semibold text-navy"
        >
          Project Lifecycle
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the state of your hiring project. Advance through stages as
          your hiring process progresses.
        </p>

        {/* Large current state badge */}
        <div className="mt-6 flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">
            Current State:
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold",
              stateStylesLarge[currentState]
            )}
            aria-label={`Current project state: ${currentState}`}
          >
            {currentState}
          </span>
        </div>
      </section>

      {/* State Timeline */}
      <section aria-labelledby="state-timeline-heading">
        <h3
          id="state-timeline-heading"
          className="text-base font-semibold text-navy"
        >
          State Timeline
        </h3>
        <div className="mt-4" role="list" aria-label="State transition history">
          <StateTimeline
            currentState={currentState}
            history={stateHistory}
          />
        </div>
      </section>

      {/* Transition Controls */}
      <section aria-labelledby="transition-controls-heading">
        <h3
          id="transition-controls-heading"
          className="text-base font-semibold text-navy"
        >
          State Transitions
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Available transitions from the current state.
        </p>

        {/* Error / Success Alerts */}
        {prerequisiteError && (
          <div
            className="mt-4 flex items-start gap-3 rounded-[16px] border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <AlertTriangle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-red-800">
                Cannot transition: {prerequisiteError.transition}
              </p>
              <p className="mt-1 text-sm text-red-700">
                {prerequisiteError.message}
              </p>
            </div>
          </div>
        )}

        {transitionSuccess && (
          <div
            className="mt-4 flex items-start gap-3 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4"
            role="status"
          >
            <CheckCircle2
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-emerald-800">
              {transitionSuccess}
            </p>
          </div>
        )}

        {/* Valid transition buttons */}
        <div className="mt-4 flex flex-wrap gap-3">
          {validTransitions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No transitions available from this state.
            </p>
          )}

          {nextForwardState && (
            <Button
              className="h-10 gap-2 rounded-[12px] bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700"
              onClick={() => handleTransition(nextForwardState)}
            >
              Advance to {nextForwardState}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          {currentState !== "Archived" && (
            <Button
              variant="destructive"
              className="h-10 gap-2 rounded-[12px] px-6 text-sm font-semibold"
              onClick={() => handleTransition("Archived")}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archive Project
            </Button>
          )}
        </div>

        {/* Valid transitions info */}
        {currentState !== "Archived" && currentState !== "Filled" && (
          <div className="mt-6 rounded-[16px] border border-border bg-gray-50 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Valid transitions from {currentState}
            </p>
            <ul className="mt-2 space-y-1">
              {validTransitions.map((state) => (
                <li
                  key={state}
                  className="flex items-center gap-2 text-sm text-navy"
                >
                  <ArrowRight
                    className="h-3 w-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <LifecycleBadge state={state} />
                  {state !== "Archived" &&
                    TRANSITION_PREREQUISITES[`${currentState}→${state}`] && (
                      <span className="text-xs text-muted-foreground">
                        —{" "}
                        {TRANSITION_PREREQUISITES[`${currentState}→${state}`]}
                      </span>
                    )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {currentState === "Archived" && (
          <div className="mt-4 rounded-[16px] border border-border bg-gray-50 p-4">
            <p className="text-sm text-muted-foreground">
              This project is archived. All data is preserved in read-only mode.
            </p>
          </div>
        )}

        {currentState === "Filled" && (
          <div className="mt-4 rounded-[16px] border border-border bg-gray-50 p-4">
            <p className="text-sm text-muted-foreground">
              This project has been filled. You can archive it to move it to
              long-term storage.
            </p>
          </div>
        )}
      </section>

      {/* Lifecycle Visual */}
      <section aria-labelledby="lifecycle-visual-heading">
        <h3
          id="lifecycle-visual-heading"
          className="text-base font-semibold text-navy"
        >
          Lifecycle Overview
        </h3>
        <div className="mt-4">
          <LifecycleVisual currentState={currentState} />
        </div>
      </section>
    </div>
  );
}

// --- Subcomponents ---

const stateStylesLarge: Record<ProjectState, string> = {
  Draft: "bg-gray-100 text-gray-800 border border-gray-200",
  Active: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  Reviewing: "bg-amber-50 text-amber-800 border border-amber-200",
  Interviewing: "bg-blue-50 text-blue-800 border border-blue-200",
  "Offer Extended": "bg-purple-50 text-purple-800 border border-purple-200",
  Filled: "bg-indigo-50 text-indigo-800 border border-indigo-200",
  Archived: "bg-gray-100 text-gray-500 border border-gray-200",
};

function StateTimeline({
  currentState,
  history,
}: {
  currentState: ProjectState;
  history: StateTransitionEntry[];
}) {
  return (
    <div className="space-y-3">
      {history.map((entry, index) => (
        <div
          key={index}
          className="flex items-center gap-3"
          role="listitem"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50">
            <Clock
              className="h-4 w-4 text-indigo-600"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-navy">
              {entry.fromState === entry.toState ? (
                <span>
                  Project created in <strong>{entry.toState}</strong> state
                </span>
              ) : (
                <span>
                  Transitioned from{" "}
                  <strong>{entry.fromState}</strong> to{" "}
                  <strong>{entry.toState}</strong>
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTimestamp(entry.timestamp)} • {entry.user}
            </p>
          </div>
        </div>
      ))}

      {/* Current state indicator */}
      <div className="flex items-center gap-3" role="listitem">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2
            className="h-4 w-4 text-emerald-600"
            aria-hidden="true"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-navy">
            Currently in <strong>{currentState}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function LifecycleVisual({ currentState }: { currentState: ProjectState }) {
  const mainStates: ProjectState[] = [
    "Draft",
    "Active",
    "Reviewing",
    "Interviewing",
    "Offer Extended",
    "Filled",
  ];

  const currentIndex = mainStates.indexOf(currentState);
  const isArchived = currentState === "Archived";

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max py-2">
        {mainStates.map((state, index) => {
          const isPast = !isArchived && currentIndex > index;
          const isCurrent = !isArchived && currentIndex === index;
          const isFuture = isArchived || currentIndex < index;

          return (
            <div key={state} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isPast && "bg-indigo-100 text-indigo-700",
                  isCurrent &&
                    "bg-indigo-600 text-white ring-2 ring-indigo-600/30",
                  isFuture && "bg-gray-100 text-gray-500"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {state}
              </div>
              {index < mainStates.length - 1 && (
                <ArrowRight
                  className={cn(
                    "mx-1 h-3 w-3 flex-shrink-0",
                    isPast ? "text-indigo-400" : "text-gray-300"
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}

        {/* Archived indicator */}
        <div className="ml-4 flex items-center gap-1">
          <span className="text-xs text-muted-foreground">|</span>
          <div
            className={cn(
              "flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium",
              isArchived
                ? "bg-gray-600 text-white ring-2 ring-gray-600/30"
                : "bg-gray-100 text-gray-400"
            )}
            aria-current={isArchived ? "step" : undefined}
          >
            Archived
          </div>
        </div>
      </div>
      {isArchived && (
        <p className="mt-2 text-xs text-muted-foreground">
          This project was archived and can be viewed in read-only mode.
        </p>
      )}
    </div>
  );
}

// --- Helpers ---

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}
