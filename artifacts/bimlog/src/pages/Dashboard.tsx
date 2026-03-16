import { useState } from "react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Users, FileText, ArrowRight, X, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Dashboard() {
  const { t } = useI18n();
  const { data: projects, isLoading } = useListProjects();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('dashboard.newProject')}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateProjectForm onClose={() => setShowCreate(false)} />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-secondary mb-4" />
              <div className="h-4 bg-secondary rounded mb-2 w-3/4" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Projects grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects?.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}/files`}>
              <div className="card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group h-full flex flex-col">

                {/* Top row */}
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2.5 py-1 rounded-md font-mono">
                    {project.code}
                  </span>
                </div>

                {/* Name + desc */}
                <h3 className="font-display font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-grow line-clamp-2 mb-5">
                  {project.description || t('dashboard.noDescription')}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {project.memberCount || 1}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      {project.fileCount || 0}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          ))}

          {/* Empty state */}
          {projects?.length === 0 && !showCreate && (
            <div className="col-span-full">
              <div className="card p-16 text-center border-dashed">
                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
                  <FolderOpen className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{t('dashboard.empty')}</h3>
                <p className="text-sm text-muted-foreground mb-6">{t('dashboard.emptyDesc')}</p>
                <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t('dashboard.createProject')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateProjectForm({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });

  const { mutate, isPending } = useCreateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/v1/projects'] });
        toast({ title: t('common.success') });
        onClose();
      },
      onError: () => toast({ title: t('common.error'), variant: 'destructive' })
    }
  });

  return (
    <div className="card p-6 mb-6 border-primary/20">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-semibold text-foreground">{t('project.create.title')}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('project.create.name')} *</label>
          <Input
            placeholder={t('project.create.namePlaceholder')}
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('project.code')} *</label>
          <Input
            placeholder="e.g. PROJ01"
            value={formData.code}
            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            className="font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('project.create.desc')}</label>
          <Input
            placeholder={t('project.create.descPlaceholder')}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} size="sm">{t('common.cancel')}</Button>
        <Button
          size="sm"
          disabled={!formData.name || !formData.code || isPending}
          onClick={() => mutate({ data: formData })}
        >
          {isPending ? '...' : t('project.create.submit')}
        </Button>
      </div>
    </div>
  );
}
