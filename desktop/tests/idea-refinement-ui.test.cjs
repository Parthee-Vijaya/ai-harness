// Production UI logic with synthetic DOM/IPC boundaries; no credentials or provider calls.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {presentation,matches,domain}=require('../ui/idea-refinement.js');
const source=fs.readFileSync(path.join(__dirname,'../ui/idea-refinement.js'),'utf8');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(){
 const nodes=new Map(),events={},calls=[],timers=new Map();let serial=0,now=1000,eventListener,saveDialog;
 class Element{
  constructor(tag='div',id=''){this.tagName=tag;this.id=id;this.children=[];this.attributes={};this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this._value='';this.listeners={};this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)};}
  get value(){return this._value;}set value(value){this._value=String(value);}
  get options(){return this.children.filter(x=>x.tagName==='option');}get selectedOptions(){return this.options.filter(x=>x.value===this.value);}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;if(this.id.includes('connection')||this.id.includes('model')||this.id.includes('route'))this.value=this.options[0]?.value||'';}
  setAttribute(key,value){this.attributes[key]=String(value);}getAttribute(key){return this.attributes[key]||null;}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(x=>x!==fn);}
  dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);}
  querySelectorAll(){return['#idea-connection','#idea-model','#idea-route','#idea-connection-add','#idea-refine-send','#idea-refine-stop'].map($);}
  focus(){document.activeElement=this;}reportValidity(){return Boolean(this.value);}showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent({type:'close'});}
 }
 const $=selector=>{if(!nodes.has(selector))nodes.set(selector,new Element('div',selector.slice(1)));return nodes.get(selector);};
 const node=(tag,text)=>{const element=new Element(tag);element.textContent=text||'';return element;};
 const option=(id,name)=>{const element=node('option',name);element.value=id;return element;};
 const document={body:new Element('body'),activeElement:null,querySelector:$};
 const connectionList=[{id:'mistral',name:'Mistral API',kind:'mistral',baseURL:'https://api.example.invalid/v1'},{id:'router',name:'OpenRouter',kind:'openrouter',baseURL:'https://router.example.invalid/v1'}];
 const send=deferred();const context={document,$,node,option,structuredClone,URL,Event:class{constructor(type){this.type=type;}},crypto:{randomUUID:()=>`operation-${++serial}`},performance:{now:()=>now},setInterval:fn=>{timers.set(++serial,fn);return serial;},clearInterval:id=>timers.delete(id),current:null,state:{connections:connectionList},syncCreateAvailability(){},updateStartupSummary(){},message(){},action:fn=>fn(),call:async(name,input)=>{calls.push({name,input});if(name==='models')return[{id:'medium',name:'Mistral Medium'}];if(name==='routes')return[{id:'nvidia',name:'Nvidia'}];if(name==='ideaPrepare')return{token:'review-token',operationID:input.operationID,disclosure:{connection:'Mistral API',model:'Mistral Medium',endpoint:'https://api.example.invalid/v1?PRIVATE'},system:'Reviewed system',content:[{role:'user',content:'Reviewed idea'}]};if(name==='ideaSend')return send.promise;return true;}};
 context.window=context;context.harness={onEvent:listener=>{eventListener=listener;}};context.addEventListener=(name,fn)=>{events[name]=fn;};context.scrollX=0;context.scrollY=740;context.scrollTo=(x,y)=>{context.scrollX=x;context.scrollY=y;};context.openIdeaConnection=()=>{saveDialog=deferred();return saveDialog.promise;};
 $('#idea-refinement').hidden=true;$('#idea-refine-result').hidden=true;$('#name').value='Madapp';$('#purpose').value='En madbestillingsapp';$('#startup-connection').value='mistral';$('#idea-route-row').hidden=true;
 vm.runInNewContext(source,context,{filename:'idea-refinement.js'});
 return{$,context,calls,send,events,timers,emit:event=>eventListener(event),setNow:value=>{now=value;},closeConnection:value=>saveDialog.resolve(value),addConnection:()=>connectionList.push({id:'new',name:'New saved provider',kind:'openai'}),async ready(){await $('#idea-refine-open').onclick();$('#idea-model').value='medium';},async prepare(){await $('#idea-refine-send').onclick();return calls.findLast(x=>x.name==='ideaPrepare').input.operationID;},sendNow(){return $('#idea-review-send').onclick();},async flush(){await new Promise(resolve=>setImmediate(resolve));}};
}
test('progress describes measured phases without provider queue, percentages or fabricated unknown durations',()=>{
 const value=presentation({phase:'waiting-provider',elapsedMs:50000,requestCount:1,timings:{responseHeadersMs:700}},{connection:'Mistral'});
 assert.match(value.title,/færdigt svar fra Mistral/);assert.equal(value.longWait,true);assert.equal(value.index,2);assert.equal(presentation({phase:'waiting-provider',requestCount:1,timings:{responseHeadersMs:null}}).index,1);assert.equal(value.measurements.find(x=>x[0]==='Til første response-bytes')[1],'Ikke målt');assert.doesNotMatch(JSON.stringify(value),/køplads|\d+\s*%/);
 assert.match(presentation({phase:'waiting-provider',formatRepair:true,requestCount:2}).title,/ekstra kald 1 af 1/);
 assert.equal(presentation({phase:'completed',elapsedMs:50000}).longWait,false);
 assert.match(presentation({phase:'format-repair',formatRepair:true,requestCount:1}).measurements.at(-1)[1],/ikke sendt/);
 assert.doesNotMatch(presentation({phase:'checking-connection',requestCount:1}).description,/Ingen modelopgave er sendt/);
});
test('status correlation rejects other requests and changed review tokens',()=>{
 const operation={id:'own',token:'bound'};
 assert.equal(matches({type:'idea.status',operationID:'own',token:'bound'},operation),true);
 for(const event of [{type:'idea.status',operationID:'old',token:'bound'},{type:'idea.status',operationID:'own',token:'old'},{type:'idea.local-processing',operationID:'own',token:'bound'}])assert.equal(matches(event,operation),false);
 assert.equal(matches({type:'idea.status',operationID:'own',token:null},{id:'own',token:null}),true);
 assert.equal(domain('https://user:SECRET@api.example.invalid/private-file?key=SECRET'),'api.example.invalid');assert.equal(domain('file:///private/secret'),'');
});
test('status events update the current reviewed operation, ignore stale sends and stop freezes the timer',async()=>{
 const f=fixture();await f.ready();const operationID=await f.prepare(),pending=f.sendNow();await f.flush();
 f.emit({type:'idea.status',operationID,token:'review-token',phase:'waiting-provider',elapsedMs:45000,requestCount:1,timings:{sendElapsedMs:45000,responseHeadersMs:700}});
 assert.match(f.$('#idea-refine-status').textContent,/færdigt svar/);assert.equal(f.$('#idea-progress-wait').hidden,false);assert.equal(f.$('#idea-progress-elapsed').textContent,'00:45');assert.doesNotMatch(f.$('#idea-progress-destination').textContent,/PRIVATE|\?/);
 const prior=f.$('#idea-refine-status').textContent;f.emit({type:'idea.status',operationID:'other',token:'review-token',phase:'completed'});assert.equal(f.$('#idea-refine-status').textContent,prior);
 await f.$('#idea-refine-stop').onclick();assert.equal(f.timers.size,0);assert.equal(f.$('#idea-progress-wait').hidden,true);assert.match(f.$('#idea-refine-status').textContent,/stoppet/);
 f.emit({type:'idea.status',operationID,token:'review-token',phase:'completed'});assert.match(f.$('#idea-refine-status').textContent,/stoppet/);
 f.send.resolve({description:'Late stale result',plan:'Plan',questions:[]});await pending;assert.notEqual(f.$('#idea-refine-description').value,'Late stale result');assert.equal(f.$('#purpose').value,'En madbestillingsapp');
 assert.equal(f.calls.filter(x=>x.name==='ideaSend').length,1);
});
test('stop freezes the accumulated wait time when no newer provider event has arrived',async()=>{
 const f=fixture();await f.ready();const operationID=await f.prepare(),pending=f.sendNow();await f.flush();
 f.emit({type:'idea.status',operationID,token:'review-token',phase:'waiting-provider',elapsedMs:1200,requestCount:1,timings:{sendElapsedMs:0,responseHeadersMs:null}});
 f.setNow(5250);for(const tick of f.timers.values())tick();assert.equal(f.$('#idea-progress-elapsed').textContent,'00:04');
 await f.$('#idea-refine-stop').onclick();assert.equal(f.$('#idea-progress-elapsed').textContent,'00:04');assert.equal(f.timers.size,0);
 f.setNow(15000);f.emit({type:'idea.status',operationID,token:'review-token',phase:'stopped',elapsedMs:0,timings:{sendElapsedMs:0}});assert.equal(f.$('#idea-progress-elapsed').textContent,'00:04');
 f.send.resolve({description:'Late result',plan:'Plan',questions:[]});await pending;assert.equal(f.$('#idea-progress-elapsed').textContent,'00:04');assert.equal(f.$('#purpose').value,'En madbestillingsapp');
});
test('adding or canceling a connection preserves draft, previous result, selected model/route and scroll',async()=>{
 for(const saved of [null,'new']){
  const f=fixture();await f.ready();f.$('#idea-refine-description').value='Edited result';f.$('#idea-refine-result').hidden=false;f.$('#idea-refine-answer').value='Follow-up draft';f.$('#idea-route').value='explicit-route';
  const adding=f.$('#idea-connection-add').onclick();f.context.scrollY=0;if(saved)f.addConnection();f.closeConnection(saved);await adding;
  assert.equal(f.$('#idea-connection').value,'mistral');assert.equal(f.$('#idea-model').value,'medium');assert.equal(f.$('#idea-route').value,'explicit-route');assert.equal(f.$('#idea-refine-description').value,'Edited result');assert.equal(f.$('#idea-refine-result').hidden,false);assert.equal(f.$('#idea-refine-answer').value,'Follow-up draft');assert.equal(f.$('#purpose').value,'En madbestillingsapp');assert.equal(f.context.scrollY,740);
  assert.equal(f.calls.filter(x=>x.name==='ideaSend'||x.name==='credentialEntry').length,0);
  if(saved)assert.ok(f.$('#idea-connection').options.some(x=>x.value==='new'));
 }
});
test('connection result from an old page cannot replace or refocus a new project',async()=>{
 const f=fixture();await f.ready();const adding=f.$('#idea-connection-add').onclick();f.events['aura:project']();f.context.current={root:'/new/project'};f.context.scrollY=12;f.addConnection();f.closeConnection('new');await adding;
 assert.equal(f.context.scrollY,12);assert.equal(f.$('#idea-refinement').hidden,true);assert.equal(f.$('#idea-connection').value,'mistral');
});
test('a running idea cannot open the connection form or change its selected recipient',async()=>{
 const f=fixture();await f.ready();await f.prepare();const pending=f.sendNow();await f.flush();assert.equal(f.$('#idea-connection-add').disabled,true);await f.$('#idea-connection-add').onclick();
 assert.equal(f.calls.filter(x=>x.name==='ideaSend').length,1);assert.equal(f.$('#idea-connection').value,'mistral');
 await f.$('#idea-refine-stop').onclick();f.send.resolve({description:'Done',plan:'Plan',questions:[]});await pending;
});
test('successful IPC response supplies terminal progress before delayed status events',async()=>{
 const f=fixture();await f.ready();const operationID=await f.prepare(),pending=f.sendNow();await f.flush();
 const receiving={type:'idea.status',operationID,token:'review-token',phase:'receiving',elapsedMs:4000,requestCount:1,formatRepair:false,timings:{sendElapsedMs:3000,responseHeadersMs:1800,firstByteMs:1900,responseReadMs:null}};
 f.emit(receiving);assert.match(f.$('#idea-progress-description').textContent,/afventer hele svaret/);
 f.send.resolve({description:'The completed idea',plan:'Plan',questions:[],progress:{...receiving,phase:'completed',elapsedMs:5500,timings:{...receiving.timings,sendElapsedMs:4500,responseReadMs:1200}}});await pending;
 assert.match(f.$('#idea-progress-description').textContent,/Du kan læse og ændre/);assert.equal(f.$('#idea-refine-description').value,'The completed idea');assert.equal(f.$('#idea-progress-elapsed').textContent,'00:04');assert.equal(f.timers.size,0);
 assert.ok(f.$('#idea-progress-stages').children.every(step=>step.classes.has('is-done')&&!step.classes.has('is-current')));
 const measurements=f.$('#idea-progress-measurements').children,readIndex=measurements.findIndex(x=>x.textContent==='Modtagelse af svaret');assert.equal(measurements[readIndex+1].textContent,'1,2 sek.');
 const description=f.$('#idea-progress-description').textContent;f.emit(receiving);f.emit({...receiving,phase:'completed',timings:{responseReadMs:999000}});assert.equal(f.$('#idea-progress-description').textContent,description);assert.equal(f.$('#idea-progress-measurements').children[readIndex+1].textContent,'1,2 sek.');
});
test('older or mismatched response metadata completes visually without inventing or importing measurements',async()=>{
 for(const metadata of ['absent','other-operation','other-token','nonterminal']){
  const f=fixture();await f.ready();const operationID=await f.prepare(),pending=f.sendNow();await f.flush();
  const receiving={type:'idea.status',operationID,token:'review-token',phase:'receiving',elapsedMs:4000,requestCount:1,timings:{sendElapsedMs:3000,responseHeadersMs:1800,responseReadMs:null}};f.emit(receiving);
  const progress={...receiving,phase:'completed',requestCount:99,timings:{responseReadMs:999000}};
  if(metadata==='other-operation')progress.operationID='foreign';if(metadata==='other-token')progress.token='foreign';if(metadata==='nonterminal')progress.phase='receiving';
  f.send.resolve({description:'Done',plan:'Plan',questions:[],...(metadata==='absent'?{}:{progress})});await pending;
  assert.match(f.$('#idea-progress-description').textContent,/Du kan læse og ændre/);assert.ok(f.$('#idea-progress-stages').children.every(step=>step.classes.has('is-done')));assert.equal(f.timers.size,0);
  const fields=f.$('#idea-progress-measurements').children,at=label=>fields[fields.findIndex(x=>x.textContent===label)+1].textContent;
  assert.equal(at('Modtagelse af svaret'),'Ikke målt');assert.equal(at('Fysiske modelkald'),'1');assert.equal(at('Til HTTP-svar'),'1,8 sek.');
 }
});
test('canceling review clears the old phase and its details without sending a model request',async()=>{
 const f=fixture();await f.ready();const preparing=f.prepare(),operationID=f.calls.findLast(x=>x.name==='ideaPrepare').input.operationID;
 f.emit({type:'idea.status',operationID,token:'review-token',phase:'awaiting-review',elapsedMs:1200,requestCount:0,timings:{preparationMs:1200}});await preparing;assert.equal(f.$('#idea-progress-details').hidden,false);assert.match(f.$('#idea-refine-status').textContent,/Klar til din gennemgang/);
 f.$('#idea-review-cancel').onclick();
 assert.match(f.$('#idea-refine-status').textContent,/Din idé er bevaret/);for(const id of ['#idea-progress-elapsed','#idea-progress-description','#idea-progress-destination','#idea-progress-stages','#idea-progress-details','#idea-progress-wait'])assert.equal(f.$(id).hidden,true,id);
 assert.equal(f.timers.size,0);assert.equal(f.calls.filter(x=>x.name==='ideaSend').length,0);assert.equal(f.$('#purpose').value,'En madbestillingsapp');
});
