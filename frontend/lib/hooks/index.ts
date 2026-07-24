// Custom hooks module
export { useFocusTrap } from "./use-focus-trap";
export { useReducedMotion } from "./use-reduced-motion";
export { useSSE } from "./use-sse";
export type { UseSSEOptions, UseSSEReturn } from "./use-sse";

// API hooks (generic)
export { useApi, useMutation } from "./use-api";
export type { UseApiState, UseApiReturn, UseMutationReturn } from "./use-api";

// Notification bridge
export { useNotificationBridge } from "./use-notification-bridge";

// Feature-specific hooks
export { useProjects, useProject, useCreateProject, useTransitionProjectState } from "./use-projects";
export { useCandidates, useCandidateProfile, useHireCandidate } from "./use-candidates";
export { useCompareCandidates, useComparisonSummary } from "./use-comparison";
export { useCommunicationHistory, useSendEmail } from "./use-communication";
export { useCurrentPlan, useUsage, useBillingHistory, useUpgradePlan, useDowngradePlan } from "./use-billing";
export { useUploadResumes } from "./use-ingestion";
export { useExtractJobDescription, useGenerateCriteria, useProjectBrief } from "./use-ai";
