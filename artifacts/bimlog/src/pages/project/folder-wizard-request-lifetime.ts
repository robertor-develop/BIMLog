/** Invalidates asynchronous results on selection changes and scope teardown. */
export class FolderWizardRequestLifetime {
  private revision = 0;
  invalidate() { this.revision += 1; }
  begin() {
    const revision = ++this.revision;
    return () => revision === this.revision;
  }
}
