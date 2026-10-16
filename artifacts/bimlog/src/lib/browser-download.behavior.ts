import assert from "node:assert/strict";
import { prepareBrowserDownload } from "./browser-download";

for (const [label, content] of [["populated", "\uFEFF\"Item\",\"Value\"\r\n\"Labor\",\"100.00\""], ["empty", "\uFEFF\"Item\",\"Value\""]] as const) {
  const events: string[] = [];
  const anchor = {
    href: "", download: "", rel: "", hidden: false,
    click() { events.push("click"); },
    remove() { events.push("remove"); },
  } as unknown as HTMLAnchorElement;
  const result = prepareBrowserDownload(new Blob([content], { type: "text/csv;charset=utf-8" }), `apu-${label}.csv`, {
    createObjectURL(blob) { assert.ok(blob.size > 0); events.push("url"); return `blob:${label}`; },
    document: {
      createElement(tag: string) { assert.equal(tag, "a"); events.push("create"); return anchor; },
      body: { append(node: Node) { assert.equal(node, anchor); events.push("append"); } } as HTMLElement,
    },
  });
  assert.deepEqual(events, ["url", "create", "append", "click", "remove"]);
  assert.deepEqual(result, { url: `blob:${label}`, filename: `apu-${label}.csv` });
  assert.equal(anchor.href, `blob:${label}`);
  assert.equal(anchor.download, `apu-${label}.csv`);
  assert.equal(anchor.rel, "noopener");
}

console.log("APU browser CSV preparation: populated and empty files initiate a download and retain a prepared-file fallback PASS");
