export function sameMeetingDraftPayload(left: unknown, right: unknown): boolean {
 const stable=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==="object"&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
 return stable(left)===stable(right);
}
