export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-5">
            <span className="font-display font-bold text-white text-lg">B</span>
          </div>
          <h1 className="font-display font-bold text-foreground text-2xl">{title}</h1>
          <p className="text-muted-foreground text-sm mt-1.5">{subtitle}</p>
        </div>
        <div className="card p-6">
          {children}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-5">{footer}</p>
      </div>
    </div>
  );
}
