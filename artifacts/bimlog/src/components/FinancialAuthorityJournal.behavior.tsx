import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {FinancialAuthorityJournal,financialJournalPage} from './FinancialAuthorityJournal';
const entries=Array.from({length:73},(_,index)=>({event_type:'authority_granted',entity_id:`record-${index}`,entity_version:index,reason_code:`REASON_${index}`,explanation_en:index===72?'Last retained event <script>':'Authority granted',explanation_es:'Autoridad concedida',occurred_at:'2026-10-29T12:00:00Z'}));
const ids=[1,2,3].flatMap(page=>financialJournalPage(entries,'',page).items.map(item=>item.entity_id));assert.equal(new Set(ids).size,73);assert.deepEqual(ids,entries.map(item=>item.entity_id));assert.equal(financialJournalPage(entries,'Last retained event',1).items[0].entity_id,'record-72');assert.equal(financialJournalPage(entries,'not found',999).count,0);assert.equal(financialJournalPage(entries,'',999).page,3);
const html=renderToStaticMarkup(<FinancialAuthorityJournal entries={[entries[72]]} es={false} serverLimit={500} onReload={()=>{}}/>);assert.match(html,/limit 500/);assert.match(html,/record-72/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
assert.match(renderToStaticMarkup(<FinancialAuthorityJournal entries={[]} es={true} serverLimit={200} onReload={()=>{}}/>),/No hay eventos/);
console.log('Financial audit journal: all 73 rows reachable, full-result search, bounded pages, escaping and Spanish empty state PASS');
