'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IdeaRefinement } = require('../core/idea-refinement.cjs');
const journal = require('../core/network-journal.cjs');
const input = { name:'Synthetic project', idea:'PRIVATE-IDEA-SENTINEL', connectionID:'synthetic', modelID:'synthetic-model', operationID:'operation-one' };
const proposal = { description:'Synthetic proposal.', plan:'Synthetic plan.', questions:[] };
const proposalOnly = ({progress,...value}) => value;
const envelope = value => JSON.stringify({ choices:[{ finish_reason:'stop', message:{content:typeof value === 'string' ? value : JSON.stringify(value)} }] });
const defer = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return { promise, resolve }; };
const response = value => new Response(envelope(value), { headers:{'content-type':'application/json'} });

async function fixture(t, options = {}) {
  const { loadLibrary } = require('../core/library.cjs');
  const library = await loadLibrary(require('node:path').resolve(__dirname,'../../profiles'));
  let clock=1000;
  const priorRecords=new Set(journal.snapshot().records.map(record=>record.id));
  const events=[], sent=[];
  const connection={id:'synthetic',name:'Synthetic connection',kind:'mistral',baseURL:'https://provider.invalid/v1'};
  const bench={
    connection:async()=>({...connection}), models:async()=>[{id:'synthetic-model'}], routes:async()=>[],
    skills:{context:async()=>({skills:library.skills})}, store:{decrypt:()=> 'PRIVATE-KEY-SENTINEL'},
    emit:event=>events.push(structuredClone(event)),
  };
  const service=new IdeaRefinement({ getWorkbench:()=>bench, now:()=>clock, ...options,
    fetchImpl:async(url,init)=>{sent.push({url,body:init.body});return options.fetchImpl ? options.fetchImpl(url,init) : response(proposal);} });
  t.after(()=>service.stop());
  return {service,bench,connection,events,sent,tick:ms=>{clock+=ms;}, phases:()=>events.filter(e=>e.type==='idea.status').map(e=>e.phase), records:()=>journal.snapshot().records.filter(record=>!priorRecords.has(record.id))};
}

test('idea progress binds preparation and send to the explicit operation and reviewed token without sending on review',async t=>{
  const f=await fixture(t), review=await f.service.prepare(input);
  assert.equal(review.operationID,input.operationID);assert.equal(f.sent.length,0);
  assert.deepEqual(f.phases(),['preparing','checking-connection','awaiting-review']);
  assert(f.events.every(e=>e.operationID===input.operationID));
  assert.equal(f.events[0].token,null);assert.equal(f.events.at(-1).token,review.token);
  await assert.rejects(f.service.send({token:review.token,operationID:'other-operation'}),/Gennemgå/);
  assert.equal(f.sent.length,0);
  const result=await f.service.send({token:review.token,operationID:review.operationID});assert.deepEqual(proposalOnly(result),proposal);
  assert.equal(f.sent.length,1);
  const last=f.events.at(-1);assert.equal(last.phase,'completed');assert.equal(last.requestCount,1);assert.equal(last.formatRepair,false);
  assert.deepEqual(result.progress,last);assert.notEqual(result.progress,last);assert.notEqual(result.progress.timings,last.timings);
  assert(f.events.filter(e=>e.phase!=='preparing'&&e.phase!=='checking-connection').every(e=>e.token===review.token));
  assert.equal(JSON.stringify(f.events).includes('PRIVATE-IDEA-SENTINEL'),false);
  assert.equal(JSON.stringify(f.events).includes('PRIVATE-KEY-SENTINEL'),false);
  assert.equal(JSON.stringify(f.events).includes('Synthetic proposal.'),false);
  assert.equal(JSON.stringify(f.events).includes('provider.invalid'),false);
  const records=f.records();assert.equal(records.length,1);assert.equal(records[0].category,'idea');assert.equal(records[0].attempt,1);assert.equal(records[0].status,'completed');
  assert.doesNotMatch(JSON.stringify(records),/PRIVATE-IDEA-SENTINEL|PRIVATE-KEY-SENTINEL|Synthetic proposal\.|chat\/completions/);
});

test('measured connection, headers, first body byte and read times exclude review and pre-dispatch privacy waits',async t=>{
  let f;
  f=await fixture(t,{fetchImpl:async()=>{
    f.tick(40);
    return {ok:true,status:200,headers:new Headers({'content-type':'application/json'}),body:{async *[Symbol.asyncIterator](){f.tick(60);yield Buffer.from(envelope(proposal));f.tick(20);}}};
  }});
  f.bench.models=async()=>{f.tick(11);return [{id:'synthetic-model'}];};
  f.bench.routes=async()=>{f.tick(7);return [];};
  const context=f.bench.skills.context;f.bench.skills.context=async()=>{f.tick(5);return context();};
  f.bench.privacy={dispatch:async(outgoing,transport)=>{assert.equal(f.events.at(-1).phase,'checking-data');assert.equal(f.events.at(-1).requestCount,0);f.tick(13);return transport(outgoing.url,{method:'POST',headers:outgoing.headers,body:outgoing.body,signal:outgoing.signal});}};
  const review=await f.service.prepare(input);assert.equal(f.events.at(-1).timings.preparationMs,23);
  f.tick(900);await f.service.send({token:review.token});
  assert.deepEqual(f.events.at(-1).timings,{preparationMs:23,connectionCheckMs:36,sendElapsedMs:156,responseHeadersMs:40,firstByteMs:100,responseReadMs:80});
  const received=f.events.find(e=>e.phase==='receiving');assert(received.receivedBytes>0);assert.equal(received.timings.firstByteMs,100);
  const waiting=f.events.filter(e=>e.phase==='waiting-provider');assert.equal(waiting.length,2);assert.equal(waiting[0].timings.responseHeadersMs,null);assert.equal(waiting[1].timings.responseHeadersMs,40);
});

test('Privacy Gate rejection reports zero actual model calls and no receiving phase',async t=>{
  const f=await fixture(t);
  f.bench.privacy={dispatch:async()=>{throw Object.assign(Error('Blocked.'),{code:'PRIVACY_BLOCKED'});}};
  const review=await f.service.prepare(input);await assert.rejects(f.service.send({token:review.token}),/Blocked/);
  assert.equal(f.sent.length,0);assert.equal(f.events.at(-1).phase,'error');assert.equal(f.events.at(-1).requestCount,0);
  assert.equal(f.phases().includes('waiting-provider'),false);assert.equal(f.phases().includes('receiving'),false);
  assert.equal(f.records().length,0);
});

test('Stop during catalogue validation cancels later work and emits one terminal status',async t=>{
  const f=await fixture(t), entered=defer(), catalogue=defer();
  f.bench.models=async()=>{entered.resolve();return catalogue.promise;};
  let routeCalls=0;f.bench.routes=async()=>{routeCalls++;return [];};
  const preparing=f.service.prepare(input), rejected=assert.rejects(preparing,/stoppet/);
  await entered.promise;f.service.stop();const count=f.events.length;catalogue.resolve([{id:'synthetic-model'}]);await rejected;
  assert.equal(f.events.length,count);assert.equal(f.events.at(-1).phase,'stopped');assert.equal(f.events.filter(e=>e.phase==='stopped').length,1);
  assert.equal(f.sent.length,0);assert.equal(routeCalls,0);assert.equal(f.service.review,null);
});

test('late headers and content after Stop cannot update a newer operation or publish an old answer',async t=>{
  const entered=defer(), late=defer();let calls=0;
  const f=await fixture(t,{fetchImpl:async()=>{if(++calls===1){entered.resolve();return late.promise;}return response(proposal);}});
  const first=await f.service.prepare(input), sending=f.service.send({token:first.token}), rejected=assert.rejects(sending,/stoppet/);
  await entered.promise;f.service.stop();
  const next=await f.service.prepare({...input,operationID:'operation-two'}), offset=f.events.length;
  late.resolve(response({description:'OLD-ANSWER',plan:'Old.',questions:[]}));await rejected;
  assert.equal(f.events.length,offset);assert.deepEqual(f.service.messages,[]);
  assert.deepEqual(proposalOnly(await f.service.send({token:next.token,operationID:next.operationID})),proposal);
  assert(f.events.slice(offset).every(e=>e.operationID==='operation-two'));assert.equal(f.events.at(-1).requestCount,1);
});

test('one format repair is visible and counted separately without publishing raw invalid model output',async t=>{
  let calls=0;
  const f=await fixture(t,{fetchImpl:async()=>response(++calls===1?'PRIVATE-BAD-OUTPUT '.repeat(200):proposal)});
  const review=await f.service.prepare(input);assert.deepEqual(proposalOnly(await f.service.send({token:review.token})),proposal);
  assert.equal(f.sent.length,2);const repair=f.events.filter(e=>e.phase==='format-repair');assert.equal(repair.length,1);assert.equal(repair[0].requestCount,1);assert.equal(repair[0].formatRepair,true);
  assert.equal(f.events.at(-1).requestCount,2);assert.equal(f.events.at(-1).phase,'completed');
  assert.equal(JSON.stringify(f.events).includes('PRIVATE-BAD-OUTPUT'),false);
  assert.equal(f.sent[0].url,f.sent[1].url);assert.equal(JSON.parse(f.sent[0].body).model,JSON.parse(f.sent[1].body).model);
  assert.deepEqual(f.records().map(record=>({attempt:record.attempt,status:record.status,purpose:record.purpose})),[{attempt:1,status:'completed',purpose:'idea-refinement'},{attempt:2,status:'completed',purpose:'idea-format-repair'}]);
  assert.doesNotMatch(JSON.stringify(f.records()),/PRIVATE-BAD-OUTPUT/);
});

test('a second invalid format terminates after two requests with no transport retry or late completion',async t=>{
  const f=await fixture(t,{fetchImpl:async()=>response('{"description":"unfinished')});
  const review=await f.service.prepare(input);await assert.rejects(f.service.send({token:review.token}),/ufuldstændigt/);
  assert.equal(f.sent.length,2);assert.equal(f.events.at(-1).requestCount,2);assert.equal(f.events.at(-1).phase,'error');
  assert.equal(f.events.filter(e=>e.phase==='format-repair').length,1);assert.equal(f.phases().includes('completed'),false);
});

test('timeouts remain errors, not user Stop, and perform no hidden retry',async t=>{
  const f=await fixture(t,{fetchImpl:async()=>{throw new DOMException('Synthetic timeout','TimeoutError');}});
  const review=await f.service.prepare(input);await assert.rejects(f.service.send({token:review.token}),/tidsfristen/);
  assert.equal(f.sent.length,1);assert.equal(f.events.at(-1).phase,'error');assert.equal(f.events.at(-1).requestCount,1);
  assert.equal(f.phases().includes('stopped'),false);
});

test('changed recipient stops before transport and observational failures cannot affect an approved send',async t=>{
  const f=await fixture(t);let review=await f.service.prepare(input);
  f.connection.baseURL='https://changed.invalid/v1';await assert.rejects(f.service.send({token:review.token}),/ændret/);
  assert.equal(f.sent.length,0);assert.equal(f.events.at(-1).requestCount,0);
  f.bench.emit=event=>{event.timings.preparationMs=-999;throw Error('Observer failure');};
  review=await f.service.prepare({...input,operationID:'observational'});assert.deepEqual(proposalOnly(await f.service.send({token:review.token})),proposal);
  assert.equal(f.sent.length,1);assert.notEqual(f.service.progress.timings.preparationMs,-999);
});

test('a terminal reply carries measured completion when pushed events arrive late and cannot be mutated by observers',async t=>{
  const f=await fixture(t), delayed=[];
  f.bench.emit=event=>{delayed.push(event);event.phase='observer-change';event.timings.responseReadMs=-1;};
  const review=await f.service.prepare(input), result=await f.service.send({token:review.token});
  assert.equal(result.progress.type,'idea.status');assert.equal(result.progress.phase,'completed');
  assert.equal(result.progress.operationID,review.operationID);assert.equal(result.progress.token,review.token);
  assert.equal(result.progress.requestCount,1);assert.equal(result.progress.timings.responseReadMs,0);
  assert.deepEqual(proposalOnly(result),proposal);assert.equal(delayed.at(-1).phase,'observer-change');
  result.progress.timings.responseReadMs=-2;assert.equal(f.service.progress.lastStatus.timings.responseReadMs,0);
  const next=await f.service.prepare(input);assert.deepEqual(JSON.parse(next.content[1].content),proposal);
  assert.doesNotMatch(JSON.stringify(next.content),/idea\.status|requestCount|responseReadMs/);
});

test('operation identifiers are bounded metadata and legacy callers receive a generated binding',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.service.prepare({...input,operationID:'x'.repeat(81)}),/Gennemgå/);
  await assert.rejects(f.service.prepare({...input,operationID:'<script>'}),/Gennemgå/);
  const review=await f.service.prepare({...input,operationID:undefined});assert.match(review.operationID,/^[\da-f-]{36}$/);
  await f.service.send({token:review.token});assert.equal(f.events.at(-1).operationID,review.operationID);
});
