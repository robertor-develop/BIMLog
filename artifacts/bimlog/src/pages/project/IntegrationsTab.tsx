export function IntegrationsTab({ projectId }: { projectId: number }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "hsl(var(--muted-foreground))" }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </div>
      <div className="empty-title">Integrations</div>
      <div className="empty-desc">Connected tools and integrations will appear here.</div>
    </div>
  );
}
