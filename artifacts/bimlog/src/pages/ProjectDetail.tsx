import { Link, useRoute, useLocation } from "wouter";
import { useGetProject } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { FilesTab } from "./project/FilesTab";
import { RfisTab } from "./project/RfisTab";
import { SubmittalsTab } from "./project/SubmittalsTab";
import { ActivityTab } from "./project/ActivityTab";
import { TeamTab } from "./project/TeamTab";
import { ConventionBuilder } from "./project/ConventionBuilder";
import { NameGenerator } from "./project/NameGenerator";
import { 
  FolderOpen, MessageSquare, FileCheck, Activity, 
  Users, Settings2, Wand2 
} from "lucide-react";

export function ProjectDetail() {
  const [match, params] = useRoute("/projects/:id/:tab");
  const projectId = params?.id ? parseInt(params.id) : 0;
  const tab = params?.tab || "files";
  const { t } = useI18n();

  const { data: project, isLoading } = useGetProject(projectId);

  if (isLoading) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!project) return <div className="p-8 text-center">Project not found</div>;

  const tabs = [
    { id: 'files', label: t('project.tabs.files'), icon: FolderOpen },
    { id: 'rfis', label: t('project.tabs.rfis'), icon: MessageSquare },
    { id: 'submittals', label: t('project.tabs.submittals'), icon: FileCheck },
    { id: 'activity', label: t('project.tabs.activity'), icon: Activity },
    { id: 'team', label: t('project.tabs.team'), icon: Users },
    { id: 'generator', label: t('project.tabs.generator'), icon: Wand2 },
    { id: 'convention', label: t('project.tabs.convention'), icon: Settings2 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
      {/* Sidebar */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="glass-panel p-6 rounded-2xl mb-6">
          <div className="text-xs font-bold text-accent uppercase tracking-wider mb-1">{project.code}</div>
          <h2 className="text-xl font-display font-bold text-white leading-tight">{project.name}</h2>
        </div>

        <nav className="space-y-1">
          {tabs.map((tItem) => {
            const isActive = tab === tItem.id;
            const Icon = tItem.icon;
            return (
              <Link 
                key={tItem.id} 
                href={`/projects/${projectId}/${tItem.id}`}
                className={`
                  flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-primary/20 text-primary border border-primary/30' 
                    : 'text-muted-foreground hover:bg-card hover:text-white border border-transparent'
                  }
                `}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {tItem.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 glass-panel rounded-3xl p-6 md:p-8 min-h-[600px]">
        {tab === 'files' && <FilesTab projectId={projectId} />}
        {tab === 'rfis' && <RfisTab projectId={projectId} />}
        {tab === 'submittals' && <SubmittalsTab projectId={projectId} />}
        {tab === 'activity' && <ActivityTab projectId={projectId} />}
        {tab === 'team' && <TeamTab projectId={projectId} />}
        {tab === 'convention' && <ConventionBuilder projectId={projectId} />}
        {tab === 'generator' && <NameGenerator projectId={projectId} />}
      </div>
    </div>
  );
}
