import { useState, useEffect } from "react";
import { useGetConvention } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wand2, Copy, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export function NameGenerator({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data: convention, isLoading } = useGetConvention(projectId);
  
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (convention && convention.fields) {
      const initial: Record<number, string> = {};
      convention.fields.forEach(f => {
        if (f.allowedValues.length > 0) {
          initial[f.id] = f.allowedValues[0];
        }
      });
      setSelections(initial);
    }
  }, [convention]);

  if (isLoading) return <div>{t('common.loading')}</div>;

  if (!convention || !convention.isActive || convention.fields.length === 0) {
    return (
      <div className="text-center py-20">
        <Wand2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">{t('convention.generator.noConvention')}</h3>
        <p className="text-muted-foreground">{t('convention.generator.noConventionDesc')}</p>
      </div>
    );
  }

  const sortedFields = [...convention.fields].sort((a, b) => a.fieldOrder - b.fieldOrder);
  
  const generatedName = sortedFields
    .map(f => selections[f.id] || "---")
    .join(convention.separator);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedName);
    setCopied(true);
    toast({ title: t('convention.generator.copiedToast') });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 py-6">
      <div className="text-center">
        <h3 className="text-3xl font-display font-bold text-white mb-3">
          {t('convention.generator.title')}
        </h3>
        <p className="text-muted-foreground">
          {t('convention.generator.hint')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {sortedFields.map((field) => (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-semibold text-white/80">{field.label}</label>
            <select
              className="w-full h-12 rounded-xl border-2 border-border bg-card px-4 text-white focus:border-primary shadow-sm"
              value={selections[field.id] || ""}
              onChange={(e) => setSelections({ ...selections, [field.id]: e.target.value })}
            >
              {field.allowedValues.map((val) => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <motion.div 
        className="mt-12 bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 rounded-3xl p-8 text-center shadow-xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <p className="text-sm text-primary font-bold tracking-widest uppercase mb-4">
          {t('convention.generator.preview')}
        </p>
        <div className="text-3xl md:text-5xl font-mono font-bold text-white tracking-tight break-all mb-8">
          {generatedName}
        </div>
        
        <Button 
          size="lg" 
          onClick={handleCopy} 
          className={`px-8 transition-all ${copied ? 'bg-green-500 hover:bg-green-600' : ''}`}
        >
          {copied ? (
            <><CheckCircle2 className="w-5 h-5 mr-2" /> {t('convention.generator.copied')}</>
          ) : (
            <><Copy className="w-5 h-5 mr-2" /> {t('convention.generator.copy')}</>
          )}
        </Button>
      </motion.div>
    </div>
  );
}
