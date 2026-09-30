import assert from "node:assert/strict";
import { normalizeSmartChoiceProfile, preferredEligibleChoices } from "./smart-choice-preferences";

const catalog = Array.from({ length: 50 }, (_, index) => ({ id: `d-${index + 1}`, code: `D${index + 1}`, name: `Discipline ${index + 1}` }));
const profile = normalizeSmartChoiceProfile({ userId: 7, companyId: 2, pinnedDisciplineIds: ["d-4", "d-2", "d-4"] });
assert.deepEqual(profile.pinnedDisciplineIds, ["d-4", "d-2"]);
assert.deepEqual(preferredEligibleChoices({ eligible: catalog, companyPinnedIds: ["d-1", "foreign"], userPinnedIds: profile.pinnedDisciplineIds }).map(row => row.id), ["d-4", "d-2", "d-1"]);
assert.throws(() => normalizeSmartChoiceProfile({ userId: 7, companyId: 2, pinnedDisciplineIds: Array.from({ length: 9 }, (_, index) => `d-${index}`) }), /At most 8/);
console.log("UX106_SMART_CHOICE_PINS=PASS");
