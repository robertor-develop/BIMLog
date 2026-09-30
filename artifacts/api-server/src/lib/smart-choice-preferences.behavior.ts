import assert from "node:assert/strict";
import { normalizeSmartChoiceProfile, preferredEligibleChoices, rankSmartChoices, recordSmartChoiceUse } from "./smart-choice-preferences";

const catalog = Array.from({ length: 50 }, (_, index) => ({ id: `d-${index + 1}`, code: `D${index + 1}`, name: `Discipline ${index + 1}` }));
const profile = normalizeSmartChoiceProfile({ userId: 7, companyId: 2, pinnedDisciplineIds: ["d-4", "d-2", "d-4"] });
assert.deepEqual(profile.pinnedDisciplineIds, ["d-4", "d-2"]);
assert.deepEqual(preferredEligibleChoices({ eligible: catalog, companyPinnedIds: ["d-1", "foreign"], userPinnedIds: profile.pinnedDisciplineIds }).map(row => row.id), ["d-4", "d-2", "d-1"]);
assert.throws(() => normalizeSmartChoiceProfile({ userId: 7, companyId: 2, pinnedDisciplineIds: Array.from({ length: 9 }, (_, index) => `d-${index}`) }), /At most 8/);
let usage = recordSmartChoiceUse({}, "d-30", "2026-09-29T12:00:00Z");
usage = recordSmartChoiceUse(usage, "d-30", "2026-09-30T12:00:00Z");
usage = recordSmartChoiceUse(usage, "d-20", "2026-09-30T13:00:00Z");
const historical = { id: "historic", code: "OLD", name: "Historical selection" };
const ranked = rankSmartChoices({ eligible: catalog, selected: [historical], pinnedIds: profile.pinnedDisciplineIds, usage, preferredLimit: 6 });
assert.equal(ranked.all[0]?.id, "historic");
assert.ok(ranked.preferred.some(row => row.id === "historic"));
assert.ok(ranked.all.findIndex(row => row.id === "d-30") < ranked.all.findIndex(row => row.id === "d-20"));
assert.equal(ranked.all.length, 51);
console.log("UX106_UX107_SMART_CHOICE_RANKING=PASS");
