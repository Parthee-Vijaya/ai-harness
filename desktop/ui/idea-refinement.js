// Pre-project text assistance. Status is measured transport work, never model reasoning.
(function (root) {
  'use strict';
  const phaseIndex = { preparing:0, 'checking-connection':0, 'awaiting-review':0, 'checking-data':0, 'waiting-provider':2, receiving:3, validating:4, 'format-repair':4, completed:5, error:-1, stopped:-1 };
  const time = value => Number.isFinite(value) && value >= 0 ? `${(value / 1000).toLocaleString('da-DK', { maximumFractionDigits:1 })} sek.` : 'Ikke målt';
  const domain = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.hostname : ''; } catch { return ''; } };
  function presentation(event, recipient = {}) {
    const phase = Object.hasOwn(phaseIndex, event?.phase) ? event.phase : 'preparing';
    const provider = recipient.connection || 'din valgte udbyder';
    const content = {
      preparing:['Kontrollerer din idé lokalt', 'Aura klargør din beskrivelse og de gældende regler. Ingen modelopgave er sendt.'],
      'checking-connection':['Kontrollerer den valgte forbindelse', 'Aura kontrollerer modelkataloget og vilkårene. Denne kontrol sender ingen ny modelopgave.'],
      'awaiting-review':['Klar til din gennemgang', 'Kontrollér modtageren og det konkrete indhold, før idéen sendes.'],
      'checking-data':['Kontrollerer indhold og datatilladelser', 'Aura genkontrollerer det godkendte indhold, modtageren og datareglerne.'],
      'waiting-provider':[`Venter på færdigt svar fra ${provider}`, 'Idéhjælpen afventer et færdigt svar. Modellen sender ikke teksten løbende i dette forløb.'],
      receiving:['Modtager svaret', 'Aura har modtaget response-bytes og afventer hele svaret, før det kan behandles.'],
      validating:['Kontrollerer og klargør beskrivelsen', 'Svaret er modtaget. Aura kontrollerer formatet og samler beskrivelsen lokalt.'],
      'format-repair':['Forbereder formattilpasning · højst ét ekstra kald', 'Det første svar kunne ikke læses i det forventede format. Aura genkontrollerer modtager og dataregler, før samme valgte AI eventuelt bliver bedt om at tilpasse formatet.'],
      completed:['Din beskrivelse er klar', 'Du kan læse og ændre forslaget. Plan- og værktøjsgodkendelser kommer som separate trin.'],
      stopped:['Idéhjælpen er stoppet', 'Din tekst er bevaret. Aura har ikke sendt en ny opgave.'],
      error:['Idéhjælpen kunne ikke afsluttes', 'Din tekst er bevaret. Se beskeden nedenfor, før du vælger næste skridt.']
    };
    const timings = event?.timings || {}, elapsed = Number.isFinite(timings.sendElapsedMs) ? timings.sendElapsedMs : event?.elapsedMs || 0;
    const awaitingHeaders=phase==='waiting-provider'&&!Number.isFinite(timings.responseHeadersMs);
    if(awaitingHeaders)content[phase]=[`Kontakter ${provider}`, 'Kaldet er startet. Aura har endnu ikke modtaget udbyderens første svar. Ventetiden kan skyldes forbindelsen eller selve behandlingen.'];
    if(event?.formatRepair && event.requestCount>=2 && phase==='waiting-provider'){content[phase]=['AI tilpasser svarformatet · ekstra kald 1 af 1', 'Aura afventer det færdige svar på formattilpasningen fra den samme valgte AI.'];}
    return { phase, index:awaitingHeaders?1:phaseIndex[phase], title:content[phase][0], description:content[phase][1], elapsedMs:elapsed,
      longWait:phase === 'waiting-provider' && elapsed >= 45000,
      measurements:[['Klargøring før gennemgang', time(timings.preparationMs)], ['Kontrol af forbindelse', time(timings.connectionCheckMs)], ['Til HTTP-svar', time(timings.responseHeadersMs)], ['Til første response-bytes', time(timings.firstByteMs)], ['Modtagelse af svaret', time(timings.responseReadMs)], ['Fysiske modelkald', String(Number.isInteger(event?.requestCount) && event.requestCount >= 0 ? event.requestCount : 0)], ['Formattilpasning', event?.formatRepair ? event.requestCount>=2 ? '1 ekstra kald · højst 1' : 'Forberedes · ikke sendt' : 'Ingen']]
    };
  }
  function matches(event, operation) {
    return Boolean(operation && event?.type === 'idea.status' && event.operationID === operation.id && (!operation.token || event.token === operation.token));
  }
  function completedProgress(progress, operation, previous) {
    // IPC may finish before the final event arrives. Only the bound terminal
    // snapshot may supply measurements; older backends still finish visually.
    return matches(progress, operation) && progress.phase === 'completed' ? progress : { ...previous, phase:'completed' };
  }
  const api = { presentation, matches, completedProgress, domain };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IdeaRefinementStatus = api;
})(globalThis);

if (typeof document !== 'undefined') (() => {
  const panel = $('#idea-refinement'), status = $('#idea-refine-status');
  const connection = $('#idea-connection'), model = $('#idea-model'), route = $('#idea-route');
  let busy = false, generation = 0, answer = null, accepted = null, review = null, operation = null, ticker = null, lastStatus = null, recipient = {};
  const progress = $('#idea-progress');
  const dialog = node('dialog'); dialog.id = 'idea-review-dialog'; dialog.setAttribute('aria-labelledby','idea-review-title');
  dialog.innerHTML = '<h2 id="idea-review-title">Gennemgå din AI-forbindelse</h2><p>Kun idéhjælp. Ingen projektfiler eller værktøjer åbnes.</p><dl id="idea-review-details"></dl><details><summary>Se præcis teksten, der sendes</summary><pre id="idea-review-content"></pre></details><div class="dialog-actions"><button type="button" id="idea-review-cancel">Annuller</button><button type="button" id="idea-review-send" class="primary">Send til idéhjælp</button></div>';
  document.body.append(dialog);
  const detailIDs=['#idea-progress-elapsed','#idea-progress-description','#idea-progress-destination','#idea-progress-stages','#idea-progress-details'];
  const text = value => { status.textContent = value || ''; if(progress)progress.hidden = !value; if(!lastStatus){for(const id of detailIDs){const el=$(id);if(el)el.hidden=true;}if($('#idea-progress-wait'))$('#idea-progress-wait').hidden=true;} };
  function refreshDifference() {
    const different = $('#idea-connection-difference'); if(!different)return;
    const project = state?.connections.find(c=>c.id===$('#startup-connection').value), chosen = state?.connections.find(c=>c.id===connection.value);
    different.hidden = !chosen || chosen.id===project?.id;
    different.textContent = chosen ? `Idéhjælpen bruger ${chosen.name}. ${project ? `Det kommende projekt bruger ${project.name}.` : 'Forbindelsen til det kommende projekt er ikke valgt.'} De er valgt hver for sig.` : '';
  }
  function readRecipient(disclosure) {
    const selected = state?.connections.find(c=>c.id===connection.value);
    return { connection:disclosure?.connection || selected?.name || 'din valgte udbyder', model:disclosure?.model || model.selectedOptions?.[0]?.textContent || model.value,
      domain:window.IdeaRefinementStatus.domain(disclosure?.endpoint || selected?.baseURL), route:!$('#idea-route-row').hidden ? route.selectedOptions?.[0]?.textContent || route.value : '' };
  }
  function elapsedStatus(event, liveElapsed = false) {
    const elapsed = liveElapsed && busy && lastStatus ? Math.max(0,performance.now()-lastStatus.observedAt) : 0;
    const copy = { ...event, elapsedMs:(event.elapsedMs||0)+elapsed, timings:{...event.timings} };
    if(Number.isFinite(copy.timings.sendElapsedMs))copy.timings.sendElapsedMs += elapsed;
    return copy;
  }
  function renderStatus(event, liveElapsed = false) {
    if(!progress)return;
    const value = window.IdeaRefinementStatus.presentation(elapsedStatus(event,liveElapsed),recipient);
    progress.hidden=false;for(const id of detailIDs)$(id).hidden=false;if(status.textContent!==value.title)status.textContent=value.title;status.classList.toggle('is-thinking',busy);
    $('#idea-progress-description').textContent=value.description;
    $('#idea-progress-destination').textContent=[recipient.connection,recipient.model,recipient.domain,recipient.route && `Via ${recipient.route}`].filter(Boolean).join(' · ');
    const seconds=Math.floor(value.elapsedMs/1000);$('#idea-progress-elapsed').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    const steps=$('#idea-progress-stages');steps.replaceChildren();
    for(const [index,label]of ['Kontrollér','Forbind','Afvent svar','Modtag','Klargør'].entries()){const item=node('li');item.append(node('span',String(index+1)),node('span',label));item.classList.toggle('is-done',index<value.index);item.classList.toggle('is-current',index===value.index);if(index===value.index)item.setAttribute('aria-current','step');steps.append(item);}
    const list=$('#idea-progress-measurements');list.replaceChildren();for(const [label,result]of value.measurements)list.append(node('dt',label),node('dd',result));
    const waiting=$('#idea-progress-wait');waiting.hidden=!value.longWait;waiting.textContent=`Vi venter stadig på det færdige svar. Årsagen hos udbyderen er ikke kendt. ${event.requestCount>1 ? 'Se de registrerede kald under detaljer.' : 'Aura har ikke sendt opgaven igen.'} Du kan stoppe og bevare din kladde.`;
  }
  function observe(event) { lastStatus={event,observedAt:performance.now()};renderStatus(event); }
  function clearTimer() { clearInterval(ticker);ticker=null; }
  function working(value, message) {
    busy=value;panel.setAttribute('aria-busy',String(value));if(message!==undefined)text(message);status.classList.toggle('is-thinking',value);
    for(const el of panel.querySelectorAll('select,textarea,button'))el.disabled=value;
    $('#idea-refine-stop').hidden=!value;$('#idea-refine-stop').disabled=false;
    $('#idea-refine-open').disabled=value;syncCreateAvailability();clearTimer();
    if(value)ticker=setInterval(()=>{if(lastStatus)renderStatus(lastStatus.event,true);},1000);
  }
  window.harness.onEvent(event=>{
    if(!busy||current||!window.IdeaRefinementStatus.matches(event,operation))return;
    if(event.connectionID&&event.connectionID!==connection.value){const chosen=state?.connections.find(c=>c.id===event.connectionID);recipient={connection:chosen?.name||'Lokal model',model:event.modelID||'',domain:window.IdeaRefinementStatus.domain(chosen?.baseURL),route:''};}
    observe(event);
  });
  const input = () => ({name:$('#name').value,idea:$('#purpose').value,message:$('#idea-refine-answer').value,connectionID:connection.value,modelID:model.value,routeID:route.value});
  async function loadModelsForIdea(){
    const ticket=++generation,id=connection.value;accepted=null;review=null;operation=null;lastStatus=null;refreshDifference();
    model.replaceChildren(option('',id?'Henter modeller …':'Vælg en forbindelse'));route.replaceChildren();$('#idea-route-row').hidden=true;text(id?'Henter modeller fra den valgte forbindelse …':'Vælg en forbindelse til idéhjælpen.');
    if(!id)return;
    const models=await call('models',id,null);if(ticket!==generation||connection.value!==id||current)return;
    model.replaceChildren(option('','Vælg model'),...models.map(m=>option(m.id,m.name||m.id)));text(models.length?'Vælg den model, du vil bruge.':'Forbindelsen har ingen tilgængelige modeller.');
  }
  connection.onchange=()=>action(loadModelsForIdea);
  model.onchange=()=>action(async()=>{
    const ticket=++generation,id=connection.value,modelID=model.value;accepted=null;review=null;operation=null;lastStatus=null;
    const isRouter=state?.connections.find(c=>c.id===id)?.kind==='openrouter';$('#idea-route-row').hidden=!isRouter;text(isRouter?'Vælg en konkret udbyder til modellen.':'Klar til at forfine din idé. Du gennemgår modtageren før afsendelse.');
    route.replaceChildren(option('','Vælg konkret udbyder'));if(!isRouter||!modelID)return;
    const routes=await call('routes',{connectionID:id,modelID},null);if(ticket!==generation||current)return;
    for(const item of routes)route.append(option(item.id,item.name||item.id));
  });
  route.onchange=()=>{accepted=null;review=null;operation=null;lastStatus=null;text('Klar til at forfine din idé. Du gennemgår modtageren før afsendelse.');};
  $('#startup-connection').addEventListener('change',refreshDifference);
  if($('#idea-connection-add'))$('#idea-connection-add').onclick=()=>action(async()=>{
    if(busy||current||review)return;
    const ticket=generation,selected=connection.value,scroll={x:window.scrollX,y:window.scrollY};
    const saved=await window.openIdeaConnection?.();
    if(ticket!==generation||current)return;
    connection.replaceChildren(option('','Vælg forbindelse'),...(state?.connections||[]).map(c=>option(c.id,c.name)));
    // Adding credentials never changes the reviewed recipient or clears a result.
    if(state?.connections.some(c=>c.id===selected))connection.value=selected;
    else connection.value='';
    refreshDifference();$('#idea-connection-add').focus({preventScroll:true});window.scrollTo(scroll.x,scroll.y);
    if(saved){let notice=$('#idea-connection-added');if(!notice){notice=node('p');notice.id='idea-connection-added';notice.className='hint';notice.setAttribute('role','status');$('#idea-connection-add').parentElement.append(notice);}notice.textContent='Forbindelsen er gemt. Vælg den i listen, hvis du vil bruge den.';window.scrollTo(scroll.x,scroll.y);}
  });
  $('#idea-refine-open').onclick=()=>action(async()=>{
    if(!$('#name').reportValidity()||!$('#purpose').reportValidity())return;
    if(!panel.hidden){connection.focus();return;}
    panel.hidden=false;
    const selected=$('#startup-connection').value;
    connection.replaceChildren(option('','Vælg forbindelse'),...(state?.connections||[]).map(c=>option(c.id,c.name)));
    if(selected)connection.value=selected;refreshDifference();
    if(!connection.options.length||connection.options.length===1){text('Tilføj en AI-forbindelse nedenfor. Din idé er gemt her.');return;}
    await loadModelsForIdea();connection.focus();
  });
  async function prepare(){
    if(busy||current)return;if(!$('#name').reportValidity()||!$('#purpose').reportValidity())return;
    if(!connection.value||!model.value||!$('#idea-route-row').hidden&&!route.value){text('Vælg forbindelse, model og eventuel udbyder først.');return;}
    const ticket=++generation;operation={id:crypto.randomUUID(),token:null,ticket};recipient=readRecipient();lastStatus=null;working(true);
    observe({phase:'preparing',elapsedMs:0,requestCount:0,timings:{}});
    try{
      const value=await call('ideaPrepare',{...input(),operationID:operation.id},null);if(ticket!==generation||current)return;operation.token=value.token;review={...value,ticket,operationID:operation.id};recipient=readRecipient(value.disclosure);
      const list=$('#idea-review-details');list.replaceChildren();
      for(const [key,label]of [['connection','Forbindelse'],['model','Model'],['recipients','Modtager'],['endpoint','Adresse'],['region','Behandlingssted'],['retention','Opbevaring'],['training','Træning'],['price','Pris'],['material','Indhold'],['security','Forbindelse']]){list.append(node('dt',label),node('dd',String(value.disclosure[key]||'Ikke oplyst')));}
      $('#idea-review-content').textContent='Instruktion til idéhjælpen:\n'+value.system+'\n\n'+value.content.map(m=>(m.role==='user'?'Du':'AI')+':\n'+m.content).join('\n\n');
      dialog.showModal();$('#idea-review-cancel').focus();
    }catch(error){text(error.message);}finally{if(ticket===generation)working(false,status.textContent);}
  }
  $('#idea-refine-send').onclick=prepare;$('#idea-refine-update').onclick=prepare;
  function cancelReview(){review=null;operation=null;lastStatus=null;clearTimer();void call('ideaStop',undefined,null).catch(()=>{});text('Intet blev sendt. Din idé er bevaret.');}
  $('#idea-review-cancel').onclick=()=>{dialog.close();cancelReview();};dialog.addEventListener('cancel',cancelReview);
  $('#idea-review-send').onclick=async()=>{
    const item=review;if(!item||item.ticket!==generation||current)return;review=null;dialog.close();working(true);observe({phase:'checking-data',elapsedMs:0,requestCount:0,timings:{sendElapsedMs:0}});
    try{
      const result=await call('ideaSend',{token:item.token,operationID:item.operationID},null);if(item.ticket!==generation||current)return;
      if(result.processing?.locality==='device'&&result.selection){connection.value=result.selection.connectionID;model.replaceChildren(option(result.selection.modelID,result.processing.model));model.value=result.selection.modelID;route.replaceChildren();$('#idea-route-row').hidden=true;refreshDifference();}
      observe(window.IdeaRefinementStatus.completedProgress(result.progress,operation,lastStatus?.event));
      answer={...result,selection:result.selection||{connectionID:connection.value,modelID:model.value,routeID:route.value}};accepted=null;
      $('#idea-refine-description').value=result.description;$('#idea-refine-plan').textContent=result.plan||'Bed AI’en om et planforslag, når de sidste valg er afklaret.';
      const questions=$('#idea-refine-questions');questions.replaceChildren();if(result.questions.length){questions.append(node('h3','Lad os afklare det sidste'));const list=node('ol');for(const q of result.questions)list.append(node('li',q));questions.append(list);}
      $('#idea-refine-answer').value='';$('#idea-refine-result').hidden=false;text(result.questions.length?'AI’en afventer dine svar. Du kan skrive frit nedenfor.':'Forslaget er klar. Ret teksten, eller brug beskrivelsen.');
      if(result.processing?.locality==='device')text('Lokal model '+result.processing.model+' · '+status.textContent);
      $('#idea-refine-send').hidden=true;
    }catch(error){if(item.ticket===generation){observe({...lastStatus?.event,phase:'error'});text(error.message);}}
    finally{if(item.ticket===generation){operation=null;working(false,status.textContent);}}
  };
  $('#idea-refine-stop').onclick=async()=>{const stopped={...elapsedStatus(lastStatus?.event||{},true),phase:'stopped'};++generation;operation=null;clearTimer();observe(stopped);await call('ideaStop',undefined,null).catch(()=>{});working(false,'Idéhjælpen er stoppet. Din tekst er bevaret.');};
  $('#idea-refine-use').onclick=()=>{
    if(!answer||busy||!$('#idea-refine-description').value.trim())return;
    const text=$('#idea-refine-description').value.trim();$('#purpose').value=text;$('#purpose').dispatchEvent(new Event('input',{bubbles:true}));
    accepted={name:$('#name').value,text,plan:answer.plan,selection:answer.selection};$('#startup-connection').value=answer.selection.connectionID;updateStartupSummary();
    panel.hidden=true;status.textContent='';message('Beskrivelsen er valgt. Opret projektet, og gennemgå planen i samtalen.');$('#create').focus();
  };
  const clear=()=>{++generation;operation=null;lastStatus=null;clearTimer();void call('ideaStop',undefined,null).catch(()=>{});if(dialog.open)dialog.close();review=null;answer=null;accepted=null;panel.hidden=true;$('#idea-refine-result').hidden=true;$('#idea-refine-send').hidden=false;working(false,'');};
  window.addEventListener('aura:project',clear);
  window.IdeaRefinement={take:()=>accepted&&accepted.name===$('#name').value&&accepted.text===$('#purpose').value?structuredClone(accepted):null};
})();
