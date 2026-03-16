import { useState } from "react";
import { useListMembers, useAddMember, useRemoveMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export function TeamTab({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const { data: members, isLoading } = useListMembers(projectId);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-display font-bold text-white">{t('project.tabs.team')}</h3>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('team.add')}
        </Button>
      </div>

      {showAdd && <AddMemberForm projectId={projectId} onClose={() => setShowAdd(false)} />}

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm text-left">
            <thead className="bg-card text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">{t('team.name')}</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">{t('team.role')}</th>
                <th className="px-6 py-4">{t('team.joined')}</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {members?.map((member) => (
                <tr key={member.id} className="hover:bg-card/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-white flex items-center">
                    <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center mr-3 text-xs font-bold">
                      {member.userFullName.charAt(0)}
                    </div>
                    {member.userFullName}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{member.userEmail}</td>
                  <td className="px-6 py-4 text-muted-foreground">{member.userCompanyName}</td>
                  <td className="px-6 py-4">
                    <Badge variant={member.role === 'project_admin' ? 'default' : 'outline'}>
                      {member.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {format(new Date(member.joinedAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <RemoveMemberButton projectId={projectId} memberId={member.userId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddMemberForm({ projectId, onClose }: { projectId: number, onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'project_admin' | 'drafter' | 'read_only'>('drafter');
  
  const { mutate, isPending } = useAddMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] });
        toast({ title: "Member added" });
        onClose();
      }
    }
  });

  return (
    <div className="bg-card/50 p-6 rounded-xl border border-border mb-6">
      <h4 className="font-semibold text-white mb-4">Add Team Member</h4>
      <div className="flex space-x-4">
        <div className="flex-1">
          <Input 
            placeholder="User Email" 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <select 
          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-sm text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
        >
          <option value="project_admin">Project Admin</option>
          <option value="drafter">Drafter</option>
          <option value="read_only">Read Only</option>
        </select>
        <Button 
          disabled={!email || isPending}
          onClick={() => mutate({ projectId, data: { email, role } })}
        >
          {isPending ? 'Adding...' : 'Add'}
        </Button>
      </div>
    </div>
  );
}

function RemoveMemberButton({ projectId, memberId }: { projectId: number, memberId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate, isPending } = useRemoveMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/members`] });
        toast({ title: "Member removed" });
      }
    }
  });

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      disabled={isPending}
      onClick={() => {
        if(confirm("Remove this member?")) mutate({ projectId, memberId });
      }}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
