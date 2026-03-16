import { useState } from "react";
import { useListRfis, useCreateRfi } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus } from "lucide-react";
import { format } from "date-fns";

export function RfisTab({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const { data: rfis, isLoading } = useListRfis(projectId);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-display font-bold text-white">{t('project.tabs.rfis')}</h3>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />
          Create RFI
        </Button>
      </div>

      {showCreate && <CreateRfiForm projectId={projectId} onClose={() => setShowCreate(false)} />}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Number</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Creator</th>
                <th className="px-6 py-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rfis?.map((rfi) => (
                <tr key={rfi.id} className="hover:bg-card/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{rfi.number}</td>
                  <td className="px-6 py-4 font-medium text-white">{rfi.subject}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={rfi.status} />
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={rfi.priority === 'high' || rfi.priority === 'critical' ? 'destructive' : 'secondary'}>
                      {rfi.priority}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{rfi.createdByName}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {format(new Date(rfi.createdAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
              {rfis?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No RFIs created yet.
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    in_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    responded: "bg-green-500/20 text-green-400 border-green-500/30",
    closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status] || styles.open}`}>{status.replace('_', ' ').toUpperCase()}</span>;
}

function CreateRfiForm({ projectId, onClose }: { projectId: number, onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  
  const { mutate, isPending } = useCreateRfi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/rfis`] });
        toast({ title: "RFI Created" });
        onClose();
      }
    }
  });

  return (
    <div className="bg-card/50 p-6 rounded-xl border border-border mb-6">
      <h4 className="font-semibold text-white mb-4">New RFI</h4>
      <div className="flex space-x-4">
        <div className="flex-1">
          <Input 
            placeholder="RFI Subject..." 
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <select 
          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-sm text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
          id="priority"
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>
        <Button 
          disabled={!subject || isPending}
          onClick={() => mutate({ projectId, data: { subject, priority: 'medium' } })}
        >
          {isPending ? 'Creating...' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
