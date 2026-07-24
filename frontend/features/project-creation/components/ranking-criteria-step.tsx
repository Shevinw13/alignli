"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Priority = "Low" | "Medium" | "High";

export type CriteriaCategory =
  | "Skill Match"
  | "Experience"
  | "Education"
  | "Leadership"
  | "Certifications"
  | "Location"
  | "Career Growth"
  | "Employment Stability"
  | "Custom";

export interface RankingCriterion {
  id: string;
  category: CriteriaCategory;
  label: string;
  priority: Priority;
  maxScore: number;
}

export interface RankingCriteriaStepProps {
  /** AI-generated criteria passed in from the parent wizard */
  initialCriteria?: RankingCriterion[];
  /** Whether the AI is still generating criteria */
  isLoading?: boolean;
  /** Called when the user confirms and advances to the next step */
  onConfirm: (criteria: RankingCriterion[]) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITIES: Priority[] = ["Low", "Medium", "High"];

const priorityStyles: Record<Priority, string> = {
  Low: "bg-gray-100 text-gray-700 border-gray-300",
  Medium: "bg-amber-50 text-amber-700 border-amber-300",
  High: "bg-indigo-50 text-indigo-700 border-indigo-300",
};

const prioritySelectedStyles: Record<Priority, string> = {
  Low: "bg-gray-200 text-gray-900 border-gray-500 ring-1 ring-gray-400",
  Medium: "bg-amber-100 text-amber-900 border-amber-500 ring-1 ring-amber-400",
  High: "bg-indigo-100 text-indigo-900 border-indigo-500 ring-1 ring-indigo-400",
};

const categoryColors: Record<CriteriaCategory, string> = {
  "Skill Match": "bg-blue-100 text-blue-800",
  Experience: "bg-emerald-100 text-emerald-800",
  Education: "bg-purple-100 text-purple-800",
  Leadership: "bg-rose-100 text-rose-800",
  Certifications: "bg-yellow-100 text-yellow-800",
  Location: "bg-teal-100 text-teal-800",
  "Career Growth": "bg-cyan-100 text-cyan-800",
  "Employment Stability": "bg-orange-100 text-orange-800",
  Custom: "bg-gray-100 text-gray-800",
};

let idCounter = 0;
function generateId(): string {
  return `criterion-${Date.now()}-${++idCounter}`;
}

const CATEGORIES: CriteriaCategory[] = [
  "Skill Match",
  "Experience",
  "Education",
  "Leadership",
  "Certifications",
  "Location",
  "Career Growth",
  "Employment Stability",
  "Custom",
];

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function CriterionSkeleton() {
  return (
    <div className="animate-pulse rounded-[16px] border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-20 rounded-full bg-gray-200" />
            <div className="h-5 w-40 rounded bg-gray-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-14 rounded bg-gray-200" />
            <div className="h-7 w-16 rounded bg-gray-200" />
            <div className="h-7 w-12 rounded bg-gray-200" />
          </div>
        </div>
        <div className="h-8 w-16 rounded bg-gray-200" />
      </div>
    </div>
  );
}

// ─── Criterion Card ───────────────────────────────────────────────────────────

interface CriterionCardProps {
  criterion: RankingCriterion;
  onPriorityChange: (id: string, priority: Priority) => void;
  onMaxScoreChange: (id: string, maxScore: number) => void;
  onRemove: (id: string) => void;
}

function CriterionCard({
  criterion,
  onPriorityChange,
  onMaxScoreChange,
  onRemove,
}: CriterionCardProps) {
  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) return;
    const clamped = Math.max(1, Math.min(100, value));
    onMaxScoreChange(criterion.id, clamped);
  };

  return (
    <div
      className={cn(
        "rounded-[16px] border border-border bg-white p-4",
        "transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.05)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          {/* Category badge + label */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                categoryColors[criterion.category]
              )}
            >
              {criterion.category}
            </span>
            <span className="text-sm font-medium text-foreground">
              {criterion.label}
            </span>
          </div>

          {/* Priority selector */}
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">
              Priority for {criterion.label}
            </legend>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPriorityChange(criterion.id, p)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                  criterion.priority === p
                    ? prioritySelectedStyles[p]
                    : priorityStyles[p]
                )}
                aria-pressed={criterion.priority === p}
                aria-label={`Set priority to ${p}`}
              >
                {p}
              </button>
            ))}
          </fieldset>

          {/* Max score input */}
          <div className="flex items-center gap-2">
            <label
              htmlFor={`max-score-${criterion.id}`}
              className="text-xs text-muted-foreground"
            >
              Max Score
            </label>
            <input
              id={`max-score-${criterion.id}`}
              type="number"
              min={1}
              max={100}
              value={criterion.maxScore}
              onChange={handleScoreChange}
              className={cn(
                "h-8 w-16 rounded-md border border-border bg-white px-2 text-sm text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              )}
              aria-label={`Maximum score for ${criterion.label}`}
            />
          </div>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={() => onRemove(criterion.id)}
          className={cn(
            "rounded-md p-2 text-gray-400 transition-colors",
            "hover:bg-red-50 hover:text-red-600",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          )}
          aria-label={`Remove criterion: ${criterion.label}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ─── Inline Add Form ──────────────────────────────────────────────────────────

interface InlineAddFormProps {
  onAdd: (data: { category: CriteriaCategory; label: string; priority: Priority; maxScore: number }) => void;
  onCancel: () => void;
}

function InlineAddForm({ onAdd, onCancel }: InlineAddFormProps) {
  const [category, setCategory] = useState<CriteriaCategory>("Custom");
  const [label, setLabel] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [maxScore, setMaxScore] = useState(50);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setFormError("Label is required.");
      return;
    }
    setFormError(null);
    onAdd({ category, label: trimmedLabel, priority, maxScore });
  };

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) return;
    setMaxScore(Math.max(1, Math.min(100, value)));
  };

  return (
    <div
      className={cn(
        "rounded-[16px] border-2 border-indigo-200 bg-indigo-50/30 p-4 space-y-4"
      )}
      role="form"
      aria-label="Add custom criterion form"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          Add Custom Criterion
        </span>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "rounded-md p-1.5 text-gray-400 transition-colors",
            "hover:bg-gray-100 hover:text-gray-600",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          )}
          aria-label="Cancel adding criterion"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Category dropdown */}
        <div className="space-y-1">
          <label
            htmlFor="add-criterion-category"
            className="text-xs font-medium text-muted-foreground"
          >
            Category
          </label>
          <select
            id="add-criterion-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CriteriaCategory)}
            className={cn(
              "h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            )}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Label text input */}
        <div className="space-y-1">
          <label
            htmlFor="add-criterion-label"
            className="text-xs font-medium text-muted-foreground"
          >
            Label
          </label>
          <input
            id="add-criterion-label"
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="e.g., React proficiency"
            className={cn(
              "h-9 w-full rounded-md border bg-white px-2 text-sm text-foreground",
              formError ? "border-red-300" : "border-border",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            )}
          />
        </div>
      </div>

      {/* Priority + Max Score row */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Priority selector */}
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Priority
          </span>
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Priority for new criterion</legend>
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                  priority === p ? prioritySelectedStyles[p] : priorityStyles[p]
                )}
                aria-pressed={priority === p}
                aria-label={`Set priority to ${p}`}
              >
                {p}
              </button>
            ))}
          </fieldset>
        </div>

        {/* Max score input */}
        <div className="space-y-1">
          <label
            htmlFor="add-criterion-max-score"
            className="text-xs font-medium text-muted-foreground"
          >
            Max Score
          </label>
          <input
            id="add-criterion-max-score"
            type="number"
            min={1}
            max={100}
            value={maxScore}
            onChange={handleScoreChange}
            className={cn(
              "h-9 w-16 rounded-md border border-border bg-white px-2 text-sm text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            )}
          />
        </div>
      </div>

      {/* Error + Submit */}
      {formError && (
        <p className="text-xs text-red-600" role="alert">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Criterion
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RankingCriteriaStep({
  initialCriteria = [],
  isLoading = false,
  onConfirm,
}: RankingCriteriaStepProps) {
  const [criteria, setCriteria] = useState<RankingCriterion[]>(initialCriteria);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Sync with new initialCriteria when loading finishes
  const [prevInitial, setPrevInitial] = useState(initialCriteria);
  if (initialCriteria !== prevInitial && initialCriteria.length > 0) {
    setPrevInitial(initialCriteria);
    setCriteria(initialCriteria);
    setError(null);
  }

  const handlePriorityChange = useCallback((id: string, priority: Priority) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, priority } : c))
    );
  }, []);

  const handleMaxScoreChange = useCallback((id: string, maxScore: number) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, maxScore } : c))
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
    setError(null);
  }, []);

  const handleAddCriterion = useCallback(
    (data: { category: CriteriaCategory; label: string; priority: Priority; maxScore: number }) => {
      const newCriterion: RankingCriterion = {
        id: generateId(),
        category: data.category,
        label: data.label,
        priority: data.priority,
        maxScore: data.maxScore,
      };
      setCriteria((prev) => [...prev, newCriterion]);
      setError(null);
      setShowAddForm(false);
    },
    []
  );

  const handleConfirm = () => {
    if (criteria.length === 0) {
      setError("At least one criterion is required to continue.");
      return;
    }
    setError(null);
    onConfirm(criteria);
  };

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading ranking criteria">
        <h2 className="text-xl font-semibold text-foreground">Ranking Criteria</h2>
        <p className="text-sm text-muted-foreground">
          AI is generating ranking criteria based on your job description...
        </p>
        <div className="space-y-3">
          <CriterionSkeleton />
          <CriterionSkeleton />
          <CriterionSkeleton />
          <CriterionSkeleton />
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Ranking Criteria</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize the criteria used to rank candidates. Adjust priority and maximum
          score for each criterion, or add your own.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Criteria list */}
      <div className="space-y-3" role="list" aria-label="Ranking criteria list">
        {criteria.map((criterion) => (
          <div key={criterion.id} role="listitem">
            <CriterionCard
              criterion={criterion}
              onPriorityChange={handlePriorityChange}
              onMaxScoreChange={handleMaxScoreChange}
              onRemove={handleRemove}
            />
          </div>
        ))}
      </div>

      {/* Add custom criterion button / inline form */}
      {showAddForm ? (
        <InlineAddForm
          onAdd={handleAddCriterion}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-[16px]",
            "border-2 border-dashed border-border bg-white py-4",
            "text-sm font-medium text-muted-foreground",
            "transition-colors hover:border-indigo-300 hover:text-indigo-600",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          )}
          aria-label="Add custom criterion"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Custom Criterion
        </button>
      )}

      {/* Continue button */}
      <div className="pt-4">
        <Button
          onClick={handleConfirm}
          disabled={criteria.length === 0}
          className="w-full"
          size="lg"
          aria-label="Confirm ranking criteria and continue"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
