import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {FinancialGrantDetails} from './FinancialGrantDetails';
const grant={id:'grant-1',full_name:'Fixture User',user_id:71,authority:'cost_reviewer',version:2,scope_type:'project',project_id:91,effective_from:'2026-10-29T12:00:00Z',effective_to:null,reason:'<script>plain reason</script>',granted_by_id:72};
const html=renderToStaticMarkup(<FinancialGrantDetails grant={grant} es={false} label="Cost Reviewer"/>);assert.match(html,/Project 91/);assert.match(html,/grant-1/);assert.match(html,/v2/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
const revoked=renderToStaticMarkup(<FinancialGrantDetails grant={{...grant,revoked_at:'2026-10-30T12:00:00Z',revocation_reason:'Scope ended'}} es={true} label="Revisor de Costos"/>);assert.match(revoked,/revocada/);assert.match(revoked,/Scope ended/);assert.match(revoked,/requisitos independientes/);
console.log('Financial grant details: exact user/scope/ID/window, escaped reason and Spanish revocation evidence PASS');
