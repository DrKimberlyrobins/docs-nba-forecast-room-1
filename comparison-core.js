/* Independent comparison layer. Never writes to DOC model inputs or original archives. */
(function(root){
'use strict';
const engines=['SportsLine','Statz AI','The Margin','DARKO','PropScout','xEP Network'];
const categories=['minutes','points','rebounds','assists','threes','PRA'];
const thresholds={minutes:4,points:4,rebounds:2,assists:2,threes:1,PRA:6};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const number=x=>x===null||x===undefined||String(x).trim()===''||/^(n\/a|na|—|-)$/i.test(String(x).trim())?null:Number.isFinite(Number(x))?Number(x):null;
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const team=x=>({NYK:'NY',GSW:'GS',NOP:'NO',SAS:'SA',UTA:'UTAH',PHX:'PHX',PHO:'PHX',BKN:'BKN',BRK:'BKN'})[String(x).toUpperCase()]||String(x).toUpperCase();
const stamp=x=>typeof x==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
function csv(text){
 const delimiter=text.split(/\r?\n/)[0].includes('\t')?'\t':',';const rows=[];let row=[],v='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===delimiter&&!q){row.push(v.trim());v='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v.trim());if(row.some(Boolean))rows.push(row);row=[];v='';}else v+=c;}
 if(q)throw Error('Unclosed CSV quote');row.push(v.trim());if(row.some(Boolean))rows.push(row);
 const headers=(rows.shift()||[]).map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''));if(new Set(headers).size!==headers.length)throw Error('Duplicate CSV headers');
 return rows.map((r,i)=>{if(r.length!==headers.length)throw Error('Column count at row '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
}
const aliases={min:'minutes',minutes:'minutes',pts:'points',points:'points',reb:'rebounds',rebounds:'rebounds',ast:'assists',assists:'assists','3pm':'threes',threepointersmade:'threes',threes:'threes',pra:'PRA'};
function importRows(text,meta,games,now=new Date().toISOString()){
 if(!engines.includes(meta.engine))throw Error('Select an engine');
 if(meta.scope!=='game')throw Error('Only game-specific projections accepted');
 if(!/^https:\/\//.test(meta.source||''))throw Error('HTTPS source URL required');
 if(!stamp(meta.as_of)||Date.parse(meta.as_of)>Date.parse(now))throw Error('Valid source time, including timezone, required');
 const rows=csv(text),out=[],seen=new Set();if(!rows.length)throw Error('No rows');
 for(const [i,r] of rows.entries()){
  const date=r.date||meta.date,gs=games.filter(g=>g.date===date&&(!r.gameid||String(g.id)===r.gameid));
  const matches=gs.flatMap(g=>(g.teams||[]).filter(t=>team(t.abbr)===team(r.team)).flatMap(t=>(t.players||[]).filter(p=>r.playerid?String(p.id)===r.playerid:norm(p.name)===norm(r.player||r.name)).map(p=>({g,t,p}))));
  if(matches.length!==1)throw Error('Row '+(i+2)+': player/team/date does not match exactly one roster; use ESPN player_id and game_id');
  const {g,t,p}=matches[0];const asof=r.asof||meta.as_of;
  if(!stamp(asof)||Date.parse(asof)>Date.parse(now))throw Error('Invalid row source time');
  const values={};if(r.category){const k=aliases[r.category.toLowerCase().replace(/[^a-z0-9]/g,'')];if(!k)throw Error('Unsupported category');values[k]=number(r.projection??r.value);}else for(const [h,k]of Object.entries(aliases))if(h in r)values[k]=number(r[h]);
  if(!Object.values(values).some(finite))throw Error('No numeric projections in row '+(i+2));
  if(!('PRA' in values)&&['points','rebounds','assists'].every(k=>finite(values[k])))values.PRA=values.points+values.rebounds+values.assists;
  for(const [category,value]of Object.entries(values)){
   if(value===null)continue;if(value<0||(category==='minutes'&&value>60))throw Error('Out-of-range projection');
   const key=[meta.engine,g.id,p.id,category].join('|');if(seen.has(key))throw Error('Duplicate player/category');seen.add(key);
   out.push({engine:meta.engine,game_id:String(g.id),date,team:t.abbr,player_id:String(p.id),player:p.name,category,value,as_of:asof,source:meta.source,imported_at:now,mode:'Imported',scope:'game',tip:g.tip,prospective:Date.parse(now)<Date.parse(g.tip)&&Date.parse(asof)<=Date.parse(now)});
  }
 }
 return out;
}
function status(rows,now=Date.now()){
 if(!rows.length)return 'Unavailable';return rows.every(r=>now-Date.parse(r.as_of)<=6*3600000&&Date.parse(r.as_of)<=now&&now<Date.parse(r.tip))?(rows.every(r=>r.mode==='Live')?'Live':'Imported'):'Stale';
}
function projection(p,c){return c==='minutes'?p.minutes:p.projections?.[c];}
function actual(e,c){if(c==='PRA')return ['points','rebounds','assists'].every(k=>finite(e[k]))?e.points+e.rebounds+e.assists:null;return e[c];}
function history(p,tip){const seen=new Set();return (p.evidence||[]).filter(e=>{const key=e.game_id||e.date;if(seen.has(key)||!stamp(e.date)||Date.parse(e.date)>=Date.parse(tip)||!finite(e.minutes)||e.minutes<=0)return false;seen.add(key);return true;}).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));}
function average(p,c,n,tip){const h=history(p,tip).slice(0,n);const a=h.map(e=>actual(e,c)).filter(finite);return {value:a.length?a.reduce((s,x)=>s+x,0)/a.length:null,n:a.length,complete:a.length===n};}
function disagreement(doc,external,c){return finite(doc)&&finite(external)?{delta:external-doc,highlight:Math.abs(external-doc)>=thresholds[c]}:{delta:null,highlight:false};}
function reason(p,rows,engine){
 const min=rows.find(r=>r.engine===engine&&r.category==='minutes');const notes=[];
 if(min&&finite(p.minutes)&&Math.abs(min.value-p.minutes)>=4)notes.push('Projected minutes differ: DOC '+p.minutes.toFixed(1)+', '+engine+' '+min.value.toFixed(1));
 if(p.status)notes.push('DOC availability at capture: '+p.status+(p.injury?' ('+p.injury+')':''));
 notes.push('External usage, injury assumptions and expected role are not supplied; cause is unverified.');return notes.join('. ');
}
function decimal(odds){return finite(odds)&&Math.abs(odds)>=100?(odds>0?1+odds/100:1+100/-odds):null;}
/* Joint empirical residual bootstrap: same historical game for PTS/REB/AST preserves PRA dependence. Experimental, not calibrated. */
function simulate(p,category,line,tip,seed=17){
 const mu=projection(p,category);const h=history(p,tip).filter(e=>finite(actual(e,category)));
 if(!finite(mu)||!finite(line)||h.length<5||!(p.minutes>0))return null;
 const mean=h.reduce((s,e)=>s+actual(e,category),0)/h.length;
 let over=0,under=0,push=0;let state=seed>>>0;
 for(let i=0;i<10000;i++){state=(Math.imul(1664525,state)+1013904223)>>>0;const e=h[Math.floor(state/4294967296*h.length)];const value=Math.max(0,Math.round(mu+actual(e,category)-mean));if(value>line)over++;else if(value<line)under++;else push++;}
 return {over:over/10000,under:under/10000,push:push/10000,runs:10000,sample:h.length,method:'DOC-centered empirical residual bootstrap v1; uncalibrated'};
}
function topTwo(g,t,quotes,now=Date.now()){
 const candidates=[],missing=new Set();
 if(Date.parse(g.tip)<=now||(g.state&&g.state!=='pre')||/postpon|cancel|delay/i.test(g.status||''))return {picks:[],missing:['Game underway, finished or postponed; no current pregame recommendation']};
 if(!stamp(g.as_of)||now-Date.parse(g.as_of)>6*3600000||Date.parse(g.as_of)>now)return {picks:[],missing:['Fresh DOC pregame projection (≤6 hours old)']};
 for(const p of t.players||[]){if(/out|doubtful/i.test(p.status||''))continue;for(const category of categories.filter(c=>c!=='minutes')){
  const qs=quotes.filter(q=>String(q.game_id)===String(g.id)&&String(q.player_id)===String(p.id)&&team(q.team)===team(t.abbr)&&q.category===category&&q.verified===true&&q.source&&stamp(q.as_of)&&now-Date.parse(q.as_of)<=3600000&&Date.parse(q.as_of)<=now&&Date.parse(q.as_of)<Date.parse(g.tip)&&finite(q.line)&&q.line>=0);
  if(!qs.length){missing.add('Verified player sportsbook lines and odds (≤60 minutes old)');continue;}
  for(const q of qs){const sim=simulate(p,category,q.line,g.tip);if(!sim){missing.add('DOC projection and at least 5 prior appearances');continue;}
   for(const direction of ['over','under']){const odds=q[direction+'_odds'],d=decimal(odds);if(!d){missing.add('Valid American odds for '+direction);continue;}const probability=sim[direction],loss=sim[direction==='over'?'under':'over'];const ev=probability*(d-1)-loss;const conditional=probability/(1-sim.push);
    if(ev>0)candidates.push({player:p,category,direction,line:q.line,odds,projection:projection(p,category),probability,push:sim.push,edge:conditional-1/d,ev,quote:q,simulation:sim,role:role(p),last5:average(p,category,5,g.tip)});
   }
  }
 }}
 const used=new Set(),picks=[];for(const c of candidates.sort((a,b)=>b.ev-a.ev)){if(used.has(String(c.player.id)))continue;used.add(String(c.player.id));picks.push(c);if(picks.length===2)break;}
 if(picks.length<2)missing.add('Fewer than two distinct players with positive estimated value');return {picks,missing:[...missing]};
}
function role(p){const rates=p.rates||{};const scores=[['Playmaker',rates.assists],['Rebounder',rates.rebounds],['Three-point shooter',finite(rates.threes)?rates.threes*3:null],['Scorer',finite(rates.points)?rates.points/3:null]].filter(x=>finite(x[1])).sort((a,b)=>b[1]-a[1]);return scores[0]?.[0]||'Role unavailable';}
function grade(rows,results){const groups={};for(const r of rows){if(!r.prospective)continue;const a=results.find(a=>String(a.game_id)===r.game_id&&String(a.player_id)===r.player_id&&team(a.team)===team(r.team)&&a.category===r.category&&a.completed&&!a.dnp&&finite(a.value));if(!a)continue;const k=r.engine+'|'+r.category;(groups[k]??=[]).push(r.value-a.value);}return Object.entries(groups).map(([key,errors])=>({engine:key.split('|')[0],category:key.split('|')[1],n:errors.length,mae:errors.reduce((s,e)=>s+Math.abs(e),0)/errors.length,bias:errors.reduce((s,e)=>s+e,0)/errors.length,rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length)}));}
const api={engines,categories,thresholds,finite,number,norm,team,stamp,csv,importRows,status,projection,actual,history,average,disagreement,reason,decimal,simulate,topTwo,role,grade};
if(typeof module!=='undefined')module.exports=api;else root.EngineComparison=api;
})(typeof globalThis!=='undefined'?globalThis:this);
