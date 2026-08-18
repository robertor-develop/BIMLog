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
  ["retry targets one file",/retryFile\(file\)/],
  ["imported audio uses inspected media",/file\.type\.startsWith\("audio\/"\)/],
  ["imported audio has explicit non-capture origin",/addFiles\(Array\.from\(event\.target\.files \|\| \[\]\),"user-file-import"\)/],
  ["origin is not inferred from filename",/fileOriginsRef\.current\.get\(file\)/],
  ["revocation failure remains visible",/Consent revocation failed/],
  ["error receives focus",/errorRef\.current\?\.focus\(\)/],
  ["identical-byte replay is explicit",/Identical evidence already linked/],
  ["relay lifecycle is localized",/receipt-verified.*cleanup-pending.*manual-review/s],
  ["relay history is visible",/Relay status history.*Historial del estado de retransmisión/s],
  ["customer can request transcription",/Request transcription.*Solicitar transcripción/s],
  ["imported transcription obtains processing consent",/captureKind:"transcription"/],
  ["customer can review transcription",/reviewTranscription\(item\.id,item\.transcription!\.id/],
  ["attachment download is authenticated",/fetch\(`\$\{API_BASE\}\$\{asset\.downloadUrl\}`.*Authorization: `Bearer \$\{token\}`/s],
  ["download object URLs are released",/URL\.revokeObjectURL\(url\)/],
  ["completed files are skipped",/state==="success"\)continue/],
  ["feedback states are translated",/stateLabel\(item\.status\)/],
  ["history events are translated",/eventLabel\(event\.eventType\)/],
  ["scan states are translated",/stateLabel\(asset\.scanState\)/],
  ["recording states are translated",/stateLabel\(recordingState\)/],
];
for(const [name,pattern] of assertions)assert.match(source,pattern,name);
console.log(`FeedbackWidget source assertions: ${assertions.length}/${assertions.length} passed`);
