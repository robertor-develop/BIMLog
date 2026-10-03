export type SupportConversationAwareness=Readonly<{unreadCount:number;latestMessageAt:string|null}>;

export function normalizeSupportConversationAwareness(value:{unreadCount:unknown;latestMessageAt:unknown}):SupportConversationAwareness{
  const unreadCount=Number(value.unreadCount);
  if(!Number.isSafeInteger(unreadCount)||unreadCount<0)throw new Error("SUPPORT_UNREAD_COUNT_INVALID");
  if(value.latestMessageAt!==null&&(typeof value.latestMessageAt!=="string"||!Number.isFinite(Date.parse(value.latestMessageAt))))throw new Error("SUPPORT_LATEST_MESSAGE_AT_INVALID");
  if(unreadCount>0&&value.latestMessageAt===null)throw new Error("SUPPORT_UNREAD_WITHOUT_MESSAGE");
  return Object.freeze({unreadCount,latestMessageAt:value.latestMessageAt===null?null:new Date(value.latestMessageAt as string).toISOString()});
}

export function unreadSupportMessageIds(input:{actorRole:"customer"|"administrator";lastReadMessageId:number|null;messages:ReadonlyArray<{id:number;authorRole:"customer"|"administrator"}>}):number[]{
  const opposite=input.actorRole==="customer"?"administrator":"customer",cursor=input.lastReadMessageId??0;
  return input.messages.filter(message=>message.authorRole===opposite&&message.id>cursor).map(message=>message.id);
}
