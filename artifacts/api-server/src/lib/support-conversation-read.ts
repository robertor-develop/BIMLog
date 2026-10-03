export type SupportConversationReadState=Readonly<{lastReadMessageId:number|null;unreadCount:number}>;

export function parseLastReadMessageId(value:unknown):number{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("SUPPORT_READ_INVALID");
  const id=(value as Record<string,unknown>).lastReadMessageId;
  if(!Number.isSafeInteger(id)||Number(id)<=0)throw new Error("SUPPORT_READ_INVALID");
  return Number(id);
}

export function supportConversationReadState(messageIds:readonly number[],lastReadMessageId:number|null):SupportConversationReadState{
  const ids=messageIds.filter(id=>Number.isSafeInteger(id)&&id>0);
  return Object.freeze({lastReadMessageId,unreadCount:ids.filter(id=>lastReadMessageId===null||id>lastReadMessageId).length});
}
