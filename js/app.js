/* FITTRACK - app.js : navigation, vues, actions (étapes 2-3) */
(function(){'use strict';
const {calc,db}=FT,$=id=>document.getElementById(id),ISO=d=>d.toISOString().slice(0,10),today=()=>ISO(new Date());
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const val=id=>{const v=parseFloat($(id).value);return isFinite(v)?v:null},txt=id=>($(id).value||'').trim();
const CATS=['Petit-déjeuner','Déjeuner','Dîner','Collation'],CARDIO=['course','marche','velo','natation'];
const TYPES={muscu:'Musculation',course:'Course à pied',marche:'Marche',velo:'Vélo',natation:'Natation',mobilite:'Mobilité',autre:'Autre activité'};
let tab='dash',per='d',draft=[],nDate=today();const A=window.A={},V={};
const dayAgo=n=>ISO(new Date(Date.now()-n*864e5)),byDate=(a,b)=>b.date.localeCompare(a.date);
function pop(h){const p=$('pop');p.innerHTML=h;p.className='show';setTimeout(()=>{p.className=''},1800)}
function toast(m,up){const t=$('toast');t.textContent=m;t.className='show'+(up?' up':'');setTimeout(()=>{t.className=''},2600)}
const total=async()=>(await db.all('xpEvents')).reduce((t,e)=>t+e.xp,0);
async function reward(key,label,gain,date,free){const c=await xcfg(),b=calc.levelInfo(await total()).level;gain=Math.round(gain*c.mult);
  const day=(await db.byRange('xpEvents','date',date,date)).filter(e=>!/^(wk|m|md):/.test(e.eventKey)).reduce((t,e)=>t+e.xp,0),g=free?gain:calc.capXp(day,gain,c.cap);
  if(!(await db.addXpEvent({eventKey:key,date,label,xp:g})))return 0;const a=calc.levelInfo(await total()).level;
  toast('+'+g+' XP'+(a>b?' · NIVEAU '+a+' !':''),a>b);if(a>b)pop('NIVEAU '+a+'<br>🎉');return g}
async function foodMap(){const f=await db.all('foods');return{list:f.sort((a,b)=>a.name.localeCompare(b.name)),map:Object.fromEntries(f.map(x=>[x.id,x]))}}
const dayNut=(ms,fm)=>calc.dayNutrition(ms.filter(m=>fm[m.foodId]).map(m=>({food:fm[m.foodId],grams:m.grams})));
const K=(k,v,s)=>`<div><div class=k>${k}</div><div class=v>${v}<small> ${s||''}</small></div></div>`;
/* ---------- XP : historique, attribution, bonus hebdo ---------- */
const XPC={cap:250,mult:1,weekly:3,meal:8,mealAll:20},xcfg=async()=>Object.assign({},XPC,await db.getSetting('xpv2',{})),nz=v=>v==null||v===''?'—':v;
function buildHist(ws){const h={best:{},last:{},cardio:{}};
  ws.slice().sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))).forEach(w=>{
    if(w.exercises)w.exercises.forEach(e=>{h.last[e.name]=calc.exerciseVolume(e);e.sets.forEach(s=>{const r=calc.oneRM(s.weight,s.reps);if(r)h.best[e.name]=Math.max(h.best[e.name]||0,r)})});
    else if(CARDIO.includes(w.type)){const c=h.cardio[w.type]=h.cardio[w.type]||{dist:0,speed:0},k=calc.cardioStats(w);if(w.distanceKm>c.dist)c.dist=w.distanceKm;if(w.distanceKm>=3&&k.speedKmh>c.speed)c.speed=k.speedKmh}});
  return h}
const xpOf=(w,h)=>w.exercises?calc.xpMuscu(w,h):CARDIO.includes(w.type)?calc.xpCardio(w,h.cardio[w.type]):calc.xpOther(w);
const wkOf=d=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return ISO(x)};
async function weeklyCheck(date){const c=await xcfg(),cnt={};(await db.all('workouts')).forEach(w=>{const k=wkOf(w.date);cnt[k]=(cnt[k]||0)+1});
  const k=wkOf(date);if(!(c.weekly>0)||(cnt[k]||0)<c.weekly)return;let st=0,d=new Date(k+'T12:00:00');
  for(;;){d=new Date(d.getTime()-7*864e5);if((cnt[ISO(d)]||0)>=c.weekly)st++;else break}
  await reward('wk:'+k,'Objectif hebdo atteint',calc.xpWeekly(st),date,true)}
async function awardW(w,id,label){const h=buildHist((await db.all('workouts')).filter(x=>x.id!==id)),r=xpOf(w,h),g=await reward('w:'+id,label,r.total,w.date);
  await db.put('workouts',{...w,id,xp:g});await weeklyCheck(w.date);return{parts:r.parts,gain:g,raw:r.total}}
/* ---------- GROUPES MUSCULAIRES ---------- */
const GROUPS=['Pectoraux','Jambes','Dos','Épaules','Bras','Abdominaux'];let libC=[];
const grp=m=>{m=String(m||'').toLowerCase();for(const t of [['Pectoraux',/pec|poitr|chest/],['Jambes',/jamb|quad|ischio|mollet|fess|cuisse|leg/],['Dos',/dos|dorsa|trap|lomb|back/],['Épaules',/[eé]paul|delto|shoulder/],['Bras',/bras|bicep|tricep|avant/],['Abdominaux',/abdo|abs|gain/]])if(t[1].test(m))return t[0];return'Autre'};
A.exPick=v=>{const l=libC.find(x=>x.name===v);if(l&&grp(l.muscle)!=='Autre')$('exMus').value=grp(l.muscle)};
A.mvEx=(i,d)=>{const j=i+d;if(j<0||j>=draft.length)return;[draft[i],draft[j]]=[draft[j],draft[i]];draw()};
/* ---------- DASHBOARD ---------- */
const ring=(p,big,sub,c)=>`<div class=ring><svg viewBox="0 0 120 120"><circle cx=60 cy=60 r=52 class=rb /><circle cx=60 cy=60 r=52 class=rf style="stroke:${c};stroke-dasharray:${Math.round(3.267*Math.max(0,Math.min(100,p)))} 327"/></svg><div class=rt><b>${big}</b><small>${sub}</small></div></div>`;
const mac=(l,v,g,c)=>`<div class=mac><span>${l}</span><b>${Math.round(v)}${g?' / '+Math.round(g):''} g</b></div><div class=bar><div style="width:${g?Math.min(100,v/g*100):0}%;background:${c}"></div></div>`;
function streak(ds){const S=new Set(ds);let n=0,d=new Date();if(!S.has(ISO(d)))d=new Date(d-864e5);while(S.has(ISO(d))){n++;d=new Date(d-864e5)}return n}
V.dash=async()=>{const days=per==='d'?1:per==='w'?7:30,from=dayAgo(days-1),to=today();
  const aw=await db.all('workouts'),al=await db.all('mealLog');
  const[ws,ml,bw,tp]=await Promise.all([db.byRange('workouts','date',from,to),db.byRange('mealLog','date',from,to),db.all('weights'),db.getSetting('tpls',[])]);
  let vol=0,dur=0;ws.forEach(w=>{dur+=w.durationMin||0;if(w.exercises)vol+=calc.sessionStats(w).volume});
  const okN=ml.filter(m=>m.ok===true).length,tot=days*4,st=streak([...aw.map(w=>w.date),...al.filter(m=>m.ok===true).map(m=>m.date)]),lw=bw.filter(b=>b.weight!=null).sort(byDate)[0],li=calc.levelInfo(await total()),ti=tp.findIndex(x=>x.day===new Date().getDay());
  return`<div class=seg>${[['d','Jour'],['w','Semaine'],['m','Mois']].map(x=>`<button class="${per===x[0]?'on':''}" data-click=per data-args="'${x[0]}'">${x[1]}</button>`).join('')}</div>
  <div class=quick>${ti>=0?`<button class="qt hot" data-click=launch data-args="${ti}"><span>▶</span>${esc(tp[ti].name)}</button>`:`<button class=qt data-click=go data-args="'sport'"><span>🏋</span>Séance</button>`}<button class=qt data-click=go data-args="'nutri'"><span>✅</span>Repas</button><button class=qt data-click=go data-args="'prog'"><span>⚖</span>Poids</button></div>
  <section class="card hero"><div class=rings>${ring(Math.round(okN/tot*100),okN+'/'+tot,'repas respectés','var(--gn)')}${ring(li.percent,'Niv. '+li.level,li.xp+' XP','var(--or)')}</div><div class=chips><span>🔥 ${st} j de suite</span><span>🏋 ${ws.length} séance${ws.length>1?'s':''}</span><span>⏱ ${dur} min</span></div></section>
  <section class=card><div class=grid>${K('Poids',lw?lw.weight:'—','kg')}${K('Volume muscu',Math.round(vol),'kg')}</div></section>`};
A.per=async p=>{per=p;await render()};
/* ---------- SPORT ---------- */
let dlgRes=null;const ask=m=>new Promise(r=>{dlgRes=r;$('dlgMsg').textContent=m;$('dlg').hidden=false});
A.dlg=v=>{$('dlg').hidden=true;if(dlgRes){const r=dlgRes;dlgRes=null;r(v===1)}};
const DAYS=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
let run=null,runLoaded=false,runH={},sum=null,timer=null,ctx=null;
const mmss=s=>{s=Math.abs(Math.round(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},saveRun=()=>db.setSetting('run',run);
const mkEx=e=>({name:e.name,muscle:e.muscle,rest:parseFloat(e.rest)||null,sets:e.sets.map(s=>({weight:parseFloat(s.weight)||0,reps:parseFloat(s.reps)||0}))});
async function libAdd(ex){const lib=await db.all('exerciseLib');for(const e of ex)if(!lib.some(l=>l.name===e.name))await db.add('exerciseLib',{name:e.name,muscle:e.muscle,kind:'Musculation'})}
const muscuStats=(st,dur)=>[['Durée',dur,'min'],['Volume',Math.round(st.volume),'kg'],['Séries',st.sets],['Répétitions',st.reps],['Charge max',st.maxLoad,'kg']];
const sumHtml=()=>sum?`<section class="card hero"><h2>Terminé ✔</h2><div class=grid>${sum.stats.map(x=>K(x[0],x[1],x[2])).join('')}</div><div class=xpbig>+${sum.xp} XP</div>${sum.parts.map(p=>`<div class=li><span>${esc(p[0])}</span><b>+${p[1]}</b></div>`).join('')}${sum.xp<sum.raw?'<small>Plafond quotidien atteint.</small>':''}<button class=main data-click=closeSum>Super !</button></section>`:'';
V.sport=async()=>{if(!runLoaded){run=await db.getSetting('run',null);runLoaded=true}
  if(run){runH=buildHist(await db.all('workouts'));return runView()}
  const lib=libC=await db.all('exerciseLib'),ws=(await db.all('workouts')).sort(byDate).slice(0,15),tp=await db.getSetting('tpls',[]);
  return`${sumHtml()}${tplHtml(tp)}
  <details class=card id=dC><summary><span>🏃</span>Cardio / autre activité</summary>
  <div class=row><input id=cDate type=date value="${today()}"><select id=cType>${['course','marche','velo','natation','mobilite','autre'].map(k=>`<option value=${k}>${TYPES[k]}</option>`).join('')}</select></div>
  <div class=row><input id=cDur type=number inputmode=numeric placeholder="Durée (min)"><input id=cDist type=number inputmode=decimal placeholder="Distance (km)"></div>
  <div class=row><input id=cCal type=number placeholder="Calories (si connues)"><input id=cHr type=number placeholder="FC moy. (option)"></div>
  <input id=cCom placeholder="Commentaire (facultatif)"><button class=main data-click=saveCardio>Enregistrer</button></details>
  <details class=card id=formD><summary><span>🏋</span>Créer une séance de muscu</summary>
  <datalist id=exLib>${lib.map(e=>`<option value="${esc(e.name)}">`).join('')}</datalist><div class=row><input id=exName list=exLib placeholder="Exercice" data-input=exPick data-args="this.value"><select id=exMus>${GROUPS.map(g=>`<option>${g}</option>`).join('')}</select></div><button class=sm data-click=addEx>+ Exercice</button><div id=draft></div>
  <h3>Enregistrer comme séance type</h3><div class=row><input id=tName placeholder="Nom de la séance"><select id=tDay><option value="">Jour…</option>${DAYS.map((d,i)=>`<option value=${i}>${d}</option>`).join('')}</select></div>
  <input id=tRest type=number inputmode=numeric placeholder="Repos par défaut entre exercices (s)"><button class=sm data-click=saveTpl>💾 Ajouter à ma semaine</button>
  <h3>…ou séance déjà faite</h3><div class=row><input id=xDate type=date value="${today()}"><input id=xDur type=number inputmode=numeric placeholder="Durée (min)"></div><input id=xCom placeholder="Commentaire (facultatif)"><button class=main data-click=saveMuscu>✔ Enregistrer cette séance</button></details>
  <section class=card><h2>Historique</h2>${ws.map(w=>{const c=CARDIO.includes(w.type)?calc.cardioStats(w):null,s=w.exercises?calc.sessionStats(w):null;
  return`<div class=li><span>${w.date} · ${TYPES[w.type]} · ${w.durationMin} min${s?` · ${Math.round(s.volume)} kg`:''}${c&&c.speedKmh?` · ${c.speedKmh} km/h`:''}${w.xp?` · <b style="color:var(--or)">+${w.xp} XP</b>`:''}</span><button class=sm data-click=delW data-args="${w.id}">✕</button></div>`}).join('')||'<small>Aucune séance.</small>'}</section>`};
function draw(){const d=$('draft');if(!d)return;d.innerHTML=draft.map((e,i)=>`<div class=ex><div class=row><b>${esc(e.name)} <small>${esc(grp(e.muscle))}</small></b><button class=sm data-click=mvEx data-args="${i},-1">↑</button><button class=sm data-click=mvEx data-args="${i},1">↓</button><button class=sm data-click=delEx data-args="${i}">✕</button></div><input type=number inputmode=numeric placeholder="Repos après cet exercice (s)" value="${esc(e.rest)}" data-input=setRest data-args="${i},this.value">`+
  e.sets.map((s,j)=>`<div class=row><input type=number inputmode=decimal placeholder=kg value="${esc(s.weight)}" data-input=setV data-args="${i},${j},'weight',this.value"><input type=number inputmode=numeric placeholder=reps value="${esc(s.reps)}" data-input=setV data-args="${i},${j},'reps',this.value"><button class=sm data-click=delSet data-args="${i},${j}">−</button></div>`).join('')+
  `<button class=sm data-click=addSet data-args="${i}">+ série</button> <small>${calc.exerciseVolume(e)} kg</small></div>`).join('')}
A.addEx=()=>{const n=txt('exName');if(!n)return toast('Nom d’exercice requis');draft.push({name:n,muscle:$('exMus').value||GROUPS[0],rest:'',sets:[{weight:'',reps:''}]});$('exName').value='';draw()};
A.addSet=i=>{const l=draft[i].sets.slice(-1)[0]||{weight:'',reps:''};draft[i].sets.push({weight:l.weight,reps:l.reps});draw()};
A.delSet=(i,j)=>{draft[i].sets.splice(j,1);draw()};A.delEx=i=>{draft.splice(i,1);draw()};A.setV=(i,j,k,v)=>{draft[i].sets[j][k]=v};A.setRest=(i,v)=>{draft[i].rest=v};
const draftOk=()=>{const ex=draft.filter(e=>e.sets.length);if(!ex.length){toast('Ajoute un exercice avec une série');return null}
  if(ex.some(e=>e.sets.some(s=>!(parseFloat(s.reps)>0)))){toast('Répétitions manquantes');return null}return ex};
A.saveCardio=async()=>{const type=$('cType').value,date=txt('cDate'),dur=val('cDur');if(!date)return toast('Date requise');if(!(dur>0))return toast('Durée requise');
  const w={date,time:null,type,durationMin:dur,comment:txt('cCom')};if(CARDIO.includes(type)){w.distanceKm=val('cDist');w.calories=val('cCal');w.hr=val('cHr')}
  const id=await db.add('workouts',w),r=await awardW(w,id,TYPES[type]),k=calc.cardioStats(w);
  sum={stats:[['Durée',dur,'min'],['Distance',nz(w.distanceKm),'km'],['Vitesse',nz(k.speedKmh),'km/h'],['Allure',nz(k.paceMinKm),'/km']],xp:r.gain,raw:r.raw,parts:r.parts};await render()};
A.saveMuscu=async()=>{const date=txt('xDate'),dur=val('xDur');if(!date)return toast('Date requise');if(!(dur>0))return toast('Durée requise');const ex=draftOk();if(!ex)return;
  const w={date,time:null,type:'muscu',durationMin:dur,comment:txt('xCom'),exercises:ex.map(mkEx)};await libAdd(w.exercises);
  const id=await db.add('workouts',w),r=await awardW(w,id,'Musculation');draft=[];sum={stats:muscuStats(calc.sessionStats(w),dur),xp:r.gain,raw:r.raw,parts:r.parts};await render()};
A.delW=async id=>{if(await ask('Supprimer cette séance ? Ses XP seront retirées.')){await db.remove('workouts',id);await db.remove('xpEvents','w:'+id);await render()}};
A.closeSum=async()=>{sum=null;await render()};
/* ---------- SÉANCES TYPES + MODE SÉANCE (timers) ---------- */
function warm(){try{ctx=ctx||new(window.AudioContext||window.webkitAudioContext)();ctx.resume&&ctx.resume()}catch(e){}}
function beep(){try{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;g.gain.value=.2;o.start();o.stop(ctx.currentTime+.4)}catch(e){}try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}}
const tplHtml=tp=>{const t=new Date().getDay(),o=x=>x.day===''?9:(x.day+6)%7,ord=tp.map((x,i)=>({...x,i})).sort((a,b)=>o(a)-o(b));
  return`<section class=card><h2>Ma semaine</h2>${ord.map(x=>`<div class="tpl${x.day===t?' today':''}"><div><b>${esc(x.name)}</b><small>${x.day===''?'Libre':DAYS[x.day]}${x.day===t?' · aujourd’hui':''} · ${x.exercises.length} exo${x.exercises.length>1?'s':''}</small></div><div class=acts><button class=go data-click=launch data-args="${x.i}">▶ Go</button><button class=sm data-click=loadTpl data-args="${x.i}">✎</button><button class=sm data-click=delTpl data-args="${x.i}">✕</button></div></div>`).join('')||'<small>Crée ta première séance type avec « Créer une séance de muscu ».</small>'}</section>`};
function runW(){return{type:'muscu',date:run.date,exercises:run.exercises.map(e=>({name:e.name,muscle:e.muscle,rest:e.rest||null,sets:e.sets.filter(s=>s.done&&parseFloat(s.reps)>0).map(s=>({weight:parseFloat(s.weight)||0,reps:parseFloat(s.reps)}))})).filter(e=>e.sets.length)}}
function runView(){const all=run.exercises.reduce((t,e)=>t+e.sets.length,0),done=run.exercises.reduce((t,e)=>t+e.sets.filter(s=>s.done).length,0),est=calc.xpMuscu(runW(),runH).total;
  return`<section class="card hero"><h2>${esc(run.name)}</h2><div class=v id=runClock style="font-size:46px">00:00</div><div class=chips><span>✔ ${done}/${all} séries</span><span>⚡ ≈ +${est} XP</span></div><div class=bar style="margin-top:12px"><div style="width:${all?Math.round(done/all*100):0}%"></div></div></section>
  <section class="card rest" id=restBox ${run.restEnd?'':'hidden'}><small>RÉCUPÉRATION</small><div class=big id=restClock>00:00</div><div class=bar><div id=restBar style="width:100%"></div></div><div class=row><button class=sm data-click=restAdd data-args="15">+15 s</button><button class=sm data-click=restSkip>Passer</button></div></section>
  ${run.exercises.map((e,i)=>`<section class=card><div class=ex><b>${esc(e.name)}</b> <small>${esc(grp(e.muscle))} · repos ${e.rest||run.rest} s</small>${e.sets.map((s,j)=>`<div class=row><span class=sn>${j+1}</span><input type=number inputmode=decimal value="${esc(s.weight)}" placeholder=kg data-input=rv data-args="${i},${j},'weight',this.value"><input type=number inputmode=numeric value="${esc(s.reps)}" placeholder=reps data-input=rv data-args="${i},${j},'reps',this.value"><button class="chk${s.done?' on':''}" data-click=tick data-args="${i},${j}">${s.done?'✔':'○'}</button></div>`).join('')}<button class=sm data-click=rAdd data-args="${i}">+ série</button></div></section>`).join('')}
  <button class=main data-click=finish>🏁 Terminer la séance</button><button class=sm data-click=abort>Abandonner</button>`}
function loop(){if(!run){clearInterval(timer);timer=null;return}
  const c=$('runClock');if(c)c.textContent=mmss((Date.now()-run.startedAt)/1000);
  if(run.restEnd){const r=Math.ceil((run.restEnd-Date.now())/1000);
    if(r<=0){run.restEnd=null;saveRun();beep();toast('Repos terminé — série suivante !');const b=$('restBox');if(b)b.hidden=true}else{const rc=$('restClock');if(rc)rc.textContent=mmss(r);const rb=$('restBar');if(rb&&rb.style)rb.style.width=Math.max(0,r/(run.restTotal||r)*100)+'%'}}}
function startLoop(){if(!timer&&run)timer=setInterval(loop,1000);loop()}
A.saveTpl=async()=>{const name=txt('tName'),ex=draft.filter(e=>e.sets.length);if(!name)return toast('Nom de séance requis');if(!ex.length)return toast('Ajoute un exercice avec une série');
  const d=$('tDay').value,t={name,day:d===''?'':parseInt(d),rest:val('tRest')||90,exercises:ex.map(mkEx)};
  const tp=await db.getSetting('tpls',[]),k=tp.findIndex(x=>x.name===name);if(k>=0)tp[k]=t;else tp.push(t);await db.setSetting('tpls',tp);draft=[];toast('Séance ajoutée à ta semaine');await render()};
A.loadTpl=async i=>{const t=(await db.getSetting('tpls',[]))[i];if(!t)return;draft=t.exercises.map(e=>({name:e.name,muscle:e.muscle,rest:e.rest||'',sets:e.sets.map(s=>({weight:s.weight,reps:s.reps}))}));await render();$('formD').open=true;$('tName').value=t.name;$('tDay').value=t.day;$('tRest').value=t.rest};
A.delTpl=async i=>{if(!await ask('Supprimer cette séance type ?'))return;const tp=await db.getSetting('tpls',[]);tp.splice(i,1);await db.setSetting('tpls',tp);await render()};
A.launch=async i=>{const t=(await db.getSetting('tpls',[]))[i];if(!t)return;warm();tab='sport';
  run={name:t.name,date:today(),startedAt:Date.now(),rest:t.rest||90,restEnd:null,exercises:t.exercises.map(e=>({name:e.name,muscle:e.muscle,rest:e.rest||null,sets:e.sets.map(s=>({weight:s.weight,reps:s.reps,done:false}))}))};
  runLoaded=true;await saveRun();await render()};
A.rv=(i,j,k,v)=>{run.exercises[i].sets[j][k]=v;saveRun()};
A.rAdd=async i=>{const e=run.exercises[i],l=e.sets[e.sets.length-1]||{weight:'',reps:''};e.sets.push({weight:l.weight,reps:l.reps,done:false});await saveRun();await render()};
A.tick=async(i,j)=>{warm();const e=run.exercises[i],s=e.sets[j];s.done=!s.done;
  if(s.done&&run.exercises.some(x=>x.sets.some(t=>!t.done))){run.restTotal=e.rest||run.rest;run.restEnd=Date.now()+run.restTotal*1000}else{run.restEnd=null;if(s.done)toast('Toutes les séries sont faites — termine la séance')}
  await saveRun();await render()};
A.restAdd=n=>{if(run&&run.restEnd){run.restEnd+=n*1000;run.restTotal=(run.restTotal||0)+n;saveRun();loop()}};A.restSkip=()=>{run.restEnd=null;saveRun();$('restBox').hidden=true};
A.finish=async()=>{const w0=runW();if(!w0.exercises.length)return toast('Coche au moins une série réalisée');
  if(run.exercises.some(e=>e.sets.some(s=>!s.done))&&!await ask('Certaines séries ne sont pas cochées : elles ne seront pas comptées. Terminer ?'))return;
  const dur=Math.max(1,Math.round((Date.now()-run.startedAt)/60000)),w={...w0,time:new Date(run.startedAt).toTimeString().slice(0,5),durationMin:dur,comment:'Séance : '+run.name};
  await libAdd(w.exercises);const id=await db.add('workouts',w),r=await awardW(w,id,w.comment);
  sum={stats:muscuStats(calc.sessionStats(w),dur),xp:r.gain,raw:r.raw,parts:r.parts};run=null;await db.setSetting('run',null);await render()};
A.abort=async()=>{if(!await ask('Abandonner la séance en cours ? Rien ne sera enregistré.'))return;run=null;await db.setSetting('run',null);await render()};
/* ---------- NUTRITION : suivi par repas (respecté / écart) ---------- */
const ICO={'Petit-déjeuner':'☀️','Déjeuner':'🍝','Dîner':'🌙','Collation':'🍎'};
V.nutri=async()=>{const rows=await db.byRange('mealLog','date',nDate,nDate),st=c=>{const r=rows.find(x=>x.category===c);return r?r.ok:null},x=await xcfg(),okN=CATS.filter(c=>st(c)===true).length;
  const hist=await db.byRange('mealLog','date',dayAgo(13),today()),by={};hist.forEach(m=>{(by[m.date]=by[m.date]||{})[m.category]=m.ok});
  return`<section class="card hero"><div class=datebar><button class=sm data-click=shift data-args="-1">‹</button><input id=nDate type=date value="${nDate}" data-change=setDate data-args="this.value"><button class=sm data-click=shift data-args="1">›</button></div>
  <div class=v>${okN}<small> / 4 repas respectés</small></div><div class=bar><div style="width:${okN*25}%"></div></div>
  ${okN===4?`<div class=perfect>🎯 Journée parfaite · +${x.mealAll} XP</div>`:`<small>+${x.meal} XP par repas respecté, +${x.mealAll} XP si les 4 le sont.</small>`}</section>
  ${CATS.map(c=>{const s=st(c);return`<section class=card><div class=meal><span class=mi>${ICO[c]}</span><b>${c}</b>${s===true?`<span class=xpt>+${x.meal} XP</span>`:''}</div><div class=row><button class="mb ok${s===true?' on':''}" data-click=meal data-args="'${c}',1">✔ Respecté</button><button class="mb no${s===false?' on':''}" data-click=meal data-args="'${c}',0">✘ Écart</button></div></section>`}).join('')}
  <section class=card><h2>14 derniers jours</h2>${Object.keys(by).sort().reverse().map(d=>`<div class=li data-click=setDate data-args="'${d}'"><span>${d}</span><span>${CATS.map(c=>by[d][c]===true?'✅':by[d][c]===false?'❌':'▫️').join('')}</span></div>`).join('')||'<small>Aucun suivi pour l’instant.</small>'}</section>
  <details class=card><summary><span>⬇</span>Exporter le suivi</summary><div class=row><input id=eFrom type=date><input id=eTo type=date></div><small>Période facultative (vide = tout l’historique).</small>
  <button class=main data-click=expXls>Excel (.xlsx)</button><button class=main data-click=expTxt>Texte (.txt)</button></details>`};
A.setDate=async d=>{if(d){nDate=d;await render()}};
A.shift=async n=>{nDate=ISO(new Date(new Date(nDate+'T12:00:00').getTime()+n*864e5));await render()};
async function mealBonus(){const rows=await db.byRange('mealLog','date',nDate,nDate);
  if(CATS.every(c=>rows.some(r=>r.category===c&&r.ok===true)))await reward('md:'+nDate,'Journée parfaite',(await xcfg()).mealAll,nDate,true);else await db.remove('xpEvents','md:'+nDate)}
// Tap = respecté / écart ; retaper le même bouton annule. L'XP suit : retirée si le repas n'est plus « respecté ».
A.meal=async(c,v)=>{const key=nDate+'|'+c,cur=await db.get('mealLog',key),was=cur?cur.ok:null,want=was===(v===1)?null:v===1;
  if(want===null)await db.remove('mealLog',key);else await db.put('mealLog',{key,date:nDate,category:c,ok:want});
  if(was===true&&want!==true)await db.remove('xpEvents','m:'+key);
  if(want===true)await reward('m:'+key,'Repas respecté : '+c,(await xcfg()).meal,nDate,true);
  await mealBonus();await render()};
/* ---------- EXPORT (xlsx sans bibliothèque, txt) ---------- */
function crc32(b){const t=crc32.t||(crc32.t=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0}));let r=-1;for(let i=0;i<b.length;i++)r=t[(r^b[i])&255]^(r>>>8);return(r^-1)>>>0}
function zip(files){const enc=new TextEncoder(),parts=[],cd=[];let off=0;
  files.forEach(([n,txt])=>{const nb=enc.encode(n),d=enc.encode(txt),crc=crc32(d),h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nb.length,true);parts.push(new Uint8Array(h.buffer),nb,d);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,off,true);cd.push(new Uint8Array(c.buffer),nb);off+=30+nb.length+d.length});
  const cs=cd.reduce((t,x)=>t+x.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cd,new Uint8Array(e.buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
function xlsx(sheets){const E=x=>String(x).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])),H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  cell=(v,r,c)=>{const ref=String.fromCharCode(65+c)+(r+1);return v===''||v==null?'':typeof v==='number'?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${E(v)}</t></is></c>`},
  sx=rows=>H+'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((r,i)=>`<row r="${i+1}">${r.map((v,c)=>cell(v,i,c)).join('')}</row>`).join('')+'</sheetData></worksheet>',
  R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',P='http://schemas.openxmlformats.org/package/2006/relationships';
  return zip([['[Content_Types].xml',H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>'],
    ['_rels/.rels',H+`<Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml',H+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><sheets>`+sheets.map((s,i)=>`<sheet name="${E(s[0])}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels',H+`<Relationships xmlns="${P}">`+sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="${R}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+'</Relationships>'],
    ...sheets.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sx(s[1])])])}
function save(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click()}
async function nutriRows(){const f=txt('eFrom'),t=txt('eTo'),ok=d=>(!f||d>=f)&&(!t||d<=t),by={};
  (await db.all('mealLog')).filter(m=>ok(m.date)).forEach(m=>{(by[m.date]=by[m.date]||{})[m.category]=m.ok});
  const rows=Object.keys(by).sort().map(d=>{const r=by[d],n=CATS.filter(c=>r[c]===true).length;return[d,...CATS.map(c=>r[c]===true?'Oui':r[c]===false?'Non':''),n,n===4?'Oui':'Non']});
  const xp=(await db.all('xpEvents')).filter(e=>ok(e.date)).sort((a,b)=>a.date.localeCompare(b.date)).map(e=>[e.date,e.label,e.xp]);return{rows,xp}}
const NH=['Date',...CATS,'Repas respectés','Journée parfaite'];
A.expXls=async()=>{const{rows,xp}=await nutriRows();if(!rows.length)return toast('Rien à exporter sur cette période');save(xlsx([['Suivi repas',[NH,...rows]],['Historique XP',[['Date','Événement','XP'],...xp]]]),'fittrack-nutrition-'+today()+'.xlsx')};
A.expTxt=async()=>{const{rows}=await nutriRows();if(!rows.length)return toast('Rien à exporter sur cette période');
  const ok=rows.reduce((t,r)=>t+r[5],0),s=['FITTRACK - Suivi des repas','Période : '+(txt('eFrom')||'début')+' → '+(txt('eTo')||'aujourd’hui'),'',NH.join('\t'),...rows.map(r=>r.join('\t')),'',`Total : ${rows.length} jours suivis, ${ok} repas respectés sur ${rows.length*4}`];
  save(new Blob([s.join('\r\n')],{type:'text/plain;charset=utf-8'}),'fittrack-nutrition-'+today()+'.txt')};
const rulesHtml=()=>`<details class=card><summary><span>📖</span>Comment gagner de l’XP</summary>
  <div class=li><span><b>Muscu</b> : 20 + 1,5 / série (max 24) + volume (8×√tonnes, max 40) + 10 / record de 1RM + 3 / exercice en hausse de 5 % de volume. Max 150.</span></div>
  <div class=li><span><b>Cardio</b> : 8 + 0,25 / min + distance (course 4, marche 1,5, vélo 1, natation 20 par km), le tout jusqu’à ×1,5 selon ta vitesse. +10 par record de distance ou de vitesse. Max 150.</span></div>
  <div class=li><span><b>Mobilité / autre</b> : 5 + 0,2 / min (max 40).</span></div>
  <div class=li><span><b>Nutrition</b> : +8 par repas respecté, +20 si les 4 repas de la journée le sont (réglable dans Profil).</span></div>
  <div class=li><span><b>Régularité</b> : +50 quand ton objectif hebdo de séances est atteint, +10 par semaine d’affilée (max +50).</span></div>
  <small>Plafond quotidien réglable. Aucun point perdu les jours de repos.</small></details>`;
/* ---------- PROGRESSION (+ suivi corporel) ---------- */
V.prog=async()=>{const li=calc.levelInfo(await total()),ev=(await db.all('xpEvents')).sort(byDate).slice(0,20),bw=(await db.all('weights')).sort(byDate);
  return`<section class=card><h2>Niveau ${li.level} / 100</h2><div class="bar"><div style="width:${li.percent}%"></div></div><small>${li.xp} XP${li.nextAt?` · prochain niveau à ${li.nextAt} XP (${li.percent} %)`:' · niveau max'}</small></section>
  <section class=card><h2>Suivi corporel</h2><input id=bDate type=date value="${today()}"><div class=row><input id=bW type=number inputmode=decimal placeholder="Poids kg"><input id=bWa type=number placeholder="Taille cm"></div><div class=row><input id=bCh type=number placeholder="Poitrine"><input id=bAr type=number placeholder="Bras"><input id=bTh type=number placeholder="Cuisse"></div>
  <div class=row><input id=bCn placeholder="Autre mesure"><input id=bCv type=number placeholder="Valeur"></div><button class=main data-click="saveBody" data-args="">Enregistrer (historique conservé)</button>
  ${bw.length>1?`<div class=row><select id=cA>${bw.map(b=>`<option value=${b.id}>${b.date}</option>`).join('')}</select><select id=cB>${bw.map(b=>`<option value=${b.id}>${b.date}</option>`).join('')}</select></div><button class=sm data-click="cmp" data-args="">Comparer</button><div id=cmpOut></div>`:''}
  ${bw.slice(0,8).map(b=>`<div class=li><span>${b.date} · ${b.weight!=null?b.weight+' kg':''} ${b.waist!=null?'· taille '+b.waist:''}</span></div>`).join('')}</section>
  ${rulesHtml()}<section class=card><h2>Historique XP</h2>${ev.map(e=>`<div class=li><span>${e.date} · ${esc(e.label)}</span><b>+${e.xp}</b></div>`).join('')||'<small>Aucun gain.</small>'}</section>`};
A.saveBody=async()=>{const b={date:txt('bDate'),weight:val('bW'),waist:val('bWa'),chest:val('bCh'),arm:val('bAr'),thigh:val('bTh'),custom:[]};
  if(txt('bCn')&&val('bCv')!=null)b.custom.push({name:txt('bCn'),value:val('bCv')});
  if(!b.date||(b.weight==null&&b.waist==null&&b.chest==null&&b.arm==null&&b.thigh==null&&!b.custom.length))return toast('Saisis au moins une mesure');await db.add('weights',b);await render()};
A.cmp=async()=>{const a=await db.get('weights',parseInt($('cA').value)),b=await db.get('weights',parseInt($('cB').value)),f=k=>a[k]!=null&&b[k]!=null?(b[k]-a[k]>0?'+':'')+calc.round(b[k]-a[k],1):'n/d';
  $('cmpOut').innerHTML=`<small>${a.date} → ${b.date} : poids ${f('weight')} · taille ${f('waist')} · poitrine ${f('chest')} · bras ${f('arm')} · cuisse ${f('thigh')}</small>`};
/* ---------- PARAMÈTRES ---------- */
const VER='0.5';
V.set=async()=>{const x=await xcfg();
  return`<section class=card><h2>XP et régularité</h2><div class=row><span>Séances / semaine</span><input id=xW type=number value="${x.weekly}"></div><div class=row><span>Plafond XP / jour (séances)</span><input id=xCap type=number value="${x.cap}"></div><div class=row><span>Multiplicateur XP</span><input id=xMul type=number step=0.1 value="${x.mult}"></div><div class=row><span>XP par repas respecté</span><input id=xMeal type=number value="${x.meal}"></div><div class=row><span>Bonus journée parfaite</span><input id=xAll type=number value="${x.mealAll}"></div><button class=main data-click=saveSet>Enregistrer</button></section>
  <section class=card><h2>Sauvegarde</h2><button class=main data-click=backup>Exporter tout (JSON)</button><input id=restF type=file accept=".json"><button class=main data-click=restore>Restaurer (fusion sans doublons)</button><small>FITTRACK v${VER}</small></section>`};
A.saveSet=async()=>{await db.setSetting('xpv2',{cap:val('xCap')||250,mult:val('xMul')||1,weekly:val('xW')==null?3:val('xW'),meal:val('xMeal')==null?8:val('xMeal'),mealAll:val('xAll')==null?20:val('xAll')});toast('Paramètres enregistrés')};
A.backup=async()=>{const d=await db.exportAll(),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,1)],{type:'application/json'}));a.download='fittrack-'+today()+'.json';a.click()};
A.restore=async()=>{const f=$('restF').files&&$('restF').files[0];if(!f)return toast('Choisis un fichier');if(!await ask('Fusionner cette sauvegarde avec les données actuelles ?'))return;
  try{toast((await db.importAll(JSON.parse(await f.text())))+' éléments ajoutés');await render()}catch(e){toast('Erreur : '+e.message)}};
/* ---------- NAVIGATION ---------- */
async function render(){try{$('view').innerHTML=await V[tab]();Object.keys(V).forEach(t=>{$('t_'+t).className=t===tab?'on':''});
  $('lvl').textContent='LV '+calc.levelInfo(await total()).level;if(tab==='sport'){draw();if(run)startLoop()}}catch(e){$('view').innerHTML='<section class=card>Erreur : '+esc(e.message)+'</section>'}}
A.go=async t=>{tab=t;await render()};A.render=render;
function call(el,ev){const f=A[el.dataset[ev]];if(!f)return;const a=(el.dataset.args||'').split(',').filter(x=>x.trim()!=='').map(t=>{t=t.trim();return t==='this.value'?el.value:/^'.*'$/.test(t)?t.slice(1,-1):Number(t)});
  Promise.resolve().then(()=>f(...a)).catch(e=>toast('Erreur : '+e.message))}
['click','change','input'].forEach(ev=>document.addEventListener(ev,e=>{const el=e.target&&e.target.closest&&e.target.closest('[data-'+ev+']');if(el)call(el,ev)}));
document.addEventListener('DOMContentLoaded',()=>render());
})();
