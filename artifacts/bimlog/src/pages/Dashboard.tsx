import { useState } from "react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Users, FileText, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export function Dashboard() {
  const { t } = useI18n();
  const { data: projects, isLoading } = useListProjects();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-display font-bold text-white">{t('dashboard.title')}</h1>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-5 h-5 mr-2" />
          {t('dashboard.newProject')}
        </Button>
      </div>

      {showCreate && <CreateProjectForm onClose={() => setShowCreate(false)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects?.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Link href={`/projects/${project.id}/files`} className="block h-full">
              <div className="glass-panel p-6 rounded-2xl h-full flex flex-col hover:border-primary/50 transition-colors group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-card border border-border text-muted-foreground">
                    {project.code}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-6 flex-grow line-clamp-2">
                  {project.description || "No description provided."}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <div className="flex space-x-4">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="w-4 h-4 mr-1.5" />
                      {project.memberCount || 1}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <FileText className="w-4 h-4 mr-1.5" />
                      {project.fileCount || 0}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
        
        {projects?.length === 0 && !showCreate && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-2xl">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white">No projects yet</h3>
            <p className="text-muted-foreground mt-1 mb-6">Create your first project to get started.</p>
            <Button onClick={() => setShowCreate(true)} variant="outline">
              Create Project
            </Button>
          </div>
        )}
      </div>
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
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        toast({ title: t('common.success') });
        onClose();
      },
      onError: () => toast({ title: t('common.error'), variant: 'destructive' })
    }
  });

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mb-8 overflow-hidden"
    >
      <div className="glass-panel p-6 rounded-2xl border-primary/30">
        <h3 className="text-lg font-bold text-white mb-4">{t('project.create.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{t('project.create.name')}</label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{t('project.code')}</label>
            <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{t('project.create.desc')}</label>
            <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button 
            disabled={!formData.name || !formData.code || isPending}
            onClick={() => mutate({ data: formData })}
          >
            {t('project.create.submit')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
