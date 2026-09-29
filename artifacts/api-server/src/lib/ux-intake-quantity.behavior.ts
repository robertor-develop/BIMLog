import assert from 'node:assert/strict';
import { normalizeJobIntakeData } from './job-intake-contract';
const row = { id: 'SCOPE-1', name: 'Shop drawings', quantity: '12', unit: 'Drawings', plannedHours: '80', billingHourlyRate: '30' };
const normalized = normalizeJobIntakeData({ scopeItems: [row] });
assert.equal(normalized.scopeItems[0].quantity, '12');
assert.equal(normalized.scopeItems[0].plannedHours, '80');
assert.equal(normalized.scopeItems[0].contractValue, '360');
const legacy = normalizeJobIntakeData({ scopeItems: [{ ...row, quantity: undefined }] });
assert.equal(legacy.scopeItems[0].quantity, legacy.scopeItems[0].plannedHours);
const reordered = normalizeJobIntakeData({ scopeItems: [{ ...row, id: 'SCOPE-2' }, row] });
assert.deepEqual(reordered.scopeItems.map(item => item.id), ['SCOPE-2', 'SCOPE-1']);
assert.equal(normalizeJobIntakeData(normalized).scopeItems[0].quantity, '12');
console.log('UX023 quantity / hours / legacy / stable identity PASS');

