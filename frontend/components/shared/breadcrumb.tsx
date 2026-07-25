"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb navigation component.
 *
 * Renders a semantic breadcrumb trail with ChevronRight separators.
 * The last item is highlighted as the current page using muted-foreground.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.href} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight
                  className="size-4 text-muted-foreground/60"
                  aria-hidden="true"
                />
              )}
              {isLast ? (
                <span
                  className="text-muted-foreground font-medium"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-foreground hover:text-primary interactive"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
