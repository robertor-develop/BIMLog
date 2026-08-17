import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseExactFileDeepLink } from "./FilesTab.tsx";
import { parseExactTransmittalDeepLink } from "./TransmittalsTab.tsx";

const tests: Array<[string, () => void]> = [];
const test = (name: string, run: () => void) => tests.push([name, run]);

const fileSource = readFileSync(fileURLToPath(new URL("./FilesTab.tsx", import.meta.url)), "utf8");
const transmittalSource = readFileSync(fileURLToPath(new URL("./TransmittalsTab.tsx", import.meta.url)), "utf8");

test("file parser accepts one positive safe integer", () => {
  assert.deepEqual(parseExactFileDeepLink("?file=42"), { kind: "valid", id: 42 });
  assert.deepEqual(parseExactFileDeepLink("?other=x"), { kind: "none" });
});

test("file parser rejects malformed, repeated, zero, and unsafe IDs", () => {
  for (const search of ["?file=abc", "?file=1.2", "?file=0", "?file=-4", "?file=4&file=5", "?file=9007199254740992"]) {
    assert.deepEqual(parseExactFileDeepLink(search), { kind: "invalid" }, search);
  }
});

test("file consumer resolves the exact loaded revision ID without name search", () => {
  assert.match(fileSource, /revision\.id === exactFileDeepLink\.id/);
  assert.match(fileSource, /\[exactFileTarget\.family, \.\.\.filteredFamilies\]/);
  assert.doesNotMatch(fileSource, /setFileQuery\([^)]*exactFile/);
});

test("file consumer expands, locates, and highlights multi- and single-revision rows", () => {
  assert.match(fileSource, /next\.add\(exactFileTarget\.family\.root\.id\)/);
  assert.match(fileSource, /file-revision-\$\{exactFileTarget\.revision\.id\}/);
  assert.match(fileSource, /data-deep-link-target=\{exactFileTarget\?\.revision\.id === ver\.id/);
  assert.match(fileSource, /isExactSingleRevision = !isMulti && exactFileTarget\?\.revision\.id === root\.id/);
  assert.match(fileSource, /id=\{isExactSingleRevision \? `file-revision-\$\{root\.id\}` : undefined\}/);
  assert.match(fileSource, /Opened exact file revision/);
});

test("file consumer visibly rejects invalid and missing IDs without substitution", () => {
  assert.match(fileSource, /The file link is invalid\. No revision was selected\./);
  assert.match(fileSource, /No other revision was selected\./);
});

test("transmittal parser accepts one positive safe integer", () => {
  assert.deepEqual(parseExactTransmittalDeepLink("?transmittal=73"), { kind: "valid", id: 73 });
  assert.deepEqual(parseExactTransmittalDeepLink("?other=x"), { kind: "none" });
});

test("transmittal parser rejects malformed, repeated, zero, and unsafe IDs", () => {
  for (const search of ["?transmittal=abc", "?transmittal=1.2", "?transmittal=0", "?transmittal=-4", "?transmittal=4&transmittal=5", "?transmittal=9007199254740992"]) {
    assert.deepEqual(parseExactTransmittalDeepLink(search), { kind: "invalid" }, search);
  }
});

test("transmittal consumer selects only the exact loaded record ID", () => {
  assert.match(transmittalSource, /items\.find\(item => item\.id === exactTransmittalDeepLink\.id\)/);
  assert.match(transmittalSource, /setSelected\(resolvedTransmittalTarget\)/);
  assert.match(transmittalSource, /\[resolvedTransmittalTarget, \.\.\.filtered\]/);
  assert.doesNotMatch(transmittalSource, /setSearch\([^)]*exactTransmittal/);
});

test("transmittal consumer opens and highlights an exact detail", () => {
  assert.match(transmittalSource, /data-deep-link-detail="true"/);
  assert.match(transmittalSource, /Opened exact transmittal/);
  assert.match(transmittalSource, /data-deep-link-target=\{openedTransmittal\?\.id === tx\.id/);
  assert.match(transmittalSource, /transmittal-\$\{openedTransmittal\.id\}/);
});

test("transmittal consumer visibly rejects invalid and missing IDs without substitution", () => {
  assert.match(transmittalSource, /The transmittal link is invalid\. No transmittal was selected\./);
  assert.match(transmittalSource, /No other transmittal was selected\./);
  assert.match(transmittalSource, /Transmittals could not be loaded\. No record was selected\./);
});

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(`PASS Project document deep links: ${passed} checks`);
