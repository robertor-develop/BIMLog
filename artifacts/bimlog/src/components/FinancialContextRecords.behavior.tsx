import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {FinancialContextRecords} from './FinancialContextRecords';
const context={id:'context-2',version:2,scope_type:'project',project_id:91,base_currency:'CAD',reporting_currency:'USD',permitted_transaction_currencies:['CAD','USD','EUR'],effective_from:'2026-10-29T12:00:00Z',effective_to:null,reason:'<script>fixture</script>',created_by_id:71,created_at:'2026-10-29T11:00:00Z',supersedes_id:'context-1'};
const html=renderToStaticMarkup(<FinancialContextRecords contexts={[context]} es={false}/>);assert.match(html,/CAD \/ USD/);assert.match(html,/CAD, USD, EUR/);assert.match(html,/project 91/);assert.match(html,/context-1/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/does not convert amounts/);
assert.match(renderToStaticMarkup(<FinancialContextRecords contexts={[]} es={true}/>),/No hay contextos guardados/);
console.log('Saved financial contexts: currencies, scope/revision/dates/lineage, escaping and Spanish empty state PASS');
