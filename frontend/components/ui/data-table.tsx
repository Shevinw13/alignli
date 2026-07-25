"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useKeyboardNavigation } from "@/lib/hooks/use-keyboard-navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

// --- Types ---

export interface Column<T> {
  id: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface BulkAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (selectedIds: Set<string>) => void;
  variant?: "default" | "destructive";
}

interface EmptyStateConfig {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Unique key extractor */
  getRowId: (row: T) => string;
  /** Enable row selection */
  selectable?: boolean;
  /** Currently selected row IDs */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** Search configuration */
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  /** Pagination page size (default 25) */
  pageSize?: number;
  /** Empty state configuration */
  emptyState?: EmptyStateConfig;
  /** Bulk actions toolbar */
  bulkActions?: BulkAction[];
  /** Sticky header */
  stickyHeader?: boolean;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Keyboard navigation */
  keyboardNav?: boolean;
}

// --- Sort State ---

type SortDirection = "asc" | "desc" | null;

interface SortState {
  columnId: string | null;
  direction: SortDirection;
}

// --- Component ---

export function DataTable<T>({
  columns,
  data,
  getRowId,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  searchable = false,
  searchPlaceholder = "Search…",
  searchFilter,
  pageSize = 25,
  emptyState,
  bulkActions,
  stickyHeader = false,
  onRowClick,
  keyboardNav = false,
}: DataTableProps<T>) {
  // --- Search state ---
  const [searchQuery, setSearchQuery] = useState("");

  // --- Sort state ---
  const [sort, setSort] = useState<SortState>({ columnId: null, direction: null });

  // --- Pagination state ---
  const [currentPage, setCurrentPage] = useState(1);

  // --- Selection state (uncontrolled fallback) ---
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = controlledSelectedIds ?? internalSelectedIds;
  const setSelectedIds = useCallback(
    (ids: Set<string>) => {
      if (onSelectionChange) {
        onSelectionChange(ids);
      } else {
        setInternalSelectedIds(ids);
      }
    },
    [onSelectionChange]
  );

  // --- Table ref for keyboard nav ---
  const tableRef = useRef<HTMLTableElement>(null);

  // --- Filtered data ---
  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return data;
    if (searchFilter) {
      return data.filter((row) => searchFilter(row, searchQuery));
    }
    // Default: stringify all accessor outputs and search
    return data.filter((row) =>
      columns.some((col) => {
        const value = col.accessor(row);
        return String(value).toLowerCase().includes(searchQuery.toLowerCase());
      })
    );
  }, [data, searchable, searchQuery, searchFilter, columns]);

  // --- Sorted data ---
  const sortedData = useMemo(() => {
    if (!sort.columnId || !sort.direction) return filteredData;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = String(column.accessor(a) ?? "");
      const bVal = String(column.accessor(b) ?? "");
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredData, sort, columns]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Reset to page 1 when search changes
  useMemo(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // --- Keyboard navigation ---
  const { activeIndex, setActiveIndex, getItemProps } = useKeyboardNavigation({
    itemCount: paginatedData.length,
    orientation: "vertical",
    onActivate: (index) => {
      const row = paginatedData[index];
      if (row && onRowClick) {
        onRowClick(row);
      }
    },
    enabled: keyboardNav,
  });

  // --- Sort toggle ---
  const handleSort = (columnId: string) => {
    setSort((prev) => {
      if (prev.columnId !== columnId) return { columnId, direction: "asc" };
      if (prev.direction === "asc") return { columnId, direction: "desc" };
      if (prev.direction === "desc") return { columnId: null, direction: null };
      return { columnId, direction: "asc" };
    });
  };

  // --- Selection handlers ---
  const allVisibleIds = useMemo(
    () => new Set(paginatedData.map(getRowId)),
    [paginatedData, getRowId]
  );

  const allSelected =
    allVisibleIds.size > 0 &&
    [...allVisibleIds].every((id) => selectedIds.has(id));

  const someSelected =
    !allSelected && [...allVisibleIds].some((id) => selectedIds.has(id));

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all visible
      const next = new Set(selectedIds);
      allVisibleIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      // Select all visible
      const next = new Set(selectedIds);
      allVisibleIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };

  const handleSelectRow = (rowId: string) => {
    const next = new Set(selectedIds);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    setSelectedIds(next);
  };

  // --- Keyboard handler for Escape to deselect ---
  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && selectable && selectedIds.size > 0) {
      setSelectedIds(new Set());
      setActiveIndex(-1);
    }
  };

  // --- Render ---
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: Search + Bulk actions */}
      <div className="flex items-center justify-between gap-3">
        {/* Search */}
        {searchable && (
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={searchPlaceholder}
            />
          </div>
        )}

        {/* Bulk actions bar */}
        {hasSelection && bulkActions && bulkActions.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {selectedIds.size} selected
            </span>
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant === "destructive" ? "destructive" : "ghost"}
                size="xs"
                onClick={() => action.onClick(selectedIds)}
                aria-label={action.label}
              >
                {action.icon && <action.icon className="size-3.5" />}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-border">
        <table
          ref={tableRef}
          className="w-full border-collapse text-sm"
          role="grid"
          onKeyDown={handleTableKeyDown}
        >
          <thead
            className={cn(
              "bg-muted/50",
              stickyHeader && "sticky top-0 z-10 bg-muted/50 backdrop-blur-sm"
            )}
          >
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-2 text-left" style={{ padding: "8px 16px" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                    className="size-4 rounded border-border"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    "text-left font-medium text-muted-foreground",
                    col.sortable && "cursor-pointer select-none hover:text-foreground"
                  )}
                  style={{
                    padding: "8px 16px",
                    width: col.width,
                  }}
                  onClick={col.sortable ? () => handleSort(col.id) : undefined}
                  aria-sort={
                    sort.columnId === col.id
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sort.columnId === col.id && (
                      sort.direction === "asc" ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  {emptyState ? (
                    <EmptyState {...emptyState} />
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No data available
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const rowId = getRowId(row);
                const isSelected = selectedIds.has(rowId);
                const itemProps = keyboardNav ? getItemProps(index) : {};

                return (
                  <tr
                    key={rowId}
                    className={cn(
                      "border-t border-border transition-colors",
                      isSelected && "bg-indigo-50 dark:bg-indigo-950/20",
                      onRowClick && "cursor-pointer hover:bg-muted/50",
                      activeIndex === index && "ring-2 ring-inset ring-ring"
                    )}
                    onClick={() => onRowClick?.(row)}
                    {...itemProps}
                  >
                    {selectable && (
                      <td style={{ padding: "8px 16px" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectRow(rowId);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select row ${rowId}`}
                          className="size-4 rounded border-border"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        style={{ padding: "8px 16px", width: col.width }}
                      >
                        {col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sortedData.length > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
