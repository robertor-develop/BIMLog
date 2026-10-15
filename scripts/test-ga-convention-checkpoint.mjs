import assert from 'node:assert/strict';
import fs from 'node:fs';
import { activeConventionFields, suggestedConventionName } from '../artifacts/bimlog/src/lib/convention-consumer.ts';
const convention = { isActive: true, separator: '-', fields: [
  { label: 'Originator', fieldOrder: 1, allowedValues: ['ORG'] },
  { label: 'Project Code', fieldOrder: 0, allowedValues: ['PROJECT'] },
  { label: 'Revision', fieldOrder: 2, allowedValues: ['P02'] },
] };
assert.equal(activeConventionFields(convention).length, 3);
assert.equal(suggestedConventionName(convention), 'PROJECT-ORG-P02');
assert.equal(suggestedConventionName({ ...convention, separator: '_' }), 'PROJECT_ORG_P02');
assert.equal(suggestedConventionName({ ...convention, isActive: false }), null);
assert.equal(activeConventionFields(undefined).length, 0);
const source = fs.readFileSync(new URL('../artifacts/bimlog/src/pages/project/ConventionBuilder.tsx', import.meta.url), 'utf8');
const checkpoint = source.slice(source.indexOf('function CheckpointScreen('), source.indexOf('function CheckpointScreen(')+30000);
assert.ok(checkpoint.includes('activeConventionFields(currentConvention)'));
assert.ok(checkpoint.includes('suggestedConventionName(currentConvention)'));
assert.ok(!checkpoint.includes('function buildSampleName('));
assert.ok(!checkpoint.includes('<strong>{snap.acceptedFieldOrder.length}</strong>'));
console.log('PASS B-GA016/017 checkpoint uses active convention fields and distinct project/originator values; browser acceptance pending');
