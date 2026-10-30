import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {FinancialSuspensionHistory} from './FinancialSuspensionHistory';
const events=[{id:'company-hold',scope_type:'company',project_id:null,action:'activate',reason:'<script>Hold</script>',actor_user_id:71,occurred_at:'2026-10-29T12:00:00Z'},{id:'project-release',scope_type:'project',project_id:91,action:'release',reason:'Project released only',actor_user_id:72,occurred_at:'2026-10-29T12:01:00Z'}];
const html=renderToStaticMarkup(<FinancialSuspensionHistory events={events} es={false}/>);assert.match(html,/company suspension may still block/);assert.match(html,/project 91/);assert.match(html,/company-hold/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
assert.match(renderToStaticMarkup(<FinancialSuspensionHistory events={[]} es={true}/>),/No hay eventos de suspensión/);
console.log('Financial suspension history: distinct company/project events, precedence guidance, escaped reasons and Spanish empty state PASS');
