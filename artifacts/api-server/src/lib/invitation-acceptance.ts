import {and,eq,sql} from "drizzle-orm";
import {projectInvitations,projectMembersTable,usersTable,activityLogTable} from "@workspace/db/schema";
import {invitationTokenHash,validateInvitationState} from "./invitation-token";
import {invitationEmailLockKey,normalizeInvitationEmail,projectInvitationLockKey} from "./project-invitation-contract";
import {requireInvitationAuthority,type InvitationTransaction} from "./project-invitation-service";

export async function lockInvitation(tx:InvitationTransaction,token:unknown,email?:string) {
  const hash=invitationTokenHash(token);
  const [initial]=await tx.select().from(projectInvitations).where(eq(projectInvitations.tokenHash,hash)).limit(1);
  if(!initial)throw new Error("INVITATION_INVALID");
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${invitationEmailLockKey(normalizeInvitationEmail(initial.email))}))`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${projectInvitationLockKey(initial.projectId,initial.email)}))`);
  const [row]=await tx.select().from(projectInvitations).where(and(eq(projectInvitations.id,initial.id),eq(projectInvitations.tokenHash,hash))).for("update");
  if(!row)throw new Error("INVITATION_INVALID");
  if(email && normalizeInvitationEmail(row.email)!==normalizeInvitationEmail(email))throw new Error("INVITATION_WRONG_ACCOUNT");
  return row;
}

export async function validateInvitationAuthority(tx:InvitationTransaction,row:typeof projectInvitations.$inferSelect,email?:string) {
  validateInvitationState(row,email);
  const actor=await requireInvitationAuthority(tx,{invitedByUserId:row.invitedByUserId,projectId:row.projectId,role:row.role,purpose:row.purpose});
  if(actor.companyId!==row.companyId)throw new Error("INVITATION_REISSUE_REQUIRED");
  return actor;
}

export async function acceptLockedInvitation(tx:InvitationTransaction,row:typeof projectInvitations.$inferSelect,user:typeof usersTable.$inferSelect) {
  if(normalizeInvitationEmail(row.email)!==normalizeInvitationEmail(user.email))throw new Error("INVITATION_WRONG_ACCOUNT");
  if(row.status==='accepted' && row.acceptedByUserId===user.id) return {projectId:row.projectId,replayed:true};
  await validateInvitationAuthority(tx,row,user.email);
  if(row.purpose==='company_join' && user.companyId!==row.companyId)throw new Error("INVITATION_COMPANY_TRANSFER_REQUIRES_ADMIN");
  const [existing]=await tx.select().from(projectMembersTable).where(and(eq(projectMembersTable.projectId,row.projectId),eq(projectMembersTable.userId,user.id))).for("update");
  if(existing && existing.status!=='active')throw new Error("INVITATION_INACTIVE_MEMBER_REVIEW");
  // An invitation never silently escalates or overwrites an existing member's role.
  if(!existing)await tx.insert(projectMembersTable).values({projectId:row.projectId,userId:user.id,role:row.role,status:'active'});
  await tx.update(projectInvitations).set({status:'accepted',acceptedAt:new Date(),acceptedByUserId:user.id}).where(eq(projectInvitations.id,row.id));
  await tx.insert(activityLogTable).values({projectId:row.projectId,userId:user.id,userFullName:user.fullName,
    userCompanyName:'',actionType:'accept_invitation',entityType:'invitation',entityId:row.id,
    details:JSON.stringify({purpose:row.purpose,companyId:row.companyId,invitedByUserId:row.invitedByUserId,preservedExistingRole:Boolean(existing)})});
  return {projectId:row.projectId,replayed:false};
}
