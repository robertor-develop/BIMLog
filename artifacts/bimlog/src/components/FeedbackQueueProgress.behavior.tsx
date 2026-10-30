import React from 'react';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {FeedbackQueueProgress} from './FeedbackQueueProgress';
const queue={phase:'processing',attempts:1,maxAttempts:3,processingUntil:'2026-10-29T12:05:00Z',nextAttemptAt:null,observedAt:'2026-10-29T12:00:00Z'};
const english=renderToStaticMarkup(<FeedbackQueueProgress queue={queue} es={false} onRefresh={()=>{}}/>);assert.match(english,/Agent processing/);assert.match(english,/1 \/ 3/);assert.match(english,/does not claim work/);assert.match(english,/Refresh my feedback status/);
const spanish=renderToStaticMarkup(<FeedbackQueueProgress queue={{...queue,phase:'awaiting_recovery'}} es={true} onRefresh={()=>{}}/>);assert.match(spanish,/esperando recuperación/);assert.match(spanish,/no reclama trabajos/);
assert.equal(renderToStaticMarkup(<FeedbackQueueProgress queue={null} es={true} onRefresh={()=>{}}/>),'');
console.log('Rendered queue progress: claim, recovery, safe refresh, Spanish and absent states PASS');
