"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Plus, AlertCircle, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterCounter } from "@/components/ui/character-counter";
import { useAutoFocus } from "@/lib/hooks/use-auto-focus";
import { cn } from "@/lib/utils";

// --- Types ---

export interface ExtractedItem {
  id: string;
  value: string;
}

export interface ExtractedCategories {
  required_skills: ExtractedItem[];
  preferred_skills: ExtractedItem[];
  education: ExtractedItem[];
  years_experience: ExtractedItem[];
  certifications: ExtractedItem[];
  location_requirements: ExtractedItem[];
  keywords: ExtractedItem[];
}

export interface JobDescriptionData {
  rawText: string;
  fileName?: string;
  extractedCategories: ExtractedCategories;
}

interface JobDescriptionStepProps {
  projectId?: string;
  initialData?: JobDescriptionData;
  onSubmit: (data: JobDescriptionData) => void;
  onBack?: () => void;
}

type InputMode = "paste" | "upload";
type StepState = "input" | "loading" | "review" | "error";

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TEXT_LENGTH = 50000;
const MIN_TEXT_LENGTH = 50;

const CATEGORY_LABELS: Record<keyof ExtractedCategories, string> = {
  required_skills: "Required Skills",
  preferred_skills: "Preferred Skills",
  education: "Education",
  years_experience: "Years of Experience",
  certifications: "Certifications",
  location_requirements: "Location Requirements",
  keywords: "Keywords",
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyCategories(): ExtractedCategories {
  return {
    required_skills: [],
    preferred_skills: [],
    education: [],
    years_experience: [],
    certifications: [],
    location_requirements: [],
    keywords: [],
  };
}

function getTotalItems(categories: ExtractedCategories): number {
  return Object.values(categories).reduce(
    (sum, items) => sum + items.length,
    0
  );
}

// --- Mock API call (to be replaced with real API integration) ---

interface APIExtractionResponse {
  categories: {
    required_skills: Array<{ name: string; description?: string }>;
    preferred_skills: Array<{ name: string; description?: string }>;
    education: Array<{ level?: string; field?: string; description?: string }>;
    years_experience: { minimum?: number; preferred?: number; description?: string } | null;
    certifications: Array<{ name: string; required_or_preferred?: string }>;
    location_requirements: { location?: string; remote_policy?: string; travel_requirements?: string } | null;
    keywords: string[];
  };
  confidence: string;
}

async function mockExtractJobDescription(
  text: string,
  _projectId?: string
): Promise<APIExtractionResponse> {
  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Simulate extraction based on text content
  return {
    categories: {
      required_skills: [
        { name: "React", description: "Modern React with hooks" },
        { name: "TypeScript", description: "Strong typing skills" },
        { name: "Node.js", description: "Backend experience" },
      ],
      preferred_skills: [
        { name: "GraphQL", description: "API design" },
        { name: "AWS", description: "Cloud services" },
      ],
      education: [
        { level: "Bachelor's", field: "Computer Science" },
      ],
      years_experience: { minimum: 3, preferred: 5 },
      certifications: [
        { name: "AWS Solutions Architect", required_or_preferred: "preferred" },
      ],
      location_requirements: { location: "San Francisco, CA", remote_policy: "Hybrid" },
      keywords: ["full-stack", "agile", "microservices", "CI/CD"],
    },
    confidence: "High",
  };
}

function transformAPIResponse(response: APIExtractionResponse): ExtractedCategories {
  const categories = createEmptyCategories();

  categories.required_skills = response.categories.required_skills.map((s) => ({
    id: generateId(),
    value: s.description ? `${s.name} — ${s.description}` : s.name,
  }));

  categories.preferred_skills = response.categories.preferred_skills.map((s) => ({
    id: generateId(),
    value: s.description ? `${s.name} — ${s.description}` : s.name,
  }));

  categories.education = response.categories.education.map((e) => ({
    id: generateId(),
    value: [e.level, e.field, e.description].filter(Boolean).join(", "),
  }));

  if (response.categories.years_experience) {
    const ye = response.categories.years_experience;
    const parts: string[] = [];
    if (ye.minimum != null) parts.push(`Minimum: ${ye.minimum} years`);
    if (ye.preferred != null) parts.push(`Preferred: ${ye.preferred} years`);
    if (ye.description) parts.push(ye.description);
    if (parts.length > 0) {
      categories.years_experience = [{ id: generateId(), value: parts.join("; ") }];
    }
  }

  categories.certifications = response.categories.certifications.map((c) => ({
    id: generateId(),
    value: c.required_or_preferred
      ? `${c.name} (${c.required_or_preferred})`
      : c.name,
  }));

  if (response.categories.location_requirements) {
    const lr = response.categories.location_requirements;
    const parts: string[] = [];
    if (lr.location) parts.push(lr.location);
    if (lr.remote_policy) parts.push(lr.remote_policy);
    if (lr.travel_requirements) parts.push(lr.travel_requirements);
    if (parts.length > 0) {
      categories.location_requirements = [{ id: generateId(), value: parts.join(", ") }];
    }
  }

  categories.keywords = response.categories.keywords.map((k) => ({
    id: generateId(),
    value: k,
  }));

  return categories;
}

// --- Main Component ---

export function JobDescriptionStep({
  projectId,
  initialData,
  onSubmit,
  onBack,
}: JobDescriptionStepProps) {
  const containerRef = useAutoFocus<HTMLDivElement>();
  const [stepState, setStepState] = useState<StepState>(
    initialData?.extractedCategories &&
      getTotalItems(initialData.extractedCategories) > 0
      ? "review"
      : "input"
  );
  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [text, setText] = useState(initialData?.rawText ?? "");
  const [fileName, setFileName] = useState(initialData?.fileName ?? "");
  const [fileContent, setFileContent] = useState<string>("");
  const [categories, setCategories] = useState<ExtractedCategories>(
    initialData?.extractedCategories ?? createEmptyCategories()
  );
  const [error, setError] = useState<string>("");
  const [inputError, setInputError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Validation ---

  function validateTextInput(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return "Job description text is required";
    if (trimmed.length < MIN_TEXT_LENGTH)
      return `Text must contain at least ${MIN_TEXT_LENGTH} characters`;
    if (trimmed.length > MAX_TEXT_LENGTH)
      return `Text must not exceed ${MAX_TEXT_LENGTH.toLocaleString()} characters`;
    return null;
  }

  function validateFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_FILE_TYPES.includes(file.type)) {
      return `Unsupported file format. Accepted formats: PDF, DOCX, TXT`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 5 MB limit`;
    }
    return null;
  }

  // --- File Handling ---

  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setInputError(validationError);
      return;
    }

    setInputError("");
    setFileName(file.name);

    // Read file content as text (for TXT files) or store reference
    if (file.type === "text/plain") {
      const content = await file.text();
      setFileContent(content);
      setText(content);
    } else {
      // For PDF/DOCX, we would upload and send file_url to the API
      // For now, store a placeholder indicating file was selected
      setFileContent(`[File: ${file.name}]`);
      setText(`[Uploaded file: ${file.name}]`);
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function clearFile() {
    setFileName("");
    setFileContent("");
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // --- Extraction ---

  async function handleExtract() {
    const textToExtract = inputMode === "paste" ? text : fileContent || text;

    // Validate text input
    if (inputMode === "paste") {
      const validationError = validateTextInput(text);
      if (validationError) {
        setInputError(validationError);
        return;
      }
    } else {
      if (!fileName) {
        setInputError("Please upload a file first");
        return;
      }
    }

    setInputError("");
    setError("");
    setStepState("loading");

    try {
      const response = await mockExtractJobDescription(textToExtract, projectId);
      const extracted = transformAPIResponse(response);

      if (getTotalItems(extracted) === 0) {
        setError(
          "No information could be extracted from the job description. Please try a different input."
        );
        setStepState("error");
        return;
      }

      setCategories(extracted);
      setStepState("review");
      // Auto-save to wizard context so data is available when Next is clicked
      onSubmit({
        rawText: textToExtract,
        fileName: fileName || undefined,
        extractedCategories: extracted,
      });
    } catch {
      setError(
        "Failed to extract information from the job description. Please try again."
      );
      setStepState("error");
    }
  }

  // --- Category Editing ---

  function handleRemoveItem(category: keyof ExtractedCategories, itemId: string) {
    setCategories((prev) => ({
      ...prev,
      [category]: prev[category].filter((item) => item.id !== itemId),
    }));
  }

  function handleEditItem(
    category: keyof ExtractedCategories,
    itemId: string,
    newValue: string
  ) {
    if (!newValue.trim()) {
      handleRemoveItem(category, itemId);
      return;
    }
    setCategories((prev) => ({
      ...prev,
      [category]: prev[category].map((item) =>
        item.id === itemId ? { ...item, value: newValue } : item
      ),
    }));
  }

  function handleAddItem(category: keyof ExtractedCategories, value: string) {
    if (!value.trim()) return;
    setCategories((prev) => ({
      ...prev,
      [category]: [...prev[category], { id: generateId(), value: value.trim() }],
    }));
  }

  // --- Submit ---

  function handleContinue() {
    if (getTotalItems(categories) === 0) {
      setError("At least one extracted item is required before continuing.");
      return;
    }
    onSubmit({
      rawText: text,
      fileName: fileName || undefined,
      extractedCategories: categories,
    });
  }

  // --- Retry ---

  function handleRetry() {
    setError("");
    setStepState("input");
  }

  function handleReExtract() {
    setStepState("input");
  }

  // --- Render ---

  return (
    <div ref={containerRef} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-navy">Job Description</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste or upload a job description to extract skills and requirements.
        </p>
      </div>

      {stepState === "input" && (
        <InputState
          inputMode={inputMode}
          setInputMode={setInputMode}
          text={text}
          setText={setText}
          fileName={fileName}
          isDragOver={isDragOver}
          inputError={inputError}
          setInputError={setInputError}
          fileInputRef={fileInputRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onFileInputChange={handleFileInputChange}
          onClearFile={clearFile}
          onExtract={handleExtract}
          onBack={onBack}
        />
      )}

      {stepState === "loading" && <LoadingState />}

      {stepState === "review" && (
        <ReviewState
          categories={categories}
          onRemoveItem={handleRemoveItem}
          onEditItem={handleEditItem}
          onAddItem={handleAddItem}
          onContinue={handleContinue}
          onReExtract={handleReExtract}
          error={error}
        />
      )}

      {stepState === "error" && (
        <ErrorState error={error} onRetry={handleRetry} onBack={onBack} />
      )}
    </div>
  );
}

// --- Input State Component ---

interface InputStateProps {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  text: string;
  setText: (text: string) => void;
  fileName: string;
  isDragOver: boolean;
  inputError: string;
  setInputError: (error: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  onExtract: () => void;
  onBack?: () => void;
}

function InputState({
  inputMode,
  setInputMode,
  text,
  setText,
  fileName,
  isDragOver,
  inputError,
  setInputError,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInputChange,
  onClearFile,
  onExtract,
  onBack,
}: InputStateProps) {
  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2" role="tablist" aria-label="Input method">
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === "paste"}
          onClick={() => {
            setInputMode("paste");
            setInputError("");
          }}
          className={cn(
            "rounded-[8px] px-4 py-2 text-sm font-medium transition-colors",
            inputMode === "paste"
              ? "bg-indigo-50 text-indigo-700"
              : "text-muted-foreground hover:bg-gray-50"
          )}
        >
          Paste Text
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === "upload"}
          onClick={() => {
            setInputMode("upload");
            setInputError("");
          }}
          className={cn(
            "rounded-[8px] px-4 py-2 text-sm font-medium transition-colors",
            inputMode === "upload"
              ? "bg-indigo-50 text-indigo-700"
              : "text-muted-foreground hover:bg-gray-50"
          )}
        >
          Upload File
        </button>
      </div>

      {/* Paste Text Area */}
      {inputMode === "paste" && (
        <div className="space-y-1.5">
          <label htmlFor="jd-text" className="block text-sm font-medium text-navy">
            Job Description Text
          </label>
          <textarea
            id="jd-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (inputError) setInputError("");
            }}
            placeholder="Paste the full job description here..."
            maxLength={MAX_TEXT_LENGTH}
            className={cn(
              "w-full min-h-[200px] rounded-[12px] border px-4 py-3 text-sm text-navy",
              "placeholder:text-muted-foreground outline-none transition-colors resize-y",
              "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
              inputError ? "border-red-500" : "border-border-default"
            )}
            aria-invalid={!!inputError}
            aria-describedby={inputError ? "jd-text-error" : "jd-text-hint"}
          />
          <div className="flex justify-between">
            <p id="jd-text-hint" className="text-xs text-muted-foreground">
              Minimum {MIN_TEXT_LENGTH} characters required
            </p>
            <CharacterCounter current={text.length} max={MAX_TEXT_LENGTH} />
          </div>
        </div>
      )}

      {/* File Upload Area */}
      {inputMode === "upload" && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-navy">
            Upload Job Description
          </label>
          {!fileName ? (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload job description file"
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed p-8 cursor-pointer transition-colors",
                isDragOver
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-border-default hover:border-indigo-300 hover:bg-gray-50",
                inputError && "border-red-500"
              )}
            >
              <Upload
                className={cn(
                  "h-8 w-8",
                  isDragOver ? "text-indigo-500" : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <div className="text-center">
                <p className="text-sm font-medium text-navy">
                  Drop file here or click to browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, DOCX, or TXT — Max 5 MB
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[12px] border border-border-default px-4 py-3">
              <FileText className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              <span className="flex-1 truncate text-sm text-navy">{fileName}</span>
              <button
                type="button"
                onClick={onClearFile}
                className="rounded-full p-1 text-muted-foreground hover:bg-gray-100 hover:text-navy"
                aria-label={`Remove file ${fileName}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={onFileInputChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      )}

      {/* Validation Error */}
      {inputError && (
        <p id="jd-text-error" className="text-sm text-red-500" role="alert">
          {inputError}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          onClick={onExtract}
          className="h-10 rounded-[12px] bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Extract Requirements
        </Button>
      </div>
    </div>
  );
}

// --- Loading State Component ---

function LoadingState() {
  return (
    <div className="space-y-4 py-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2
          className="h-8 w-8 animate-spin text-indigo-600"
          aria-hidden="true"
        />
        <div className="text-center">
          <p className="text-sm font-medium text-navy">
            Extracting requirements...
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The AI is analyzing your job description
          </p>
        </div>
      </div>

      {/* Skeleton placeholders */}
      <div className="space-y-3 pt-4" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-7 w-24 animate-pulse rounded-[8px] bg-gray-100"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Extracting requirements from job description, please wait.
      </p>
    </div>
  );
}

// --- Review State Component ---

interface ReviewStateProps {
  categories: ExtractedCategories;
  onRemoveItem: (category: keyof ExtractedCategories, itemId: string) => void;
  onEditItem: (
    category: keyof ExtractedCategories,
    itemId: string,
    newValue: string
  ) => void;
  onAddItem: (category: keyof ExtractedCategories, value: string) => void;
  onContinue: () => void;
  onReExtract: () => void;
  error: string;
}

function ReviewState({
  categories,
  onRemoveItem,
  onEditItem,
  onAddItem,
  onContinue,
  onReExtract,
  error,
}: ReviewStateProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Review and edit the extracted information below.
        </p>
        <button
          type="button"
          onClick={onReExtract}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Re-extract
        </button>
      </div>

      {/* Category Cards */}
      <div className="space-y-4">
        {(Object.keys(CATEGORY_LABELS) as Array<keyof ExtractedCategories>).map(
          (categoryKey) => {
            const items = categories[categoryKey];
            return (
              <CategoryCard
                key={categoryKey}
                categoryKey={categoryKey}
                label={CATEGORY_LABELS[categoryKey]}
                items={items}
                onRemoveItem={(itemId) => onRemoveItem(categoryKey, itemId)}
                onEditItem={(itemId, value) =>
                  onEditItem(categoryKey, itemId, value)
                }
                onAddItem={(value) => onAddItem(categoryKey, value)}
              />
            );
          }
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// --- Category Card Component ---

interface CategoryCardProps {
  categoryKey: keyof ExtractedCategories;
  label: string;
  items: ExtractedItem[];
  onRemoveItem: (itemId: string) => void;
  onEditItem: (itemId: string, value: string) => void;
  onAddItem: (value: string) => void;
}

function CategoryCard({
  categoryKey,
  label,
  items,
  onRemoveItem,
  onEditItem,
  onAddItem,
}: CategoryCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState("");

  function handleAdd() {
    if (newValue.trim()) {
      onAddItem(newValue.trim());
      setNewValue("");
      setIsAdding(false);
    }
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      setNewValue("");
      setIsAdding(false);
    }
  }

  return (
    <div className="rounded-[12px] border border-border-default bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-navy">{label}</h3>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2" role="list" aria-label={`${label} items`}>
        {items.map((item) => (
          <EditableTag
            key={item.id}
            item={item}
            categoryKey={categoryKey}
            onRemove={() => onRemoveItem(item.id)}
            onEdit={(newVal) => onEditItem(item.id, newVal)}
          />
        ))}

        {/* Add Button */}
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={cn(
              "inline-flex items-center gap-1 rounded-[8px] border border-dashed border-border-default",
              "px-3 py-1.5 text-xs text-muted-foreground",
              "hover:border-indigo-300 hover:text-indigo-600 transition-colors"
            )}
            aria-label={`Add item to ${label}`}
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add
          </button>
        )}

        {/* Add Input */}
        {isAdding && (
          <div className="inline-flex items-center gap-1">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleAddKeyDown}
              onBlur={handleAdd}
              autoFocus
              placeholder="Type and press Enter"
              className="rounded-[8px] border border-indigo-300 bg-white px-3 py-1.5 text-xs text-navy outline-none focus:ring-2 focus:ring-indigo-600/20 w-40"
              aria-label={`New ${label} item`}
            />
          </div>
        )}
      </div>

      {items.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground italic">
          No items extracted. Click &quot;Add&quot; to add items.
        </p>
      )}
    </div>
  );
}

// --- Editable Tag Component ---

interface EditableTagProps {
  item: ExtractedItem;
  categoryKey: keyof ExtractedCategories;
  onRemove: () => void;
  onEdit: (newValue: string) => void;
}

function EditableTag({ item, categoryKey, onRemove, onEdit }: EditableTagProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.value);

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEdit();
    } else if (e.key === "Escape") {
      setEditValue(item.value);
      setIsEditing(false);
    }
  }

  function finishEdit() {
    onEdit(editValue.trim());
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleEditKeyDown}
        onBlur={finishEdit}
        autoFocus
        className="rounded-[8px] border border-indigo-300 bg-white px-3 py-1.5 text-xs text-navy outline-none focus:ring-2 focus:ring-indigo-600/20 min-w-[100px]"
        aria-label={`Edit ${categoryKey} item`}
      />
    );
  }

  return (
    <span
      role="listitem"
      className="group inline-flex items-center gap-1.5 rounded-[8px] bg-gray-50 px-3 py-1.5 text-xs text-navy"
    >
      <button
        type="button"
        onClick={() => {
          setEditValue(item.value);
          setIsEditing(true);
        }}
        className="text-left hover:underline focus:underline outline-none"
        aria-label={`Edit "${item.value}"`}
      >
        {item.value}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-gray-200 hover:text-navy transition-opacity"
        aria-label={`Remove "${item.value}"`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// --- Error State Component ---

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
  onBack?: () => void;
}

function ErrorState({ error, onRetry, onBack }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="rounded-full bg-red-50 p-3">
        <AlertCircle className="h-6 w-6 text-red-500" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-navy">Extraction Failed</p>
        <p className="mt-1 text-sm text-muted-foreground" role="alert">
          {error}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={onRetry}
          className="h-10 rounded-[12px] bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}
