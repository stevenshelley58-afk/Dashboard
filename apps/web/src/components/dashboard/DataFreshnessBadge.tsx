import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DataFreshnessBadgeProps {
  asOf: string | null;
  className?: string;
}

export function DataFreshnessBadge({ asOf, className }: DataFreshnessBadgeProps) {
  if (!asOf) {
    return (
      <Badge variant="warning" className={cn("text-xs", className)}>
        Data pending
      </Badge>
    );
  }

  const now = new Date();
  const dataTime = new Date(asOf);
  const ageMinutes = Math.floor((now.getTime() - dataTime.getTime()) / (1000 * 60));

  if (ageMinutes < 5) {
    return (
      <Badge variant="success" className={cn("text-xs", className)}>
        Updated {ageMinutes}m ago
      </Badge>
    );
  }

  if (ageMinutes < 60) {
    return (
      <Badge variant="default" className={cn("text-xs", className)}>
        Updated {ageMinutes}m ago
      </Badge>
    );
  }

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) {
    return (
      <Badge variant="warning" className={cn("text-xs", className)}>
        Updated {ageHours}h ago
      </Badge>
    );
  }

  return (
    <Badge variant="error" className={cn("text-xs", className)}>
      Stale data
    </Badge>
  );
}



