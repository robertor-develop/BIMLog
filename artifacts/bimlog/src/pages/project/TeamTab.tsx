import React, { useState, useEffect } from "react";
import { useListMembers, useAddMember, useRemoveMember, useUpdateMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, X, Trash2, Building2, Shield, Mail, Clock, UserCheck } from "lucide-react";
import { format } from "date-fns";

const AVATAR_COLORS = ["av-blue", "av-purple", "av-green", "av-orange", "av-teal", "av-red"];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function TeamTab({ projectId, isAdmin = false }: { projectId: number; isAdmin?: boolean }) {
  const { t } = useI18n();
  const { getLabel, adminRoles } = useConfig();
  const { data: members, isLoading } = useListMembers(projectId);
  const [showAdd, setShowAdd] = useState(false);

  const byCompany = (members ?? []).reduce<Record<string, typeof members>>((acc, m) => {
    const co = m.userCompanyName || "Unknown";
    if (!acc[co]) acc[co] = [];
    acc[co]!.push(m);
    return acc;
  }, {});

  const companyCount = Object.keys(byCompany).length;
  const adminCount   = (members ?? []).filter(m => adminRoles.includes(m.role)).length;

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{t("project.tabs.team")}</div>
          <div className="section-sub">
            {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? "s" : ""} · {companyCount} {companyCount !== 1 ? "companies" : "company"} · {adminCount} admin{adminCount !== 1 ? "s" : ""}
          </div>
        </div>
        {isAdmin && !showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)} style={{ gap: 6, fontSize: 12 }}>
            <Plus style={{ width: 13, height: 13 }} />
            {t("team.add")}
          </Button>
        )}
      </div>

      {/* Add member form */}
      {showAdd && (
        <AddMemberForm projectId={projectId} onClose={() => setShowAdd(false)} />
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {/* Members grouped by company */}
      {!isLoading && (members ?? []).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(byCompany).map(([company, companyMembers]) => (
            <div key={company}>
              {/* Company header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 8, padding: "0 2px"
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: "hsl(var(--secondary))",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Building2 style={{ width: 13, height: 13, color: "hsl(var(--muted-foreground))" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))" }}>{company}</span>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                  · {companyMembers!.length} member{companyMembers!.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Member table */}
              <div className="table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("team.name")}</th>
                      <th>{t("team.email")}</th>
                      <th style={{ width: 130 }}>{t("team.role")}</th>
                      <th style={{ width: 110 }}>{t("team.joined")}</th>
                      {isAdmin && <th style={{ width: 80, textAlign: "right" }}>{t("team.actions")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {companyMembers!.map(member => {
                      const isAdminRole = adminRoles.includes(member.role);
                      const avatarColor = getAvatarColor(member.userFullName ?? "?");

                      return (
                        <tr key={member.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <div className={`avatar avatar-sm ${avatarColor}`}>
                                {member.userFullName?.charAt(0).toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                  {member.userFullName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                            {member.userEmail}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isAdminRole && (
                                <Shield style={{ width: 11, height: 11, color: "#2563EB", flexShrink: 0 }} />
                              )}
                              <span className={`badge ${isAdminRole ? "badge-blue" : "badge-gray"}`}>
                                {getLabel("member_role", member.role)}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                            {format(new Date(member.joinedAt), "MMM d, yyyy")}
                          </td>
                          {isAdmin && (
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                <RoleSelector projectId={projectId} member={member} />
                                <RemoveMemberButton projectId={projectId} memberId={member.id} />
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (members ?? []).length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <Users style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
          </div>
          <div className="empty-title">No team members yet</div>
          <div className="empty-desc">
            Add team members to grant them access to this project. Each member is assigned a role that controls their permissions.
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdd(true)}
              style={{ marginTop: 14, gap: 6, fontSize: 12 }}
            >
              <Plus style={{ width: 13, height: 13 }} />
              {t("team.add")}
            </Button>
          )}
        </div>
      )}

      {/* Pending Invitations */}
      {isAdmin && <PendingInvitations projectId={projectId} />}

      {/* Role legend */}
      {(members ?? []).length > 0 && (
        <div style={{
          marginTop: 16, padding: "12px 14px",
          background: "hsl(var(--secondary) / 0.5)",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Role permissions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { role: "project_admin", desc: "Full access — configure convention, manage team, all file operations" },
              { role: "company_lead",  desc: "Manage own company members, upload and rename files" },
              { role: "drafter",       desc: "Upload files using Name Generator, view all project content" },
              { role: "read_only",     desc: "View all content and reports — no upload or edit permissions" },
            ].map(item => (
              <div key={item.role} style={{ padding: "8px 10px", background: "hsl(var(--card))", borderRadius: 6, border: "1px solid hsl(var(--border))" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", marginBottom: 3, textTransform: "capitalize" }}>
                  {item.role.replace("_", " ")}
                </div>
                <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddMemberForm({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const roleOptions = getOptions("member_role");
  const [activeTab, setActiveTab] = useState<"existing" | "invite">("existing");

  // Existing user tab
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.value ?? "");

  // Invite by email tab
  const [invEmail, setInvEmail] = useState("");
  const [invFullName, setInvFullName] = useState("");
  const [invCompany, setInvCompany] = useState("");
  const [invRole, setInvRole] = useState(roleOptions[0]?.value ?? "");
  const [invPending, setInvPending] = useState(false);

  const { mutate, isPending } = useAddMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
        toast({ title: t("team.added") });
        onClose();
      },
      onError: () => toast({ title: "User not found — check the email address", variant: "destructive" }),
    },
  });

  const handleInvite = async () => {
    if (!invEmail) return;
    setInvPending(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const r = await fetch(`${BASE}/api/v1/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: invEmail, fullName: invFullName || undefined, companyName: invCompany || undefined, role: invRole }),
      });
      if (!r.ok) throw new Error(await r.text());
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/invitations`] });
      toast({ title: `Invitation sent to ${invEmail}` });
      onClose();
    } catch (e) {
      toast({ title: "Failed to send invitation", variant: "destructive" });
    } finally {
      setInvPending(false);
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "7px 0", fontSize: 12, fontWeight: active ? 700 : 500,
    border: "none", background: active ? "hsl(var(--background))" : "transparent",
    color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
    cursor: "pointer", borderRadius: 6, borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <div className="inline-form" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>{t("team.addTitle")}</div>
        <button onClick={onClose} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid hsl(var(--border))", paddingBottom: 0 }}>
        <button style={tabStyle(activeTab === "existing")} onClick={() => setActiveTab("existing")}>
          <UserCheck style={{ width: 12, height: 12, display: "inline", marginRight: 5 }} />
          Existing User
        </button>
        <button style={tabStyle(activeTab === "invite")} onClick={() => setActiveTab("invite")}>
          <Mail style={{ width: 12, height: 12, display: "inline", marginRight: 5 }} />
          Invite by Email
        </button>
      </div>

      {activeTab === "existing" && (
        <>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 10 }}>
            The user must already have a BIMLog account. Enter their registered email address.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input type="email" style={{ flex: 1 }} placeholder={t("team.emailPlaceholder")} value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            <select value={role} onChange={e => setRole(e.target.value)} style={{ height: 36, minWidth: 140 }}>
              {roleOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{lang === "es" ? opt.labelEs : opt.label}</option>
              ))}
            </select>
            <Button size="sm" disabled={!email || isPending} onClick={() => mutate({ projectId, data: { email, role } })} style={{ minWidth: 70 }}>
              {isPending ? "..." : t("team.addButton")}
            </Button>
          </div>
        </>
      )}

      {activeTab === "invite" && (
        <>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 10 }}>
            Send an invitation to someone who doesn't have a BIMLog account yet. When they register with this email they will be automatically added to the project.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Input type="email" style={{ flex: 1 }} placeholder="Email address *" value={invEmail} onChange={e => setInvEmail(e.target.value)} autoFocus />
              <select value={invRole} onChange={e => setInvRole(e.target.value)} style={{ height: 36, minWidth: 140 }}>
                {roleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{lang === "es" ? opt.labelEs : opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Input style={{ flex: 1 }} placeholder="Full name (optional)" value={invFullName} onChange={e => setInvFullName(e.target.value)} />
              <Input style={{ flex: 1 }} placeholder="Company (optional)" value={invCompany} onChange={e => setInvCompany(e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button size="sm" disabled={!invEmail || invPending} onClick={handleInvite} style={{ gap: 6 }}>
                <Mail style={{ width: 12, height: 12 }} />
                {invPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PendingInvitations({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInvitations = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const r = await fetch(`${BASE}/api/v1/projects/${projectId}/invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      setInvitations(data.filter((i: any) => i.status === "pending"));
    } catch (_) {}
  };

  useEffect(() => { loadInvitations(); }, [projectId]);

  const handleCancel = async (id: number) => {
    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      await fetch(`${BASE}/api/v1/projects/${projectId}/invitations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/invitations`] });
      setInvitations(prev => prev.filter(i => i.id !== id));
      toast({ title: "Invitation cancelled" });
    } catch (_) {
      toast({ title: "Failed to cancel invitation", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (invitations.length === 0) return null;

  return (
    <div style={{ marginTop: 16, padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Clock style={{ width: 13, height: 13, color: "#92400E" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Pending Invitations</span>
        <span style={{ fontSize: 11, color: "#B45309", marginLeft: 4 }}>{invitations.length} awaiting registration</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {invitations.map(inv => (
          <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 6 }}>
            <Mail style={{ width: 13, height: 13, color: "#B45309", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#78350F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
              {inv.fullName && <div style={{ fontSize: 11, color: "#92400E" }}>{inv.fullName}{inv.companyName ? ` · ${inv.companyName}` : ""}</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "#FEF9C3", color: "#854D0E", border: "1px solid #FDE68A", flexShrink: 0 }}>
              {inv.role.replace("_", " ")}
            </span>
            <span style={{ fontSize: 10, color: "#B45309", flexShrink: 0 }}>
              {new Date(inv.createdAt).toLocaleDateString()}
            </span>
            <button
              disabled={loading}
              onClick={() => handleCancel(inv.id)}
              title="Cancel invitation"
              style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "#B45309", flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
              onMouseLeave={e => (e.currentTarget.style.color = "#B45309")}
            >
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleSelector({ projectId, member }: {
  projectId: number;
  member: { id: number; role: string; userFullName?: string };
}) {
  const { lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const roleOptions = getOptions("member_role");
  const [role, setRole] = useState(member.role);

  const { mutate } = useUpdateMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
        toast({ title: "Role updated" });
      },
    },
  });

  return (
    <select
      value={role}
      onChange={e => {
        setRole(e.target.value);
        mutate({ projectId, memberId: member.id, data: { role: e.target.value } });
      }}
      style={{ height: 28, fontSize: 11, minWidth: 110, borderRadius: 5 }}
    >
      {roleOptions.map(opt => (
        <option key={opt.value} value={opt.value}>
          {lang === "es" ? opt.labelEs : opt.label}
        </option>
      ))}
    </select>
  );
}

function RemoveMemberButton({ projectId, memberId }: { projectId: number; memberId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate, isPending } = useRemoveMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
        toast({ title: t("team.removed") });
      },
    },
  });

  return (
    <button
      disabled={isPending}
      onClick={() => { if (confirm(t("team.removeConfirm"))) mutate({ projectId, memberId }); }}
      style={{
        padding: 6, borderRadius: 6, border: "none",
        background: "transparent", cursor: "pointer",
        color: "hsl(var(--muted-foreground))",
        opacity: isPending ? 0.5 : 1,
      }}
      onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
      onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
    >
      <Trash2 style={{ width: 13, height: 13 }} />
    </button>
  );
}
