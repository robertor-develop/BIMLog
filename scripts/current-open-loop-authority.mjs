// Validate ownership and evidence, not a permanently hardcoded historical build number.
export function validateCurrentOpenLoopAuthority(inventory) {
  const current = inventory.items.filter(item => item.currentAuthority);
  if (!current.length || current.length !== inventory.currentAuthority.uncheckedItems.length)
    throw new Error("Current open-loop authority must enumerate its actual unfinished work");
  const ids = new Set();
  for (const item of current) {
    if (ids.has(item.id)) throw new Error("Duplicate current open-loop identity");
    ids.add(item.id);
    if (item.classification !== "ACTIVE" || !inventory.currentAuthority.uncheckedItems.includes(item.id))
      throw new Error("Current authority contains a stale or unbound item");
    if (!["PRODUCT_WORK", "FIELD_EVIDENCE", "PROVIDER_EVIDENCE"].includes(item.workClass))
      throw new Error("Current work requires a valid evidence class");
    if (!item.ownership?.owner || !item.ownership?.module || !item.evidence?.length)
      throw new Error("Current work requires ownership and evidence");
    if (item.workClass === "PRODUCT_WORK" && !item.ownership.route)
      throw new Error("Product work requires its owning route");
  }
  return current;
}
