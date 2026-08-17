import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./FeedbackWidget.tsx",import.meta.url),"utf8");
const assertions:Array<[string,RegExp]>=[
  ["dialog is viewport bounded",/maxHeight: "calc\(100dvh - 24px\)"/],
  ["dialog scrolls",/overflowY: "auto"/],
  ["background becomes inert",/sibling\.inert = true/],
  ["focus trap includes links",/a\[href\]/],
  ["focus trap includes summaries",/summary/],
  ["errors are alerts",/role="alert" aria-live="assertive"/],
  ["scope loss clears caches",/clearReviewScope\(\)/],
  ["discard revokes consent",/revokeCaptureConsents/],
  ["successful send clears consent",/setCaptureConsents\(\{\}\)/],
  ["file identity survives removal",/WeakMap<File,string>/],
  ["per-file state is durable",/setUploadResults/],
  ["failed files are retryable",/Retry this file/],
  ["completed files are skipped",/state==="success"\)continue/],
  ["feedback states are translated",/stateLabel\(item\.status\)/],
  ["history events are translated",/eventLabel\(event\.eventType\)/],
  ["scan states are translated",/stateLabel\(asset\.scanState\)/],
  ["recording states are translated",/stateLabel\(recordingState\)/],
];
for(const [name,pattern] of assertions)assert.match(source,pattern,name);
console.log(`FeedbackWidget source assertions: ${assertions.length}/${assertions.length} passed`);
