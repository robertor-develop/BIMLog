import { useState } from "react";
import { useListMembers, useAddMember, useRemoveMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export function TeamTab({ projectId, isAdmin = false }: { projectId: number; isAdmin?: boolean }) {
  const { t } = useI18n();
  const { getLabel, adminRoles } = useConfig();
  const { data: members, isLoading } = useListMembers(projectId);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-display font-bold text-white">{t('project.tabs.team')}</h3>
        {isAdmin && (
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('team.add')}
          </Button>
        )}
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
                <th className="px-6 py-4">{t('team.email')}</th>
                <th className="px-6 py-4">{t('team.company')}</th>
                <th className="px-6 py-4">{t('team.role')}</th>
                <th className="px-6 py-4">{t('team.joined')}</th>
                <th className="px-6 py-4 text-right">{t('team.actions')}</th>
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
                    <Badge variant={adminRoles.includes(member.role) ? 'default' : 'outline'}>
                      {getLabel('member_role', member.role)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {format(new Date(member.joinedAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && <RemoveMemberButton projectId={projectId} memberId={member.id} />}
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
  const { t } = useI18n();
  const { getOptions } = useConfig();
  const { lang } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const roleOptions = getOptions('member_role');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roleOptions[0]?.value ?? '');

  const { mutate, isPending } = useAddMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
        toast({ title: t('team.added') });
        onClose();
      }
    }
  });

  return (
    <div className="bg-card/50 p-6 rounded-xl border border-border mb-6">
      <h4 className="font-semibold text-white mb-4">{t('team.addTitle')}</h4>
      <div className="flex space-x-4">
        <div className="flex-1">
          <Input 
            placeholder={t('team.emailPlaceholder')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <select 
          className="h-12 rounded-xl border-2 border-border bg-background px-4 text-sm text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {lang === 'es' ? opt.labelEs : opt.label}
            </option>
          ))}
        </select>
        <Button 
          disabled={!email || isPending}
          onClick={() => mutate({ projectId, data: { email, role } })}
        >
          {isPending ? t('team.adding') : t('team.addButton')}
        </Button>
      </div>
    </div>
  );
}

function RemoveMemberButton({ projectId, memberId }: { projectId: number, memberId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate, isPending } = useRemoveMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
        toast({ title: t('team.removed') });
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
        if(confirm(t('team.removeConfirm'))) mutate({ projectId, memberId });
      }}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
