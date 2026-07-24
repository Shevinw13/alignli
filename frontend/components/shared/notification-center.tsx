"use client";

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  Bell,
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | "pipeline_complete"
  | "pipeline_failed"
  | "pipeline_processing"
  | "email_sent"
  | "email_failed"
  | "billing_warning"
  | "billing_limit_reached"
  | "info"
  | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  /** Optional link to navigate to on click */
  href?: string;
}

interface NotificationState {
  notifications: Notification[];
}

type NotificationAction =
  | { type: "ADD"; notification: Notification }
  | { type: "MARK_READ"; id: string }
  | { type: "MARK_ALL_READ" }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR_ALL" };

interface NotificationContextValue {
  /** All notifications */
  notifications: Notification[];
  /** Number of unread notifications */
  unreadCount: number;
  /** Add a notification */
  addNotification: (opts: Omit<Notification, "id" | "timestamp" | "read">) => void;
  /** Mark a single notification as read */
  markRead: (id: string) => void;
  /** Mark all notifications as read */
  markAllRead: () => void;
  /** Remove a notification */
  removeNotification: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const MAX_NOTIFICATIONS = 50;

function notificationReducer(
  state: NotificationState,
  action: NotificationAction
): NotificationState {
  switch (action.type) {
    case "ADD": {
      const updated = [action.notification, ...state.notifications];
      return { notifications: updated.slice(0, MAX_NOTIFICATIONS) };
    }
    case "MARK_READ":
      return {
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n
        ),
      };
    case "MARK_ALL_READ":
      return {
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    case "REMOVE":
      return {
        notifications: state.notifications.filter((n) => n.id !== action.id),
      };
    case "CLEAR_ALL":
      return { notifications: [] };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let notificationCounter = 0;

function generateNotificationId(): string {
  notificationCounter += 1;
  return `notif-${Date.now()}-${notificationCounter}`;
}

/**
 * NotificationProvider manages in-app notifications for billing warnings,
 * pipeline status, and other persistent alerts.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, {
    notifications: [],
  });

  const addNotification = useCallback(
    (opts: Omit<Notification, "id" | "timestamp" | "read">) => {
      dispatch({
        type: "ADD",
        notification: {
          ...opts,
          id: generateNotificationId(),
          timestamp: new Date(),
          read: false,
        },
      });
    },
    []
  );

  const markRead = useCallback((id: string) => {
    dispatch({ type: "MARK_READ", id });
  }, []);

  const markAllRead = useCallback(() => {
    dispatch({ type: "MARK_ALL_READ" });
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" });
  }, []);

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  const contextValue: NotificationContextValue = {
    notifications: state.notifications,
    unreadCount,
    addNotification,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to access the notification center.
 * Must be used within a `<NotificationProvider>`.
 */
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a <NotificationProvider>"
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Notification Icon Config
// ---------------------------------------------------------------------------

const notificationIconMap: Record<
  NotificationType,
  { icon: typeof CheckCircle; className: string }
> = {
  pipeline_complete: { icon: CheckCircle, className: "text-emerald-500" },
  pipeline_failed: { icon: XCircle, className: "text-red-500" },
  pipeline_processing: { icon: Loader2, className: "text-indigo-500 animate-spin" },
  email_sent: { icon: CheckCircle, className: "text-emerald-500" },
  email_failed: { icon: XCircle, className: "text-red-500" },
  billing_warning: { icon: AlertTriangle, className: "text-amber-500" },
  billing_limit_reached: { icon: AlertTriangle, className: "text-red-500" },
  info: { icon: Info, className: "text-indigo-500" },
  error: { icon: XCircle, className: "text-red-500" },
};

// ---------------------------------------------------------------------------
// Notification Center UI Component
// ---------------------------------------------------------------------------

/**
 * NotificationCenter renders a bell icon button that opens a dropdown
 * panel showing the notification history. Intended for use in the sidebar
 * or header navigation.
 */
export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close panel on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  function formatTimestamp(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={togglePanel}
        className={cn(
          "relative flex items-center justify-center w-9 h-9 rounded-full transition-colors",
          "hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5 text-gray-600" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notification center"
          className={cn(
            "absolute right-0 top-full mt-2 w-[360px] max-h-[480px] overflow-hidden",
            "rounded-[16px] border border-gray-200 bg-white shadow-lg",
            "flex flex-col z-[70]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Notifications
            </h2>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Mark all read
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Bell
                  className="h-8 w-8 text-gray-300 mb-2"
                  aria-hidden="true"
                />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((notification) => {
                  const { icon: Icon, className: iconClass } =
                    notificationIconMap[notification.type];

                  return (
                    <li
                      key={notification.id}
                      className={cn(
                        "group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50",
                        !notification.read && "bg-indigo-50/30"
                      )}
                    >
                      <div className="shrink-0 mt-0.5">
                        <Icon
                          className={cn("h-4 w-4", iconClass)}
                          aria-hidden="true"
                        />
                      </div>
                      <button
                        className="flex-1 min-w-0 text-left"
                        onClick={() => markRead(notification.id)}
                      >
                        <p
                          className={cn(
                            "text-sm leading-tight",
                            notification.read
                              ? "text-gray-600"
                              : "text-gray-900 font-medium"
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </button>
                      <button
                        onClick={() => removeNotification(notification.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0.5 hover:bg-gray-200"
                        aria-label={`Dismiss notification: ${notification.title}`}
                      >
                        <X className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
