import assert from "node:assert/strict";
import { addProjectDisciplineInContext, normalizeProjectDisciplines, primaryDiscipline } from "./project-scope-structure";

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
console.log("UX101_UX102_PROJECT_DISCIPLINES=PASS");
