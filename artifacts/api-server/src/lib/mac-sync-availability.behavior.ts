import assert from 'node:assert/strict';
import router from '../routes/downloads';

const route = (router as unknown as { stack:Array<{route?:{path:string;stack:Array<{handle:Function}>}}> }).stack.find(layer=>layer.route?.path==='/downloads/sync-agent-mac')?.route;
assert.ok(route,'Mac distribution route must remain available');
let status=0; let body:any;
const response={status(value:number){status=value;return this;},json(value:unknown){body=value;return this;}};
route.stack[0].handle({},response);
assert.equal(status,200);
assert.equal(body.available,false,'unavailable distribution must not pretend to provide an installer');
assert.match(body.contact,/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
assert.match(body.message,/Mac/);
assert.match(body.whatsapp,/^https:\/\/wa\.me\/[0-9]+$/);
assert.equal(body.downloadUrl,undefined);
console.log('Mac distribution handler: explicit unavailable state, support contact, no fabricated download PASS');
