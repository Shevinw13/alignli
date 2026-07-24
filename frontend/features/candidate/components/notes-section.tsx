"use client";

import { useState } from "react";
import { StickyNote, Plus, Pencil, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionCard } from "./section-card";

const MAX_NOTE_LENGTH = 5000;

interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesSectionProps {
  notes: Note[];
  onSave?: (noteId: string | null, content: string) => void;
  onDelete?: (noteId: string) => void;
}

/**
 * Notes section — supports adding and editing multiple text notes.
 * Maximum 5000 characters per note per Requirement 11.7.
 *
 * Requirement 11.7
 */
export function NotesSection({ notes, onSave, onDelete }: NotesSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setIsAdding(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || editContent.length > MAX_NOTE_LENGTH) return;
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    onSave?.(editingId, editContent);
    setEditingId(null);
    setEditContent("");
    setIsSaving(false);
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setNewContent("");
    setEditingId(null);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewContent("");
  };

  const handleSaveNew = async () => {
    if (newContent.trim().length === 0 || newContent.length > MAX_NOTE_LENGTH) return;
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    onSave?.(null, newContent);
    setIsAdding(false);
    setNewContent("");
    setIsSaving(false);
  };

  return (
    <SectionCard
      title="Notes"
      icon={<StickyNote className="h-5 w-5" aria-hidden="true" />}
    >
      <div className="space-y-4">
        {/* Existing notes */}
        {notes.length > 0 && (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-[12px] border border-gray-100 bg-gray-50 p-4"
              >
                {editingId === note.id ? (
                  <NoteEditor
                    content={editContent}
                    onChange={setEditContent}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    isSaving={isSaving}
                  />
                ) : (
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap text-sm text-navy">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {note.updatedAt !== note.createdAt
                          ? `Edited ${note.updatedAt}`
                          : note.createdAt}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(note)}
                        className="h-7 px-2 text-xs"
                        aria-label={`Edit note from ${note.createdAt}`}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        Edit
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new note */}
        {isAdding ? (
          <div className="rounded-[12px] border border-indigo-200 bg-indigo-50/30 p-4">
            <NoteEditor
              content={newContent}
              onChange={setNewContent}
              onSave={handleSaveNew}
              onCancel={handleCancelAdd}
              isSaving={isSaving}
              placeholder="Write a new note..."
            />
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartAdd}
            className="w-full"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Note
          </Button>
        )}

        {/* Empty state */}
        {notes.length === 0 && !isAdding && (
          <p className="text-center text-sm italic text-muted-foreground">
            No notes yet. Add a note to capture your observations.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Internal Note Editor ────────────────────────────────────────────────────

interface NoteEditorProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  placeholder?: string;
}

function NoteEditor({
  content,
  onChange,
  onSave,
  onCancel,
  isSaving,
  placeholder = "Edit note...",
}: NoteEditorProps) {
  const charsRemaining = MAX_NOTE_LENGTH - content.length;
  const isOverLimit = charsRemaining < 0;
  const isEmpty = content.trim().length === 0;

  return (
    <div className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => {
          if (e.target.value.length <= MAX_NOTE_LENGTH) {
            onChange(e.target.value);
          }
        }}
        maxLength={MAX_NOTE_LENGTH}
        placeholder={placeholder}
        className={cn(
          "w-full min-h-[100px] resize-y rounded-[12px] border border-border",
          "bg-white px-4 py-3 text-sm text-navy placeholder:text-muted-foreground",
          "focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100",
          "transition-colors",
          isOverLimit &&
            "border-red-300 focus:border-red-300 focus:ring-red-100"
        )}
        aria-label="Note content"
        aria-describedby="note-char-count"
      />
      <div className="flex items-center justify-between">
        <p
          id="note-char-count"
          className={cn(
            "text-xs",
            isOverLimit ? "text-red-600" : "text-muted-foreground"
          )}
        >
          {content.length}/{MAX_NOTE_LENGTH} characters
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
            className="h-7 px-2"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={isEmpty || isOverLimit || isSaving}
            className="h-7 px-3"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
