import { useState, useEffect } from "react";
import { useGetConvention, useUpsertConvention } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Plus, Trash2, GripVertical, AlertTriangle } from "lucide-react";

export function ConventionBuilder({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: convention, isLoading } = useGetConvention(projectId);
  
  const [separator, setSeparator] = useState("-");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<{label: string, values: string}[]>([]);

  useEffect(() => {
    if (convention) {
      setSeparator(convention.separator);
      setIsActive(convention.isActive);
      setFields(
        convention.fields
          .sort((a, b) => a.fieldOrder - b.fieldOrder)
          .map(f => ({ label: f.label, values: f.allowedValues.join(", ") }))
      );
    }
  }, [convention]);

  const { mutate, isPending } = useUpsertConvention({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/conventions`] });
        toast({ title: t('common.success') });
      }
    }
  });

  const handleSave = () => {
    const formattedFields = fields.map((f, idx) => ({
      label: f.label,
      fieldOrder: idx,
      allowedValues: f.values.split(",").map(v => v.trim()).filter(Boolean)
    }));

    mutate({ 
      projectId, 
      data: { separator, isActive, fields: formattedFields } 
    });
  };

  const addField = () => setFields([...fields, { label: "New Field", values: "VAL1, VAL2" }]);
  const removeField = (idx: number) => setFields(fields.filter((_, i) => i !== idx));
  const updateField = (idx: number, key: 'label'|'values', val: string) => {
    const newFields = [...fields];
    newFields[idx][key] = val;
    setFields(newFields);
  };

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h3 className="text-2xl font-display font-bold text-white flex items-center">
          <Settings2 className="w-6 h-6 mr-3 text-primary" />
          {t('convention.title')}
        </h3>
        <p className="text-muted-foreground mt-2">
          {t('convention.desc')}
        </p>
      </div>

      <div className="glass-panel p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">{t('convention.separator')}</label>
          <select 
            className="w-full h-12 rounded-xl border-2 border-border bg-background px-4 text-white focus:border-primary"
            value={separator}
            onChange={e => setSeparator(e.target.value)}
          >
            <option value="-">{t('convention.separatorHyphen')}</option>
            <option value="_">{t('convention.separatorUnderscore')}</option>
            <option value=".">{t('convention.separatorDot')}</option>
          </select>
        </div>
        <div className="flex items-center space-x-3 pt-8">
          <input 
            type="checkbox" 
            checked={isActive} 
            onChange={e => setIsActive(e.target.checked)}
            className="w-5 h-5 rounded border-border text-primary focus:ring-primary bg-background" 
          />
          <label className="text-sm font-medium text-white">{t('convention.active')}</label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold text-white">{t('convention.fields')}</h4>
          <Button onClick={addField} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            {t('convention.addField')}
          </Button>
        </div>

        {fields.length === 0 && (
          <div className="p-8 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
            {t('convention.noFields')}
          </div>
        )}

        <div className="space-y-3">
          {fields.map((field, idx) => (
            <div key={idx} className="flex items-start space-x-4 bg-card/50 p-4 rounded-xl border border-border group">
              <div className="mt-3 cursor-grab text-muted-foreground hover:text-white">
                <GripVertical className="w-5 h-5" />
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('convention.fieldLabel')}</label>
                  <Input value={field.label} onChange={e => updateField(idx, 'label', e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">{t('convention.allowedValues')}</label>
                  <Input value={field.values} onChange={e => updateField(idx, 'values', e.target.value)} />
                </div>
              </div>
              <Button variant="ghost" size="icon" className="mt-6 text-muted-foreground hover:text-destructive" onClick={() => removeField(idx)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-border flex items-center justify-between">
        <div className="flex items-center text-accent text-sm">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {t('convention.changesWarning')}
        </div>
        <Button onClick={handleSave} disabled={isPending} className="px-8">
          {isPending ? t('convention.saving') : t('convention.save')}
        </Button>
      </div>
    </div>
  );
}
