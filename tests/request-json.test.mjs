import test from 'node:test';
import assert from 'node:assert/strict';
import {createJSONClient} from '../src/request-json.mjs';
test('concurrent reads share one request; expired data is refreshed',async()=>{
 let calls=0,time=0;
 const get=createJSONClient({baseUrl:'https://example.test/',ttl:10,now:()=>time,fetchImpl:async()=>{calls++;return Response.json({calls});}});
 const [a,b]=await Promise.all([get('heroes'),get('heroes')]);assert.deepEqual(a,b);assert.equal(calls,1);await get('heroes');assert.equal(calls,1);time=11;await get('heroes');assert.equal(calls,2);
});
test('failed requests are not cached and can be retried',async()=>{let calls=0;const get=createJSONClient({baseUrl:'https://example.test/',fetchImpl:async()=>++calls===1?new Response('',{status:429}):Response.json([])});await assert.rejects(get('heroes'),/ограничил/);assert.deepEqual(await get('heroes'),[]);assert.equal(calls,2);});
