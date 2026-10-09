import React from "react";
import { ArrowRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  actionLabel: string;
  navigate: () => void;
}

export function StatCard({ label, value, sub, actionLabel, navigate }: StatCardProps) {
  return (
    <button
      type="button"
      className="kpi-card kpi-card-action"
      data-assistant-context="true"
      onClick={() => navigate()}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      <span className="kpi-action">
        {actionLabel}
        <ArrowRight aria-hidden="true" />
      </span>
    </button>
  );
}
