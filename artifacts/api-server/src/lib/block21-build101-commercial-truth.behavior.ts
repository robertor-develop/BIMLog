import assert from "node:assert/strict";
import { readBimlogSource } from "./block21-source-reader.js";

const landing = readBimlogSource("pages/Landing.tsx");
const features = readBimlogSource("pages/Features.tsx");
const pricing = readBimlogSource("pages/Pricing.tsx");

assert.doesNotMatch(landing, /100%.*server-side validation|under 2 minutes/);
assert.match(landing, /follow the guided setup/);
assert.match(features, /approved connectors|when configured|supported BIMLog workflows/);
assert.doesNotMatch(pricing, /SLA guaranteed uptime|Custom SLA and uptime guarantees|legally formatted/);
assert.match(pricing, /customer agreement/);

console.log("block21 build101 public commercial truth: PASS");
