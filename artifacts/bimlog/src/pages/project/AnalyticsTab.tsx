export function AnalyticsTab({ projectId }: { projectId: number }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "hsl(var(--muted-foreground))" }}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      </div>
      <div className="empty-title">Analytics</div>
      <div className="empty-desc">Project analytics and reporting will appear here.</div>
    </div>
  );
}
