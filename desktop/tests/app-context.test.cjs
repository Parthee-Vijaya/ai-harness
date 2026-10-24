const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { Workbench } = require('../core/workbench.cjs');
async function setup(t, start = async()=>{}, summarize = async()=>{}) {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aura-context-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const project=path.join(root,'project');await fs.mkdir(project);
 const sends=[]; let starts=0;const bench=new Workbench({directory:path.join(root,'data'),profiles:path.resolve(__dirname,'../../profiles'),safeStorage:{},emit(){},engineFactory:()=>({active:true,session:{id:'synthetic'},start:async()=>{starts++;await start(bench)},messages:async()=>[{}],summarize:async()=>summarize(bench),send:async(text,system)=>{sends.push({text,system})},abort:async()=>{},close:async()=>{}})});t.after(()=>bench.close());await bench.activate({root:project,name:'Syntetisk projekt'});
 bench.selection=async()=>({connection:{id:'fixture',kind:'compatible',name:'Syntetisk',baseURL:'http://127.0.0.1:1/v1'},model:{id:'fixture'}});
 return {bench,project,sends,starts:()=>starts,prepare:()=>bench.prepare({mode:'chat',connectionID:'fixture',modelID:'fixture',text:'Hej'})};
}
test('every reviewed fragment hash is for the exact bytes dispatched, without changing persistent engine identity', async t=>{
 const f=await setup(t),d=await f.prepare();assert.ok(d.appContext.components.length>=4);
 await f.bench.send({text:'Hej',fingerprint:d.fingerprint,contextBinding:d.contextBinding});
 const sent=f.sends[0].system;for(const part of d.appContext.components){assert.equal(part.hash,crypto.createHash('sha256').update(part.text).digest('hex'));assert.ok(sent.includes(part.text));}
 assert.equal(f.bench.chat.engineIdentity,d.fingerprint);assert.ok(!d.appContext.scope.includes('hele forespørgslen'));
});
test('a changed context binding refuses before any engine start', async t=>{
 const f=await setup(t),d=await f.prepare();await assert.rejects(f.bench.send({text:'Hej',fingerprint:d.fingerprint,contextBinding:'stale'}),/kontekst/);assert.equal(f.starts(),0);assert.equal(f.sends.length,0);
});
for(const when of ['start','summarize'])test('a context mutation during '+when+' is refused before model dispatch',async t=>{
 const mutate=async bench=>{await fs.writeFile(path.join(bench.project.root,'AGENTS.md'),'Ny syntetisk regel');};
 const f=await setup(t,when==='start'?mutate:undefined,when==='summarize'?mutate:undefined),d=await f.prepare();
 await assert.rejects(f.bench.send({text:'Hej',fingerprint:d.fingerprint,contextBinding:d.contextBinding,compact:when==='summarize'}),/ændret sig/);assert.equal(f.sends.length,0);
});
test('changing full plan content with an unchanged id requires a new review', async t=>{
 const f=await setup(t);f.bench.chat.plan={id:'fixed',text:'Før',context:'Afklaring'};
 const d=await f.bench.prepare({mode:'build',planID:'fixed',connectionID:'fixture',modelID:'fixture'});f.bench.chat.plan.text='Efter';
 await assert.rejects(f.bench.send({text:'Byg',fingerprint:d.fingerprint,contextBinding:d.contextBinding}),/kontekst/);assert.equal(f.sends.length,0);
});

test('an existing owned copy and its next send review the same workspace while retaining canonical store policy', async t=>{
 const f=await setup(t),copy=await f.bench.copies.create(f.project,f.bench.chat.id);f.bench.chat.copy=copy;f.bench.chat.root=copy.root;
 const d=await f.prepare();await f.bench.chat.checkContext(f.bench.chat.prepared);await f.bench.send({text:'Hej',fingerprint:d.fingerprint,contextBinding:d.contextBinding});assert.equal(f.sends.length,1);
 f.bench.chat.running=false;f.bench.release(f.bench.chat);const next=await f.bench.prepare({mode:'chat',connectionID:'fixture',modelID:'fixture',text:'Igen'});await f.bench.chat.checkContext(f.bench.chat.prepared);await f.bench.send({text:'Igen',fingerprint:next.fingerprint,contextBinding:next.contextBinding});assert.equal(f.sends.length,2);
});

test('a changed prepared user message cannot reuse the same app-context review', async t=>{const f=await setup(t),d=await f.prepare();await assert.rejects(f.bench.send({text:'Anden besked',fingerprint:d.fingerprint,contextBinding:d.contextBinding}),/Beskeden er ændret/);assert.equal(f.starts(),0);});

test('planning sends the reviewed clarification and current prompt unchanged',async t=>{
 const f=await setup(t);f.bench.chat.planConversation=['Tidligere afklaring'];const text='Planlæg en lokal oversigt';
 const d=await f.bench.prepare({mode:'plan',connectionID:'fixture',modelID:'fixture',text});
 const plan=d.appContext.components.find(p=>p.id==='Planlægning og afklaring');assert.match(plan.text,/Tidligere afklaring/);
 await f.bench.send({text,fingerprint:d.fingerprint,contextBinding:d.contextBinding});
 assert.equal(f.sends[0].text,text);for(const part of d.appContext.components)assert.ok(f.sends[0].system.includes(part.text));
});

for(const kind of ['mistral','corti']) for(const mode of ['plan','build','free']) test(`${kind} ${mode}: reviewed primary design core is sent before any skill retrieval`,async t=>{
 const f=await setup(t);f.bench.selection=async()=>({connection:{id:'fixture',kind,name:'Syntetisk',baseURL:'http://127.0.0.1:1/v1'},model:{id:'fixture'}});
 f.bench.chat.plan={id:'chosen-plan',text:'Byg den aftalte oversigt',context:'Ingen eksterne data'};
 const text='En app til at melde sig til borgermøder i Nyborg Kommune';
 const d=await f.bench.prepare({mode,planID:'chosen-plan',connectionID:'fixture',modelID:'fixture',text});
 const core=d.appContext.components.find(p=>p.id==='Hovedskill til bygning');assert.ok(core);assert.match(core.text,/Fra én sætning/);
 await f.bench.send({text,fingerprint:d.fingerprint,contextBinding:d.contextBinding});assert.equal(f.sends.length,1);assert.ok(f.sends[0].system.includes(core.text));
 if(mode==='build')assert.equal(f.bench.chat.plan.id,'chosen-plan');
 else assert.equal(f.bench.chat.lastPlan.id,'chosen-plan');
});
test('ordinary chat has no forced primary core and a changed design choice invalidates the build review',async t=>{
 const f=await setup(t),chat=await f.prepare();assert.ok(!chat.appContext.components.some(p=>p.id==='Hovedskill til bygning'));
 const d=await f.bench.prepare({mode:'free',connectionID:'fixture',modelID:'fixture',text:'Byg'});
 await f.bench.features.save(f.project,{scope:'projekt',values:{design:false}});
 await assert.rejects(f.bench.send({text:'Byg',fingerprint:d.fingerprint,contextBinding:d.contextBinding}),/ændret/);
 assert.equal(f.sends.length,0);assert.equal(f.starts(),0);
 const next=await f.bench.prepare({mode:'free',connectionID:'fixture',modelID:'fixture',text:'Byg'});
 assert.ok(!next.appContext.components.some(p=>p.id==='Hovedskill til bygning'));
});
