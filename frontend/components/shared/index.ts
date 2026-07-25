// Shared components module
// Reusable UI components used across features
export { AccessibleDialog } from "./accessible-dialog";
export { ApiClientProvider } from "./api-client-provider";
export { Breadcrumb } from "./breadcrumb";
export type { BreadcrumbItem } from "./breadcrumb";
export { ErrorBoundary } from "./error-boundary";
export { LoadingWrapper, InlineSpinner } from "./loading-wrapper";
export { NetworkErrorCard } from "./network-error-card";
export { PageErrorBoundary } from "./page-error-boundary";
export { ReconnectingIndicator } from "./reconnecting-indicator";
export { Sidebar } from "./sidebar";
export { SkipToContent } from "./skip-to-content";
export { Toast, type ToastVariant } from "./toast";
export { ToastProvider, useToast } from "./toast-provider";
export type { ToastItem } from "./toast-provider";
export {
  NotificationProvider,
  NotificationCenter,
  useNotifications,
} from "./notification-center";
export type { Notification, NotificationType } from "./notification-center";
export { Confetti } from "./confetti";
export { AISuggestionCard } from "./ai-suggestion-card";
