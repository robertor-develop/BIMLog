import assert from "node:assert/strict";
import { addProjectDisciplineInContext, normalizeProjectDisciplines, normalizeProjectLocations, primaryDiscipline } from "./project-scope-structure";

const selected = normalizeProjectDisciplines([{ id: "d-mep", code: "mep", name: "MEP" }, { id: "d-str", code: "STR", name: "Structural" }]);
assert.deepEqual(selected.map(row => row.code), ["MEP", "STR"]);
assert.equal(primaryDiscipline(selected).id, "d-mep");
assert.deepEqual(normalizeProjectDisciplines([], { disciplineId: "legacy", disciplineCode: "arc", disciplineName: "Architectural" }), [{ id: "legacy", code: "ARC", name: "Architectural" }]);
assert.throws(() => normalizeProjectDisciplines([{ id: "x", code: "A", name: "One" }, { id: "x", code: "B", name: "Two" }]), /selected only once/);
const created = addProjectDisciplineInContext({ current: selected, created: { id: "d-elec", code: "elec", name: "Electrical" }, authorized: true });
assert.equal(created.selectedId, "d-elec");
assert.equal(created.selected.filter(row => row.id === "d-elec").length, 1);
assert.throws(() => addProjectDisciplineInContext({ current: created.selected, created: { id: "other", code: "ELEC", name: "Duplicate" }, authorized: true }), /already selected/);
assert.throws(() => addProjectDisciplineInContext({ current: selected, created: { id: "d-fire", code: "FIRE", name: "Fire" }, authorized: false }), /do not have authority/);
const building = { id: "building-a", code: "A", name: "Tower A", sequence: 1 };
const locations = normalizeProjectLocations({ buildings: [building], levels: [{ id: "roof", buildingId: building.id, code: "RF", name: "Roof", sequence: 9, kind: "roof" }, { id: "b1", buildingId: building.id, code: "B1", name: "Basement 1", sequence: -1, kind: "basement" }, ...Array.from({ length: 7 }, (_, index) => ({ id: `l${index + 1}`, buildingId: building.id, code: `L${index + 1}`, name: `Level ${index + 1}`, sequence: index + 1, kind: "level" }))] });
assert.deepEqual(locations.levels.map(row => row.id), ["b1", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "roof"]);
assert.throws(() => normalizeProjectLocations({ buildings: [building], levels: [{ id: "x", buildingId: "missing", code: "X", name: "X" }] }), /reference a building/);
console.log("UX101_UX103_PROJECT_SCOPE=PASS");
