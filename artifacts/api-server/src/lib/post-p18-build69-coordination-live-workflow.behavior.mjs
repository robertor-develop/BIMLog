import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ui = await readFile(new URL("../../../bimlog/src/pages/project/CoordinationHub.tsx", import.meta.url), "utf8");
const client = await readFile(new URL("../../../../lib/api-client-react/src/coordination.ts", import.meta.url), "utf8");

for (const [name, source, pattern] of [
  ["workflow title", ui, /<h1[^>]*>Coordination Hub<\/h1>/],
  ["project convention is authoritative", ui, /useGetConvention\(projectId\)/],
  ["recent intake is project scoped", ui, /useCoordinationEvents\(projectId\)/],
  ["inactive convention fails visibly closed", ui, /No active convention[\s\S]*cannot use Coordination Hub[\s\S]*Open Convention Builder/],
  ["upload activation follows server-derived write capability", ui, /onClick=\{\(\) => canWrite && fileInputRef\.current\?\.click\(\)\}/],
  ["intake hook addresses exact project", client, /projects\/\$\{projectId\}\/coordination\/intake/],
  ["confirmation hook addresses exact project", client, /projects\/\$\{projectId\}\/coordination\/confirm/],
  ["history hook addresses exact project", client, /projects\/\$\{projectId\}\/coordination\/events/],
  ["download and queued-sync outcomes remain explicit", ui, /destinationAction: "downloaded" \| "queued_sync"/],
  ["recent intake has an honest empty state", ui, /No files processed yet — uploads will appear here\./],
]) assert.match(source, pattern, name);

console.log("PASS post-P18 Build 69 Coordination live workflow surface (10 checks)");
