import { cn } from "@/lib/utils";

interface SkeletonProps {
  /** Shape variant */
  variant?: "text" | "circular" | "rectangular";
  /** Width (CSS value or Tailwind class) */
  width?: string;
  /** Height (CSS value or Tailwind class) */
  height?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Skeleton loading placeholder component.
 *
 * Applies a shimmer animation and uses appropriate ARIA attributes
 * for accessibility. The variant controls the shape of the placeholder.
 */
export function Skeleton({
  variant = "rectangular",
  width,
  height,
  className,
}: SkeletonProps) {
  const variantClasses = {
    text: "rounded-md h-4",
    circular: "rounded-full",
    rectangular: "rounded-md",
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "shimmer",
        variantClasses[variant],
        className
      )}
      style={{
        width: width || undefined,
        height: height || undefined,
      }}
    />
  );
}
