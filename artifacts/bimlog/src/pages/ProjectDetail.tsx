import { Link, useRoute } from "wouter";
import { useGetProject, useListMembers } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";
import { FilesTab } from "./project/FilesTab";
import { RfisTab } from "./project/RfisTab";
import { SubmittalsTab } from "./project/SubmittalsTab";
import { ActivityTab } from "./project/ActivityTab";
import { TeamTab } from "./project/TeamTab";
import { ConventionBuilder } from "./project/ConventionBuilder";
import { NameGenerator } from "./project/NameGenerator";
import { ChevronLeft, FolderOpen, MessageSquare, FileCheck, Activity, Users, Settings2, Wand2 } from "lucide-react";

export function ProjectDetail() {
  const [, params] = useRoute("/projects/:id/:tab");
  const projectId = params?.id ? parseInt(params.id) : 0;
  const tab = params?.tab || "files";
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { adminRoles, writeRoles } = useConfig();

  const { data: project, isLoading } = useGetProject(projectId);
  const { data: members } = useListMembers(projectId);

  const currentMember = members?.find(m => m.userId === user?.id);
  const memberRole = currentMember?.role || '';
  const isAdmin = adminRoles.includes(memberRole);
  const canWrite = writeRoles.includes(memberRole);

  if (isLoading) return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-32 bg-secondary rounded" />
        <div className="h-8 w-64 bg-secondary rounded" />
      </div>
    </div>
  );

  if (!project) return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-muted-foreground">{t('project.notFound')}</div>
  );

  const tabs = [
    { id: 'files',      label: t('project.tabs.files'),       icon: FolderOpen,    visible: true },
    { id: 'rfis',       label: t('project.tabs.rfis'),        icon: MessageSquare, visible: true },
    { id: 'submittals', label: t('project.tabs.submittals'),  icon: FileCheck,     visible: true },
    { id: 'activity',   label: t('project.tabs.activity'),    icon: Activity,      visible: true },
    { id: 'team',       label: t('project.tabs.team'),        icon: Users,         visible: true },
    { id: 'generator',  label: t('project.tabs.generator'),   icon: Wand2,         visible: true },
    { id: 'convention', label: t('project.tabs.convention'),  icon: Settings2,     visible: isAdmin },
  ].filter(t => t.visible);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{project.name}</span>
      </div>

      <div className="flex gap-8">

        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0">
          {/* Project info */}
          <div className="mb-4 px-3">
            <div className="text-xs font-mono font-bold text-accent bg-accent/10 border border-accent/20 rounded px-2 py-0.5 inline-block mb-1">
              {project.code}
            </div>
            <h2 className="font-display font-bold text-foreground text-base leading-tight">{project.name}</h2>
            {project.description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{project.description}</p>
            )}
          </div>

          {/* Role badge */}
          {memberRole && (
            <div className="mb-4 px-3">
              <span className="text-xs bg-secondary border border-border text-muted-foreground px-2.5 py-1 rounded-md capitalize">
                {memberRole}
              </span>
            </div>
          )}

          {/* Nav */}
          <nav className="space-y-0.5">
            {tabs.map((tItem) => {
              const isActive = tab === tItem.id;
              const Icon = tItem.icon;
              return (
                <Link
                  key={tItem.id}
                  href={`/projects/${projectId}/${tItem.id}`}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {tItem.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="card p-6 md:p-8 min-h-[500px]">
            {tab === 'files'      && <FilesTab       projectId={projectId} canWrite={canWrite} />}
            {tab === 'rfis'       && <RfisTab        projectId={projectId} canWrite={canWrite} />}
            {tab === 'submittals' && <SubmittalsTab  projectId={projectId} canWrite={canWrite} />}
            {tab === 'activity'   && <ActivityTab    projectId={projectId} />}
            {tab === 'team'       && <TeamTab        projectId={projectId} isAdmin={isAdmin} />}
            {tab === 'convention' && isAdmin && <ConventionBuilder projectId={projectId} />}
            {tab === 'generator'  && <NameGenerator  projectId={projectId} />}
          </div>
        </main>
      </div>
    </div>
  );
}
