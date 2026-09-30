import assert from "node:assert/strict";
import { normalizeProjectDisciplines, primaryDiscipline } from "./project-scope-structure";

const selected = normalizeProjectDisciplines([{ id: "d-mep", code: "mep", name: "MEP" }, { id: "d-str", code: "STR", name: "Structural" }]);
assert.deepEqual(selected.map(row => row.code), ["MEP", "STR"]);
assert.equal(primaryDiscipline(selected).id, "d-mep");
assert.deepEqual(normalizeProjectDisciplines([], { disciplineId: "legacy", disciplineCode: "arc", disciplineName: "Architectural" }), [{ id: "legacy", code: "ARC", name: "Architectural" }]);
assert.throws(() => normalizeProjectDisciplines([{ id: "x", code: "A", name: "One" }, { id: "x", code: "B", name: "Two" }]), /selected only once/);
console.log("UX101_PROJECT_DISCIPLINES=PASS");
