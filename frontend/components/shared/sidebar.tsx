"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Settings, User, Menu, X, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Jobs", href: "/", icon: FolderKanban },
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px) and (max-width: 1024px)");
    function handleMediaChange(e: MediaQueryListEvent | MediaQueryList) {
      setCollapsed(e.matches);
    }
    handleMediaChange(mediaQuery);
    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        className={cn(
          "fixed top-4 left-4 z-50 lg:hidden",
          "flex h-10 w-10 items-center justify-center rounded-xl",
          "bg-white border border-gray-200 shadow-sm",
          "text-gray-700 hover:bg-gray-50",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
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
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar-nav"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col",
          "bg-[#0f0f14] border-r border-white/[0.06]",
          "transition-all duration-200 ease-out",
          collapsed ? "w-16" : "w-56",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex h-14 items-center px-4">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5",
              collapsed && "justify-center"
            )}
            aria-label="Narrowli home"
          >
            {/* Logo mark — abstract "N" shape */}
            <img src="/narrowli.png" alt="Narrowli" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg" />
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold text-white tracking-tight">
                  Narrowli
                </span>
                <span className="text-[10px] text-gray-500 leading-tight">
                  60-second hiring decisions
                </span>
              </div>
            )}
          </Link>
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
                  "text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200",
                  collapsed && "justify-center px-2"
                )}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-violet-400" : "text-gray-500")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="hidden lg:flex items-center justify-center border-t border-white/[0.06] p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              "text-gray-500 hover:bg-white/[0.06] hover:text-gray-300",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronsLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
