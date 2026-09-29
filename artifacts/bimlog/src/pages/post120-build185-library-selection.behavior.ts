import assert from "node:assert/strict";
import { librarySelectionState } from "./settings-experience";
assert.equal(librarySelectionState({ loading: true, count: 0 }).state, "loading");
assert.equal(librarySelectionState({ error: true, count: 0 }).action, "Retry");
assert.equal(librarySelectionState({ count: 3 }).title, "3 published options available");
assert.equal(librarySelectionState({ count: 0, canAuthor: true }).action, "Create a governed draft");
assert.match(librarySelectionState({ count: 0, canAuthor: false }).action!, /company administrator/);
console.log("post120 Build 185 library selection states: PASS");
