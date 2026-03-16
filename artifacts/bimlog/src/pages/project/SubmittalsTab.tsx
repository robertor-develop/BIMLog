import { useState } from "react";
import { useListSubmittals, useCreateSubmittal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileCheck, Plus } from "lucide-react";
import { format } from "date-fns";

export function SubmittalsTab({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const { data: submittals, isLoading } = useListSubmittals(projectId);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-display font-bold text-white">{t('project.tabs.submittals')}</h3>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Submittal
        </Button>
      </div>

      {showCreate && <CreateSubmittalForm projectId={projectId} onClose={() => setShowCreate(false)} />}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Number</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Submitted By</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {submittals?.map((sub) => (
                <tr key={sub.id} className="hover:bg-card/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{sub.number}</td>
                  <td className="px-6 py-4 font-medium text-white">{sub.title}</td>
                  <td className="px-6 py-4 text-muted-foreground capitalize">{sub.submittalType?.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <Badge variant={sub.status.includes('approved') ? 'default' : 'secondary'}>
                      {sub.status.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{sub.submittedByName}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {format(new Date(sub.createdAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
              {submittals?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No Submittals created yet.
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

function CreateSubmittalForm({ projectId, onClose }: { projectId: number, onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  
  const { mutate, isPending } = useCreateSubmittal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/submittals`] });
        toast({ title: "Submittal Created" });
        onClose();
      }
    }
  });

  return (
    <div className="bg-card/50 p-6 rounded-xl border border-border mb-6">
      <h4 className="font-semibold text-white mb-4">New Submittal</h4>
      <div className="flex space-x-4">
        <div className="flex-1">
          <Input 
            placeholder="Submittal Title..." 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <select 
          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-sm text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
          id="type"
        >
          <option value="shop_drawing">Shop Drawing</option>
          <option value="product_data">Product Data</option>
          <option value="sample">Sample</option>
        </select>
        <Button 
          disabled={!title || isPending}
          onClick={() => mutate({ projectId, data: { title, submittalType: 'shop_drawing' } })}
        >
          {isPending ? 'Creating...' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
