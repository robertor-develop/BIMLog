import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');
const app = read('artifacts/bimlog/src/App.tsx');
const detail = read('artifacts/bimlog/src/pages/ProjectDetail.tsx');
const routes = [...app.matchAll(/<Route path="([^"]+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/Route>)/g)].map(m => {
  const route = m[1];
  const body = m[2] + (m[3] ?? '');
  const owner = body.match(/component=\{(\w+)\}/)?.[1] ?? body.match(/<([A-Z]\w+) mode=/)?.[1];
  assert(owner, `Missing owner: ${route}`);
  return { route, owner, availability: /AccessRoute|ProjectRoute|ProtectedRoute/.test(body) ? 'gated' : 'shipping', boundary: body.includes('AccessRoute') ? 'surface permission' : body.includes('ProjectRoute') ? 'authenticated project membership; feature checks still apply' : body.includes('ProtectedRoute') ? 'authenticated; feature checks still apply' : 'public', verification: 'source route binding; runtime findings in audit/COVERAGE.md' };
});
assert.equal(routes.length, [...app.matchAll(/<Route path=/g)].length, 'Every explicit route must have a binding.');
const tabBlock = detail.match(/const PROJECT_TABS = new Set\(\[([\s\S]*?)\]\)/)?.[1];
assert(tabBlock);
const tabs = [...tabBlock.matchAll(/"([^"]+)"/g)].map(m => ({ route: `/projects/:id/${m[1]}`, owner: detail.match(new RegExp(`tab === "${m[1]}"\\s*&&\\s*(?:\\(\\s*)?<([A-Z]\\w+)`))?.[1] ?? 'ProjectDetail', availability: 'gated', boundary: 'project membership and module permissions', verification: 'source tab binding; runtime findings in audit/COVERAGE.md' }));
const result = { description: 'Shipping means route exists, not that every action passed smoke. Gated means authentication, membership, capability or data prerequisites apply. No unavailable promise is promoted to shipping.', routes: [...routes, ...tabs], unavailable: [
  { capability: 'Automatic return from all prerequisite editors', owner: 'UX017 / UX021', evidence: 'audit/AUDIT.md F01-F02' },
  { capability: 'Company-wide reusable APU picker with exact project rate lineage', owner: 'UX111-UX120', evidence: 'audit/MEETING-REQUIREMENTS.md' },
  { capability: 'Intake activation without named staffing', owner: 'UX121-UX125', evidence: 'audit/MEETING-REQUIREMENTS.md' },
  { capability: 'Approved member cost with excess-only floor rule', owner: 'UX126-UX135', evidence: 'audit/MEETING-REQUIREMENTS.md' },
] };
const target = 'docs/experience/ux-program/ROUTES.json';
const serialized = JSON.stringify(result, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(read(target), serialized, 'Route inventory drift; regenerate after reviewing new route ownership.');
else fs.writeFileSync(target, serialized);
console.log(`UX001: ${result.routes.length} route/tab bindings; ${result.unavailable.length} explicit unavailable capability groups.`);
