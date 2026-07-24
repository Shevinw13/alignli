"use client";

import { cn } from "@/lib/utils";
import { Receipt, CheckCircle, XCircle, Clock } from "lucide-react";
import type { BillingHistoryItem } from "../types";

interface BillingHistoryProps {
  items: BillingHistoryItem[];
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; style: string; label: string }> = {
  paid: { icon: CheckCircle, style: "text-emerald-600", label: "Paid" },
  open: { icon: Clock, style: "text-amber-600", label: "Pending" },
  void: { icon: XCircle, style: "text-gray-500", label: "Void" },
  uncollectible: { icon: XCircle, style: "text-red-600", label: "Failed" },
};

export function BillingHistory({ items }: BillingHistoryProps) {
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-navy">Billing History</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your past invoices and payments.
          </p>
        </div>
        <div className="rounded-[16px] border border-border bg-white px-6 py-8 text-center">
          <Receipt className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted-foreground">
            No billing history yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-navy">Billing History</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your past invoices and payments.
        </p>
      </div>

      <div
        className="rounded-[16px] border border-border bg-white"
        role="table"
        aria-label="Billing history"
      >
        {/* Header */}
        <div
          className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-3 md:grid-cols-[1fr_120px_100px_100px]"
          role="row"
        >
          <span
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            role="columnheader"
          >
            Description
          </span>
          <span
            className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:block"
            role="columnheader"
          >
            Date
          </span>
          <span
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            role="columnheader"
          >
            Amount
          </span>
          <span
            className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:block"
            role="columnheader"
          >
            Status
          </span>
        </div>

        {/* Rows */}
        {items.map((item) => {
          const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.paid;
          const StatusIcon = status.icon;

          return (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[1fr_120px_100px_100px]"
              role="row"
            >
              <div role="cell" className="min-w-0">
                <p className="truncate text-sm font-medium text-navy">
                  {item.description ?? "Invoice"}
                </p>
                <p className="text-xs text-muted-foreground md:hidden">
                  {formatDate(item.created)}
                </p>
              </div>
              <div className="hidden text-sm text-muted-foreground md:block" role="cell">
                {formatDate(item.created)}
              </div>
              <div className="text-sm font-medium text-navy" role="cell">
                {formatCurrency(item.amount, item.currency)}
              </div>
              <div className="hidden md:block" role="cell">
                <span className={cn("inline-flex items-center gap-1 text-sm", status.style)}>
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {status.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
