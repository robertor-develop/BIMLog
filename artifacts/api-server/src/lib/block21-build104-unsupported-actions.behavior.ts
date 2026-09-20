import assert from "node:assert/strict";
import { readBimlogSource } from "./block21-source-reader.js";

const meetings = readBimlogSource("pages/project/MeetingsTab.tsx");
const features = readBimlogSource("pages/Features.tsx");
const pricing = readBimlogSource("pages/Pricing.tsx");

assert.doesNotMatch(meetings, /Upload Meeting Recording|Subir grabación de reunión|COMING SOON|PRÓXIMAMENTE/);
assert.doesNotMatch(features, /Mac installer|macOS installer|Download for Mac/);
assert.doesNotMatch(pricing, /Mac installer|macOS installer|Download for Mac/);
assert.match(features, /Windows desktop app/);

console.log("block21 build104 unsupported actions absent from active UI: PASS");
