import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MultiApuBuilder } from "./MultiApuBuilder";
const data = {
  commercial: {
    contracts: [
      { id: "BASE", title: "Base agreement" },
      { id: "CO", title: "Change order" },
    ],
  },
  scopeItems: [],
  apuDrafts: [
    {
      id: "A1",
      contractId: "BASE",
      title: "Drafting",
      method: "hours_hourly_rate",
      hours: "100",
      hourlyRate: "35.47",
      currency: "USD",
      rateProvenance: "portfolio_default",
      canonicalVersionId: null,
    },
    {
      id: "A2",
      contractId: "BASE",
      title: "Coordination",
      method: "fixed_amount",
      fixedAmount: "2500",
      currency: "USD",
      canonicalVersionId: 8,
    },
  ],
};
const html = renderToStaticMarkup(
  <MultiApuBuilder
    data={data}
    setData={() => undefined as never}
    tt={(en) => en}
  />,
);
assert.match(html, /Multiple APUs, one clear agreement map/);
assert.match(html, /USD 3547.00/);
assert.match(html, /Approved v8/);
assert.match(html, /Suggested portfolio default/);
assert.match(html, /immutable canonical Generic APU version/);
console.log("Multiple APU Builder UI behavior: PASS");
