import type { HTMLAttributes, PropsWithChildren } from "react";
import { statusPresentation, type ExperienceStatus } from "@/lib/experience-system";
import { cn } from "@/lib/utils";

export function ExperienceStack({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("experience-stack", className)} {...props} />;
}

export function ExperiencePanel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("experience-panel", className)} {...props} />;
}

export function ExperienceStatusBadge({ status, spanish = false, children }: PropsWithChildren<{ status: ExperienceStatus; spanish?: boolean }>) {
  const presentation = statusPresentation(status, spanish);
  return <span className={cn("experience-status", presentation.className)}>{children ?? presentation.label}</span>;
}
