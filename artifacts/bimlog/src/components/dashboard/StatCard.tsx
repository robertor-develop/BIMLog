import React from "react";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  navigate: () => void;
}

export function StatCard({ label, value, sub, navigate }: StatCardProps) {
  return (
    <div
      className="kpi-card"
      style={{ cursor: "pointer" }}
      onClick={() => navigate()}
    >
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
