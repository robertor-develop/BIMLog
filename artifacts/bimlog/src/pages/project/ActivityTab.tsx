import { useListActivity } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { Activity, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

export function ActivityTab({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const { data: activities, isLoading } = useListActivity(projectId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-display font-bold text-white flex items-center">
            <Activity className="w-6 h-6 mr-3 text-accent" />
            {t('project.tabs.activity')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1" />
            {t('activity.auditTrail')}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">{t('activity.date')}</th>
                <th className="px-6 py-4">{t('activity.user')}</th>
                <th className="px-6 py-4">{t('activity.action')}</th>
                <th className="px-6 py-4">{t('activity.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {activities?.map((act) => (
                <tr key={act.id} className="hover:bg-card/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {format(new Date(act.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{act.userFullName}</div>
                    <div className="text-xs text-muted-foreground">{act.userCompanyName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-secondary rounded text-xs font-semibold text-white">
                      {act.actionType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {act.fileNameAfter ? (
                      <span className="font-mono text-xs bg-black/30 px-2 py-1 rounded">
                        {act.fileNameAfter}
                      </span>
                    ) : act.details}
                  </td>
                </tr>
              ))}
              {activities?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    {t('activity.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
