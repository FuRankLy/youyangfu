import type { ProjectStatus } from "@/content/types";
import { cn } from "@/lib/cn";

/**
 * The small square before a project's status: solid while it is being built,
 * hollow while a seasonal project is resting. Nothing for any other status.
 */
export function StatusMark({ status, className }: { status: ProjectStatus; className?: string }) {
  if (status !== "in-progress" && status !== "seasonal") return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mr-2 inline-block h-2 w-2",
        status === "in-progress" ? "bg-cinnabar" : "border border-cinnabar",
        className,
      )}
    />
  );
}
