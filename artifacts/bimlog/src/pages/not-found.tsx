import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center space-y-4 px-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">{t('notFound.title')}</h1>
        <p className="text-muted-foreground">{t('notFound.message')}</p>
        <Link href="/" className="inline-block mt-4 text-primary hover:underline">
          {t('notFound.backHome')}
        </Link>
      </div>
    </div>
  );
}
