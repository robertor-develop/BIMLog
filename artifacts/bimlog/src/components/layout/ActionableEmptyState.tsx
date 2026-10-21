import type { ReactNode } from "react";

export type EmptyStateGuidance = { title: string; reason: string; actor: string; actionLabel: string; destination: string };

export function validateEmptyStateGuidance(value: EmptyStateGuidance) {
  return Object.values(value).every(part => part.trim().length > 0);
}

export function ActionableEmptyState({ guidance, icon, onAction }: { guidance: EmptyStateGuidance; icon?: ReactNode; onAction: () => void }) {
  return <div className="actionable-empty-state" data-destination={guidance.destination}>
    {icon}<div><strong>{guidance.title}</strong><p>{guidance.reason}</p><small>{guidance.actor}</small></div>
    <button type="button" onClick={onAction}>{guidance.actionLabel}</button>
  </div>;
}
