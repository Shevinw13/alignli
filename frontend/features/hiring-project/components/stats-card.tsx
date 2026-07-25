import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

export function StatsCard({ label, value, icon }: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-border bg-white p-4",
        "hover-elevate"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gray-100 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-navy">{value}</p>
        </div>
      </div>
    </div>
  );
}
