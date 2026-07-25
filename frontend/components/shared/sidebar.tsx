"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Settings, User, Menu, X, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./notification-center";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Hiring Projects", href: "/", icon: FolderKanban },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Account", href: "/account", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile sidebar on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Auto-collapse on tablet viewports (768px–1024px)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px) and (max-width: 1024px)");

    function handleMediaChange(e: MediaQueryListEvent | MediaQueryList) {
      setCollapsed(e.matches);
    }

    // Set initial state
    handleMediaChange(mediaQuery);

    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        className={cn(
          "fixed top-4 left-4 z-50 lg:hidden",
          "flex h-10 w-10 items-center justify-center rounded-[12px]",
          "bg-white border border-border shadow-[0_2px_4px_rgba(0,0,0,0.05)]",
          "text-navy interactive hover:bg-indigo-50",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        )}
        onClick={toggleMobile}
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
        aria-controls="sidebar-nav"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar-nav"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col",
          "border-r border-border bg-white",
          "shadow-[0_4px_4px_rgba(0,0,0,0.05)]",
          "transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]",
          // Width: collapsed vs expanded
          collapsed ? "w-16" : "w-56",
          // Mobile: hidden by default, shown when open
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible
          "lg:translate-x-0"
        )}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 interactive",
              collapsed && "justify-center"
            )}
            aria-label="BTS home"
          >
            <img src="/logo.jpeg" alt="BTS" className="h-8 w-8 shrink-0 rounded-[4px]" />
            {!collapsed && (
              <span className="text-lg font-bold text-navy">
                BTS
              </span>
            )}
          </Link>
          {!collapsed && <NotificationCenter />}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5" aria-label="Sidebar navigation">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/projects")
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2",
                  "text-sm font-medium interactive",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                  isActive
                    ? "bg-gray-100 text-navy font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-navy",
                  collapsed && "justify-center px-2"
                )}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-navy" : "text-gray-400")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (visible on tablet/desktop) */}
        <div className="hidden lg:flex items-center justify-center border-t border-border p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[8px]",
              "text-muted-foreground interactive hover:bg-indigo-50 hover:text-indigo-600",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
